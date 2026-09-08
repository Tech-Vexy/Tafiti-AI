/**
 * Axios API client with:
 *  - Clerk JWT injection
 *  - Client-side in-memory GET cache (configurable TTL per URL prefix)
 *  - Automatic cache invalidation on mutating requests (POST/PUT/PATCH/DELETE)
 *  - 401 handling
 */
import axios from 'axios';

// ── Client-side GET cache ─────────────────────────────────────────────────────
const _cache = new Map();

const CACHE_TTL_RULES = [
    { prefix: '/auth/me',                       ttl: 30_000  },
    { prefix: '/queries/library',               ttl: 60_000  },
    { prefix: '/queries/',                      ttl: 30_000  },
    { prefix: '/notes/',                        ttl: 60_000  },
    { prefix: '/social/notifications',          ttl: 20_000  },
    { prefix: '/research/recommendations',      ttl: 120_000 },
    { prefix: '/billing/',                      ttl: 120_000 },
];

const BUST_RULES = [
    { mutationPrefix: '/queries/library',  bustPrefix: '/queries/library' },
    { mutationPrefix: '/queries/',         bustPrefix: '/queries/' },
    { mutationPrefix: '/notes/',           bustPrefix: '/notes/' },
    { mutationPrefix: '/auth/me',          bustPrefix: '/auth/me' },
    { mutationPrefix: '/social/',          bustPrefix: '/social/notifications' },
];

function cacheKey(config) {
    const url = config.url || '';
    const params = config.params ? `?${new URLSearchParams(config.params).toString()}` : '';
    return `${config.method?.toUpperCase()}:${url}${params}`;
}

function getTtl(path) {
    let best = null;
    for (const rule of CACHE_TTL_RULES) {
        if (path.includes(rule.prefix)) {
            if (!best || rule.prefix.length > best.prefix.length) best = rule;
        }
    }
    return best ? best.ttl : 0;
}

function bustCache(path) {
    for (const rule of BUST_RULES) {
        if (path.includes(rule.mutationPrefix)) {
            for (const key of _cache.keys()) {
                if (key.includes(rule.bustPrefix)) _cache.delete(key);
            }
        }
    }
}

// ── Axios instance ────────────────────────────────────────────────────────────
const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || '/api/v1',
    headers: { 'Content-Type': 'application/json' },
    timeout: 30_000,
});

// ── Auth token injection ──────────────────────────────────────────────────────
export const injectToken = (getToken) => {
    api.interceptors.request.use(async (config) => {
        try {
            const token = await getToken();
            if (token) config.headers.Authorization = `Bearer ${token}`;
        } catch {
            // Silently continue — 401 handler will deal with auth failures
        }
        return config;
    }, err => Promise.reject(err));
};

// ── Request interceptor — serve from cache for GET ────────────────────────────
api.interceptors.request.use(config => {
    if (config.method?.toLowerCase() !== 'get') return config;

    const path = config.url || '';
    const ttl  = getTtl(path);
    if (ttl <= 0) return config;

    const key    = cacheKey(config);
    const cached = _cache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
        config.adapter = () => Promise.resolve({
            data:    cached.data,
            status:  200,
            statusText: 'OK (cached)',
            headers: {},
            config,
        });
    }
    return config;
}, err => Promise.reject(err));

// ── Response interceptor ──────────────────────────────────────────────────────
api.interceptors.response.use(response => {
    const method = response.config.method?.toLowerCase();
    const path   = response.config.url || '';

    if (method === 'get') {
        const ttl = getTtl(path);
        if (ttl > 0) {
            _cache.set(cacheKey(response.config), { data: response.data, expiresAt: Date.now() + ttl });
        }
    } else if (['post', 'put', 'patch', 'delete'].includes(method)) {
        bustCache(path);
    }

    return response;
}, error => {
    if (error.response?.status === 401) {
        if (typeof window !== 'undefined') localStorage.removeItem('auth_token');
    }
    return Promise.reject(error);
});

export const invalidateCache = (prefix) => {
    for (const key of _cache.keys()) {
        if (key.includes(prefix)) _cache.delete(key);
    }
};

// ── Retry for transient network/5xx ───────────────────────────────────────────
api.interceptors.response.use(null, async (error) => {
    const config = error.config;
    if (!config || config._noRetry) return Promise.reject(error);
    const status = error.response?.status;
    const isTransient = !error.response || (status >= 500 && status < 600) || status === 429;
    if (!isTransient) return Promise.reject(error);
    config._retryCount = config._retryCount || 0;
    if (config._retryCount >= 2) return Promise.reject(error);
    config._retryCount += 1;
    const delay = Math.pow(2, config._retryCount - 1) * 400 + Math.random() * 200;
    await new Promise(r => setTimeout(r, delay));
    return api(config);
});

export default api;

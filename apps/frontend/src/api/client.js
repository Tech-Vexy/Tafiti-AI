/**
 * Axios API client with:
 *  - Clerk JWT injection
 *  - Client-side in-memory GET cache (configurable TTL per URL prefix)
 *  - Automatic cache invalidation on mutating requests (POST/PUT/PATCH/DELETE)
 *  - 401 handling
 */
import axios from 'axios';

// ── Client-side GET cache ─────────────────────────────────────────────────────
// Keyed by "<method>:<url>". Values: { data, expiresAt }
const _cache = new Map();

// TTL (ms) rules — matched by URL prefix (longest match wins)
const CACHE_TTL_RULES = [
    { prefix: '/auth/me',                       ttl: 30_000  },  // 30 s — profile
    { prefix: '/queries/library',               ttl: 60_000  },  // 60 s — library
    { prefix: '/queries/',                      ttl: 30_000  },  // 30 s — history
    { prefix: '/notes/',                        ttl: 60_000  },  // 60 s — notes list
    { prefix: '/social/notifications',          ttl: 20_000  },  // 20 s — notifications
    { prefix: '/research/recommendations',      ttl: 120_000 },  // 2 min — researchers
    { prefix: '/billing/',                      ttl: 120_000 },  // 2 min — billing info
];

// URL prefixes whose cache entries should be busted on mutation
const BUST_RULES = [
    { mutationPrefix: '/queries/library',  bustPrefix: '/queries/library' },
    { mutationPrefix: '/queries/',         bustPrefix: '/queries/' },
    { mutationPrefix: '/notes/',           bustPrefix: '/notes/' },
    { mutationPrefix: '/auth/me',          bustPrefix: '/auth/me' },
    { mutationPrefix: '/social/',          bustPrefix: '/social/notifications' },
];

function getTtl(path) {
    let best = null;
    for (const rule of CACHE_TTL_RULES) {
        if (path.includes(rule.prefix)) {
            if (!best || rule.prefix.length > best.prefix.length) best = rule;
        }
    }
    return best ? best.ttl : 0; // 0 = do not cache
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
    baseURL: import.meta.env.VITE_API_URL || '/api/v1',
    headers: { 'Content-Type': 'application/json' },
    // Keep connections alive
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

    const key    = `GET:${path}`;
    const cached = _cache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
        // Return a resolved promise with a synthetic response so Axios skips the
        // network request.  We attach the data via a custom adapter.
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

// ── Response interceptor — populate cache + invalidate on mutations ───────────
api.interceptors.response.use(response => {
    const method = response.config.method?.toLowerCase();
    const path   = response.config.url || '';

    if (method === 'get') {
        const ttl = getTtl(path);
        if (ttl > 0) {
            _cache.set(`GET:${path}`, { data: response.data, expiresAt: Date.now() + ttl });
        }
    } else if (['post', 'put', 'patch', 'delete'].includes(method)) {
        bustCache(path);
    }

    return response;
}, error => {
    if (error.response?.status === 401) {
        localStorage.removeItem('auth_token');
    }
    return Promise.reject(error);
});

/** Manually invalidate all cache entries whose key includes `prefix`. */
export const invalidateCache = (prefix) => {
    for (const key of _cache.keys()) {
        if (key.includes(prefix)) _cache.delete(key);
    }
};

export default api;

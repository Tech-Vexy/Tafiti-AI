/**
 * TypeScript API Client
 * ---------------------
 * Unified fetch-based API client for Tafiti AI frontend.
 * Interacts with Next.js route handlers at /api/v1/*.
 */

export const API_BASE_URL = '/api/v1';

const DEFAULT_TIMEOUT = Number(process.env.NEXT_PUBLIC_API_TIMEOUT || 30_000);

export interface RequestOptions {
  params?: Record<string, any>;
  data?: any;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
  config: {
    method: string;
    url: string;
    params?: Record<string, any>;
  };
}

export interface ApiError extends Error {
  response?: ApiResponse<any>;
  config?: any;
}

// ── Client-side GET Cache ───────────────────────────────────────────────────
interface CacheEntry {
  data: any;
  expiresAt: number;
}

const _cache = new Map<string, CacheEntry>();

const CACHE_TTL_RULES = [
  { prefix: '/auth/me', ttl: 30_000 },
  { prefix: '/queries/library', ttl: 60_000 },
  { prefix: '/queries', ttl: 30_000 },
  { prefix: '/notes', ttl: 60_000 },
  { prefix: '/social/notifications', ttl: 20_000 },
  { prefix: '/research/recommendations', ttl: 120_000 },
  { prefix: '/billing', ttl: 120_000 },
];

const BUST_RULES = [
  { mutationPrefix: '/queries/library', bustPrefix: '/queries/library' },
  { mutationPrefix: '/queries', bustPrefix: '/queries' },
  { mutationPrefix: '/notes', bustPrefix: '/notes' },
  { mutationPrefix: '/auth/me', bustPrefix: '/auth/me' },
  { mutationPrefix: '/social', bustPrefix: '/social/notifications' },
];

function getTtl(path: string): number {
  let best: { prefix: string; ttl: number } | null = null;
  for (const rule of CACHE_TTL_RULES) {
    if (path.includes(rule.prefix)) {
      if (!best || rule.prefix.length > best.prefix.length) best = rule;
    }
  }
  return best ? best.ttl : 0;
}

function cacheKey(method: string, path: string, params?: Record<string, any>): string {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
  return `${method.toUpperCase()}:${path}${qs}`;
}

function bustCache(path: string): void {
  for (const rule of BUST_RULES) {
    if (path.includes(rule.mutationPrefix)) {
      for (const key of _cache.keys()) {
        if (key.includes(rule.bustPrefix)) _cache.delete(key);
      }
    }
  }
}

export const invalidateCache = (prefix: string): void => {
  for (const key of _cache.keys()) {
    if (key.includes(prefix)) _cache.delete(key);
  }
};

// ── Low-level request ───────────────────────────────────────────────────────
function buildUrl(path: string, params?: Record<string, any>): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  let url = `${API_BASE_URL}${cleanPath}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    url += (url.includes('?') ? '&' : '?') + qs;
  }
  return url;
}

function createApiError(
  message: string,
  data: any,
  response?: ApiResponse,
  config?: any
): ApiError {
  const err = new Error(message) as ApiError;
  err.name = 'ApiError';
  err.response = response || {
    status: 0,
    statusText: '',
    data,
    headers: new Headers(),
    config,
  };
  err.config = config;
  return err;
}

async function request<T = any>(
  method: string,
  path: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const { params, data, headers: extraHeaders = {}, timeoutMs = DEFAULT_TIMEOUT } = options;
  const upperMethod = method.toUpperCase();
  const reqStart = Date.now();

  // Serve from cache for GET
  if (upperMethod === 'GET') {
    const ttl = getTtl(path);
    if (ttl > 0) {
      const key = cacheKey(upperMethod, path, params);
      const cached = _cache.get(key);
      if (cached && Date.now() < cached.expiresAt) {
        console.debug(`[API] ${upperMethod} ${path} (cached)`);
        return {
          data: cached.data as T,
          status: 200,
          statusText: 'OK (cached)',
          headers: new Headers(),
          config: { method: upperMethod, url: path, params },
        };
      }
    }
  }

  const hasBody = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(upperMethod) && data !== undefined;
  const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
  const headers: Record<string, string> = { ...extraHeaders };
  if (hasBody && !isFormData) headers['Content-Type'] = 'application/json';

  if (!headers['Authorization'] && !headers['authorization'] && typeof window !== 'undefined') {
    try {
      const token = await (window as any).Clerk?.session?.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch {
      // ignore
    }
  }

  let attempt = 0;
  const maxRetries = 2;

  while (true) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const targetUrl = buildUrl(path, params);
      const res = await fetch(targetUrl, {
        method: upperMethod,
        headers,
        credentials: 'include',
        body: hasBody ? (isFormData ? data : JSON.stringify(data)) : undefined,
        signal: controller.signal,
        cache: 'no-store',
      });

      clearTimeout(timeoutId);
      const duration = Date.now() - reqStart;

      const contentType = res.headers.get('content-type') || '';
      const text = await res.text();
      let responseBody: any = text;
      if (contentType.includes('application/json')) {
        try {
          responseBody = text ? JSON.parse(text) : text;
        } catch {
          responseBody = text;
        }
      }

      const responseObj: ApiResponse<T> = {
        data: responseBody,
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
        config: { method: upperMethod, url: path, params },
      };

      if (res.ok) {
        console.info(`[API] ${upperMethod} ${path} -> ${res.status} (${duration}ms)`);
        if (upperMethod === 'GET') {
          const ttl = getTtl(path);
          if (ttl > 0) {
            _cache.set(cacheKey(upperMethod, path, params), {
              data: responseBody,
              expiresAt: Date.now() + ttl,
            });
          }
        } else {
          bustCache(path);
        }
        return responseObj;
      }

      console.warn(`[API] ${upperMethod} ${path} failed with ${res.status} (${duration}ms)`);

      if (res.status === 401) {
        throw createApiError(`Request failed with status ${res.status}`, responseBody, responseObj, responseObj.config);
      }

      const isTransient = res.status >= 500 || res.status === 429;
      if (!isTransient || attempt >= maxRetries) {
        throw createApiError(`Request failed with status ${res.status}`, responseBody, responseObj, responseObj.config);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err && err.response) throw err;
      if (attempt >= maxRetries) {
        console.error(`[API] ${upperMethod} ${path} connection error:`, err?.message || err);
        throw createApiError(err?.message || 'Network error', null, undefined, { method: upperMethod, url: path });
      }
    }

    attempt += 1;
    const delay = Math.pow(2, attempt - 1) * 300 + Math.random() * 200;
    console.debug(`[API] Retrying ${upperMethod} ${path} (attempt ${attempt + 1}/${maxRetries + 1}) after ${Math.round(delay)}ms`);
    await new Promise((r) => setTimeout(r, delay));
  }
}

// ── Public client ───────────────────────────────────────────────────────────
export const api = {
  get: <T = any>(url: string, opts: RequestOptions = {}) => request<T>('GET', url, opts),
  post: <T = any>(url: string, data?: any, opts: RequestOptions = {}) =>
    request<T>('POST', url, { ...opts, data }),
  put: <T = any>(url: string, data?: any, opts: RequestOptions = {}) =>
    request<T>('PUT', url, { ...opts, data }),
  patch: <T = any>(url: string, data?: any, opts: RequestOptions = {}) =>
    request<T>('PATCH', url, { ...opts, data }),
  delete: <T = any>(url: string, opts: RequestOptions = {}) =>
    request<T>('DELETE', url, opts),
  get defaults() {
    return { baseURL: API_BASE_URL };
  },
};

export default api;

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Agent, fetch as undiciFetch, setGlobalDispatcher } from 'undici';

/**
 * Catch-all proxy route.
 * Forwards /api/v1/<path> from the frontend to the backend service,
 * using Next.js route handlers (NextRequest / NextResponse).
 *
 * The backend base URL is resolved from BACKEND_URL (server-only) and falls
 * back to NEXT_PUBLIC_API_URL for local development.
 */

// Configure an undici agent that disables bodyTimeout (0 = disabled)
// so long-running autonomous deep research streams (5 - 15 minutes) never terminate
const proxyAgent = new Agent({
    connect: {
        timeout: 30_000,
    },
    headersTimeout: 0, // No headers timeout
    bodyTimeout: 0,    // 0 disables undici BodyTimeoutError (UND_ERR_BODY_TIMEOUT)
    keepAliveTimeout: 60_000,
    keepAliveMaxTimeout: 15 * 60 * 1000,
});

try {
    setGlobalDispatcher(proxyAgent);
} catch {
    // ignore if already set
}

const BACKEND_URL = (
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://127.0.0.1:8000'
).replace(/\/+$/, '').replace('//localhost:', '//127.0.0.1:');

function resolveTarget(request: NextRequest): string {
    const { pathname, search } = request.nextUrl;
    // The backend FastAPI application mounts routes at /api/v1/* (e.g. /api/v1/queries)
    if (BACKEND_URL.endsWith('/api/v1')) {
        const subpath = pathname.replace(/^\/api\/v1/, '');
        return `${BACKEND_URL}${subpath}${search}`;
    }
    if (BACKEND_URL.endsWith('/api')) {
        const subpath = pathname.replace(/^\/api/, '');
        return `${BACKEND_URL}${subpath}${search}`;
    }
    // BACKEND_URL is http://127.0.0.1:8000, keep full pathname (/api/v1/...)
    return `${BACKEND_URL}${pathname}${search}`;
}

const HOP_BY_HOP = [
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
    'content-length',
    'content-encoding',
];

async function forward(request: NextRequest): Promise<NextResponse> {
    const target = resolveTarget(request);
    const method = request.method.toUpperCase();
    const isReadable = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const startTime = Date.now();

    // Resolve the Clerk session token server-side (BFF pattern) so JWTs never
    // need to be fetched or held in browser code.
    let serverToken: string | null = null;
    try {
        const authState = await auth();
        serverToken = await authState.getToken();
    } catch (authErr) {
        console.warn('[Proxy] Server-side token resolution failed:', authErr instanceof Error ? authErr.message : authErr);
    }

    const headers = new Headers();
    headers.set('Accept', 'application/json');
    const clientAuth = request.headers.get('authorization');
    if (clientAuth) {
        headers.set('authorization', clientAuth);
    } else if (serverToken) {
        headers.set('authorization', `Bearer ${serverToken}`);
    }
    if (request.headers.has('content-type')) {
        headers.set('content-type', request.headers.get('content-type')!);
    }
    if (request.headers.has('x-forwarded-for')) {
        headers.set('x-forwarded-for', request.headers.get('x-forwarded-for')!);
    }

    const init: RequestInit & { dispatcher?: any } = {
        method,
        headers,
        redirect: 'follow',
        dispatcher: proxyAgent,
    };
    if (isReadable) {
        init.body = await request.arrayBuffer();
    }

    try {
        const upstream = await undiciFetch(target, init as any);
        const duration = Date.now() - startTime;
        console.log(`[Proxy] ${method} ${request.nextUrl.pathname}${request.nextUrl.search} -> ${upstream.status} (${duration}ms)`);

        const nextHeaders = new Headers();
        upstream.headers.forEach((value, key) => {
            if (!HOP_BY_HOP.includes(key.toLowerCase())) nextHeaders.set(key, value);
        });

        // For SSE streams (e.g. /chat/stream), pass upstream.body unchanged with TransformStream
        const contentType = upstream.headers.get('content-type') || '';
        const isStream = contentType.includes('text/event-stream') || request.nextUrl.pathname.includes('/stream');

        if (isStream && upstream.body) {
            nextHeaders.set('Content-Type', 'text/event-stream; charset=utf-8');
            nextHeaders.set('Cache-Control', 'no-cache, no-transform');
            nextHeaders.set('Connection', 'keep-alive');
            nextHeaders.set('X-Accel-Buffering', 'no');

            const { readable, writable } = new TransformStream();
            (upstream.body as any).pipeTo(writable).catch((pipeErr: any) => {
                console.warn(`[Proxy Stream Pipe] Upstream stream pipe ended: ${pipeErr?.message || pipeErr}`);
            });

            return new NextResponse(readable as any, {
                status: upstream.status,
                statusText: upstream.statusText,
                headers: nextHeaders,
            });
        }

        // For regular JSON and standard REST responses, buffer arrayBuffer completely
        // to prevent premature connection resets / "Failed to fetch" on the client
        const data = await upstream.arrayBuffer();
        return new NextResponse(data, {
            status: upstream.status,
            statusText: upstream.statusText,
            headers: nextHeaders,
        });
    } catch (err: any) {
        const duration = Date.now() - startTime;
        const causeMsg = err?.cause?.message || err?.cause?.code || (err?.cause ? String(err.cause) : '');
        const baseMsg = err instanceof Error ? err.message : 'Proxy upstream error';
        const message = causeMsg ? `${baseMsg}: ${causeMsg}` : baseMsg;
        console.error(`[Proxy Error] ${method} ${target} failed after ${duration}ms:`, message);
        return NextResponse.json(
            { error: 'backend_unreachable', message, target },
            { status: 502 }
        );
    }
}

export async function GET(request: NextRequest) {
    return forward(request);
}

export async function POST(request: NextRequest) {
    return forward(request);
}

export async function PUT(request: NextRequest) {
    return forward(request);
}

export async function PATCH(request: NextRequest) {
    return forward(request);
}

export async function DELETE(request: NextRequest) {
    return forward(request);
}

export async function OPTIONS(request: NextRequest) {
    return forward(request);
}

export async function HEAD(request: NextRequest) {
    return forward(request);
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 900;

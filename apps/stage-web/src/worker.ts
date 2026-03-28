// NOTICE: Fetcher and ExportedHandler are Cloudflare Workers runtime types.
// They are available at runtime but not in the project's TS config since this
// file is bundled separately by wrangler, not by Vite.

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> }
  API_ORIGIN: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Proxy /api/* and /ws/* to the backend API origin
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws/')) {
      const target = new URL(url.pathname + url.search, env.API_ORIGIN)
      const headers = new Headers(request.headers)
      headers.set('host', new URL(env.API_ORIGIN).host)
      headers.set('x-forwarded-host', url.host)

      return fetch(target, {
        method: request.method,
        headers,
        body: request.body,
        redirect: 'manual',
      })
    }

    // Everything else → static assets with SPA fallback
    const assetResponse = await env.ASSETS.fetch(request)
    if (assetResponse.status === 404) {
      // SPA fallback: serve index.html for client-side routing
      return env.ASSETS.fetch(new Request(new URL('/', request.url), request))
    }
    return assetResponse
  },
} as { fetch: (request: Request, env: Env) => Promise<Response> }

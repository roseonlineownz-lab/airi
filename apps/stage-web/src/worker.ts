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
      headers.set('host', target.host)
      headers.set('x-forwarded-host', url.host)

      return fetch(target, {
        method: request.method,
        headers,
        body: request.body,
        redirect: 'manual',
      })
    }

    // Everything else → static assets (SPA)
    return env.ASSETS.fetch(request)
  },
} as { fetch: (request: Request, env: Env) => Promise<Response> }

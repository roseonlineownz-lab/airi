import type { AppType } from '../../../../apps/server/src/app'

import { hc } from 'hono/client'

import { SERVER_URL } from '../libs/server'

export const client = hc<AppType>(SERVER_URL, {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => {
    return fetch(input, {
      ...init,
      credentials: 'include',
    })
  },
})

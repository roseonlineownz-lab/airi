import type { MiddlewareHandler } from 'hono'

import type { createAuth } from '../libs/auth'
import type { HonoEnv } from '../types/hono'

import { timingSafeEqual } from 'node:crypto'

import { useLogger } from '@guiiai/logg'
import { getConnInfo } from '@hono/node-server/conninfo'

import { createUnauthorizedError } from '../utils/error'

const logger = useLogger('auth')

type AuthInstance = ReturnType<typeof createAuth>
type HonoUser = HonoEnv['Variables']['user']

interface LocalAdminAuthOptions {
  token?: string
  userId?: string
  getUser?: () => Promise<HonoUser>
}

function parseBearerToken(value: string | undefined): string | undefined {
  if (!value)
    return undefined

  const [scheme, token] = value.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token)
    return undefined

  return token
}

function tokensMatch(actual: string | undefined, expected: string): boolean {
  if (!actual)
    return false

  const actualBytes = Buffer.from(actual)
  const expectedBytes = Buffer.from(expected)

  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes)
}

function isLoopbackAddress(address: string | undefined): boolean {
  if (!address)
    return false

  return address === 'localhost'
    || address === '::1'
    || address === '0:0:0:0:0:0:0:1'
    || address === '::ffff:127.0.0.1'
    || address.startsWith('127.')
}

function isLoopbackRequest(c: Parameters<MiddlewareHandler<HonoEnv>>[0]): boolean {
  let remoteAddress: string | undefined
  try {
    remoteAddress = getConnInfo(c).remote?.address
  }
  catch {
    remoteAddress = undefined
  }

  if (remoteAddress)
    return isLoopbackAddress(remoteAddress)

  try {
    return isLoopbackAddress(new URL(c.req.url).hostname)
  }
  catch {
    return false
  }
}

/**
 * Session middleware injects the user and session into the Hono context.
 * It does not block unauthorized requests.
 */
export function sessionMiddleware(auth: AuthInstance): MiddlewareHandler<HonoEnv> {
  return async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers })

    c.set('localAdmin', false)

    if (!session) {
      c.set('user', null)
      c.set('session', null)
      return await next()
    }

    c.set('user', session.user)
    c.set('session', session.session)
    await next()
  }
}

export function localAdminTokenMiddleware(options?: LocalAdminAuthOptions): MiddlewareHandler<HonoEnv> {
  return async (c, next) => {
    if (c.get('user') || !options?.token) {
      return await next()
    }

    const requestToken = c.req.header('x-airi-admin-token') ?? parseBearerToken(c.req.header('authorization'))
    if (!tokensMatch(requestToken, options.token)) {
      return await next()
    }

    if (!isLoopbackRequest(c)) {
      logger.withFields({ path: c.req.path, method: c.req.method }).warn('Local admin token rejected for non-loopback request')
      return await next()
    }

    const user = await options.getUser?.() ?? {
      id: options.userId ?? 'airi-local-admin',
      name: 'AIRI Local Admin',
      email: 'airi-local-admin@localhost.invalid',
      emailVerified: true,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    c.set('user', user)
    c.set('session', null)
    c.set('localAdmin', true)
    await next()
  }
}

/**
 * Auth guard middleware blocks requests if the user is not authenticated.
 * Must be used after sessionMiddleware.
 */
export const authGuard: MiddlewareHandler<HonoEnv> = async (c, next) => {
  const user = c.get('user')
  if (!user) {
    logger.withFields({ path: c.req.path, method: c.req.method }).debug('Unauthorized request blocked')
    throw createUnauthorizedError()
  }
  await next()
}

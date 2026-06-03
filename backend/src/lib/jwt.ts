import { SignJWT, jwtVerify } from 'jose'
import type { JwtPayload } from '../types'
import { env } from './env'

const secret = new TextEncoder().encode(env.JWT_SECRET)

export async function signToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT({ tenantId: payload.tenantId, role: payload.role, plan: payload.plan })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(env.JWT_EXPIRES_IN)
    .sign(secret)
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, secret)
  return payload as unknown as JwtPayload
}

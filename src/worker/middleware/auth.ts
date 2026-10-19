import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { sha256Hex } from '../utils/crypto';
import { fail } from '../utils/response';
import type { WorkerEnv } from '../db/init';
import type { AdminUser } from '../../shared/types';

export const SESSION_COOKIE_NAME = 'moc_admin_session';

// Rate limiting cho endpoint đăng nhập (5 lần thử thất bại / 5 phút trên mỗi IP)
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export function checkLoginRateLimit(ip: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now > record.resetAt) {
    return { allowed: true };
  }
  if (record.count >= 5) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((record.resetAt - now) / 1000),
    };
  }
  return { allowed: true };
}

export function recordFailedLoginAttempt(ip: string): void {
  const now = Date.now();
  const windowMs = 5 * 60 * 1000;
  const record = loginAttempts.get(ip);
  if (!record || now > record.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + windowMs });
  } else {
    record.count += 1;
  }
}

export function clearLoginAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

export async function getAuthenticatedAdmin(
  c: Context<{ Bindings: WorkerEnv; Variables: { adminUser: AdminUser } }>
): Promise<AdminUser | null> {
  const cookieToken = getCookie(c, SESSION_COOKIE_NAME);
  const authHeader = c.req.header('Authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
  const rawToken = cookieToken || bearerToken;

  if (!rawToken) return null;

  const tokenHash = await sha256Hex(rawToken);
  const sessionRow = await c.env.DB.prepare(
    `SELECT s.token_hash, s.csrf_token, s.expires_at,
            u.id as user_id, u.email, u.full_name, u.role, u.is_active
     FROM sessions s
     INNER JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > datetime('now')`
  )
    .bind(tokenHash)
    .first<{
      token_hash: string;
      csrf_token: string;
      expires_at: string;
      user_id: number;
      email: string;
      full_name: string;
      role: 'admin' | 'staff';
      is_active: number;
    }>();

  if (!sessionRow || !sessionRow.is_active) {
    return null;
  }

  return {
    id: sessionRow.user_id,
    email: sessionRow.email,
    full_name: sessionRow.full_name,
    role: sessionRow.role,
    csrf_token: sessionRow.csrf_token,
  };
}

export async function requireAdminAuth(
  c: Context<{ Bindings: WorkerEnv; Variables: { adminUser: AdminUser } }>,
  next: Next
) {
  const admin = await getAuthenticatedAdmin(c);
  if (!admin) {
    return fail(c, 'UNAUTHORIZED', 'Vui lòng đăng nhập tài khoản quản trị để thực hiện thao tác này.', 401);
  }
  c.set('adminUser', admin);
  await next();
}

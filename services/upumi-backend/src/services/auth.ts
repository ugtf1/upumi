import type { FastifyRequest } from 'fastify';

export type Role = 'ADMIN' | 'MEMBER';
export type JwtUser = { sub: string; phone: string; email?: string | null; role: Role; needsPasswordChange?: boolean };

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtUser;
    user: JwtUser;
  }
}

export async function requireAuth(req: FastifyRequest) {
  await req.jwtVerify();
  if (req.user.needsPasswordChange) {
    const path = req.url.split('?')[0];
    if (path !== '/api/me/profile' && path !== '/api/me' && path !== '/api/auth/change-password') {
      const err: any = new Error('Password change required');
      err.statusCode = 403;
      err.code = 'PASSWORD_CHANGE_REQUIRED';
      throw err;
    }
  }
}

export function requireRole(role: Role) {
  return async (req: FastifyRequest) => {
    await req.jwtVerify();
    if (req.user.needsPasswordChange) {
      const err: any = new Error('Password change required');
      err.statusCode = 403;
      err.code = 'PASSWORD_CHANGE_REQUIRED';
      throw err;
    }
    if (req.user.role !== role) {
      const err: any = new Error('Forbidden');
      err.statusCode = 403;
      throw err;
    }
  };
}

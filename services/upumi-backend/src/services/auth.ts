import type { FastifyRequest } from 'fastify';

export type Role = 'ADMIN' | 'MEMBER';
export type JwtUser = { sub: string; phone: string; email?: string | null; role: Role };

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtUser;
    user: JwtUser;
  }
}

export async function requireAuth(req: FastifyRequest) {
  await req.jwtVerify();
}

export function requireRole(role: Role) {
  return async (req: FastifyRequest) => {
    await req.jwtVerify();
    if (req.user.role !== role) {
      const err: any = new Error('Forbidden');
      err.statusCode = 403;
      throw err;
    }
  };
}

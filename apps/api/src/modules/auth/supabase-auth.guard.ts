import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  AuthenticatedIdentity,
  SupabaseAuthService,
} from './supabase-auth.service.js';

export type AuthenticatedRequest = Request & {
  authIdentity: AuthenticatedIdentity;
};

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly supabaseAuthService: SupabaseAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const token = /^Bearer ([^\s]+)$/i.exec(authorization ?? '')?.[1];

    if (!token) {
      throw new UnauthorizedException('Bearer アクセストークンが必要です');
    }

    request.authIdentity =
      await this.supabaseAuthService.verifyAccessToken(token);
    return true;
  }
}

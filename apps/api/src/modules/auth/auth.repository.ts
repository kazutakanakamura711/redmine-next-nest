import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedIdentity } from './supabase-auth.service.js';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateUser(identity: AuthenticatedIdentity) {
    return this.prisma.user.upsert({
      where: { id: identity.id },
      create: identity,
      // メールアドレスは Supabase と同期し、表示名は初回登録時の値を保持する。
      update: { email: identity.email },
    });
  }
}

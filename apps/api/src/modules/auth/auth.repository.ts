import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  upsertUser(id: string, email: string, name: string | null) {
    return this.prisma.user.upsert({
      where: { id },
      create: { id, email, name },
      update: { email, name },
    });
  }
}

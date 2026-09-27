import { Injectable } from '@nestjs/common';
import { AuthRepository } from './auth.repository.js';
import type { AuthenticatedIdentity } from './supabase-auth.service.js';

@Injectable()
export class AuthService {
  constructor(private readonly authRepository: AuthRepository) {}

  async getMe(identity: AuthenticatedIdentity) {
    return this.authRepository.findOrCreateUser(identity);
  }
}

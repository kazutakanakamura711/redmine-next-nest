import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { SupabaseAuthGuard } from './supabase-auth.guard.js';
import type { AuthenticatedRequest } from './supabase-auth.guard.js';
import { AuthUserResponseDto } from './dto/auth-user-response.dto.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '認証済みユーザーを取得する' })
  @ApiOkResponse({ type: AuthUserResponseDto })
  @ApiUnauthorizedResponse({ description: 'トークンがない、または無効' })
  @ApiForbiddenResponse({ description: 'メールアドレスが未確認' })
  async getMe(@Req() request: AuthenticatedRequest) {
    const user = await this.authService.getMe(request.authIdentity);
    return { id: user.id, email: user.email, name: user.name };
  }
}

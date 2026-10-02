import {
  Controller,
  Get,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // main.ts の /api と組み合わさり、GET /api/auth/me になる。
  @Get('me')
  getMe(@Headers('authorization') authorization?: string) {
    // 「Bearer <token>」の形式を確認し、(...) に一致した token を [1] で取り出す。
    // ヘッダーがない・形式が違う場合は undefined になる。
    const token = /^Bearer ([^\s]+)$/i.exec(authorization ?? '')?.[1];

    if (!token) {
      throw new UnauthorizedException('Bearer token が必要です。');
    }

    // token 自体の有効性確認と User の取得・作成は Service に任せる。
    return this.authService.getMe(token);
  }
}

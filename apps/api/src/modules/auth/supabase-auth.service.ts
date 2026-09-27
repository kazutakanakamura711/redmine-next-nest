import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

export type AuthenticatedIdentity = {
  id: string;
  email: string;
  name: string;
};

type SupabaseUserResponse = {
  id?: unknown;
  email?: unknown;
  email_confirmed_at?: unknown;
  user_metadata?: unknown;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class SupabaseAuthService {
  async verifyAccessToken(token: string): Promise<AuthenticatedIdentity> {
    const supabaseUrl = process.env.SUPABASE_URL;
    const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

    // 既存の Project API は次の PR で保護するため、設定は起動時でなく認証時に確認する。
    if (!supabaseUrl || !publishableKey) {
      throw new ServiceUnavailableException('認証サービスが設定されていません');
    }

    let response: Response;
    try {
      const userUrl = new URL('/auth/v1/user', supabaseUrl);
      response = await fetch(userUrl, {
        headers: {
          apikey: publishableKey,
          Authorization: `Bearer ${token}`,
        },
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new ServiceUnavailableException('認証サービスに接続できません');
    }

    // Supabase Auth が署名・有効期限を検証した結果だけを信頼する。
    if (
      response.status === 400 ||
      response.status === 401 ||
      response.status === 403
    ) {
      throw new UnauthorizedException('有効なアクセストークンが必要です');
    }
    if (!response.ok) {
      throw new ServiceUnavailableException('認証サービスを利用できません');
    }

    let user: SupabaseUserResponse;
    try {
      user = (await response.json()) as SupabaseUserResponse;
    } catch {
      throw new ServiceUnavailableException('認証サービスの応答が不正です');
    }

    if (
      typeof user?.id !== 'string' ||
      !UUID_PATTERN.test(user.id) ||
      typeof user.email !== 'string' ||
      user.email.trim().length === 0
    ) {
      throw new ServiceUnavailableException('認証サービスの応答が不正です');
    }
    if (
      typeof user.email_confirmed_at !== 'string' ||
      user.email_confirmed_at.length === 0
    ) {
      throw new ForbiddenException('メールアドレスの確認が必要です');
    }

    const metadata =
      user.user_metadata && typeof user.user_metadata === 'object'
        ? (user.user_metadata as Record<string, unknown>)
        : {};
    const displayName = metadata.full_name ?? metadata.name;

    return {
      id: user.id,
      email: user.email,
      name:
        typeof displayName === 'string' && displayName.trim()
          ? displayName.trim()
          : user.email,
    };
  }
}

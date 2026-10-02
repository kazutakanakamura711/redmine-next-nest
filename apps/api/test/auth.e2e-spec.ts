import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createClient } from '@supabase/supabase-js';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/modules/prisma/prisma.service.js';

describe('Auth endpoint', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('token がない場合は 401 を返す', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });

  it('Bearer 形式でも無効な token は 401 を返す', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-valid-jwt')
      .expect(401);
  });

  it('有効な token を送ると本人の User を返す', async () => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SECRET_KEY;
    const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !secretKey || !publishableKey) {
      throw new Error(
        'テスト用の Supabase URL、Secret key、Publishable key が必要です。',
      );
    }

    // 管理 API でユーザーを作成・削除するため、接続先をローカルだけに限定する。
    const url = new URL(supabaseUrl);
    if (
      url.protocol !== 'http:' ||
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    ) {
      throw new Error('Auth E2E はローカルの Supabase で実行してください。');
    }

    // Secret key を使うSupabaseの管理用クライアント。ログイン状態は保存しない。
    const adminClient = createClient(supabaseUrl, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

    // Publishable key を使うログイン用クライアント。ユーザーのメールとパスワードで認証する。
    const loginClient = createClient(supabaseUrl, publishableKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

    // 実行ごとに違うメールとパスワードを作り、既存ユーザーとの重複を避ける。
    const email = `e2e-${randomUUID()}@example.test`;
    const password = `E2e!${randomBytes(24).toString('hex')}`;
    let authUserId: string | undefined;
    // setup-env.ts で接続先を E2E 専用 DB に切り替えた PrismaService を使う。
    const prisma = app.get(PrismaService);

    try {
      // Supabase にユーザー作成を依頼する。
      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // 確認メールを開く操作を省き、確認済みとして作成する。
      });
      // 検証で失敗しても削除できるよう、作成したユーザーの ID を先に記録する。
      authUserId = data.user?.id;
      if (error) {
        throw error;
      }

      expect(data.user?.id).toEqual(expect.any(String));
      expect(data.user?.email).toBe(email);
      expect(data.user?.email_confirmed_at).toBeTruthy();

      // 作成時と同じメール・パスワードで Supabase Auth にログインする。
      const { data: signInData, error: signInError } =
        await loginClient.auth.signInWithPassword({ email, password });
      if (signInError) {
        throw signInError;
      }

      // ログインした本人が、今回作成したユーザーであることを確認する。
      expect(signInData.user?.id).toBe(authUserId);
      expect(signInData.user?.email).toBe(email);

      // ログイン成功時の session から、次に NestJS API へ渡す access token を取り出す。
      const accessToken = signInData.session?.access_token;
      expect(accessToken).toEqual(expect.any(String));
      expect(accessToken).toBeTruthy();

      // Authorization ヘッダーに Bearer token を入れ、NestJS の本人確認 API を呼ぶ。
      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // API が返すアプリ側の User が、ログインした本人であることを確認する。
      expect(response.body).toMatchObject({ id: authUserId, email });
    } finally {
      // 今回の API 呼び出しで作られたアプリ側の User と Auth ユーザーだけを削除する。
      if (authUserId) {
        try {
          // API 呼び出し前に失敗して User が未作成でも、deleteMany なら実行できる。
          await prisma.user.deleteMany({ where: { id: authUserId } });
        } finally {
          // アプリ側の削除が失敗した場合も、Auth ユーザーの削除を試みる。
          const { error } = await adminClient.auth.admin.deleteUser(authUserId);
          expect(error, 'テストユーザーの削除に失敗しました。').toBeNull();
        }
      }
    }
  });
});

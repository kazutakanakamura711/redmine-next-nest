import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/modules/prisma/prisma.service.js';

describe('GET /api/auth/me', () => {
  const firstUserId = crypto.randomUUID();
  const secondUserId = crypto.randomUUID();
  const testUserIds = [firstUserId, secondUserId];
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  let authServer: Server;
  let app: INestApplication;

  beforeAll(async () => {
    // CI では実際の Supabase アカウントを使わず、Auth の /user 応答を再現する。
    authServer = createServer((incoming, outgoing) => {
      if (
        incoming.url !== '/auth/v1/user' ||
        incoming.headers.apikey !== 'e2e-publishable-key'
      ) {
        outgoing.writeHead(404).end();
        return;
      }
      if (incoming.headers.authorization === 'Bearer upstream-error') {
        outgoing.writeHead(500).end();
        return;
      }

      const users: Record<string, object> = {
        'Bearer valid-first-user': {
          id: firstUserId,
          email: 'first@example.test',
          email_confirmed_at: '2026-09-28T00:00:00Z',
          user_metadata: { full_name: 'First User' },
        },
        'Bearer valid-second-user': {
          id: secondUserId,
          email: 'second@example.test',
          email_confirmed_at: '2026-09-28T00:00:00Z',
          user_metadata: {},
        },
        'Bearer unconfirmed-user': {
          id: firstUserId,
          email: 'first@example.test',
          email_confirmed_at: null,
        },
      };
      const user = users[incoming.headers.authorization ?? ''];
      if (!user) {
        outgoing.writeHead(401).end();
        return;
      }

      outgoing.writeHead(200, { 'Content-Type': 'application/json' });
      outgoing.end(JSON.stringify(user));
    });

    await new Promise<void>((resolve) =>
      authServer.listen(0, '127.0.0.1', resolve),
    );
    const address = authServer.address() as AddressInfo;
    process.env.SUPABASE_URL = `http://127.0.0.1:${address.port}`;
    process.env.SUPABASE_PUBLISHABLE_KEY = 'e2e-publishable-key';

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app.get(PrismaService).user.deleteMany({
      where: { id: { in: testUserIds } },
    });
  });

  afterAll(async () => {
    await app?.close();
    await new Promise<void>((resolve) => authServer?.close(() => resolve()));
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
    else process.env.SUPABASE_PUBLISHABLE_KEY = previousKey;
  });

  it('token がない場合は 401 を返す', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });

  it('無効な token の場合は 401 を返し、User を作らない', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);

    const count = await app.get(PrismaService).user.count({
      where: { id: { in: testUserIds } },
    });
    expect(count).toBe(0);
  });

  it('メール未確認のユーザーは登録しない', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', 'Bearer unconfirmed-user')
      .expect(403);

    const count = await app.get(PrismaService).user.count({
      where: { id: firstUserId },
    });
    expect(count).toBe(0);
  });

  it('認証サービスの障害時は本人として扱わない', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', 'Bearer upstream-error')
      .expect(503);

    const count = await app.get(PrismaService).user.count({
      where: { id: { in: testUserIds } },
    });
    expect(count).toBe(0);
  });

  it('有効な token の本人を初回作成し、再取得しても重複させない', async () => {
    const firstResponse = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', 'Bearer valid-first-user')
      .expect(200);

    expect(firstResponse.body).toEqual({
      id: firstUserId,
      email: 'first@example.test',
      name: 'First User',
    });

    const secondResponse = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', 'Bearer valid-first-user')
      .expect(200);
    expect(secondResponse.body).toEqual(firstResponse.body);

    const count = await app.get(PrismaService).user.count({
      where: { id: firstUserId },
    });
    expect(count).toBe(1);
  });

  it('別の token では別の本人を返し、表示名がない場合は email を使う', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', 'Bearer valid-second-user')
      .expect(200);

    expect(response.body).toEqual({
      id: secondUserId,
      email: 'second@example.test',
      name: 'second@example.test',
    });
  });
});

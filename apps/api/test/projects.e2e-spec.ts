import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/modules/prisma/prisma.service.js';

// describe は、同じ機能に関するテストをひとまとまりにする。
describe('Projects endpoint', () => {
  let app: INestApplication;
  let appCreated = false;
  let projectKey: string;
  let projectKeys: string[];
  let adminClient: SupabaseClient;
  // テスト用の Project の ownerId と Authorization ヘッダーで使う。
  let userId: string;
  let accessToken: string;

  // beforeEach は各テストの前に実行され、新しいNestJSアプリを用意する。
  beforeEach(async () => {
    // 準備中に失敗しても、前のテストのユーザーを削除しないよう初期化する。
    appCreated = false;
    projectKeys = [];
    userId = '';
    accessToken = '';

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    appCreated = true;
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    // テストごとに一意なkeyを作り、既存データとの重複を避ける。
    projectKey = `E2E${crypto.randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`;
    projectKeys = [projectKey];

    const supabaseUrl = process.env.SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SECRET_KEY;
    const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !secretKey || !publishableKey) {
      throw new Error(
        'テスト用の Supabase URL、Secret key、Publishable key が必要です。',
      );
    }

    // 管理 API でユーザーを作成・削除するため、ローカルの Supabase に限定する。
    const url = new URL(supabaseUrl);
    if (
      url.protocol !== 'http:' ||
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    ) {
      throw new Error(
        'Projects E2E はローカルの Supabase で実行してください。',
      );
    }

    // Secret key はユーザー管理に、Publishable key はログインに使う。
    adminClient = createClient(supabaseUrl, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
    const loginClient = createClient(supabaseUrl, publishableKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

    // テストごとに確認済みの一時ユーザーを作る。
    const email = `projects-e2e-${randomUUID()}@example.test`;
    const password = `E2e!${randomBytes(24).toString('hex')}`;
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    // 後続処理が失敗しても afterEach で削除できるよう、先に ID を記録する。
    userId = data.user?.id ?? '';
    if (error) {
      throw error;
    }
    expect(userId).toBeTruthy();
    expect(data.user?.email_confirmed_at).toBeTruthy();

    const { data: signInData, error: signInError } =
      await loginClient.auth.signInWithPassword({ email, password });
    if (signInError) {
      throw signInError;
    }
    expect(signInData.user?.id).toBe(userId);

    // 各テストから使えるよう、ログイン後の access token を保持する。
    accessToken = signInData.session?.access_token ?? '';
    expect(accessToken).toBeTruthy();

    // 本物の token を検証し、E2E 専用 DB にアプリ側の User を作成する。
    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(response.body).toMatchObject({ id: userId, email });
  });

  // afterEach は各テストの後に実行され、テスト用データとアプリを片付ける。
  afterEach(async () => {
    if (!appCreated) {
      return;
    }

    const prisma = app.get(PrismaService);
    try {
      // Project を参照する参加情報を先に削除し、外部キー制約に抵触しないようにする。
      await prisma.projectMember.deleteMany({
        where: { project: { key: { in: projectKeys } } },
      });
      await prisma.project.deleteMany({
        where: { key: { in: projectKeys } },
      });
    } finally {
      try {
        if (userId) {
          try {
            // User 作成前に準備が失敗していた場合も、deleteMany なら実行できる。
            await prisma.user.deleteMany({ where: { id: userId } });
          } finally {
            // アプリ側の削除が失敗した場合も、Supabase 側の削除を試みる。
            const { error } = await adminClient.auth.admin.deleteUser(userId);
            expect(error, 'テストユーザーの削除に失敗しました。').toBeNull();
          }
        }
      } finally {
        await app.close();
      }
    }
  });

  describe('一覧取得: GET /api/projects', () => {
    it.each([
      ['token なし', undefined],
      ['無効な token', 'invalid-token'],
    ])('一覧取得時に%sを401で拒否する', async (_caseName, token) => {
      // データが存在していても、認証できなければ一覧を返さない。
      await app.get(PrismaService).project.create({
        data: { ownerId: userId, name: 'Project List', key: projectKey },
      });

      const listRequest = request(app.getHttpServer()).get('/api/projects');
      if (token) {
        listRequest.set('Authorization', `Bearer ${token}`);
      }

      await listRequest.expect(401);
    });

    it('プロジェクトを取得する', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(response.body).toEqual(expect.any(Array));
    });

    it('アーカイブ済みのプロジェクトも取得する', async () => {
      const archivedProjectKey = projectKey.replace('E2E', 'ARC');
      projectKeys.push(archivedProjectKey);

      // アーカイブ済みプロジェクトも一覧に含まれることを確認する。
      await app.get(PrismaService).project.create({
        data: {
          ownerId: userId,
          name: 'Archived Project',
          key: archivedProjectKey,
          isArchived: true,
        },
      });

      const response = await request(app.getHttpServer())
        .get('/api/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: archivedProjectKey,
            isArchived: true,
          }),
        ]),
      );
    });

    it('プロジェクト一覧を作成日時の新しい順に取得する', async () => {
      const olderProjectKey = projectKey.replace('E2E', 'OLD');
      const newerProjectKey = projectKey.replace('E2E', 'NEW');
      projectKeys.push(olderProjectKey, newerProjectKey);

      // createdAt を固定し、実行速度に左右されず並び順を確認できるようにする。
      await app.get(PrismaService).project.create({
        data: {
          ownerId: userId,
          name: 'Older Project',
          key: olderProjectKey,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      });
      await app.get(PrismaService).project.create({
        data: {
          ownerId: userId,
          name: 'Newer Project',
          key: newerProjectKey,
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
        },
      });

      const response = await request(app.getHttpServer())
        .get('/api/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      const projectKeysInResponse = response.body.map(
        (project: { key: string }) => project.key,
      );

      expect(projectKeysInResponse).toEqual(
        expect.arrayContaining([olderProjectKey, newerProjectKey]),
      );
      expect(projectKeysInResponse.indexOf(newerProjectKey)).toBeLessThan(
        projectKeysInResponse.indexOf(olderProjectKey),
      );
    });
  });

  describe('詳細取得: GET /api/projects/:projectId', () => {
    it.each([
      ['token なし', undefined],
      ['無効な token', 'invalid-token'],
    ])('詳細取得時に%sを401で拒否する', async (_caseName, token) => {
      const project = await app.get(PrismaService).project.create({
        data: { ownerId: userId, name: 'Project Detail', key: projectKey },
      });

      // 存在する ID を指定し、404 ではなく認証エラーになることを確認する。
      const detailRequest = request(app.getHttpServer()).get(
        `/api/projects/${project.id}`,
      );
      if (token) {
        detailRequest.set('Authorization', `Bearer ${token}`);
      }

      await detailRequest.expect(401);
    });

    it('IDを指定してプロジェクトを取得する', async () => {
      const project = await app.get(PrismaService).project.create({
        data: {
          ownerId: userId,
          name: 'Project Detail',
          key: projectKey,
          description: '詳細取得用のテストデータ',
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/api/projects/${project.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: project.id,
        name: 'Project Detail',
        key: projectKey,
        description: '詳細取得用のテストデータ',
        isArchived: false,
      });
    });

    it('存在しないIDを指定すると404を返す', async () => {
      await request(app.getHttpServer())
        .get('/api/projects/not-found')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404)
        .expect({
          message: 'プロジェクトが見つかりません',
          error: 'Not Found',
          statusCode: 404,
        });
    });
  });

  describe('作成: POST /api/projects', () => {
    it.each([
      ['token なし', undefined],
      ['無効な token', 'invalid-token'],
    ])('作成時に%sを401で拒否し、DBに保存しない', async (_caseName, token) => {
      const createRequest = request(app.getHttpServer()).post('/api/projects');
      if (token) {
        createRequest.set('Authorization', `Bearer ${token}`);
      }

      // 本文は正しい値にし、入力エラーではなく認証エラーで拒否されることを確認する。
      await createRequest
        .send({ name: 'Unauthorized Project', key: projectKey })
        .expect(401);

      const prisma = app.get(PrismaService);
      expect(
        await prisma.project.findUnique({ where: { key: projectKey } }),
      ).toBeNull();
      // このテストのユーザーに、参加情報だけが作られていないことも確認する。
      expect(await prisma.projectMember.count({ where: { userId } })).toBe(0);
    });

    it('プロジェクトを作成し、keyを大文字で保存して作成者をownerに登録する', async () => {
      // request は実際のHTTPリクエストと同じ形でAPIを呼び出す。
      const response = await request(app.getHttpServer())
        .post('/api/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Test Project',
          key: projectKey.toLowerCase(),
          description: 'Test Description',
        })
        .expect(201);

      // DBが作るidや日時は毎回変わるため、固定値ではなく型と必要な値を確認する。
      expect(response.body).toMatchObject({
        id: expect.any(String),
        ownerId: userId,
        name: 'Test Project',
        key: projectKey,
        description: 'Test Description',
        isArchived: false,
      });

      // レスポンスだけでなく、Project と owner の参加情報が DB に保存されたことを確認する。
      const savedProject = await app.get(PrismaService).project.findUnique({
        where: { id: response.body.id },
        include: { members: true },
      });
      expect(savedProject).toMatchObject({
        ownerId: userId,
        members: [
          {
            projectId: response.body.id,
            userId,
            role: 'owner',
          },
        ],
      });
    });

    it('作成時にプロジェクト名の前後空白を除いて保存する', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: '  正規化された名前  ', key: projectKey })
        .expect(201);

      expect(response.body.name).toBe('正規化された名前');
    });

    it.each([
      ['空白だけの名前', '   '],
      ['trim後に100文字を超える名前', ` ${'a'.repeat(101)} `],
    ])('作成時に%sを400で拒否する', async (_caseName, name) => {
      await request(app.getHttpServer())
        .post('/api/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name, key: projectKey })
        .expect(400);
    });

    it('リクエスト本文が不正な場合は400を返す', async () => {
      await request(app.getHttpServer())
        .post('/api/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: '', key: 'INVALID-KEY' })
        .expect(400);
    });

    it('プロジェクトkeyがすでに使われている場合は409を返す', async () => {
      const project = {
        name: 'Duplicate Key Project',
        key: projectKey,
      };

      await request(app.getHttpServer())
        .post('/api/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(project)
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(project)
        .expect(409)
        .expect({
          message: 'プロジェクトキーは既に使用されています',
          error: 'Conflict',
          statusCode: 409,
        });
    });
  });

  describe('更新: PATCH /api/projects/:projectId', () => {
    it.each([
      ['token なし', undefined],
      ['無効な token', 'invalid-token'],
    ])('更新時に%sを401で拒否し、DBを変更しない', async (_caseName, token) => {
      const prisma = app.get(PrismaService);
      const project = await prisma.project.create({
        data: {
          ownerId: userId,
          name: 'Before Update',
          key: projectKey,
          description: '更新前の説明',
        },
      });

      const updateRequest = request(app.getHttpServer()).patch(
        `/api/projects/${project.id}`,
      );
      if (token) {
        updateRequest.set('Authorization', `Bearer ${token}`);
      }

      // 正しい更新内容でも、認証できなければ保存されない。
      await updateRequest
        .send({ name: 'After Update', description: '更新後の説明' })
        .expect(401);

      expect(
        await prisma.project.findUnique({ where: { id: project.id } }),
      ).toEqual(project);
    });

    it('プロジェクト名と説明を更新できる', async () => {
      const project = await app.get(PrismaService).project.create({
        data: {
          ownerId: userId,
          name: 'Before Update',
          key: projectKey,
          description: '更新前の説明',
        },
      });

      const response = await request(app.getHttpServer())
        .patch(`/api/projects/${project.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'After Update',
          description: '更新後の説明',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        id: project.id,
        name: 'After Update',
        key: projectKey,
        description: '更新後の説明',
        isArchived: false,
      });
    });

    it('更新時にプロジェクト名をtrimして保存し、trim後の制約を検証する', async () => {
      const project = await app.get(PrismaService).project.create({
        data: { ownerId: userId, name: '更新前', key: projectKey },
      });

      const response = await request(app.getHttpServer())
        .patch(`/api/projects/${project.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: '  更新後  ' })
        .expect(200);

      expect(response.body.name).toBe('更新後');

      await request(app.getHttpServer())
        .patch(`/api/projects/${project.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: '   ' })
        .expect(400);

      await request(app.getHttpServer())
        .patch(`/api/projects/${project.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: ` ${'a'.repeat(101)} ` })
        .expect(400);
    });

    it('descriptionをnullにして説明を削除できる', async () => {
      const project = await app.get(PrismaService).project.create({
        data: {
          ownerId: userId,
          name: 'Project With Description',
          key: projectKey,
          description: '削除する説明',
        },
      });

      const response = await request(app.getHttpServer())
        .patch(`/api/projects/${project.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ description: null })
        .expect(200);

      expect(response.body).toMatchObject({
        id: project.id,
        name: 'Project With Description',
        description: null,
      });
    });

    it('空文字のdescriptionはnullとして保存する', async () => {
      const project = await app.get(PrismaService).project.create({
        data: {
          ownerId: userId,
          name: 'Project With Description',
          key: projectKey,
          description: '削除する説明',
        },
      });

      const response = await request(app.getHttpServer())
        .patch(`/api/projects/${project.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ description: '' })
        .expect(200);

      expect(response.body.description).toBeNull();
    });

    it('更新する項目がない場合は400を返す', async () => {
      const project = await app.get(PrismaService).project.create({
        data: {
          ownerId: userId,
          name: 'Project For Empty Update',
          key: projectKey,
        },
      });

      await request(app.getHttpServer())
        .patch(`/api/projects/${project.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400)
        .expect({
          message: '更新する項目を指定してください',
          error: 'Bad Request',
          statusCode: 400,
        });
    });

    it('存在しないIDを更新しようとすると404を返す', async () => {
      await request(app.getHttpServer())
        .patch('/api/projects/not-found')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated Project' })
        .expect(404)
        .expect({
          message: 'プロジェクトが見つかりません',
          error: 'Not Found',
          statusCode: 404,
        });
    });
  });

  describe('アーカイブ: POST /api/projects/:projectId/archive', () => {
    it.each([
      ['token なし', undefined],
      ['無効な token', 'invalid-token'],
    ])(
      'アーカイブ時に%sを401で拒否し、DBを変更しない',
      async (_caseName, token) => {
        const prisma = app.get(PrismaService);
        const project = await prisma.project.create({
          data: {
            ownerId: userId,
            name: 'Project To Archive',
            key: projectKey,
            isArchived: false,
          },
        });

        const archiveRequest = request(app.getHttpServer()).post(
          `/api/projects/${project.id}/archive`,
        );
        if (token) {
          archiveRequest.set('Authorization', `Bearer ${token}`);
        }

        await archiveRequest.expect(401);

        // 拒否された場合は、アーカイブ状態や更新日時も変わらない。
        expect(
          await prisma.project.findUnique({ where: { id: project.id } }),
        ).toEqual(project);
      },
    );

    it('プロジェクトをアーカイブできる', async () => {
      const project = await app.get(PrismaService).project.create({
        data: {
          ownerId: userId,
          name: 'Project To Archive',
          key: projectKey,
          isArchived: false,
        },
      });

      const response = await request(app.getHttpServer())
        .post(`/api/projects/${project.id}/archive`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: project.id,
        name: 'Project To Archive',
        key: projectKey,
        isArchived: true,
      });

      const archivedProject = await app
        .get(PrismaService)
        .project.findUnique({ where: { id: project.id } });
      expect(archivedProject?.isArchived).toBe(true);
    });

    it('存在しないIDをアーカイブしようとすると404を返す', async () => {
      await request(app.getHttpServer())
        .post('/api/projects/not-found/archive')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404)
        .expect({
          message: 'プロジェクトが見つかりません',
          error: 'Not Found',
          statusCode: 404,
        });
    });

    it('アーカイブ済みのプロジェクトを再度アーカイブしても成功する', async () => {
      const project = await app.get(PrismaService).project.create({
        data: {
          ownerId: userId,
          name: 'Already Archived Project',
          key: projectKey,
          isArchived: true,
        },
      });

      const response = await request(app.getHttpServer())
        .post(`/api/projects/${project.id}/archive`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: project.id,
        isArchived: true,
      });
    });
  });

  describe('アーカイブ解除: POST /api/projects/:projectId/unarchive', () => {
    it.each([
      ['token なし', undefined],
      ['無効な token', 'invalid-token'],
    ])(
      'アーカイブ解除時に%sを401で拒否し、DBを変更しない',
      async (_caseName, token) => {
        const prisma = app.get(PrismaService);
        const project = await prisma.project.create({
          data: {
            ownerId: userId,
            name: 'Project To Unarchive',
            key: projectKey,
            isArchived: true,
          },
        });

        const unarchiveRequest = request(app.getHttpServer()).post(
          `/api/projects/${project.id}/unarchive`,
        );
        if (token) {
          unarchiveRequest.set('Authorization', `Bearer ${token}`);
        }

        await unarchiveRequest.expect(401);

        expect(
          await prisma.project.findUnique({ where: { id: project.id } }),
        ).toEqual(project);
      },
    );

    it('アーカイブ済みのプロジェクトを解除できる', async () => {
      const project = await app.get(PrismaService).project.create({
        data: {
          ownerId: userId,
          name: 'Project To Unarchive',
          key: projectKey,
          isArchived: true,
        },
      });

      const response = await request(app.getHttpServer())
        .post(`/api/projects/${project.id}/unarchive`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: project.id,
        name: 'Project To Unarchive',
        key: projectKey,
        isArchived: false,
      });

      const unarchivedProject = await app
        .get(PrismaService)
        .project.findUnique({ where: { id: project.id } });
      expect(unarchivedProject?.isArchived).toBe(false);
    });

    it('存在しないIDのアーカイブを解除しようとすると404を返す', async () => {
      await request(app.getHttpServer())
        .post('/api/projects/not-found/unarchive')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404)
        .expect({
          message: 'プロジェクトが見つかりません',
          error: 'Not Found',
          statusCode: 404,
        });
    });
  });
});

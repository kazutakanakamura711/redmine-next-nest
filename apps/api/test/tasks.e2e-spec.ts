import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import type {
  Prisma,
  ProjectMemberRole,
} from '../src/generated/prisma/client.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { PrismaService } from '../src/modules/prisma/prisma.service.js';

describe('Task一覧: GET /api/projects/:projectId/tasks', () => {
  let app: INestApplication;
  let appCreated = false;
  let prisma: PrismaService;
  let adminClient: SupabaseClient;
  let projectIds: string[];
  let userIds: string[];
  let userId: string;
  let accessToken: string;

  const projectNotFound = {
    message: 'プロジェクトが見つかりません',
    error: 'Not Found',
    statusCode: 404,
  };

  beforeEach(async () => {
    // 準備途中の失敗でも、今回作成したデータだけを後片付けする。
    appCreated = false;
    projectIds = [];
    userIds = [];
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
    prisma = app.get(PrismaService);
    await app.init();

    const supabaseUrl = process.env.SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SECRET_KEY;
    const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !secretKey || !publishableKey) {
      throw new Error(
        'テスト用の Supabase URL、Secret key、Publishable key が必要です。',
      );
    }

    // CIとローカルの専用Supabaseを使い、外部サービスへテストユーザーを作らない。
    const url = new URL(supabaseUrl);
    if (
      url.protocol !== 'http:' ||
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    ) {
      throw new Error('Tasks E2E はローカルの Supabase で実行してください。');
    }

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

    const user = await createAuthUser();
    userId = user.id;
    const { data, error } = await loginClient.auth.signInWithPassword({
      email: user.email,
      password: user.password,
    });
    if (error) throw error;
    expect(data.user?.id).toBe(userId);
    accessToken = data.session?.access_token ?? '';
    expect(accessToken).toBeTruthy();

    // 本物のtokenを検証し、アプリ側のUserも既存の認証処理から作る。
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (!appCreated) return;

    try {
      // Taskを先に削除し、Projectへの外部キー制約に抵触しないようにする。
      await prisma.$transaction([
        prisma.task.deleteMany({ where: { projectId: { in: projectIds } } }),
        prisma.projectMember.deleteMany({
          where: { projectId: { in: projectIds } },
        }),
        prisma.project.deleteMany({ where: { id: { in: projectIds } } }),
        prisma.user.deleteMany({ where: { id: { in: userIds } } }),
      ]);
    } finally {
      try {
        // DBの後片付けが失敗した場合も、今回のAuthユーザーの削除を試みる。
        const results = await Promise.allSettled(
          userIds.map((id) => adminClient.auth.admin.deleteUser(id)),
        );
        for (const result of results) {
          expect(result, 'テストユーザーの削除に失敗しました。').toMatchObject({
            status: 'fulfilled',
            value: { error: null },
          });
        }
      } finally {
        await app.close();
      }
    }
  });

  // 以下はこのspec専用のfixture。Task作成APIは使わず、Prismaで準備する。
  async function createAuthUser() {
    const email = `tasks-e2e-${randomUUID()}@example.test`;
    const password = `E2e!${randomBytes(24).toString('hex')}`;
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (data.user) userIds.push(data.user.id);
    if (error) throw error;
    if (!data.user) throw new Error('テストユーザーを作成できませんでした。');

    return { id: data.user.id, email, password };
  }

  async function createOtherUser() {
    const user = await createAuthUser();
    return prisma.user.create({ data: { id: user.id, email: user.email } });
  }

  async function createProject(ownerId = userId, isArchived = false) {
    const project = await prisma.project.create({
      data: {
        ownerId,
        name: 'Task List Project',
        key: `TLE${randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`,
        isArchived,
        projectMembers: { create: { userId: ownerId, role: 'owner' } },
      },
    });
    projectIds.push(project.id);
    return project;
  }

  async function createProjectForRole(
    role: ProjectMemberRole,
    isArchived = false,
  ) {
    const ownerId = role === 'owner' ? userId : (await createOtherUser()).id;
    const project = await createProject(ownerId, isArchived);
    if (role !== 'owner') {
      await prisma.projectMember.create({
        data: { projectId: project.id, userId, role },
      });
    }
    return project;
  }

  async function createTask(
    projectId: string,
    data: Omit<Prisma.TaskUncheckedCreateInput, 'projectId'> = {
      title: 'Fixture Task',
    },
  ) {
    return prisma.task.create({ data: { ...data, projectId } });
  }

  // 認証時のUser同期とは別に、取得対象の値・更新日時の不変性を確認する。
  function readProjectState() {
    return prisma.project.findMany({
      where: { id: { in: projectIds } },
      orderBy: { id: 'asc' },
      include: {
        projectMembers: { orderBy: { id: 'asc' } },
        tasks: { orderBy: { id: 'asc' } },
      },
    });
  }

  it.each([
    ['tokenなし', undefined],
    ['Bearer形式ではないヘッダー', 'Basic'],
    ['無効なtoken', 'Bearer invalid-token'],
  ])(
    '%sは401で拒否し、Project・参加情報・Taskを変更しない',
    async (_caseName, authorization) => {
      const project = await createProject();
      await createTask(project.id);
      const before = await readProjectState();

      const listRequest = request(app.getHttpServer()).get(
        `/api/projects/${project.id}/tasks`,
      );
      if (authorization) {
        listRequest.set(
          'Authorization',
          authorization === 'Basic' ? `Basic ${accessToken}` : authorization,
        );
      }
      await listRequest.expect(401);

      expect(await readProjectState()).toEqual(before);
    },
  );

  it.each([
    ['メール未設定', { email: undefined }],
    ['メール未確認', { email_confirmed_at: undefined }],
  ])(
    'token検証後に%sなら403で拒否し、UserとProject内のデータを変更しない',
    async (_caseName, emailState) => {
      const project = await createProject();
      await createTask(project.id);
      const before = await readProjectState();
      const userBefore = await prisma.user.findUnique({
        where: { id: userId },
      });
      const authService = app.get(AuthService);
      const verifiedUser = await authService.verifyAccessToken(accessToken);

      // 通常の認証ケースは実Supabaseを使う。この2件だけ検証結果のメール状態を変え、
      // ログイン時に拒否される状態でも、API側のメール確認を検証する。
      vi.spyOn(authService, 'verifyAccessToken').mockResolvedValueOnce({
        ...verifiedUser,
        ...emailState,
      });

      await request(app.getHttpServer())
        .get(`/api/projects/${project.id}/tasks`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403)
        .expect({
          message: '確認済みのメールアドレスが必要です。',
          error: 'Forbidden',
          statusCode: 403,
        });

      expect(await readProjectState()).toEqual(before);
      expect(await prisma.user.findUnique({ where: { id: userId } })).toEqual(
        userBefore,
      );
    },
  );

  it.each([
    { role: 'owner', isArchived: false },
    { role: 'member', isArchived: false },
    { role: 'viewer', isArchived: false },
    { role: 'owner', isArchived: true },
    { role: 'member', isArchived: true },
    { role: 'viewer', isArchived: true },
  ] as const)(
    '$roleはisArchived=$isArchivedでも合意した項目だけでTask一覧を取得できる',
    async ({ role, isArchived }) => {
      const project = await createProjectForRole(role, isArchived);
      const task = await createTask(project.id, {
        title: 'ログイン画面を作る',
        description: 'メールアドレスとパスワードでログインする',
        status: 'in_progress',
        priority: 'high',
        startDate: new Date('2026-10-26T00:00:00.000Z'),
        dueDate: new Date('2026-10-30T00:00:00.000Z'),
        createdAt: new Date('2026-10-25T15:00:00.123Z'),
        updatedAt: new Date('2026-10-26T09:00:00.456Z'),
      });
      const before = await readProjectState();

      const response = await request(app.getHttpServer())
        .get(`/api/projects/${project.id}/tasks`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toEqual([
        {
          id: task.id,
          projectId: project.id,
          title: 'ログイン画面を作る',
          description: 'メールアドレスとパスワードでログインする',
          status: 'in_progress',
          priority: 'high',
          startDate: '2026-10-26',
          dueDate: '2026-10-30',
          createdAt: '2026-10-25T15:00:00.123Z',
          updatedAt: '2026-10-26T09:00:00.456Z',
        },
      ]);
      expect(await readProjectState()).toEqual(before);
    },
  );

  it.each(['owner', 'member', 'viewer'] as const)(
    '%sの参加ProjectにTaskがなければ200と空配列を返す',
    async (role) => {
      const project = await createProjectForRole(role);
      const before = await readProjectState();

      await request(app.getHttpServer())
        .get(`/api/projects/${project.id}/tasks`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect([]);

      expect(await readProjectState()).toEqual(before);
    },
  );

  it('未設定のdescription・日付はnull、status・priorityの初期値はtodo・normalで返す', async () => {
    const project = await createProject();
    const task = await createTask(project.id);
    const before = await readProjectState();

    const response = await request(app.getHttpServer())
      .get(`/api/projects/${project.id}/tasks`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toEqual([
      {
        id: task.id,
        projectId: project.id,
        title: 'Fixture Task',
        description: null,
        status: 'todo',
        priority: 'normal',
        startDate: null,
        dueDate: null,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      },
    ]);
    expect(await readProjectState()).toEqual(before);
  });

  it.each([
    { startDate: '2028-02-29', dueDate: null },
    { startDate: null, dueDate: '2027-01-01' },
    { startDate: '2026-12-31', dueDate: '2026-12-31' },
  ])(
    '日付だけの値を維持し、startDate=$startDate・dueDate=$dueDateで返す',
    async ({ startDate, dueDate }) => {
      const project = await createProject();
      await createTask(project.id, {
        title: 'Date Task',
        startDate: startDate ? new Date(`${startDate}T00:00:00.000Z`) : null,
        dueDate: dueDate ? new Date(`${dueDate}T00:00:00.000Z`) : null,
      });
      const before = await readProjectState();

      const response = await request(app.getHttpServer())
        .get(`/api/projects/${project.id}/tasks`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({ startDate, dueDate });
      expect(await readProjectState()).toEqual(before);
    },
  );

  it('作成日時の降順、同じ日時ならIDの降順で返す', async () => {
    const project = await createProject();
    const idPrefix = `task-sort-${randomUUID()}`;
    const sameDateA = await createTask(project.id, {
      id: `${idPrefix}-a`,
      title: 'Same Date A',
      status: 'done',
      priority: 'high',
      createdAt: new Date('2026-10-26T00:00:00.000Z'),
    });
    const newest = await createTask(project.id, {
      title: 'Newest',
      priority: 'low',
      createdAt: new Date('2026-10-27T00:00:00.000Z'),
    });
    const oldest = await createTask(project.id, {
      title: 'Oldest',
      createdAt: new Date('2026-10-25T00:00:00.000Z'),
    });
    const sameDateZ = await createTask(project.id, {
      id: `${idPrefix}-z`,
      title: 'Same Date Z',
      status: 'in_progress',
      createdAt: new Date('2026-10-26T00:00:00.000Z'),
    });
    const before = await readProjectState();

    const response = await request(app.getHttpServer())
      .get(`/api/projects/${project.id}/tasks`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.map((task: { id: string }) => task.id)).toEqual([
      newest.id,
      sameDateZ.id,
      sameDateA.id,
      oldest.id,
    ]);
    expect(await readProjectState()).toEqual(before);
  });

  it('両Projectのownerでも、URLで指定したProjectのTaskだけを返す', async () => {
    const firstProject = await createProject();
    const secondProject = await createProject();
    const firstTask = await createTask(firstProject.id);
    const secondTask = await createTask(secondProject.id);
    const before = await readProjectState();

    for (const [project, task] of [
      [firstProject, firstTask],
      [secondProject, secondTask],
    ] as const) {
      const response = await request(app.getHttpServer())
        .get(`/api/projects/${project.id}/tasks`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        id: task.id,
        projectId: project.id,
      });
    }
    expect(await readProjectState()).toEqual(before);
  });

  it.each([false, true])(
    '非参加ProjectはisArchived=%sでも存在しないIDと同じ404で拒否する',
    async (isArchived) => {
      const joinedProject = await createProject();
      await createTask(joinedProject.id);
      const otherUser = await createOtherUser();
      const otherProject = await createProject(otherUser.id, isArchived);
      await createTask(otherProject.id);
      const before = await readProjectState();

      for (const projectId of [otherProject.id, 'not-found']) {
        await request(app.getHttpServer())
          .get(`/api/projects/${projectId}/tasks`)
          // queryにownerのIDを送っても、tokenの本人として認可する。
          .query({ userId: otherUser.id })
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(404)
          .expect(projectNotFound);
      }
      expect(await readProjectState()).toEqual(before);
    },
  );

  it.each([false, true])(
    'ownerIdが本人でも、参加情報がなければisArchived=%sでも404で拒否する',
    async (isArchived) => {
      const project = await createProject(userId, isArchived);
      await createTask(project.id);
      await prisma.projectMember.deleteMany({
        where: { projectId: project.id, userId },
      });
      const before = await readProjectState();

      await request(app.getHttpServer())
        .get(`/api/projects/${project.id}/tasks`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404)
        .expect(projectNotFound);

      expect(await readProjectState()).toEqual(before);
    },
  );

  it('一度取得できても、参加情報が削除された後は同じtokenで404になる', async () => {
    const project = await createProjectForRole('viewer');
    await createTask(project.id);

    await request(app.getHttpServer())
      .get(`/api/projects/${project.id}/tasks`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    await prisma.projectMember.deleteMany({
      where: { projectId: project.id, userId },
    });
    const before = await readProjectState();

    await request(app.getHttpServer())
      .get(`/api/projects/${project.id}/tasks`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404)
      .expect(projectNotFound);

    expect(await readProjectState()).toEqual(before);
  });
});

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/modules/prisma/prisma.service.js';

// describe は、同じ機能に関するテストをひとまとまりにする。
describe('Projects endpoint', () => {
  let app: INestApplication;
  let projectKey: string;
  let projectKeys: string[];

  // beforeEach は各テストの前に実行され、新しいNestJSアプリを用意する。
  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
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
  });

  // afterEach は各テストの後に実行され、テスト用データとアプリを片付ける。
  afterEach(async () => {
    await app.get(PrismaService).project.deleteMany({
      where: { key: { in: projectKeys } },
    });
    await app.close();
  });

  it('プロジェクトを取得する', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/projects')
      .expect(200);
    expect(response.body).toEqual(expect.any(Array));
  });

  it('アーカイブ済みのプロジェクトも取得する', async () => {
    const archivedProjectKey = projectKey.replace('E2E', 'ARC');
    projectKeys.push(archivedProjectKey);

    // アーカイブ済みプロジェクトも一覧に含まれることを確認する。
    await app.get(PrismaService).project.create({
      data: {
        name: 'Archived Project',
        key: archivedProjectKey,
        isArchived: true,
      },
    });

    const response = await request(app.getHttpServer())
      .get('/api/projects')
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
        name: 'Older Project',
        key: olderProjectKey,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    });
    await app.get(PrismaService).project.create({
      data: {
        name: 'Newer Project',
        key: newerProjectKey,
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
      },
    });

    const response = await request(app.getHttpServer())
      .get('/api/projects')
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

  it('IDを指定してプロジェクトを取得する', async () => {
    const project = await app.get(PrismaService).project.create({
      data: {
        name: 'Project Detail',
        key: projectKey,
        description: '詳細取得用のテストデータ',
      },
    });

    const response = await request(app.getHttpServer())
      .get(`/api/projects/${project.id}`)
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
      .expect(404)
      .expect({
        message: 'プロジェクトが見つかりません',
        error: 'Not Found',
        statusCode: 404,
      });
  });

  it('プロジェクトを作成し、keyを大文字で保存する', async () => {
    // request は実際のHTTPリクエストと同じ形でAPIを呼び出す。
    const response = await request(app.getHttpServer())
      .post('/api/projects')
      .send({
        name: 'Test Project',
        key: projectKey.toLowerCase(),
        description: 'Test Description',
      })
      .expect(201);

    // DBが作るidや日時は毎回変わるため、固定値ではなく型と必要な値を確認する。
    expect(response.body).toMatchObject({
      id: expect.any(String),
      name: 'Test Project',
      key: projectKey,
      description: 'Test Description',
      isArchived: false,
    });
  });

  it('リクエスト本文が不正な場合は400を返す', async () => {
    await request(app.getHttpServer())
      .post('/api/projects')
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
      .send(project)
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/projects')
      .send(project)
      .expect(409)
      .expect({
        message: 'プロジェクトキーは既に使用されています',
        error: 'Conflict',
        statusCode: 409,
      });
  });

  it('プロジェクト名と説明を更新できる', async () => {
    const project = await app.get(PrismaService).project.create({
      data: {
        name: 'Before Update',
        key: projectKey,
        description: '更新前の説明',
      },
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/projects/${project.id}`)
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

  it('descriptionをnullにして説明を削除できる', async () => {
    const project = await app.get(PrismaService).project.create({
      data: {
        name: 'Project With Description',
        key: projectKey,
        description: '削除する説明',
      },
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/projects/${project.id}`)
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
        name: 'Project With Description',
        key: projectKey,
        description: '削除する説明',
      },
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/projects/${project.id}`)
      .send({ description: '' })
      .expect(200);

    expect(response.body.description).toBeNull();
  });

  it('更新する項目がない場合は400を返す', async () => {
    const project = await app.get(PrismaService).project.create({
      data: {
        name: 'Project For Empty Update',
        key: projectKey,
      },
    });

    await request(app.getHttpServer())
      .patch(`/api/projects/${project.id}`)
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
      .send({ name: 'Updated Project' })
      .expect(404)
      .expect({
        message: 'プロジェクトが見つかりません',
        error: 'Not Found',
        statusCode: 404,
      });
  });

  it('プロジェクトをアーカイブできる', async () => {
    const project = await app.get(PrismaService).project.create({
      data: {
        name: 'Project To Archive',
        key: projectKey,
        isArchived: false,
      },
    });

    const response = await request(app.getHttpServer())
      .delete(`/api/projects/${project.id}`)
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
      .delete('/api/projects/not-found')
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
        name: 'Already Archived Project',
        key: projectKey,
        isArchived: true,
      },
    });

    const response = await request(app.getHttpServer())
      .delete(`/api/projects/${project.id}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: project.id,
      isArchived: true,
    });
  });
});

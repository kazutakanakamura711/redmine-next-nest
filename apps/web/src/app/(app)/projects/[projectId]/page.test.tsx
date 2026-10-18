import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProjectDetail } from '@/app/(app)/projects/_lib/get-project';
import { ProjectRole } from '@/app/(app)/projects/_lib/project-role';
import ProjectDetailPage from './page';

const mocks = vi.hoisted(() => ({
  getProject: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
}));

vi.mock('@/app/(app)/projects/_lib/get-project', () => ({
  getProject: mocks.getProject,
}));

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}));

// ページの表示判断を確認し、フォーム自体の操作は既存の部品テストで扱う。
vi.mock('./_components/project-settings-panel', () => ({
  ProjectSettingsPanel: ({ project }: { project: { name: string } }) => (
    <section aria-label="プロジェクト設定">{project.name}</section>
  ),
}));

const project: ProjectDetail = {
  id: 'project-id',
  key: 'TEST',
  name: 'テストプロジェクト',
  description: null,
  isArchived: false,
  createdAt: '2026-10-18T00:00:00.000Z',
  updatedAt: '2026-10-18T00:00:00.000Z',
  currentUserRole: ProjectRole.Owner,
};

async function renderPage(tab?: string | string[]) {
  return render(
    await ProjectDetailPage({
      params: Promise.resolve({ projectId: project.id }),
      searchParams: Promise.resolve({ tab }),
    }),
  );
}

describe('ProjectDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getProject.mockResolvedValue(project);
  });

  it.each([
    { tab: undefined },
    { tab: 'unknown' },
    { tab: ['setting', 'task'] },
  ])(
    'tab=$tabの場合はタスクを選択し、設定フォームを表示しない',
    async ({ tab }) => {
      await renderPage(tab);

      expect(screen.getByRole('link', { name: 'タスク' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(
        screen.queryByRole('region', { name: 'プロジェクト設定' }),
      ).not.toBeInTheDocument();
      expect(mocks.getProject).toHaveBeenCalledWith(project.id);
    },
  );

  it('ownerが設定URLを直接開くと設定を選択し、設定パネルを表示する', async () => {
    await renderPage('setting');

    expect(screen.getByRole('link', { name: '設定' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      screen.getByRole('region', { name: 'プロジェクト設定' }),
    ).toHaveTextContent(project.name);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it.each([ProjectRole.Member, ProjectRole.Viewer])(
    '%sの詳細画面には設定リンクと設定パネルを表示しない',
    async (currentUserRole) => {
      mocks.getProject.mockResolvedValue({ ...project, currentUserRole });

      await renderPage();

      expect(
        screen.queryByRole('link', { name: '設定' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('region', { name: 'プロジェクト設定' }),
      ).not.toBeInTheDocument();
    },
  );

  it.each([ProjectRole.Member, ProjectRole.Viewer])(
    '%sが設定URLを直接開くとタスクURLへ戻す',
    async (currentUserRole) => {
      mocks.getProject.mockResolvedValue({ ...project, currentUserRole });

      await expect(renderPage('setting')).rejects.toThrow(
        'NEXT_REDIRECT:/projects/project-id',
      );
      expect(mocks.redirect).toHaveBeenCalledWith('/projects/project-id');
    },
  );

  it('Projectが存在しない、または非参加の場合はnotFoundを呼ぶ', async () => {
    mocks.getProject.mockResolvedValue(null);

    await expect(renderPage('setting')).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mocks.notFound).toHaveBeenCalledOnce();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

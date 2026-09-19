import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Project } from '../projects/_lib/get-projects';
import { ProjectsSidebar } from './projects-sidebar';

const project: Project = {
  id: 'project-id',
  key: 'LONGPROJECTKEY1234567',
  name: 'とても長いプロジェクト名',
  description: null,
  isArchived: false,
  createdAt: '2026-09-19T00:00:00.000Z',
  updatedAt: '2026-09-19T00:00:00.000Z',
};

describe('ProjectsSidebar', () => {
  it('長いプロジェクトキーを省略表示できる要素として描画する', () => {
    render(<ProjectsSidebar projects={[project]} />);

    expect(screen.getByTitle(project.key)).toHaveClass('w-10', 'truncate');
    expect(screen.getByText(project.name)).toHaveClass(
      'min-w-0',
      'flex-1',
      'truncate',
    );
  });

  it('アーカイブ済みプロジェクトを補助テキスト付きで表示する', () => {
    render(<ProjectsSidebar projects={[{ ...project, isArchived: true }]} />);

    expect(screen.getByText('アーカイブ済み')).toBeInTheDocument();
  });

  it('空のプロジェクト配列でも壊れず表示できる', () => {
    render(<ProjectsSidebar projects={[]} />);

    expect(
      screen.getByRole('navigation', { name: 'メインナビゲーション' }),
    ).toBeInTheDocument();
  });

  it('アーカイブ済み行が薄く表示される', () => {
    const archivedProject = { ...project, isArchived: true };

    render(<ProjectsSidebar projects={[archivedProject]} />);

    expect(screen.getByText(archivedProject.name).closest('li')).toHaveClass(
      'opacity-50',
    );
  });
});

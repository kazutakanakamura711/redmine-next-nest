import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectRequestError } from '../../_lib/api-error';
import { archiveProject } from '../../_lib/archive-project';
import { ProjectArchive } from './project-archive';

const routerMocks = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

const toastMocks = vi.hoisted(() => ({
  add: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => routerMocks,
}));

vi.mock('../../_lib/archive-project', () => ({
  archiveProject: vi.fn(),
}));

vi.mock('@/components/ui/toast', () => ({
  toast: {
    add: toastMocks.add,
  },
}));

const archiveProjectMock = vi.mocked(archiveProject);

const defaultProps = {
  projectId: 'project-id',
  projectName: 'Task Management App',
  onArchived: vi.fn(),
};

async function openDialog() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'アーカイブ' }));
  return user;
}

describe('ProjectArchive', () => {
  beforeEach(() => {
    archiveProjectMock.mockReset();
    routerMocks.refresh.mockReset();
    toastMocks.add.mockReset();
  });

  it('確認名が一致するまでアーカイブボタンを非活性にする', async () => {
    render(<ProjectArchive {...defaultProps} />);
    const user = await openDialog();
    const archiveButton = screen.getByRole('button', {
      name: 'アーカイブする',
    });

    expect(archiveButton).toBeDisabled();

    await user.type(
      screen.getByLabelText(
        /確認のため.*Task Management App.*と入力してください/,
      ),
      '別のプロジェクト名',
    );

    expect(archiveButton).toBeDisabled();

    await user.clear(
      screen.getByLabelText(
        /確認のため.*Task Management App.*と入力してください/,
      ),
    );
    await user.type(
      screen.getByLabelText(
        /確認のため.*Task Management App.*と入力してください/,
      ),
      'Task Management App',
    );

    expect(archiveButton).toBeEnabled();
    expect(archiveProjectMock).not.toHaveBeenCalled();
  });

  it('確認名が一致した場合はアーカイブして成功トーストを表示する', async () => {
    archiveProjectMock.mockResolvedValue(undefined);
    render(<ProjectArchive {...defaultProps} />);
    const user = await openDialog();

    await user.type(
      screen.getByLabelText(
        /確認のため.*Task Management App.*と入力してください/,
      ),
      'Task Management App',
    );
    await user.click(screen.getByRole('button', { name: 'アーカイブする' }));

    await waitFor(() => {
      expect(archiveProjectMock).toHaveBeenCalledWith('project-id');
    });
    expect(toastMocks.add).toHaveBeenCalledWith({
      type: 'success',
      title: 'プロジェクトをアーカイブしました',
    });
    expect(routerMocks.refresh).toHaveBeenCalledOnce();
  });

  it('APIエラーの場合はダイアログ内にメッセージを表示する', async () => {
    archiveProjectMock.mockRejectedValue(
      new ProjectRequestError('プロジェクトが見つかりません', 404),
    );
    render(<ProjectArchive {...defaultProps} />);
    const user = await openDialog();

    await user.type(
      screen.getByLabelText(
        /確認のため.*Task Management App.*と入力してください/,
      ),
      'Task Management App',
    );
    await user.click(screen.getByRole('button', { name: 'アーカイブする' }));

    expect(
      await screen.findByText('プロジェクトが見つかりません'),
    ).toBeInTheDocument();
    expect(toastMocks.add).not.toHaveBeenCalled();
    expect(routerMocks.refresh).not.toHaveBeenCalled();
  });
});

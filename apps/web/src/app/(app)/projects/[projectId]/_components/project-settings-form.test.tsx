import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  UpdateProjectRequestError,
  updateProject,
} from '../../_lib/update-project';
import { ProjectSettingsForm } from './project-settings-form';

const routerMocks = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

const toastMocks = vi.hoisted(() => ({
  add: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => routerMocks,
}));

// 本物の API 通信を行わず、呼び出し内容だけをテストできるようにする。
vi.mock('../../_lib/update-project', () => {
  // コンポーネントの instanceof 判定を再現するためのテスト用エラークラス。
  class MockUpdateProjectRequestError extends Error {
    constructor(
      message: string,
      public readonly statusCode: number,
    ) {
      super(message);
    }
  }

  return {
    UpdateProjectRequestError: MockUpdateProjectRequestError,
    updateProject: vi.fn(),
  };
});

// トースト表示自体ではなく、toast.add() が呼ばれたかを確認する。
vi.mock('@/components/ui/toast', () => ({
  toast: {
    add: toastMocks.add,
  },
}));

const updateProjectMock = vi.mocked(updateProject);

const defaultProps = {
  projectId: 'project-id',
  initialName: 'テストプロジェクト',
  projectKey: 'TEST',
  initialDescription: 'テスト用の説明',
};

describe('ProjectSettingsForm', () => {
  beforeEach(() => {
    updateProjectMock.mockReset();
    routerMocks.refresh.mockReset();
    toastMocks.add.mockReset();
  });

  it('現在のプロジェクト情報を初期値として表示する', () => {
    render(<ProjectSettingsForm {...defaultProps} />);

    expect(screen.getByLabelText(/^プロジェクト名/)).toHaveValue(
      'テストプロジェクト',
    );
    expect(screen.getByLabelText(/^プロジェクトキー/)).toHaveValue('TEST');
    expect(screen.getByLabelText(/^プロジェクトキー/)).toHaveAttribute(
      'readonly',
    );
    expect(screen.getByLabelText('説明')).toHaveValue('テスト用の説明');
  });

  it('プロジェクト名が空の場合はエラーを表示し、更新しない', async () => {
    const user = userEvent.setup();
    render(<ProjectSettingsForm {...defaultProps} />);

    await user.clear(screen.getByLabelText(/^プロジェクト名/));
    await user.click(screen.getByRole('button', { name: '設定を保存' }));

    expect(
      await screen.findByText('プロジェクト名は必須です'),
    ).toBeInTheDocument();
    expect(updateProjectMock).not.toHaveBeenCalled();
  });

  it('入力内容を更新し、成功トーストを表示して画面を再取得する', async () => {
    const user = userEvent.setup();
    updateProjectMock.mockResolvedValue(undefined);
    render(<ProjectSettingsForm {...defaultProps} />);

    await user.clear(screen.getByLabelText(/^プロジェクト名/));
    await user.type(
      screen.getByLabelText(/^プロジェクト名/),
      '更新後のプロジェクト名',
    );
    await user.clear(screen.getByLabelText('説明'));
    await user.type(screen.getByLabelText('説明'), '更新後の説明');
    await user.click(screen.getByRole('button', { name: '設定を保存' }));

    await waitFor(() => {
      expect(updateProjectMock).toHaveBeenCalledWith('project-id', {
        name: '更新後のプロジェクト名',
        description: '更新後の説明',
      });
    });
    expect(toastMocks.add).toHaveBeenCalledWith({
      type: 'success',
      title: 'プロジェクト設定を保存しました',
    });
    expect(routerMocks.refresh).toHaveBeenCalledOnce();
  });

  it('通信に失敗した場合は日本語のエラーを表示する', async () => {
    const user = userEvent.setup();
    updateProjectMock.mockRejectedValue(new TypeError('Failed to fetch'));
    render(<ProjectSettingsForm {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: '設定を保存' }));

    expect(
      await screen.findByText(
        '通信に失敗しました。ネットワーク接続を確認して、もう一度お試しください。',
      ),
    ).toBeInTheDocument();
    expect(toastMocks.add).not.toHaveBeenCalled();
    expect(routerMocks.refresh).not.toHaveBeenCalled();
  });

  it('APIエラーの場合はAPIのメッセージを表示する', async () => {
    const user = userEvent.setup();
    updateProjectMock.mockRejectedValue(
      new UpdateProjectRequestError('プロジェクトが見つかりません', 404),
    );
    render(<ProjectSettingsForm {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: '設定を保存' }));

    expect(
      await screen.findByText('プロジェクトが見つかりません'),
    ).toBeInTheDocument();
    expect(toastMocks.add).not.toHaveBeenCalled();
    expect(routerMocks.refresh).not.toHaveBeenCalled();
  });
});

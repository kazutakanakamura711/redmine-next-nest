import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectRequestError } from '@/app/(app)/projects/_lib/api-error';
import type { ProjectMember } from '@/app/(app)/projects/_lib/get-project-members';
import { ProjectRole } from '@/app/(app)/projects/_lib/project-role';
import { updateProjectMemberRole } from '@/app/(app)/projects/_lib/update-project-member-role';
import { ProjectMembersList } from './project-members-list';

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  toastAdd: vi.fn(),
}));

vi.mock('@/app/(app)/projects/_lib/update-project-member-role', () => ({
  updateProjectMemberRole: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock('@/components/ui/toast', () => ({
  toast: { add: mocks.toastAdd },
}));

const members: ProjectMember[] = [
  {
    id: 'membership-owner',
    userId: 'user-owner',
    role: ProjectRole.Owner,
    createdAt: '2026-10-16T15:30:00.000Z',
    user: { name: '山田 太郎', email: 'owner@example.com' },
  },
  {
    id: 'membership-member',
    userId: 'user-member',
    role: ProjectRole.Member,
    createdAt: '2026-10-17T00:00:00.000Z',
    user: { name: '佐藤 花子', email: 'member@example.com' },
  },
  {
    id: 'membership-viewer',
    userId: 'user-viewer',
    role: ProjectRole.Viewer,
    createdAt: '2026-10-18T00:00:00.000Z',
    user: { name: null, email: 'viewer@example.com' },
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(updateProjectMemberRole)
    .mockReset()
    .mockResolvedValue({ ...members[1], role: ProjectRole.Viewer });
});

function getMemberItems(layout: 'PC' | 'モバイル') {
  if (layout === 'PC') {
    const table = screen.getByRole('table', {
      name: 'プロジェクトメンバー一覧',
    });
    return within(table).getAllByRole('row').slice(1);
  }

  const list = screen.getByRole('list', {
    name: 'プロジェクトメンバー一覧（モバイル）',
  });
  return within(list).getAllByRole('listitem');
}

describe('ProjectMembersList', () => {
  it('PC用の表に名前・メール・3種類の権限・参加日をAPIの順で表示する', () => {
    render(
      <ProjectMembersList
        projectId="project-id"
        members={members}
        currentUserRole={ProjectRole.Viewer}
        isArchived={false}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'プロジェクトメンバー' }),
    ).toBeInTheDocument();
    expect(screen.getByText('3名')).toBeInTheDocument();

    const table = screen.getByRole('table', {
      name: 'プロジェクトメンバー一覧',
    });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((column) => column.textContent),
    ).toEqual(['名前', 'メールアドレス', '権限', '参加日']);

    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText('山田 太郎')).toBeInTheDocument();
    expect(within(rows[0]).getByText('owner@example.com')).toBeInTheDocument();
    expect(within(rows[0]).getByText('オーナー')).toBeInTheDocument();
    expect(within(rows[1]).getByText('佐藤 花子')).toBeInTheDocument();
    expect(within(rows[1]).getByText('member@example.com')).toBeInTheDocument();
    expect(within(rows[1]).getByText('メンバー')).toBeInTheDocument();
    expect(within(rows[2]).getByText('名前未設定')).toBeInTheDocument();
    expect(within(rows[2]).getByText('viewer@example.com')).toBeInTheDocument();
    expect(within(rows[2]).getByText('閲覧者')).toBeInTheDocument();

    expect(within(rows[0]).getByText('2026/10/17')).toHaveAttribute(
      'datetime',
      members[0].createdAt,
    );
    expect(within(rows[2]).getByText('2026/10/18')).toBeInTheDocument();
  });

  it('モバイル用の一覧にも同じ情報と本人の目印を表示する', () => {
    render(
      <ProjectMembersList
        projectId="project-id"
        members={members}
        currentUserId="user-member"
        currentUserRole={ProjectRole.Member}
        isArchived={false}
      />,
    );

    const list = screen.getByRole('list', {
      name: 'プロジェクトメンバー一覧（モバイル）',
    });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(within(items[0]).getByText('山田 太郎')).toBeInTheDocument();
    expect(within(items[0]).getByText('オーナー')).toBeInTheDocument();
    expect(within(items[0]).getByText('2026/10/17')).toHaveAttribute(
      'datetime',
      members[0].createdAt,
    );
    expect(
      within(items[1]).getByText('member@example.com'),
    ).toBeInTheDocument();
    expect(within(items[1]).getByText('メンバー')).toBeInTheDocument();
    expect(within(items[1]).getByText('（自分）')).toBeInTheDocument();
    expect(within(items[2]).getByText('名前未設定')).toBeInTheDocument();
    expect(
      within(items[2]).getByText('viewer@example.com'),
    ).toBeInTheDocument();
    expect(within(items[2]).getByText('閲覧者')).toBeInTheDocument();
    expect(within(list).getAllByText('（自分）')).toHaveLength(1);

    const table = screen.getByRole('table', {
      name: 'プロジェクトメンバー一覧',
    });
    const memberRow = within(table).getAllByRole('row')[2];
    expect(within(memberRow).getByText('（自分）')).toBeInTheDocument();
    expect(within(table).getAllByText('（自分）')).toHaveLength(1);
  });

  it.each([undefined, 'membership-member'])(
    'currentUserIdが%sの場合は本人の目印を表示しない',
    (currentUserId) => {
      render(
        <ProjectMembersList
          projectId="project-id"
          members={members}
          currentUserId={currentUserId}
          currentUserRole={ProjectRole.Viewer}
          isArchived={false}
        />,
      );

      expect(screen.queryByText('（自分）')).not.toBeInTheDocument();
    },
  );

  it('空白だけの名前も名前未設定として表示する', () => {
    render(
      <ProjectMembersList
        projectId="project-id"
        currentUserRole={ProjectRole.Viewer}
        isArchived={false}
        members={[
          {
            ...members[0],
            user: { ...members[0].user, name: '   ' },
          },
        ]}
      />,
    );

    const table = screen.getByRole('table', {
      name: 'プロジェクトメンバー一覧',
    });
    expect(within(table).getByText('名前未設定')).toBeInTheDocument();
  });

  it('0件の場合は件数と空の案内を表示する', () => {
    render(
      <ProjectMembersList
        projectId="project-id"
        members={[]}
        currentUserRole={ProjectRole.Owner}
        isArchived={false}
      />,
    );

    expect(screen.getByText('0名')).toBeInTheDocument();
    expect(screen.getByText('メンバーはいません。')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});

describe('ProjectMembersList の権限変更の表示', () => {
  it('ownerには操作列を表示し、owner以外の行とカードだけに権限変更ボタンを表示する', () => {
    render(
      <ProjectMembersList
        projectId="project-id"
        members={members}
        currentUserRole={ProjectRole.Owner}
        isArchived={false}
      />,
    );

    const table = screen.getByRole('table', {
      name: 'プロジェクトメンバー一覧',
    });
    expect(
      within(table).getByRole('columnheader', { name: '操作' }),
    ).toBeInTheDocument();
    const rows = within(table).getAllByRole('row').slice(1);
    expect(within(rows[0]).queryByRole('button')).not.toBeInTheDocument();
    expect(
      within(rows[1]).getByRole('button', { name: '権限変更' }),
    ).toBeEnabled();
    expect(
      within(rows[2]).getByRole('button', { name: '権限変更' }),
    ).toBeEnabled();

    const list = screen.getByRole('list', {
      name: 'プロジェクトメンバー一覧（モバイル）',
    });
    const cards = within(list).getAllByRole('listitem');
    expect(within(cards[0]).queryByRole('button')).not.toBeInTheDocument();
    expect(
      within(cards[1]).getByRole('button', { name: '権限変更' }),
    ).toBeEnabled();
    expect(
      within(cards[2]).getByRole('button', { name: '権限変更' }),
    ).toBeEnabled();
    expect(
      screen.queryByRole('button', { name: '削除' }),
    ).not.toBeInTheDocument();
  });

  it.each([ProjectRole.Member, ProjectRole.Viewer])(
    '%sには操作列と権限変更ボタンを表示しない',
    (currentUserRole) => {
      render(
        <ProjectMembersList
          projectId="project-id"
          members={members}
          currentUserRole={currentUserRole}
          isArchived={false}
        />,
      );

      expect(
        screen.queryByRole('columnheader', { name: '操作' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: '権限変更' }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    },
  );

  it.each([1, 2])(
    'PCの%d行目を編集すると現在の権限を選択し、取消で保存せず元の表示に戻す',
    async (memberIndex) => {
      const user = userEvent.setup();
      render(
        <ProjectMembersList
          projectId="project-id"
          members={members}
          currentUserRole={ProjectRole.Owner}
          isArchived={false}
        />,
      );
      const table = screen.getByRole('table', {
        name: 'プロジェクトメンバー一覧',
      });
      const rows = within(table).getAllByRole('row').slice(1);
      const row = rows[memberIndex];
      const member = members[memberIndex];
      await user.click(within(row).getByRole('button', { name: '権限変更' }));

      const select = within(row).getByRole('combobox', {
        name: '変更後の権限',
      });
      expect(select).toHaveValue(member.role);
      expect(
        within(select)
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual(['メンバー', '閲覧者']);
      expect(within(row).getByRole('button', { name: '保存' })).toBeEnabled();
      expect(
        within(row).queryByRole('button', { name: '権限変更' }),
      ).not.toBeInTheDocument();
      expect(within(rows[0]).queryByRole('combobox')).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      const nextRole =
        member.role === ProjectRole.Member
          ? ProjectRole.Viewer
          : ProjectRole.Member;
      await user.selectOptions(select, nextRole);
      expect(select).toHaveValue(nextRole);
      const list = screen.getByRole('list', {
        name: 'プロジェクトメンバー一覧（モバイル）',
      });
      const card = within(list).getAllByRole('listitem')[memberIndex];
      expect(
        within(card).getByRole('combobox', { name: '変更後の権限' }),
      ).toHaveValue(nextRole);

      await user.click(within(row).getByRole('button', { name: '取消' }));
      expect(updateProjectMemberRole).not.toHaveBeenCalled();
      expect(within(row).queryByRole('combobox')).not.toBeInTheDocument();
      expect(
        within(row).getByText(
          member.role === ProjectRole.Member ? 'メンバー' : '閲覧者',
        ),
      ).toBeInTheDocument();
      expect(within(card).queryByRole('combobox')).not.toBeInTheDocument();

      await user.click(within(row).getByRole('button', { name: '権限変更' }));
      expect(
        within(row).getByRole('combobox', { name: '変更後の権限' }),
      ).toHaveValue(member.role);
    },
  );

  it('モバイルのカードから編集を開き、別のメンバーに切り替えるとその権限を初期選択にする', async () => {
    const user = userEvent.setup();
    render(
      <ProjectMembersList
        projectId="project-id"
        members={members}
        currentUserRole={ProjectRole.Owner}
        isArchived={false}
      />,
    );
    const list = screen.getByRole('list', {
      name: 'プロジェクトメンバー一覧（モバイル）',
    });
    const cards = within(list).getAllByRole('listitem');
    await user.click(
      within(cards[1]).getByRole('button', { name: '権限変更' }),
    );
    expect(
      within(cards[1]).queryByText('メンバー', {
        selector: '[data-slot="badge"]',
      }),
    ).not.toBeInTheDocument();
    await user.selectOptions(
      within(cards[1]).getByRole('combobox'),
      ProjectRole.Viewer,
    );

    const table = screen.getByRole('table', {
      name: 'プロジェクトメンバー一覧',
    });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(
      within(rows[1]).getByRole('combobox', { name: '変更後の権限' }),
    ).toHaveValue(ProjectRole.Viewer);

    await user.click(
      within(cards[2]).getByRole('button', { name: '権限変更' }),
    );
    expect(within(cards[1]).queryByRole('combobox')).not.toBeInTheDocument();
    expect(within(cards[1]).getByText('メンバー')).toBeInTheDocument();
    expect(
      within(cards[2]).getByRole('combobox', { name: '変更後の権限' }),
    ).toHaveValue(ProjectRole.Viewer);
    expect(
      within(cards[2]).getByRole('button', { name: '保存' }),
    ).toBeEnabled();
    await user.click(within(cards[2]).getByRole('button', { name: '取消' }));
    expect(within(cards[2]).queryByRole('combobox')).not.toBeInTheDocument();
    expect(within(cards[2]).getByText('閲覧者')).toBeInTheDocument();
    expect(within(rows[2]).queryByRole('combobox')).not.toBeInTheDocument();
    expect(within(rows[2]).getByText('閲覧者')).toBeInTheDocument();
  });

  it('アーカイブ済みでは権限変更ボタンを無効にして理由を伝える', async () => {
    render(
      <ProjectMembersList
        projectId="project-id"
        members={members}
        currentUserRole={ProjectRole.Owner}
        isArchived
      />,
    );

    for (const button of screen.getAllByRole('button', { name: '権限変更' })) {
      expect(button).toBeDisabled();
      expect(button).toHaveAccessibleDescription(
        'アーカイブ済みのため、メンバーの権限を変更できません。',
      );
      await userEvent.setup().click(button);
    }
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(updateProjectMemberRole).not.toHaveBeenCalled();
  });
});

describe('ProjectMembersList の権限変更の保存', () => {
  it.each([
    ['PC', 1, ProjectRole.Viewer],
    ['PC', 2, ProjectRole.Member],
    ['モバイル', 1, ProjectRole.Viewer],
    ['モバイル', 2, ProjectRole.Member],
  ] as const)(
    '%sで%d番目のメンバーを%sへ変更し、成功通知と一覧再取得を行う',
    async (layout, memberIndex, role) => {
      const user = userEvent.setup();
      const updatedMember = { ...members[memberIndex], role };
      vi.mocked(updateProjectMemberRole).mockResolvedValue(updatedMember);
      const { rerender } = render(
        <ProjectMembersList
          projectId="project-id"
          members={members}
          currentUserRole={ProjectRole.Owner}
          isArchived={false}
        />,
      );
      const item = getMemberItems(layout)[memberIndex];
      await user.click(within(item).getByRole('button', { name: '権限変更' }));
      await user.selectOptions(within(item).getByRole('combobox'), role);
      await user.click(within(item).getByRole('button', { name: '保存' }));

      await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
      expect(updateProjectMemberRole).toHaveBeenCalledExactlyOnceWith(
        'project-id',
        members[memberIndex].id,
        { role },
      );
      expect(mocks.toastAdd).toHaveBeenCalledExactlyOnceWith({
        type: 'success',
        title: 'メンバーの権限を変更しました',
      });
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

      // router.refresh() 後に Server Component から渡される一覧を再現する。
      rerender(
        <ProjectMembersList
          projectId="project-id"
          members={members.map((member) =>
            member.id === updatedMember.id ? updatedMember : member,
          )}
          currentUserRole={ProjectRole.Owner}
          isArchived={false}
        />,
      );
      for (const currentLayout of ['PC', 'モバイル'] as const) {
        const updatedItem = getMemberItems(currentLayout)[memberIndex];
        expect(
          within(updatedItem).getByText(
            role === ProjectRole.Member ? 'メンバー' : '閲覧者',
          ),
        ).toBeInTheDocument();
        expect(
          within(updatedItem).getByText(updatedMember.user.email),
        ).toBeInTheDocument();
      }
      expect(screen.getByText('3名')).toBeInTheDocument();
    },
  );

  it('現在と同じ権限も既存APIへ送り、成功として扱う', async () => {
    const user = userEvent.setup();
    render(
      <ProjectMembersList
        projectId="project-id"
        members={members}
        currentUserRole={ProjectRole.Owner}
        isArchived={false}
      />,
    );
    const item = getMemberItems('PC')[1];
    await user.click(within(item).getByRole('button', { name: '権限変更' }));
    await user.click(within(item).getByRole('button', { name: '保存' }));

    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    expect(updateProjectMemberRole).toHaveBeenCalledExactlyOnceWith(
      'project-id',
      members[1].id,
      { role: ProjectRole.Member },
    );
  });

  it.each(['PC', 'モバイル'] as const)(
    '%sから保存中は両方の編集欄と対象の切り替えを無効にし、通常操作で再送しない',
    async (layout) => {
      let resolveRequest!: (member: ProjectMember) => void;
      vi.mocked(updateProjectMemberRole).mockReturnValue(
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
      );
      const user = userEvent.setup();
      render(
        <ProjectMembersList
          projectId="project-id"
          members={members}
          currentUserRole={ProjectRole.Owner}
          isArchived={false}
        />,
      );
      const item = getMemberItems(layout)[1];
      await user.click(within(item).getByRole('button', { name: '権限変更' }));
      await user.selectOptions(
        within(item).getByRole('combobox'),
        ProjectRole.Viewer,
      );
      await user.dblClick(within(item).getByRole('button', { name: '保存' }));
      await waitFor(() =>
        expect(updateProjectMemberRole).toHaveBeenCalledTimes(1),
      );

      for (const form of screen.getAllByRole('form', {
        name: 'メンバーの権限変更',
      })) {
        expect(form).toHaveAttribute('aria-busy', 'true');
        expect(within(form).getByRole('combobox')).toBeDisabled();
        const save = within(form).getByRole('button', { name: '保存中...' });
        const cancel = within(form).getByRole('button', { name: '取消' });
        expect(save).toBeDisabled();
        expect(cancel).toBeDisabled();
        await user.click(save);
        await user.click(cancel);
      }
      for (const button of screen.getAllByRole('button', {
        name: '権限変更',
      })) {
        expect(button).toBeDisabled();
        await user.click(button);
      }
      expect(screen.getAllByRole('combobox')).toHaveLength(2);
      expect(updateProjectMemberRole).toHaveBeenCalledTimes(1);
      expect(mocks.refresh).not.toHaveBeenCalled();
      expect(mocks.toastAdd).not.toHaveBeenCalled();

      await act(async () =>
        resolveRequest({ ...members[1], role: ProjectRole.Viewer }),
      );
      await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    },
  );

  it.each([
    [401, '認証に失敗しました。'],
    [403, 'プロジェクトのメンバーの role を変更する権限がありません'],
    [404, 'プロジェクトが見つかりません'],
    [404, '変更対象のメンバーが見つかりません'],
    [409, 'アーカイブ済みのプロジェクトではメンバーの role を変更できません'],
    [409, 'owner の role は変更できません'],
  ])(
    '%iの業務エラー「%s」を表示し、選択値を保持する',
    async (status, message) => {
      vi.mocked(updateProjectMemberRole).mockRejectedValue(
        new ProjectRequestError(message, status),
      );
      const user = userEvent.setup();
      render(
        <ProjectMembersList
          projectId="project-id"
          members={members}
          currentUserRole={ProjectRole.Owner}
          isArchived={false}
        />,
      );
      const item = getMemberItems('モバイル')[1];
      await user.click(within(item).getByRole('button', { name: '権限変更' }));
      await user.selectOptions(
        within(item).getByRole('combobox'),
        ProjectRole.Viewer,
      );
      await user.click(within(item).getByRole('button', { name: '保存' }));

      for (const layout of ['PC', 'モバイル'] as const) {
        const currentItem = getMemberItems(layout)[1];
        expect(await within(currentItem).findByRole('alert')).toHaveTextContent(
          message,
        );
        const select = within(currentItem).getByRole('combobox');
        expect(select).toHaveValue(ProjectRole.Viewer);
        expect(select).toBeEnabled();
        expect(select).toHaveAttribute('aria-invalid', 'false');
        expect(
          within(currentItem).getByRole('button', { name: '保存' }),
        ).toBeEnabled();
      }
      expect(mocks.toastAdd).not.toHaveBeenCalled();
      expect(mocks.refresh).not.toHaveBeenCalled();
    },
  );

  it('通信失敗では内部エラーを表示せず、固定の案内と選択値を保持する', async () => {
    vi.mocked(updateProjectMemberRole).mockRejectedValue(
      new TypeError('internal fetch error'),
    );
    const user = userEvent.setup();
    render(
      <ProjectMembersList
        projectId="project-id"
        members={members}
        currentUserRole={ProjectRole.Owner}
        isArchived={false}
      />,
    );
    const item = getMemberItems('PC')[1];
    await user.click(within(item).getByRole('button', { name: '権限変更' }));
    await user.selectOptions(
      within(item).getByRole('combobox'),
      ProjectRole.Viewer,
    );
    await user.click(within(item).getByRole('button', { name: '保存' }));

    expect(await within(item).findByRole('alert')).toHaveTextContent(
      '通信に失敗しました。ネットワーク接続を確認して、もう一度お試しください。',
    );
    expect(screen.queryByText('internal fetch error')).not.toBeInTheDocument();
    expect(within(item).getByRole('combobox')).toHaveValue(ProjectRole.Viewer);
    expect(mocks.toastAdd).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('失敗後は選択を変更して再送信でき、成功時だけ通知と再取得を行う', async () => {
    vi.mocked(updateProjectMemberRole)
      .mockRejectedValueOnce(new ProjectRequestError('保存に失敗しました', 409))
      .mockResolvedValueOnce(members[1]);
    const user = userEvent.setup();
    render(
      <ProjectMembersList
        projectId="project-id"
        members={members}
        currentUserRole={ProjectRole.Owner}
        isArchived={false}
      />,
    );
    const item = getMemberItems('PC')[1];
    await user.click(within(item).getByRole('button', { name: '権限変更' }));
    await user.selectOptions(
      within(item).getByRole('combobox'),
      ProjectRole.Viewer,
    );
    await user.click(within(item).getByRole('button', { name: '保存' }));
    await within(item).findByText('保存に失敗しました');
    expect(mocks.refresh).not.toHaveBeenCalled();

    await user.selectOptions(
      within(item).getByRole('combobox'),
      ProjectRole.Member,
    );
    await user.click(within(item).getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    expect(updateProjectMemberRole).toHaveBeenNthCalledWith(
      1,
      'project-id',
      members[1].id,
      { role: ProjectRole.Viewer },
    );
    expect(updateProjectMemberRole).toHaveBeenNthCalledWith(
      2,
      'project-id',
      members[1].id,
      { role: ProjectRole.Member },
    );
    expect(mocks.toastAdd).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each(['取消して開き直す', '別のメンバーへ切り替える'])(
    '失敗後に%sと、入力とエラーを初期化する',
    async (method) => {
      vi.mocked(updateProjectMemberRole).mockRejectedValue(
        new ProjectRequestError('保存に失敗しました', 409),
      );
      const user = userEvent.setup();
      render(
        <ProjectMembersList
          projectId="project-id"
          members={members}
          currentUserRole={ProjectRole.Owner}
          isArchived={false}
        />,
      );
      const items = getMemberItems('PC');
      await user.click(
        within(items[1]).getByRole('button', { name: '権限変更' }),
      );
      await user.selectOptions(
        within(items[1]).getByRole('combobox'),
        ProjectRole.Viewer,
      );
      await user.click(within(items[1]).getByRole('button', { name: '保存' }));
      await within(items[1]).findByRole('alert');

      const memberIndex = method === '取消して開き直す' ? 1 : 2;
      if (method === '取消して開き直す') {
        await user.click(
          within(items[1]).getByRole('button', { name: '取消' }),
        );
      }
      await user.click(
        within(items[memberIndex]).getByRole('button', { name: '権限変更' }),
      );
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(within(items[memberIndex]).getByRole('combobox')).toHaveValue(
        members[memberIndex].role,
      );
      expect(updateProjectMemberRole).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['owner', 'invalid-role', ''])(
    '不正なrole「%s」は送信時に検証し、修正後は入力変更で再検証する',
    async (invalidRole) => {
      const user = userEvent.setup();
      render(
        <ProjectMembersList
          projectId="project-id"
          members={members}
          currentUserRole={ProjectRole.Owner}
          isArchived={false}
        />,
      );
      const item = getMemberItems('PC')[1];
      await user.click(within(item).getByRole('button', { name: '権限変更' }));
      const select = within(item).getByRole('combobox');
      // DOM から選択肢が追加されても、スキーマで許可した値だけを送信する。
      const invalidOption = document.createElement('option');
      invalidOption.value = invalidRole;
      invalidOption.textContent = '不正な権限';
      select.append(invalidOption);
      await user.selectOptions(select, invalidRole);
      await user.tab();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      await user.click(within(item).getByRole('button', { name: '保存' }));

      await waitFor(() =>
        expect(select).toHaveAttribute('aria-invalid', 'true'),
      );
      expect(select).toHaveAccessibleDescription(
        '権限はメンバーまたは閲覧者を選択してください',
      );
      const mobileSelect = within(getMemberItems('モバイル')[1]).getByRole(
        'combobox',
      );
      expect(mobileSelect).toHaveAccessibleDescription(
        '権限はメンバーまたは閲覧者を選択してください',
      );
      expect(select.getAttribute('aria-describedby')).not.toBe(
        mobileSelect.getAttribute('aria-describedby'),
      );
      expect(updateProjectMemberRole).not.toHaveBeenCalled();

      await user.selectOptions(select, ProjectRole.Viewer);
      await waitFor(() =>
        expect(select).toHaveAttribute('aria-invalid', 'false'),
      );
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(updateProjectMemberRole).not.toHaveBeenCalled();
    },
  );
});

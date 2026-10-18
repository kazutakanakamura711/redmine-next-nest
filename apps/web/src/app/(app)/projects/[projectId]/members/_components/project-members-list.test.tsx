import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ProjectMember } from '@/app/(app)/projects/_lib/get-project-members';
import { ProjectRole } from '@/app/(app)/projects/_lib/project-role';
import { ProjectMembersList } from './project-members-list';

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

describe('ProjectMembersList', () => {
  it('PC用の表に名前・メール・3種類の権限・参加日をAPIの順で表示する', () => {
    render(<ProjectMembersList members={members} />);

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
      <ProjectMembersList members={members} currentUserId="user-member" />,
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
        <ProjectMembersList members={members} currentUserId={currentUserId} />,
      );

      expect(screen.queryByText('（自分）')).not.toBeInTheDocument();
    },
  );

  it('空白だけの名前も名前未設定として表示する', () => {
    render(
      <ProjectMembersList
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
    render(<ProjectMembersList members={[]} />);

    expect(screen.getByText('0名')).toBeInTheDocument();
    expect(screen.getByText('メンバーはいません。')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});

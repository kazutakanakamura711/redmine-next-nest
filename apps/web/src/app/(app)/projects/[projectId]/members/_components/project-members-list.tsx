import { UserRound } from 'lucide-react';

import type { ProjectMember } from '@/app/(app)/projects/_lib/get-project-members';
import {
  ProjectRole,
  ProjectRoleDisplayText,
} from '@/app/(app)/projects/_lib/project-role';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type ProjectMembersListProps = {
  members: ProjectMember[];
  currentUserId?: string;
};

const roleBadgeClassName = {
  [ProjectRole.Owner]: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  [ProjectRole.Member]: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  [ProjectRole.Viewer]: 'border-slate-200 bg-slate-50 text-slate-600',
} satisfies Record<ProjectRole, string>;

function formatJoinedAt(createdAt: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Tokyo',
  }).format(new Date(createdAt));
}

function MemberIdentity({
  name,
  isCurrentUser,
}: {
  name: string | null;
  isCurrentUser: boolean;
}) {
  const displayName = name?.trim() || '名前未設定';

  return (
    <div className="flex min-w-0 items-start gap-2">
      <span
        aria-hidden="true"
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs text-indigo-700"
      >
        {name?.trim() ? (
          Array.from(name.trim()).slice(0, 2).join('')
        ) : (
          <UserRound className="size-3.5" />
        )}
      </span>
      <p className="min-w-0 font-medium leading-6 wrap-anywhere">
        {displayName}
        {isCurrentUser && (
          <span className="ml-1 inline-block text-xs font-normal text-muted-foreground">
            （自分）
          </span>
        )}
      </p>
    </div>
  );
}

function RoleBadge({ role }: { role: ProjectRole }) {
  return (
    <Badge
      variant="outline"
      className={`rounded-sm ${roleBadgeClassName[role]}`}
    >
      {ProjectRoleDisplayText[role]}
    </Badge>
  );
}

export function ProjectMembersList({
  members,
  currentUserId,
}: ProjectMembersListProps) {
  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-background">
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <h2 className="text-sm font-semibold">プロジェクトメンバー</h2>
        <p className="mt-1 text-xs text-muted-foreground">{members.length}名</p>
      </div>

      {members.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          メンバーはいません。
        </p>
      ) : (
        <>
          <div className="hidden md:block">
            <Table
              aria-label="プロジェクトメンバー一覧"
              className="table-fixed"
            >
              <TableHeader>
                <TableRow className="border-border bg-slate-50 hover:bg-slate-50">
                  <TableHead className="w-[30%] px-4 text-xs text-muted-foreground">
                    名前
                  </TableHead>
                  <TableHead className="px-4 text-xs text-muted-foreground">
                    メールアドレス
                  </TableHead>
                  <TableHead className="w-28 px-4 text-xs text-muted-foreground">
                    権限
                  </TableHead>
                  <TableHead className="w-28 px-4 text-xs text-muted-foreground">
                    参加日
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id} className="border-border">
                    <TableCell className="whitespace-normal px-4 py-3">
                      <MemberIdentity
                        name={member.user.name}
                        isCurrentUser={member.userId === currentUserId}
                      />
                    </TableCell>
                    <TableCell className="whitespace-normal px-4 py-3 text-xs text-muted-foreground wrap-anywhere">
                      {member.user.email}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <RoleBadge role={member.role} />
                    </TableCell>
                    <TableCell className="px-4 py-3 text-xs text-muted-foreground">
                      <time dateTime={member.createdAt}>
                        {formatJoinedAt(member.createdAt)}
                      </time>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul
            aria-label="プロジェクトメンバー一覧（モバイル）"
            className="divide-y divide-border md:hidden"
          >
            {members.map((member) => (
              <li key={member.id} className="px-4 py-4 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <MemberIdentity
                    name={member.user.name}
                    isCurrentUser={member.userId === currentUserId}
                  />
                  <RoleBadge role={member.role} />
                </div>
                <p className="mt-1 pl-8 text-xs text-muted-foreground wrap-anywhere">
                  {member.user.email}
                </p>
                <p className="mt-1 pl-8 text-xs text-muted-foreground">
                  参加日{' '}
                  <time dateTime={member.createdAt}>
                    {formatJoinedAt(member.createdAt)}
                  </time>
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

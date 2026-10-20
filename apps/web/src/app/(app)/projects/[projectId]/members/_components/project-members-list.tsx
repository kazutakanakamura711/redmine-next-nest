'use client';

import type { ReactNode } from 'react';

import type { ProjectMember } from '@/app/(app)/projects/_lib/get-project-members';
import type { ProjectRole } from '@/app/(app)/projects/_lib/project-role';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { useProjectMembersList } from '../_lib/use-project-members-list';
import {
  ProjectMemberCard,
  ProjectMemberTableRow,
} from './project-member-item';

type ProjectMembersListProps = {
  projectId: string;
  members: ProjectMember[];
  currentUserId?: string;
  currentUserRole: ProjectRole;
  isArchived: boolean;
  headerAction?: ReactNode;
};

export function ProjectMembersList({
  projectId,
  members,
  currentUserId,
  currentUserRole,
  isArchived,
  headerAction,
}: ProjectMembersListProps) {
  const {
    canManageMembers,
    editingMemberId,
    editingRole,
    isSubmitting,
    roleError,
    submitError,
    handleEditRole,
    handleRoleChange,
    handleCancelEdit,
    handleSave,
  } = useProjectMembersList({
    projectId,
    currentUserRole,
    isArchived,
  });

  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-background">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <h2 className="text-sm font-semibold">プロジェクトメンバー</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {members.length}名
          </p>
        </div>
        {headerAction}
      </div>

      {canManageMembers && isArchived && (
        <p
          id="project-member-role-archived-description"
          className="border-b border-border px-4 py-3 text-xs text-muted-foreground sm:px-5"
        >
          アーカイブ済みのため、メンバーの権限を変更できません。
        </p>
      )}

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
                  <TableHead
                    className={`${canManageMembers ? 'w-[24%]' : 'w-[30%]'} px-4 text-xs text-muted-foreground`}
                  >
                    名前
                  </TableHead>
                  <TableHead className="px-4 text-xs text-muted-foreground">
                    メールアドレス
                  </TableHead>
                  <TableHead
                    className={`${canManageMembers ? 'w-52' : 'w-28'} px-4 text-xs text-muted-foreground`}
                  >
                    権限
                  </TableHead>
                  <TableHead className="w-28 px-4 text-xs text-muted-foreground">
                    参加日
                  </TableHead>
                  {canManageMembers && (
                    <TableHead className="w-20 px-4 text-xs text-muted-foreground">
                      操作
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <ProjectMemberTableRow
                    key={member.id}
                    member={member}
                    isCurrentUser={member.userId === currentUserId}
                    canManageMembers={canManageMembers}
                    isArchived={isArchived}
                    editingMemberId={editingMemberId}
                    editingRole={editingRole}
                    onEdit={() => handleEditRole(member)}
                    onRoleChange={handleRoleChange}
                    onCancel={handleCancelEdit}
                    onSubmit={handleSave}
                    isSubmitting={isSubmitting}
                    roleError={roleError}
                    submitError={submitError}
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          <ul
            aria-label="プロジェクトメンバー一覧（モバイル）"
            className="divide-y divide-border md:hidden"
          >
            {members.map((member) => (
              <ProjectMemberCard
                key={member.id}
                member={member}
                isCurrentUser={member.userId === currentUserId}
                canManageMembers={canManageMembers}
                isArchived={isArchived}
                editingMemberId={editingMemberId}
                editingRole={editingRole}
                onEdit={() => handleEditRole(member)}
                onRoleChange={handleRoleChange}
                onCancel={handleCancelEdit}
                onSubmit={handleSave}
                isSubmitting={isSubmitting}
                roleError={roleError}
                submitError={submitError}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

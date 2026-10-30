import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import {
  ProjectMemberRole,
  type TaskPriority,
  type TaskStatus,
} from '../../generated/prisma/enums.js';

type CreateTaskData = {
  projectId: string;
  reporterId: string;
  title: string;
  description: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId: string | null;
  startDate: Date | null;
  dueDate: Date | null;
};

@Injectable()
export class TasksRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(projectId: string) {
    return this.prisma.task.findMany({
      where: { projectId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        assignee: { select: { id: true, name: true } },
        reporter: { select: { id: true, name: true } },
      },
    });
  }

  findById(projectId: string, taskId: string) {
    return this.prisma.task.findUnique({
      where: {
        id: taskId,
        projectId,
      },
      include: {
        assignee: { select: { id: true, name: true } },
        reporter: { select: { id: true, name: true } },
      },
    });
  }

  findProjectMember(projectId: string, userId: string) {
    return this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });
  }

  async create(data: CreateTaskData) {
    try {
      // 採番とTask作成を同じtransactionで行う。途中で例外が起きたら、両方の更新を取り消す。
      return await this.prisma.$transaction(async (tx) => {
        // 1. 対象Projectのアーカイブ状態を取得し、このtransactionが終わるまで行をロックする。
        // 同じProjectをロックするメンバー削除・role変更や、アーカイブの更新と保存順を揃える。
        const [project] = await tx.$queryRaw<{ isArchived: boolean }[]>`
          SELECT is_archived AS "isArchived"
          FROM projects
          WHERE id = ${data.projectId}
          FOR UPDATE
        `;

        // Projectが取得できなければ、以降の検証・保存は行わない。
        if (!project) {
          return { status: 'project_not_found' as const };
        }

        // 2. タスク作成者本人の参加情報を、Project IDとUser IDの組み合わせで取得する。
        // reporterIdはServiceが設定した認証済み本人のUser ID。
        // Serviceの事前確認後に脱退・role変更された場合も、ロック後の最新状態で判断する。
        const member = await tx.projectMember.findUnique({
          where: {
            projectId_userId: {
              projectId: data.projectId,
              userId: data.reporterId,
            },
          },
        });
        if (!member) {
          // 非参加者には、Projectが存在しない場合と同じ結果を返す。
          return { status: 'project_not_found' as const };
        }
        if (member.role === ProjectMemberRole.viewer) {
          // viewerは閲覧のみ。タスクを作成できるのはowner・member。
          return { status: 'forbidden' as const };
        }
        if (project.isArchived) {
          // 作成権限があっても、アーカイブ済みProjectへの作成は許可しない。
          return { status: 'project_archived' as const };
        }

        // 3. 担当者が指定された場合だけ、そのUserが同じProjectに参加しているか確認する。
        // assigneeIdは担当者のUser ID。未担当（null）の場合は、この検証をスキップする。
        // 担当者にはowner・member・viewerのいずれも指定できるため、roleの制限はしない。
        if (data.assigneeId !== null) {
          const assignee = await tx.projectMember.findUnique({
            where: {
              projectId_userId: {
                projectId: data.projectId,
                userId: data.assigneeId,
              },
            },
          });
          if (!assignee) {
            // 指定Projectの参加情報がないUserは、担当者として保存できない。
            return { status: 'assignee_not_found' as const };
          }
        }

        // 4. 対象ProjectのカウンターをDB上で1増やし、更新後のlastTaskNumberだけを取得する。
        // 例: カウンターが2なら3に更新し、今回のタスク番号として3を使う。
        const counter = await tx.project.update({
          where: { id: data.projectId },
          data: { lastTaskNumber: { increment: 1 } },
          select: { lastTaskNumber: true },
        });

        // 5. ...dataで保存項目を展開し、Backendで採番したnumberを加えてTaskを1件作成する。
        // この作成に失敗した場合は、直前のカウンター増加も同じtransactionで取り消される。
        const task = await tx.task.create({
          data: { ...data, number: counter.lastTaskNumber },
          // 関連する担当者・報告者のUserも取得し、作成結果にidとnameだけを含める。
          include: {
            assignee: { select: { id: true, name: true } },
            reporter: { select: { id: true, name: true } },
          },
        });

        // 6. 成功を表すstatusと、作成したTaskをServiceへ返す。
        // このあとtransactionが正常終了すると、カウンター更新とTask作成が一緒に確定する。
        return { status: 'created' as const, task };
      });
    } catch (error) {
      // 一意制約違反もtransactionの外で扱い、カウンター更新を確実に取り消す。
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target = error.meta?.target;
        // Prismaのpg adapterはtargetの代わりに、原因のindex名を返す場合がある。
        const adapterError = error.meta?.driverAdapterError as
          { cause?: { constraint?: { index?: string } } } | undefined;
        if (
          (Array.isArray(target) &&
            target.includes('project_id') &&
            target.includes('number')) ||
          adapterError?.cause?.constraint?.index ===
            'tasks_project_id_number_key'
        ) {
          return { status: 'number_conflict' as const };
        }
      }
      throw error;
    }
  }
}

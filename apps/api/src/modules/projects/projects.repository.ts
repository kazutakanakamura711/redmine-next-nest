import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProjectMemberRole } from '../../generated/prisma/enums.js';

type CreateProjectData = {
  ownerId: string;
  name: string;
  key: string;
  description?: string;
};

type UpdateProjectData = {
  name?: string;
  description?: string | null;
};

type CreateProjectMemberData = {
  projectId: string;
  userId: string;
  role: Exclude<ProjectMemberRole, typeof ProjectMemberRole.owner>;
};

@Injectable()
export class ProjectsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.project.findMany({
      where: {
        projectMembers: {
          some: { userId },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  findById(id: string) {
    return this.prisma.project.findUnique({
      where: { id },
    });
  }

  findByIdForMember(id: string, userId: string) {
    return this.prisma.project.findUnique({
      where: {
        id,
        projectMembers: {
          some: { userId },
        },
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

  findProjectMembers(projectId: string) {
    return this.prisma.projectMember.findMany({
      where: { projectId },
      select: {
        id: true,
        userId: true,
        role: true,
        createdAt: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  findUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
      },
    });
  }

  create(data: CreateProjectData) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Project を作成する。
      const project = await tx.project.create({
        data: data,
      });

      // 2. 作成者を owner の参加情報として登録する。
      await tx.projectMember.create({
        data: {
          projectId: project.id,
          userId: data.ownerId,
          role: ProjectMemberRole.owner,
        },
      });

      // 両方成功したら、作成した Project を返す。
      return project;
    });
  }

  createProjectMember(data: CreateProjectMemberData) {
    return this.prisma.$transaction(async (tx) => {
      // メンバーの保存まで Project 行をロックし、アーカイブとの競合を防ぐ。
      const [project] = await tx.$queryRaw<{ isArchived: boolean }[]>`
        SELECT is_archived AS "isArchived"
        FROM projects
        WHERE id = ${data.projectId}
        FOR UPDATE
      `;

      if (!project) {
        return { status: 'project_not_found' as const };
      }

      if (project.isArchived) {
        return { status: 'project_archived' as const };
      }

      const member = await tx.projectMember.create({
        data,
        select: {
          id: true,
          userId: true,
          role: true,
          createdAt: true,
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });

      return { status: 'created' as const, member };
    });
  }

  update(id: string, data: UpdateProjectData) {
    return this.prisma.project.update({
      where: { id },
      data,
    });
  }

  archive(id: string) {
    return this.prisma.project.update({
      where: { id },
      data: {
        isArchived: true,
      },
    });
  }

  unarchive(id: string) {
    return this.prisma.project.update({
      where: { id },
      data: {
        isArchived: false,
      },
    });
  }
}

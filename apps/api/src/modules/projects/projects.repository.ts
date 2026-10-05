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

@Injectable()
export class ProjectsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.project.findMany({
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

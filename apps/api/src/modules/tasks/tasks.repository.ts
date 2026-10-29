import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

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
}

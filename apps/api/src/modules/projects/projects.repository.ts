import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

type CreateProjectData = {
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
    return this.prisma.project.create({
      data,
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

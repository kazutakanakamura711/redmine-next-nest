import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

type CreateProjectData = {
  name: string;
  key: string;
  description?: string;
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

  create(data: CreateProjectData) {
    return this.prisma.project.create({
      data,
    });
  }
}

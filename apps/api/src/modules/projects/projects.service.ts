import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { ProjectsRepository } from './projects.repository.js';

@Injectable()
export class ProjectsService {
  constructor(private readonly projectsRepository: ProjectsRepository) {}

  async findAll() {
    return await this.projectsRepository.findAll();
  }

  async findOne(id: string) {
    const project = await this.projectsRepository.findById(id);

    if (!project) {
      throw new NotFoundException('プロジェクトが見つかりません');
    }

    return project;
  }

  async create(dto: CreateProjectDto) {
    try {
      return await this.projectsRepository.create({
        name: dto.name,
        key: dto.key.toUpperCase(),
        description: dto.description,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('プロジェクトキーは既に使用されています');
      }

      throw error;
    }
  }
}

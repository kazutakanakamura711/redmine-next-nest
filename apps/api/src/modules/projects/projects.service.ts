import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { ProjectsRepository } from './projects.repository.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';

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
        name: dto.name.trim(),
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

  async update(id: string, dto: UpdateProjectDto) {
    // PATCH の本文が {} の場合は、更新内容がないので拒否する
    if (dto.name === undefined && dto.description === undefined) {
      throw new BadRequestException('更新する項目を指定してください');
    }

    // 存在しないプロジェクトなら 404 を返す
    await this.findOne(id);

    return await this.projectsRepository.update(id, {
      // undefined の項目は更新データに含めない
      ...(dto.name !== undefined && {
        name: dto.name.trim(),
      }),

      // 空文字・null は「説明なし」を表す null に統一する
      ...(dto.description !== undefined && {
        description: dto.description?.trim() || null,
      }),
    });
  }

  async archive(id: string) {
    // 存在しないプロジェクトなら 404 を返す
    await this.findOne(id);

    return await this.projectsRepository.archive(id);
  }

  async unarchive(id: string) {
    // 存在しないプロジェクトなら 404 を返す
    await this.findOne(id);

    return await this.projectsRepository.unarchive(id);
  }
}

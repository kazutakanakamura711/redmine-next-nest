import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { ProjectMemberRole } from '../../generated/prisma/enums.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { ProjectsRepository } from './projects.repository.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';

@Injectable()
export class ProjectsService {
  constructor(private readonly projectsRepository: ProjectsRepository) {}

  async findAll(userId: string) {
    return await this.projectsRepository.findAll(userId);
  }

  async findOne(id: string) {
    const project = await this.projectsRepository.findById(id);

    if (!project) {
      throw new NotFoundException('プロジェクトが見つかりません');
    }

    return project;
  }

  async findOneForMember(id: string, userId: string) {
    const project = await this.projectsRepository.findByIdForMember(id, userId);

    if (!project) {
      throw new NotFoundException('プロジェクトが見つかりません');
    }

    return project;
  }

  async findProjectMembers(projectId: string, userId: string) {
    const projectMember = await this.projectsRepository.findProjectMember(
      projectId,
      userId,
    );

    // 参加情報がなければ404を返す。
    if (!projectMember) {
      throw new NotFoundException('プロジェクトが見つかりません');
    }
    // role が owner 以外なら403を返す。
    if (projectMember.role !== ProjectMemberRole.owner) {
      throw new ForbiddenException(
        'プロジェクトのメンバー一覧を取得する権限がありません',
      );
    }

    return await this.projectsRepository.findProjectMembers(projectId);
  }

  async create(dto: CreateProjectDto, ownerId: string) {
    try {
      return await this.projectsRepository.create({
        ownerId,
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

  async update(id: string, dto: UpdateProjectDto, userId: string) {
    const projectMember = await this.projectsRepository.findProjectMember(
      id,
      userId,
    );

    // 参加情報がなければ404を返す。
    if (!projectMember) {
      throw new NotFoundException('プロジェクトが見つかりません');
    }
    // role が owner 以外なら403を返す。
    if (projectMember.role !== ProjectMemberRole.owner) {
      throw new ForbiddenException('プロジェクトを更新する権限がありません');
    }

    // PATCH の本文が {} の場合は、更新内容がないので拒否する
    if (dto.name === undefined && dto.description === undefined) {
      throw new BadRequestException('更新する項目を指定してください');
    }

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

  async archive(id: string, userId: string) {
    const projectMember = await this.projectsRepository.findProjectMember(
      id,
      userId,
    );

    // 参加情報がなければ404を返す。
    if (!projectMember) {
      throw new NotFoundException('プロジェクトが見つかりません');
    }
    // role が owner 以外なら403を返す。
    if (projectMember.role !== ProjectMemberRole.owner) {
      throw new ForbiddenException(
        'プロジェクトをアーカイブする権限がありません',
      );
    }

    return await this.projectsRepository.archive(id);
  }

  async unarchive(id: string, userId: string) {
    const projectMember = await this.projectsRepository.findProjectMember(
      id,
      userId,
    );

    // 参加情報がなければ404を返す。
    if (!projectMember) {
      throw new NotFoundException('プロジェクトが見つかりません');
    }
    // role が owner 以外なら403を返す。
    if (projectMember.role !== ProjectMemberRole.owner) {
      throw new ForbiddenException(
        'プロジェクトのアーカイブを解除する権限がありません',
      );
    }

    return await this.projectsRepository.unarchive(id);
  }
}

import { TasksRepository } from './tasks.repository.js';
import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class TasksService {
  constructor(private readonly tasksRepository: TasksRepository) {}

  async findAll(projectId: string, userId: string) {
    const projectMember = await this.tasksRepository.findProjectMember(
      projectId,
      userId,
    );

    if (!projectMember) {
      throw new NotFoundException('プロジェクトが見つかりません');
    }

    return await this.tasksRepository.findAll(projectId);
  }
}

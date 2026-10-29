import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { TasksService } from './tasks.service.js';
import { type AuthenticatedRequest, AuthGuard } from '../auth/auth.guard.js';
import { TaskResponseDto } from './dto/task-response.dto.js';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

@ApiTags('Tasks')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Bearer token がない、形式が不正、または token が無効',
})
@ApiForbiddenResponse({
  description: 'メールアドレスが未設定または未確認',
})
@Controller('projects/:projectId/tasks')
export class TaskController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: '参加しているプロジェクトのタスク一覧を取得する',
  })
  @ApiParam({
    name: 'projectId',
    description: 'タスクを取得するプロジェクトの ID',
    example: 'cmua3r1ik00032ed8lasbg1jj',
  })
  @ApiOkResponse({
    description:
      'owner・member・viewer に対象プロジェクトのタスクを作成日時の新しい順、同日時はIDの降順で返す。アーカイブ済みも閲覧でき、タスクがない場合は空配列を返す',
    type: TaskResponseDto,
    isArray: true,
  })
  @ApiNotFoundResponse({
    description: '指定したプロジェクトが存在しない、または参加していない',
  })
  async findAll(
    @Param('projectId') projectId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<TaskResponseDto[]> {
    const tasks = await this.tasksService.findAll(projectId, request.user.id);

    return tasks.map((task) => ({
      id: task.id,
      projectId: task.projectId,
      number: task.number,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      assignee: task.assignee,
      reporter: task.reporter,
      startDate: task.startDate?.toISOString().slice(0, 10) ?? null, // ISO文字列から 2026-10-26 の部分を取り出す
      dueDate: task.dueDate?.toISOString().slice(0, 10) ?? null, // ISO文字列から 2026-10-26 の部分を取り出す
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    }));
  }

  @Get(':taskId')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: '参加しているプロジェクトのタスク詳細を取得する',
  })
  @ApiParam({
    name: 'projectId',
    description: 'タスクが所属するプロジェクトの ID',
  })
  @ApiParam({
    name: 'taskId',
    description: '取得するタスクの ID',
  })
  @ApiOkResponse({
    description:
      'owner・member・viewer に対象プロジェクトのタスクを1件返す。アーカイブ済みも閲覧できる',
    type: TaskResponseDto,
  })
  @ApiNotFoundResponse({
    description:
      'プロジェクトが存在しない、参加していない、または指定したプロジェクト内にタスクが存在しない',
  })
  async findOne(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<TaskResponseDto> {
    const task = await this.tasksService.findOne(
      projectId,
      taskId,
      request.user.id,
    );

    return {
      id: task.id,
      projectId: task.projectId,
      number: task.number,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      assignee: task.assignee,
      reporter: task.reporter,
      startDate: task.startDate?.toISOString().slice(0, 10) ?? null, // ISO文字列から 2026-10-26 の部分を取り出す
      dueDate: task.dueDate?.toISOString().slice(0, 10) ?? null, // ISO文字列から 2026-10-26 の部分を取り出す
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }
}

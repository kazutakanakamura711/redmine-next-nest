import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ProjectsService } from './projects.service.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { ProjectResponseDto } from './dto/project-response.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';

@ApiTags('Projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'プロジェクト一覧を取得する' })
  @ApiOkResponse({
    description: 'プロジェクト一覧を作成日時の新しい順で返す',
    type: ProjectResponseDto,
    isArray: true,
  })
  findAll() {
    return this.projectsService.findAll();
  }

  @Get(':projectId')
  @ApiOperation({ summary: 'プロジェクト詳細を取得する' })
  @ApiParam({
    name: 'projectId',
    description: '取得するプロジェクトの ID',
    example: 'cmua3r1ik00032ed8lasbg1jj',
  })
  @ApiOkResponse({
    description: 'プロジェクト詳細を返す',
    type: ProjectResponseDto,
  })
  @ApiNotFoundResponse({ description: '指定したプロジェクトが存在しない' })
  findOne(@Param('projectId') projectId: string) {
    return this.projectsService.findOne(projectId);
  }

  @Post()
  @ApiOperation({ summary: 'プロジェクトを作成する' })
  @ApiCreatedResponse({
    description: 'プロジェクトを作成して返す',
    type: ProjectResponseDto,
  })
  @ApiBadRequestResponse({ description: 'リクエスト本文が不正' })
  @ApiConflictResponse({
    description: 'プロジェクトキーがすでに使用されている',
  })
  create(@Body() dto: CreateProjectDto) {
    return this.projectsService.create(dto);
  }

  @Patch(':projectId')
  @ApiOperation({ summary: 'プロジェクトを更新する' })
  @ApiParam({
    name: 'projectId',
    description: '更新するプロジェクトの ID',
  })
  @ApiOkResponse({
    description: 'プロジェクトを更新して返す',
    type: ProjectResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'リクエスト本文が不正、または更新項目が指定されていない',
  })
  @ApiNotFoundResponse({
    description: '指定したプロジェクトが存在しない',
  })
  update(@Param('projectId') projectId: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(projectId, dto);
  }

  @Post(':projectId/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'プロジェクトをアーカイブする' })
  @ApiParam({
    name: 'projectId',
    description: 'アーカイブするプロジェクトの ID',
  })
  @ApiOkResponse({
    description: 'プロジェクトをアーカイブして返す',
    type: ProjectResponseDto,
  })
  @ApiNotFoundResponse({
    description: '指定したプロジェクトが存在しない',
  })
  archive(@Param('projectId') projectId: string) {
    return this.projectsService.archive(projectId);
  }

  @Post(':projectId/unarchive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'プロジェクトのアーカイブを解除する' })
  @ApiParam({
    name: 'projectId',
    description: 'アーカイブを解除するプロジェクトの ID',
  })
  @ApiOkResponse({
    description: 'プロジェクトのアーカイブを解除して返す',
    type: ProjectResponseDto,
  })
  @ApiNotFoundResponse({
    description: '指定したプロジェクトが存在しない',
  })
  unarchive(@Param('projectId') projectId: string) {
    return this.projectsService.unarchive(projectId);
  }
}

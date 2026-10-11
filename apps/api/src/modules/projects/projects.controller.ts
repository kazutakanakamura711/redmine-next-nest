import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
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
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { ProjectsService } from './projects.service.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { ProjectResponseDto } from './dto/project-response.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';
import { type AuthenticatedRequest, AuthGuard } from '../auth/auth.guard.js';
import { ProjectMemberResponseDto } from './dto/project-member-response.dto.js';

@ApiTags('Projects')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Bearer token がない、形式が不正、または token が無効',
})
@ApiForbiddenResponse({
  description: 'メールアドレスが未設定または未確認',
})
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: '参加しているプロジェクト一覧を取得する' })
  @ApiOkResponse({
    description:
      '参加しているプロジェクトを作成日時の新しい順で返す。アーカイブ済みも含み、参加していなければ空配列を返す',
    type: ProjectResponseDto,
    isArray: true,
  })
  findAll(@Req() request: AuthenticatedRequest) {
    return this.projectsService.findAll(request.user.id);
  }

  @Get(':projectId')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: '参加しているプロジェクト詳細を取得する' })
  @ApiParam({
    name: 'projectId',
    description: '取得するプロジェクトの ID',
    example: 'cmua3r1ik00032ed8lasbg1jj',
  })
  @ApiOkResponse({
    description: 'プロジェクト詳細を返す',
    type: ProjectResponseDto,
  })
  @ApiNotFoundResponse({
    description: '指定したプロジェクトが存在しない、または参加していない',
  })
  findOneForMember(
    @Param('projectId') projectId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.projectsService.findOneForMember(projectId, request.user.id);
  }

  @Get(':projectId/members')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'プロジェクトのメンバー一覧を取得する（owner のみ）',
  })
  @ApiParam({
    name: 'projectId',
    description: '取得するプロジェクトの ID',
  })
  @ApiOkResponse({
    description: 'プロジェクトのメンバー一覧を返す',
    type: ProjectMemberResponseDto,
    isArray: true,
  })
  @ApiForbiddenResponse({
    description:
      'メールアドレスが未設定・未確認、または参加者の role が owner 以外',
  })
  @ApiNotFoundResponse({
    description: '指定したプロジェクトが存在しない、または参加していない',
  })
  findProjectMembers(
    @Param('projectId') projectId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.projectsService.findProjectMembers(projectId, request.user.id);
  }

  @Post()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'プロジェクトを作成する' })
  @ApiCreatedResponse({
    description: 'プロジェクトを作成して返す',
    type: ProjectResponseDto,
  })
  @ApiBadRequestResponse({ description: 'リクエスト本文が不正' })
  @ApiConflictResponse({
    description: 'プロジェクトキーがすでに使用されている',
  })
  create(@Body() dto: CreateProjectDto, @Req() request: AuthenticatedRequest) {
    return this.projectsService.create(dto, request.user.id);
  }

  @Patch(':projectId')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'プロジェクトを更新する（owner のみ）' })
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
  @ApiForbiddenResponse({
    description:
      'メールアドレスが未設定・未確認、または参加者の role が owner 以外',
  })
  @ApiNotFoundResponse({
    description: '指定したプロジェクトが存在しない、または参加していない',
  })
  update(
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.projectsService.update(projectId, dto, request.user.id);
  }

  @Post(':projectId/archive')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'プロジェクトをアーカイブする（owner のみ）' })
  @ApiParam({
    name: 'projectId',
    description: 'アーカイブするプロジェクトの ID',
  })
  @ApiOkResponse({
    description: 'プロジェクトをアーカイブして返す',
    type: ProjectResponseDto,
  })
  @ApiForbiddenResponse({
    description:
      'メールアドレスが未設定・未確認、または参加者の role が owner 以外',
  })
  @ApiNotFoundResponse({
    description: '指定したプロジェクトが存在しない、または参加していない',
  })
  archive(
    @Param('projectId') projectId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.projectsService.archive(projectId, request.user.id);
  }

  @Post(':projectId/unarchive')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'プロジェクトのアーカイブを解除する（owner のみ）',
  })
  @ApiParam({
    name: 'projectId',
    description: 'アーカイブを解除するプロジェクトの ID',
  })
  @ApiOkResponse({
    description: 'プロジェクトのアーカイブを解除して返す',
    type: ProjectResponseDto,
  })
  @ApiForbiddenResponse({
    description:
      'メールアドレスが未設定・未確認、または参加者の role が owner 以外',
  })
  @ApiNotFoundResponse({
    description: '指定したプロジェクトが存在しない、または参加していない',
  })
  unarchive(
    @Param('projectId') projectId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.projectsService.unarchive(projectId, request.user.id);
  }
}

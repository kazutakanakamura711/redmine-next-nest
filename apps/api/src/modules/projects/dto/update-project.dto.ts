import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  MaxLength,
  IsOptional,
  IsNotEmpty,
  ValidateIf,
} from 'class-validator';

export class UpdateProjectDto {
  // name: 必須、1〜100文字
  @ApiPropertyOptional({
    description: 'プロジェクト名',
    example: 'Task Management App',
    minLength: 1,
    maxLength: 100,
  })
  // name: 指定する場合は1〜100文字、空文字・nullは不可
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  // description: 任意、最大2,000文字
  @ApiPropertyOptional({
    type: String,
    description: 'プロジェクトの概要・目的',
    example: 'Redmine Next Nest の開発プロジェクト',
    maxLength: 2000,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;
}

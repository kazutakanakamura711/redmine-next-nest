import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  Matches,
} from 'class-validator';

export class CreateProjectDto {
  // name: 必須、1〜100文字
  @ApiProperty({
    description: 'プロジェクト名',
    example: 'Task Management App',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  // key: 必須、英数字1〜20文字 英字大文字、小文字、数字のみ
  @ApiProperty({
    description: 'タスク番号のプレフィックスとなるプロジェクトキー',
    example: 'APP',
    minLength: 1,
    maxLength: 20,
    pattern: '^[A-Za-z0-9]+$',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(/^[A-Za-z0-9]+$/)
  key: string;

  // description: 任意、最大2,000文字
  @ApiPropertyOptional({
    description: 'プロジェクトの概要・目的',
    example: 'Redmine Next Nest の開発プロジェクト',
    maxLength: 2000,
  })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;
}

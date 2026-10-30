import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Validate,
  ValidateIf,
  type ValidationArguments,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { TaskPriority, TaskStatus } from '../../../generated/prisma/enums.js';

@ValidatorConstraint({ name: 'isTaskDate', async: false })
class TaskDateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    if (
      typeof value !== 'string' ||
      !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
      return false;
    }
    // ISO表記のままUTCで比較し、2月30日などの日付の繰り上がりも拒否する。
    const date = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  }

  defaultMessage({ property }: ValidationArguments) {
    return `${property}は実在する日付をYYYY-MM-DD形式で指定してください`;
  }
}

export class CreateTaskDto {
  @ApiProperty({
    description: '前後の空白を除いた後、1〜200文字',
    minLength: 1,
    maxLength: 200,
    example: 'ログイン画面を作る',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({
    type: String,
    description: '詳細説明。前後の空白を除き、空文字・null・省略は説明なし',
    maxLength: 5000,
    nullable: true,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiPropertyOptional({ enum: TaskStatus, default: TaskStatus.todo })
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: TaskPriority, default: TaskPriority.normal })
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({
    type: String,
    description: '同じProjectの参加者のUser ID。null・省略は未担当',
    format: 'uuid',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;

  @ApiPropertyOptional({
    type: String,
    description: '開始日。時刻のないYYYY-MM-DD。null・省略は未設定',
    format: 'date',
    example: '2026-10-30',
    nullable: true,
  })
  @IsOptional()
  @Validate(TaskDateConstraint)
  startDate?: string | null;

  @ApiPropertyOptional({
    type: String,
    description: '期限。時刻のないYYYY-MM-DD。開始日より前にはできない',
    format: 'date',
    example: '2026-11-02',
    nullable: true,
  })
  @IsOptional()
  @Validate(TaskDateConstraint)
  dueDate?: string | null;
}

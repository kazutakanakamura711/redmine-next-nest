import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  Matches,
} from 'class-validator';

export class CreateProjectDto {
  // name: 必須、1〜100文字
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  // key: 必須、英数字1〜20文字 英字大文字、小文字、数字のみ
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(/^[A-Za-z0-9]+$/)
  key: string;

  // description: 任意、最大2,000文字
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;
}

import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module.js';
import { PrismaModule } from './modules/prisma/prisma.module.js';
import { ProjectsModule } from './modules/projects/projects.module.js';

@Module({
  imports: [HealthModule, PrismaModule, ProjectsModule],
})
export class AppModule {}

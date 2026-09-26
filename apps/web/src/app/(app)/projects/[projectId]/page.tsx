import { notFound } from 'next/navigation';
import { getProject } from '../_lib/get-project';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import { ProjectDetailTabs } from './_components/project-detail-tabs';

type ProjectDetailPageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

export default async function ProjectDetailPage({
  params,
}: ProjectDetailPageProps) {
  const { projectId } = await params;
  const project = await getProject(projectId);

  if (!project) {
    notFound();
  }

  return (
    <>
      <header className="border-b border-border bg-background">
        <div className="flex min-h-23 items-center px-5 py-3 sm:px-6">
          <div>
            <Breadcrumb className="text-xs">
              <BreadcrumbList className="gap-1 text-xs">
                <BreadcrumbItem>
                  <BreadcrumbLink
                    render={<Link href="/projects" />}
                    className="hover:text-indigo-600"
                  >
                    プロジェクト一覧
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator>/</BreadcrumbSeparator>
                <BreadcrumbItem>
                  <BreadcrumbPage>{project.name}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <h1 className="mt-1 text-lg font-semibold tracking-tight">
              {project.name}
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {project.key}
            </p>
          </div>
        </div>
      </header>

      {project.isArchived && (
        <div
          role="status"
          className="flex items-center gap-2 border-b border-amber-300 bg-amber-50 px-5 py-3 text-sm text-amber-950 sm:px-6"
        >
          <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
          <p>
            このプロジェクトはアーカイブ済みです。タスクの作成・更新操作は無効化されています。
          </p>
        </div>
      )}

      <ProjectDetailTabs project={project} />
    </>
  );
}

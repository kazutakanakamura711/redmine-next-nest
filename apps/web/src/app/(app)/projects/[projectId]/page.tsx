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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClipboardList, Settings, Users } from 'lucide-react';

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

      <Tabs
        defaultValue="tasks"
        className="gap-0 border-b border-border bg-background"
      >
        <TabsList variant="line" className="h-11! gap-0 px-5 sm:px-6">
          <TabsTrigger
            value="tasks"
            className="h-11! flex-none rounded-none px-4 text-muted-foreground hover:text-indigo-600! data-active:border-b-2! data-active:border-b-indigo-600! data-active:text-indigo-600! after:opacity-0!"
          >
            <ClipboardList aria-hidden="true" />
            タスク
          </TabsTrigger>

          <TabsTrigger
            value="members"
            disabled
            title="メンバー画面は今後実装します。"
            className="h-11! flex-none rounded-none px-4 text-muted-foreground disabled:opacity-100"
          >
            <Users aria-hidden="true" />
            メンバー
          </TabsTrigger>

          <TabsTrigger
            value="settings"
            disabled
            title="設定画面は今後実装します。"
            className="h-11! flex-none rounded-none px-4 text-muted-foreground disabled:opacity-100"
          >
            <Settings aria-hidden="true" />
            設定
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </>
  );
}

import { notFound, redirect } from 'next/navigation';
import { getProject } from '@/app/(app)/projects/_lib/get-project';
import { ProjectRole } from '@/app/(app)/projects/_lib/project-role';
import { ProjectDetailHeader } from './_components/project-detail-header';
import {
  ProjectDetailTabs,
  ProjectTabs,
} from './_components/project-detail-tabs';
import { ProjectSettingsPanel } from './_components/project-settings-panel';

type ProjectDetailPageProps = {
  params: Promise<{
    projectId: string;
  }>;
  searchParams: Promise<{
    tab?: string | string[];
  }>;
};

export default async function ProjectDetailPage({
  params,
  searchParams,
}: ProjectDetailPageProps) {
  const { projectId } = await params;
  const project = await getProject(projectId);

  if (!project) {
    notFound();
  }

  const { tab } = await searchParams;
  const activeTab =
    tab === ProjectTabs.Setting ? ProjectTabs.Setting : ProjectTabs.Task;

  if (
    activeTab === ProjectTabs.Setting &&
    project.currentUserRole !== ProjectRole.Owner
  ) {
    redirect(`/projects/${encodeURIComponent(project.id)}`);
  }

  return (
    <>
      <ProjectDetailHeader
        name={project.name}
        projectKey={project.key}
        isArchived={project.isArchived}
      />
      <ProjectDetailTabs
        projectId={project.id}
        activeTab={activeTab}
        currentUserRole={project.currentUserRole}
      />
      {activeTab === ProjectTabs.Setting && (
        <div className="p-5 sm:p-6">
          <ProjectSettingsPanel project={project} />
        </div>
      )}
    </>
  );
}

import { notFound } from 'next/navigation';

import { getProject } from '../_lib/get-project';
import { ProjectDetailHeader } from '../_components/project-detail-header';
import {
  ProjectDetailTabs,
  ProjectTabs,
} from '../_components/project-detail-tabs';
import { TaskList } from './_components/tasks-list';
import { getTasks } from './_lib/get-tasks';

type ProjectTasksPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectTasksPage({
  params,
}: ProjectTasksPageProps) {
  const { projectId } = await params;
  const project = await getProject(projectId);

  if (!project) {
    notFound();
  }

  const tasks = await getTasks(project.id);

  // 空配列は取得成功。null は API の404なので、空状態とは区別する。
  if (tasks === null) {
    notFound();
  }

  return (
    <>
      <ProjectDetailHeader
        name={project.name}
        projectKey={project.key}
        isArchived={project.isArchived}
        currentUserRole={project.currentUserRole}
      />
      <ProjectDetailTabs
        projectId={project.id}
        activeTab={ProjectTabs.Task}
        currentUserRole={project.currentUserRole}
      />
      <TaskList tasks={tasks} projectKey={project.key} />
    </>
  );
}

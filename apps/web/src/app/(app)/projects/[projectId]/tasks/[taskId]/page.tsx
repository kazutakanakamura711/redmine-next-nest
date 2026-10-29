import { notFound } from 'next/navigation';

import { getProject } from '../../_lib/get-project';
import { TaskDetail } from './_components/task-detail';
import { getTask } from './_lib/get-task';

type TaskDetailPageProps = {
  params: Promise<{ projectId: string; taskId: string }>;
};

export default async function TaskDetailPage({ params }: TaskDetailPageProps) {
  const { projectId, taskId } = await params;
  const project = await getProject(projectId);

  if (project === null) {
    notFound();
  }

  const task = await getTask(project.id, taskId);

  if (task === null) {
    notFound();
  }

  return (
    <TaskDetail
      task={task}
      projectName={project.name}
      isArchived={project.isArchived}
    />
  );
}

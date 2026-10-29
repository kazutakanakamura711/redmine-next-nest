import type { TaskPriority } from './task-priority';
import type { TaskStatus } from './task-status';

export type Task = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  startDate: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
};

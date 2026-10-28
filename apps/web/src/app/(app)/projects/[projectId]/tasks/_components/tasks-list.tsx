import type { ReactNode } from 'react';
import { ClipboardList } from 'lucide-react';

import type { Task } from '@/app/(app)/projects/[projectId]/tasks/_lib/get-tasks';
import {
  TaskStatus,
  TaskStatusDisplayText,
} from '@/features/tasks/types/task-status';
import {
  TaskPriority,
  TaskPriorityDisplayText,
} from '@/features/tasks/types/task-priority';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate } from '@/lib/format-date';

type TasksListProps = {
  tasks: Task[];
  headerAction?: ReactNode;
};

const statusClassName = {
  [TaskStatus.Todo]: 'border-slate-200 bg-slate-100 text-slate-600',
  [TaskStatus.InProgress]: 'border-blue-200 bg-blue-50 text-blue-700',
  [TaskStatus.Done]: 'border-emerald-200 bg-emerald-50 text-emerald-700',
} satisfies Record<TaskStatus, string>;

const priorityClassName = {
  [TaskPriority.Low]: 'border-slate-200 bg-slate-50 text-slate-500',
  [TaskPriority.Normal]: 'border-blue-200 bg-blue-50 text-blue-700',
  [TaskPriority.High]: 'border-amber-200 bg-amber-50 text-amber-700',
} satisfies Record<TaskPriority, string>;

function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <Badge
      variant="outline"
      className={`gap-1 rounded-sm px-1.5 text-xs ${statusClassName[status]}`}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {TaskStatusDisplayText[status]}
    </Badge>
  );
}

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <Badge
      variant="outline"
      className={`rounded-sm px-1.5 text-xs ${priorityClassName[priority]}`}
    >
      {TaskPriorityDisplayText[priority]}
    </Badge>
  );
}

function TaskDate({ value }: { value: string | null }) {
  return value ? (
    <time dateTime={value}>{formatDate(value)}</time>
  ) : (
    <span className="text-slate-400">—</span>
  );
}

export function TaskList({ tasks, headerAction }: TasksListProps) {
  return (
    <section
      aria-label="タスク一覧"
      className="min-w-0 overflow-hidden rounded-lg border border-border bg-background"
    >
      <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <h2 className="text-sm font-semibold">タスク</h2>
          <p className="mt-1 text-xs text-muted-foreground">{tasks.length}件</p>
        </div>
        {headerAction}
      </div>

      {tasks.length === 0 ? (
        <div className="px-4 py-14 text-center">
          <ClipboardList
            aria-hidden="true"
            className="mx-auto size-8 text-slate-400"
          />
          <p className="mt-3 text-sm text-muted-foreground">
            タスクはありません。
          </p>
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <Table aria-label="タスク一覧" className="table-fixed">
              <TableHeader>
                <TableRow className="border-border bg-slate-50 hover:bg-slate-50">
                  <TableHead className="px-4 text-xs text-slate-600">
                    タイトル
                  </TableHead>
                  <TableHead className="w-26 px-4 text-xs text-slate-600">
                    ステータス
                  </TableHead>
                  <TableHead className="w-20 px-4 text-xs text-slate-600">
                    優先度
                  </TableHead>
                  <TableHead className="w-26 px-4 text-xs text-slate-600">
                    開始日
                  </TableHead>
                  <TableHead className="w-26 px-4 text-xs text-slate-600">
                    期限
                  </TableHead>
                  <TableHead className="w-26 px-4 text-xs text-slate-600">
                    更新日
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={task.id} className="border-border">
                    <TableCell className="whitespace-normal px-4 py-4 font-medium leading-6 wrap-anywhere">
                      {task.title}
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <StatusBadge status={task.status} />
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <PriorityBadge priority={task.priority} />
                    </TableCell>
                    <TableCell className="px-4 py-4 text-xs text-slate-500">
                      <TaskDate value={task.startDate} />
                    </TableCell>
                    <TableCell className="px-4 py-4 text-xs text-slate-600">
                      <TaskDate value={task.dueDate} />
                    </TableCell>
                    <TableCell className="px-4 py-4 text-xs text-slate-500">
                      <TaskDate value={task.updatedAt} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul
            aria-label="タスク一覧（モバイル）"
            className="space-y-3 bg-slate-50 p-3 md:hidden"
          >
            {tasks.map((task) => (
              <li
                key={task.id}
                className="min-w-0 rounded border border-slate-200 bg-background p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 flex-1 text-sm font-medium leading-6 wrap-anywhere">
                    {task.title}
                  </h3>
                  <StatusBadge status={task.status} />
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <PriorityBadge priority={task.priority} />
                  <p className="text-xs text-slate-600">
                    期限 <TaskDate value={task.dueDate} />
                  </p>
                </div>
                <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-slate-500">
                  <div className="flex gap-1.5">
                    <dt>開始日</dt>
                    <dd>
                      <TaskDate value={task.startDate} />
                    </dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt>更新日</dt>
                    <dd>
                      <TaskDate value={task.updatedAt} />
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

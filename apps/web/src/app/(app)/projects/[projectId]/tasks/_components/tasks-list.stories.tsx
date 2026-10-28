import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import type { Task } from '../_lib/get-tasks';
import { TaskPriority } from '@/features/tasks/types/task-priority';
import { TaskStatus } from '@/features/tasks/types/task-status';
import { Button } from '@/components/ui/button';
import { TaskList } from './tasks-list';

const tasks: Task[] = [
  {
    id: 'task-1',
    projectId: 'project-1',
    title: 'ログイン機能を実装する',
    description: null,
    status: TaskStatus.InProgress,
    priority: TaskPriority.High,
    startDate: '2026-10-26',
    dueDate: '2026-10-30',
    createdAt: '2026-10-26T00:00:00.000Z',
    updatedAt: '2026-10-27T15:30:00.000Z',
  },
  {
    id: 'task-2',
    projectId: 'project-1',
    title: 'タスク一覧画面を作る',
    description: null,
    status: TaskStatus.Todo,
    priority: TaskPriority.Normal,
    startDate: null,
    dueDate: null,
    createdAt: '2026-10-26T00:00:00.000Z',
    updatedAt: '2026-10-27T00:00:00.000Z',
  },
  {
    id: 'task-3',
    projectId: 'project-1',
    title: 'Prisma スキーマを定義する',
    description: null,
    status: TaskStatus.Done,
    priority: TaskPriority.Low,
    startDate: '2026-10-24',
    dueDate: '2026-10-26',
    createdAt: '2026-10-24T00:00:00.000Z',
    updatedAt: '2026-10-26T00:00:00.000Z',
  },
];

const meta = {
  title: 'Projects/TaskList',
  component: TaskList,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
        <Story />
      </div>
    ),
  ],
  args: { tasks },
} satisfies Meta<typeof TaskList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { tasks: [] },
};

export const LongTitle: Story = {
  args: {
    tasks: [
      {
        ...tasks[0],
        title:
          'タスクのタイトルが長い場合も、ステータスや日付を隠さずに折り返して表示できることを確認する',
      },
      { ...tasks[1], title: 'LongTaskTitleWithoutSpaces'.repeat(8) },
    ],
  },
};

export const WithHeaderAction: Story = {
  parameters: {
    docs: { description: { story: '親から渡す操作の配置例です。' } },
  },
  args: {
    headerAction: <Button disabled>操作ボタン</Button>,
  },
};

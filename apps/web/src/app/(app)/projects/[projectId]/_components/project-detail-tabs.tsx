'use client';

import { useState } from 'react';
import { ClipboardList, Settings, Users } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Project } from '@/app/(app)/projects/_lib/get-projects';
import { ProjectUnarchive } from './project-unarchive';
import { ProjectArchive } from './project-archive';
import { ProjectSettingsForm } from './project-settings-form';

export const ProjectTabs = {
  Task: 'task',
  Member: 'member',
  Setting: 'setting',
} as const;

export type ProjectTab = (typeof ProjectTabs)[keyof typeof ProjectTabs];

export const ProjectTabsDisplayText = {
  [ProjectTabs.Task]: 'タスク',
  [ProjectTabs.Member]: 'メンバー',
  [ProjectTabs.Setting]: '設定',
} satisfies Record<ProjectTab, string>;

function isProjectTab(value: string | null): value is ProjectTab {
  return Object.values(ProjectTabs).some((tab) => tab === value);
}

type ProjectDetailTabsProps = {
  project: Project;
};

export function ProjectDetailTabs({ project }: ProjectDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<ProjectTab>(ProjectTabs.Task);

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => {
        if (isProjectTab(value)) {
          setActiveTab(value);
        }
      }}
      className="flex-col gap-0"
    >
      <div className="border-b border-border bg-background">
        <TabsList variant="line" className="h-11! gap-0 px-5 sm:px-6">
          <TabsTrigger
            value={ProjectTabs.Task}
            className="h-11! flex-none rounded-none px-4 text-muted-foreground hover:text-indigo-600! data-active:border-b-2! data-active:border-b-indigo-600! data-active:text-indigo-600! after:opacity-0!"
          >
            <ClipboardList aria-hidden="true" />
            {ProjectTabsDisplayText[ProjectTabs.Task]}
          </TabsTrigger>

          <TabsTrigger
            value={ProjectTabs.Member}
            disabled
            title="メンバー画面は今後実装します。"
            className="h-11! flex-none rounded-none px-4 text-muted-foreground disabled:opacity-100"
          >
            <Users aria-hidden="true" />
            {ProjectTabsDisplayText[ProjectTabs.Member]}
          </TabsTrigger>

          <TabsTrigger
            value={ProjectTabs.Setting}
            className="h-11! flex-none rounded-none px-4 text-muted-foreground hover:text-indigo-600! data-active:border-b-2! data-active:border-b-indigo-600! data-active:text-indigo-600! after:opacity-0!"
          >
            <Settings aria-hidden="true" />
            {ProjectTabsDisplayText[ProjectTabs.Setting]}
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value={ProjectTabs.Setting} className="m-0 p-5 sm:p-6">
        <ProjectSettingsForm
          projectId={project.id}
          initialName={project.name}
          projectKey={project.key}
          initialDescription={project.description}
        />
        {project.isArchived ? (
          <ProjectUnarchive
            projectId={project.id}
            onUnarchived={() => setActiveTab(ProjectTabs.Task)}
          />
        ) : (
          <ProjectArchive
            projectId={project.id}
            projectName={project.name}
            onArchived={() => setActiveTab(ProjectTabs.Task)}
          />
        )}
      </TabsContent>
    </Tabs>
  );
}

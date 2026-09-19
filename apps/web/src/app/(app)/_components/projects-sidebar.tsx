import { Archive, ChevronUp, ClipboardList, Folder } from 'lucide-react';

import type { Project } from '../projects/_lib/get-projects';

type ProjectsSidebarProps = {
  projects: Project[];
};

export function ProjectsSidebar({ projects }: ProjectsSidebarProps) {
  return (
    <aside className="hidden min-h-screen w-56 shrink-0 flex-col border-r border-border bg-background lg:flex">
      <div className="flex h-16 items-center gap-2 border-b border-border px-4">
        <div className="flex size-6 items-center justify-center rounded-md bg-indigo-600 text-white">
          <ClipboardList aria-hidden="true" className="size-4" />
        </div>
        <p className="text-sm font-semibold tracking-tight">Redmine Nest</p>
      </div>

      <nav aria-label="メインナビゲーション" className="flex-1 px-2 py-3">
        <div
          aria-current="page"
          className="flex h-8 items-center gap-2 rounded-md bg-indigo-50 px-3 text-sm font-medium text-indigo-700"
        >
          <Folder aria-hidden="true" className="size-4" />
          プロジェクト一覧
        </div>

        <p className="mt-4 px-2 text-xs font-medium text-muted-foreground">
          プロジェクト
        </p>
        <ul className="mt-2 space-y-1">
          {projects.map((project) => (
            <li
              key={project.id}
              className={project.isArchived ? 'opacity-50' : undefined}
            >
              <div className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-sm text-muted-foreground">
                <span
                  title={project.key}
                  className="w-10 shrink-0 truncate font-mono text-[11px] font-semibold text-indigo-500"
                >
                  {project.key}
                </span>
                <span className="min-w-0 flex-1 truncate">{project.name}</span>
                {project.isArchived ? (
                  <>
                    <Archive aria-hidden="true" className="ml-auto size-3.5" />
                    <span className="sr-only">アーカイブ済み</span>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-medium text-indigo-700">
            山
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">山田 太郎</p>
            <p className="truncate text-[11px] text-muted-foreground">
              yamada@example.com
            </p>
          </div>
          <ChevronUp
            aria-hidden="true"
            className="size-3.5 text-muted-foreground"
          />
        </div>
      </div>
    </aside>
  );
}

import { Suspense, type ReactNode } from 'react';

import { ProjectsSidebar } from './_components/projects-sidebar';
import { getProjects } from './projects/_lib/get-projects';

async function ProjectsSidebarContainer() {
  const projects = await getProjects().catch(() => []);

  return <ProjectsSidebar projects={projects} />;
}

function ProjectsSidebarFallback() {
  return (
    <aside
      aria-hidden="true"
      className="hidden min-h-screen w-56 shrink-0 border-r border-border bg-background lg:block"
    />
  );
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-foreground lg:flex">
      <Suspense fallback={<ProjectsSidebarFallback />}>
        <ProjectsSidebarContainer />
      </Suspense>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}

import { Suspense, type ReactNode } from 'react';

import { getCurrentUser } from '@/lib/auth/get-current-user';
import { createClient } from '@/lib/supabase/server';

import { ProjectsSidebar } from './_components/projects-sidebar';
import { getProjects } from './projects/_lib/get-projects';

async function ProjectsSidebarContainer() {
  // Cookie を参照できるサーバー用クライアントで、セッションを取得する。
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  if (error || !accessToken) {
    throw new Error('ログインセッションを取得できませんでした。');
  }

  // token は NestJS で検証する。セッション内の user をそのまま表示には使わない。
  const [projects, currentUser] = await Promise.all([
    getProjects().catch(() => []),
    getCurrentUser(accessToken),
  ]);

  return (
    <ProjectsSidebar
      projects={projects}
      userName={currentUser.name ?? 'ユーザー'}
      userEmail={currentUser.email}
    />
  );
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

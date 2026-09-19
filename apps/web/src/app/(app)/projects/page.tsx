import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

import { getProjects } from './_lib/get-projects';

function formatUpdatedAt(updatedAt: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Tokyo',
  }).format(new Date(updatedAt));
}

export default async function ProjectsPage() {
  const projects = await getProjects();

  return (
    <>
      <header className="border-b border-border bg-background">
        <div className="flex min-h-16 items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              プロジェクト一覧
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {projects.length}件のプロジェクト
            </p>
          </div>
          <Button
            disabled
            title="プロジェクト作成画面は次の機能として実装します。"
            className="bg-indigo-600 text-white hover:bg-indigo-700"
          >
            <Plus aria-hidden="true" />
            新規プロジェクト
          </Button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-5 py-6 sm:px-8">
        {projects.length === 0 ? (
          <section className="rounded-lg border border-dashed border-border bg-background px-6 py-14 text-center">
            <h2 className="font-medium">プロジェクトはまだありません</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              プロジェクト作成画面の実装後、ここから追加できます。
            </p>
          </section>
        ) : (
          <section className="overflow-hidden rounded-lg border border-border bg-background">
            <Table aria-label="プロジェクト一覧" className="min-w-190">
              <TableHeader>
                <TableRow className="border-border bg-slate-50 hover:bg-slate-50">
                  <TableHead className="w-20 px-4 text-xs text-muted-foreground">
                    KEY
                  </TableHead>
                  <TableHead className="min-w-80 px-4 text-xs text-muted-foreground">
                    プロジェクト名
                  </TableHead>
                  <TableHead className="w-28 px-4 text-xs text-muted-foreground">
                    自分の権限
                  </TableHead>
                  <TableHead className="w-20 px-4 text-xs text-muted-foreground">
                    タスク
                  </TableHead>
                  <TableHead className="w-28 px-4 text-xs text-muted-foreground">
                    更新日
                  </TableHead>
                  <TableHead className="w-28 px-4 text-xs text-muted-foreground">
                    状態
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow
                    key={project.id}
                    className={
                      project.isArchived
                        ? 'border-border opacity-50'
                        : 'border-border'
                    }
                  >
                    <TableCell className="px-4">
                      <Badge
                        variant="outline"
                        className={
                          project.isArchived
                            ? 'border-transparent bg-muted text-muted-foreground'
                            : 'border-transparent bg-indigo-50 font-semibold text-indigo-600'
                        }
                      >
                        {project.key}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-normal px-4 py-3">
                      <p className="font-medium">{project.name}</p>
                      <p className="mt-1 max-w-xl truncate text-sm text-muted-foreground">
                        {project.description ?? '説明はありません。'}
                      </p>
                    </TableCell>
                    <TableCell className="px-4 text-muted-foreground">
                      —
                    </TableCell>
                    <TableCell className="px-4 text-muted-foreground">
                      —
                    </TableCell>
                    <TableCell className="px-4 text-muted-foreground">
                      {formatUpdatedAt(project.updatedAt)}
                    </TableCell>
                    <TableCell className="px-4">
                      <Badge
                        variant="outline"
                        className={
                          project.isArchived
                            ? 'border-transparent bg-muted text-muted-foreground'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        }
                      >
                        {project.isArchived ? 'アーカイブ済み' : '進行中'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        )}
      </div>
    </>
  );
}

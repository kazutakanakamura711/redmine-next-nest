import { Skeleton } from '@/components/ui/skeleton';
import { ProjectDetailLoadingHeader } from '../_components/project-detail-loading-header';

export default function ProjectTasksLoading() {
  return (
    <div role="status">
      <span className="sr-only">タスク一覧を読み込んでいます</span>

      <div aria-hidden="true">
        <ProjectDetailLoadingHeader />

        {/* PCは行、モバイルはカードの形で表示する。 */}
        <div className="flex min-h-12 items-center justify-end border-b border-border bg-background px-3 py-2 sm:px-6">
          <Skeleton className="h-3 w-8" />
        </div>
        <div className="hidden h-10 items-center gap-6 border-b border-border bg-slate-50 px-4 md:flex">
          <Skeleton className="h-3 w-24 flex-1" />
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-3 w-20" />
          ))}
        </div>

        <div className="space-y-2 p-3 md:space-y-0 md:bg-background md:p-0">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="rounded-sm border border-border bg-background p-3 shadow-sm md:flex md:items-center md:gap-6 md:rounded-none md:border-x-0 md:border-t-0 md:p-4 md:shadow-none"
            >
              <div className="flex min-w-0 items-center justify-between gap-4 md:flex-1">
                <Skeleton className="h-4 w-full max-w-52" />
                <Skeleton className="h-5 w-16 shrink-0 rounded-sm" />
              </div>
              <div className="mt-2 flex items-center justify-between gap-4 md:mt-0 md:shrink-0">
                <Skeleton className="h-5 w-8 rounded-sm" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="hidden h-3 w-16 md:block" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

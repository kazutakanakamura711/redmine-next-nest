import { Skeleton } from '@/components/ui/skeleton';
import { ProjectDetailLoadingHeader } from '../_components/project-detail-loading-header';

export default function ProjectTasksLoading() {
  return (
    <div role="status">
      <span className="sr-only">タスク一覧を読み込んでいます</span>

      <div aria-hidden="true">
        <ProjectDetailLoadingHeader />

        {/* PCは行、モバイルはカードの形で表示する。 */}
        <div className="p-4 sm:p-6">
          <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-background">
            <div className="border-b border-border px-4 py-4 sm:px-5">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="mt-2 h-3 w-8" />
            </div>

            <div className="space-y-3 bg-slate-50 p-3 md:space-y-0 md:bg-background md:p-0">
              {Array.from({ length: 3 }, (_, index) => (
                <div
                  key={index}
                  className="rounded border border-border bg-background p-4 shadow-sm md:flex md:items-center md:gap-6 md:rounded-none md:border-x-0 md:border-t-0 md:shadow-none md:last:border-b-0"
                >
                  <div className="flex min-w-0 items-center justify-between gap-4 md:flex-1">
                    <Skeleton className="h-4 w-full max-w-52" />
                    <Skeleton className="h-5 w-16 shrink-0 rounded-sm" />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-4 md:mt-0 md:shrink-0">
                    <Skeleton className="h-5 w-8 rounded-sm" />
                    <Skeleton className="hidden h-3 w-16 md:block" />
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="hidden h-3 w-16 md:block" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 border-t border-border pt-3 md:hidden">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

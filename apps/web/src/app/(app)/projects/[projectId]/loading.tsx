import { Skeleton } from '@/components/ui/skeleton';

export default function ProjectLoading() {
  return (
    <div aria-busy="true">
      <header className="border-b border-border bg-background">
        <div className="flex min-h-23 items-center px-5 py-3 sm:px-6">
          <div>
            <Skeleton className="h-3 w-40" />
            <Skeleton className="mt-2 h-5 w-52" />
            <Skeleton className="mt-2 h-3 w-12" />
          </div>
        </div>
      </header>

      <div className="flex h-11 items-center gap-4 border-b border-border bg-background px-5 sm:px-6">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-14" />
      </div>

      <span role="status" className="sr-only">
        プロジェクト詳細を読み込んでいます
      </span>
    </div>
  );
}

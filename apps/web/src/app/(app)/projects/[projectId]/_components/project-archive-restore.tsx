import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function ProjectArchiveRestore() {
  return (
    <div className="px-5 pb-6 sm:px-6">
      <Card className="max-w-150 rounded-lg">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-base">アーカイブ済み</CardTitle>
        </CardHeader>

        <CardContent className="pt-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium">
                プロジェクトのアーカイブを解除
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                解除すると、タスクの作成・更新を再開できます。
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                アーカイブ解除は現在利用できません。
              </p>
            </div>

            <Button type="button" variant="outline" disabled>
              アーカイブを解除
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

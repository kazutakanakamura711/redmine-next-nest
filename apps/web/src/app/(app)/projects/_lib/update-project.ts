import { getErrorMessage, ProjectRequestError } from './api-error';

// NestJS の PATCH /projects/:projectId に送るリクエスト本文の形。
// key は作成後に変更できないため、含めない。
export type UpdateProjectInput = {
  name: string;
  description: string;
};

// プロジェクト更新 API を呼び出す。
// 成功時は何も返さず、失敗時は画面で扱えるエラーを投げる。
export async function updateProject(
  projectId: string,
  input: UpdateProjectInput,
): Promise<void> {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!apiBaseUrl) {
    throw new Error('NEXT_PUBLIC_API_BASE_URL が設定されていません。');
  }

  const response = await fetch(
    `${apiBaseUrl}/projects/${encodeURIComponent(projectId)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    },
  );

  if (response.ok) {
    return;
  }

  // JSON でないエラー本文や空の本文もあり得るため、解析に失敗したら null とする。
  const errorBody: unknown = await response.json().catch(() => null);

  // API が返した message を使い、取得できない場合は画面用の汎用メッセージを使う。
  throw new ProjectRequestError(
    getErrorMessage(errorBody) ?? 'プロジェクトの更新に失敗しました。',
    response.status,
  );
}

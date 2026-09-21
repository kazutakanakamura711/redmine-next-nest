import { connection } from 'next/server';
import type { Project } from './get-projects';

export async function getProject(projectId: string): Promise<Project | null> {
  // 詳細画面もリクエスト時に最新データを取得する。
  await connection();

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!apiBaseUrl) {
    throw new Error('NEXT_PUBLIC_API_BASE_URL が設定されていません。');
  }

  const response = await fetch(
    `${apiBaseUrl}/projects/${encodeURIComponent(projectId)}`,
    {
      cache: 'no-store',
    },
  );

  // 存在しない ID は、画面側で Next.js の notFound() を呼ぶため null で返す。
  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error('プロジェクト詳細の取得に失敗しました。');
  }

  return response.json();
}

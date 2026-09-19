import { connection } from 'next/server';

export type Project = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export async function getProjects(): Promise<Project[]> {
  // プロジェクト一覧は API の最新データを表示するため、ビルド時ではなくリクエスト時に取得する。
  await connection();

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!apiBaseUrl) {
    throw new Error('NEXT_PUBLIC_API_BASE_URL が設定されていません。');
  }

  const response = await fetch(`${apiBaseUrl}/projects`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('プロジェクト一覧の取得に失敗しました。');
  }

  return response.json();
}

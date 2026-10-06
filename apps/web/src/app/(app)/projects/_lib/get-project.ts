import { connection } from 'next/server';
import type { Project } from './get-projects';
import { createClient } from '@/lib/supabase/server';

export async function getProject(projectId: string): Promise<Project | null> {
  // 詳細画面もリクエスト時に最新データを取得する。
  await connection();

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!apiBaseUrl) {
    throw new Error('NEXT_PUBLIC_API_BASE_URL が設定されていません。');
  }

  // Cookie を扱えるサーバー用クライアントを作る。
  const supabase = await createClient();
  // 作ったクライアントを使い、Cookie に保存されたセッションを取得する。
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session) {
    throw new Error('ログインセッションを取得できませんでした。');
  }

  const accessToken = data.session.access_token;

  const response = await fetch(
    `${apiBaseUrl}/projects/${encodeURIComponent(projectId)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
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

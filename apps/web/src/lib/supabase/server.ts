import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { getSupabaseConfig } from './config';

// リクエストごとに作り、そのリクエストの Cookie だけを参照する。
export async function createClient() {
  const { url, publishableKey } = getSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          // Server Action / Route Handler では Cookie を保存できる。
          cookiesToSet.forEach(({ name, value, options }) =>
            // 配列の Cookie を1つずつ Next.js に設定する。
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Component は Cookie を書けないため、手前の Proxy に更新を任せる。
        }
      },
    },
  });
}

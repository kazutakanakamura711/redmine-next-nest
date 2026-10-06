import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { getSupabaseConfig } from './config';

export async function updateSession(request: NextRequest) {
  const { url, publishableKey } = getSupabaseConfig();
  const cacheHeaders = new Headers();
  const responseCookies: {
    name: string;
    value: string;
    options: CookieOptions;
  }[] = [];

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        // 後続の Server Component 用に更新し、ブラウザへ返す Cookie も集める。
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          responseCookies.push({ name, value, options });
        });

        // SDK が渡すキャッシュ制御は最初の setAll にだけ含まれるため、保持する。
        Object.entries(headers).forEach(([name, value]) =>
          cacheHeaders.set(name, value),
        );
      },
    },
  });

  // 署名・有効期限を確認し、必要なら SDK がセッションを更新する。
  // ログイン必須の判定と画面遷移は、ログイン画面を実装する段階で追加する。
  await supabase.auth.getClaims();

  // 更新後の request で一度だけ作り、ブラウザにも更新した Cookie を返す。
  const response = NextResponse.next({ request, headers: cacheHeaders });
  responseCookies.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options),
  );

  return response;
}

import { createClient } from 'npm:@supabase/supabase-js@2';

export function getAdminClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Supabase 서버 환경변수를 찾을 수 없습니다.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function getCallbackUrl() {
  const url = Deno.env.get('SUPABASE_URL');
  if (!url) throw new Error('SUPABASE_URL 환경변수를 찾을 수 없습니다.');
  return `${url}/functions/v1/google-drive-oauth-callback`;
}

export function getGoogleClientConfig() {
  const clientId = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET');
  if (!clientId || !clientSecret) throw new Error('Google Drive OAuth 비밀값이 등록되지 않았습니다.');
  return { clientId, clientSecret };
}

export async function requireWeddingAdmin(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('관리자 로그인 정보가 없습니다.');
  const supabase = getAdminClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) throw new Error('관리자 로그인 정보가 만료되었습니다.');
  const { data: admin, error: adminError } = await supabase.from('wedding_admins').select('user_id').eq('user_id', userData.user.id).maybeSingle();
  if (adminError || !admin) throw new Error('관리자 권한이 없습니다.');
  return { supabase, userId: userData.user.id };
}

export function makeOAuthState() {
  return `${crypto.randomUUID()}${crypto.randomUUID().replaceAll('-', '')}`;
}

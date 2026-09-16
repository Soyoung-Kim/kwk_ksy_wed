import { getAdminClient, getCallbackUrl, getGoogleClientConfig } from '../_shared/googleDrive.ts';

function page(message: string, success = false) {
  const signal = success ? '<script>window.opener?.postMessage({ type: "google-drive-connected" }, "https://soyoung-kim.github.io");</script>' : '';
  const safeMessage = message.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return new Response(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Google Drive 연결</title></head><body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#f8f4ef;font-family:sans-serif;color:#403832"><main style="max-width:360px;padding:32px;text-align:center;background:white;border-radius:20px"><h1 style="font-size:20px">${success ? '연결 완료' : '연결 실패'}</h1><p style="line-height:1.6">${safeMessage}</p><button onclick="window.close()" style="padding:10px 16px;border:0;border-radius:10px;background:#a78365;color:white">창 닫기</button></main>${signal}</body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff' } });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const state = url.searchParams.get('state') || '';
  const code = url.searchParams.get('code') || '';
  if (url.searchParams.get('error')) return page('Google Drive 권한 허용이 취소되었습니다.');
  if (!state || !code) return page('연결에 필요한 정보가 없습니다.');
  try {
    const supabase = getAdminClient();
    const { data: stateRow, error: stateError } = await supabase.from('wedding_google_drive_oauth_states').select('user_id').eq('state', state).gt('expires_at', new Date().toISOString()).maybeSingle();
    await supabase.from('wedding_google_drive_oauth_states').delete().eq('state', state);
    if (stateError || !stateRow) throw new Error('연결 요청이 만료되었거나 유효하지 않습니다.');
    const { clientId, clientSecret } = getGoogleClientConfig();
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: getCallbackUrl(), grant_type: 'authorization_code' }) });
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok || !tokens.refresh_token) throw new Error(tokens.error_description || 'Google 갱신 토큰을 받지 못했습니다.');
    const { error } = await supabase.from('wedding_google_drive_connections').upsert({ connection_key: 'primary', refresh_token: tokens.refresh_token, scope: tokens.scope || '', connected_by: stateRow.user_id, connected_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return page('Google Drive가 연결되었습니다. 이 창을 닫고 관리자 페이지로 돌아가세요.', true);
  } catch (error) { return page(error instanceof Error ? error.message : 'Google Drive 연결에 실패했습니다.'); }
});

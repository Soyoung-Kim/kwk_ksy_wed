import { json, methodNotAllowed, okOptions } from '../_shared/http.ts';
import { getCallbackUrl, getGoogleClientConfig, makeOAuthState, requireWeddingAdmin } from '../_shared/googleDrive.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return okOptions();
  if (req.method !== 'POST') return methodNotAllowed();
  try {
    const { supabase, userId } = await requireWeddingAdmin(req);
    const state = makeOAuthState();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error } = await supabase.from('wedding_google_drive_oauth_states').insert({ state, user_id: userId, expires_at: expiresAt });
    if (error) throw new Error(error.message);
    const { clientId } = getGoogleClientConfig();
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({ client_id: clientId, redirect_uri: getCallbackUrl(), response_type: 'code', scope: 'https://www.googleapis.com/auth/drive.file', access_type: 'offline', prompt: 'consent', state }).toString();
    return json({ success: true, url: url.toString() });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : 'Google Drive 연결을 시작하지 못했습니다.' }, { status: 400 });
  }
});

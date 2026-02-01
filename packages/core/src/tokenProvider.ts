import { loadAuthProfiles, saveAuthProfiles, withAuthLock, AuthProfile } from './authStore.js';

export const OPENAI_CODEX_PROFILE_ID = 'openai-codex:default';

const REFRESH_SKEW_MS = 5 * 60 * 1000;

async function refreshWithOAuth(refreshToken: string, clientId: string): Promise<{ access: string; refresh: string; expires: number; expiresIn?: number }> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  });

  const resp = await fetch('https://auth.openai.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await resp.json();
  if (!resp.ok) throw new Error(`TOKEN_REFRESH_FAILED:${json?.error_description || json?.error || resp.statusText}`);

  const expiresIn = json.expires_in ?? 3600;
  const expires = Date.now() + expiresIn * 1000;
  return {
    access: json.access_token,
    refresh: json.refresh_token ?? refreshToken,
    expires,
    expiresIn,
  };
}

export async function getValidAccessToken(params: { clientId: string }): Promise<string> {
  const { clientId } = params;

  return withAuthLock(async () => {
    const profiles = loadAuthProfiles();
    const p = profiles.profiles[OPENAI_CODEX_PROFILE_ID] as AuthProfile | undefined;
    if (!p) throw new Error('NOT_AUTHENTICATED');

    if (p.expires > Date.now() + REFRESH_SKEW_MS) return p.access;

    const refreshed = await refreshWithOAuth(p.refresh, clientId);
    profiles.profiles[OPENAI_CODEX_PROFILE_ID] = {
      ...p,
      access: refreshed.access,
      refresh: refreshed.refresh,
      expires: refreshed.expires,
    };
    saveAuthProfiles(profiles);
    return refreshed.access;
  });
}

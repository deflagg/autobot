import { createServer } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { loadOAuthTokens, saveOAuthTokens, isRefreshable, isExpired } from '@autobot/core';

const BUILTIN_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const DEFAULTS = {
  authorizeUrl: 'https://auth.openai.com/oauth/authorize',
  tokenUrl: 'https://auth.openai.com/oauth/token',
  redirectHost: '127.0.0.1',
  redirectPort: 1455,
  redirectPath: '/auth/callback',
  scopes: 'openid profile email offline_access',
};
const EXTRA_AUTH_PARAMS = {
  id_token_add_organizations: 'true',
  codex_cli_simplified_flow: 'true',
};

type ProviderEvents = {
  onLoginComplete?: () => void;
};

function base64url(input: Buffer) {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function generatePKCE() {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge, method: 'S256' as const };
}

function generateState() {
  return base64url(randomBytes(16));
}

function getConfig(cfg: any) {
  const oauth = cfg?.oauth ?? {};
  return {
    authorizeUrl: oauth.authorizeUrl || DEFAULTS.authorizeUrl,
    tokenUrl: oauth.tokenUrl || DEFAULTS.tokenUrl,
    redirectHost: oauth.redirectHost || DEFAULTS.redirectHost,
    redirectPort: oauth.redirectPort || DEFAULTS.redirectPort,
    redirectPath: oauth.redirectPath || DEFAULTS.redirectPath,
    scopes: oauth.scopes || DEFAULTS.scopes,
    clientId: oauth.clientId || BUILTIN_CLIENT_ID,
  };
}

type PendingSession = {
  state: string;
  pkceVerifier: string;
  redirectUri: string;
  tokenUrl: string;
  clientId: string;
  createdAt: number;
  expiresAt: number;
  server?: ReturnType<typeof createServer>;
};

let pending: PendingSession | null = null;

function withExpiry(payload: any) {
  const obtainedAt = payload.obtained_at ?? Date.now();
  const expiresIn = payload.expires_in;
  const expiresAt = typeof expiresIn === 'number' ? obtainedAt + expiresIn * 1000 : undefined;
  return { ...payload, obtained_at: obtainedAt, expires_at: expiresAt };
}

async function exchangeCodeForTokens(params: { tokenUrl: string; clientId: string; code: string; verifier: string; redirectUri: string }) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: params.clientId,
    code_verifier: params.verifier,
  });

  const resp = await fetch(params.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const json = await resp.json();
  if (!resp.ok) throw new Error('Token exchange failed');
  return json;
}

async function refreshTokens(params: { tokenUrl: string; clientId: string; refreshToken: string }) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: params.refreshToken,
    client_id: params.clientId,
  });

  const resp = await fetch(params.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const json = await resp.json();
  if (!resp.ok) throw new Error('Token refresh failed');
  return json;
}

function buildAuthorizeUrl(cfg: ReturnType<typeof getConfig>, state: string, pkce: { challenge: string; method: 'S256' }, redirectUri: string) {
  const url = new URL(cfg.authorizeUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', cfg.clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', cfg.scopes);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', pkce.challenge);
  url.searchParams.set('code_challenge_method', pkce.method);
  Object.entries(EXTRA_AUTH_PARAMS).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}

export function createOpenAICodexOAuthProvider(cfg: any, events: ProviderEvents = {}) {
  return {
    id: 'openai-codex-oauth',
    async startLogin() {
      const c = getConfig(cfg);
      const redirectUri = `http://${c.redirectHost}:${c.redirectPort}${c.redirectPath}`;

      if (pending) {
        if (Date.now() > pending.expiresAt) {
          pending.server?.close();
          pending = null;
        } else {
          const authUrl = buildAuthorizeUrl(c, pending.state, { challenge: base64url(createHash('sha256').update(pending.pkceVerifier).digest()), method: 'S256' }, redirectUri);
          return { authUrl, callbackUrl: redirectUri, state: pending.state };
        }
      }

      const pkce = generatePKCE();
      const state = generateState();

      pending = {
        state,
        pkceVerifier: pkce.verifier,
        redirectUri,
        tokenUrl: c.tokenUrl,
        clientId: c.clientId,
        createdAt: Date.now(),
        expiresAt: Date.now() + 10 * 60 * 1000,
      };

      const server = createServer(async (req, res) => {
        if (!req.url) return;
        const url = new URL(req.url, redirectUri);
        if (url.pathname !== c.redirectPath) {
          res.writeHead(404).end();
          return;
        }

        const code = url.searchParams.get('code');
        const rstate = url.searchParams.get('state');
        if (!code || rstate !== state) {
          res.writeHead(400).end('Invalid state or missing code');
          return;
        }

        try {
          const json = await exchangeCodeForTokens({
            tokenUrl: c.tokenUrl,
            clientId: c.clientId,
            code,
            verifier: pkce.verifier,
            redirectUri,
          });

          saveOAuthTokens(
            withExpiry({
              access_token: json.access_token,
              refresh_token: json.refresh_token,
              expires_in: json.expires_in,
              token_type: json.token_type,
              scope: json.scope,
            })
          );

          res.writeHead(200).end('Login complete. You can close this tab.');
          events.onLoginComplete?.();
        } catch {
          res.writeHead(500).end('Token exchange error');
        } finally {
          pending = null;
          server.close();
        }
      });

      server.on('error', () => {
        // If bind fails, keep pending session for manual completion
      });

      server.listen(c.redirectPort, c.redirectHost);
      pending.server = server;

      const authUrl = buildAuthorizeUrl(c, state, { challenge: pkce.challenge, method: pkce.method }, redirectUri);
      return { authUrl, callbackUrl: redirectUri, state };
    },

    async completeLogin(input: { redirectUrl?: string; code?: string; state?: string }) {
      if (!pending) return { ok: false, error: 'No pending OAuth login' } as const;
      if (Date.now() > pending.expiresAt) {
        pending.server?.close();
        pending = null;
        return { ok: false, error: 'Login session expired. Start again.' } as const;
      }

      let code = input.code;
      let state = input.state;
      if (input.redirectUrl) {
        const url = new URL(input.redirectUrl);
        code = code || url.searchParams.get('code') || undefined;
        state = state || url.searchParams.get('state') || undefined;
      }

      if (!code || !state) return { ok: false, error: 'Missing code or state' } as const;
      if (state !== pending.state) return { ok: false, error: 'OAuth state mismatch' } as const;

      try {
        const json = await exchangeCodeForTokens({
          tokenUrl: pending.tokenUrl,
          clientId: pending.clientId,
          code,
          verifier: pending.pkceVerifier,
          redirectUri: pending.redirectUri,
        });

        saveOAuthTokens(
          withExpiry({
            access_token: json.access_token,
            refresh_token: json.refresh_token,
            expires_in: json.expires_in,
            token_type: json.token_type,
            scope: json.scope,
          })
        );

        pending.server?.close();
        pending = null;
        events.onLoginComplete?.();
        return { ok: true } as const;
      } catch (e: any) {
        return { ok: false, error: String(e?.message || e) } as const;
      }
    },

    async ensureValidToken() {
      const c = getConfig(cfg);
      const tokens = loadOAuthTokens();
      if (!tokens) throw new Error('No OAuth tokens configured');

      if (isExpired(tokens) && isRefreshable(tokens)) {
        const json = await refreshTokens({
          tokenUrl: c.tokenUrl,
          clientId: c.clientId,
          refreshToken: tokens.refresh_token as string,
        });

        const next = withExpiry({
          access_token: json.access_token,
          refresh_token: json.refresh_token ?? tokens.refresh_token,
          expires_in: json.expires_in,
          token_type: json.token_type,
          scope: json.scope ?? tokens.scope,
        });

        saveOAuthTokens(next);
        return { accessToken: next.access_token };
      }

      return { accessToken: tokens.access_token };
    },

    async getStatus() {
      const tokens: any = loadOAuthTokens();
      return {
        providerId: 'openai-codex-oauth',
        configured: !!tokens,
        refreshable: isRefreshable(tokens),
        expired: isExpired(tokens),
        expiresAt: tokens?.expires_at ?? null,
      };
    },
  };
}

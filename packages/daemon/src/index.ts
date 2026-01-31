import { WebSocketServer } from 'ws';
import { EnvelopeSchema, StatusGetSchema, AuthLoginStartSchema, AuthStatusGetSchema } from '@autobot/protocol';
import { loadConfig, loadOAuthTokens, saveOAuthTokens, isRefreshable } from '@autobot/core';
import { createServer } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';

const start = Date.now();

function base64url(input: Buffer) {
  return input
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function generatePKCE() {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge, method: 'S256' as const };
}

export function startDaemon() {
  const cfg = loadConfig();
  const wss = new WebSocketServer({ host: '127.0.0.1', port: cfg.ws.port });

  wss.on('connection', (ws: import('ws').WebSocket) => {
    let authed = false;

    ws.on('message', (data: import('ws').RawData) => {
      let msg: unknown;
      try {
        msg = JSON.parse(String(data));
      } catch {
        ws.send(JSON.stringify({ type: 'error', ok: false, error: { code: 'BAD_JSON', message: 'Invalid JSON' } }));
        return;
      }

      const envelope = EnvelopeSchema.safeParse(msg);
      if (!envelope.success) {
        ws.send(JSON.stringify({ type: 'error', ok: false, error: { code: 'BAD_ENVELOPE', message: 'Invalid envelope' } }));
        return;
      }

      if (envelope.data.type === 'auth') {
        const token = (envelope.data.payload as any)?.token;
        if (token && token === cfg.auth.token) {
          authed = true;
          ws.send(JSON.stringify({ id: envelope.data.id, type: 'auth.ok', ok: true }));
        } else {
          ws.send(JSON.stringify({ id: envelope.data.id, type: 'auth.error', ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } }));
        }
        return;
      }

      if (!authed) {
        ws.send(JSON.stringify({ id: envelope.data.id, type: 'error', ok: false, error: { code: 'AUTH_REQUIRED', message: 'Authenticate first' } }));
        return;
      }

      const statusGet = StatusGetSchema.safeParse(msg);
      if (statusGet.success) {
        ws.send(
          JSON.stringify({
            id: statusGet.data.id,
            type: 'status.result',
            ok: true,
            payload: { daemon: { pid: process.pid, uptimeMs: Date.now() - start } },
          })
        );
        return;
      }

      const authStatusGet = AuthStatusGetSchema.safeParse(msg);
      if (authStatusGet.success) {
        const tokens = loadOAuthTokens();
        ws.send(
          JSON.stringify({
            id: authStatusGet.data.id,
            type: 'auth.status.result',
            ok: true,
            payload: {
              provider: 'openai-codex',
              configured: !!tokens,
              refreshable: isRefreshable(tokens),
            },
          })
        );
        return;
      }

      const authLoginStart = AuthLoginStartSchema.safeParse(msg);
      if (authLoginStart.success) {
        const pkce = generatePKCE();
        const state = base64url(randomBytes(16));
        const redirectPort = cfg.oauth?.redirectPort ?? 7777;
        const callbackUrl = `http://127.0.0.1:${redirectPort}/oauth/callback`;
        const authorizeUrl = cfg.oauth?.authorizeUrl || 'https://auth.openai.com/authorize';
        const clientId = cfg.oauth?.clientId || '';

        // Start daemon-owned callback listener
        const server = createServer(async (req, res) => {
          if (!req.url) return;
          const url = new URL(req.url, callbackUrl);
          if (url.pathname !== '/oauth/callback') {
            res.writeHead(404).end();
            return;
          }

          const code = url.searchParams.get('code');
          const rstate = url.searchParams.get('state');
          if (!code || rstate !== state) {
            res.writeHead(400).end('Invalid state or missing code');
            return;
          }

          // Exchange code for tokens (real implementation depends on provider).
          try {
            const tokenUrl = cfg.oauth?.tokenUrl || 'https://auth.openai.com/token';
            const body = new URLSearchParams({
              grant_type: 'authorization_code',
              code,
              redirect_uri: callbackUrl,
              client_id: clientId,
              code_verifier: pkce.verifier,
            });

            const resp = await fetch(tokenUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body,
            });

            const json = await resp.json();
            if (!resp.ok) {
              res.writeHead(500).end('Token exchange failed');
              return;
            }

            saveOAuthTokens({
              access_token: json.access_token,
              refresh_token: json.refresh_token,
              expires_in: json.expires_in,
              token_type: json.token_type,
              scope: json.scope,
            });

            res.writeHead(200).end('Login complete. You can return to the CLI.');
          } catch (e) {
            res.writeHead(500).end('Token exchange error');
          } finally {
            server.close();
          }
        });

        server.listen(redirectPort, '127.0.0.1');

        const authUrl = new URL(authorizeUrl);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('redirect_uri', callbackUrl);
        authUrl.searchParams.set('scope', 'openid');
        authUrl.searchParams.set('state', state);
        authUrl.searchParams.set('code_challenge', pkce.challenge);
        authUrl.searchParams.set('code_challenge_method', pkce.method);

        ws.send(
          JSON.stringify({
            id: authLoginStart.data.id,
            type: 'auth.login.started',
            ok: true,
            payload: {
              authUrl: authUrl.toString(),
              callbackUrl,
              state,
              pkce: { method: pkce.method },
            },
          })
        );
        return;
      }

      ws.send(JSON.stringify({
        id: envelope.data.id,
        type: 'error',
        ok: false,
        error: { code: 'UNKNOWN_TYPE', message: `Unknown type: ${envelope.data.type}` },
      }));
    });
  });

  return wss;
}

if (process.argv.includes('--run')) {
  startDaemon();
  console.log('autobot daemon listening');
}

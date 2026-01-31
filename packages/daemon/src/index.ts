import { WebSocketServer } from 'ws';
import { EnvelopeSchema, StatusGetSchema } from '@autobot/protocol';
import { loadConfig } from '@autobot/core';

const start = Date.now();

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

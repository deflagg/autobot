#!/usr/bin/env node
import WebSocket from 'ws';
import { loadConfig } from '@autobot/core';
import { execSync } from 'node:child_process';
import { createInterface } from 'node:readline';

const cfg = loadConfig();
const url = `ws://127.0.0.1:${cfg.ws.port}`;
const args = process.argv.slice(2);

function getProviderId(argv: string[]) {
  const idx = argv.findIndex((arg) => arg === '--provider' || arg === '-p');
  if (idx !== -1 && argv[idx + 1]) return argv[idx + 1];
  return undefined;
}

function send(ws: WebSocket, msg: any) {
  ws.send(JSON.stringify(msg));
}

function openUrl(url: string) {
  try {
    execSync(`xdg-open "${url}"`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function systemctl(cmd: string) {
  execSync(`systemctl --user ${cmd} autobot`, { stdio: 'inherit' });
}

if (args[0] === 'daemon' || args[0] === 'service') {
  const action = args[1];
  if (!action) {
    console.error('Usage: autobot daemon <start|stop|restart|status|logs>');
    process.exit(1);
  }
  if (action === 'logs') {
    execSync('journalctl --user -u autobot -f --no-pager', { stdio: 'inherit' });
    process.exit(0);
  }
  systemctl(action);
  process.exit(0);
}

const ws = new WebSocket(url);
const id = String(Date.now());
let chatCounter = 0;
const chatMode = args[0] === 'chat';
const askApply = chatMode && args.includes('--ask');
const autoApply = chatMode && !askApply; // default: auto-apply

ws.on('open', () => {
  send(ws, { id: `${id}-auth`, type: 'auth', payload: { token: cfg.auth.token } });
});

ws.on('message', (data: WebSocket.RawData) => {
  const msg = JSON.parse(String(data));
  if (msg.type === 'auth.ok') {
    if (chatMode) {
      const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: 'autobot> ' });
      rl.prompt();
      rl.on('line', (line) => {
        const text = line.trim();
        if (!text) {
          rl.prompt();
          return;
        }
        if (text === 'exit' || text === 'quit') {
          rl.close();
          ws.close();
          return;
        }
        const reqId = `${Date.now()}-${chatCounter++}`;
        send(ws, { id: reqId, type: 'update.create', payload: { goal: text } });
        rl.prompt();
      });
      return;
    }
    if (args[0] === 'auth' && args[1] === 'login') {
      const providerId = getProviderId(args) || 'openai-codex';
      send(ws, { id, type: 'auth.login.start', payload: { providerId } });
      return;
    }
    if (args[0] === 'auth' && args[1] === 'status') {
      const providerId = getProviderId(args) || 'openai-codex';
      send(ws, { id, type: 'auth.status.get', payload: { providerId } });
      return;
    }
    if (args[0] === 'auth' && args[1] === 'complete') {
      const providerId = getProviderId(args) || 'openai-codex';
      const first = args[2];
      const second = args[3];
      if (!first) {
        console.error('Usage: autobot auth complete <redirect-url> | <code> <state>');
        ws.close();
        return;
      }
      if (first.startsWith('http')) {
        send(ws, { id, type: 'auth.login.complete', payload: { providerId, redirectUrl: first } });
        return;
      }
      if (!second) {
        console.error('Usage: autobot auth complete <redirect-url> | <code> <state>');
        ws.close();
        return;
      }
      send(ws, { id, type: 'auth.login.complete', payload: { providerId, code: first, state: second } });
      return;
    }
    if (args[0] === 'doctor') {
      send(ws, { id, type: 'doctor.run' });
      return;
    }
    // update/apply/rollback commands removed (chat-only UX)
    if (args[0] === 'loop' && args[1] === 'start') {
      const goal = args.slice(2).join(' ').trim();
      if (!goal) {
        console.error('Usage: autobot loop start <goal>');
        ws.close();
        return;
      }
      send(ws, { id, type: 'loop.start', payload: { goal } });
      return;
    }
    if (args[0] === 'loop' && args[1] === 'status') {
      send(ws, { id, type: 'loop.status.get' });
      return;
    }
    if (args[0] === 'loop' && args[1] === 'stop') {
      const loopId = args[2];
      if (!loopId) {
        console.error('Usage: autobot loop stop <loopId>');
        ws.close();
        return;
      }
      send(ws, { id, type: 'loop.stop', payload: { loopId } });
      return;
    }
    // default: status
    send(ws, { id, type: 'status.get' });
    return;
  }

  if (msg.type === 'auth.login.started') {
    const authUrl = msg.payload?.authUrl;
    if (authUrl) {
      const opened = openUrl(authUrl);
      if (!opened) {
        console.log('Open this URL to authenticate:');
        console.log(authUrl);
      }
    } else {
      console.log('Open this URL to authenticate:');
      console.log(authUrl);
    }
    // keep socket open and wait for auth.login.completed
    return;
  }

  if (msg.type === 'auth.status.result') {
    console.log(JSON.stringify(msg.payload, null, 2));
    ws.close();
    return;
  }

  if (msg.type === 'auth.login.completed') {
    console.log('OAuth login completed.');
    ws.close();
    return;
  }

  if (msg.type === 'update.created') {
    console.log(JSON.stringify(msg.payload, null, 2));
    if (chatMode && msg.payload?.updateId) {
      const updateId = msg.payload.updateId;
      if (askApply) {
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        rl.question('Apply this update? [y/N] ', (answer) => {
          rl.close();
          if (String(answer || '').trim().toLowerCase().startsWith('y')) {
            send(ws, { id: `${Date.now()}-${chatCounter++}`, type: 'update.apply', payload: { updateId } });
            return;
          }
          console.log('Skipped apply.');
        });
        return;
      }
      if (autoApply) {
        send(ws, { id: `${Date.now()}-${chatCounter++}`, type: 'update.apply', payload: { updateId } });
        return;
      }
    }
    if (!chatMode) ws.close();
    return;
  }

  if (msg.type === 'update.applied') {
    console.log(JSON.stringify(msg.payload, null, 2));
    ws.close();
    return;
  }

  if (msg.type === 'update.rolledBack') {
    console.log(JSON.stringify(msg.payload, null, 2));
    ws.close();
    return;
  }

  if (msg.type === 'loop.started' || msg.type === 'loop.status.result' || msg.type === 'loop.iteration.completed' || msg.type === 'loop.iteration.failed' || msg.type === 'loop.stopped') {
    console.log(JSON.stringify(msg, null, 2));
    if (msg.type === 'loop.started' || msg.type === 'loop.status.result') {
      ws.close();
    }
    return;
  }

  if (msg.type === 'doctor.result') {
    console.log(JSON.stringify(msg.payload, null, 2));
    ws.close();
    return;
  }

  if (msg.type === 'status.result') {
    console.log(JSON.stringify(msg.payload, null, 2));
    ws.close();
    return;
  }

  console.log(JSON.stringify(msg, null, 2));
});

ws.on('error', (err: Error) => {
  console.error('Connection error:', err.message);
  process.exit(1);
});

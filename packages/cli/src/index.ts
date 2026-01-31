#!/usr/bin/env node
import WebSocket from 'ws';
import { loadConfig } from '@autobot/core';
import { execSync } from 'node:child_process';

const cfg = loadConfig();
const url = `ws://127.0.0.1:${cfg.ws.port}`;
const args = process.argv.slice(2);

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

const ws = new WebSocket(url);
const id = String(Date.now());

ws.on('open', () => {
  send(ws, { id: `${id}-auth`, type: 'auth', payload: { token: cfg.auth.token } });
});

ws.on('message', (data: WebSocket.RawData) => {
  const msg = JSON.parse(String(data));
  if (msg.type === 'auth.ok') {
    if (args[0] === 'auth' && args[1] === 'login') {
      send(ws, { id, type: 'auth.login.start' });
      return;
    }
    if (args[0] === 'auth' && args[1] === 'status') {
      send(ws, { id, type: 'auth.status.get' });
      return;
    }
    if (args[0] === 'update') {
      const goal = args.slice(1).join(' ').trim();
      if (!goal) {
        console.error('Usage: autobot update <goal>');
        ws.close();
        return;
      }
      send(ws, { id, type: 'update.create', payload: { goal } });
      return;
    }
    if (args[0] === 'apply') {
      const updateId = args[1];
      if (!updateId) {
        console.error('Usage: autobot apply <updateId>');
        ws.close();
        return;
      }
      send(ws, { id, type: 'update.apply', payload: { updateId } });
      return;
    }
    if (args[0] === 'rollback') {
      const ref = args[1];
      send(ws, { id, type: 'update.rollback', payload: { ref } });
      return;
    }
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
    ws.close();
    return;
  }

  if (msg.type === 'auth.status.result') {
    console.log(JSON.stringify(msg.payload, null, 2));
    ws.close();
    return;
  }

  if (msg.type === 'update.created') {
    console.log(JSON.stringify(msg.payload, null, 2));
    ws.close();
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

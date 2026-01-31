#!/usr/bin/env node
import WebSocket from 'ws';
import { loadConfig } from '@autobot/core';

const cfg = loadConfig();
const url = `ws://127.0.0.1:${cfg.ws.port}`;
const args = process.argv.slice(2);

function send(ws: WebSocket, msg: any) {
  ws.send(JSON.stringify(msg));
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
    // default: status
    send(ws, { id, type: 'status.get' });
    return;
  }

  if (msg.type === 'auth.login.started') {
    console.log('Open this URL to authenticate:');
    console.log(msg.payload?.authUrl);
    ws.close();
    return;
  }

  if (msg.type === 'auth.status.result') {
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

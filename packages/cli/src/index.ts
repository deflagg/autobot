#!/usr/bin/env node
import WebSocket from 'ws';
import { loadConfig } from '@autobot/core';

const cfg = loadConfig();
const url = `ws://127.0.0.1:${cfg.ws.port}`;

const ws = new WebSocket(url);
const id = String(Date.now());

ws.on('open', () => {
  ws.send(JSON.stringify({ id: `${id}-auth`, type: 'auth', payload: { token: cfg.auth.token } }));
});

ws.on('message', (data: WebSocket.RawData) => {
  const msg = JSON.parse(String(data));
  if (msg.type === 'auth.ok') {
    ws.send(JSON.stringify({ id, type: 'status.get' }));
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

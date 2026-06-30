import { WebSocketServer } from 'ws';
import http from 'node:http';
import * as Y from 'yjs';
import { writeUpdate, writeSyncStep1, readSyncMessage } from 'y-protocols/sync';
import { applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { Awareness } from 'y-protocols/awareness';

// ---------------------------------------------------------------------------
// Message types (matches y-websocket protocol)
// ---------------------------------------------------------------------------
const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

// ---------------------------------------------------------------------------
// Document store
// ---------------------------------------------------------------------------

/** @type {Map<string, { doc: Y.Doc, awareness: Awareness, conns: Map<WebSocket, Set<number>> }>} */
const docs = new Map();

function getOrCreateDoc(docName) {
  let entry = docs.get(docName);
  if (entry) return entry;

  const doc = new Y.Doc({ gc: true });
  const awareness = new Awareness(doc);

  awareness.setLocalState(null);

  awareness.on('update', (/** @type {{ added: number[], updated: number[], removed: number[] }} */ changes) => {
    const changedClients = changes.added.concat(changes.updated, changes.removed);
    const entry = docs.get(docName);
    if (!entry) return;

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_AWARENESS);
    encoding.writeVarUint8Array(encoder, encodeAwarenessUpdate(awareness, changedClients));
    const message = encoding.toUint8Array(encoder);

    for (const [conn] of entry.conns) {
      if (conn.readyState === 1) conn.send(message);
    }
  });

  // Relay document updates to every OTHER connected client. Without this,
  // readSyncMessage applies an incoming edit to the server doc but only replies
  // to the sender, so peers never receive live edits (presence syncs via the
  // awareness handler above, but code does not). The `origin` is the sending
  // ws (set when we call readSyncMessage with `ws` as the transaction origin),
  // so the author is excluded — they already have the change locally.
  doc.on('update', (/** @type {Uint8Array} */ update, /** @type {unknown} */ origin) => {
    const entry = docs.get(docName);
    if (!entry) return;

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    writeUpdate(encoder, update);
    const message = encoding.toUint8Array(encoder);

    for (const [conn] of entry.conns) {
      if (conn !== origin && conn.readyState === 1) conn.send(message);
    }
  });

  entry = { doc, awareness, conns: new Map() };
  docs.set(docName, entry);
  return entry;
}

// ---------------------------------------------------------------------------
// Connection handling
// ---------------------------------------------------------------------------

function handleConnection(ws, docName) {
  const entry = getOrCreateDoc(docName);
  const { doc, awareness, conns } = entry;

  /** @type {Set<number>} Awareness client IDs this connection is tracking */
  const controlledIds = new Set();
  conns.set(ws, controlledIds);

  ws.binaryType = 'arraybuffer';

  ws.on('message', (/** @type {ArrayBuffer} */ data) => {
    const decoder = decoding.createDecoder(new Uint8Array(data));
    const msgType = decoding.readVarUint(decoder);

    switch (msgType) {
      case MSG_SYNC: {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MSG_SYNC);
        // Pass `ws` as the transaction origin so the doc 'update' handler can
        // identify the author and skip echoing the change back to them.
        readSyncMessage(decoder, encoder, doc, ws);
        if (encoding.length(encoder) > 1) {
          ws.send(encoding.toUint8Array(encoder));
        }
        break;
      }
      case MSG_AWARENESS: {
        const update = decoding.readVarUint8Array(decoder);
        applyAwarenessUpdate(awareness, update, ws);
        break;
      }
    }
  });

  ws.on('close', () => {
    conns.delete(ws);
    // Remove awareness states for this client
    removeAwarenessStates(awareness, Array.from(controlledIds), null);
    // Clean up empty docs
    if (conns.size === 0) {
      awareness.destroy();
      doc.destroy();
      docs.delete(docName);
    }
  });

  ws.on('error', (err) => {
    console.error(`[yjs] WebSocket error in "${docName}":`, err.message);
  });

  // Send initial sync step 1
  {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    writeSyncStep1(encoder, doc);
    ws.send(encoding.toUint8Array(encoder));
  }

  // Send current document state as sync step 2
  {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    writeUpdate(encoder, Y.encodeStateAsUpdate(doc));
    ws.send(encoding.toUint8Array(encoder));
  }

  // Send current awareness state
  const awarenessStates = awareness.getStates();
  if (awarenessStates.size > 0) {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_AWARENESS);
    encoding.writeVarUint8Array(
      encoder,
      encodeAwarenessUpdate(awareness, Array.from(awarenessStates.keys()))
    );
    ws.send(encoding.toUint8Array(encoder));
  }
}

// ---------------------------------------------------------------------------
// HTTP + WebSocket server
// ---------------------------------------------------------------------------

function getPort() {
  const argIndex = process.argv.indexOf('--port');
  if (argIndex !== -1 && process.argv[argIndex + 1]) {
    return parseInt(process.argv[argIndex + 1], 10);
  }
  return parseInt(process.env.PORT || '3001', 10);
}

const port = getPort();

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        uptime: process.uptime(),
        connections: wss.clients.size,
        activeDocuments: docs.size,
      })
    );
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws, req) => {
  const docName = req.url?.slice(1).split('?')[0] || 'default';
  console.log(
    `[yjs] Client connected to "${docName}" (${wss.clients.size} total)`
  );

  ws.on('close', () => {
    console.log(
      `[yjs] Client disconnected from "${docName}" (${wss.clients.size} total)`
    );
  });

  handleConnection(ws, docName);
});

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

server.listen(port, () => {
  console.log(`[yjs] WebSocket server listening on ws://localhost:${port}`);
  console.log(`[yjs] Health check at http://localhost:${port}/health`);
});

// Graceful shutdown
function shutdown(signal) {
  console.log(`\n[yjs] Received ${signal}, shutting down gracefully...`);

  for (const client of wss.clients) {
    client.close(1001, 'Server shutting down');
  }

  wss.close(() => {
    console.log('[yjs] WebSocket server closed');
    server.close(() => {
      console.log('[yjs] HTTP server closed');
      process.exit(0);
    });
  });

  setTimeout(() => {
    console.error('[yjs] Forced shutdown after timeout');
    process.exit(1);
  }, 5000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

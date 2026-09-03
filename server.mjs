import { createServer } from "node:http";

import next from "next";
import pg from "pg";
import { WebSocket, WebSocketServer } from "ws";

const { Client } = pg;

const dev = process.argv.includes("--dev");
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number.parseInt(process.env.PORT || "3000", 10);
const auctionChannel = "favor_category_auction";
const auctionSocketPath = "/ws/category-auctions";

const normalizeCategoryKey = (value) =>
  value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ru-RU");

const rejectUpgrade = (socket, status, message) => {
  socket.write(
    `HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Type: text/plain\r\nContent-Length: ${Buffer.byteLength(message)}\r\n\r\n${message}`,
  );
  socket.destroy();
};

const isSameOrigin = (request) => {
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (!origin || !host) return true;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
};

const isAuctionEvent = (event) =>
  event &&
  event.type === "category_auction.updated" &&
  typeof event.categoryKey === "string" &&
  Number.isInteger(event.auctionId);

const webSocketServer = new WebSocketServer({ noServer: true });
let databaseClient = null;

const sendRealtimeStatus = (socket) => {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({
    type: "category_auction.realtime_status",
    available: databaseClient !== null,
    changedAt: new Date().toISOString(),
  }));
};

const broadcastRealtimeStatus = () => {
  for (const socket of webSocketServer.clients) sendRealtimeStatus(socket);
};

webSocketServer.on("connection", (socket, request, categoryKey) => {
  socket.categoryKey = categoryKey;
  socket.isAlive = true;
  socket.on("pong", () => {
    socket.isAlive = true;
  });

  sendRealtimeStatus(socket);

  request.socket.setKeepAlive(true, 30_000);
});

const heartbeat = setInterval(() => {
  for (const socket of webSocketServer.clients) {
    if (!socket.isAlive) {
      socket.terminate();
      continue;
    }
    socket.isAlive = false;
    socket.ping();
  }
}, 30_000);
heartbeat.unref();

const broadcastAuctionEvent = (event) => {
  if (!isAuctionEvent(event)) return;
  const payload = JSON.stringify(event);

  for (const socket of webSocketServer.clients) {
    if (
      socket.readyState === WebSocket.OPEN &&
      socket.categoryKey === event.categoryKey
    ) {
      socket.send(payload);
    }
  }
};

let reconnectTimer = null;
let shuttingDown = false;

const scheduleDatabaseReconnect = () => {
  if (shuttingDown || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connectDatabaseListener();
  }, 5_000);
  reconnectTimer.unref();
};

async function connectDatabaseListener() {
  if (shuttingDown || databaseClient) return;
  if (!process.env.DATABASE_URL) {
    console.warn("[auction-socket] DATABASE_URL is unavailable; retrying");
    scheduleDatabaseReconnect();
    return;
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    application_name: "favor-category-auction-socket",
  });
  let disconnected = false;
  const handleDisconnect = (error) => {
    if (disconnected) return;
    disconnected = true;
    if (databaseClient === client) {
      databaseClient = null;
      broadcastRealtimeStatus();
    }
    if (error) console.error("[auction-socket] PostgreSQL listener disconnected", error);
    scheduleDatabaseReconnect();
  };

  client.on("notification", (notification) => {
    if (notification.channel !== auctionChannel || !notification.payload) return;
    try {
      broadcastAuctionEvent(JSON.parse(notification.payload));
    } catch (error) {
      console.warn("[auction-socket] ignored malformed auction event", error);
    }
  });
  client.on("error", handleDisconnect);
  client.on("end", () => handleDisconnect());

  try {
    await client.connect();
    await client.query(`LISTEN ${auctionChannel}`);
    databaseClient = client;
    broadcastRealtimeStatus();
    console.log(`[auction-socket] listening on PostgreSQL channel ${auctionChannel}`);
  } catch (error) {
    console.error("[auction-socket] failed to connect PostgreSQL listener", error);
    await client.end().catch(() => undefined);
    handleDisconnect();
  }
}

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
await app.prepare();

const server = createServer((request, response) => handle(request, response));

server.on("upgrade", (request, socket, head) => {
  const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  if (requestUrl.pathname !== auctionSocketPath) return;

  if (!isSameOrigin(request)) {
    rejectUpgrade(socket, "403 Forbidden", "Forbidden");
    return;
  }

  const rawCategoryKey = requestUrl.searchParams.get("categoryKey") || "";
  const categoryKey = normalizeCategoryKey(rawCategoryKey);
  if (!categoryKey || categoryKey.length > 120) {
    rejectUpgrade(socket, "400 Bad Request", "Invalid categoryKey");
    return;
  }

  webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
    webSocketServer.emit("connection", webSocket, request, categoryKey);
  });
});

server.listen(port, hostname, () => {
  console.log(`> Favor listening at http://${hostname}:${port} (${dev ? "development" : "production"})`);
});

void connectDatabaseListener();

const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[server] received ${signal}, shutting down`);
  clearInterval(heartbeat);
  if (reconnectTimer) clearTimeout(reconnectTimer);
  for (const socket of webSocketServer.clients) socket.close(1001, "Server shutdown");
  await databaseClient?.end().catch(() => undefined);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const PORT = process.env.PORT || 3000;
const players = new Map();
const publishedWorlds = new Map();
const adminSessions = new Map();
const adminAttempts = new Map();
const ADMIN_NAME = process.env.VAYLOX_ADMIN_USERNAME || "VayloxAdmin";
const ADMIN_PASSWORD = process.env.VAYLOX_ADMIN_PASSWORD || "";
const SESSION_TTL = 12 * 60 * 60 * 1000;
function readCookie(req, name) {
  const raw = req.headers.cookie || "";
  const part = raw.split(";").map(v => v.trim()).find(v => v.startsWith(name + "="));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : "";
}
function getAdmin(req) {
  const token = readCookie(req, "vaylox_admin");
  const session = adminSessions.get(token);
  if (!session || session.expires < Date.now()) { if (token) adminSessions.delete(token); return null; }
  session.expires = Date.now() + SESSION_TTL;
  return { username: ADMIN_NAME, verified: true, role: "admin" };
}
function safeEqual(a, b) {
  const aa = Buffer.from(String(a)); const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

app.use(express.json({ limit: "256kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/admin/login", (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const attempts = (adminAttempts.get(ip) || []).filter(t => now - t < 15 * 60 * 1000);
  if (attempts.length >= 5) return res.status(429).json({ error: "Zu viele Versuche. Bitte später erneut probieren." });
  attempts.push(now); adminAttempts.set(ip, attempts);
  if (!ADMIN_PASSWORD) return res.status(503).json({ error: "Das Admin-Konto ist noch nicht auf dem Server eingerichtet." });
  const { username, password } = req.body || {};
  if (!safeEqual(username || "", ADMIN_NAME) || !safeEqual(password || "", ADMIN_PASSWORD)) {
    return res.status(401).json({ error: "Anmeldedaten stimmen nicht." });
  }
  const token = crypto.randomBytes(32).toString("hex");
  adminSessions.set(token, { expires: now + SESSION_TTL });
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `vaylox_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secure}`);
  adminAttempts.delete(ip);
  res.json({ account: { username: ADMIN_NAME, verified: true, role: "admin" } });
});
app.get("/api/admin/me", (req, res) => {
  const account = getAdmin(req);
  if (!account) return res.status(401).json({ error: "Nicht angemeldet." });
  res.json({ account });
});
app.post("/api/admin/logout", (req, res) => {
  const token = readCookie(req, "vaylox_admin");
  if (token) adminSessions.delete(token);
  res.setHeader("Set-Cookie", "vaylox_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0" + (process.env.NODE_ENV === "production" ? "; Secure" : ""));
  res.json({ ok: true });
});

app.get("/api/status", (_req, res) => {
  res.json({ name: "Vaylox", status: "online", players: players.size, worlds: publishedWorlds.size });
});
app.get("/api/worlds", (_req, res) => {
  res.json([...publishedWorlds.values()]);
});
app.post("/api/worlds", (req, res) => {
  const { name, tiles } = req.body || {};
  if (typeof name !== "string" || !name.trim() || !Array.isArray(tiles) || tiles.length > 1600) {
    return res.status(400).json({ error: "Ungültige Welt." });
  }
  const world = {
    id: String(Date.now()) + Math.random().toString(36).slice(2, 7),
    name: name.trim().slice(0, 32),
    tiles: tiles.slice(0, 1600).map(t => ({
      x: Math.max(0, Math.min(39, Number(t.x) || 0)),
      y: Math.max(0, Math.min(39, Number(t.y) || 0)),
      type: ["grass", "stone", "water", "sand"].includes(t.type) ? t.type : "grass"
    })),
    updatedAt: new Date().toISOString()
  };
  publishedWorlds.set(world.id, world);
  io.emit("world:published", world);
  res.status(201).json(world);
});

io.on("connection", socket => {
  socket.on("player:join", data => {
    const name = typeof data?.name === "string" ? data.name.trim().slice(0, 16) : "";
    const player = {
      id: socket.id,
      name: name || "Spieler",
      x: 320 + Math.random() * 100,
      y: 240 + Math.random() * 80,
      color: ["#9b83ff", "#50d6e8", "#ffbd69", "#ff83b8"][Math.floor(Math.random() * 4)]
    };
    players.set(socket.id, player);
    socket.emit("players:init", [...players.values()]);
    socket.broadcast.emit("player:joined", player);
  });
  socket.on("player:move", position => {
    const player = players.get(socket.id);
    if (!player || !position) return;
    player.x = Math.max(16, Math.min(784, Number(position.x) || player.x));
    player.y = Math.max(16, Math.min(584, Number(position.y) || player.y));
    socket.broadcast.emit("player:moved", player);
  });
  socket.on("disconnect", () => {
    players.delete(socket.id);
    io.emit("player:left", socket.id);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Vaylox server listening on ${PORT}`);
});
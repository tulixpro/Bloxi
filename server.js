const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const PORT = process.env.PORT || 3000;
const players = new Map();
const publishedWorlds = new Map();

app.use(express.json({ limit: "256kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/status", (_req, res) => {
  res.json({ name: "Playora", status: "online", players: players.size, worlds: publishedWorlds.size });
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
  console.log(`Playora server listening on ${PORT}`);
});
const express = require("express");
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
const nodemailer = require("nodemailer");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 16 * 1024, perMessageDeflate: false, pingTimeout: 20000, pingInterval: 25000 });
const PORT = process.env.PORT || 3000;
const players = new Map();
const configuredMaxPlayers = Number.parseInt(process.env.VAYLOX_MAX_ONLINE_PLAYERS || "500", 10);
const MAX_ONLINE_PLAYERS = Number.isFinite(configuredMaxPlayers) ? Math.max(1, Math.min(5000, configuredMaxPlayers)) : 500;
const MAX_SOCKET_CONNECTIONS = MAX_ONLINE_PLAYERS + Math.max(50, Math.ceil(MAX_ONLINE_PLAYERS * 0.2));
const publishedWorlds = new Map();
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const VERIFY_TTL_MS = 30 * 60 * 1000;
const ADMIN_EMAIL = (process.env.VAYLOX_ADMIN_EMAIL || "").trim().toLowerCase();
const ADMIN_PASSWORD = process.env.VAYLOX_ADMIN_PASSWORD || "";
const ADMIN_NAME = process.env.VAYLOX_ADMIN_USERNAME || "VayloxAdmin";
const DATABASE_URL = process.env.DATABASE_URL || "";
const mailConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_FROM && process.env.APP_BASE_URL);
const pool = DATABASE_URL ? new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  statement_timeout: 10000,
  query_timeout: 12000,
  idle_in_transaction_session_timeout: 15000,
  application_name: "vaylox"
}) : null;
const mailer = mailConfigured ? nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE || "false") === "true",
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
}) : null;

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // Inline scripts are still used by the current static pages. Remote scripts are blocked;
      // a future nonce migration can remove 'unsafe-inline'.
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"]
    }
  }
}));
app.use(express.json({ limit: "32kb" }));
// Reject cross-origin state-changing browser requests in production.
app.use("/api", (req, res, next) => {
  if (process.env.NODE_ENV !== "production" || !["POST","PUT","PATCH","DELETE"].includes(req.method)) return next();
  let expectedOrigin;
  try { expectedOrigin = new URL(process.env.APP_BASE_URL || "").origin; }
  catch { return res.status(503).json({ error: "Server-Origin ist nicht korrekt konfiguriert." }); }
  const requestOrigin = req.get("origin");
  if (!requestOrigin || requestOrigin !== expectedOrigin) {
    return res.status(403).json({ error: "Anfrage-Origin wurde abgewiesen." });
  }
  next();
});
app.use("/vendor/three", express.static(path.join(__dirname, "node_modules/three/build"), { fallthrough: false, maxAge: "7d" }));
app.use(express.static(path.join(__dirname, "public")));
// Serve the platform homepage from the repository root.
app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "index.html")));
// Support direct links and bookmarks that explicitly request /index.html.
app.get("/index.html", (_req, res) => res.sendFile(path.join(__dirname, "index.html")));
const apiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false, message: { error: "Zu viele Anfragen. Bitte warte kurz." } });
app.use("/api", apiLimiter);

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false, message: { error: "Zu viele Versuche. Bitte warte kurz und versuche es erneut." } });
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 4, standardHeaders: true, legacyHeaders: false });
const hashToken = value => crypto.createHash("sha256").update(value).digest("hex");
const randomToken = () => crypto.randomBytes(32).toString("base64url");
const normalizeEmail = value => String(value || "").trim().toLowerCase();
const normalizeName = value => String(value || "").trim();
const isEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
const isUsername = value => /^[a-zA-Z0-9_]{3,16}$/.test(value);
const isPassword = value => typeof value === "string" && value.length >= 12 && Buffer.byteLength(value, "utf8") <= 72;
const cookieOptions = { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_TTL_MS };

function requireDatabase(_req, res, next) {
  if (!pool) return res.status(503).json({ error: "Accounts sind noch nicht eingerichtet. Die Datenbank fehlt." });
  next();
}
async function sendVerificationEmail(email, username, token) {
  if (!mailer) throw new Error("E-Mail-Versand ist noch nicht konfiguriert.");
  const link = new URL("/verify.html?token=" + encodeURIComponent(token), process.env.APP_BASE_URL).toString();
  await mailer.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: "Bestätige deine Vaylox-E-Mail",
    text: "Hallo " + username + ",\n\nbitte bestätige deine E-Mail-Adresse über diesen Link (30 Minuten gültig):\n" + link + "\n\nWenn du kein Vaylox-Konto erstellt hast, ignoriere diese Nachricht.",
    html: '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#202642"><h1>Willkommen bei Vaylox</h1><p>Hallo ' + username.replace(/[&<>"]/g, "") + ', bitte bestätige deine E-Mail-Adresse.</p><p><a href="' + link + '" style="display:inline-block;padding:12px 18px;background:#9275ff;color:#111426;border-radius:9px;text-decoration:none;font-weight:bold">E-Mail bestätigen</a></p><p>Der Link ist 30 Minuten gültig. Wenn du das Konto nicht erstellt hast, ignoriere diese Nachricht.</p></div>'
  });
}
async function createSession(userId, res) {
  const token = randomToken();
  const expires = new Date(Date.now() + SESSION_TTL_MS);
  await pool.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)", [hashToken(token), userId, expires]);
  res.cookie("vaylox_session", token, cookieOptions);
}
function getCookie(req, name) {
  const raw = req.headers.cookie || "";
  const part = raw.split(";").map(v => v.trim()).find(v => v.startsWith(name + "="));
  if (!part) return "";
  try { return decodeURIComponent(part.slice(name.length + 1)); }
  catch { return ""; }
}
async function currentUser(req) {
  const token = getCookie(req, "vaylox_session");
  if (!token || !pool) return null;
  const result = await pool.query(
    "SELECT u.id,u.username,u.email,u.email_verified,u.role,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>NOW()",
    [hashToken(token)]
  );
  return result.rows[0] || null;
}
function publicAccount(user) {
  return { username: user.username, email: user.email, emailVerified: user.email_verified, role: user.role, verified: user.role === "admin" || user.email_verified };
}
async function requireAdmin(req, res, next) {
  try {
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: "Bitte melde dich zuerst an." });
    if (user.role !== "admin") return res.status(403).json({ error: "Nur das geschützte Admin-Konto darf diese Seite öffnen." });
    req.account = user;
    next();
  } catch (error) { next(error); }
}

async function initializeDatabase() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      username VARCHAR(16) NOT NULL,
      email VARCHAR(254) NOT NULL,
      password_hash TEXT NOT NULL,
      email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      role VARCHAR(16) NOT NULL DEFAULT 'player' CHECK (role IN ('player','admin')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_uq ON users(LOWER(username));
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_uq ON users(LOWER(email));
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash CHAR(64) PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      token_hash CHAR(64) PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS published_worlds (
      id UUID PRIMARY KEY,
      owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(32) NOT NULL,
      tiles JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE published_worlds ADD COLUMN IF NOT EXISTS objects JSONB NOT NULL DEFAULT '[]'::jsonb;
    CREATE INDEX IF NOT EXISTS published_worlds_updated_idx ON published_worlds(updated_at DESC);
    CREATE TABLE IF NOT EXISTS anti_cheat_events (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      event_type VARCHAR(48) NOT NULL,
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS anti_cheat_events_created_idx ON anti_cheat_events(created_at DESC);
    CREATE INDEX IF NOT EXISTS anti_cheat_events_user_created_idx ON anti_cheat_events(user_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS user_skins (
      user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      skin JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query("DELETE FROM sessions WHERE expires_at < NOW()");
  await pool.query("DELETE FROM email_verification_tokens WHERE expires_at < NOW()");
  await pool.query("DELETE FROM anti_cheat_events WHERE created_at < NOW() - INTERVAL '30 days'");
  if (ADMIN_EMAIL || ADMIN_PASSWORD) {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !isEmail(ADMIN_EMAIL) || !isPassword(ADMIN_PASSWORD)) {
      throw new Error("VAYLOX_ADMIN_EMAIL und ein Passwort mit mindestens 12 Zeichen und höchstens 72 UTF-8-Bytes müssen gemeinsam gesetzt sein.");
    }
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    const existing = await pool.query("SELECT id FROM users WHERE LOWER(email)=LOWER($1)", [ADMIN_EMAIL]);
    if (existing.rowCount) {
      await pool.query("UPDATE users SET username=$1,password_hash=$2,email_verified=TRUE,role='admin' WHERE id=$3", [ADMIN_NAME, passwordHash, existing.rows[0].id]);
      await pool.query("DELETE FROM sessions WHERE user_id=$1", [existing.rows[0].id]);
    } else {
      await pool.query("INSERT INTO users(username,email,password_hash,email_verified,role) VALUES($1,$2,$3,TRUE,'admin')", [ADMIN_NAME, ADMIN_EMAIL, passwordHash]);
    }
    console.log("Vaylox admin account configured.");
  }
}

app.post("/api/auth/register", registerLimiter, requireDatabase, async (req, res, next) => {
  try {
    if (!mailConfigured) return res.status(503).json({ error: "E-Mail-Bestätigung ist noch nicht eingerichtet. Bitte versuche es später erneut." });
    const username = normalizeName(req.body?.username);
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;
    if (!isUsername(username)) return res.status(400).json({ error: "Der Spielername muss 3–16 Zeichen haben (Buchstaben, Zahlen, Unterstrich)." });
    if (!isEmail(email) || email.length > 254) return res.status(400).json({ error: "Bitte gib eine gültige E-Mail-Adresse ein." });
    if (!isPassword(password)) return res.status(400).json({ error: "Das Passwort muss mindestens 12 Zeichen und darf höchstens 72 UTF-8-Bytes haben." });
    const passwordHash = await bcrypt.hash(password, 12);
    const client = await pool.connect();
    let user;
    let token = randomToken();
    try {
      await client.query("BEGIN");
      const inserted = await client.query(
        "INSERT INTO users(username,email,password_hash) VALUES($1,$2,$3) RETURNING id,username,email",
        [username,email,passwordHash]
      );
      user = inserted.rows[0];
      await client.query("INSERT INTO email_verification_tokens(token_hash,user_id,expires_at) VALUES($1,$2,$3)", [hashToken(token),user.id,new Date(Date.now()+VERIFY_TTL_MS)]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      if (error.code === "23505") return res.status(409).json({ error: "Spielername oder E-Mail-Adresse ist bereits vergeben." });
      throw error;
    } finally { client.release(); }
    try { await sendVerificationEmail(email, username, token); }
    catch (mailError) {
      await pool.query("DELETE FROM email_verification_tokens WHERE user_id=$1", [user.id]);
      await pool.query("DELETE FROM users WHERE id=$1 AND email_verified=FALSE", [user.id]);
      console.error("Verification email failed:", mailError.message);
      return res.status(503).json({ error: "Die Bestätigungs-E-Mail konnte nicht versendet werden. Bitte später erneut versuchen." });
    }
    res.status(201).json({ message: "Konto erstellt. Bitte bestätige deine E-Mail über den zugesandten Link." });
  } catch (error) { next(error); }
});

app.post("/api/auth/verify", authLimiter, requireDatabase, async (req, res, next) => {
  try {
    const token = String(req.body?.token || "");
    if (token.length < 20 || token.length > 200) return res.status(400).json({ error: "Dieser Bestätigungslink ist ungültig oder abgelaufen." });
    const result = await pool.query(
      "UPDATE users SET email_verified=TRUE WHERE id=(SELECT user_id FROM email_verification_tokens WHERE token_hash=$1 AND expires_at>NOW()) RETURNING username,email",
      [hashToken(token)]
    );
    if (!result.rowCount) return res.status(400).json({ error: "Dieser Bestätigungslink ist ungültig oder abgelaufen." });
    await pool.query("DELETE FROM email_verification_tokens WHERE token_hash=$1", [hashToken(token)]);
    res.json({ message: "E-Mail bestätigt. Du kannst dich jetzt anmelden." });
  } catch (error) { next(error); }
});

app.post("/api/auth/login", authLimiter, requireDatabase, async (req, res, next) => {
  try {
    const identity = String(req.body?.identity || "").trim();
    const result = await pool.query("SELECT * FROM users WHERE LOWER(email)=LOWER($1) OR LOWER(username)=LOWER($1) LIMIT 1", [identity]);
    const user = result.rows[0];
    const valid = user && await bcrypt.compare(String(req.body?.password || ""), user.password_hash);
    if (!valid) return res.status(401).json({ error: "Anmeldedaten stimmen nicht." });
    if (!user.email_verified) return res.status(403).json({ error: "Bitte bestätige zuerst deine E-Mail-Adresse." });
    await createSession(user.id, res);
    res.json({ account: publicAccount(user) });
  } catch (error) { next(error); }
});

app.get("/api/auth/me", requireDatabase, async (req, res, next) => {
  try {
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: "Nicht angemeldet." });
    res.json({ account: publicAccount(user) });
  } catch (error) { next(error); }
});
app.post("/api/auth/logout", requireDatabase, async (req, res, next) => {
  try {
    const token = getCookie(req, "vaylox_session");
    if (token) {
      const tokenHash = hashToken(token);
      await pool.query("DELETE FROM sessions WHERE token_hash=$1", [tokenHash]);
      for (const activeSocket of io.sockets.sockets.values()) {
        if (activeSocket.data.sessionHash === tokenHash) activeSocket.disconnect(true);
      }
    }
    res.clearCookie("vaylox_session", { ...cookieOptions, maxAge: undefined });
    res.json({ ok: true });
  } catch (error) { next(error); }
});
app.get("/api/admin/me", requireDatabase, requireAdmin, (req, res) => {
  res.json({ account: { ...publicAccount(req.account), role: "admin", verified: true } });
});
app.post("/api/admin/logout", requireDatabase, async (req, res, next) => {
  try {
    const token = getCookie(req, "vaylox_session");
    if (token) {
      const tokenHash = hashToken(token);
      await pool.query("DELETE FROM sessions WHERE token_hash=$1", [tokenHash]);
      for (const activeSocket of io.sockets.sockets.values()) {
        if (activeSocket.data.sessionHash === tokenHash) activeSocket.disconnect(true);
      }
    }
    res.clearCookie("vaylox_session", { ...cookieOptions, maxAge: undefined });
    res.json({ ok: true });
  } catch (error) { next(error); }
});


const allowedSkinKeys = ["tone","hairStyle","shirtColor","pantsColor","hairColor","accessory"];
const allowedSkinValues = {
  tone: ["#f1c7a2","#d99a70","#a96845","#70452f","#8bd8e8"],
  hairStyle: ["classic","spiky","short","none"],
  shirtColor: ["#9275ff","#22a6a1","#e45c75","#e6a23c","#3b65b8"],
  pantsColor: ["#344b91","#30343f","#8b633e","#4b936a"],
  hairColor: ["#382b26","#e2bd55","#20202a","#b94b57","#8b70df"],
  accessory: ["hat","crown","none"]
};
const defaultSkin = { tone:"#f1c7a2",hairStyle:"classic",shirtColor:"#9275ff",pantsColor:"#344b91",hairColor:"#382b26",accessory:"hat" };
app.get("/api/skin", requireDatabase, async (req,res,next) => {
  try {
    const user=await currentUser(req);
    if(!user || (!user.email_verified && user.role!=="admin")) return res.status(401).json({error:"Bitte melde dich mit bestätigtem Konto an."});
    const result=await pool.query("SELECT skin FROM user_skins WHERE user_id=$1",[user.id]);
    res.json({skin:result.rows[0]?.skin || defaultSkin});
  } catch(error){next(error);}
});
app.put("/api/skin", requireDatabase, async (req,res,next) => {
  try {
    const user=await currentUser(req);
    if(!user || (!user.email_verified && user.role!=="admin")) return res.status(401).json({error:"Bitte melde dich mit bestätigtem Konto an."});
    const input=req.body?.skin;
    if(!input || typeof input!=="object" || Array.isArray(input) || Object.keys(input).some(k=>!allowedSkinKeys.includes(k)) || allowedSkinKeys.some(k=>!allowedSkinValues[k].includes(input[k]))) {
      return res.status(400).json({error:"Ungültige Skin-Einstellungen."});
    }
    await pool.query("INSERT INTO user_skins(user_id,skin) VALUES($1,$2::jsonb) ON CONFLICT(user_id) DO UPDATE SET skin=EXCLUDED.skin,updated_at=NOW()",[user.id,JSON.stringify(input)]);
    res.json({ok:true,skin:input});
  } catch(error){next(error);}
});

app.get("/api/status", (_req, res) => res.json({ name: "Vaylox", status: pool && mailer ? "ready" : "limited", databaseConfigured: !!pool, emailVerificationConfigured: !!mailer, players: players.size, worlds: publishedWorlds.size }));
const worldLimiter = rateLimit({ windowMs: 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false });
app.get("/api/worlds", worldLimiter, requireDatabase, async (_req, res, next) => {
  try {
    const result = await pool.query("SELECT id,name,tiles,objects,updated_at FROM published_worlds ORDER BY updated_at DESC LIMIT 100");
    res.json(result.rows.map(row => ({ id: row.id, name: row.name, tiles: row.tiles, objects: row.objects || [], updatedAt: row.updated_at })));
  } catch (error) { next(error); }
});
app.post("/api/worlds", worldLimiter, requireDatabase, async (req, res, next) => {
  try {
    const user = await currentUser(req);
    if (!user || (!user.email_verified && user.role !== "admin")) return res.status(401).json({ error: "Bitte bestätige deine E-Mail und melde dich an." });
    const { name, tiles = [], objects = [] } = req.body || {};
    if (typeof name !== "string" || !name.trim() || !Array.isArray(tiles) || tiles.length > 1600 || !Array.isArray(objects) || objects.length > 500) return res.status(400).json({ error: "Ungültige Welt." });
    const cleanTiles = [];
    for (const tile of tiles) {
      if (!tile || !Number.isInteger(Number(tile.x)) || !Number.isInteger(Number(tile.y)) || Number(tile.x) < 0 || Number(tile.x) > 39 || Number(tile.y) < 0 || Number(tile.y) > 39) return res.status(400).json({ error: "Ungültige Welt-Daten." });
      cleanTiles.push({ x: Number(tile.x), y: Number(tile.y), type: ["grass","stone","water","sand"].includes(tile.type) ? tile.type : "grass" });
    }
    const cleanObjects = [];
    const finite = (v, min, max) => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
    for (const item of objects) {
      if (!item || !["cube","sphere","cylinder","tree","lamp"].includes(item.type)) return res.status(400).json({ error: "Ungültiger 3D-Objekttyp." });
      const v = item.position || {}, r = item.rotation || {}, z = item.scale || {};
      if (![v.x,v.y,v.z].every(n => finite(n,-100,100)) || ![r.x,r.y,r.z].every(n => finite(n,-Math.PI*8,Math.PI*8)) || ![z.x,z.y,z.z].every(n => finite(n,0.1,10))) return res.status(400).json({ error: "Ungültige 3D-Transformation." });
      const color = typeof item.color === "string" && /^#[0-9a-fA-F]{6}$/.test(item.color) ? item.color : "#9277ff";
      cleanObjects.push({ type:item.type, position:{x:v.x,y:v.y,z:v.z}, rotation:{x:r.x,y:r.y,z:r.z}, scale:{x:z.x,y:z.y,z:z.z}, color });
    }
    const world = { id: crypto.randomUUID(), name: name.trim().slice(0,32), tiles: cleanTiles, objects: cleanObjects, updatedAt: new Date().toISOString() };
    await pool.query("INSERT INTO published_worlds(id,owner_id,name,tiles,objects) VALUES($1,$2,$3,$4::jsonb,$5::jsonb)", [world.id,user.id,world.name,JSON.stringify(world.tiles),JSON.stringify(world.objects)]);
    io.emit("world:published",world);
    res.status(201).json(world);
  } catch (error) { next(error); }
});

// Socket.IO akzeptiert ausschließlich gültige, serverseitige Login-Sitzungen.
io.use(async (socket, next) => {
  try {
    if (io.engine.clientsCount >= MAX_SOCKET_CONNECTIONS) return next(new Error("Spielserver ist ausgelastet"));
    if (process.env.NODE_ENV === "production") {
      let expectedOrigin;
      try { expectedOrigin = new URL(process.env.APP_BASE_URL || "").origin; }
      catch { return next(new Error("Server-Origin ist nicht korrekt konfiguriert")); }
      if (!socket.handshake.headers.origin || socket.handshake.headers.origin !== expectedOrigin) {
        return next(new Error("Verbindung von unbekanntem Origin abgewiesen"));
      }
    }
    if (!pool) return next(new Error("Datenbank nicht verfügbar"));
    const rawCookie = socket.handshake.headers.cookie || "";
    const part = rawCookie.split(";").map(v => v.trim()).find(v => v.startsWith("vaylox_session="));
    if (!part) return next(new Error("Anmeldung erforderlich"));
    let token;
    try { token = decodeURIComponent(part.slice("vaylox_session=".length)); } catch { return next(new Error("Ungültige Sitzung")); }
    const result = await pool.query(
      "SELECT u.id,u.username,u.role,u.email_verified FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>NOW()",
      [hashToken(token)]
    );
    const account = result.rows[0];
    if (!account || (!account.email_verified && account.role !== "admin")) return next(new Error("Gültige, bestätigte Anmeldung erforderlich"));
    socket.data.account = account;
    socket.data.sessionHash = hashToken(token);
    next();
  } catch (_error) { next(new Error("Anmeldung konnte nicht geprüft werden")); }
});
io.on("connection", socket => {
  let joined = false;
  let lastMoveAt = 0;
  let moveEvents = 0;
  let moveWindowAt = Date.now();
  let suspiciousMoves = 0;
  let lastSecurityLogAt = 0;
  let inboundWindowAt = Date.now();
  let inboundEvents = 0;
  const sessionCheck = setInterval(async () => {
    try {
      const active = await pool.query("SELECT 1 FROM sessions WHERE token_hash=$1 AND expires_at>NOW()", [socket.data.sessionHash]);
      if (!active.rowCount) socket.disconnect(true);
    } catch (_error) { socket.disconnect(true); }
  }, 60000);
  sessionCheck.unref?.();
  const flagSuspiciousMove = (reason, details = {}) => {
    suspiciousMoves += 1;
    const now = Date.now();
    // Persist only occasional security events to avoid turning abuse into database load.
    if (now - lastSecurityLogAt > 5000) {
      lastSecurityLogAt = now;
      pool.query(
        "INSERT INTO anti_cheat_events(user_id,event_type,details) VALUES($1,$2,$3::jsonb)",
        [socket.data.account.id, reason, JSON.stringify(details)]
      ).catch(error => console.error("Anti-cheat event logging failed:", error.message));
    }
    if (suspiciousMoves >= 5) socket.disconnect(true);
  };
  // Reject event flooding and any client event outside the tiny multiplayer protocol.
  socket.onAny(event => {
    const now = Date.now();
    if (now - inboundWindowAt >= 1000) { inboundWindowAt = now; inboundEvents = 0; }
    inboundEvents += 1;
    if (inboundEvents > 60) flagSuspiciousMove("socket_event_rate_exceeded", { count: inboundEvents });
    if (!["player:join", "player:move"].includes(event)) flagSuspiciousMove("unknown_socket_event", { event: String(event).slice(0, 48) });
  });
  socket.on("player:join", () => {
    if (joined) return;
    if (players.size >= MAX_ONLINE_PLAYERS) {
      socket.emit("server:busy", { message: "Dieser Spielserver ist gerade voll." });
      socket.disconnect(true);
      return;
    }
    joined = true;
    const player = {
      id: socket.id,
      name: socket.data.account.username,
      x: 320 + Math.random()*100,
      y: 240 + Math.random()*80,
      color: ["#9b83ff","#50d6e8","#ffbd69","#ff83b8"][Math.floor(Math.random()*4)]
    };
    players.set(socket.id,player);
    lastMoveAt = Date.now();
    socket.emit("players:init",[...players.values()]);
    socket.broadcast.emit("player:joined",player);
  });
  socket.on("player:move", position => {
    const player = players.get(socket.id);
    if (!joined || !player) return;
    if (!position || typeof position !== "object" || Array.isArray(position)) {
      flagSuspiciousMove("invalid_move_payload");
      return;
    }
    const now = Date.now();
    if (now - moveWindowAt >= 1000) { moveWindowAt = now; moveEvents = 0; }
    moveEvents += 1;
    if (moveEvents > 20) { flagSuspiciousMove("move_rate_exceeded", { count: moveEvents }); return; }
    if (typeof position !== "object" || Array.isArray(position) ||
        !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
      flagSuspiciousMove("invalid_move_payload");
      return;
    }
    const x = position.x;
    const y = position.y;
    if (x < 16 || x > 784 || y < 16 || y > 584) {
      flagSuspiciousMove("move_out_of_bounds", { x, y });
      socket.emit("player:correct", { x: player.x, y: player.y });
      return;
    }
    const elapsed = Math.max(0.05, Math.min(1, (now - lastMoveAt) / 1000));
    const distance = Math.hypot(x - player.x, y - player.y);
    // Server validiert Bewegungsrate; Teleports und unplausible Sprünge werden verworfen.
    const maxDistance = 120 * elapsed + 8;
    if (distance > maxDistance) {
      flagSuspiciousMove("movement_speed_exceeded", { distance: Math.round(distance), allowed: Math.round(maxDistance) });
      socket.emit("player:correct", { x: player.x, y: player.y });
      return;
    }
    player.x = x;
    player.y = y;
    lastMoveAt = now;
    socket.broadcast.emit("player:moved",player);
  });
  socket.on("disconnect", () => {
    clearInterval(sessionCheck);
    if (players.delete(socket.id)) io.emit("player:left",socket.id);
  });
});

app.use((error, _req, res, _next) => {
  console.error("Request failed:", error.message);
  res.status(500).json({ error: "Interner Fehler. Bitte versuche es später erneut." });
});

initializeDatabase().then(() => {
  server.listen(PORT, "0.0.0.0", () => console.log("Vaylox server listening on " + PORT));
}).catch(error => {
  console.error("Startup failed:", error);
  process.exit(1);
});

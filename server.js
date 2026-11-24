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
const io = new Server(server);
const PORT = process.env.PORT || 3000;
const players = new Map();
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
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
}) : null;
const mailer = mailConfigured ? nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE || "false") === "true",
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
}) : null;

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "32kb" }));
app.use(express.static(path.join(__dirname, "public")));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Zu viele Versuche. Bitte warte kurz und versuche es erneut." } });
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 4, standardHeaders: "draft-8", legacyHeaders: false });
const hashToken = value => crypto.createHash("sha256").update(value).digest("hex");
const randomToken = () => crypto.randomBytes(32).toString("base64url");
const normalizeEmail = value => String(value || "").trim().toLowerCase();
const normalizeName = value => String(value || "").trim();
const isEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
const isUsername = value => /^[a-zA-Z0-9_]{3,16}$/.test(value);
const isPassword = value => typeof value === "string" && value.length >= 12 && value.length <= 128;
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
  return part ? decodeURIComponent(part.slice(name.length + 1)) : "";
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
  await pool.query(\`
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
  \`);
  await pool.query("DELETE FROM sessions WHERE expires_at < NOW()");
  await pool.query("DELETE FROM email_verification_tokens WHERE expires_at < NOW()");
  if (ADMIN_EMAIL || ADMIN_PASSWORD) {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !isEmail(ADMIN_EMAIL) || !isPassword(ADMIN_PASSWORD)) {
      throw new Error("VAYLOX_ADMIN_EMAIL und ein Passwort mit mindestens 12 Zeichen müssen gemeinsam gesetzt sein.");
    }
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    const existing = await pool.query("SELECT id FROM users WHERE LOWER(email)=LOWER($1)", [ADMIN_EMAIL]);
    if (existing.rowCount) {
      await pool.query("UPDATE users SET username=$1,password_hash=$2,email_verified=TRUE,role='admin' WHERE id=$3", [ADMIN_NAME, passwordHash, existing.rows[0].id]);
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
    if (!isPassword(password)) return res.status(400).json({ error: "Das Passwort muss mindestens 12 Zeichen haben." });
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
    if (token) await pool.query("DELETE FROM sessions WHERE token_hash=$1", [hashToken(token)]);
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
    if (token) await pool.query("DELETE FROM sessions WHERE token_hash=$1", [hashToken(token)]);
    res.clearCookie("vaylox_session", { ...cookieOptions, maxAge: undefined });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.get("/api/status", (_req, res) => res.json({ name: "Vaylox", status: "online", players: players.size, worlds: publishedWorlds.size }));
app.get("/api/worlds", (_req, res) => res.json([...publishedWorlds.values()]));
app.post("/api/worlds", (req, res) => {
  const { name, tiles } = req.body || {};
  if (typeof name !== "string" || !name.trim() || !Array.isArray(tiles) || tiles.length > 1600) return res.status(400).json({ error: "Ungültige Welt." });
  const world = { id: crypto.randomUUID(), name: name.trim().slice(0,32), tiles: tiles.slice(0,1600).map(t => ({ x: Math.max(0,Math.min(39,Number(t.x)||0)), y: Math.max(0,Math.min(39,Number(t.y)||0)), type: ["grass","stone","water","sand"].includes(t.type)?t.type:"grass" })), updatedAt: new Date().toISOString() };
  publishedWorlds.set(world.id,world); io.emit("world:published",world); res.status(201).json(world);
});

io.on("connection", socket => {
  socket.on("player:join", data => {
    const name = typeof data?.name === "string" ? data.name.trim().slice(0,16) : "";
    const player = { id: socket.id, name: name || "Spieler", x: 320 + Math.random()*100, y: 240 + Math.random()*80, color: ["#9b83ff","#50d6e8","#ffbd69","#ff83b8"][Math.floor(Math.random()*4)] };
    players.set(socket.id,player); socket.emit("players:init",[...players.values()]); socket.broadcast.emit("player:joined",player);
  });
  socket.on("player:move", position => {
    const player = players.get(socket.id); if (!player || !position) return;
    player.x = Math.max(16,Math.min(784,Number(position.x)||player.x)); player.y = Math.max(16,Math.min(584,Number(position.y)||player.y)); socket.broadcast.emit("player:moved",player);
  });
  socket.on("disconnect", () => { players.delete(socket.id); io.emit("player:left",socket.id); });
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

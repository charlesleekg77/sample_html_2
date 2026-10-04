/**
 * Tengile MalaMala — enquiry API + static host.
 *
 * Security posture:
 *   - Database credentials are read from the environment only; never sent to the client.
 *   - Requests are validated server-side before storage.
 *   - Logs never contain personal details (no names, emails, phones, notes or IPs).
 */
import express from "express";
import helmet from "helmet";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "./db.js";
import { validateEnquiry } from "./validation.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PORT = Number(process.env.PORT || 3000);

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

/* ---------------------------------------------------- security headers */
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        "font-src": ["'self'", "https://fonts.gstatic.com"],
        "img-src": ["'self'", "data:", "https://images.unsplash.com"],
        "connect-src": ["'self'"],
        "frame-ancestors": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: false, limit: "32kb" }));

/* ------------------------------------------------- optional CORS allowlist */
const corsOrigins = (process.env.CORS_ORIGINS || "")
  .split(",").map((s) => s.trim()).filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && corsOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

/* --------------------------------------------------------- request logging
   Deliberately minimal: method, path, status and duration only.
   No body, no query string, no IP, no personal data. */
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${ms.toFixed(1)}ms`);
  });
  next();
});

/* --------------------------------------------------- in-memory rate limiter
   Per-IP counter held in memory only; the IP is never logged or persisted. */
const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 900000);
const RATE_MAX = Number(process.env.RATE_LIMIT_MAX || 10);
const hits = new Map();

function rateLimit(req, res, next) {
  const now = Date.now();
  const key = req.ip || "unknown";
  const entry = hits.get(key) || { count: 0, reset: now + WINDOW_MS };
  if (now > entry.reset) { entry.count = 0; entry.reset = now + WINDOW_MS; }
  entry.count += 1;
  hits.set(key, entry);
  if (entry.count > RATE_MAX) {
    res.setHeader("Retry-After", Math.ceil((entry.reset - now) / 1000));
    return res.status(429).json({
      ok: false,
      message: "Too many enquiries from this connection. Please try again later, or email reservations@tengilemalamala.com.",
      errors: {},
    });
  }
  next();
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
}, WINDOW_MS).unref();

/* ------------------------------------------------------------------- routes */

// Health check — reports driver and reachability, never credentials.
app.get("/api/health", async (_req, res) => {
  try {
    const db = await getDb();
    await db.ping();
    res.json({ ok: true, database: db.driver });
  } catch (err) {
    console.error("health check failed:", err.message);
    res.status(503).json({ ok: false, database: "unavailable" });
  }
});

app.post("/api/enquiries", rateLimit, async (req, res) => {
  const isQuick = req.body && req.body.source === "quick-enquiry";
  const { ok, errors, value } = validateEnquiry(req.body, {
    requireConsent: !isQuick,
    requireDates: !isQuick,
  });

  if (!ok) {
    // Field names only — never the submitted values.
    console.warn(`enquiry rejected (validation): ${Object.keys(errors).join(",")}`);
    return res.status(422).json({
      ok: false,
      message: "Please check the highlighted fields and try again.",
      errors,
    });
  }

  try {
    const db = await getDb();
    const id = await db.insert([
      value.arrival_date, value.departure_date, value.adults, value.children, value.flexibility,
      value.lodge, value.transfer, value.experiences,
      value.full_name, value.email, value.phone, value.country, value.notes, value.consent,
      value.source,
    ]);
    console.log(`enquiry stored id=${id} source=${value.source}`);
    return res.status(201).json({
      ok: true,
      id,
      message: "Thank you — your enquiry has been received. A travel specialist will respond within one business day.",
    });
  } catch (err) {
    console.error("enquiry storage failed:", err.message);
    return res.status(500).json({
      ok: false,
      message: "We could not save your enquiry just now. Please try again shortly, or email reservations@tengilemalamala.com.",
      errors: {},
    });
  }
});

/* --------------------------------------------------------------- static host
   Only the site's public assets are exposed. Server code, data and dotfiles
   are explicitly blocked. */
const BLOCKED = /^\/(server|node_modules|data)(\/|$)|^\/package(-lock)?\.json$|^\/\.env|^\/\.git/;
app.use((req, res, next) => {
  if (BLOCKED.test(req.path)) return res.status(404).end();
  next();
});
app.use(express.static(ROOT, { extensions: ["html"], dotfiles: "ignore" }));

app.use((_req, res) => res.status(404).sendFile(resolve(ROOT, "index.html")));

/* ------------------------------------------------------------------- start */
const server = app.listen(PORT, () => {
  console.log(`Tengile MalaMala server listening on http://localhost:${PORT}`);
  getDb()
    .then((db) => console.log(`Database ready: ${db.driver} (${db.location})`))
    .catch((err) => console.error("Database init failed:", err.message));
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    server.close(async () => {
      try { const db = await getDb(); await db.close(); } catch { /* ignore */ }
      process.exit(0);
    });
  });
}

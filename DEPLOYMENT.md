# Enquiry Backend — Setup & Deployment

This adds a server-side endpoint that validates and stores enquiries submitted
from the Plan Your Stay form, the quick enquiry modal, and the contact form.

```
Browser form  ──POST /api/enquiries──▶  Express server  ──▶  Postgres (or SQLite)
   (no secrets)                          validates              stores enquiry
```

Database credentials live only in the server's environment. Nothing sensitive is
ever sent to, or readable by, the browser.

---

## 1. What was added

| Path | Purpose |
|---|---|
| `server/index.js` | Express app: `POST /api/enquiries`, `GET /api/health`, static host, security headers, rate limiting |
| `server/validation.js` | Server-side validation for every field from all three steps |
| `server/db.js` | Database layer — Postgres (production) or SQLite (local dev) |
| `server/schema.sql` | Postgres table + indexes |
| `.env.example` | Template for all configuration values |
| `.gitignore` | Keeps `.env`, `node_modules/` and the local DB out of git |
| `package.json` | Dependencies and `npm start` |

Front-end files updated: `plan-your-stay.html`, `contact.html`, all page modals,
`main.js`, `style.css`.

---

## 2. Fields captured

All fields from the three form steps, plus the contact and quick-enquiry forms:

| Step | Fields |
|---|---|
| 1 — Dates & Guests | `arrival_date`, `departure_date`, `adults`, `children`, `flexibility` |
| 2 — Lodge & Transfers | `lodge`, `transfer`, `experiences` |
| 3 — Final Details | `full_name`, `email`, `phone`, `country`, `notes`, `consent` |
| Meta | `source` (`plan-your-stay` / `quick-enquiry` / `contact`), `status`, `created_at` |

Only these whitelisted fields are stored; anything else in the request body is
dropped. Emails are lower-cased; dates are validated as real calendar dates;
departure must be after arrival.

---

## 3. Local development (no credentials needed)

The default driver is SQLite, using Node's built-in `node:sqlite` module.

```bash
npm install
npm start          # http://localhost:3000
```

- Database file: `./data/enquiries.sqlite` (created automatically, git-ignored).
- Requires **Node.js ≥ 22.5** (for `node:sqlite`). Node 24 is recommended.
- Health check: `curl http://localhost:3000/api/health`

Test a submission:

```bash
curl -X POST http://localhost:3000/api/enquiries \
  -H "Content-Type: application/json" \
  -d '{"source":"plan-your-stay","arrival_date":"2026-11-10",
       "departure_date":"2026-11-17","adults":"2","children":"0",
       "lodge":"Tengile River Lodge","full_name":"Test Guest",
       "email":"test@example.com","consent":true}'
```

Inspect saved rows:

```bash
node -e 'const{DatabaseSync}=require("node:sqlite");
const db=new DatabaseSync("./data/enquiries.sqlite");
console.log(db.prepare("SELECT id,source,full_name,email,created_at FROM enquiries").all());'
```

---

## 4. Production database (Postgres)

1. Create a database and a least-privilege application role:

   ```sql
   CREATE DATABASE tengile_enquiries;
   CREATE ROLE tengile_app LOGIN PASSWORD '<strong-password>';
   GRANT CONNECT ON DATABASE tengile_enquiries TO tengile_app;
   -- then, connected to the database:
   GRANT USAGE, CREATE ON SCHEMA public TO tengile_app;
   ```

   The server runs `server/schema.sql` on startup (`CREATE TABLE IF NOT EXISTS`),
   so no manual migration is required.

2. Set the environment variables (see `.env.example`). Provide **either**
   `DATABASE_URL` **or** the discrete `PG*` values:

   ```
   DB_DRIVER=postgres
   DATABASE_URL=postgres://tengile_app:<password>@<host>:5432/tengile_enquiries?sslmode=require
   ```

3. Start the server: `DB_DRIVER=postgres npm start`.

Managed providers (Neon, Supabase, RDS, Railway, Render) all give you a
`DATABASE_URL` directly. Keep `sslmode=require` unless the provider says otherwise.

---

## 5. Hosting

The server hosts the static site **and** the API from one origin, which avoids
CORS entirely and keeps `connect-src 'self'` in the Content-Security-Policy.

**Option A — a Node host (Render, Railway, Fly.io, Heroku, a VPS).**
- Build: `npm install`
- Start: `npm start`
- Set the environment variables from `.env.example` in the host's dashboard.
- Do **not** set `CORS_ORIGINS` when the site is served from the same origin.

**Option B — static site + separate API host.**
- Point the site's forms at the API's absolute URL (change `data-endpoint` on
  each `<form>`), and set `CORS_ORIGINS` to your site's origin, e.g.
  `CORS_ORIGINS=https://tengilemalamala.com`.

Behind a load balancer or proxy, keep `trust proxy` enabled (already set) so the
rate limiter sees real client IPs.

---

## 6. Security notes

- Credentials are read only from `process.env`; they are never embedded in HTML/JS.
- Server code, `data/`, `.env`, `.git`, and `package.json` are blocked from static serving (return 404).
- Every submission is re-validated server-side; the browser checks are advisory.
- Logs contain only `method path status duration` and the stored record id — **no
  names, emails, phones, notes, or IP addresses are ever logged.**
- Per-IP rate limiting (default 10 requests / 15 min) returns HTTP 429.
- `helmet` sets a strict CSP, `frame-ancestors 'none'`, and other hardening headers.
- Parameterised SQL everywhere (no string concatenation).

### Recommended follow-ups
- Add a transactional email / CRM notification on success (e.g. an SMTP or
  provider API key as a **server-side** secret).
- Add a scheduled export or retention policy for stored personal data (POPIA/GDPR).
- Put the API behind HTTPS and add a bot defence (e.g. Cloudflare Turnstile) if abused.

---

## 7. Secrets & accounts to configure before a real submission

Nothing below is needed for local SQLite testing — only for production.

| What | Where it goes | Required? | Notes |
|---|---|---|---|
| **Postgres database** | Managed provider account (Neon / Supabase / RDS / Railway / Render) or self-hosted | Yes for production | You need the host, port, database name, user, password |
| `DATABASE_URL` **or** `PGHOST`/`PGPORT`/`PGDATABASE`/`PGUSER`/`PGPASSWORD` | Server environment variables | Yes | Single URL is simplest; both forms are supported |
| `PGSSLMODE` | Server environment | Recommended | `require` for managed providers |
| `DB_DRIVER=postgres` | Server environment | Yes | Defaults to `sqlite` if unset |
| `PORT`, `NODE_ENV` | Server environment | Yes | Provided by most hosts automatically |
| `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS` | Server environment | Optional | Tune abuse protection |
| `CORS_ORIGINS` | Server environment | Only if API is on a different origin | Comma-separated allowlist |
| Hosting account (Render / Railway / Fly.io / VPS) | — | Yes for production | To run `npm start` and hold the env vars |
| SMTP / email or CRM API key | Server environment | Optional | Only if you add notification emails |
| Domain + TLS certificate | DNS / host | Yes for production | `https://` |

**Before going live, confirm:**
1. `DB_DRIVER=postgres` and valid connection variables are set on the host.
2. `GET /api/health` returns `{"ok":true,"database":"postgres"}`.
3. `.env` is **not** committed (it is git-ignored) and no secret appears in any
   HTML, JS, or the repo.
4. A real submission from the Plan Your Stay form creates a row, and the success
   message appears in the browser.

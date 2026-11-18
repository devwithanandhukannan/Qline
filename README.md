# Qline

Queue and booking for local shops (barbers, salons, cafes). Free to run.

| Folder | What it is | Free host |
|---|---|---|
| `backend/` | Node.js + Express API, MongoDB | Render (free web service) + MongoDB Atlas (free M0) |
| `customer-web/` | Customer PWA + landing page (Next.js) | Vercel Hobby |
| `org-web/` | Shop-owner PWA + landing page (Next.js) | Vercel Hobby |
| `admin-web/` | Platform super-admin portal (Next.js) | Vercel Hobby |

Customers scan a QR code or search for a shop, join the live queue or book a slot, watch their turn, and rate the visit.
Owners set hours, staff time off and per-day overrides, run the live queue, and see calendar, reports and graphs.

## How it fits together

```
Browser ──► customer-web / org-web (Vercel) ──/api/* proxy──► backend (Render) ──► MongoDB Atlas
```

Each app proxies `/api/*` to the backend, so the browser only talks to its own domain. Login cookies are first-party and httpOnly (this also works on Safari), and there are no secrets in the browser.

Login: email code (sent by SMTP/Brevo/Gmail API with custom HTML emails) or **Continue with Google** (Firebase; the backend verifies the Firebase token, no service-account key needed).

## Run it on your computer

Needs Node 20+ and a MongoDB (Atlas free cluster, or local).

```bash
cd backend && cp .env.example .env     # fill in the values, see tables below
npm install && npm run dev             # http://localhost:8080

cd customer-web && cp .env.example .env.local && npm install && npm run dev   # http://localhost:3000
cd org-web      && cp .env.example .env.local && npm install && npm run dev   # http://localhost:3001
```

With `MAIL_PROVIDER=console` the login code is printed in the backend terminal, so you can try everything without email.

Tests: `cd backend && npm test` (logic, Google token and email checks) and `npm run test:e2e` (full API run, needs a MongoDB at `MONGODB_URI`; it wipes that database, so point it at a scratch one).

## Deploy for free, step by step

1. **MongoDB Atlas.** Create a free M0 cluster. Database Access: add a user. Network Access: allow `0.0.0.0/0` (Render free has no fixed IP; the database user and password protect it). Copy the connection string and add a database name: `...mongodb.net/qline?retryWrites=true&w=majority`.
2. **GitHub.** Push this whole folder to one repository.
3. **Render (API).** New > Blueprint > your repo (it reads `render.yaml`), or New > Web Service with root directory `backend`, build `npm install --omit=dev`, start `node src/server.js`, health check `/health`. Fill the environment variables (table below). Note the URL, for example `https://qline-api.onrender.com`.
4. **Email** (see the next section; this is the one thing that differs from a normal host).
5. **Vercel (two projects).** Import the same repo twice, with Root Directory `customer-web` and `org-web`. Set each app's variables (table below). Note both URLs.
6. **Back on Render**, set `CORS_ORIGINS` (both Vercel URLs, comma separated, no trailing slash), `CUSTOMER_APP_URL`, `ORG_APP_URL`, then redeploy.
7. **Firebase.** Console > Authentication > Settings > Authorized domains: add both Vercel domains (without `https://`). Without this, the Google pop-up says "unauthorized domain".
8. **Keep the API awake.** Render free sleeps after 15 minutes without traffic and takes about a minute to wake (the apps show "Waking up the server" and retry). A free uptime monitor such as UptimeRobot hitting `https://YOUR-API/health` every 5 minutes keeps it warm. One always-on service fits inside Render's 750 free hours per month.

### Email: important

**Render's free tier blocks outbound SMTP (ports 25, 465, 587), so Gmail SMTP cannot send from there.** It works on your computer and on any host that allows SMTP. For the free Render deployment use one of these (set `MAIL_PROVIDER`):

| Option | Cost | Setup |
|---|---|---|
| `brevo` | free, 300 emails/day | Create an account, verify a sender address, create an API key. Set `BREVO_API_KEY`, `MAIL_FROM_EMAIL`. Simplest. |
| `gmail_api` | free | Sends from your Gmail over HTTPS. Needs a Google Cloud OAuth client and a refresh token: set `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `MAIL_FROM_EMAIL`. A Gmail app password cannot be used for this. |
| `smtp` | free locally, paid on Render | `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER`, `SMTP_PASS` (a Google app password), `MAIL_FROM_EMAIL`. |

Emails (code and welcome) are custom HTML in `backend/src/services/emailTemplates.js`.

## Environment variables

Secrets live only in `.env` files or the host dashboards. Nothing secret is in the code, and `.env` files are git-ignored. The server refuses to start if a required value is missing or too short.

**backend** (`backend/.env.example` lists all)

| Variable | Notes |
|---|---|
| `MONGODB_URI` | Atlas connection string |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `OTP_PEPPER` | 32+ random characters each. `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `CORS_ORIGINS` | both app URLs, comma separated |
| `MAIL_PROVIDER` + its keys | see Email |
| `FIREBASE_PROJECT_ID` | enables Google sign-in |
| `CUSTOMER_APP_URL`, `ORG_APP_URL` | used for the button in the welcome email |

**customer-web**: `BACKEND_URL`, `NEXT_PUBLIC_ORG_URL`, `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`.
**org-web**: `BACKEND_URL`, `NEXT_PUBLIC_CUSTOMER_URL` (the shop QR code points here), and the same four Firebase values.
(The Firebase web values are public by design; Firebase protects them with Authorized domains.)

## Security in this build

- Every request body, query and URL parameter goes through a strict zod schema (DTO). Unknown fields are rejected, so operator injection such as `{"$ne": ...}` never reaches MongoDB.
- Login codes are 6 digits, stored only as a keyed hash, expire after 10 minutes, allow 5 attempts, and are throttled per email and per IP.
- Sessions: 15 minute access token plus a rotating refresh token (stored hashed; reuse of an old one revokes the whole session). Both are httpOnly, Secure, SameSite cookies. Writes need a custom header (CSRF guard) and an allow-listed origin.
- Google sign-in tokens are verified against Google's public certificates: signature, issuer, audience, expiry, provider and verified email.
- Owners can only read or change their own shop; customers only their own bookings. Checked on every route and covered by tests.
- Rate limits, body size limit, Helmet headers, a Content-Security-Policy on both apps, no stack traces in responses, secrets only in environment variables.
- Customers see only a first name on public reviews; private feedback stays with the shop.

## Good to know

- Shop hours are interpreted in the shop's time zone (`DEFAULT_TIMEZONE`, default `Asia/Kolkata`).
- Vercel's free Hobby plan is for personal, non-commercial use. If you plan to charge shops, check Vercel's terms or host the two Next.js apps elsewhere.
- Web push notifications: Standard W3C Web Push with VAPID signatures and RFC 8291 aes128gcm payload encryption alerts customers in background when their turn is coming up ("You're next in line") and when their chair is ready.
- Multi-resource queueing: Dynamic resource assignment (barbers, stylists, cafe tables) with slot-queue mutual concurrency awareness and auto-grace enforcement.

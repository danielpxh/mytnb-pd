# MyTNB-PD (Personal Dashboard)

MyTNB-PD is an unofficial personal dashboard for reviewing electricity usage and billing data from your myTNB account. This project is not affiliated with or endorsed by TNB. The backend uses the [python-mytnb](https://pypi.org/project/python-mytnb/) library.

This project is distributed under the [MIT License](./LICENSE). “TNB” and “myTNB” are trademarks of Tenaga Nasional Berhad; their use here is only to identify the service. MyTNB-PD is an independent, unofficial project and is not sponsored, endorsed, or affiliated with Tenaga Nasional Berhad.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15 (App Router) + TypeScript |
| Styling | Tailwind CSS |
| Data fetching | TanStack Query v5 |
| Tables | TanStack Table v8 |
| Charts | Recharts |
| Backend | FastAPI + python-mytnb |
| Database | SQLite (via SQLModel + aiosqlite) |
| Scheduler | APScheduler (polls myTNB every N hours) |

## Quick Start

### 1. Backend

```bash
cd backend
python -m venv .venv
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
Copy-Item .env.example .env
# macOS/Linux:
# source .venv/bin/activate
# cp .env.example .env
python -m pip install -r requirements.txt
uvicorn app.main:app --reload
```

Use this backend-specific `.venv` when running the API; do not rely on an environment created for another project.
Open http://localhost:3000 and sign in with your myTNB email and password. Sessions start at 12 hours; after login, change the automatic sign-out duration in Settings (1, 6, 12, or 24 hours). Credentials are kept in backend memory and are not written to the app database or browser storage. The sign-in form supports browser password managers; the app can remember only your email on this device. The optional `MYTNB_USERNAME` and `MYTNB_PASSWORD` environment variables enable syncing for a configured profile when no browser session is active.

API docs: http://localhost:8000/docs

### 2. Frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Open: http://localhost:3000

### 3. First run

1. Sign in; MyTNB-PD discovers and syncs linked accounts automatically. The profile area displays the account holder name supplied by myTNB, with your sign-in email shown below it; select the profile area to open **Settings → My Profile**. Change the automatic sign-out duration after login in Settings.
2. Use **Settings → Discover Accounts** to refresh the account list, or **Sync** to fetch updates on demand.
3. While a browser session is active, the backend automatically re-syncs every `POLL_INTERVAL_HOURS` (default: 6 hours). The session expires at the selected sign-out time and the backend must be running; automatic syncing is not performed while the app is stopped.

## Docker

Make sure Docker Desktop (or Docker Engine with the Compose plugin) is running. From the project root, copy the backend environment file and add your myTNB credentials before building.

On macOS/Linux/Git Bash:
```bash
cp backend/.env.example backend/.env
```

On Windows PowerShell:
```powershell
Copy-Item backend/.env.example backend/.env
```

You can leave `MYTNB_USERNAME` and `MYTNB_PASSWORD` blank and sign in through the dashboard after it starts. Set them in `backend/.env` only if you want scheduled syncing for that configured profile. The Compose ports bind to localhost only; do not expose the HTTP ports directly to the internet. For remote use, put the frontend behind a TLS-terminating reverse proxy that overwrites forwarded headers, and set `TRUST_PROXY_HEADERS=true` in the Compose environment. The frontend rejects sign-in over non-HTTPS connections outside localhost, and session cookies are Secure, HttpOnly, and SameSite=Lax.

From the project root, build both images and start the app:

```bash
docker compose up --build -d
```

Open http://localhost:3000. View logs with `docker compose logs -f`; stop the services with `docker compose down`. To only build the images without starting containers, run `docker compose build`.

The Compose project name is `mytnb-pd`, so its generated images, containers, and network use that prefix regardless of the folder name. The backend persists its database in `backend/data/`; its existing `mytnb.db` filename is retained to avoid switching to a new, empty database. The frontend image points API requests to the Compose backend service.

## Important: Malaysian IP Required

The myTNB API (`api.mytnb.com.my`) only accepts connections from Malaysian IP addresses. Run this app on:
- Your local machine (in Malaysia), or
- A VPS hosted in Malaysia (e.g. Exabytes, Shinjiru, Time dotCom cloud)

## Smart Meter vs Standard Meter

| Feature | Standard | Smart Meter (SMR) |
|---|---|---|
| Monthly bills | ✅ | ✅ |
| Daily usage | ❌ | ✅ |
| Hourly usage | ❌ | Future |

Check `is_smart_meter` in Settings to see your meter type.

## Data notes

- Daily kWh and daily MYR cost come from the smart-meter daily usage endpoint. They are unavailable for standard meters and are shown only when the source provides them.
- Standard-meter bill history from `python-mytnb` supplies bill date, amount, and bill number, but not kWh; the dashboard shows **Not provided** rather than inventing a zero.
- Due date and current payment state come from the account due-amount endpoint. Historical bills are marked **Unknown** unless the source can identify their payment; unavailable data is not labeled unpaid.
- Chart range selectors zoom the visible range. The data editor changes the chart in the current page only; edits are not saved to the database or sent to TNB. Chart and bill data can be exported as CSV, Excel, Word, or PDF files.
- Dark/light theme selection is stored in browser local storage. The optional remembered email is also stored locally; the browser does not store the password.
- Smart Meter Reading and bill-rendering indicators can be refreshed from **Settings → Your Accounts → Check eligibility**. Results are saved with the account in the local database and are informational; myTNB remains the authority for eligibility.

## Security and verification

The backend scopes stored accounts, bills, usage, and eligibility snapshots to the signed-in myTNB email. Existing SQLite databases are migrated on startup; legacy unowned records are claimed only after the signed-in myTNB profile verifies the matching account. The password is held in backend process memory for the session and is not written to the app database or browser storage. It cannot be password-hashed locally because the backend must send the original credential to myTNB when making API calls; the password field is excluded from credential-object representations to reduce accidental logging. Optional credentials in `backend/.env` are plaintext on the host and are injected into the container at runtime. Keep that file private, never share or commit it, and use a host secret manager for deployments that need stronger secret-at-rest protection. The Docker build excludes `.env` and local database files, and the project ignore rules exclude local secrets. Encrypting `.env` is only useful when its decryption key is stored separately. The default Compose deployment is local-only; remote deployments require HTTPS. Do not reuse the development setup as a public HTTP deployment.

Usage and billing data are stored locally in SQLite. The frontend uses TanStack Query's in-memory cache (5-minute freshness by default, retained for up to 30 minutes while inactive) for responsive navigation and invalidates affected data after a sync; no shared HTTP cache or external cache service is used for account data. Eligibility results are cached in the local database until checked again.

Run the frontend type check and production build with `cd frontend && npm run type-check && npm run build`. Run backend tests from `backend` with `python -m unittest discover -s tests`. Tests use mocked myTNB responses and local SQLite; they do not probe TNB or any third-party service.

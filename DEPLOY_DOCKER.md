# Deploy HomeConnect with Docker (VPS Ubuntu)

This repo is a monorepo with 3 services:
- `web` (React/Vite built to static files served by Nginx)
- `backend` (Spring Boot, HTTP: 8080, Socket.IO: 9092)
- `ai` (FastAPI/Uvicorn, HTTP: 8000)
- `db` (MySQL)

## 1) On the server

### Install prerequisites
Docker is already installed in your VPS logs. You still need Git.

```bash
apt-get update
apt-get install -y git
```

### Clone the project
```bash
git clone https://github.com/gwynnn297/homeconnect.git
cd homeconnect
```

### Create `.env`
```bash
cp .env.example .env
nano .env
```

Set at least:
- `PUBLIC_BASE_URL` (IP, used at frontend build time)
- `DB_PASSWORD`, `MYSQL_ROOT_PASSWORD` (you choose these; they are new passwords for the MySQL container)
- `JWT_SECRET` (you choose this; generate a random string)
- Email OTP (so registration can send OTP): `EMAIL_USERNAME` + `EMAIL_PASSWORD` (or `GMAIL_USERNAME` + `GMAIL_APP_PASSWORD`)

Optional but needed for specific features:
- Cloudinary upload (KYC / Smart Check-in): `VITE_CLOUDINARY_CLOUD_NAME`, `VITE_CLOUDINARY_UPLOAD_PRESET`
- Goong Maps (frontend + backend geocoding): `VITE_GOONG_JS_KEY`, `VITE_GOONG_REST_API_KEY` and backend `GOONG_API_KEY`
- Smart Check-in face compare (Face++): `FACEPP_API_KEY`, `FACEPP_API_SECRET`
- KYC OCR (FPT.AI): `FPT_AI_API_KEY`
- Automated payout (xGate): `XGATE_API_KEY`, `XGATE_WEBHOOK_SECRET`

Generate a strong JWT secret on the server:
```bash
openssl rand -base64 48
```

Example (IP only):
```env
PUBLIC_BASE_URL=http://152.42.182.120
```

### (Optional but recommended) Add swap for smoother builds on 2GB RAM
If `docker compose up --build` fails due to OOM, add a 2GB swapfile:

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
swapon --show
```

## 2) Build and run

```bash
docker compose up -d --build
```

## 2.1) Update `.env` later (VPS)

Edit the env file:
```bash
nano .env
```

Apply changes:
- If you changed **backend runtime env** (DB, JWT, Email OTP, Face++/FPT/xGate, etc):
```bash
docker compose up -d backend
```

- If you changed any **frontend build-time env** (`PUBLIC_BASE_URL` or any `VITE_*`): you must rebuild the `web` image:
```bash
docker compose build web --no-cache
docker compose up -d web
```

Important note about MySQL credentials:
- Changing `DB_USERNAME` / `DB_PASSWORD` / `MYSQL_ROOT_PASSWORD` after the DB volume is created will usually break login.
- If you really need to change them, you must recreate the DB volume (THIS DELETES DATA):
```bash
docker compose down -v
docker compose up -d --build
```

Check status:
```bash
docker compose ps
```

Follow logs:
```bash
docker compose logs -f web
# or
docker compose logs -f backend
```

## 3) Verify

- Frontend: open `http://<PUBLIC_IP>/`
- Backend Swagger: `http://<PUBLIC_IP>/swagger-ui.html`
- AI health (internal): `docker compose exec ai wget -qO- http://localhost:8000/health`

If register OTP fails, check backend logs for SMTP errors:
```bash
docker compose logs -f backend
```

If map / KYC / check-in features fail after changing `VITE_*` keys, rebuild the web image:
```bash
docker compose build web --no-cache
docker compose up -d
```

## 4) Firewall (recommended)
If you use UFW:

```bash
ufw allow OpenSSH
ufw allow 80/tcp
# ufw allow 443/tcp  # only if you add HTTPS
ufw enable
ufw status
```

## Notes
- MySQL data is persisted in a Docker volume: `db_data`.
- The frontend container also acts as a reverse proxy:
  - `/api/*` -> backend (8080)
  - `/socket.io/*` -> backend socket server (9092)

# Deploy HomeConnect with Docker (VPS Ubuntu)

Monorepo services (one command):

| Service | Role | Internal port |
|---------|------|----------------|
| `db` | MySQL 8.4 | 3306 |
| `ai` | FastAPI AI parser | 8000 |
| `backend` | Spring Boot API + Socket.IO | 8080, 9092 |
| `web` | Nginx (SPA + reverse proxy) | **80** (public) |

There is **no RabbitMQ** in this project.

```bash
docker compose up -d --build
```

---

## Architecture

```
Browser → :80 web (nginx)
            ├─ /          → React static files
            ├─ /api/*     → backend:8080
            ├─ /socket.io/* → backend:9092
            └─ /swagger-ui.html → backend:8080

backend → db:3306 (MySQL)
backend → ai:8000 (AI parser)
```

Inside containers, **never** use `localhost` for DB/AI — use service names `db` and `ai`.

---

## 1) VPS prerequisites

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# log out and back in
```

Optional swap (2 GB VPS):

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

---

## 2) Clone and configure

```bash
git clone https://github.com/gwynnn297/homeconnect.git
cd homeconnect
cp .env.example .env
nano .env
```

### Required variables

| Variable | Description |
|----------|-------------|
| `MYSQL_ROOT_PASSWORD` | MySQL root password (new, for container) |
| `HC_MYSQL_USER` | Application MySQL user (not `root`) |
| `HC_MYSQL_PASSWORD` | Password for `HC_MYSQL_USER` (same value in DB + backend) |
| `JWT_SECRET` | `openssl rand -base64 48` |
| `GMAIL_USERNAME` + `GMAIL_APP_PASSWORD` | OTP email (or `EMAIL_*`) |

**Windows:** if you have system/shell `DB_USERNAME` / `DB_PASSWORD`, Docker Compose can prefer those over your project `.env` when substituting variables. This stack uses `HC_MYSQL_*` so Compose does not collide with common Windows `DB_USERNAME=root`.

### Recommended for production UI

| Variable | Description |
|----------|-------------|
| `PUBLIC_BASE_URL` | `http://YOUR_VPS_IP` (no trailing slash) |
| `VITE_*` Goong / Cloudinary | Maps & image upload |

If `VITE_API_URL` and `VITE_SOCKET_URL` are **empty**, the frontend uses **same-origin** (works when users open `http://VPS_IP/` on port 80).

---

## 3) Build and run

```bash
docker compose config          # validate
docker compose up -d --build
docker compose ps
```

Wait until `db`, `ai`, `backend`, and `web` are **healthy** (backend may take 2–3 minutes on first Flyway migrate).

Logs:

```bash
docker compose logs -f backend
docker compose logs -f web
```

---

## 4) Import database backup (for mentor / migration)

On your dev machine (export):

```bash
mysqldump -u root -p homeconnect > homeconnect_full.sql
zip homeconnect_db_backup.zip homeconnect_full.sql
```

On VPS (import):

```bash
# Linux
chmod +x scripts/import-db.sh
./scripts/import-db.sh homeconnect_full.sql

# Windows (from repo root)
.\scripts\import-db.ps1 -DumpFile ".\homeconnect_full.sql"
```

Use a **full** dump from an environment that already ran Flyway migrations.

### Test data (full flows — wallets, bookings, chat, …)

After stack is up and Flyway finished:

```powershell
# Windows
.\scripts\run-seed-test-data.ps1

# Export backup.sql + .zip (master data + test rows)
.\scripts\export-test-backup.ps1
```

Files: `scripts/seed-test-data.sql` (re-runnable INSERT), `scripts/backups/homeconnect_test_backup.sql` / `.zip` (full dump).

Test password (if BCrypt hash in seed matches): `viecnha123` — accounts `admin@homeconnect.vn`, `cust1@gmail.com`, `helper1@gmail.com`, etc.

---

## 5) Verify

```bash
curl -I http://127.0.0.1/
curl -I http://127.0.0.1/swagger-ui.html
docker compose exec ai wget -qO- http://127.0.0.1:8000/health
```

Browser:

- `http://<VPS_IP>/` — frontend
- `http://<VPS_IP>/swagger-ui.html` — API docs
- Register → check OTP in backend logs if email fails

---

## 6) Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw enable
```

**Do not** open MySQL port `3306` on the public firewall. Database access from your PC uses **SSH tunnel** only (see section 8).

---

## 7) MySQL Workbench (local PC → VPS database)

MySQL runs in Docker (`homeconnect-db`). Compose publishes it on the **VPS loopback only**:

`127.0.0.1:3306` → container `3306` (see `MYSQL_BIND_HOST` / `MYSQL_HOST_PORT` in `.env`).

### On VPS (after `git pull`)

```bash
cd ~/homeconnect
docker compose up -d db
ss -tlnp | grep 3306   # expect 127.0.0.1:3306
```

### PuTTY — SSH tunnel (Windows)

1. Session: host = VPS IP, user `root` (or your SSH user).
2. **Connection → SSH → Tunnels**
   - Source port: `3307` (free port on your PC)
   - Destination: `127.0.0.1:3306`
   - Type: **Local** → **Add**
3. Open the session and **keep PuTTY connected** while using Workbench.

### PowerShell alternative

```powershell
ssh -L 3307:127.0.0.1:3306 root@YOUR_VPS_IP
```

### MySQL Workbench connection

| Field | Value |
|-------|--------|
| Hostname | `127.0.0.1` |
| Port | `3307` (same as PuTTY source port) |
| Username | `root` or `HC_MYSQL_USER` from VPS `.env` |
| Password | `MYSQL_ROOT_PASSWORD` or `HC_MYSQL_PASSWORD` |
| Default schema | `homeconnect` (`DB_NAME`) |

**Test Connection** → browse `users`, `bookings`, etc.

### Security

- Never set `MYSQL_BIND_HOST=0.0.0.0` on a public VPS.
- Never `ufw allow 3306` for the internet.
- Optional: use user `homeconnect` instead of `root` for day-to-day edits.

### Local Docker on Windows

If `docker compose` fails with “port already allocated”, another MySQL uses 3306. In `.env`:

```env
MYSQL_HOST_PORT=3307
```

Then tunnel PuTTY to VPS `127.0.0.1:3306` (unchanged); only local Docker host port changes.

---

## 8) Update `.env` after first deploy

**Backend runtime** (DB, JWT, Gmail, Face++, xGate):

```bash
docker compose up -d backend
```

**Frontend build-time** (`VITE_*` or `PUBLIC_BASE_URL`):

```bash
docker compose build web --no-cache
docker compose up -d web
```

**MySQL passwords** after volume exists: changing `HC_MYSQL_PASSWORD` / `MYSQL_ROOT_PASSWORD` usually breaks login. To reset (deletes all DB data):

```bash
docker compose down -v
docker compose up -d --build
```

---

## Deploy checklist

- [ ] Clone repo, `cd homeconnect`
- [ ] `cp .env.example .env` and fill secrets
- [ ] `docker compose config` OK
- [ ] `docker compose up -d --build` — all services healthy
- [ ] Import `homeconnect_db_backup.zip` if provided
- [ ] Open `http://<IP>/` and Swagger
- [ ] Test register OTP / login
- [ ] (Optional) MySQL Workbench via SSH tunnel (section 7)
- [ ] Send mentor: repo URL, VPS IP, backup zip (not in git)

---

## Local dev vs Docker

| | Local (`gradlew bootRun`) | Docker Compose |
|--|---------------------------|----------------|
| Env file | `backend/.env` | Root `.env` |
| MySQL host | `localhost` | `db` (automatic) |
| AI URL | `http://localhost:8000/...` | `http://ai:8000/...` (automatic) |

---

## Notes

- MySQL data persists in Docker volume `homeconnect_db_data` (Compose project name `homeconnect`).
- MySQL is reachable on the VPS host at `127.0.0.1:${MYSQL_HOST_PORT:-3306}` for SSH tunnel / Workbench only.
- Containers can reach the internet (SMTP, Goong, OpenAI, etc.) by default.
- Do not commit `.env` or database dumps to git.

# Pandit G — Hostinger VPS + Docker Deployment Guide

Final reference for deploying **Pandit G** (Next.js WhatsApp astrology bot) on a **Hostinger VPS** with **Docker Manager** + **SSH**.

Domain used in this guide: **`panditg.live`**

Use this document every time you redeploy or set up a new Hostinger VPS.

---

## Table of contents

1. [How it works](#1-how-it-works)
2. [Files in this repo](#2-files-in-this-repo)
3. [Prerequisites](#3-prerequisites)
4. [Step 1 — Point DNS](#4-step-1--point-dns)
5. [Step 2 — Deploy Traefik](#5-step-2--deploy-traefik)
6. [Step 3 — Verify Traefik (host network)](#6-step-3--verify-traefik-host-network)
7. [Step 4 — Clone the app on the VPS](#7-step-4--clone-the-app-on-the-vps)
8. [Step 5 — Create `.env.local`](#8-step-5--create-envlocal)
9. [Step 6 — Build and start Pandit G](#9-step-6--build-and-start-pandit-g)
10. [Step 7 — Verify website + SSL](#10-step-7--verify-website--ssl)
11. [Step 8 — Update WhatsApp webhook](#11-step-8--update-whatsapp-webhook)
12. [Step 9 — Update Razorpay webhook](#12-step-9--update-razorpay-webhook)
13. [Step 10 — Leave Vercel](#13-step-10--leave-vercel)
14. [Day-2 operations](#14-day-2-operations)
15. [Troubleshooting](#15-troubleshooting)
16. [Quick command sheet](#16-quick-command-sheet)

---

## 1. How it works

```
Internet
   │
   ▼
DNS: panditg.live  →  VPS public IP
   │
   ▼
Traefik  (Hostinger Docker project, network_mode: host)
   listens on :80 and :443
   auto SSL via Let's Encrypt
   │
   ▼
pandit-g container  (Next.js on port 3000)
   published as 127.0.0.1:3000
   discovered by Traefik via Docker labels
   │
   ├── WhatsApp Cloud API
   ├── xAI Grok
   ├── MongoDB Atlas (external)
   └── Razorpay
```

### Important facts (learned on Hostinger)

| Fact | Detail |
|------|--------|
| Two separate Docker projects | **1)** Traefik  **2)** Pandit G — do not put the app inside Traefik |
| Traefik network | Usually **`host`** — not `traefik-proxy` |
| Shared bridge network | **Not required** for this Hostinger Traefik template |
| Build method | Prefer **SSH** `docker compose up -d --build` |
| Database | Keep **MongoDB Atlas** (no Mongo container needed) |

---

## 2. Files in this repo

| File | Purpose |
|------|---------|
| `Dockerfile` | Builds production Next.js standalone image |
| `docker-compose.yml` | Runs `pandit-g` + Traefik labels for `panditg.live` |
| `.env.example` | Template — copy to `.env.local` on the VPS |
| `.dockerignore` | Keeps secrets / junk out of the image |
| `next.config.ts` | `output: "standalone"` required for Docker |
| `deployment.md` | This guide |

---

## 3. Prerequisites

Before starting:

- [ ] Hostinger VPS with **Docker Manager** enabled
- [ ] SSH access as `root` (or sudo user)
- [ ] VPS **public IPv4**
- [ ] Domain **`panditg.live`** (DNS editable)
- [ ] Code on **GitHub** (private OK)
- [ ] Secrets ready: WhatsApp, xAI, MongoDB, Razorpay, admin
- [ ] Meta Developer Console access
- [ ] Razorpay Dashboard access

Suggested app path on VPS:

```text
/opt/pandit-g
```

---

## 4. Step 1 — Point DNS

### 1.1 Copy VPS IP

hPanel → **VPS** → your server → copy **IPv4**.

### 1.2 Create DNS records

In Hostinger **DNS Manager** (or your registrar) for `panditg.live`:

| Type | Name | Value | TTL |
|------|------|--------|-----|
| A | `@` | `YOUR_VPS_IP` | 300 / Auto |
| A | `www` | `YOUR_VPS_IP` | 300 / Auto |

### 1.3 Remove old Vercel records

Delete any A/CNAME pointing to Vercel (`cname.vercel-dns.com`, old `*.vercel.app`, etc.).

### 1.4 Wait and verify

```bash
nslookup panditg.live
nslookup www.panditg.live
```

Both must show your VPS IP before SSL will work.

---

## 5. Step 2 — Deploy Traefik

Traefik is only the reverse proxy + free SSL. It is **not** the app.

### 2.1 Open Docker Manager

1. hPanel → **VPS** → **Manage**
2. Left menu → **Docker Manager**
3. Open **Projects**

### 2.2 One-click Traefik

1. Click **Compose**
2. Choose **One click deploy (New)** (or **Catalog**)
3. Deploy **Traefik**
4. Set **ACME_EMAIL** to a real email (Let's Encrypt notices)
5. Wait until status is **Running**

Example project names you may see:

- Project: `traefik-tvdm`
- Container: `traefik-tvdm-traefik-1`

**Stop here for Traefik.** Do not add Pandit G as a container inside this project.

---

## 6. Step 3 — Verify Traefik (host network)

Open **Terminal** (Docker Manager or SSH).

### 3.1 Confirm Traefik is running

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### 3.2 Confirm network mode

```bash
docker inspect traefik-tvdm-traefik-1 --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}'
```

Expected on Hostinger:

```text
host
```

If the container name differs, find it with `docker ps` and re-run inspect with that name.

### 3.3 Confirm ports 80 and 443

```bash
ss -tlnp | grep -E ':80|:443'
```

Something must be listening on **80** and **443**.

### 3.4 Network list is often only defaults

```bash
docker network ls
```

Seeing only `bridge` / `host` / `none` is **normal** when Traefik uses `host` networking.  
You do **not** need to create `traefik-proxy`.

---

## 7. Step 4 — Clone the app on the VPS

Still in SSH / Terminal:

### 4.1 Install git (if needed)

```bash
apt update && apt install -y git
```

### 4.2 Clone repository

```bash
mkdir -p /opt
cd /opt
git clone https://github.com/YOUR_USERNAME/pandit-g.git
cd pandit-g
```

Private repo:

```bash
git clone https://YOUR_GITHUB_TOKEN@github.com/YOUR_USERNAME/pandit-g.git
```

or with SSH key:

```bash
git clone git@github.com:YOUR_USERNAME/pandit-g.git
```

---

## 8. Step 5 — Create `.env.local`

This project uses **`.env.local` only** (same as local dev).  
`docker-compose.yml` loads `env_file: .env.local`.

### 5.1 Create file

```bash
cd /opt/pandit-g
cp .env.example .env.local
nano .env.local
```

### 5.2 Required production values

Must set:

```env
APP_URL=https://panditg.live
```

Also fill:

- `WHATSAPP_*`
- `XAI_*`
- `MONGODB_URI` / `MONGODB_DB_NAME`
- `RAZORPAY_*`
- `ADMIN_SESSION_SECRET` (required)
- Brevo: `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME` (password reset)
- First admin: `npm run seed:admin -- --email=... --password=...` (no public signup)
- `INTERNAL_API_SECRET` (long random string)

Recommended typing delays on VPS (no Hobby 10s limit):

```env
FUNNEL_READING_DELAY_MS=4000
TYPING_MS_PER_CHAR=40
TYPING_BASE_MS=2000
TYPING_MIN_MS=2500
TYPING_MAX_MS=20000
```

Save in nano: `Ctrl+O` → Enter → `Ctrl+X`.

### 5.3 Lock permissions

```bash
chmod 600 /opt/pandit-g/.env.local
```

Never commit `.env.local` to Git (already covered by `.gitignore` → `.env*`).

### 5.4 MongoDB Atlas

In Atlas Network Access, allow your **VPS IP** (or temporarily `0.0.0.0/0` only if you understand the risk).

---

## 9. Step 6 — Build and start Pandit G

### 6.1 Build + run

```bash
cd /opt/pandit-g
docker compose up -d --build
```

First build usually takes **5–15 minutes**.

### 6.2 Follow logs

```bash
docker compose logs -f pandit-g
```

You should see Next.js listening on port **3000**.  
Exit logs with `Ctrl+C` (container keeps running).

### 6.3 Confirm container is up

```bash
docker compose ps
docker ps
```

Expected container name: `pandit-g`.

### 6.4 Local smoke test on the VPS

```bash
curl -I http://127.0.0.1:3000
```

Should return HTTP headers (not connection refused).

---

## 10. Step 7 — Verify website + SSL

### 7.1 Browser checks

Open:

- `https://panditg.live`
- `https://www.panditg.live`
- `https://panditg.live/admin`

SSL may take a few minutes after DNS + first Traefik request.

### 7.2 If HTTPS fails

1. Re-check DNS A records  
2. Confirm Traefik is running  
3. Confirm `pandit-g` is running  
4. Check Traefik logs in Docker Manager → Traefik project → **Logs**

---

## 11. Step 8 — Update WhatsApp webhook

Meta Developer Console → your app → WhatsApp → Configuration / Webhooks:

| Field | Value |
|--------|--------|
| Callback URL | `https://panditg.live/api/webhooks/whatsapp` |
| Verify token | Same as `WHATSAPP_VERIFY_TOKEN` in VPS `.env.local` |

Click **Verify and save**. Subscribe to the same fields as before (at least **messages**).

Test: send `Hi` to the business WhatsApp number.

---

## 12. Step 9 — Update Razorpay webhook

Razorpay Dashboard → Webhooks:

```text
https://panditg.live/api/webhooks/razorpay
```

Webhook secret must match `RAZORPAY_WEBHOOK_SECRET` in `.env.local`.

Keep the same payment events as before. Run a small test payment after DNS/SSL are stable.

> Use **live** Razorpay keys for production. `rzp_test_...` is only for testing.

---

## 13. Step 10 — Leave Vercel

Only after WhatsApp + website work on `panditg.live`:

1. Confirm Meta and Razorpay URLs no longer use `*.vercel.app`
2. Confirm DNS has no Vercel CNAMEs
3. Pause or delete the Vercel project when ready

---

## 14. Day-2 operations

### Redeploy after code change

```bash
cd /opt/pandit-g
git pull
docker compose up -d --build
```

### Change env only

```bash
nano /opt/pandit-g/.env.local
cd /opt/pandit-g
docker compose up -d --force-recreate pandit-g
```

### Logs

```bash
cd /opt/pandit-g
docker compose logs -f --tail=200 pandit-g
```

### Restart / stop / start

```bash
cd /opt/pandit-g
docker compose restart pandit-g
docker compose stop
docker compose start
```

### Full recreate

```bash
cd /opt/pandit-g
docker compose down
docker compose up -d --build
```

### Firewall (UFW example)

Allow SSH + HTTP + HTTPS only:

```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status
```

Do **not** expose Mongo. Keep app port `3000` on `127.0.0.1` only (already done in compose).

---

## 15. Troubleshooting

### Traefik inspect shows `host`

Correct for Hostinger. Do not look for `traefik-proxy`. Use the compose file in this repo (labels + `127.0.0.1:3000`).

### `docker network ls` has no traefik network

Normal with host-mode Traefik.

### Website 502 / not loading

```bash
docker ps
curl -I http://127.0.0.1:3000
docker compose -f /opt/pandit-g/docker-compose.yml logs --tail=100 pandit-g
```

Also confirm DNS points to this VPS.

### SSL stuck / certificate error

- DNS must already resolve to VPS IP  
- Ports 80/443 must be open  
- Wait a few minutes after first deploy  
- Check Traefik container logs  

### WhatsApp verify fails

- URL exact: `https://panditg.live/api/webhooks/whatsapp`  
- Token matches `.env.local`  
- HTTPS works in browser  
- Container healthy  

### Build fails / OOM on small VPS

Add temporary swap, then rebuild:

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
cd /opt/pandit-g && docker compose up -d --build
```

### Mongo connection errors

- Atlas Network Access must allow VPS IP  
- `MONGODB_URI` correct in `/opt/pandit-g/.env.local`  
- Recreate container after env changes  

### Typing / delayed-send issues

Ensure:

```env
APP_URL=https://panditg.live
INTERNAL_API_SECRET=your-long-secret
```

---

## 16. Quick command sheet

```bash
# Traefik status / network mode
docker ps
docker inspect traefik-tvdm-traefik-1 --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}'
ss -tlnp | grep -E ':80|:443'

# App deploy / update
cd /opt/pandit-g
git pull
docker compose up -d --build
docker compose logs -f pandit-g
docker compose ps

# Local check
curl -I http://127.0.0.1:3000
```

---

## Ideal first-time order

1. DNS A records for `panditg.live` + `www` → VPS IP  
2. Deploy Traefik from Docker Manager (leave it alone)  
3. Verify Traefik = `host` network + ports 80/443  
4. `git clone` into `/opt/pandit-g`  
5. Create `.env.local` with `APP_URL=https://panditg.live`  
6. `docker compose up -d --build`  
7. Open site + `/admin`  
8. Update WhatsApp webhook  
9. Update Razorpay webhook  
10. Test chat + payment → then remove Vercel  

---

## Security reminders

- Never paste root passwords into chat tools  
- Use strong `ADMIN_SESSION_SECRET`, `INTERNAL_API_SECRET`
- Seed the first portal admin with `npm run seed:admin` (do not rely on env ADMIN_ID / ADMIN_PASSWORD)  
- Prefer private GitHub repo  
- Use Razorpay **live** keys only in real production  
- Keep `.env.local` chmod `600` and out of git  

---

*Last updated for Hostinger Docker Manager with Traefik in `host` network mode.*

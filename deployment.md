# Pandit G — Hostinger VPS Deployment Guide

Complete step-by-step guide to move **Pandit G** from **Vercel** to your **Hostinger VPS**, using **Docker Manager** + **SSH**, and connecting the domain `panditg.live`.

---

## What you will end up with


| Piece                    | URL / place                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------- |
| Website + API            | `https://panditg.live`                                                                |
| Admin panel              | `https://panditg.live/admin`                                                          |
| WhatsApp webhook         | `https://panditg.live/api/webhooks/whatsapp`                                          |
| Razorpay webhook         | `https://panditg.live/api/webhooks/razorpay` (confirm path in your code if different) |
| App container            | Docker (`pandit-g`)                                                                   |
| Reverse proxy + free SSL | Traefik (Hostinger Docker Manager)                                                    |


MongoDB stays on **MongoDB Atlas** (your existing `MONGODB_URI`) — you do **not** need to run Mongo on the VPS unless you want to later.

---



## Prerequisites checklist

Before you start, have ready:

- [ ] Hostinger VPS with **Docker** template / Docker Manager enabled  
- [ ] VPS **public IP** (hPanel → VPS → overview)  
- [ ] **SSH** access (root or sudo user)  
- [ ] Domain `panditg.live` (DNS editable — Hostinger DNS Manager or wherever domain is registered)  
- [ ] GitHub repo for this project (private is fine)  
- [ ] All secrets from local `.env.local` (WhatsApp, xAI, Mongo, Razorpay, admin)  
- [ ] Access to **Meta Developer Console** (WhatsApp webhook)  
- [ ] Access to **Razorpay Dashboard** (webhooks)

---



## Architecture (simple)

```
Internet
   │
   ▼
panditg.live  (DNS A record → VPS IP)
   │
   ▼
Traefik (ports 80 + 443, Let's Encrypt SSL)
   │
   ▼
Docker container: pandit-g  (Next.js on port 3000)
   │
   ├── WhatsApp Cloud API
   ├── xAI Grok
   ├── MongoDB Atlas
   └── Razorpay
```

Why Traefik? Hostinger Docker Manager expects it so **HTTPS works automatically** and port 80/443 are not fought over by every app.

---



# PART A — DNS for `panditg.live`



## Step A1 — Find your VPS IP

1. Hostinger **hPanel** → **VPS** → select your server (`srv….hstgr.cloud`).
2. Copy the **IPv4 address**.



## Step A2 — Point the domain

In **DNS Manager** for `panditg.live` (Hostinger sidebar **DNS Manager**, or your registrar):


| Type  | Name / Host | Value         | TTL         |
| ----- | ----------- | ------------- | ----------- |
| **A** | `@`         | `YOUR_VPS_IP` | 300 or Auto |
| **A** | `www`       | `YOUR_VPS_IP` | 300 or Auto |


Notes:

- Remove old A/CNAME records that point to **Vercel** (`cname.vercel-dns.com`, etc.).  
- Wait **5–30 minutes** (sometimes up to a few hours).  
- Check from your PC:

```bash
nslookup panditg.live
nslookup www.panditg.live
```

Both should show your VPS IP before you expect SSL to work.

---



# PART B — Deploy Traefik (SSL reverse proxy)



## Step B1 — Open Docker Manager

1. hPanel → **VPS** → **Manage** your server.
2. Left sidebar → **Docker Manager**.
3. You should see **Projects** (as in your screenshot).



## Step B2 — One-click Traefik ✅ (you are here)

Your screenshot shows this is done correctly:

| Check | Your value |
|--------|------------|
| Project | `traefik-tvdm` |
| Container | `traefik-tvdm-traefik-1` |
| Status | **Running** |
| ACME email | set (for Let's Encrypt SSL) |

**Do not put Pandit G inside this Traefik project.** Keep Traefik alone. The app is a **second** Docker project that joins Traefik’s network.



## Step B3 — Confirmed Hostinger Traefik mode ✅

Your inspect output means Traefik runs with:

```text
Network = host
```

That is **normal on Hostinger**. There is **no** `traefik-proxy` / `traefik-tvdm_default` bridge network to join.

What this means for Pandit G:

- App is a **separate** `docker compose` project  
- Traefik finds it via **Docker labels** + `docker.sock`  
- App publishes `127.0.0.1:3000` (localhost only)  
- Public HTTPS goes through Traefik on ports **80/443**

Confirm Traefik owns web ports:

```bash
ss -tlnp | grep -E ':80|:443'
```

You should see something listening on `80` and `443`.

Repo `docker-compose.yml` is already updated for this **host-mode Traefik** setup (no external network required).

---



# PART C — Put the code on the VPS (SSH)  ← do this next

Docker Manager UI alone cannot build your Next.js app reliably. Use **SSH / Terminal**.

## Step C1 — Stay in Terminal (you are already root@srv1829928)

## Step C2 — Install git (if missing)

```bash
apt update && apt install -y git
```

## Step C3 — Clone the repository

```bash
mkdir -p /opt
cd /opt
git clone https://github.com/YOUR_USERNAME/pandit-g.git
cd pandit-g
```

Private repo example:

```bash
git clone https://YOUR_GITHUB_TOKEN@github.com/YOUR_USERNAME/pandit-g.git
```

## Step C4 — Create production `.env`

```bash
cd /opt/pandit-g
cp .env.example .env
nano .env
```

Paste values from your local `.env.local`, but **must** set:

```env
APP_URL=https://panditg.live
```

Also keep WhatsApp / XAI / Mongo / Razorpay / Admin vars.

Save: `Ctrl+O`, Enter, `Ctrl+X`.

```bash
chmod 600 /opt/pandit-g/.env
```

---



# PART D — Build & run Pandit G



## Step D1 — Build and start

```bash
cd /opt/pandit-g
docker compose up -d --build
```

First build takes **5–15 minutes**.

Watch logs:

```bash
docker compose logs -f pandit-g
```

You should see Next.js listening on port 3000. `Ctrl+C` stops following logs (container keeps running).

## Step D3 — Check container status

```bash
docker ps
docker compose ps
```

`pandit-g` should be **Up**.

## Step D4 — Test from the VPS

```bash
curl -I http://127.0.0.1:3000
```

Or through Traefik (after DNS + SSL):

```bash
curl -I https://panditg.live
```

Open in browser:

- `https://panditg.live`  
- `https://panditg.live/admin`

---



# PART E — Optional: use Hostinger Docker Manager UI

You can still manage / restart from the panel.

### Option E1 — Compose manually (YAML already running via SSH)

If the project was started by SSH `docker compose`, it often appears under Docker Manager **Projects**. You can:

- View logs  
- Restart / stop  
- Redeploy after edits



### Option E2 — Deploy / redeploy from panel

1. Docker Manager → **Compose** → **Compose manually**.
2. Project name: `pandit-g`.
3. Paste contents of `docker-compose.yml`.
4. **Important:** panel paste alone may **not** upload your source code. Prefer:
  - SSH clone in `/opt/pandit-g`, then  
  - In terminal: `docker compose up -d --build`



### Option E3 — Compose from URL

Works best if the **raw** `docker-compose.yml` is public **and** Hostinger can build from that repo. For private Next.js apps, **SSH clone + build** is more reliable.

---



# PART F — Update WhatsApp webhook (leave Vercel)



## Step F1 — Meta Developer Console

1. [developers.facebook.com](https://developers.facebook.com) → your app.
2. **WhatsApp** → **Configuration** (or Webhooks).
3. Set:


| Field        | Value                                         |
| ------------ | --------------------------------------------- |
| Callback URL | `https://panditg.live/api/webhooks/whatsapp`  |
| Verify token | Same as `WHATSAPP_VERIFY_TOKEN` in VPS `.env` |


1. Click **Verify and save**.
2. Subscribe to webhook fields you already use (at least **messages**).



## Step F2 — Quick verify

Send `Hi` to the WhatsApp business number.  
You should get Pandit G’s intro reply within a few seconds (plus typing delay).

If verify fails:

- Domain SSL must be green (https works in browser).  
- Container must be running.  
- Token must match `.env` exactly (no extra spaces/quotes).

Check logs:

```bash
cd /opt/pandit-g && docker compose logs -f --tail=100 pandit-g
```

---



# PART G — Update Razorpay webhooks

1. Razorpay Dashboard → **Account & Settings** → **Webhooks** (or Developers → Webhooks).
2. Change URL from old Vercel host to:
  ```text
   https://panditg.live/api/webhooks/razorpay
  ```
   (Use the exact path your repo already exposes — if your route name differs, match the code under `app/api/...`.)
3. Secret must match `RAZORPAY_WEBHOOK_SECRET` in VPS `.env`.
4. Keep the same events as before (payment link paid / payment captured, etc.).

Do a small test payment after DNS is stable.

---



# PART H — Retire Vercel cleanly

1. Confirm WhatsApp + website work on `panditg.live`.
2. In Meta / Razorpay, **no** remaining `*.vercel.app` URLs.
3. DNS: no Vercel CNAMEs left.
4. Vercel project → **Settings** → pause or delete when ready (optional).
5. Remove Vercel env vars copies you’d rather not leave hanging.

---



# PART I — Day-2 operations (SSH)



## Redeploy after code changes

```bash
cd /opt/pandit-g
git pull
docker compose up -d --build
```



## View logs

```bash
docker compose logs -f --tail=200 pandit-g
```



## Restart only the app

```bash
docker compose restart pandit-g
```



## Update only `.env` (no rebuild)

```bash
nano /opt/pandit-g/.env
docker compose up -d
```

(`env_file` is re-read on recreate; if values don’t apply, run:)

```bash
docker compose up -d --force-recreate pandit-g
```



## Stop / start

```bash
docker compose stop
docker compose start
```



## Full wipe container (keeps code + .env)

```bash
docker compose down
docker compose up -d --build
```

---



# PART J — Firewall & security



## Firewall (Hostinger / UFW)

Allow:


| Port    | Why                            |
| ------- | ------------------------------ |
| **22**  | SSH                            |
| **80**  | HTTP (Traefik / Let’s Encrypt) |
| **443** | HTTPS                          |


Do **not** expose Mongo ports. App port **3000** should stay internal (Traefik → container).

Example (if using UFW):

```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status
```



## Secrets hygiene

- Strong `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET`  
- Strong `INTERNAL_API_SECRET`  
- Rotate WhatsApp / Razorpay tokens if they were ever committed to git  
- Prefer private GitHub repo

---



# PART K — Typing delay on VPS (better than Hobby)

On Vercel Hobby, delay was capped. On VPS you can use longer natural typing in `.env`:

```env
FUNNEL_READING_DELAY_MS=4000
TYPING_MS_PER_CHAR=40
TYPING_BASE_MS=2000
TYPING_MIN_MS=2500
TYPING_MAX_MS=20000
APP_URL=https://panditg.live
```

`APP_URL` must be your real domain so delayed-send / absolute links resolve correctly.

---



# PART L — Troubleshooting



### 1) `https://panditg.live` does not load

- DNS A record points to VPS IP? (`nslookup panditg.live`)  
- Traefik running? (`docker ps`)  
- Container on same network as Traefik?  

```bash
docker inspect traefik-tvdm-traefik-1 --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}'
docker inspect pandit-g --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}'
```

Both containers must list the **same** network name.



### 2) SSL certificate pending / browser warning

- DNS must already point to VPS.  
- Ports 80/443 open.  
- Wait a few minutes after first deploy; Traefik + Let’s Encrypt need a successful HTTP challenge.  
- Check Traefik logs in Docker Manager or:

```bash
docker logs <traefik_container_name>
```



### 3) WhatsApp webhook verify fails

- Callback URL exact: `https://panditg.live/api/webhooks/whatsapp`  
- `WHATSAPP_VERIFY_TOKEN` matches Meta  
- App container healthy



### 4) Build fails on VPS (out of memory)

Next.js builds need RAM. On small VPS:

```bash
# temporary swap (2GB example)
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
```

Then rebuild:

```bash
cd /opt/pandit-g && docker compose up -d --build
```



### 5) `external network … not found`

Your Traefik project is `traefik-tvdm` → network is usually `traefik-tvdm_default`.

```bash
docker inspect traefik-tvdm-traefik-1 --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}'
```

Put that exact name into `docker-compose.yml` (`name:` + `traefik.docker.network=`), then:

```bash
cd /opt/pandit-g && docker compose up -d --build
```

Do **not** randomly `docker network create traefik-proxy` unless Traefik is also on that network.

### 6) Container runs but site 502

- Traefik label port must be **3000** (matches Next.js).  
- Container must be on Traefik network.  
- Recreate:

```bash
cd /opt/pandit-g && docker compose up -d --force-recreate
```



### 7) Delayed typing / internal send fails

Ensure:

```env
APP_URL=https://panditg.live
INTERNAL_API_SECRET=...same secret used by delayed-send...
```

---



# PART M — Quick command cheat sheet

```bash
# Go to project
cd /opt/pandit-g

# Deploy / update
git pull
docker compose up -d --build

# Logs
docker compose logs -f pandit-g

# Status
docker compose ps
docker ps

# Shell inside container (debug)
docker compose exec pandit-g sh
```

---



# PART N — Order of operations (do this sequence)

1. Point DNS `panditg.live` → VPS IP
2. Deploy **Traefik** from Docker Manager
3. SSH → `git clone` into `/opt/pandit-g`
4. Create `.env` from `.env.example` (`APP_URL=https://panditg.live`)
5. `docker compose up -d --build`
6. Open `https://panditg.live` (and `/admin`)
7. Update **WhatsApp** webhook URL + verify
8. Update **Razorpay** webhook URL
9. Test WhatsApp chat + a payment
10. Remove Vercel DNS / old webhooks

---



## Files added for Docker (in this repo)


| File                 | Purpose                                    |
| -------------------- | ------------------------------------------ |
| `Dockerfile`         | Builds Next.js standalone production image |
| `docker-compose.yml` | App + Traefik labels for `panditg.live`    |
| `.dockerignore`      | Keeps image small / excludes secrets       |
| `.env.example`       | Template for VPS `.env`                    |
| `next.config.ts`     | `output: "standalone"` for Docker          |
| `deployment.md`      | This guide                                 |


---



## Support notes

- Prefer **SSH build** for reliability; use Docker Manager for logs/restart/UI.  
- Keep Mongo on Atlas unless you intentionally migrate the database.  
- After every `git pull` that changes dependencies or `Dockerfile`, use `--build`.

Once DNS + Traefik + `.env` + webhooks are correct, you are fully off Vercel.
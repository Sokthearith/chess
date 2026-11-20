# Deploying Counterplay

Two free ways to put the site online with your own domain (for example the free one from Name.com in the GitHub Student Pack). Both run the same thing: the app in Docker, with its database on a disk that survives restarts.

| | A. Oracle Cloud Always Free | B. Your own PC + Cloudflare Tunnel |
|---|---|---|
| Cost | Free, no time limit (card needed to verify) | Free, no card |
| Always on | Yes | Only while your PC is on |
| Setup | ~20 minutes | ~10 minutes |

---

## A. Oracle Cloud Always Free (recommended)

### 1. Create the server
1. Sign up at oracle.com/cloud/free. **Choose Singapore as your home region**: it is closest to Cambodia, and it cannot be changed later.
2. Menu → Compute → Instances → **Create instance**.
   - Image: **Canonical Ubuntu 24.04**.
   - Shape: **Ampere (VM.Standard.A1.Flex)**, 1 OCPU and 6 GB memory is plenty (the free allowance goes up to 4 OCPU / 24 GB). If it says "out of capacity", try again later or pick **VM.Standard.E2.1.Micro** (AMD, always free, slower).
   - Networking: keep "Assign a public IPv4 address" on.
   - SSH keys: "Generate a key pair for me" and **download the private key**.
3. When it is running, copy its **Public IP address**.

### 2. Open the web ports in Oracle's firewall
Instance page → the **Subnet** link → **Security Lists** → Default Security List → **Add Ingress Rules**, twice:
- Source CIDR `0.0.0.0/0`, IP protocol TCP, destination port `80`
- Source CIDR `0.0.0.0/0`, IP protocol TCP, destination port `443`

(The setup script opens the same ports inside the machine; Oracle needs both.)

### 3. Point your domain at it (Name.com)
My Domains → your domain → **Manage DNS Records**:
- Type `A`, Host *(empty)*, Answer *your server's public IP*
- Type `A`, Host `www`, Answer *the same IP*

Remove any default "parking" A/CNAME records for the same hosts. DNS takes a few minutes, sometimes up to an hour.

### 4. Install
On your computer (Linux/macOS terminal, or Windows PowerShell):
```
ssh -i path/to/the-private-key.key ubuntu@YOUR_SERVER_IP
```
Then on the server, with your domain:
```
curl -fsSL https://raw.githubusercontent.com/Sokthearith/chess/main/deploy/setup.sh | sudo bash -s -- yourdomain.com
```
The first build takes a few minutes. Then open `https://yourdomain.com`. Caddy gets the HTTPS certificate on the first visit; if the domain does not point at the server yet, wait for DNS and reload.

---

## B. Your own PC + Cloudflare Tunnel

Nothing to open on your router; Cloudflare gives the site HTTPS.

1. Make a free Cloudflare account and **add your domain**. Cloudflare shows two nameservers: at Name.com, My Domains → your domain → **Nameservers**, replace Name.com's with Cloudflare's.
2. Cloudflare dashboard → **Zero Trust** → Networks → **Tunnels** → Create a tunnel (Cloudflared). Name it, then copy the **token** (the long string after `--token` in the install command; do not run that command).
3. In the tunnel → **Public Hostname** → Add: Domain *yourdomain.com*, Service type **HTTP**, URL **`app:8080`**.
4. On your PC (Docker installed):
   ```
   git clone https://github.com/Sokthearith/chess.git && cd chess/deploy
   printf 'COMPOSE_PROFILES=tunnel\nTUNNEL_TOKEN=%s\nSESSION_SECRET=%s\n' 'PASTE_TOKEN_HERE' "$(openssl rand -hex 32)" > .env
   docker compose up -d --build
   ```
5. Open `https://yourdomain.com`.

---

## Everyday commands (run in `/opt/counterplay/deploy` on the server, or `chess/deploy` on your PC)

| | |
|---|---|
| Update to the latest code on GitHub | `sudo ./update.sh` (live games are saved and carry on) |
| Back up the database | `sudo ./backup.sh` → `deploy/backups/` (copy these off the machine now and then) |
| See the logs | `sudo docker compose logs -f app` |
| Restart | `sudo docker compose restart app` |
| Is it healthy? | `curl https://yourdomain.com/healthz` |

`deploy/.env` holds the session secret and tunnel token. It is ignored by git; keep it private. Losing it only signs everyone out.

#!/usr/bin/env bash
# Sets up Counterplay on a fresh Ubuntu server (Oracle Cloud Always Free, or any VPS)
# with HTTPS for your domain. Safe to run again: it updates and restarts.
#
#   curl -fsSL https://raw.githubusercontent.com/Sokthearith/chess/main/deploy/setup.sh | sudo bash -s -- yourdomain.com
set -euo pipefail

DOMAIN="${1:-}"
REPO="${REPO:-https://github.com/Sokthearith/chess.git}"
DIR="${DIR:-/opt/counterplay}"

if [ "$(id -u)" != 0 ]; then echo "Run with sudo." >&2; exit 1; fi
if [ -z "$DOMAIN" ] && [ ! -f "$DIR/deploy/.env" ]; then echo "Usage: setup.sh yourdomain.com" >&2; exit 1; fi

echo "==> Packages"
apt-get update -qq
apt-get install -y -qq git curl openssl >/dev/null

# Small machines run out of memory while building; 2 GB of swap avoids that.
if [ "$(free -m | awk '/^Mem:/{print $2}')" -lt 2000 ] && [ -z "$(swapon --show)" ]; then
  echo "==> Adding 2 GB swap"
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

if ! command -v docker >/dev/null; then
  echo "==> Installing Docker"
  curl -fsSL https://get.docker.com | sh >/dev/null
fi

# Oracle's Ubuntu images block every port except SSH in iptables. Open web ports.
echo "==> Opening ports 80 and 443"
if iptables -S INPUT 2>/dev/null | grep -q -- '-j REJECT'; then
  for rule in "-p tcp --dport 80" "-p tcp --dport 443" "-p udp --dport 443"; do
    # shellcheck disable=SC2086
    iptables -C INPUT $rule -j ACCEPT 2>/dev/null || iptables -I INPUT 1 $rule -j ACCEPT
  done
  command -v netfilter-persistent >/dev/null && netfilter-persistent save >/dev/null 2>&1 || true
fi
if command -v ufw >/dev/null && ufw status | grep -q active; then ufw allow 80/tcp >/dev/null; ufw allow 443 >/dev/null; fi

echo "==> Code"
if [ -d "$DIR/.git" ]; then git -C "$DIR" pull --ff-only -q; else git clone -q "$REPO" "$DIR"; fi

cd "$DIR/deploy"
if [ ! -f .env ]; then
  echo "==> Writing deploy/.env (keep it private)"
  umask 077
  printf 'COMPOSE_PROFILES=https\nDOMAIN=%s\nSESSION_SECRET=%s\n' "$DOMAIN" "$(openssl rand -hex 32)" > .env
elif [ -n "$DOMAIN" ]; then
  sed -i "s/^DOMAIN=.*/DOMAIN=$DOMAIN/" .env
fi

echo "==> Building and starting (the first build takes a few minutes)"
docker compose up -d --build
docker image prune -f >/dev/null

. ./.env
echo
echo "Done. Open https://${DOMAIN}"
echo "If the page does not load yet: check the DNS A record points to $(curl -fsS https://api.ipify.org || echo 'this server'),"
echo "and that ports 80 and 443 are open in your cloud firewall (Oracle: the subnet's security list)."

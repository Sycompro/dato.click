#!/bin/sh

echo "--- STARTING DATO.CLICK INFRASTRUCTURE ---"

# 1. Start Cloudflare Tunnel Receiver in the background
if [ -n "$CF_CLIENT_ID" ] && [ -n "$CF_CLIENT_SECRET" ]; then
    echo "Configuring Cloudflare Tunnel Bridge..."
    
    # Iniciamos en modo silencioso (solo errores)
    cloudflared access tcp --hostname db.syscom.click --listener 0.0.0.0:1433 --service-token-id "$CF_CLIENT_ID" --service-token-secret "$CF_CLIENT_SECRET" > /app/tunnel.log 2>&1 &
    
    echo "Tunnel established."
    sleep 2
else
    echo "WARNING: CF_CLIENT_ID or CF_CLIENT_SECRET not set."
fi

# 2. Start Next.js
echo "Starting Next.js Application..."
npm start

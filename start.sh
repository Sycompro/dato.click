#!/bin/sh

echo "--- STARTING DATO.CLICK INFRASTRUCTURE ---"

# 1. Start Cloudflare Tunnel Receiver in the background
if [ -n "$CF_CLIENT_ID" ] && [ -n "$CF_CLIENT_SECRET" ]; then
    echo "Configuring Cloudflare Tunnel for db.syscom.click..."
    
    # Iniciamos con log level debug para ver el apretón de manos (handshake)
    cloudflared access tcp --hostname db.syscom.click --listener 0.0.0.0:1433 --service-token-id "$CF_CLIENT_ID" --service-token-secret "$CF_CLIENT_SECRET" --loglevel debug > /app/tunnel.log 2>&1 &
    
    echo "Tunnel initiated. Showing first logs:"
    sleep 3
    cat /app/tunnel.log
else
    echo "WARNING: CF_CLIENT_ID or CF_CLIENT_SECRET not set."
fi

# 2. Start Next.js
echo "Starting Next.js..."
# Lanzamos un proceso en segundo plano que imprime el log del túnel cada vez que cambia, 
# para verlo en la consola de Railway
tail -f /app/tunnel.log &
npm start

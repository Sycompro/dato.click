#!/bin/sh

echo "--- STARTING DATO.CLICK INFRASTRUCTURE ---"

# 1. Start Cloudflare Tunnel Receiver in the background
if [ -n "$CF_CLIENT_ID" ] && [ -n "$CF_CLIENT_SECRET" ]; then
    echo "Configuring Cloudflare Tunnel for db.syscom.click..."
    
    # Usamos la sintaxis más simple posible para evitar el error de "multiple origin urls"
    # Redirigimos el tráfico de db.syscom.click al puerto local 1433
    cloudflared access tcp --hostname db.syscom.click --listener 0.0.0.0:1433 --service-token-id "$CF_CLIENT_ID" --service-token-secret "$CF_CLIENT_SECRET" > /app/tunnel.log 2>&1 &
    
    echo "Tunnel initiated in background. Check /app/tunnel.log if connection fails."
    # Esperar un poco a que el proceso se asiente
    sleep 5
else
    echo "WARNING: CF_CLIENT_ID or CF_CLIENT_SECRET not set."
fi

# 2. Start Next.js
echo "Starting Next.js Application on 127.0.0.1:1433..."
npm start

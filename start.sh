#!/bin/sh

echo "--- STARTING DATO.CLICK INFRASTRUCTURE ---"

# 0. Check where cloudflared is
CF_PATH=$(command -v cloudflared)
if [ -n "$CF_PATH" ]; then
    echo "Found cloudflared at: $CF_PATH"
else
    echo "ERROR: cloudflared NOT FOUND in PATH."
fi

# 1. Start Cloudflare Tunnel Receiver in the background
if [ -n "$CF_CLIENT_ID" ] && [ -n "$CF_CLIENT_SECRET" ]; then
    echo "Configuring Cloudflare Tunnel for db.syscom.click..."
    pkill cloudflared
    
    # Iniciar el túnel TCP Access
    # Usamos 0.0.0.0 para asegurarnos de que escuche en todas las interfaces dentro del contenedor
    cloudflared access tcp --hostname db.syscom.click --listener 0.0.0.0:1433 --service-token-id $CF_CLIENT_ID --service-token-secret $CF_CLIENT_SECRET > /app/tunnel.log 2>&1 &
    
    echo "Waiting for tunnel to stabilize (12s)..."
    sleep 12
    
    if pgrep cloudflared > /dev/null; then
        echo "SUCCESS: Cloudflare Tunnel client is running."
    else
        echo "ERROR: Cloudflare Tunnel failed to start. Logs:"
        cat /app/tunnel.log
    fi
else
    echo "WARNING: CF_CLIENT_ID or CF_CLIENT_SECRET not set."
fi

# 2. Check if port 1433 is listening
echo "Checking port 1433 (SQL Bridge)..."
if command -v nc > /dev/null; then
    # Probamos tanto localhost como 0.0.0.0
    if nc -z -v 127.0.0.1 1433 2>&1; then
        echo "SUCCESS: Port 1433 is active on 127.0.0.1"
    else
        echo "WARNING: Port 1433 not responding on 127.0.0.1. Trying 0.0.0.0..."
        if nc -z -v 0.0.0.0 1433 2>&1; then
            echo "SUCCESS: Port 1433 is active on 0.0.0.0"
        else
            echo "CRITICAL: Port 1433 is not listening anywhere!"
        fi
    fi
else
    echo "Netcat (nc) not found."
fi

# 3. Start Next.js
echo "Starting Next.js Application..."
npm start

#!/bin/sh

echo "--- STARTING DATO.CLICK INFRASTRUCTURE ---"

# 1. Start Cloudflare Tunnel Receiver in the background
if [ -n "$CF_CLIENT_ID" ] && [ -n "$CF_CLIENT_SECRET" ]; then
    echo "Configuring Cloudflare Tunnel for db.syscom.click..."
    cloudflared access tcp --hostname db.syscom.click --listener 127.0.0.1:1433 --service-token-id $CF_CLIENT_ID --service-token-secret $CF_CLIENT_SECRET > /tmp/tunnel.log 2>&1 &
    
    # Wait for the tunnel to bind to the port
    echo "Waiting for tunnel to stabilize (10s)..."
    sleep 10
    
    # Check if cloudflared is still running
    if pgrep cloudflared > /dev/null; then
        echo "Cloudflare Tunnel client started successfully."
    else
        echo "ERROR: Cloudflare Tunnel client failed to start. Check /tmp/tunnel.log"
        cat /tmp/tunnel.log
    fi
else
    echo "WARNING: CF_CLIENT_ID or CF_CLIENT_SECRET not set. Tunnel won't start."
fi

# 2. Check if port 1433 is listening (if inside Railway)
if command -v nc > /dev/null; then
    if nc -z 127.0.0.1 1433; then
        echo "SUCCESS: Port 1433 is listening."
    else
        echo "WARNING: Port 1433 is NOT listening yet."
    fi
fi

# 3. Start Next.js
echo "Starting Application..."
npm start

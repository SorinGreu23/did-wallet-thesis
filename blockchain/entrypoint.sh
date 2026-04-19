#!/bin/sh

STATE_FILE=/data/hardhat-state.json
DEPLOYED_FLAG=/data/deployed

mkdir -p /data

echo "Starting Hardhat node..."
npx hardhat node --hostname 0.0.0.0 &
NODE_PID=$!

# Forward SIGTERM/SIGINT to the node process for clean container stop
trap "kill $NODE_PID 2>/dev/null; exit 0" TERM INT

echo "Waiting for node to be ready..."
until node -e "
  const http = require('http');
  const req = http.request({ host:'localhost', port:8545, method:'POST',
    headers:{'Content-Type':'application/json'} }, (res) => {
    process.exit(res.statusCode === 200 ? 0 : 1);
  });
  req.on('error', () => process.exit(1));
  req.end(JSON.stringify({jsonrpc:'2.0',method:'eth_blockNumber',params:[],id:1}));
" 2>/dev/null; do
  if ! kill -0 $NODE_PID 2>/dev/null; then
    echo "ERROR: Hardhat node exited unexpectedly during startup"
    exit 1
  fi
  sleep 2
done

if [ -f "$DEPLOYED_FLAG" ]; then
  echo "Chain state restored from $STATE_FILE — skipping deployment."
  mkdir -p /app/deployments
  cp /data/latest.json /app/deployments/latest.json
else
  echo "Node ready. Deploying contracts..."
  if ! npx hardhat run scripts/deploy.ts --network localhost; then
    echo "ERROR: Contract deployment failed"
    kill $NODE_PID 2>/dev/null
    exit 1
  fi
  cp /app/deployments/latest.json /data/latest.json
  touch "$DEPLOYED_FLAG"
  echo "Contracts deployed."
fi

echo "Node is running."
wait $NODE_PID

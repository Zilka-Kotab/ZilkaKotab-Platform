<!-- API Server -->
set -a; source .env.local; set +a
PORT=3001 pnpm --filter @workspace/api-server run dev
<!-- Frontend -->
set -a; source .env.local; set +a
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/zilka-kotab run dev
Steps to deploy this server to Render and test locally

1) Prepare repository
- Push this repository to GitHub (branch `main`), or use your preferred remote.

2) Add `render.yaml` (already added) — adjust `repo` field to your GitHub repo URL and `branch` if needed.

3) Create a new Web Service on Render
- Go to https://dashboard.render.com
- New -> Web Service -> Connect your GitHub
- Select the repo and branch
- Render will detect Node; set the following values if prompted:
  - Build Command: `npm ci`
  - Start Command: `npm run start`
  - Environment: `Node`

4) Set environment variables on Render (in the dashboard -> Environment)
- `SUPABASE_URL` = your supabase URL (https://xyz.supabase.co)
- `SUPABASE_SERVICE_ROLE_KEY` = your service role key (KEEP SECRET)
- `SHIPROCKET_WEBHOOK_TOKEN` = the token your webhook expects (e.g. `doyouknowthis`)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `VITE_PHP_BASE_URL` = URL where `public/order-status-email.php` is reachable (e.g. `https://site.example.com/`)

5) Deploy
- Render will build and deploy. Watch the deploy logs for `Server running on port` and health checks.

6) Verify from your local machine
- Once Render deploys, get the service URL (e.g. `https://aximake-server.onrender.com`)
- Check health:
  ```bash
  curl https://aximake-server.onrender.com/api/health
  ```
- Test the webhook endpoint (Render must be able to reach your PHP endpoint; for local PHP you can use a public URL or temporarily host PHP on Render or any public host):
  ```bash
  curl -X POST https://aximake-server.onrender.com/api/shiprocket-webhook \
    -H 'Content-Type: application/json' \
    -H 'x-api-key: YOUR_TOKEN' \
    --data-raw '{"order_id":"AXMK-26TNKBZ2","current_status":"SHIPPED","scans":[]}'
  ```

7) Local simulation of Render environment
- To run locally with the same PORT variable Render uses, run:
  ```bash
  PORT=5050 NODE_ENV=production node server.cjs
  ```
- Or use `npm run start` after exporting `PORT`:
  ```bash
  export PORT=5050
  npm run start
  ```
- Then test locally:
  ```bash
  curl http://localhost:5050/api/health
  ```

8) Common issues
- Make sure `server.cjs` reads `process.env.PORT` (it does). If Render health checks fail, check logs for missing env vars (Supabase key, SMTP credentials).
- If emails fail, inspect `public/smtp-debug.log` and `public/email-error.log` on the server (or stream logs from Render dashboard).

If you want, I can:
- create a small `render.postdeploy.sh` script to run migrations after deploy (optional), and
- Help you set up a temporary public PHP endpoint for `order-status-email.php` (deploy it on Render as a separate static or PHP host), or
- Run the local start command now to simulate Render and show health response.

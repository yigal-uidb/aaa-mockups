#!/bin/bash
# restore the snapshot and restart the demo server
pkill -f "demo-herzliya/serve.ts"; sleep 1
pg_restore --clean --if-exists -d postgres://aaa:aaa@localhost/aaa_dev demo-herzliya/snap.dump 2>/dev/null
cd /home/user/aaa && (ANTHROPIC_API_KEY=scripted-demo RESEND_API_KEY=demo-not-real AAA_MAIL_FROM="עיריית הרצליה <moked@herzliya.example>" nohup npx tsx --env-file=.env demo-herzliya/serve.ts > /tmp/claude-0/aaa-demo.log 2>&1 &)
for i in $(seq 1 30); do curl -s localhost:3000/api/health >/dev/null && break; sleep 0.5; done

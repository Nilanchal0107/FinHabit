#!/usr/bin/env bash
# scheduler-setup.sh
# ─────────────────────────────────────────────────────────────────────────────
# Run this script ONCE after deploying to Cloud Run to register all
# Cloud Scheduler jobs.
#
# Usage:
#   chmod +x scheduler-setup.sh
#   CLOUD_RUN_URL=https://YOUR_CLOUD_RUN_URL \
#   SCHEDULER_SECRET=YOUR_SECRET \
#   ./scheduler-setup.sh
#
# Prerequisites:
#   - gcloud CLI installed and authenticated
#   - Cloud Scheduler API enabled (gcloud services enable cloudscheduler.googleapis.com)
#   - Cloud Run service already deployed

set -euo pipefail

CLOUD_RUN_URL="${CLOUD_RUN_URL:?CLOUD_RUN_URL env var required}"
SCHEDULER_SECRET="${SCHEDULER_SECRET:?SCHEDULER_SECRET env var required}"
REGION="asia-south1"  # Mumbai — IST-close region for data localisation

echo "Setting up Cloud Scheduler jobs in ${REGION}..."
echo "Cloud Run URL: ${CLOUD_RUN_URL}"

# ── Weekly Insights — every Monday 9 AM IST (3:30 AM UTC) ────────────────────
gcloud scheduler jobs create http finhabits-weekly-insights \
  --schedule="0 3 * * MON" \
  --uri="${CLOUD_RUN_URL}/api/trigger-insights" \
  --http-method=POST \
  --headers="x-scheduler-secret=${SCHEDULER_SECRET},Content-Type=application/json" \
  --message-body='{"period":"weekly"}' \
  --time-zone="UTC" \
  --location="${REGION}" \
  --description="Generate weekly AI insights for all users (9 AM IST Monday)" \
  --attempt-deadline=540s \
  2>/dev/null && echo "✓ finhabits-weekly-insights created" \
  || echo "⚠ finhabits-weekly-insights already exists — skipping"

# ── Monthly Insights — 1st of month 9 AM IST (3:30 AM UTC) ──────────────────
gcloud scheduler jobs create http finhabits-monthly-insights \
  --schedule="0 3 1 * *" \
  --uri="${CLOUD_RUN_URL}/api/trigger-insights" \
  --http-method=POST \
  --headers="x-scheduler-secret=${SCHEDULER_SECRET},Content-Type=application/json" \
  --message-body='{"period":"monthly"}' \
  --time-zone="UTC" \
  --location="${REGION}" \
  --description="Generate monthly AI insights for all users (9 AM IST 1st of month)" \
  --attempt-deadline=540s \
  2>/dev/null && echo "✓ finhabits-monthly-insights created" \
  || echo "⚠ finhabits-monthly-insights already exists — skipping"

# ── Daily Reminder — 9 PM IST (3:30 PM UTC) ──────────────────────────────────
gcloud scheduler jobs create http finhabits-daily-reminder \
  --schedule="30 15 * * *" \
  --uri="${CLOUD_RUN_URL}/api/send-reminders" \
  --http-method=POST \
  --headers="x-scheduler-secret=${SCHEDULER_SECRET}" \
  --time-zone="UTC" \
  --location="${REGION}" \
  --description="Send FCM push reminders to users who haven't logged today (9 PM IST)" \
  --attempt-deadline=120s \
  2>/dev/null && echo "✓ finhabits-daily-reminder created" \
  || echo "⚠ finhabits-daily-reminder already exists — skipping"

echo ""
echo "Done! Cloud Scheduler jobs configured."
echo "Verify at: https://console.cloud.google.com/cloudscheduler?region=${REGION}"

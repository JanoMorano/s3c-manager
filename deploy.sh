#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# deploy.sh — Service Catalogue deployment helper (PostgreSQL runtime)
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh [start|stop|restart|backup|restore|logs|status|rebuild-db]
#
# Prerequisites:
#   - Docker and Docker Compose installed
#   - `.env` populated (at minimum POSTGRES_PASSWORD + JWT_SECRET)
#   - sc-app:latest already loaded via `docker load -i sc-images-amd64.tar`
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
ENV_FILE="${ENV_FILE:-.env}"
COMPOSE="docker compose -f $COMPOSE_FILE"

[ -f "$ENV_FILE" ] && COMPOSE="$COMPOSE --env-file $ENV_FILE"

APP_NAME="Service Catalogue"
APP_URL="http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo localhost):8080"

# ── .env check ────────────────────────────────────────────────────────────────
check_env() {
  if [ ! -f "$ENV_FILE" ]; then
    echo "⚠️  File $ENV_FILE not found."
    echo "   Create it with: cp .env.example .env  (or follow docker-compose.yml)"
    echo "   Required variables: POSTGRES_PASSWORD, JWT_SECRET"
  fi
}

backup_notice() {
  echo "⚠️  Before destructive database changes, create a fresh backup first:"
  echo "   ./scripts/backup-postgres.sh"
  echo "   Restore rehearsal: ./scripts/restore-postgres.sh --file <backup.dump> --recreate-db"
}

case "${1:-start}" in

  start)
    check_env
    echo "🚀 Starting $APP_NAME..."
    $COMPOSE up -d
    echo ""
    echo "✅ Done!"
    echo "   Frontend : $APP_URL"
    echo "   API      : http://localhost:4000/api/health"
    echo ""
    echo "⏳ On first startup, allow ~60s for database initialization."
    echo "   Progress: ./deploy.sh logs app"
    ;;

  stop)
    echo "🛑 Stopping $APP_NAME..."
    $COMPOSE down
    echo "✅ Stopped."
    ;;

  restart)
    echo "🔄 Restarting $APP_NAME..."
    $COMPOSE restart
    echo "✅ Restart complete."
    ;;

  backup)
    shift || true
    ./scripts/backup-postgres.sh "$@"
    ;;

  restore)
    shift || true
    ./scripts/restore-postgres.sh "$@"
    ;;

  pull-image)
    TAR="${2:-sc-images-amd64.tar}"
    if [ ! -f "$TAR" ]; then
      echo "❌ File $TAR not found."
      exit 1
    fi
    echo "▶ Loading images from $TAR..."
    docker load -i "$TAR"
    echo "✅ Image loaded."
    echo "   Next run: ./deploy.sh start"
    ;;

  rebuild-db)
    backup_notice
    echo "⚠️  WARNING: This will DELETE all PostgreSQL data and reinitialize the database!"
    echo "   Volumes: sc-pgdata (PostgreSQL data)"
    read -rp "Really continue? Type 'yes' to confirm: " confirm
    if [ "$confirm" = "yes" ]; then
      echo "▶ Stopping the stack..."
      $COMPOSE down -v
      echo "▶ Starting again (init-db-postgres.sh will run automatically)..."
      $COMPOSE up -d
      echo "✅ DB rebuild complete."
      echo "   Progress: ./deploy.sh logs app"
    else
      echo "Aborted — no data was deleted."
    fi
    ;;

  logs)
    SERVICE="${2:-}"
    TAIL="${TAIL:-100}"
    if [ -z "$SERVICE" ]; then
      $COMPOSE logs -f --tail="$TAIL"
    else
      case "$SERVICE" in
        app|fe|web|api|mw) $COMPOSE logs -f --tail="$TAIL" app ;;
        db|pg|postgres)    $COMPOSE logs -f --tail="$TAIL" postgres ;;
        *)                 $COMPOSE logs -f --tail="$TAIL" "$SERVICE" ;;
      esac
    fi
    ;;

  status)
    echo "📊 Container status:"
    $COMPOSE ps
    echo ""
    echo "🏥 Health check:"
    docker inspect sc-app     --format='App:       {{.State.Health.Status}}' 2>/dev/null || echo "App: N/A"
    docker inspect sc-postgres --format='PostgreSQL: {{.State.Health.Status}}' 2>/dev/null || echo "PostgreSQL: N/A"
    echo ""
    echo "🌐 API health:"
    curl -sf http://localhost:4000/api/health 2>/dev/null && echo "" || echo "API unavailable (container still starting?)"
    ;;

  update)
    echo "🔄 Update the application from a new tar archive:"
    echo ""
    echo "  1. Upload the new tar to the server:"
    echo "     scp sc-images-amd64.tar user@server:/path/"
    echo ""
    echo "  2. Load the new image:"
    echo "     ./deploy.sh pull-image sc-images-amd64.tar"
    echo ""
    echo "  3. Restart the stack:"
    echo "     ./deploy.sh restart"
    ;;

  exec)
    shift
    SERVICE="${1:-app}"
    shift || true
    CMD="${*:-sh}"
    $COMPOSE exec "$SERVICE" $CMD
    ;;

  *)
    echo "Usage: $0 {start|stop|restart|pull-image [tar]|backup|restore|rebuild-db|logs [app|db]|status|update|exec [service] [cmd]}"
    echo ""
    echo "Examples:"
    echo "  ./deploy.sh start                  # start the stack"
    echo "  ./deploy.sh logs app               # live logs from the app container"
    echo "  ./deploy.sh pull-image my.tar      # load images from a tar archive"
    echo "  ./deploy.sh backup                 # create a PostgreSQL backup"
    echo "  ./deploy.sh restore --file backup.dump --recreate-db"
    echo "  ./deploy.sh exec app sh            # shell inside the app container"
    echo "  ./deploy.sh rebuild-db             # wipe and reinitialize the DB"
    exit 1
    ;;
esac

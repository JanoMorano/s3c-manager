#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# build-amd64.sh — build Docker images for QNAP / Portainer (linux/amd64)
#
# Post-migration architecture: ONE app container (Next.js + Express together)
#                              + a separate postgres container (from Docker Hub)
#
# Version is read automatically from docker-compose.yml (APP_VERSION default).
# Output filenames include the version and architecture, e.g.:
#   - sc-images-amd64-1.1.2.tar
#   - sc-qnap-bundle-amd64-1.1.2.tar.gz
#
# Usage:
#   chmod +x build-amd64.sh
#   ./build-amd64.sh                      # auto-detects version from docker-compose.yml
#   ./build-amd64.sh --tag v1.0.3         # override version tag
#   ./build-amd64.sh --release            # build + create GitHub release
#   ./build-amd64.sh --no-cache           # clean build without cache
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# ── Auto-detect version from docker-compose.yml ───────────────────────────────
# Reads the default value of APP_VERSION, e.g.: APP_VERSION: ${APP_VERSION:-1.1.2}
DETECTED_VERSION=""
if [ -f "docker-compose.yml" ]; then
  DETECTED_VERSION=$(grep 'APP_VERSION:-' docker-compose.yml | sed 's/.*APP_VERSION:-\([0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\).*/\1/' | head -1)
fi
if [ -z "$DETECTED_VERSION" ]; then
  echo "⚠ Could not detect APP_VERSION from docker-compose.yml — falling back to 'latest'"
  DETECTED_VERSION="latest"
fi

# ── Parameters ────────────────────────────────────────────────────────────────
ARCH="amd64"
PLATFORM="linux/${ARCH}"
IMAGE_NAME="sc-app"
IMAGE_TAG="${TAG:-${DETECTED_VERSION}}"
POSTGRES_IMAGE="${POSTGRES_IMAGE:-postgres:16-alpine}"
NO_CACHE=""
DO_RELEASE=false
# Output names are set after argument parsing so --tag can still override them
OUTPUT_TAR_OVERRIDE=""
BUNDLE_TAR_OVERRIDE=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --no-cache)
      NO_CACHE="--no-cache"
      shift
      ;;
    --tag=*)
      IMAGE_TAG="${1#--tag=}"
      shift
      ;;
    --tag)
      shift
      IMAGE_TAG="${1:-${DETECTED_VERSION}}"
      [ "$#" -gt 0 ] && shift || true
      ;;
    --output=*)
      OUTPUT_TAR_OVERRIDE="${1#--output=}"
      shift
      ;;
    --bundle=*)
      BUNDLE_TAR_OVERRIDE="${1#--bundle=}"
      shift
      ;;
    --release)
      DO_RELEASE=true
      shift
      ;;
    *)
      echo "❌ Unknown parameter: $1"
      exit 1
      ;;
  esac
done

# Derive versioned, arch-stamped filenames (can be overridden via --output / --bundle)
OUTPUT_TAR="${OUTPUT_TAR_OVERRIDE:-s3c-manager.v${IMAGE_TAG}.tar}"
BUNDLE_TAR="${BUNDLE_TAR_OVERRIDE:-s3c-manager.v${IMAGE_TAG}.tar.gz}"

FULL_IMAGE="${IMAGE_NAME}:${IMAGE_TAG}-${ARCH}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# ── Checks ────────────────────────────────────────────────────────────────────
if ! docker buildx version &>/dev/null; then
  echo "❌ docker buildx is not available. Install Docker Desktop 4.x+ or the docker-buildx plugin."
  exit 1
fi

if [ ! -f "Dockerfile" ]; then
  echo "❌ Dockerfile not found in $(pwd)"
  echo "   Run this script from the project root."
  exit 1
fi

if [ ! -f "portainer-stack.yml" ]; then
  echo "❌ portainer-stack.yml not found — required for the deployment bundle."
  exit 1
fi

if [ ! -f ".env.qnap" ]; then
  echo "❌ .env.qnap not found — required for the deployment bundle."
  exit 1
fi

if [ "$DO_RELEASE" = true ] && ! gh auth status &>/dev/null; then
  echo "❌ GitHub CLI (gh) is not authenticated. Run: gh auth login"
  exit 1
fi

# ── Build ─────────────────────────────────────────────────────────────────────
echo "════════════════════════════════════════════════"
echo "  Service Catalogue — $(echo "$ARCH" | tr '[:lower:]' '[:upper:]') image build"
echo "  Version   : $IMAGE_TAG  (from docker-compose.yml: $DETECTED_VERSION)"
echo "  Platform  : $PLATFORM"
echo "  Image     : $FULL_IMAGE"
echo "  PostgreSQL: $POSTGRES_IMAGE"
echo "  Output    : $OUTPUT_TAR"
echo "  Bundle    : $BUNDLE_TAR"
[ -n "$NO_CACHE" ] && echo "  Cache     : DISABLED"
[ "$DO_RELEASE" = true ] && echo "  GitHub    : release $IMAGE_TAG will be created"
echo "════════════════════════════════════════════════"
echo ""

# Configure a buildx builder for cross-platform builds
if ! docker buildx inspect sc-builder &>/dev/null; then
  echo "▶ Creating buildx builder 'sc-builder'..."
  docker buildx create --name sc-builder --driver docker-container --use
else
  echo "▶ Reusing existing buildx builder 'sc-builder'..."
  docker buildx use sc-builder
fi

echo ""
echo "▶ Building image ${FULL_IMAGE} for ${PLATFORM}..."
echo "  (Multi-stage build: frontend-deps → frontend-builder → middleware-deps → runtime)"
echo ""

docker buildx build \
  --platform "$PLATFORM" \
  --tag "$FULL_IMAGE" \
  --build-arg NEXT_PUBLIC_API_URL=/api \
  --load \
  $NO_CACHE \
  .

echo ""
echo "✅ Build OK"

echo ""
echo "▶ Pulling PostgreSQL image ${POSTGRES_IMAGE} for ${PLATFORM}..."
docker pull --platform "$PLATFORM" "$POSTGRES_IMAGE"

# ── Save image tar ────────────────────────────────────────────────────────────
echo ""
echo "▶ Saving images to ${OUTPUT_TAR}..."
echo "  (sc-app + PostgreSQL — ready for offline / QNAP deployment)"
docker save "$FULL_IMAGE" "$POSTGRES_IMAGE" -o "$OUTPUT_TAR"

SIZE=$(du -sh "$OUTPUT_TAR" | cut -f1)

# ── Prepare deployment bundle ─────────────────────────────────────────────────
echo ""
echo "▶ Preparing deployment bundle ${BUNDLE_TAR}..."
TMP_DIR="$(mktemp -d)"

# Inject the image tag into the env example
sed "s/^SC_APP_TAG=.*/SC_APP_TAG=${IMAGE_TAG}/" .env.qnap > "$TMP_DIR/.env.qnap"

cp portainer-stack.yml "$TMP_DIR/portainer-stack.yml"
cp "$OUTPUT_TAR"       "$TMP_DIR/${OUTPUT_TAR}"

tar -czf "$BUNDLE_TAR" -C "$TMP_DIR" .
rm -rf "$TMP_DIR"

BUNDLE_SIZE=$(du -sh "$BUNDLE_TAR" | cut -f1)

# ── GitHub release (optional) ─────────────────────────────────────────────────
if [ "$DO_RELEASE" = true ]; then
  # Git tag uses the plain version (with optional leading v), e.g. v1.1.2
  # The image tag has the arch suffix (sc-app:1.1.2-amd64) but the release tag does not.
  GIT_TAG="${IMAGE_TAG}"
  # Prepend 'v' if not already present
  [[ "$GIT_TAG" != v* ]] && GIT_TAG="v${GIT_TAG}"

  echo ""
  echo "▶ Creating git tag ${GIT_TAG}..."
  git tag -a "$GIT_TAG" -m "Release ${GIT_TAG}"
  git push origin "$GIT_TAG"

  echo ""
  echo "▶ Creating GitHub release ${GIT_TAG}..."
  gh release create "$GIT_TAG" \
    "$BUNDLE_TAR" \
    --title "Service Catalogue ${GIT_TAG} (${ARCH})" \
    --notes "## Deployment — ${ARCH^^}

Upload \`${BUNDLE_TAR}\` to your server, then:

\`\`\`bash
tar -xzf ${BUNDLE_TAR}
docker load -i ${OUTPUT_TAR}
\`\`\`

Edit \`.env.qnap\` — set **POSTGRES_PASSWORD** and **JWT_SECRET** — then deploy via Portainer:

> **Stacks → Add stack → Upload → \`portainer-stack.yml\`**

Load environment variables from \`.env.qnap\`.

## Contents

| File | Description |
|------|-------------|
| \`portainer-stack.yml\` | Portainer / Docker Compose stack definition |
| \`.env.qnap\` | Environment template — fill in secrets before deploying |
| \`${OUTPUT_TAR}\` | Docker images (${FULL_IMAGE} + postgres:16-alpine, ${ARCH}) |

## Image tag

\`\`\`
${FULL_IMAGE}
\`\`\`
"
  echo ""
  echo "✅ GitHub release created: $(gh release view "$GIT_TAG" --json url -q .url)"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════"
echo "  ✅ Build and export completed!"
echo ""
echo "  Image tar  : ${OUTPUT_TAR} (${SIZE})"
echo "  Bundle     : ${BUNDLE_TAR} (${BUNDLE_SIZE})"
echo "  Image      : ${FULL_IMAGE}"
echo "  PG image   : ${POSTGRES_IMAGE}"
echo ""
echo "  Next steps:"
echo ""
echo "  1) Upload the bundle to your server:"
echo "     scp ${BUNDLE_TAR} admin@SERVER:/share/Container/service-catalogue/"
echo ""
echo "  2) On the server — extract and load images:"
echo "     tar -xzf ${BUNDLE_TAR}"
echo "     docker load -i ${OUTPUT_TAR}"
echo ""
echo "  3) Edit .env.qnap — set POSTGRES_PASSWORD and JWT_SECRET"
echo ""
echo "  4) In Portainer — deploy the stack:"
echo "     Stacks → Add stack → Upload → portainer-stack.yml"
echo "     and load environment variables from .env.qnap"
echo "════════════════════════════════════════════════"

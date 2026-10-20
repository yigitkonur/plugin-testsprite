#!/usr/bin/env bash
# Seeds the empty run workspace with a minimal GitLab pipeline. Local files only.
set -euo pipefail
cat > .gitlab-ci.yml <<'YML'
stages: [build, deploy]
build:
  stage: build
  script: [npm ci, npm run build]
deploy_preview:
  stage: deploy
  script: [./scripts/deploy-preview.sh]
YML

#!/bin/sh
# Run by .github/workflows/release.yml on the bumped tree before anything is pushed.
sh scripts/check_budget.sh 400

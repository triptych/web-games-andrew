#!/bin/sh
# Rebuilds ../index.html from the source parts.
set -e
cd "$(dirname "$0")"
{ printf '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
  cat shell.html
  echo '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>'
  echo '<script>'; cat js1_core.js js2_models.js js3_world.js js4_fling.js js5_bonus.js js6_ui.js; echo '</script>'
  printf '\n</html>\n'; } > ../index.html
echo "Built ../index.html"

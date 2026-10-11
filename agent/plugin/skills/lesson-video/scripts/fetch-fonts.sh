#!/usr/bin/env bash
# Download the free fonts the four reel styles use into ./fonts (or $1).
# Same file names as the original starter kit, so style blocks work unchanged.
set -euo pipefail
dest="${1:-fonts}"
mkdir -p "$dest"
specs=(
  "inter:400:normal:Inter-400"
  "inter:700:normal:Inter-700"
  "archivo-black:400:normal:ArchivoBlack-400"
  "instrument-serif:400:normal:InstrumentSerif-400"
  "instrument-serif:400:italic:InstrumentSerif-400-italic"
  "bricolage-grotesque:800:normal:BricolageGrotesque-800"
)
for spec in "${specs[@]}"; do
  IFS=: read -r id weight style name <<< "$spec"
  out="$dest/$name.woff2"
  [ -s "$out" ] && { echo "have $out"; continue; }
  curl -sfL -o "$out" "https://cdn.jsdelivr.net/fontsource/fonts/$id@latest/latin-$weight-$style.woff2" \
    && echo "got  $out" || { echo "FAILED $name" >&2; rm -f "$out"; }
done
# Any other Google font: https://cdn.jsdelivr.net/fontsource/fonts/<slug>@latest/latin-<weight>-<normal|italic>.woff2

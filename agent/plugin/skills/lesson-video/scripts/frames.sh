#!/usr/bin/env bash
# Pull frames from a rendered video into one contact sheet so you can LOOK at the result.
# usage: frames.sh renders/out.mp4 [count=6] [sheet=renders/out.sheet.png]
set -euo pipefail
in="$1"; n="${2:-6}"; sheet="${3:-${in%.*}.sheet.png}"
dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$in")
tmp=$(mktemp -d)
inputs=()
for i in $(seq 1 "$n"); do
  t=$(awk -v d="$dur" -v i="$i" -v n="$n" 'BEGIN{printf "%.2f", d*(i-0.5)/n}')
  ffmpeg -v error -y -ss "$t" -i "$in" -frames:v 1 -vf "scale=-2:480" "$tmp/$i.png"
  inputs+=(-i "$tmp/$i.png"); echo "frame $i at ${t}s"
done
ffmpeg -v error -y "${inputs[@]}" -filter_complex "hstack=inputs=$n" "$sheet"
rm -rf "$tmp"; echo "sheet: $sheet"

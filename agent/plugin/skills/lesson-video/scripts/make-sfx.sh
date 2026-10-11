#!/usr/bin/env bash
# Synthesize 9 short UI sounds with ffmpeg into ./sfx (or $1). No licence issues: pure math.
# pop tick counter chime snap star switch fill success  (all mono 48 kHz WAV, peak about -6 dBFS)
set -euo pipefail
dest="${1:-sfx}"
mkdir -p "$dest"
gen() { # name duration expression
  ffmpeg -v error -y -f lavfi -i "aevalsrc='$3':s=48000:d=$2" -af "volume=0.5" -ac 1 "$dest/$1.wav" && echo "made $dest/$1.wav"
}
gen pop     0.12 "sin(2*PI*(900-3000*t)*t)*exp(-40*t)"
gen tick    0.05 "sin(2*PI*2400*t)*exp(-120*t)"
# counter: a fast train of soft ticks (about 18/s) for 1.2 s - trim or loop to the roll length
gen counter 1.2  "sin(2*PI*1800*t)*exp(-90*mod(t,0.055))*0.6"
gen chime   1.0  "(sin(2*PI*1046.5*t)+0.6*sin(2*PI*1568*t)+0.3*sin(2*PI*2093*t))*exp(-4*t)*0.5"
gen snap    0.08 "(random(0)*2-1)*exp(-70*t)*0.8"
gen star    0.6  "(sin(2*PI*1318.5*t)*lt(t,0.15)+sin(2*PI*1760*t)*gte(t,0.15))*exp(-6*t)*0.6"
gen switch  0.06 "sin(2*PI*1200*t)*exp(-90*t)+0.5*(random(0)*2-1)*exp(-200*t)"
gen fill    0.7  "sin(2*PI*(300+900*t)*t)*0.35*(1-exp(-20*t))*exp(-2*t)"
gen success 0.7  "(sin(2*PI*784*t)*lt(t,0.12)+sin(2*PI*1046.5*t)*gte(t,0.12)*lt(t,0.24)+sin(2*PI*1318.5*t)*gte(t,0.24))*exp(-4*t)*0.6"

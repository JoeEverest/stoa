#!/usr/bin/env bash
# Build a self-contained whisper-cli for this machine's platform into
# vendor/whisper/<platform>-<arch>/whisper-cli. electron-builder ships it in the app's resources.
#
# Static libraries only, generic CPU code (runs on any CPU of the arch), no OpenMP (it would
# need libgomp at run time). On macOS, Metal is on with its shader library embedded.
#
# Needs git, cmake and a C/C++ compiler (Xcode command line tools, or build-essential).
set -euo pipefail

VERSION="${WHISPER_VERSION:-v1.9.5}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
case "$(uname -s)" in Darwin) os=darwin ;; Linux) os=linux ;; *) echo "unsupported OS" >&2; exit 1 ;; esac
case "$(uname -m)" in arm64|aarch64) arch=arm64 ;; x86_64|amd64) arch=x64 ;; *) echo "unsupported CPU" >&2; exit 1 ;; esac
OUT="$ROOT/vendor/whisper/$os-$arch"

if [ -x "$OUT/whisper-cli" ] && [ "$(cat "$OUT/VERSION" 2>/dev/null)" = "$VERSION" ]; then
  echo "whisper-cli $VERSION already built in $OUT"; exit 0
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
git clone --depth 1 --branch "$VERSION" https://github.com/ggml-org/whisper.cpp.git "$work/src" >/dev/null 2>&1

flags=(
  -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF
  -DGGML_NATIVE=OFF -DGGML_OPENMP=OFF
  -DWHISPER_BUILD_TESTS=OFF -DWHISPER_BUILD_SERVER=OFF -DWHISPER_SDL2=OFF -DWHISPER_CURL=OFF
)
if [ "$os" = darwin ]; then
  flags+=(-DGGML_METAL=ON -DGGML_METAL_EMBED_LIBRARY=ON -DCMAKE_OSX_DEPLOYMENT_TARGET=12.0)
fi

cmake -S "$work/src" -B "$work/build" "${flags[@]}" >/dev/null
cmake --build "$work/build" --config Release --target whisper-cli -j "$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 4)" >/dev/null

mkdir -p "$OUT"
cp "$work/build/bin/whisper-cli" "$OUT/whisper-cli"
echo "$VERSION" > "$OUT/VERSION"
cp "$work/src/LICENSE" "$OUT/LICENSE"

# Fail if the binary links anything outside the OS.
if [ "$os" = darwin ]; then
  extra="$(otool -L "$OUT/whisper-cli" | tail -n +2 | awk '{print $1}' | grep -vE '^(/usr/lib/|/System/Library/)' || true)"
else
  extra="$(ldd "$OUT/whisper-cli" | awk '{print $1}' | grep -vE '^(linux-vdso|/lib|libc\.so|libm\.so|libstdc\+\+|libgcc_s|libpthread|libdl|librt|ld-linux)' || true)"
fi
if [ -n "$extra" ]; then echo "whisper-cli links non-system libraries:"$'\n'"$extra" >&2; exit 1; fi

"$OUT/whisper-cli" --help >/dev/null 2>&1 || { echo "whisper-cli does not run" >&2; exit 1; }
echo "built whisper-cli $VERSION -> $OUT"

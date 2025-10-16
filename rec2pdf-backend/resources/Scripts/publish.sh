#!/usr/bin/env bash
set -euo pipefail

# ============================================ 
# BrightLedger – MD_First_PDF_Publish v0.3.1
# ============================================ 

die() { echo "❌ $*" >&2; exit 1; }

# ----- Dipendenze minime ----- 
command -v pandoc >/dev/null 2>&1 || die "Pandoc non trovato. Installa Pandoc e riprova."
command -v xelatex >/dev/null 2>&1 || die "XeLaTeX non trovato. Installa MacTeX/TeXLive e riprova."


# ----- Localizzazione script/toolchain ----- 
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOOL_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${REPO_ROOT:-}" ]]; then
  REPO_ROOT="$(cd "$TOOL_ROOT/../.." && pwd)"
fi

# ----- Argomenti ----- 
INPUT_MD="${1:-}"
[[ -z "$INPUT_MD" ]] && die "Errore: specifica un file .md come input. Uso: $0 path/al/file.md"
[[ -f "$INPUT_MD" ]] || die "Errore: file Markdown non trovato: $INPUT_MD"

# ----- Output (accanto al sorgente .md) ----- 
OUTPUT_PDF="${INPUT_MD%.md}.pdf"

# ----- Path template & asset ----- 
TEMPLATE_DIR="$TOOL_ROOT/Templates"
DEFAULT_TEX="$TEMPLATE_DIR/default.tex"
HEADER_FOOTER_TEX="$TEMPLATE_DIR/header_footer.tex"
COVER_TEX="$TEMPLATE_DIR/cover.tex"

[[ -f "$DEFAULT_TEX" ]] || die "Template default.tex non trovato: $DEFAULT_TEX"
[[ -f "$HEADER_FOOTER_TEX" ]] || die "Template header_footer.tex non trovato: $HEADER_FOOTER_TEX"
[[ -f "$COVER_TEX" ]] || die "Template cover.tex non trovato: $COVER_TEX"

# ----- Log esecuzione & Logo ----- 
echo "🚀 Generazione PDF da: $INPUT_MD"
echo "📌 Template: $DEFAULT_TEX"
echo "📌 Include header: $HEADER_FOOTER_TEX"
echo "📌 Include cover : $COVER_TEX"

# Seleziona il logo: custom se disponibile, altrimenti default 
CUSTOM_LOGO_PATH="${CUSTOM_PDF_LOGO:-}"
if [[ -n "$CUSTOM_LOGO_PATH" && -f "$CUSTOM_LOGO_PATH" ]]; then
  LOGO="$CUSTOM_LOGO_PATH"
  echo "📌 Logo (Custom)   : $LOGO"
else
  LOGO="$SCRIPT_DIR/../assets/thinkDOC.pdf"
  echo "📌 Logo (Default)  : $LOGO"
fi
[[ -f "$LOGO" ]] || die "Logo PDF non trovato: $LOGO"


# ----- DRY RUN ----- 
if [[ "${2:-}" == "--dry-run" ]]; then
  cat <<INFO
🔎 DRY RUN
REPO_ROOT     = $REPO_ROOT
TOOL_ROOT     = $TOOL_ROOT
TEMPLATE_DIR  = $TEMPLATE_DIR
DEFAULT_TEX   = $DEFAULT_TEX
HEADER_FOOTER = $HEADER_FOOTER_TEX
COVER_TEX     = $COVER_TEX
LOGO          = $LOGO
INPUT_MD      = $INPUT_MD
OUTPUT_PDF    = $OUTPUT_PDF
INFO
  exit 0
fi

# ----- Font check (soft) ----- 
if command -v fc-list >/dev/null 2>&1; then
  if fc-list | grep -qi "TeX Gyre Termes"; then
    echo "✅ Font TeX Gyre rilevati (Termes/Heros)"
  else
    echo "⚠️  Font TeX Gyre non rilevati: il template usa TeX Gyre Termes/Heros."
    echo "   Se la compilazione fallisce, installa:"
    echo "   brew install --cask font-tex-gyre-termes font-tex-gyre-heros"
  fi
else
  echo "ℹ️  'fc-list' non disponibile: salto il controllo font."
fi

# --- DEBUG/VERBOSE opzionale (abilitato da PPUBD) -------------------------
if [[ -n "${BLD_PUBLISH_DEBUG:-}" ]]; then
  set -x
  DEBUG_TEX="${OUTPUT_PDF%.pdf}.debug.tex"
  pandoc "$INPUT_MD" \
    --from=markdown \
    --template="$DEFAULT_TEX" \
    --include-in-header="$HEADER_FOOTER_TEX" \
    --include-before-body="$COVER_TEX" \
    --variable logo="$LOGO" \
    -t latex -o "$DEBUG_TEX" || die "Errore export TEX (debug)"
  echo "📝 TEX intermedio scritto in: $DEBUG_TEX"
  set +x
fi
# -------------------------------------------------------------------------- 

# ----- Comando Pandoc ----- 
pandoc "$INPUT_MD" \
  --from markdown \
  --pdf-engine=xelatex \
  --highlight-style=kate \
  --template "$DEFAULT_TEX" \
  --include-in-header "$HEADER_FOOTER_TEX" \
  --include-before-body "$COVER_TEX" \
  --variable logo="$LOGO" \
  -o "$OUTPUT_PDF" || die "Errore durante la generazione del PDF"

# ----- Esito ----- 
[[ -f "$OUTPUT_PDF" ]] && echo "✅ PDF generato con successo: $OUTPUT_PDF"
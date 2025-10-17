#!/usr/bin/env bash
set -euo pipefail

declare -a REC2PDF_TMP_FILES=()

register_tmp_file() {
  local path="$1"
  [[ -z "$path" ]] && return 0
  REC2PDF_TMP_FILES+=("$path")
}

cleanup_tmp_files() {
  if [[ ${#REC2PDF_TMP_FILES[@]} -gt 0 ]]; then
    local item
    for item in "${REC2PDF_TMP_FILES[@]}"; do
      [[ -n "$item" && -e "$item" ]] && rm -f "$item" || true
    done
  fi
}

trap cleanup_tmp_files EXIT

# ============================================ 
# BrightLedger – MD_First_PDF_Publish v0.3.1
# ============================================ 

die() { echo "❌ $*" >&2; exit 1; }

# ----- Dipendenze minime ----- 
command -v pandoc >/dev/null 2>&1 || die "Pandoc non trovato. Installa Pandoc e riprova."


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

# ----- Selezione template profilo -----
SELECTED_TEMPLATE="$DEFAULT_TEX"
SELECTED_CSS=""
TEMPLATE_KIND="tex"
HTML_ENGINE=""
HTML_RESOURCE_PATH=""
HTML_INLINE_METADATA_FILE=""

if [[ -n "${WORKSPACE_PROFILE_TEMPLATE:-}" ]]; then
  PROFILE_TEMPLATE_CANDIDATE="$WORKSPACE_PROFILE_TEMPLATE"
  if [[ ! -f "$PROFILE_TEMPLATE_CANDIDATE" ]]; then
    echo "⚠️  Template profilo non trovato: $PROFILE_TEMPLATE_CANDIDATE (uso default)"
  else
    case "$PROFILE_TEMPLATE_CANDIDATE" in
      *.tex|*.TEX)
        SELECTED_TEMPLATE="$PROFILE_TEMPLATE_CANDIDATE"
        TEMPLATE_KIND="tex"
        ;;
      *.html|*.HTML)
        SELECTED_TEMPLATE="$PROFILE_TEMPLATE_CANDIDATE"
        TEMPLATE_KIND="html"
        if [[ -n "${WORKSPACE_PROFILE_TEMPLATE_CSS:-}" ]]; then
          if [[ -f "${WORKSPACE_PROFILE_TEMPLATE_CSS}" ]]; then
            SELECTED_CSS="$WORKSPACE_PROFILE_TEMPLATE_CSS"
          else
            echo "⚠️  CSS template indicato ma non trovato: ${WORKSPACE_PROFILE_TEMPLATE_CSS}"
          fi
        fi
        if [[ -z "$SELECTED_CSS" ]]; then
          CSS_CANDIDATE="${PROFILE_TEMPLATE_CANDIDATE%.*}.css"
          if [[ -f "$CSS_CANDIDATE" ]]; then
            SELECTED_CSS="$CSS_CANDIDATE"
          fi
        fi
        ;;
      *)
        echo "⚠️  Estensione template non supportata ($PROFILE_TEMPLATE_CANDIDATE), uso default."
        ;;
    esac
  fi
fi

# Risolvi eventuale motore HTML prima del dry-run
if [[ "$TEMPLATE_KIND" == "html" ]]; then
  HTML_RESOURCE_PATH_RAW="${WORKSPACE_PROFILE_TEMPLATE_RESOURCE_PATH:-}"
  if [[ -n "$HTML_RESOURCE_PATH_RAW" ]]; then
    OLD_IFS="$IFS"
    IFS=':' read -r -a _RESOURCE_PATH_CANDIDATES <<<"$HTML_RESOURCE_PATH_RAW"
    IFS="$OLD_IFS"
    unset OLD_IFS
  else
    _RESOURCE_PATH_CANDIDATES=()
  fi
  TEMPLATE_DIRNAME="$(dirname "$SELECTED_TEMPLATE")"
  _RESOURCE_PATH_CANDIDATES+=("$TEMPLATE_DIRNAME")
  if [[ -n "$SELECTED_CSS" ]]; then
    _RESOURCE_PATH_CANDIDATES+=("$(dirname "$SELECTED_CSS")")
  fi
  TEMPLATE_ASSETS_DIR="$TEMPLATE_DIRNAME/$(basename "$SELECTED_TEMPLATE" .html)"
  if [[ -d "$TEMPLATE_ASSETS_DIR" ]]; then
    _RESOURCE_PATH_CANDIDATES+=("$TEMPLATE_ASSETS_DIR")
  fi
  HTML_RESOURCE_PATH=""
  for _candidate in "${_RESOURCE_PATH_CANDIDATES[@]}"; do
    [[ -z "$_candidate" ]] && continue
    [[ ! -d "$_candidate" ]] && continue
    case ":$HTML_RESOURCE_PATH:" in
      *":$_candidate:"*)
        continue
        ;;
    esac
    if [[ -z "$HTML_RESOURCE_PATH" ]]; then
      HTML_RESOURCE_PATH="$_candidate"
    else
      HTML_RESOURCE_PATH="$HTML_RESOURCE_PATH:$_candidate"
    fi
  done
  unset _RESOURCE_PATH_CANDIDATES _candidate

  resolve_html_engine() {
    local preferred="${PREFERRED_HTML_ENGINE:-}"
    local resolved=""
    if [[ -n "$preferred" ]]; then
      if command -v "$preferred" >/dev/null 2>&1; then
        resolved="$preferred"
      else
        echo "⚠️  Motore HTML preferito non trovato: $preferred"
      fi
    fi
    if [[ -z "$resolved" ]]; then
      if command -v wkhtmltopdf >/dev/null 2>&1; then
        resolved="wkhtmltopdf"
      elif command -v weasyprint >/dev/null 2>&1; then
        resolved="weasyprint"
      else
        die "Nessun motore HTML disponibile (wkhtmltopdf/weasyprint)."
      fi
    fi
    HTML_ENGINE="$resolved"
  }
  resolve_html_engine
  unset -f resolve_html_engine

  if [[ -n "$SELECTED_CSS" && -f "$SELECTED_CSS" ]]; then
    HTML_INLINE_METADATA_FILE="$(mktemp "${TMPDIR:-/tmp}/rec2pdf_css_XXXXXX.yaml")"
    if [[ -n "$HTML_INLINE_METADATA_FILE" ]]; then
      register_tmp_file "$HTML_INLINE_METADATA_FILE"
      {
        printf 'styles:\n'
        printf '  inline: |\n'
        while IFS='' read -r line || [[ -n "$line" ]]; do
          printf '    %s\n' "$line"
        done <"$SELECTED_CSS"
      } >"$HTML_INLINE_METADATA_FILE"
    else
      echo "⚠️  Impossibile creare il file temporaneo per il CSS inline"
    fi
  fi
fi

# ----- Log esecuzione & Logo -----
echo "🚀 Generazione PDF da: $INPUT_MD"
echo "📌 Template selezionato: $SELECTED_TEMPLATE"
[[ -n "$SELECTED_CSS" ]] && echo "📌 CSS associato: $SELECTED_CSS"
[[ -n "$HTML_RESOURCE_PATH" ]] && echo "📁 Resource path : $HTML_RESOURCE_PATH"
if [[ "$TEMPLATE_KIND" == "tex" ]]; then
  echo "📌 Include header: $HEADER_FOOTER_TEX"
  echo "📌 Include cover : $COVER_TEX"
fi

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
SELECTED_TPL  = $SELECTED_TEMPLATE
SELECTED_CSS  = ${SELECTED_CSS:-}
RESOURCE_PATH = ${HTML_RESOURCE_PATH:-}
TEMPLATE_KIND = $TEMPLATE_KIND
HEADER_FOOTER = $HEADER_FOOTER_TEX
COVER_TEX     = $COVER_TEX
LOGO          = $LOGO
INPUT_MD      = $INPUT_MD
OUTPUT_PDF    = $OUTPUT_PDF
HTML_ENGINE   = ${HTML_ENGINE:-}
INFO
  exit 0
fi

# ----- Font check (soft) ----- 
if [[ "$TEMPLATE_KIND" == "tex" ]]; then
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
fi

# --- DEBUG/VERBOSE opzionale (abilitato da PPUBD) -------------------------
if [[ -n "${BLD_PUBLISH_DEBUG:-}" && "$TEMPLATE_KIND" == "tex" ]]; then
  set -x
  DEBUG_TEX="${OUTPUT_PDF%.pdf}.debug.tex"
  pandoc "$INPUT_MD" \
    --from=markdown \
    --template="$SELECTED_TEMPLATE" \
    --include-in-header="$HEADER_FOOTER_TEX" \
    --include-before-body="$COVER_TEX" \
    --variable logo="$LOGO" \
    -t latex -o "$DEBUG_TEX" || die "Errore export TEX (debug)"
  echo "📝 TEX intermedio scritto in: $DEBUG_TEX"
  set +x
fi
# --------------------------------------------------------------------------

if [[ "$TEMPLATE_KIND" == "tex" ]]; then
  command -v xelatex >/dev/null 2>&1 || die "XeLaTeX non trovato. Installa MacTeX/TeXLive e riprova."
else
  echo "🛠️  Motore HTML selezionato: $HTML_ENGINE"
fi

# ----- Comando Pandoc -----
if [[ "$TEMPLATE_KIND" == "tex" ]]; then
  pandoc_args=(
    "$INPUT_MD"
    --from
    markdown
    --pdf-engine=xelatex
    --highlight-style=kate
    --template
    "$SELECTED_TEMPLATE"
    --include-in-header
    "$HEADER_FOOTER_TEX"
    --include-before-body
    "$COVER_TEX"
    --variable
    "logo=$LOGO"
    -o
    "$OUTPUT_PDF"
  )
else
  pandoc_args=(
    "$INPUT_MD"
    --from
    markdown+yaml_metadata_block
    --to
    html
    --template
    "$SELECTED_TEMPLATE"
    --highlight-style=kate
    --embed-resources
  )
  if [[ -n "$SELECTED_CSS" ]]; then
    pandoc_args+=(--css "$SELECTED_CSS")
  fi
  if [[ -n "$HTML_INLINE_METADATA_FILE" ]]; then
    pandoc_args+=(--metadata-file "$HTML_INLINE_METADATA_FILE")
  fi
  if [[ -n "$HTML_RESOURCE_PATH" ]]; then
    pandoc_args+=(--resource-path "$HTML_RESOURCE_PATH")
  fi
  pandoc_args+=(--metadata "logo=$LOGO")
  pandoc_args+=(--pdf-engine "$HTML_ENGINE")
  if [[ "$HTML_ENGINE" == "wkhtmltopdf" ]]; then
    pandoc_args+=(--pdf-engine-opt=--enable-local-file-access)
  fi
  pandoc_args+=(-o "$OUTPUT_PDF")
fi

pandoc "${pandoc_args[@]}" || die "Errore durante la generazione del PDF"

# ----- Esito ----- 
[[ -f "$OUTPUT_PDF" ]] && echo "✅ PDF generato con successo: $OUTPUT_PDF"

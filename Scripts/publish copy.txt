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
# BrightLedger – MD_First_PDF_Publish v0.4.1
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

# ----- Selezione template profilo (FIXED LOGIC) -----
SELECTED_TEMPLATE="$DEFAULT_TEX"
SELECTED_CSS=""
TEMPLATE_KIND="tex"
HTML_ENGINE=""
HTML_RESOURCE_PATH=""
HTML_INLINE_METADATA_FILE=""

if [[ -n "${WORKSPACE_PROFILE_TEMPLATE:-}" ]]; then
  CANDIDATE="$WORKSPACE_PROFILE_TEMPLATE"
  
  echo "🔍 [DEBUG SCRIPT] Input Template: '$CANDIDATE'"
  echo "🔍 [DEBUG SCRIPT] Template Dir: '$TEMPLATE_DIR'"

  # FIX PATH: Risoluzione path assoluto
  if [[ ! -f "$CANDIDATE" ]]; then
    CLEAN_NAME="${CANDIDATE#Templates/}"
    ABS_CANDIDATE="$TEMPLATE_DIR/$CLEAN_NAME"
    
    if [[ -f "$ABS_CANDIDATE" ]]; then
       echo "✅ [DEBUG SCRIPT] Path relativo corretto in assoluto: $ABS_CANDIDATE"
       CANDIDATE="$ABS_CANDIDATE"
    else
       echo "⚠️ [DEBUG SCRIPT] Tentativo path assoluto fallito: $ABS_CANDIDATE"
       if [[ -f "$TOOL_ROOT/$CANDIDATE" ]]; then
          echo "✅ [DEBUG SCRIPT] Trovato relativo a TOOL_ROOT: $TOOL_ROOT/$CANDIDATE"
          CANDIDATE="$TOOL_ROOT/$CANDIDATE"
       fi
    fi
  fi

  PROFILE_TEMPLATE_CANDIDATE="$CANDIDATE"

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
          CSS_CANDIDATE="${WORKSPACE_PROFILE_TEMPLATE_CSS}"
          if [[ ! -f "$CSS_CANDIDATE" ]]; then
             CLEAN_CSS="${CSS_CANDIDATE#Templates/}"
             if [[ -f "$TEMPLATE_DIR/$CLEAN_CSS" ]]; then
                CSS_CANDIDATE="$TEMPLATE_DIR/$CLEAN_CSS"
             fi
          fi
          
          if [[ -f "$CSS_CANDIDATE" ]]; then
            SELECTED_CSS="$CSS_CANDIDATE"
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

# Risolvi eventuale motore HTML
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
  local requested="${WORKSPACE_PROFILE_TEMPLATE_ENGINE:-${PREFERRED_HTML_ENGINE:-}}"
  local resolved=""

  if [[ -n "$requested" ]]; then
    if command -v "$requested" >/dev/null 2>&1; then
      resolved="$requested"
    else
      echo "⚠️  Il motore richiesto '$requested' non è installato su questa macchina." >&2
      if [[ "$requested" == "weasyprint" ]] && command -v wkhtmltopdf >/dev/null 2>&1; then
        echo "🔄  Fallback automatico su: wkhtmltopdf" >&2
        resolved="wkhtmltopdf"
      elif [[ "$requested" == "wkhtmltopdf" ]] && command -v weasyprint >/dev/null 2>&1; then
        echo "🔄  Fallback automatico su: weasyprint" >&2
        resolved="weasyprint"
      fi
    fi
  fi

  if [[ -z "$resolved" ]]; then
    if command -v weasyprint >/dev/null 2>&1; then
      resolved="weasyprint"
    elif command -v wkhtmltopdf >/dev/null 2>&1; then
      resolved="wkhtmltopdf"
    else
      die "Nessun motore HTML disponibile (installa 'weasyprint' o 'wkhtmltopdf')."
    fi
  fi

  HTML_ENGINE="$resolved"
  echo "🛠️  Motore HTML attivo: $HTML_ENGINE"
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

# Seleziona il logo
# Seleziona il logo: custom se disponibile, altrimenti default
CUSTOM_LOGO_PATH="${CUSTOM_PDF_LOGO:-}"

if [[ -n "$CUSTOM_LOGO_PATH" && -f "$CUSTOM_LOGO_PATH" ]]; then
  LOGO="$CUSTOM_LOGO_PATH"
  echo "📌 Logo (Custom)   : $LOGO"
else
  # DEFAULT: Scegliamo il formato in base al motore
  if [[ "$TEMPLATE_KIND" == "html" ]]; then
      # Per HTML serve PNG o SVG
      LOGO="$SCRIPT_DIR/../assets/thinkDOC.png"
      # Fallback se non esiste png, prova svg
      if [[ ! -f "$LOGO" ]]; then
          LOGO="$SCRIPT_DIR/../assets/thinkDOC.svg"
      fi
  else
      # Per LaTeX va bene PDF
      LOGO="$SCRIPT_DIR/../assets/thinkDOC.pdf"
  fi
  echo "📌 Logo (Default)  : $LOGO"
fi

# DEBUG LOGO
echo "🔍 [DEBUG SCRIPT] Controllo Logo:"
echo "   - Path calcolato: $LOGO"
ls -l "$LOGO" || echo "❌ ERRORE CRITICO: Il file del logo NON ESISTE a questo percorso!"

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

# ----- Comando Pandoc (FIXED) -----
if [[ "$TEMPLATE_KIND" == "tex" ]]; then

  # === BIVIO: MODALITÀ SEMPLICE vs STANDARD ===
  if [[ "${PDF_SIMPLE_MODE:-}" == "true" ]]; then
      echo "⚡ Modalità Semplice (Raw): Uso template nativo di Pandoc"
      pandoc_args=(
        "$INPUT_MD"
        --from markdown
        --pdf-engine=xelatex
        --variable "geometry:margin=2.5cm"
        --variable "fontsize=11pt"
        -o "$OUTPUT_PDF"
      )
  else
      echo "✨ Modalità Standard: Uso template custom con Copertina e Header"
      pandoc_args=(
        "$INPUT_MD"
        --from markdown
        --pdf-engine=xelatex
        --highlight-style=kate
        --template "$SELECTED_TEMPLATE"
        --variable "logo=$LOGO"
        --include-in-header "$HEADER_FOOTER_TEX"
        --include-before-body "$COVER_TEX"
        --toc
        -o "$OUTPUT_PDF"
      )
  fi

else
  # Blocco HTML
  pandoc_args=(
    "$INPUT_MD"
    --from markdown+yaml_metadata_block
    --to html
    --template
    "$SELECTED_TEMPLATE"
    --highlight-style=kate
    --self-contained
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
    pandoc_args+=(--pdf-engine-opt=--print-media-type)
    local mt=${WORKSPACE_PROFILE_MARGIN_TOP:-20mm}
    local mr=${WORKSPACE_PROFILE_MARGIN_RIGHT:-15mm}
    local mb=${WORKSPACE_PROFILE_MARGIN_BOTTOM:-20mm}
    local ml=${WORKSPACE_PROFILE_MARGIN_LEFT:-15mm}
    pandoc_args+=(--pdf-engine-opt=--margin-top=${mt})
    pandoc_args+=(--pdf-engine-opt=--margin-right=${mr})
    pandoc_args+=(--pdf-engine-opt=--margin-bottom=${mb})
    pandoc_args+=(--pdf-engine-opt=--margin-left=${ml})
    pandoc_args+=(--pdf-engine-opt=--dpi=144)
    pandoc_args+=(--pdf-engine-opt=--encoding=UTF-8)
  fi
  pandoc_args+=(-o "$OUTPUT_PDF")
fi

pandoc "${pandoc_args[@]}" || die "Errore durante la generazione del PDF"

# ----- Esito ----- 
[[ -f "$OUTPUT_PDF" ]] && echo "✅ PDF generato con successo: $OUTPUT_PDF"
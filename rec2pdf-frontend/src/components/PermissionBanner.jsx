import { useAppContext } from "../hooks/useAppContext";

export default function PermissionBanner() {
  const {
    permissionMessage,
    lastMicError,
    secureOK,
  } = useAppContext();

  const ua = navigator.userAgent || "";
  const isChromium = ua.includes("Chrome/") && !ua.includes("Edg/") && !ua.includes("OPR/");
  const isEdge = ua.includes("Edg/");
  const isBrave = isChromium && ua.includes("Brave/");
  const site = encodeURIComponent(window.location.origin);
  const chromeSiteSettings = `chrome://settings/content/siteDetails?site=${site}`;
  const chromeMicSettings = `chrome://settings/content/microphone`;

  return (
    <div className="rounded-xl border border-amber-900/40 bg-amber-950/40 p-3 text-sm text-amber-200">
      <div className="font-medium">Permesso microfono necessario</div>
      {permissionMessage && <div className="mt-1 text-amber-100">{permissionMessage}</div>}
      {lastMicError && (
        <div className="mt-1 text-amber-100">
          Dettagli ultimo errore: <code className="text-amber-100">{lastMicError.name}</code>
          {lastMicError.message ? `: ${lastMicError.message}` : ""}
        </div>
      )}
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {!secureOK && (
          <li>
            Servi l'app in HTTPS o usa <code>http://localhost</code>.
          </li>
        )}
        <li>Quando il browser chiede il permesso, scegli <strong>Consenti</strong>.</li>
        <li>
          Se in passato hai negato il permesso, apri le impostazioni del sito (icona lucchetto → Permessi) e abilita il microfono.
        </li>
        <li>Su macOS: Sistema → Privacy e Sicurezza → Microfono → abilita il browser.</li>
        {(isChromium || isEdge || isBrave) && (
          <li className="mt-1 space-x-3">
            <a href={chromeSiteSettings} className="underline" target="_blank" rel="noreferrer">
              Apri permessi sito
            </a>
            <a href={chromeMicSettings} className="underline" target="_blank" rel="noreferrer">
              Apri impostazioni microfono
            </a>
          </li>
        )}
      </ul>
    </div>
  );
}

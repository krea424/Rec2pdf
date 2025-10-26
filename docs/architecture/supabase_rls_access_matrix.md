# Supabase RLS e matrici di accesso

Questa nota sintetizza le policy Row Level Security introdotte nella bozza di migrazione `20240725_draft_prompts_workspaces_profiles.sql` e le variabili d'ambiente richieste per la loro gestione negli ambienti Dev/Stage/Prod.

## Tabella di accesso (stato iniziale basato su owner)

| Risorsa                          | Owner autenticato (`auth.uid()`) | Utente autenticato non owner | Utente anonimo | Service role (backend) |
|----------------------------------|----------------------------------|------------------------------|----------------|-------------------------|
| `public.profiles`                | Lettura/Scrittura sul proprio ID | Nessun accesso               | Nessun accesso | Pieno accesso (bypass RLS) |
| `public.workspaces`              | Lettura/Scrittura sui workspace con `owner_id = auth.uid()` | Nessun accesso | Nessun accesso | Pieno accesso |
| `public.prompts`                 | Lettura/Scrittura se owner del workspace collegato | Nessun accesso | Nessun accesso | Pieno accesso |
| Bucket Storage `logos`           | Upload/Read tramite backend autenticato con service role | Nessun accesso diretto | Nessun accesso | Pieno accesso |

### Note operative
- Le policy permettono soltanto al proprietario di gestire profili, workspace e prompt; l'estensione a collaboratori o ruoli differenti richiederà policy aggiuntive.
- Il bucket `logos` non è pubblico: l'accesso passa tramite il backend con chiave `SUPABASE_SERVICE_ROLE`.
- Aggiornare le funzioni server-side affinché sincronizzino `profiles` con `auth.users` (trigger post conferma email) prima di applicare la migrazione.

## Piano di coordinamento con DevOps

1. **Variabili backend**: condividere con il team DevOps l'introduzione delle nuove chiavi `SUPABASE_SERVICE_ROLE` e `SUPABASE_STORAGE_LOGOS_BUCKET` (`logos`). DevOps deve valorizzarle su Dev/Stage/Prod insieme alle chiavi esistenti (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`).
2. **Frontend**: allineare la variabile `VITE_SUPABASE_STORAGE_LOGOS_BUCKET` sugli ambienti Vercel (o analoghi) per permettere al client di puntare allo stesso bucket.
3. **Migrazione**: pianificare una finestra di deploy coordinata. DevOps deve verificare che il bucket `logos` non esista o sia coerente e lanciare la migrazione via `supabase db push` solo dopo il QA della bozza.
4. **Rollback / Backup**: prima dell'applicazione in Stage/Prod, effettuare un backup dei dati esistenti (`supabase db dump`) e dei file locali `~/.rec2pdf/` come indicato di seguito.

## Snapshot `~/.rec2pdf`

Per mantenere allineati i file locali (prompts, workspaces, logos) è stato creato lo snapshot `backups/.rec2pdf_snapshot/`. Il contenuto rappresenta un dump sanificato utilizzabile come base per ripristini o test. Aggiornare lo snapshot ad ogni cambiamento rilevante degli asset locali.

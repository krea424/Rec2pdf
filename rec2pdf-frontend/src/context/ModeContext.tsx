import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { PostgrestError, Session } from "@supabase/supabase-js";
import supabase from "../supabaseClient";

type Mode = "base" | "advanced";

type ModeContextValue = {
  mode: Mode;
  availableModes: Mode[];
  setMode: (nextMode: Mode) => void;
  toggleMode: () => void;
  isHydrated: boolean;
  isPersisting: boolean;
  isSelectionVisible: boolean;
  flags: Set<string>;
  hasFlag: (flag: string) => boolean;
};

const DEFAULT_MODE: Mode = "base";
const MODE_STORAGE_KEY = "rec2pdfModePreference";
const MODE_FLAGS: Record<Mode, string> = {
  base: "MODE_BASE",
  advanced: "MODE_ADVANCED",
};

const ModeContext = createContext<ModeContextValue | undefined>(undefined);

const MODE_TABLE_CANDIDATES = ["profiles", "public_profiles"] as const;
type ModeTableName = (typeof MODE_TABLE_CANDIDATES)[number];

type ModeProviderProps = {
  children: ReactNode;
  session: Session | null;
  syncWithSupabase?: boolean;
};

const readStoredMode = (): Mode => {
  if (typeof window === "undefined") {
    return DEFAULT_MODE;
  }

  try {
    const stored = window.localStorage.getItem(MODE_STORAGE_KEY);
    if (stored === "advanced" || stored === "base") {
      return stored;
    }
  } catch (error) {
    console.warn("Impossibile leggere la modalità da localStorage:", error);
  }

  return DEFAULT_MODE;
};

const extractFlags = (session: Session | null): Set<string> => {
  const flags = new Set<string>();
  const metadata = session?.user?.app_metadata ?? {};
  const profileFlags = (metadata as Record<string, unknown>).feature_flags;

  if (Array.isArray(profileFlags)) {
    profileFlags.filter((flag): flag is string => typeof flag === "string").forEach((flag) => {
      flags.add(flag);
    });
  } else if (profileFlags && typeof profileFlags === "object") {
    Object.entries(profileFlags).forEach(([flag, enabled]) => {
      if (enabled) {
        flags.add(flag);
      }
    });
  }

  return flags;
};

const sanitizeMode = (candidate: string | null | undefined, fallback: Mode, allowed: Mode[]): Mode => {
  if (candidate === "base" || candidate === "advanced") {
    if (!allowed.length || allowed.includes(candidate)) {
      return candidate;
    }
  }

  if (allowed.length) {
    if (allowed.includes(fallback)) {
      return fallback;
    }

    return allowed[0];
  }

  return fallback;
};

const isMissingTableError = (error: unknown): error is PostgrestError => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const postgrestError = error as PostgrestError;
  const code = postgrestError.code ?? "";
  const message = postgrestError.message ?? "";
  const details = postgrestError.details ?? "";

  if (code === "PGRST302" || code === "42P01") {
    return true;
  }

  return (
    /does not exist/i.test(message) ||
    /relation .* does not exist/i.test(message) ||
    /does not exist/i.test(details)
  );
};

const isNoRowError = (error: PostgrestError | null, status?: number) => {
  if (!error) {
    return false;
  }

  if (status === 406) {
    return true;
  }

  return error.code === "PGRST116" || /Results contain 0 rows/i.test(error.message ?? "");
};

export const ModeProvider = ({ children, session, syncWithSupabase = true }: ModeProviderProps) => {
  const [mode, setModeState] = useState<Mode>(() => readStoredMode());
  const [hydrated, setHydrated] = useState<boolean>(false);
  const [persisting, setPersisting] = useState<boolean>(false);
  const preferencesRef = useRef<Record<string, unknown>>({});
  const lastSyncedModeRef = useRef<Mode | null>(null);
  const modeTableRef = useRef<ModeTableName | null>(null);
  const sessionId = session?.user?.id ?? null;
  const [flags, setFlags] = useState<Set<string>>(() => extractFlags(session));
  const [remoteSyncDisabled, setRemoteSyncDisabled] = useState<boolean>(!syncWithSupabase);

  useEffect(() => {
    setFlags(extractFlags(session));
  }, [session]);

  useEffect(() => {
    setRemoteSyncDisabled(!syncWithSupabase);
  }, [syncWithSupabase]);

  const availableModes = useMemo<Mode[]>(() => {
    const enabled = (Object.keys(MODE_FLAGS) as Mode[]).filter((candidate) => {
      const requiredFlag = MODE_FLAGS[candidate];
      return flags.has(requiredFlag);
    });

    if (enabled.length) {
      return enabled;
    }

    return [DEFAULT_MODE];
  }, [flags]);

  useEffect(() => {
    if (availableModes.includes(mode)) {
      return;
    }

    const fallback = availableModes.includes(DEFAULT_MODE) ? DEFAULT_MODE : availableModes[0];
    setModeState(fallback);
  }, [availableModes, mode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, mode);
    } catch (error) {
      console.warn("Impossibile salvare la modalità su localStorage:", error);
    }
  }, [mode]);

  useEffect(() => {
    if (remoteSyncDisabled) {
      setHydrated(true);
      preferencesRef.current = {};
      lastSyncedModeRef.current = null;
      modeTableRef.current = null;
      return () => undefined;
    }

    let isActive = true;

    if (!sessionId) {
      preferencesRef.current = {};
      lastSyncedModeRef.current = null;
      modeTableRef.current = null;
      setHydrated(true);
      return () => {
        isActive = false;
      };
    }

    setHydrated(false);

    const fetchPreferences = async () => {
      const tablesToTry = modeTableRef.current
        ? [modeTableRef.current, ...MODE_TABLE_CANDIDATES.filter((table) => table !== modeTableRef.current)]
        : [...MODE_TABLE_CANDIDATES];

      for (const tableName of tablesToTry) {
        try {
          const { data, error, status } = await supabase
            .from(tableName)
            .select("preferences")
            .eq("id", sessionId)
            .single();

          if (!isActive) {
            return;
          }

          if (error) {
            if (isMissingTableError(error)) {
              continue;
            }

            if (isNoRowError(error, status)) {
              preferencesRef.current = {};
              lastSyncedModeRef.current = null;
              modeTableRef.current = tableName;
              return;
            }

            console.warn("Impossibile recuperare le preferenze dal profilo Supabase:", error);
            preferencesRef.current = {};
            lastSyncedModeRef.current = null;
            modeTableRef.current = null;
            setRemoteSyncDisabled(true);
            return;
          }

          const nextPreferences =
            data && typeof data.preferences === "object" && data.preferences !== null
              ? (data.preferences as Record<string, unknown>)
              : {};

          preferencesRef.current = nextPreferences;
          const remoteMode = sanitizeMode(nextPreferences?.mode as string | null | undefined, DEFAULT_MODE, availableModes);
          lastSyncedModeRef.current = remoteMode;
          modeTableRef.current = tableName;
          setModeState(remoteMode);
          return;
        } catch (error) {
          if (!isActive) {
            return;
          }

          if (isMissingTableError(error)) {
            continue;
          }

          console.warn("Errore inatteso nel recupero delle preferenze utente:", error);
          preferencesRef.current = {};
          lastSyncedModeRef.current = null;
          modeTableRef.current = null;
          setRemoteSyncDisabled(true);
          return;
        }
      }

      if (isActive) {
        console.warn(
          "Nessuna tabella Supabase valida trovata per le preferenze della modalità, disabilito la sincronizzazione remota.",
        );
        preferencesRef.current = {};
        lastSyncedModeRef.current = null;
        modeTableRef.current = null;
        setRemoteSyncDisabled(true);
      }
    };

    fetchPreferences().finally(() => {
      if (isActive) {
        setHydrated(true);
      }
    });

    return () => {
      isActive = false;
    };
  }, [availableModes, remoteSyncDisabled, sessionId]);

  const persistPreference = useCallback(
    async (nextMode: Mode) => {
      if (!sessionId || remoteSyncDisabled) {
        return;
      }

      setPersisting(true);
      const nextPreferences = { ...preferencesRef.current, mode: nextMode };

      let saved = false;
      let encounteredUnexpectedError = false;

      try {
        const tablesToTry = modeTableRef.current
          ? [modeTableRef.current, ...MODE_TABLE_CANDIDATES.filter((table) => table !== modeTableRef.current)]
          : [...MODE_TABLE_CANDIDATES];

        for (const tableName of tablesToTry) {
          const { data, error, status } = await supabase
            .from(tableName)
            .upsert({ id: sessionId, preferences: nextPreferences }, { onConflict: "id" })
            .select("preferences")
            .single();

          if (error) {
            if (isMissingTableError(error)) {
              continue;
            }

            if (isNoRowError(error, status)) {
              preferencesRef.current = nextPreferences;
              lastSyncedModeRef.current = nextMode;
              modeTableRef.current = tableName;
              saved = true;
              break;
            }

            encounteredUnexpectedError = true;
            throw error;
          }

          const stored =
            data && typeof data.preferences === "object" && data.preferences !== null
              ? (data.preferences as Record<string, unknown>)
              : nextPreferences;

          preferencesRef.current = stored;
          lastSyncedModeRef.current = nextMode;
          modeTableRef.current = tableName;
          saved = true;
          break;
        }
      } catch (error) {
        encounteredUnexpectedError = true;
        console.warn("Impossibile salvare la modalità preferita su Supabase:", error);
      } finally {
        setPersisting(false);
      }

      if (!saved) {
        if (!encounteredUnexpectedError) {
          console.warn(
            "Nessuna tabella Supabase valida trovata per salvare le preferenze della modalità, disabilito la sincronizzazione remota.",
          );
        }

        modeTableRef.current = null;
        setRemoteSyncDisabled(true);
      }
    },
    [remoteSyncDisabled, sessionId],
  );

  useEffect(() => {
    if (!sessionId || remoteSyncDisabled) {
      return;
    }

    if (!hydrated) {
      return;
    }

    if (!availableModes.includes(mode)) {
      return;
    }

    if (lastSyncedModeRef.current === mode) {
      return;
    }

    void persistPreference(mode);
  }, [availableModes, hydrated, mode, persistPreference, remoteSyncDisabled, sessionId]);

  const handleSetMode = useCallback(
    (nextMode: Mode) => {
      if (!availableModes.includes(nextMode)) {
        return;
      }

      setModeState((current) => (current === nextMode ? current : nextMode));
    },
    [availableModes],
  );

  const toggleMode = useCallback(() => {
    if (availableModes.length < 2) {
      return;
    }

    setModeState((current) => {
      const currentIndex = availableModes.indexOf(current);
      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % availableModes.length;
      return availableModes[nextIndex];
    });
  }, [availableModes]);

  const hasFlag = useCallback((flag: string) => flags.has(flag), [flags]);

  const value = useMemo<ModeContextValue>(
    () => ({
      mode,
      availableModes,
      setMode: handleSetMode,
      toggleMode,
      isHydrated: hydrated,
      isPersisting: persisting && !remoteSyncDisabled,
      isSelectionVisible: hydrated && availableModes.length > 1,
      flags,
      hasFlag,
    }),
    [availableModes, flags, handleSetMode, hasFlag, hydrated, mode, persisting, remoteSyncDisabled, toggleMode],
  );

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
};

export const useMode = () => {
  const context = useContext(ModeContext);

  if (!context) {
    throw new Error("useMode deve essere utilizzato all'interno di un ModeProvider");
  }

  return context;
};

export default ModeContext;

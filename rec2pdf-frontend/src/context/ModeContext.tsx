import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useAnalytics } from "./AnalyticsContext";

type ModeContextValue = {
  flags: Set<string>;
  hasFlag: (flag: string) => boolean;
};

const ANALYTICS_FLAGS = new Set(["MODE_ADVANCED_V2"]);

const DEFAULT_MODE_FLAGS_SOURCE =
  typeof import.meta.env.VITE_DEFAULT_MODE_FLAGS === "string" &&
  import.meta.env.VITE_DEFAULT_MODE_FLAGS.trim().length > 0
    ? import.meta.env.VITE_DEFAULT_MODE_FLAGS
    : "MODE_BASE,MODE_ADVANCED";

const DEFAULT_FLAG_TOKENS = DEFAULT_MODE_FLAGS_SOURCE.split(",")
  .map((token) => token.trim())
  .filter((token) => token.length > 0);
const DEFAULT_FLAG_SET = new Set(DEFAULT_FLAG_TOKENS);

const ModeContext = createContext<ModeContextValue | undefined>(undefined);

type ModeProviderProps = {
  children: ReactNode;
  session: Session | null;
};

const extractFlags = (session: Session | null): Set<string> => {
  const flags = new Set<string>(DEFAULT_FLAG_SET);
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

export const ModeProvider = ({ children, session }: ModeProviderProps) => {
  const [flags, setFlags] = useState<Set<string>>(() => extractFlags(session));
  const { trackEvent } = useAnalytics();
  const sessionId = session?.user?.id ?? null;
  const reportedFlagsRef = useRef<Map<string | null, Set<string>>>(new Map());

  useEffect(() => {
    setFlags(extractFlags(session));
  }, [session]);

  useEffect(() => {
    const sessionKey = sessionId ?? "__anonymous__";
    if (!reportedFlagsRef.current.has(sessionKey)) {
      reportedFlagsRef.current.set(sessionKey, new Set());
    }
  }, [sessionId]);

  useEffect(() => {
    const sessionKey = sessionId ?? "__anonymous__";
    const seenForSession = reportedFlagsRef.current.get(sessionKey) ?? new Set<string>();

    let updated = false;

    ANALYTICS_FLAGS.forEach((flag) => {
      if (!flags.has(flag) || seenForSession.has(flag)) {
        return;
      }

      trackEvent("mode.flag_exposed", {
        flag,
        mode: "base",
      });

      seenForSession.add(flag);
      updated = true;
    });

    if (updated) {
      reportedFlagsRef.current.set(sessionKey, seenForSession);
    }
  }, [flags, sessionId, trackEvent]);

  const hasFlag = useCallback((flag: string) => flags.has(flag), [flags]);

  const value = useMemo<ModeContextValue>(
    () => ({
      flags,
      hasFlag,
    }),
    [flags, hasFlag],
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

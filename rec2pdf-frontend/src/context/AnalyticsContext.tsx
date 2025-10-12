import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import {
  trackEvent as defaultTrackEvent,
  trackToggleEvent as defaultTrackToggleEvent,
  type AnalyticsPayload,
} from "../utils/analytics";

type AnalyticsContextValue = {
  trackEvent: (eventName: string, payload?: AnalyticsPayload) => void;
  trackToggleEvent: (eventName: string, active: boolean, payload?: AnalyticsPayload) => void;
};

type AnalyticsProviderProps = {
  children: ReactNode;
  value?: Partial<AnalyticsContextValue>;
};

const defaultValue: AnalyticsContextValue = {
  trackEvent: defaultTrackEvent,
  trackToggleEvent: defaultTrackToggleEvent,
};

const AnalyticsContext = createContext<AnalyticsContextValue>(defaultValue);

export const AnalyticsProvider = ({ children, value }: AnalyticsProviderProps) => {
  const contextValue = useMemo<AnalyticsContextValue>(() => {
    const trackEvent = value?.trackEvent ?? defaultTrackEvent;
    const trackToggleEvent = value?.trackToggleEvent ?? defaultTrackToggleEvent;
    return { trackEvent, trackToggleEvent };
  }, [value?.trackEvent, value?.trackToggleEvent]);

  return <AnalyticsContext.Provider value={contextValue}>{children}</AnalyticsContext.Provider>;
};

export const useAnalytics = () => useContext(AnalyticsContext);

export default AnalyticsContext;

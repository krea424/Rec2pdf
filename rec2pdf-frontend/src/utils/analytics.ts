export type AnalyticsPayload = Record<string, unknown>;

type AnalyticsSink = {
  track?: (eventName: string, payload?: AnalyticsPayload) => void;
  push?: (payload: AnalyticsPayload & { event: string }) => void;
};

const resolveAnalyticsSink = (): AnalyticsSink | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const anyWindow = window as typeof window & {
    analytics?: AnalyticsSink;
    dataLayer?: Array<AnalyticsPayload> & AnalyticsSink;
  };

  if (anyWindow.analytics && typeof anyWindow.analytics.track === "function") {
    return anyWindow.analytics;
  }

  if (Array.isArray(anyWindow.dataLayer)) {
    return anyWindow.dataLayer;
  }

  return null;
};

export const trackEvent = (eventName: string, payload: AnalyticsPayload = {}): void => {
  if (!eventName) {
    return;
  }

  const sink = resolveAnalyticsSink();

  if (sink) {
    if (typeof sink.track === "function") {
      sink.track(eventName, payload);
      return;
    }

    if (typeof sink.push === "function") {
      sink.push({ event: eventName, ...payload });
      return;
    }
  }

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[analytics]", eventName, payload);
  }
};

export const trackToggleEvent = (
  eventName: string,
  active: boolean,
  payload: AnalyticsPayload = {},
): void => {
  trackEvent(eventName, { active, ...payload });
};

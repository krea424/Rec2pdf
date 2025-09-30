export const isLikelySecure = () => {
  if (typeof window !== "undefined" && window.isSecureContext) {
    return true;
  }
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".localhost");
};

export const pickBestMime = () => {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/mp4",
  ];
  for (const mime of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(mime)) {
      return mime;
    }
  }
  return undefined;
};

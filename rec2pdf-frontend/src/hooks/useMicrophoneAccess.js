import { useCallback, useEffect, useMemo, useState } from "react";
import { isLikelySecure } from "../utils/media";

const mapDevice = (device) => ({
  deviceId: device.deviceId,
  label: device.label || "Microfono",
});

export function useMicrophoneAccess() {
  const [secureOK, setSecureOK] = useState(isLikelySecure());
  const mediaSupported = useMemo(
    () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    []
  );
  const recorderSupported = useMemo(
    () => typeof MediaRecorder !== "undefined",
    []
  );
  const [permission, setPermission] = useState("unknown");
  const [permissionMessage, setPermissionMessage] = useState("");
  const [lastMicError, setLastMicError] = useState(null);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");

  useEffect(() => {
    setSecureOK(isLikelySecure());
  }, []);

  const refreshDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices?.enumerateDevices?.();
      const mics = (list || []).filter((d) => d.kind === "audioinput");
      setDevices(mics.map(mapDevice));
      setSelectedDeviceId((prev) => {
        if (prev && mics.some((mic) => mic.deviceId === prev)) {
          return prev;
        }
        return mics[0]?.deviceId || "";
      });
      return mics;
    } catch (error) {
      console.warn("Unable to enumerate devices", error);
      return [];
    }
  }, []);

  const requestPermission = useCallback(async () => {
    setPermissionMessage("");
    setLastMicError(null);
    if (!secureOK) {
      setPermissionMessage("Il microfono richiede HTTPS oppure localhost.");
      return false;
    }
    if (!mediaSupported) {
      setPermissionMessage("Browser senza getUserMedia.");
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setPermission("granted");
      setPermissionMessage("Permesso microfono concesso.");
      await refreshDevices();
      return true;
    } catch (error) {
      const name = error?.name || "";
      const message = error?.message || String(error);
      setLastMicError({ name, message });
      if (name === "NotAllowedError" || name === "SecurityError") {
        setPermission("denied");
        setPermissionMessage(
          "Accesso al microfono negato. Abilitalo dalle impostazioni del sito (icona lucchetto) e riprova."
        );
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setPermission("denied");
        setPermissionMessage(
          "Nessun microfono rilevato o vincoli non soddisfatti."
        );
      } else if (name === "NotReadableError") {
        setPermission("denied");
        setPermissionMessage(
          "Il microfono è occupato da un'altra app (Zoom/Teams/OBS). Chiudila e riprova."
        );
      } else if (name === "AbortError") {
        setPermission("prompt");
        setPermissionMessage(
          "Richiesta annullata. Riprova e accetta il prompt del browser."
        );
      } else {
        setPermission("unknown");
        setPermissionMessage(`Impossibile accedere al microfono: ${message}`);
      }
      return false;
    }
  }, [mediaSupported, refreshDevices, secureOK]);

  useEffect(() => {
    if (!navigator.permissions || !mediaSupported) {
      setPermission("unknown");
      return () => {};
    }
    let cancelled = false;
    let permissionStatus;
    (async () => {
      try {
        permissionStatus = await navigator.permissions.query({ name: "microphone" });
        if (cancelled) return;
        setPermission(permissionStatus.state || "unknown");
        permissionStatus.onchange = () => {
          setPermission(permissionStatus.state || "unknown");
        };
      } catch (error) {
        console.warn("Permission query failed", error);
        setPermission("unknown");
      }
    })();
    return () => {
      cancelled = true;
      if (permissionStatus) {
        permissionStatus.onchange = null;
      }
    };
  }, [mediaSupported]);

  useEffect(() => {
    if (permission === "granted") {
      refreshDevices();
    }
  }, [permission, refreshDevices]);

  return {
    secureOK,
    mediaSupported,
    recorderSupported,
    permission,
    setPermission,
    permissionMessage,
    setPermissionMessage,
    lastMicError,
    setLastMicError,
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    refreshDevices,
    requestPermission,
  };
}

export default useMicrophoneAccess;

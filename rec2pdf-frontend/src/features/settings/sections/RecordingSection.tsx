import { useCallback } from "react";
import { Mic, RefreshCw, TimerIcon } from "../../../components/icons";
import { Button, Select } from "../../../components/ui";
import PermissionBanner from "../../../components/PermissionBanner";
import { useAppContext } from "../../../hooks/useAppContext";
import { classNames } from "../../../utils/classNames";
import { trackEvent } from "../../../utils/analytics";

const RecordingSection = () => {
  const {
    theme,
    themes,
    requestPermission,
    permission,
    refreshDevices,
    devices = [],
    selectedDeviceId,
    setSelectedDeviceId,
    mediaSupported,
    recorderSupported,
    level = 0,
    secondsCap = 0,
    setSecondsCap,
  } = useAppContext();

  const handlePermissionRequest = useCallback(() => {
    trackEvent("settings.recording.permission_request");
    requestPermission?.();
  }, [requestPermission]);

  const handleRefreshDevices = useCallback(() => {
    trackEvent("settings.recording.refresh_devices");
    refreshDevices?.();
  }, [refreshDevices]);

  const handleDeviceChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value;
      setSelectedDeviceId?.(value);
      trackEvent("settings.recording.device_selected", { value });
    },
    [setSelectedDeviceId],
  );

  const handleSecondsCapChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const parsed = Math.max(0, parseInt(event.target.value || "0", 10) || 0);
      setSecondsCap?.(parsed);
      trackEvent("settings.recording.seconds_cap", { value: parsed });
    },
    [setSecondsCap],
  );

  return (
    <div className="space-y-6 text-sm text-zinc-200">
      <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <Mic className="h-4 w-4" /> Controlli registrazione
          </div>
          <div className="text-xs text-zinc-400">
            Permesso: <span className="font-mono">{permission}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className={themes[theme].button}
            onClick={handlePermissionRequest}
          >
            Concedi microfono
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className={classNames("gap-2", themes[theme].button)}
            onClick={handleRefreshDevices}
            leadingIcon={RefreshCw}
          >
            Dispositivi
          </Button>
        </div>
        {(!mediaSupported || !recorderSupported) && (
          <div className="text-xs text-rose-300">
            {!mediaSupported
              ? "getUserMedia non supportato dal browser."
              : "MediaRecorder non supportato dal browser."}
          </div>
        )}
        {permission === "granted" && devices.length > 0 && (
          <Select
            label="Sorgente microfono"
            value={selectedDeviceId}
            onChange={handleDeviceChange}
            containerClassName="mt-4"
            className={themes[theme].input}
          >
            {devices.map((device, index) => (
              <option key={device.deviceId || index} value={device.deviceId}>
                {device.label || `Dispositivo ${index + 1}`}
              </option>
            ))}
          </Select>
        )}
        {permission !== "granted" && (
          <div className="mt-4">
            <PermissionBanner />
          </div>
        )}
        <div className="mt-6">
          <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-900">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-300"
              style={{ width: `${Math.min(100, Math.round(level * 120))}%` }}
            />
          </div>
          <div className="mt-1 text-xs text-zinc-500">Livello input</div>
        </div>
      </div>

      <div className={classNames("rounded-xl border p-4", themes[theme].input)}>
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          <TimerIcon className="h-4 w-4" /> Durata massima (s)
        </label>
        <input
          type="number"
          min={0}
          className="mt-2 w-full rounded-lg border-zinc-800 bg-transparent px-3 py-2 outline-none"
          value={secondsCap}
          onChange={handleSecondsCapChange}
        />
        <div className="mt-2 text-xs text-zinc-500">0 = senza limite</div>
      </div>
    </div>
  );
};

export default RecordingSection;

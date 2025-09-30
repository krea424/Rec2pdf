import { useCallback, useState } from "react";

export function useBackendDiagnostics(backendUrl) {
  const [backendUp, setBackendUp] = useState(null);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [diagnostics, setDiagnostics] = useState({
    status: "idle",
    logs: [],
    message: "",
    statusCode: null,
  });

  const fetchBody = useCallback(async (url, options = {}) => {
    try {
      const response = await fetch(url, options);
      const contentType = response.headers.get("content-type") || "";
      const raw = await response.text();
      let data = null;
      if (contentType.includes("application/json")) {
        try {
          data = raw ? JSON.parse(raw) : null;
        } catch (error) {
          console.warn("JSON parse error", error);
        }
      }
      return { ok: response.ok, status: response.status, data, raw, contentType };
    } catch (error) {
      return { ok: false, status: 0, data: null, raw: "", contentType: "", error };
    }
  }, []);

  const checkHealth = useCallback(async () => {
    if (!backendUrl) {
      setBackendUp(null);
      return false;
    }
    setCheckingHealth(true);
    try {
      const response = await fetch(`${backendUrl}/api/health`, { cache: "no-store" });
      setBackendUp(response.ok);
      return response.ok;
    } catch (error) {
      console.warn("Health check failed", error);
      setBackendUp(false);
      return false;
    } finally {
      setCheckingHealth(false);
    }
  }, [backendUrl]);

  const runDiagnostics = useCallback(async () => {
    if (!backendUrl) {
      const message = "Imposta un URL backend prima di eseguire la diagnostica.";
      setDiagnostics({ status: "error", logs: [], message, statusCode: null });
      return { ok: false, status: 0, data: null, raw: "", message };
    }
    setDiagnostics({ status: "running", logs: [], message: "", statusCode: null });
    const result = await fetchBody(`${backendUrl}/api/diag`, { method: "GET" });
    const logs = result.data?.logs || [];
    const message = result.data?.message || (!result.ok ? result.raw || "Errore rete/CORS" : "");
    setDiagnostics({
      status: result.ok ? "success" : "error",
      logs,
      message,
      statusCode: result.status,
    });
    if (result.ok) {
      setBackendUp(true);
    }
    return result;
  }, [backendUrl, fetchBody]);

  return {
    backendUp,
    setBackendUp,
    checkingHealth,
    checkHealth,
    diagnostics,
    runDiagnostics,
    fetchBody,
  };
}

export default useBackendDiagnostics;

import { useEffect } from "react";
import { logClientError } from "../lib/logger";

export function BrowserDiagnostics() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      logClientError("browser.error", event.error ?? event.message, {
        filename: event.filename,
        line: event.lineno,
        column: event.colno
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      logClientError("browser.unhandled_rejection", event.reason);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}

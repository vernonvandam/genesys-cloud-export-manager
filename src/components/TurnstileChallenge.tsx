import { useEffect, useRef } from "react";

const SITE_KEY = "0x4AAAAAAFX_MmQeavfQ9765";
const ACTION = "request_access";
const SCRIPT_ID = "cloudflare-turnstile-api";

type TurnstileOptions = {
  sitekey: string;
  action: string;
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileOptions) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type Props = {
  onToken: (token: string) => void;
  onError: (message: string) => void;
  resetTrigger: number;
};

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    let script = document.getElementById(
      SCRIPT_ID,
    ) as HTMLScriptElement | null;

    const handleLoad = () => {
      if (window.turnstile) {
        resolve();
      } else {
        scriptPromise = null;
        reject(new Error("Turnstile did not initialise."));
      }
    };

    const handleError = () => {
      scriptPromise = null;
      script?.remove();
      reject(new Error("Turnstile could not be loaded."));
    };

    if (!script) {
      script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
    }

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });

    if (!script.isConnected) {
      document.head.appendChild(script);
    }
  });

  return scriptPromise;
}

export default function TurnstileChallenge({
  onToken,
  onError,
  resetTrigger,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const handlersRef = useRef({ onToken, onError });

  useEffect(() => {
    handlersRef.current = { onToken, onError };
  }, [onToken, onError]);

  useEffect(() => {
    let cancelled = false;
    let widgetId: string | null = null;
    const container = containerRef.current;

    if (!container) return;

    void loadTurnstileScript()
      .then(() => {
        if (cancelled || !window.turnstile) return;

        widgetId = window.turnstile.render(container, {
          sitekey: SITE_KEY,
          action: ACTION,
          callback: (token) => handlersRef.current.onToken(token),
          "expired-callback": () => handlersRef.current.onToken(""),
          "error-callback": () => {
            handlersRef.current.onToken("");
            handlersRef.current.onError(
              "The security check could not be completed. Please try again.",
            );
          },
        });

        widgetIdRef.current = widgetId;
      })
      .catch(() => {
        if (!cancelled) {
          handlersRef.current.onToken("");
          handlersRef.current.onError(
            "The security check could not load. Refresh the page and try again.",
          );
        }
      });

    return () => {
      cancelled = true;

      if (widgetId && window.turnstile) {
        window.turnstile.remove(widgetId);
      }

      widgetIdRef.current = null;
    };
  }, []);

  useEffect(() => {
    const widgetId = widgetIdRef.current;

    if (resetTrigger > 0 && widgetId && window.turnstile) {
      window.turnstile.reset(widgetId);
    }
  }, [resetTrigger]);

  return <div ref={containerRef} className="request-turnstile" />;
}
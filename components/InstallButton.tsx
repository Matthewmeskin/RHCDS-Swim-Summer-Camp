"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * "Install on your phone" helper. On Android/desktop Chrome it uses the native
 * install prompt; on iOS Safari (no prompt API) it shows Add-to-Home-Screen
 * steps. Hides itself once the app is already installed/standalone.
 */
export default function InstallButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) {
      setInstalled(true);
      return;
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  const isIos = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

  async function handleClick() {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setDeferred(null);
    } else if (isIos) {
      setShowIosHelp((v) => !v);
    } else {
      setShowIosHelp((v) => !v);
    }
  }

  // If there's no native prompt and we're not iOS, only show the helper button
  // when nothing else will (keeps the dashboard tidy on already-capable browsers).
  return (
    <section className="camp-card-sand mt-4 flex flex-wrap items-center gap-4 p-5">
      <div className="text-3xl">📲</div>
      <div className="min-w-[200px] flex-1">
        <h2 className="font-display text-xl text-brand-green">Put it on your phone</h2>
        <p className="text-sm text-brand-text/70">
          Add the Swim Portal to your home screen so it opens like a real app — one tap, no browser.
        </p>
        {showIosHelp ? (
          <p className="mt-2 rounded-lg bg-white px-3 py-2 text-sm text-brand-text/80">
            {isIos ? (
              <>Tap the <strong>Share</strong> button (the square with an arrow), then{" "}
              <strong>Add to Home Screen</strong>.</>
            ) : (
              <>Open your browser menu (⋮) and choose <strong>Install app</strong> or{" "}
              <strong>Add to Home screen</strong>.</>
            )}
          </p>
        ) : null}
      </div>
      <button onClick={handleClick} className="camp-btn shrink-0">
        {deferred ? "📲 Install app" : "📲 How to install"}
      </button>
    </section>
  );
}

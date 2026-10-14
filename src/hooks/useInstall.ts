import { useCallback, useEffect, useState } from 'react';

/**
 * The browser's own "install this app" prompt, held until a person asks for it.
 *
 * Chromium fires `beforeinstallprompt` once it decides the page is installable;
 * calling `preventDefault` stops its mini-infobar so the prompt can be offered
 * from a button instead. Safari and Firefox never fire it — there, installing
 * is done from the browser's own share or menu — so `canInstall` stays false
 * and no button is drawn rather than a button that does nothing.
 */

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    listeners.forEach((notify) => notify());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((notify) => notify());
  });
}

/** True when running as an installed app rather than in a browser tab. */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function useInstall() {
  const [canInstall, setCanInstall] = useState(() => deferred !== null);

  useEffect(() => {
    const notify = () => setCanInstall(deferred !== null);
    listeners.add(notify);
    notify();
    return () => {
      listeners.delete(notify);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return false;
    const prompt = deferred;
    deferred = null;
    setCanInstall(false);
    await prompt.prompt();
    const choice = await prompt.userChoice;
    return choice.outcome === 'accepted';
  }, []);

  return { canInstall, install };
}

"use client";
import { useState, useEffect } from "react";

const STORAGE_KEY = "foundit_notif_settings";

const DEFAULTS = {
  chatMessages: true,
  itemUpdates: true,
  browserAlerts: false,
};

/**
 * Reads notification settings from localStorage (same key as Profile page).
 * Returns the current settings object — always in sync with storage.
 */
export function useNotifSettings() {
  const [settings, setSettings] = useState(DEFAULTS);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setSettings({ ...DEFAULTS, ...JSON.parse(saved) });
    } catch {
      // ignore parse errors
    }

    // Listen for changes from other tabs or the Profile page
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          setSettings({ ...DEFAULTS, ...JSON.parse(e.newValue) });
        } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return settings;
}

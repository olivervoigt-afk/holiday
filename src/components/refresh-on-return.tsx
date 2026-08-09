"use client";

import { useEffect } from "react";

/** Erst nach dieser Abwesenheit lohnt sich das Neuladen. */
const STALE_AFTER_MS = 30_000;

/**
 * Lädt die Seite neu, sobald man nach längerer Zeit zur App zurückkehrt.
 *
 * iOS friert eine App vom Home-Bildschirm beim Wegschalten ein und zeigt sie
 * unverändert wieder an, ohne das Netz zu befragen. Im Vollbildmodus gibt es
 * auch keinen Neuladen-Knopf — ohne diesen Anstoss stünden dort noch Tage
 * später die alten Salden.
 *
 * Bewusst `location.reload()` und nicht `router.refresh()`: letzteres bleibt
 * aus einem nativen Ereignis heraus wirkungslos (nachgemessen, auch in
 * `startTransition`). Der Preis ist ein vollständiger Neuaufbau — deshalb
 * bleibt er aus, solange irgendwo etwas Angefangenes im Formular steht.
 */
export default function RefreshOnReturn() {
  useEffect(() => {
    let hiddenSince = 0;

    /** Hat jemand etwas eingetippt, das ein Neuladen verwerfen würde? */
    function hasUnsavedInput(): boolean {
      const fields = document.querySelectorAll<
        HTMLInputElement | HTMLTextAreaElement
      >("input, textarea");

      return Array.from(fields).some((field) => {
        if (field instanceof HTMLInputElement) {
          if (field.type === "hidden" || field.type === "submit") return false;
          if (field.type === "checkbox" || field.type === "radio") {
            return field.checked !== field.defaultChecked;
          }
        }
        return field.value !== field.defaultValue;
      });
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        hiddenSince = Date.now();
        return;
      }

      const away = hiddenSince ? Date.now() - hiddenSince : 0;
      hiddenSince = 0;

      if (away > STALE_AFTER_MS && !hasUnsavedInput()) {
        location.reload();
      }
    }

    // Beim Zurück-Wischen holt Safari die Seite aus dem Verlaufsspeicher;
    // dann ist sie mit Sicherheit veraltet.
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted && !hasUnsavedInput()) location.reload();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  return null;
}

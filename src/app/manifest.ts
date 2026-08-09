import type { MetadataRoute } from "next";

/**
 * Macht die Anwendung auf dem Handy installierbar: Safari legt sie über
 * „Teilen → Zum Home-Bildschirm" als Symbol ab, danach startet sie im
 * Vollbild ohne Adresszeile.
 *
 * Am Zugang ändert das nichts — geschützt wird weiterhin durch die Anmeldung.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Urlaubsverwaltung",
    short_name: "Urlaub",
    description:
      "Urlaubsanträge erfassen, genehmigen und Salden im Blick behalten",
    lang: "de",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f7f9",
    theme_color: "#f6f7f9",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Urlaub beantragen",
        url: "/antraege/neu",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      { name: "Wer ist weg?", url: "/abwesenheiten" },
    ],
  };
}

import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Urlaubsverwaltung",
    template: "%s · Urlaubsverwaltung",
  },
  description:
    "Urlaubsanträge erfassen, genehmigen und Salden im Blick behalten",
  applicationName: "Urlaubsverwaltung",
  // Angaben für den Start vom Home-Bildschirm des iPhones.
  appleWebApp: {
    capable: true,
    title: "Urlaub",
    // "default" lässt iOS die Statusleiste selbst füllen — der Inhalt beginnt
    // darunter. Das ist ruhiger als eine durchscheinende Leiste.
    statusBarStyle: "default",
  },
  // Safari erkennt sonst Datumsangaben und macht Telefonnummern daraus.
  formatDetection: { telephone: false, date: false, address: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1014" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}

/**
 * Erzeugt die App-Symbole aus `src/app/icon.svg`.
 *
 *   npm run icons
 *
 * Anzupassen ist nur das SVG — die Rastergrössen entstehen daraus. Das
 * maskierbare Symbol bekommt zusätzlichen Rand, weil Android einen Teil des
 * Bildes wegschneidet.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const SOURCE = "src/app/icon.svg";

const TARGETS = [
  { file: "public/icons/icon-192.png", size: 192, padding: 0 },
  { file: "public/icons/icon-512.png", size: 512, padding: 0 },
  // Android schneidet bis zu 20 % am Rand weg — deshalb hier eingerückt.
  { file: "public/icons/icon-maskable-512.png", size: 512, padding: 0.14 },
  // iOS legt selbst abgerundete Ecken an und mag keine Transparenz.
  { file: "src/app/apple-icon.png", size: 180, padding: 0 },
];

const svg = await readFile(SOURCE);
await mkdir("public/icons", { recursive: true });

for (const { file, size, padding } of TARGETS) {
  const inner = Math.round(size * (1 - 2 * padding));
  const margin = Math.round((size - inner) / 2);

  const art = await sharp(svg, { density: 600 })
    .resize(inner, inner)
    .png()
    .toBuffer();

  const image =
    margin === 0
      ? art
      : await sharp({
          create: {
            width: size,
            height: size,
            channels: 4,
            // Hintergrund im selben Blau wie das Symbol, damit der Rand
            // beim Zuschneiden nicht auffällt.
            background: { r: 0x20, g: 0x5a, b: 0xe0, alpha: 1 },
          },
        })
          .composite([{ input: art, top: margin, left: margin }])
          .png()
          .toBuffer();

  await writeFile(file, image);
  console.log(`  ${file.padEnd(38)} ${size}×${size}`);
}

console.log("\nFertig.");

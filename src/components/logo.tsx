/**
 * Das App-Symbol für Kopfzeile und Anmeldeseite.
 *
 * Gezeichnet wird es in `src/app/icon.svg`; `npm run icons` legt die Kopie
 * unter `public/icons/logo.svg` ab und erzeugt die Rastergrössen. So gibt es
 * nur eine Quelle, die gepflegt werden muss.
 *
 * Die Rundung sitzt hier und nicht im SVG: auf dem Home-Bildschirm legt iOS
 * seine eigene Maske darüber, dort wäre eine mitgezeichnete Ecke falsch.
 */
export default function Logo({
  className = "size-7",
}: {
  className?: string;
}) {
  return (
    // Kein next/image: Vektoren werden davon ohnehin nicht optimiert.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/icons/logo.svg"
      alt=""
      aria-hidden="true"
      className={`shrink-0 rounded-[22.5%] ${className}`}
    />
  );
}

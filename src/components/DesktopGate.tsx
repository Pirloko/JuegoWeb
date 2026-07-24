/** Pantalla suave: puntocachero solo en smartphone (jugadores). */
export default function DesktopGate() {
  return (
    <div className="desktop-gate" role="dialog" aria-live="polite" aria-label="Usa tu celular">
      <div className="desktop-gate-card">
        <div className="desktop-gate-phone" aria-hidden />
        <h1>Puntocachero es para celular</h1>
        <p>
          Cacherito abre el juego desde tu celular ingresa a tu navegador favorito para jugar, superar niveles y revelar las
          imágenes cariñosas mi potro.
        </p>
        <p className="desktop-gate-aside">
          En computador no está disponible la experiencia de juego. Agregá la app a tu pantalla
          de inicio para entrar más rápido en el celular.
        </p>
      </div>
    </div>
  );
}

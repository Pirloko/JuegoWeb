/** Overlay CSS: gira el teléfono en landscape táctil. */
export default function OrientationGate() {
  return (
    <div className="orientation-gate" role="dialog" aria-live="polite" aria-label="Gira el teléfono">
      <div className="orientation-gate-card">
        <div className="orientation-phone" aria-hidden />
        <p>Gira tu teléfono a vertical</p>
      </div>
    </div>
  );
}

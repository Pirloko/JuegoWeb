import './home.css';

export default function HomeScreen() {
  return (
    <main className="home">
      <div className="home-brand">
        <h1>JuegoWeb</h1>
        <p>Conquista el territorio. Revela la imagen.</p>
      </div>
      <div className="home-actions">
        <button className="play-button" disabled>
          JUGAR
        </button>
        <p className="home-note">Prototipo jugable en la Fase 2</p>
      </div>
    </main>
  );
}

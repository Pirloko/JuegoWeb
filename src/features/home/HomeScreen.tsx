import { useNavigate } from 'react-router-dom';
import './home.css';

export default function HomeScreen() {
  const navigate = useNavigate();
  return (
    <main className="home">
      <div className="home-brand">
        <h1>JuegoWeb</h1>
        <p>Conquista el territorio. Revela la imagen.</p>
      </div>
      <div className="home-actions">
        <button className="play-button" onClick={() => navigate('/play')}>
          JUGAR
        </button>
        <p className="home-note">Prototipo — Fase 2</p>
      </div>
    </main>
  );
}

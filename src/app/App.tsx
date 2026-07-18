import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import HomeScreen from '@/features/home/HomeScreen';

// Perezoso: la Home no descarga Phaser hasta pulsar JUGAR.
const GameScreen = lazy(() => import('@/features/game/GameScreen'));

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route
          path="/play"
          element={
            <Suspense fallback={<div className="screen-loading">Cargando…</div>}>
              <GameScreen />
            </Suspense>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

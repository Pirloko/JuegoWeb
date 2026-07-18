import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/AuthProvider';
import RequireAuth from '@/features/auth/RequireAuth';
import LoginScreen from '@/features/auth/LoginScreen';
import RegisterScreen from '@/features/auth/RegisterScreen';
import HomeScreen from '@/features/home/HomeScreen';
import LevelsScreen from '@/features/levels/LevelsScreen';
import GalleryScreen from '@/features/gallery/GalleryScreen';
import ProfileScreen from '@/features/profile/ProfileScreen';
import OrientationGate from '@/components/OrientationGate';
import AppShell from '@/components/AppShell';
import RequireAdmin from '@/features/admin/RequireAdmin';
import AdminLevelsScreen from '@/features/admin/AdminLevelsScreen';
import AdminLevelEditScreen from '@/features/admin/AdminLevelEditScreen';
import AdminSeasonsScreen from '@/features/admin/AdminSeasonsScreen';
import SeasonPassScreen from '@/features/pass/SeasonPassScreen';
import PaymentOkScreen from '@/features/pass/PaymentOkScreen';
import MySeasonsScreen from '@/features/pass/MySeasonsScreen';

const GameScreen = lazy(() => import('@/features/game/GameScreen'));

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <OrientationGate />
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/registro" element={<RegisterScreen />} />

          <Route element={<AppShell />}>
            <Route path="/" element={<HomeScreen />} />
            <Route
              path="/levels"
              element={
                <RequireAuth>
                  <LevelsScreen />
                </RequireAuth>
              }
            />
            <Route
              path="/gallery"
              element={
                <RequireAuth>
                  <GalleryScreen />
                </RequireAuth>
              }
            />
            <Route
              path="/perfil"
              element={
                <RequireAuth>
                  <ProfileScreen />
                </RequireAuth>
              }
            />
            <Route
              path="/mis-temporadas"
              element={
                <RequireAuth>
                  <MySeasonsScreen />
                </RequireAuth>
              }
            />
          </Route>

          <Route
            path="/pase/:seasonId"
            element={
              <RequireAuth>
                <SeasonPassScreen />
              </RequireAuth>
            }
          />
          <Route
            path="/pago/ok"
            element={
              <RequireAuth>
                <PaymentOkScreen />
              </RequireAuth>
            }
          />

          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <AdminLevelsScreen />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/seasons"
            element={
              <RequireAdmin>
                <AdminSeasonsScreen />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/levels/:levelId"
            element={
              <RequireAdmin>
                <AdminLevelEditScreen />
              </RequireAdmin>
            }
          />
          <Route
            path="/play/:levelId"
            element={
              <RequireAuth>
                <Suspense fallback={<div className="screen-loading">Cargando…</div>}>
                  <GameScreen />
                </Suspense>
              </RequireAuth>
            }
          />
          <Route path="/play" element={<Navigate to="/levels" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/AuthProvider';
import RequireAuth from '@/features/auth/RequireAuth';
import LoginScreen from '@/features/auth/LoginScreen';
import RegisterScreen from '@/features/auth/RegisterScreen';
import LevelsScreen from '@/features/levels/LevelsScreen';
import GalleryScreen from '@/features/gallery/GalleryScreen';
import ProfileScreen from '@/features/profile/ProfileScreen';
import BadgesScreen from '@/features/progression/BadgesScreen';
import OrientationGate from '@/components/OrientationGate';
import AppShell from '@/components/AppShell';
import RequireAdmin from '@/features/admin/RequireAdmin';
import BlockAdminFromPlayer from '@/features/admin/BlockAdminFromPlayer';
import HomeOrAdminRedirect from '@/features/admin/HomeOrAdminRedirect';
import AdminDashboardScreen from '@/features/admin/AdminDashboardScreen';
import AdminLevelsScreen from '@/features/admin/AdminLevelsScreen';
import AdminLevelEditScreen from '@/features/admin/AdminLevelEditScreen';
import AdminSeasonsScreen from '@/features/admin/AdminSeasonsScreen';
import AdminFriendSitesScreen from '@/features/admin/AdminFriendSitesScreen';
import AdminSubscriptionsScreen from '@/features/admin/AdminSubscriptionsScreen';
import SeasonPassScreen from '@/features/pass/SeasonPassScreen';
import PaymentOkScreen from '@/features/pass/PaymentOkScreen';
import MySeasonsScreen from '@/features/pass/MySeasonsScreen';
import { TutorialProvider } from '@/features/tutorial/TutorialProvider';

const GameScreen = lazy(() => import('@/features/game/GameScreen'));

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <TutorialProvider>
        <OrientationGate />
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/registro" element={<RegisterScreen />} />

          <Route element={<AppShell />}>
            <Route path="/" element={<HomeOrAdminRedirect />} />
            <Route
              path="/levels"
              element={
                <RequireAuth>
                  <BlockAdminFromPlayer>
                    <LevelsScreen />
                  </BlockAdminFromPlayer>
                </RequireAuth>
              }
            />
            <Route
              path="/gallery"
              element={
                <RequireAuth>
                  <BlockAdminFromPlayer>
                    <GalleryScreen />
                  </BlockAdminFromPlayer>
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
              path="/logros"
              element={
                <RequireAuth>
                  <BlockAdminFromPlayer>
                    <BadgesScreen />
                  </BlockAdminFromPlayer>
                </RequireAuth>
              }
            />
            <Route
              path="/mis-temporadas"
              element={
                <RequireAuth>
                  <BlockAdminFromPlayer>
                    <MySeasonsScreen />
                  </BlockAdminFromPlayer>
                </RequireAuth>
              }
            />
            <Route
              path="/admin"
              element={
                <RequireAdmin>
                  <AdminDashboardScreen />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/niveles"
              element={
                <RequireAdmin>
                  <AdminLevelsScreen />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/suscripciones"
              element={
                <RequireAdmin>
                  <AdminSubscriptionsScreen />
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
              path="/admin/sitios"
              element={
                <RequireAdmin>
                  <AdminFriendSitesScreen />
                </RequireAdmin>
              }
            />
          </Route>

          <Route
            path="/pase/:seasonId"
            element={
              <RequireAuth>
                <BlockAdminFromPlayer>
                  <SeasonPassScreen />
                </BlockAdminFromPlayer>
              </RequireAuth>
            }
          />
          <Route
            path="/pago/ok"
            element={
              <RequireAuth>
                <BlockAdminFromPlayer>
                  <PaymentOkScreen />
                </BlockAdminFromPlayer>
              </RequireAuth>
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
                <BlockAdminFromPlayer>
                  <Suspense fallback={<div className="screen-loading">Cargando…</div>}>
                    <GameScreen />
                  </Suspense>
                </BlockAdminFromPlayer>
              </RequireAuth>
            }
          />
          <Route path="/play" element={<Navigate to="/levels" replace />} />
        </Routes>
        </TutorialProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}

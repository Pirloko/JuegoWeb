import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/auth-context';
import { isAdminUser } from '@/features/admin/isAdmin';
import {
  fetchTutorialSeen,
  getTutorialSeenCache,
  markTutorialSeen,
} from '@/services/supabase/tutorial';
import TutorialOverlay from './TutorialOverlay';

interface TutorialContextValue {
  /** Abre el tutorial (p. ej. desde Perfil). */
  openTutorial: () => void;
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function useTutorial(): TutorialContextValue {
  const ctx = useContext(TutorialContext);
  if (!ctx) {
    throw new Error('useTutorial debe usarse dentro de TutorialProvider');
  }
  return ctx;
}

/**
 * Muestra el tutorial automáticamente la primera vez.
 * Permite reabrir desde Perfil. No aplica a admins.
 */
export function TutorialProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [ready, setReady] = useState(false);
  const admin = isAdminUser(user);

  useEffect(() => {
    if (authLoading) return;
    if (!user || admin) {
      setOpen(false);
      setReady(true);
      return;
    }

    let cancelled = false;
    const cached = getTutorialSeenCache(user.id);

    if (cached === true) {
      setReady(true);
      void fetchTutorialSeen(user.id).catch(() => {
        /* ignore */
      });
      return;
    }

    void (async () => {
      try {
        const seen = await fetchTutorialSeen(user.id);
        if (cancelled) return;
        if (!seen) {
          setReplaying(false);
          setOpen(true);
        }
      } catch {
        // Si falla la red y no hay cache, no bloqueamos la app.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, admin]);

  const openTutorial = useCallback(() => {
    if (admin) return;
    setReplaying(true);
    setOpen(true);
  }, [admin]);

  const finish = useCallback(async () => {
    setOpen(false);
    const uid = user?.id;
    if (!uid) return;
    try {
      await markTutorialSeen(uid);
    } catch {
      // Cerrar igual; se reintentará la próxima sesión si falló.
    }
    if (!replaying) {
      navigate('/levels');
    }
  }, [user?.id, replaying, navigate]);

  const value = useMemo(() => ({ openTutorial }), [openTutorial]);

  return (
    <TutorialContext.Provider value={value}>
      {children}
      {ready && open && user && !admin && (
        <TutorialOverlay replaying={replaying} onFinish={() => void finish()} />
      )}
    </TutorialContext.Provider>
  );
}

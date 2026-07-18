import { Navigate, useLocation } from 'react-router-dom';
import { hasConfirmedAge18 } from './legalMeta';

/** Bloquea login/registro hasta confirmar +18 en este dispositivo. */
export default function RequireAgeGate({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  if (!hasConfirmedAge18()) {
    return (
      <Navigate
        to="/aviso-edad"
        replace
        state={{ next: `${location.pathname}${location.search}` }}
      />
    );
  }
  return children;
}

import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import BrandLogo from '@/components/BrandLogo';
import { useAuth } from './auth-context';
import '../legal/legal.css';
import './auth.css';

export default function LoginScreen() {
  const { signIn, session, loading, configured } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && session) {
    return <Navigate to={from} replace />;
  }

  if (!configured) {
    return (
      <div className="screen-loading">
        Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: msg } = await signIn(email.trim(), password);
    setSubmitting(false);
    if (msg) {
      setError(msg);
      return;
    }
    navigate(from, { replace: true });
  }

  return (
    <main className="auth">
      <div className="auth-brand">
        <BrandLogo size="md" />
      </div>
      <p className="auth-age-note">Contenido +18</p>
      <h1>Entrar</h1>
      <p className="auth-lead">Escribe tu email y contraseña para continuar</p>
      <form className="auth-form" onSubmit={onSubmit}>
        <div className="auth-field">
          <label htmlFor="login-email">Tu email</label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            placeholder="ej. tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="auth-field">
          <label htmlFor="login-password">Tu contraseña</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="auth-error">{error}</p>}
        <button className="auth-submit" type="submit" disabled={submitting}>
          {submitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <p className="auth-switch">
        ¿Primera vez? <Link to="/registro">Crear cuenta</Link>
      </p>
      <nav className="auth-legal-links" aria-label="Legal">
        <Link to="/legal/terminos">Condiciones</Link>
        <Link to="/legal/privacidad">Privacidad</Link>
      </nav>
      <Link className="auth-back" to="/">
        Volver al inicio
      </Link>
    </main>
  );
}

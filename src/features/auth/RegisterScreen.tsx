import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import BrandLogo from '@/components/BrandLogo';
import { useAuth } from './auth-context';
import '../legal/legal.css';
import './auth.css';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;

export default function RegisterScreen() {
  const { signUp, session, loading, configured } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && session) {
    return <Navigate to="/" replace />;
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
    setInfo(null);

    const trimmedUser = username.trim();
    if (!USERNAME_RE.test(trimmedUser)) {
      setError('Usuario: 3–24 caracteres, solo letras, números y _');
      return;
    }
    if (!acceptedLegal) {
      setError('Debes confirmar que tienes 18+ y aceptar Condiciones y Privacidad');
      return;
    }

    setSubmitting(true);
    const { error: msg, needsEmailConfirm } = await signUp(
      email.trim(),
      password,
      trimmedUser,
    );
    setSubmitting(false);

    if (msg) {
      setError(msg);
      return;
    }

    if (needsEmailConfirm) {
      setInfo('Revisa tu email para confirmar la cuenta, luego inicia sesión.');
      return;
    }

    navigate('/', { replace: true });
  }

  return (
    <main className="auth">
      <div className="auth-brand">
        <BrandLogo size="md" />
      </div>
      <p className="auth-age-note">Contenido +18</p>
      <h1>Crear cuenta</h1>
      <p className="auth-lead">Elige un nombre, email y contraseña (mín. 6 caracteres)</p>
      <form className="auth-form" onSubmit={onSubmit}>
        <div className="auth-field">
          <label htmlFor="reg-username">Nombre de usuario</label>
          <input
            id="reg-username"
            type="text"
            autoComplete="username"
            required
            minLength={3}
            maxLength={24}
            placeholder="ej. carlos"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="auth-field">
          <label htmlFor="reg-email">Tu email</label>
          <input
            id="reg-email"
            type="email"
            autoComplete="email"
            required
            placeholder="ej. tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="auth-field">
          <label htmlFor="reg-password">Contraseña</label>
          <input
            id="reg-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <label className="auth-legal-check">
          <input
            type="checkbox"
            checked={acceptedLegal}
            onChange={(e) => setAcceptedLegal(e.target.checked)}
            required
          />
          <span>
            Confirmo que tengo <strong>18 años o más</strong> y acepto las{' '}
            <Link to="/legal/terminos" target="_blank" rel="noopener noreferrer">
              Condiciones de uso
            </Link>{' '}
            y la{' '}
            <Link to="/legal/privacidad" target="_blank" rel="noopener noreferrer">
              Política de privacidad
            </Link>
            .
          </span>
        </label>

        {error && <p className="auth-error">{error}</p>}
        {info && <p className="auth-info">{info}</p>}
        <button className="auth-submit" type="submit" disabled={submitting || !acceptedLegal}>
          {submitting ? 'Creando…' : 'Crear cuenta'}
        </button>
      </form>
      <p className="auth-switch">
        ¿Ya tienes cuenta? <Link to="/login">Entrar</Link>
      </p>
      <Link className="auth-back" to="/">
        Volver al inicio
      </Link>
    </main>
  );
}

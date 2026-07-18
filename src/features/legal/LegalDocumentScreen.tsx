import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { getLegalDoc } from './legalContent';
import './legal.css';

export default function LegalDocumentScreen() {
  const { docSlug } = useParams<{ docSlug: string }>();
  const navigate = useNavigate();
  const doc = docSlug ? getLegalDoc(docSlug) : null;

  if (!doc) {
    return <Navigate to="/" replace />;
  }

  const other =
    doc.slug === 'terminos'
      ? { to: '/legal/privacidad', label: 'Política de privacidad' }
      : { to: '/legal/terminos', label: 'Condiciones de uso' };

  return (
    <main className="legal">
      <header className="legal-header">
        <button
          type="button"
          className="legal-back"
          aria-label="Volver"
          onClick={() => navigate(-1)}
        >
          ←
        </button>
        <div className="legal-heading">
          <h1>{doc.title}</h1>
          <p>{doc.subtitle}</p>
        </div>
      </header>

      <article className="legal-body">
        {doc.sections.map((section) => (
          <section key={section.title} className="legal-section">
            <h2>{section.title}</h2>
            {section.paragraphs.map((p, i) => (
              <p key={`${section.title}-${i}`}>{p}</p>
            ))}
          </section>
        ))}
      </article>

      <nav className="legal-footer-nav" aria-label="Documentos legales">
        <Link to={other.to}>{other.label}</Link>
        <Link to="/">Volver al inicio</Link>
      </nav>
    </main>
  );
}

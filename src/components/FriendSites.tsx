import { useEffect, useState } from 'react';
import {
  fetchActiveFriendSites,
  type FriendSiteRow,
} from '@/services/supabase/friendSites';
import './friend-sites.css';

interface Props {
  /** `compact` en listas; `full` en detalle de galería. */
  variant?: 'compact' | 'full';
}

/** Enlaces a sitios amigos / recomendados (desde Supabase). */
export default function FriendSites({ variant = 'full' }: Props) {
  const [sites, setSites] = useState<FriendSiteRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await fetchActiveFriendSites();
        if (!cancelled) setSites(list);
      } catch {
        if (!cancelled) setSites([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (sites.length === 0) return null;

  return (
    <section
      className={`friend-sites is-${variant}`}
      aria-label="Sitios amigos y recomendados"
    >
      <div className="friend-sites-head">
        <h3 className="friend-sites-title">Sitios amigos</h3>
        <p className="friend-sites-sub">Recomendados por la casa, cachero</p>
      </div>
      <ul className="friend-sites-list">
        {sites.map((site) => (
          <li key={site.id}>
            <a
              className="friend-site-card"
              href={site.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className={`friend-site-tag is-${site.tag.toLowerCase()}`}>{site.tag}</span>
              <span className="friend-site-name">{site.name}</span>
              {site.blurb && <span className="friend-site-blurb">{site.blurb}</span>}
              <span className="friend-site-go" aria-hidden>
                Visitar ↗
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

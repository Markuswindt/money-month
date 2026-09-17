import { useEffect, useState } from 'react';
import { Share, X } from 'lucide-react';
import { useDataStore } from '@/store/dataStore';
import s from './InstallHint.module.css';

/** iOS zeigt keinen Installationsdialog an - der Weg ueber das Teilen-Menue
 *  muss deshalb erklaert werden. Auf allen anderen Plattformen
 *  uebernimmt das der Browser selbst. */
function isIosSafariBrowser(): boolean {
  try {
    const ua = navigator.userAgent;
    const iOS = /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (!iOS) return false;
    // Bereits vom Home-Bildschirm gestartet: nichts zu tun.
    const standalone = (navigator as Navigator & { standalone?: boolean }).standalone;
    if (standalone === true) return false;
    if (window.matchMedia('(display-mode: standalone)').matches) return false;
    // Chrome und Firefox auf iOS koennen nicht zum Home-Bildschirm hinzufuegen.
    return !/CriOS|FxiOS|EdgiOS/.test(ua);
  } catch {
    return false;
  }
}

export function InstallHint() {
  const dismissedAt = useDataStore((st) => st.settings.installHintDismissedAt);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (dismissedAt === null) setShow(isIosSafariBrowser());
  }, [dismissedAt]);

  if (!show || dismissedAt !== null) return null;

  return (
    <aside className={s.hint}>
      <Share size={18} aria-hidden style={{ color: 'var(--accent-text)', flex: 'none', marginTop: 2 }} />
      <p className={s.text}>
        <span className={s.title}>Auf den Home-Bildschirm legen</span>
        Teilen → „Zum Home-Bildschirm“. Dann bleiben die Daten dauerhaft erhalten.
      </p>
      <button
        type="button"
        className={`btn btn--icon ${s.close}`}
        aria-label="Hinweis ausblenden"
        onClick={() => {
          setShow(false);
          void useDataStore.getState().patchSettings({ installHintDismissedAt: new Date().toISOString() });
        }}
      >
        <X size={18} aria-hidden />
      </button>
    </aside>
  );
}

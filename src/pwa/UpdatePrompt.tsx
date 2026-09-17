import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from '@/components/ui/toast';

/**
 * Meldet eine neue Version, laedt aber nicht von selbst neu.
 *
 * Ein automatischer Reload trifft irgendwann jemanden mitten in einer
 * halb ausgefuellten Eingabe. Die Entscheidung gehoert dem Nutzer.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true });

  useEffect(() => {
    if (!needRefresh) return;
    toast('Neue Version verfügbar', {
      actionLabel: 'Neu laden',
      timeout: 0,
      onAction: () => {
        setNeedRefresh(false);
        void updateServiceWorker(true);
      },
    });
  }, [needRefresh, setNeedRefresh, updateServiceWorker]);

  return null;
}

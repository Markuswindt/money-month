import { Toast } from '@base-ui/react/toast';

/** Ausserhalb des React-Baums erzeugt, damit auch Store-Aktionen und
 *  Event-Handler eine Meldung ausloesen koennen, ohne einen Hook zu haben. */
export const toastManager = Toast.createToastManager();

export function toast(
  title: string,
  options?: { description?: string; actionLabel?: string; onAction?: () => void; timeout?: number },
): void {
  const id = toastManager.add({
    title,
    ...(options?.description !== undefined ? { description: options.description } : {}),
    // 5 Sekunden: lang genug, um ein versehentliches Loeschen zu bemerken,
    // kurz genug, um nicht im Weg zu stehen.
    timeout: options?.timeout ?? 5000,
    ...(options?.actionLabel
      ? {
          actionProps: {
            children: options.actionLabel,
            onClick() {
              options.onAction?.();
              toastManager.close(id);
            },
          },
        }
      : {}),
  });
}

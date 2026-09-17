import { Toast } from '@base-ui/react/toast';
import { toastManager } from './toast';
import s from './Toaster.module.css';

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((item) => (
    <Toast.Root key={item.id} toast={item} className={s.toast}>
      <Toast.Title className={s.title} />
      <Toast.Action className={s.action} />
    </Toast.Root>
  ));
}

/** Rueckmeldung nach dem Speichern und Loeschen - inklusive
 *  "Rückgängig", das den Bestaetigungsdialog ersetzt. */
export function Toaster({ children }: { children: React.ReactNode }) {
  return (
    <Toast.Provider toastManager={toastManager}>
      {children}
      <Toast.Portal>
        <Toast.Viewport className={s.viewport}>
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

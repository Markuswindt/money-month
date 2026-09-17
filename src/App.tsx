import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { AppShell } from '@/components/ui/AppShell';
import { Toaster } from '@/components/ui/Toaster';
import { EmptyState } from '@/components/ui/EmptyState';
import { EntrySheet } from '@/features/entry/EntrySheet';
import { OverviewScreen } from '@/features/overview/OverviewScreen';
import { ExpensesScreen } from '@/features/expenses/ExpensesScreen';
import { FixedScreen } from '@/features/fixed/FixedScreen';
import { CategoryDetailScreen } from '@/features/categories/CategoryDetailScreen';
import { CategoriesScreen } from '@/features/categories/CategoriesScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { TokenPreview } from '@/features/settings/TokenPreview';
import { InstallHint } from '@/pwa/InstallHint';
import { UpdatePrompt } from '@/pwa/UpdatePrompt';
import { useDataStore } from '@/store/dataStore';
import { useEntryStore } from '@/store/entryStore';

// Dev-Tool: Option-Click on any element to open its source in VS Code.
// Only active in development; completely removed from production bundle.
import { ClickToComponent } from 'click-to-react-component';

function Loading() {
  return <EmptyState title="Wird geladen …" />;
}

function LoadError({ message }: { message: string | null }) {
  return (
    <EmptyState
      title="Daten konnten nicht geladen werden"
      hint={message ?? 'Der lokale Speicher ist nicht verfügbar. In einem privaten Fenster kann das passieren.'}
      action={
        <button type="button" className="btn btn--primary" onClick={() => location.reload()}>
          Neu laden
        </button>
      }
    />
  );
}

export function App() {
  const status = useDataStore((s) => s.status);
  const error = useDataStore((s) => s.error);
  const openNew = useEntryStore((s) => s.openNew);

  useEffect(() => {
    void useDataStore.getState().init();
  }, []);

  return (
    <Toaster>
      <BrowserRouter>
        <AppShell onAdd={() => openNew('variable')}>
          <InstallHint />
          {status === 'loading' && <Loading />}
          {status === 'error' && <LoadError message={error} />}
          {status === 'ready' && (
            <Routes>
              <Route path="/" element={<OverviewScreen />} />
              <Route path="/ausgaben" element={<ExpensesScreen />} />
              <Route path="/fixkosten" element={<FixedScreen />} />
              <Route path="/kategorie/:categoryId" element={<CategoryDetailScreen />} />
              <Route path="/mehr" element={<SettingsScreen />} />
              <Route path="/mehr/kategorien" element={<CategoriesScreen />} />
              <Route path="/mehr/tokens" element={<TokenPreview />} />
              <Route
                path="*"
                element={<EmptyState title="Seite nicht gefunden" hint="Über die Leiste unten geht es zurück." />}
              />
            </Routes>
          )}
        </AppShell>
        <EntrySheet />
        <UpdatePrompt />
        {import.meta.env.DEV && <ClickToComponent editor="vscode" />}
      </BrowserRouter>
    </Toaster>
  );
}

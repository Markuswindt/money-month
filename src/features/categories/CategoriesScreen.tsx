import { useState } from 'react';
import { Link } from 'react-router';
import { Archive, ChevronLeft, Plus, RotateCcw } from 'lucide-react';
import { Dialog } from '@base-ui/react/dialog';
import { CategoryIcon, ICON_CHOICES } from '@/components/ui/CategoryIcon';
import { toast } from '@/components/ui/toast';
import { categoryColorVars } from '@/lib/categoryColor';
import { CATEGORY_SCALES, type ColorScale } from '@/data/colorScales';
import type { Category } from '@/data/schema';
import { useDataStore } from '@/store/dataStore';
import s from '../settings/Settings.module.css';
import d from '../entry/EntrySheet.module.css';

type Draft = { id: string | null; name: string; color: ColorScale; icon: string };

const EMPTY: Draft = { id: null, name: '', color: 'cyan', icon: 'Tag' };

export function CategoriesScreen() {
  const categories = useDataStore((st) => st.categories);
  const [draft, setDraft] = useState<Draft | null>(null);

  const active = categories
    .filter((c) => c.deletedAt === null && c.archivedAt === null)
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const archived = categories.filter((c) => c.deletedAt === null && c.archivedAt !== null);

  function openNew() {
    const used = categories.map((c) => c.color);
    const free = CATEGORY_SCALES.find((c) => !used.includes(c)) ?? 'cyan';
    setDraft({ ...EMPTY, color: free });
  }

  function openEdit(category: Category) {
    setDraft({ id: category.id, name: category.name, color: category.color, icon: category.icon });
  }

  async function save() {
    if (!draft || draft.name.trim() === '') return;
    const store = useDataStore.getState();
    if (draft.id) {
      await store.updateCategory(draft.id, {
        name: draft.name.trim(), color: draft.color, icon: draft.icon,
      });
      toast('Kategorie aktualisiert');
    } else {
      await store.addCategory(draft.name, draft.color, draft.icon);
      toast('Kategorie angelegt');
    }
    setDraft(null);
  }

  async function setArchived(category: Category, archived_: boolean) {
    await useDataStore.getState().setCategoryArchived(category.id, archived_);
    // Archivieren statt loeschen: bestehende Ausgaben behalten ihre Kategorie,
    // sie taucht nur in der Auswahl nicht mehr auf.
    toast(archived_ ? 'Archiviert' : 'Wieder aktiv');
  }

  return (
    <div className={s.page}>
      <Link to="/mehr" className={s.rowHint} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', minHeight: 'var(--tap-target-min)' }}>
        <ChevronLeft size={18} aria-hidden /> Mehr
      </Link>
      <h1 className={s.title}>Kategorien</h1>

      <section className={s.section}>
        <div className="card card--flush">
          {active.map((category) => (
            <div key={category.id} className={s.row} style={categoryColorVars(category.color)}>
              <span className="catBadge">
                <CategoryIcon name={category.icon} size={20} />
              </span>
              <button
                type="button"
                className={s.rowBody}
                style={{ textAlign: 'left', minHeight: 'var(--tap-target-min)' }}
                onClick={() => openEdit(category)}
              >
                <span className={s.rowTitle}>{category.name}</span>
                {category.isDefault && <span className={s.rowHint}>Mitgeliefert</span>}
              </button>
              <button
                type="button"
                className="btn btn--icon"
                aria-label={`${category.name} archivieren`}
                onClick={() => void setArchived(category, true)}
              >
                <Archive size={18} aria-hidden />
              </button>
            </div>
          ))}
        </div>

        <button type="button" className="btn btn--secondary btn--block" onClick={openNew}>
          <Plus size={18} aria-hidden />
          Neue Kategorie
        </button>
      </section>

      {archived.length > 0 && (
        <section className={s.section}>
          <h2 className="sectionTitle">Archiviert</h2>
          <p className={s.note}>
            Archivierte Kategorien erscheinen nicht mehr in der Auswahl. Bereits
            erfasste Ausgaben behalten sie.
          </p>
          <div className="card card--flush">
            {archived.map((category) => (
              <div key={category.id} className={s.row} style={categoryColorVars(category.color)}>
                <span className={s.rowBody}>
                  <span className={s.rowTitle}>{category.name}</span>
                </span>
                <button
                  type="button"
                  className="btn btn--icon"
                  aria-label={`${category.name} wiederherstellen`}
                  onClick={() => void setArchived(category, false)}
                >
                  <RotateCcw size={18} aria-hidden />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <Dialog.Root open={draft !== null} onOpenChange={(open) => { if (!open) setDraft(null); }}>
        <Dialog.Portal>
          <Dialog.Backdrop className={d.backdrop} />
          <Dialog.Popup className={d.popup} style={{ position: 'fixed', inset: 'auto 0 0 0', margin: '0 auto' }}>
            <div className={d.handle} aria-hidden />
            <div className={d.header}>
              <Dialog.Title className={d.title}>
                {draft?.id ? 'Kategorie bearbeiten' : 'Neue Kategorie'}
              </Dialog.Title>
            </div>

            <div className={d.body}>
              <div>
                <label className="fieldLabel" htmlFor="cat-name">Name</label>
                <input
                  id="cat-name"
                  className="input"
                  value={draft?.name ?? ''}
                  maxLength={60}
                  autoFocus
                  onChange={(e) => setDraft((p) => (p ? { ...p, name: e.target.value } : p))}
                  placeholder="z. B. Haustier"
                />
              </div>

              <div>
                <span className="fieldLabel">Farbe</span>
                <div className={s.colorGrid}>
                  {CATEGORY_SCALES.map((scale) => (
                    <button
                      key={scale}
                      type="button"
                      aria-label={scale}
                      aria-pressed={draft?.color === scale}
                      className={`${s.colorSwatch} ${draft?.color === scale ? s.colorSwatchSelected : ''}`}
                      onClick={() => setDraft((p) => (p ? { ...p, color: scale } : p))}
                    >
                      <span
                        className={s.colorSwatchDot}
                        style={{ background: `var(--${scale}-11)` }}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="fieldLabel">Symbol</span>
                <div className={s.iconGrid}>
                  {ICON_CHOICES.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      aria-label={icon}
                      aria-pressed={draft?.icon === icon}
                      className={`${s.iconTile} ${draft?.icon === icon ? s.iconTileSelected : ''}`}
                      onClick={() => setDraft((p) => (p ? { ...p, icon } : p))}
                    >
                      <CategoryIcon name={icon} size={20} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className={d.footer}>
              <div className={d.footerRow}>
                <Dialog.Close className="btn btn--secondary">Abbrechen</Dialog.Close>
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={(draft?.name.trim() ?? '') === ''}
                  onClick={() => void save()}
                >
                  Speichern
                </button>
              </div>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

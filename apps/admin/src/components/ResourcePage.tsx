import { useMemo, useState, type ReactNode } from 'react';
import { addDoc, collection, deleteDoc, doc, limit, orderBy, query, serverTimestamp, setDoc, type QueryConstraint } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useQuery, type Row } from '../lib/hooks';
import Form, { type FieldDef } from './Form';
import { Modal, PageHeader, SearchInput, Table, Toast, type Column } from './ui';

export interface ResourceConfig<T = Record<string, unknown>> {
  title: string;
  sub?: string;
  collection: string;
  fields: FieldDef[];
  columns: Column<Row<T>>[];
  order?: [string, 'asc' | 'desc'];
  constraints?: QueryConstraint[];
  searchKeys?: string[];
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  createLabel?: string;
  /** Extra fields written on create (e.g. createdAt). */
  onCreateExtra?: () => Record<string, unknown>;
  /** Override persistence (e.g. secrets stored in a sub-document). */
  save?: (data: Record<string, unknown>, existing: Row<T> | null) => Promise<void>;
  /** Load extra values when editing (e.g. private sub-document). */
  loadExtra?: (row: Row<T>) => Promise<Record<string, unknown>>;
  rowActions?: (row: Row<T>, toast: (t: string, error?: boolean) => void) => ReactNode;
  headerActions?: ReactNode;
  wideForm?: boolean;
  /** Render as an embedded section (smaller heading). */
  compact?: boolean;
}

/**
 * Generic, schema-driven CRUD screen. Most SVR Control modules are declared as
 * a ResourceConfig, which keeps the admin portal fully data-driven.
 */
export default function ResourcePage<T = Record<string, unknown>>(cfg: ResourceConfig<T>) {
  const q = useMemo(
    () => query(collection(db, cfg.collection), ...(cfg.constraints ?? []), ...(cfg.order ? [orderBy(cfg.order[0], cfg.order[1])] : []), limit(1000)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cfg.collection],
  );
  const { rows, loading, error } = useQuery<T>(q, [cfg.collection]);
  const [editing, setEditing] = useState<{ row: Row<T> | null; initial: Record<string, unknown> | null } | null>(null);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const toast = (text: string, error = false) => setMsg({ text, error });

  const filtered = search
    ? rows.filter((r) => (cfg.searchKeys ?? ['name', 'title']).some((k) => String((r as Record<string, unknown>)[k] ?? '').toLowerCase().includes(search.toLowerCase())))
    : rows;

  async function openEdit(row: Row<T> | null) {
    const extra = row && cfg.loadExtra ? await cfg.loadExtra(row) : {};
    setEditing({ row, initial: row ? { ...(row as Record<string, unknown>), ...extra } : null });
  }

  async function save(data: Record<string, unknown>) {
    const existing = editing?.row ?? null;
    if (cfg.save) await cfg.save(data, existing);
    else if (existing) await setDoc(doc(db, cfg.collection, existing.id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
    else await addDoc(collection(db, cfg.collection), { ...data, ...(cfg.onCreateExtra?.() ?? { createdAt: serverTimestamp() }) });
    setEditing(null);
    toast(existing ? 'Saved' : 'Created');
  }

  async function remove(row: Row<T>) {
    if (!confirm('Delete this record permanently?')) return;
    try {
      await deleteDoc(doc(db, cfg.collection, row.id));
      toast('Deleted');
    } catch (e) {
      toast((e as Error).message, true);
    }
  }

  return (
    <>
      <PageHeader
        compact={cfg.compact}
        title={cfg.title}
        sub={cfg.sub}
        actions={
          <>
            {cfg.headerActions}
            {cfg.canCreate !== false && <button className="btn-primary" onClick={() => openEdit(null)}>+ {cfg.createLabel ?? 'Add'}</button>}
          </>
        }
      />
      <div className="mb-4 flex items-center justify-between gap-3">
        <SearchInput value={search} onChange={setSearch} />
        <p className="text-xs text-ink-900/50">{filtered.length} records</p>
      </div>
      {error && <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      <Table
        rows={filtered}
        columns={cfg.columns}
        loading={loading}
        actions={(r) => (
          <>
            {cfg.rowActions?.(r, toast)}
            {cfg.canEdit !== false && <button className="btn-soft btn-xs" onClick={() => openEdit(r)}>Edit</button>}
            {cfg.canDelete && <button className="btn-soft btn-xs text-rose-600" onClick={() => remove(r)}>Delete</button>}
          </>
        )}
      />
      <Modal open={!!editing} title={editing?.row ? `Edit ${cfg.title.replace(/s$/, '')}` : cfg.createLabel ?? 'Add'} onClose={() => setEditing(null)} wide={cfg.wideForm}>
        {editing && <Form fields={cfg.fields} initial={editing.initial} onSubmit={save} onCancel={() => setEditing(null)} />}
      </Modal>
      <Toast msg={msg} onClose={() => setMsg(null)} />
    </>
  );
}

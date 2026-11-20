import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytesResumable } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { fromLocalInput, toLocalInput } from '../lib/time';
import MathText from './MathText';

export type FieldType =
  | 'text'
  | 'textarea'
  | 'math'
  | 'number'
  | 'money'
  | 'select'
  | 'multiselect'
  | 'checkbox'
  | 'datetime'
  | 'date'
  | 'list'
  | 'file'
  | 'ref'
  | 'refmulti';

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: readonly (readonly [string, string])[];
  /** For ref / refmulti: collection to pick from and the field to display. */
  refCollection?: string;
  refLabel?: string;
  /** For file: storage directory and accepted MIME types. Stores <name> (url) and <name>Path. */
  storageDir?: (values: Record<string, unknown>) => string;
  accept?: string;
  help?: string;
  full?: boolean;
  placeholder?: string;
  /** Hide the field unless this returns true. */
  showIf?: (values: Record<string, unknown>) => boolean;
  defaultValue?: unknown;
}

export const opts = <T extends string>(values: readonly T[], labels?: Record<string, string>) =>
  values.map((v) => [v, labels?.[v] ?? v.replace(/_/g, ' ')] as const);

/** Converts stored Firestore values to form-state values. */
function toFormValue(f: FieldDef, v: unknown): unknown {
  if (v === undefined || v === null) {
    if (f.defaultValue !== undefined) return f.defaultValue;
    if (f.type === 'checkbox') return false;
    if (f.type === 'multiselect' || f.type === 'refmulti') return [];
    return '';
  }
  switch (f.type) {
    case 'money':
      return String(Number(v) / 100);
    case 'datetime':
      return toLocalInput(v as never);
    case 'date':
      return toLocalInput(v as never, true);
    case 'list':
      return Array.isArray(v) ? v.join('\n') : String(v);
    case 'number':
      return String(v);
    default:
      return v;
  }
}

/** Converts form-state values back to Firestore values. */
function fromFormValue(f: FieldDef, v: unknown): unknown {
  switch (f.type) {
    case 'money':
      return v === '' ? 0 : Math.round(Number(v) * 100);
    case 'number':
      return v === '' ? null : Number(v);
    case 'datetime':
    case 'date':
      return fromLocalInput(String(v ?? ''));
    case 'list':
      return String(v ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
    case 'checkbox':
      return Boolean(v);
    case 'select':
    case 'ref': {
      if (v === '') return null;
      const isNum = f.options?.every(([o]) => /^\d+$/.test(o));
      return isNum ? Number(v) : v;
    }
    default:
      return typeof v === 'string' ? v.trim() : v;
  }
}

function useRefOptions(f: FieldDef) {
  const [options, setOptions] = useState<[string, string][]>([]);
  useEffect(() => {
    if (!f.refCollection) return;
    const label = f.refLabel ?? 'name';
    getDocs(query(collection(db, f.refCollection), orderBy(label)))
      .then((s) => setOptions(s.docs.map((d) => [d.id, String(d.get(label) ?? d.id)])))
      .catch(() => getDocs(collection(db, f.refCollection!)).then((s) => setOptions(s.docs.map((d) => [d.id, String(d.get(label) ?? d.id)]))));
  }, [f.refCollection, f.refLabel]);
  return options;
}

function FileField({ f, values, set }: { f: FieldDef; values: Record<string, unknown>; set: (k: string, v: unknown) => void }) {
  const [pct, setPct] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const url = values[f.name] as string;
  const onFile = (file: File | undefined) => {
    if (!file) return;
    setErr('');
    const dir = f.storageDir ? f.storageDir(values) : 'public/uploads';
    const path = `${dir}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, '_')}`;
    const task = uploadBytesResumable(storageRef(storage, path), file, { contentType: file.type });
    task.on(
      'state_changed',
      (s) => setPct(Math.round((s.bytesTransferred / s.totalBytes) * 100)),
      (e) => {
        setErr(e.message);
        setPct(null);
      },
      async () => {
        set(f.name, await getDownloadURL(task.snapshot.ref));
        set(`${f.name}Path`, path);
        setPct(null);
      },
    );
  };
  return (
    <div className="space-y-2">
      <input type="file" accept={f.accept} className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-ink-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white" onChange={(e) => onFile(e.target.files?.[0])} />
      {pct !== null && <div className="h-1.5 overflow-hidden rounded bg-ink-900/10"><div className="h-full bg-royal-500 transition-all" style={{ width: `${pct}%` }} /></div>}
      {url && <a href={url} target="_blank" rel="noreferrer" className="block truncate text-xs text-royal-600">Current file ↗</a>}
      {err && <p className="text-xs text-rose-600">{err}</p>}
    </div>
  );
}

function Field({ f, values, set }: { f: FieldDef; values: Record<string, unknown>; set: (k: string, v: unknown) => void }) {
  const refOpts = useRefOptions(f);
  const v = values[f.name];
  const options = f.type === 'ref' || f.type === 'refmulti' ? refOpts : (f.options ?? []);
  const id = `f-${f.name}`;

  let input: ReactNode;
  switch (f.type) {
    case 'textarea':
    case 'list':
      input = <textarea id={id} className="field min-h-24" value={String(v ?? '')} placeholder={f.placeholder ?? (f.type === 'list' ? 'One per line' : '')} onChange={(e) => set(f.name, e.target.value)} required={f.required} />;
      break;
    case 'math':
      input = (
        <div className="space-y-2">
          <textarea id={id} className="field min-h-28 font-mono text-xs" value={String(v ?? '')} placeholder="Use $x^2$ for inline and $$\int_0^1 x\,dx$$ for display maths" onChange={(e) => set(f.name, e.target.value)} required={f.required} />
          {String(v ?? '') && <div className="rounded-xl bg-paper p-3 text-sm"><MathText text={String(v)} /></div>}
        </div>
      );
      break;
    case 'checkbox':
      input = (
        <label className="flex items-center gap-2 text-sm">
          <input id={id} type="checkbox" className="h-4 w-4 accent-ink-900" checked={Boolean(v)} onChange={(e) => set(f.name, e.target.checked)} /> {f.help ?? 'Yes'}
        </label>
      );
      break;
    case 'select':
    case 'ref':
      input = (
        <select id={id} className="field" value={String(v ?? '')} onChange={(e) => set(f.name, e.target.value)} required={f.required}>
          <option value="">— Select —</option>
          {options.map(([o, l]) => <option key={o} value={o}>{l}</option>)}
        </select>
      );
      break;
    case 'multiselect':
    case 'refmulti': {
      const arr = (Array.isArray(v) ? v : []) as string[];
      input = (
        <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-ink-900/10 p-2">
          {options.map(([o, l]) => {
            const on = arr.includes(o);
            return (
              <button type="button" key={o} onClick={() => set(f.name, on ? arr.filter((x) => x !== o) : [...arr, o])} className={`rounded-lg px-2.5 py-1 text-xs font-medium ${on ? 'bg-ink-900 text-white' : 'bg-paper text-ink-900/70 hover:bg-ink-900/10'}`}>
                {l}
              </button>
            );
          })}
          {options.length === 0 && <span className="text-xs text-ink-900/40">No options</span>}
        </div>
      );
      break;
    }
    case 'file':
      input = <FileField f={f} values={values} set={set} />;
      break;
    default:
      input = (
        <input
          id={id}
          className="field"
          type={f.type === 'number' || f.type === 'money' ? 'number' : f.type === 'datetime' ? 'datetime-local' : f.type === 'date' ? 'date' : 'text'}
          step={f.type === 'money' ? '1' : f.type === 'number' ? 'any' : undefined}
          value={String(v ?? '')}
          placeholder={f.placeholder}
          onChange={(e) => set(f.name, e.target.value)}
          required={f.required}
        />
      );
  }
  return (
    <div className={f.full || ['textarea', 'math', 'list', 'multiselect', 'refmulti'].includes(f.type) ? 'sm:col-span-2' : ''}>
      <label className="label" htmlFor={id}>
        {f.label}
        {f.required && ' *'}
        {f.type === 'money' && ' (₹)'}
      </label>
      {input}
      {f.help && f.type !== 'checkbox' && <p className="mt-1 text-xs text-ink-900/45">{f.help}</p>}
    </div>
  );
}

export default function Form({ fields, initial, onSubmit, submitLabel = 'Save', onCancel, extra }: {
  fields: FieldDef[];
  initial?: Record<string, unknown> | null;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  submitLabel?: string;
  onCancel?: () => void;
  extra?: ReactNode;
}) {
  const start = useMemo(() => {
    const o: Record<string, unknown> = {};
    for (const f of fields) {
      o[f.name] = toFormValue(f, initial?.[f.name]);
      if (f.type === 'file') o[`${f.name}Path`] = initial?.[`${f.name}Path`] ?? '';
    }
    return o;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);
  const [values, setValues] = useState(start);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: unknown) => setValues((s) => ({ ...s, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const out: Record<string, unknown> = {};
    for (const f of fields) {
      if (f.showIf && !f.showIf(values)) continue;
      const val = fromFormValue(f, values[f.name]);
      if (f.required && (val === null || val === '' || (Array.isArray(val) && val.length === 0))) {
        setError(`${f.label} is required`);
        return;
      }
      out[f.name] = val;
      if (f.type === 'file') out[`${f.name}Path`] = values[`${f.name}Path`] || null;
    }
    setBusy(true);
    setError('');
    try {
      await onSubmit(out);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      {fields.filter((f) => !f.showIf || f.showIf(values)).map((f) => <Field key={f.name} f={f} values={values} set={set} />)}
      {extra}
      {error && <p className="text-sm text-rose-600 sm:col-span-2">{error}</p>}
      <div className="flex justify-end gap-2 sm:col-span-2">
        {onCancel && <button type="button" className="btn-soft" onClick={onCancel}>Cancel</button>}
        <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
      </div>
    </form>
  );
}


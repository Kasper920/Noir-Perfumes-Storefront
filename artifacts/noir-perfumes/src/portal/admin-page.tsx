import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ChangeEvent } from 'react';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { Archive, Check, ImagePlus, Mail, Pencil, Plus, RotateCcw, X } from 'lucide-react';
import {
  getGetAdminMessagesQueryKey, getGetAdminOrdersQueryKey, getGetAdminProductsQueryKey, getGetCatalogQueryKey,
  getGetProfileQueryKey, getGetMyOrdersQueryKey,
  useGetAdminMessages, useGetAdminOrders, useGetAdminProducts, useGetProfile,
  useSaveAdminProduct, useUploadAdminProductImage, useUpdateAdminMessage, useUpdateAdminOrder,
  ProductInputImageKey,
  type LocalList, type Order, type OrderStatusInputStatus, type Product, type ProductInput,
} from '@workspace/api-client-react';
import { EmptyState, ErrorPanel, LIVE, PortalShell, ProductArt, SkeletonRows, StatusPill, errorStatus, useAuthReady, usePortal } from './shared';
import { SignedOutPanel } from './account-page';

type Tab = 'catalog' | 'orders' | 'messages';
const NEXT: Record<Order['status'], OrderStatusInputStatus[]> = {
  pending: ['processing', 'cancelled'], processing: ['shipped', 'cancelled'], shipped: ['delivered'], delivered: [], cancelled: [],
};
const emptyList = (): LocalList => ({ en: [], ar: [] });
const blankProduct = (): ProductInput => ({
  id: '', name: { en: '', ar: '' }, concentration: { en: '', ar: '' }, description: { en: '', ar: '' },
  notes: { top: emptyList(), heart: emptyList(), base: emptyList() },
  noteHighlights: emptyList(), audience: emptyList(), collections: emptyList(),
  imageKey: 'oud', imagePath: null, active: true, version: 0,
  variants: [{ size: '50ml', price: 0, stock: 0 }, { size: '100ml', price: 0, stock: 0 }],
});
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/* ---------- chip list ---------- */
function ChipField({ label, value, onChange, dir, testId }: { label: string; value: string[]; onChange: (v: string[]) => void; dir: 'ltr' | 'rtl'; testId: string }) {
  const { t } = usePortal();
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v && !value.includes(v) && value.length < 20) onChange([...value, v.slice(0, 100)]);
    setDraft('');
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
    else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
  };
  return (
    <div className="chip-field" dir={dir}>
      <span className="field-label">{label}</span>
      <div className="chip-box">
        {value.map((chip) => (
          <span className="chip" key={chip}>{chip}
            <button type="button" aria-label={`${t.remove} ${chip}`} onClick={() => onChange(value.filter((c) => c !== chip))}><X size={11} /></button>
          </span>
        ))}
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} onBlur={add} placeholder={t.addChip} aria-label={label} data-testid={testId} />
      </div>
    </div>
  );
}

function BiList({ title, value, onChange, testId }: { title: string; value: LocalList; onChange: (v: LocalList) => void; testId: string }) {
  const { t } = usePortal();
  return (
    <fieldset className="bi-row">
      <legend>{title}</legend>
      <ChipField label={t.english} dir="ltr" value={value.en} onChange={(en) => onChange({ ...value, en })} testId={`${testId}-en`} />
      <ChipField label={t.arabic} dir="rtl" value={value.ar} onChange={(ar) => onChange({ ...value, ar })} testId={`${testId}-ar`} />
    </fieldset>
  );
}

function BiText({ title, value, onChange, multiline, invalid, hint, testId }: { title: string; value: { en: string; ar: string }; onChange: (v: { en: string; ar: string }) => void; multiline?: boolean; invalid?: string; hint?: string; testId: string }) {
  const { t } = usePortal();
  const Input = multiline ? 'textarea' : 'input';
  return (
    <fieldset className={`bi-row${invalid ? ' invalid' : ''}`}>
      <legend>{title}</legend>
      {(['en', 'ar'] as const).map((l) => (
        <label className="field" key={l} dir={l === 'ar' ? 'rtl' : 'ltr'}>
          <span className="field-label">{l === 'en' ? t.english : t.arabic}</span>
          <Input value={value[l]} maxLength={3000} {...(multiline ? { rows: 4 } : {})} aria-invalid={Boolean(invalid)}
            onChange={(e: { target: { value: string } }) => onChange({ ...value, [l]: e.target.value })} data-testid={`${testId}-${l}`} />
        </label>
      ))}
      {(invalid || hint) && <span className={invalid ? 'field-error' : 'field-hint'}>{invalid ?? hint}</span>}
    </fieldset>
  );
}

/* ---------- product editor ---------- */
function ProductEditor({ initial, initialImageUrl, onClose, onReload }: { initial: ProductInput; initialImageUrl: string | null; onClose: () => void; onReload: () => Promise<ProductInput | null> }) {
  const { t, rtl } = usePortal();
  const qc = useQueryClient();
  const save = useSaveAdminProduct();
  const imageUpload = useUploadAdminProductImage();
  const [draft, setDraft] = useState<ProductInput>(() => clone(initial));
  const [imagePreview, setImagePreview] = useState<string | null>(initialImageUrl);
  const [imageError, setImageError] = useState<'invalid' | 'upload' | false>(false);
  const [imageSaved, setImageSaved] = useState(false);
  const [badge, setBadge] = useState(initial.badge ?? { en: '', ar: '' });
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState<{ msg: string; conflict: boolean } | null>(null);
  const isNew = initial.version === 0;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const editorRef = useRef<HTMLFormElement>(null);
  const savingRef = useRef(save.isPending);
  savingRef.current = save.isPending;
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const controls = () => Array.from(editorRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]') ?? []);
    const frame = requestAnimationFrame(() => controls()[0]?.focus());
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && !savingRef.current) closeRef.current();
      if (e.key !== 'Tab') return;
      const elements = controls();
      const first = elements[0], last = elements.at(-1);
      if (e.shiftKey && (document.activeElement === first || !editorRef.current?.contains(document.activeElement))) {
        e.preventDefault(); last?.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !editorRef.current?.contains(document.activeElement))) {
        e.preventDefault(); first?.focus();
      }
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; previousFocus?.focus(); };
  }, []);
  const set = <K extends keyof ProductInput>(k: K, v: ProductInput[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const filled = (v: { en: string; ar: string }) => v.en.trim() !== '' && v.ar.trim() !== '';
  const badgeState = badge.en.trim() === '' && badge.ar.trim() === '' ? 'none' : filled(badge) ? 'ok' : 'bad';
  const errs = {
    id: !/^[a-z0-9-]{2,60}$/.test(draft.id),
    name: !filled(draft.name), concentration: !filled(draft.concentration), description: !filled(draft.description),
    badge: badgeState === 'bad',
    variants: draft.variants.map((v) => ({ price: !(v.price >= 0.001 && v.price <= 10000), stock: !(Number.isInteger(v.stock) && v.stock >= 0 && v.stock <= 100000) })),
  };
  const hasErr = errs.id || errs.name || errs.concentration || errs.description || errs.badge || errs.variants.some((v) => v.price || v.stock);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setShowErrors(true);
    if (hasErr) { setError({ msg: t.fixErrors, conflict: false }); return; }
    setError(null);
    const payload: ProductInput = { ...draft, badge: badgeState === 'ok' ? { en: badge.en.trim(), ar: badge.ar.trim() } : undefined };
    if (!payload.badge) delete payload.badge;
    try {
      await save.mutateAsync({ data: payload });
      await Promise.all([
        qc.invalidateQueries({ queryKey: getGetAdminProductsQueryKey() }),
        qc.invalidateQueries({ queryKey: getGetCatalogQueryKey() }),
      ]);
      onClose();
    } catch (err) {
      const conflict = errorStatus(err) === 409;
      setError({ msg: conflict ? t.conflict : t.genericError, conflict });
    }
  };
  const uploadPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file || isNew) return;
    if (file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setImageError('invalid');
      setImageSaved(false);
      return;
    }
    setImageError(false);
    setImageSaved(false);
    try {
      const uploaded = await imageUpload.mutateAsync({ id: draft.id, version: draft.version, data: file });
      setDraft((current) => ({ ...current, imagePath: uploaded.imagePath, version: uploaded.version }));
      setImagePreview(uploaded.imageUrl);
      setImageSaved(true);
      await Promise.all([
        qc.invalidateQueries({ queryKey: getGetAdminProductsQueryKey() }),
        qc.invalidateQueries({ queryKey: getGetCatalogQueryKey() }),
      ]);
    } catch (err) {
      setImageError('upload');
      if (errorStatus(err) === 409) setError({ msg: t.conflict, conflict: true });
    }
  };
  const reload = async () => {
    const fresh = await onReload();
    if (fresh) { setDraft(clone(fresh)); setBadge(fresh.badge ?? { en: '', ar: '' }); setImagePreview(null); setImageSaved(false); setImageError(false); setError(null); setShowErrors(false); }
  };
  const v = (i: number) => draft.variants[i];
  const setVariant = (i: number, patch: Partial<ProductInput['variants'][number]>) =>
    set('variants', draft.variants.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <div className="editor-layer" role="dialog" aria-modal="true" aria-labelledby="editor-title">
      <button type="button" className="editor-scrim" aria-label={t.close} onClick={onClose} disabled={save.isPending} tabIndex={-1} />
      <form ref={editorRef} className="editor" onSubmit={submit} noValidate dir={rtl ? 'rtl' : 'ltr'}>
        <header className="editor-head">
          <div><p className="portal-kicker">{isNew ? t.newProduct : `${t.version} ${draft.version}`}</p><h2 id="editor-title">{isNew ? t.createProduct : draft.name.en || t.editProduct}</h2></div>
          <button type="button" className="portal-icon" onClick={onClose} disabled={save.isPending} aria-label={t.close} data-testid="button-close-editor"><X size={18} /></button>
        </header>
        <div className="editor-body">
          <section className="editor-sec">
            <h3>{t.identity}</h3>
            <label className={`field${showErrors && errs.id ? ' invalid' : ''}`}>
              <span className="field-label">{t.productId}</span>
              <input value={draft.id} dir="ltr" readOnly={!isNew} aria-readonly={!isNew} className="mono" maxLength={60}
                onChange={(e) => set('id', e.target.value.toLowerCase())} data-testid="input-product-id" />
              <span className={showErrors && errs.id ? 'field-error' : 'field-hint'}>{showErrors && errs.id ? t.productIdError : t.productIdHint}</span>
            </label>
            <BiText title={t.fragranceName} value={draft.name} onChange={(x) => set('name', x)} invalid={showErrors && errs.name ? t.required : undefined} testId="input-name" />
            <BiText title={t.concentration} value={draft.concentration} onChange={(x) => set('concentration', x)} invalid={showErrors && errs.concentration ? t.required : undefined} testId="input-concentration" />
            <BiText title={t.description} multiline value={draft.description} onChange={(x) => set('description', x)} invalid={showErrors && errs.description ? t.required : undefined} testId="input-description" />
            <BiText title={t.badge} value={badge} onChange={setBadge} invalid={showErrors && errs.badge ? t.badgeError : undefined} hint={t.badgeHint} testId="input-badge" />
          </section>
          <section className="editor-sec">
            <h3>{t.artwork}</h3>
            <div className="art-picker" role="radiogroup" aria-label={t.artwork}>
              {Object.values(ProductInputImageKey).map((key) => (
                <label key={key} className={`art-option${draft.imageKey === key ? ' is-on' : ''}`}>
                  <input type="radio" name="imageKey" value={key} checked={draft.imageKey === key} onChange={() => set('imageKey', key)} data-testid={`radio-art-${key}`} />
                  <ProductArt imageKey={key} label={key} />
                  <span>{key}</span>
                </label>
              ))}
            </div>
            <div className="product-photo-upload">
              <ProductArt imageKey={draft.imageKey} imageUrl={imagePreview} imagePath={imagePreview ? 'preview/uploaded.webp' : draft.imagePath} label={draft.name[rtl ? 'ar' : 'en'] || t.productPhoto} className="photo-preview" />
              <div className="product-photo-fields">
                <strong>{t.productPhoto}</strong>
                <p className="field-hint">{t.photoHint}</p>
                {isNew ? <p className="field-hint">{t.photoSaveFirst}</p> : (
                  <label className={`ghost-btn photo-upload-button${imageUpload.isPending ? ' is-busy' : ''}`} htmlFor={`photo-${draft.id}`} aria-disabled={imageUpload.isPending}>
                    <ImagePlus size={15} />{imageUpload.isPending ? t.uploadingPhoto : t.uploadPhoto}
                    <input id={`photo-${draft.id}`} type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} disabled={imageUpload.isPending} />
                  </label>
                )}
                {imageError && <p className="field-error" role="alert">{imageError === 'invalid' ? t.photoTooLarge : t.photoError}</p>}
                {imageSaved && <p className="field-hint" role="status">{t.photoSaved}</p>}
              </div>
            </div>
          </section>
          <section className="editor-sec">
            <h3>{t.variants}</h3>
            <div className="variant-grid">
              {[0, 1].map((i) => (
                <div className="variant-card" key={v(i).size}>
                  <strong className="mono">{v(i).size}</strong>
                  <label className={`field${showErrors && errs.variants[i]?.price ? ' invalid' : ''}`}>
                    <span className="field-label">{t.price}</span>
                    <input type="number" inputMode="decimal" min={0.001} max={10000} step={0.001} dir="ltr" value={Number.isNaN(v(i).price) ? '' : v(i).price}
                      onChange={(e) => setVariant(i, { price: e.target.value === '' ? NaN : Number(e.target.value) })} data-testid={`input-price-${v(i).size}`} />
                    {showErrors && errs.variants[i]?.price && <span className="field-error">{t.priceError}</span>}
                  </label>
                  <label className={`field${showErrors && errs.variants[i]?.stock ? ' invalid' : ''}`}>
                    <span className="field-label">{t.stock}</span>
                    <div className="stepper">
                      <button type="button" aria-label="-1" onClick={() => setVariant(i, { stock: Math.max(0, (v(i).stock || 0) - 1) })}>−</button>
                      <input type="number" inputMode="numeric" min={0} max={100000} step={1} dir="ltr" value={Number.isNaN(v(i).stock) ? '' : v(i).stock}
                        onChange={(e) => setVariant(i, { stock: e.target.value === '' ? NaN : Number(e.target.value) })} data-testid={`input-stock-${v(i).size}`} />
                      <button type="button" aria-label="+1" onClick={() => setVariant(i, { stock: Math.min(100000, (v(i).stock || 0) + 1) })}>+</button>
                    </div>
                    {showErrors && errs.variants[i]?.stock && <span className="field-error">{t.stockError}</span>}
                  </label>
                </div>
              ))}
            </div>
          </section>
          <section className="editor-sec">
            <h3>{t.pyramid}</h3>
            {(['top', 'heart', 'base'] as const).map((lvl) => (
              <BiList key={lvl} title={t[lvl]} value={draft.notes[lvl]} onChange={(x) => set('notes', { ...draft.notes, [lvl]: x })} testId={`chips-${lvl}`} />
            ))}
            <BiList title={t.highlights} value={draft.noteHighlights} onChange={(x) => set('noteHighlights', x)} testId="chips-highlights" />
            <BiList title={t.audience} value={draft.audience} onChange={(x) => set('audience', x)} testId="chips-audience" />
            <BiList title={t.collections} value={draft.collections} onChange={(x) => set('collections', x)} testId="chips-collections" />
          </section>
          <section className="editor-sec">
            <h3>{t.display}</h3>
            <label className="switch-row">
              <input type="checkbox" role="switch" checked={draft.active} onChange={(e) => set('active', e.target.checked)} data-testid="switch-active" />
              <span className="switch" aria-hidden="true" />
              <span><strong>{draft.active ? t.active : t.archived}</strong><small>{t.activeHint}</small></span>
            </label>
          </section>
        </div>
        <footer className="editor-foot">
          {error && (
            <div className="portal-error compact" role="alert">
              <p>{error.msg}</p>
              {error.conflict && !isNew && <button type="button" className="ghost-btn" onClick={reload} data-testid="button-reload-product"><RotateCcw size={14} />{t.reload}</button>}
            </div>
          )}
          <div className="editor-actions">
            <button type="button" className="ghost-btn" onClick={onClose}>{t.cancel}</button>
            <button type="submit" className="gold-btn" disabled={save.isPending || imageUpload.isPending} data-testid="button-save-product">{save.isPending ? t.saving : isNew ? t.createProduct : t.save}</button>
          </div>
        </footer>
      </form>
    </div>
  );
}

/* ---------- catalog ---------- */
function Catalog({ enabled }: { enabled: boolean }) {
  const { t, language, money, num } = usePortal();
  const qc = useQueryClient();
  const q = useGetAdminProducts({ query: { enabled, queryKey: getGetAdminProductsQueryKey(), ...LIVE } });
  const save = useSaveAdminProduct();
  const [editing, setEditing] = useState<ProductInput | null>(null);
  const [rowError, setRowError] = useState<{ id: string; msg: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const toggleArchive = async (p: Product) => {
    setBusy(p.id); setRowError(null);
    try {
      await save.mutateAsync({ data: { ...p, active: !p.active } });
      await Promise.all([qc.invalidateQueries({ queryKey: getGetAdminProductsQueryKey() }), qc.invalidateQueries({ queryKey: getGetCatalogQueryKey() })]);
    } catch (err) {
      setRowError({ id: p.id, msg: errorStatus(err) === 409 ? t.conflict : t.genericError });
      if (errorStatus(err) === 409) void q.refetch();
    } finally { setBusy(null); }
  };
  const reloadOne = async (id: string) => {
    const res = await q.refetch();
    return res.data?.find((p) => p.id === id) ?? null;
  };

  return (
    <div className="admin-panel">
      <div className="panel-head">
        <span className="muted small">{t.autoRefresh}</span>
        <button type="button" className="gold-btn" onClick={() => setEditing(blankProduct())} data-testid="button-new-product"><Plus size={15} />{t.newProduct}</button>
      </div>
      {q.isLoading || (!q.data && !q.isError) ? <SkeletonRows count={5} /> : q.isError ? <ErrorPanel message={t.loadError} onRetry={() => q.refetch()} /> : q.data.length === 0 ? (
        <EmptyState title={t.catalogEmpty} body={t.catalogEmptyBody} />
      ) : (
        <ul className="catalog-list">
          {q.data.map((p) => (
            <li key={p.id} className={`catalog-row${p.active ? '' : ' is-archived'}`} data-testid={`row-product-${p.id}`}>
              <ProductArt imageKey={p.imageKey} imageUrl={p.imageUrl} imagePath={p.imagePath} label={p.name[language]} className="thumb" />
              <div className="cat-name">
                <strong>{p.name[language]}</strong>
                <span className="muted small">{p.concentration[language]} · <span className="mono">{p.id}</span></span>
                <span className={`state-tag${p.active ? ' on' : ''}`}>{p.active ? t.active : t.archived}</span>
              </div>
              <div className="cat-variants">
                {p.variants.map((v) => (
                  <div key={v.size} className="cat-variant">
                    <span className="mono">{v.size}</span>
                    <span>{money(v.price)}</span>
                    <span className={`stock${v.stock === 0 ? ' out' : v.stock < 5 ? ' low' : ''}`}>{v.stock === 0 ? t.outOfStock : `${num(v.stock)}${v.stock < 5 ? ` · ${t.lowStock}` : ''}`}</span>
                  </div>
                ))}
              </div>
              <div className="cat-actions">
                <button type="button" className="ghost-btn" onClick={() => setEditing(clone(p))} data-testid={`button-edit-${p.id}`}><Pencil size={14} />{t.edit}</button>
                <button type="button" className="ghost-btn" disabled={busy === p.id} onClick={() => toggleArchive(p)} data-testid={`button-archive-${p.id}`}>
                  {p.active ? <><Archive size={14} />{t.archive}</> : <><RotateCcw size={14} />{t.restore}</>}
                </button>
              </div>
              {rowError?.id === p.id && <div className="row-error"><ErrorPanel compact message={rowError.msg} /></div>}
            </li>
          ))}
        </ul>
      )}
      {editing && <ProductEditor key={`${editing.id}-${editing.version}`} initial={editing} initialImageUrl={q.data?.find((p) => p.id === editing.id)?.imageUrl ?? null} onClose={() => setEditing(null)} onReload={() => reloadOne(editing.id)} />}
    </div>
  );
}

/* ---------- orders ---------- */
function Orders({ enabled }: { enabled: boolean }) {
  const { t, language, money, date, num } = usePortal();
  const qc = useQueryClient();
  const q = useGetAdminOrders({ query: { enabled, queryKey: getGetAdminOrdersQueryKey(), ...LIVE } });
  const update = useUpdateAdminOrder();
  const [filter, setFilter] = useState<'all' | Order['status']>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = useMemo(() => (q.data ?? []).filter((o) => filter === 'all' || o.status === filter), [q.data, filter]);
  const order = q.data?.find((o) => o.id === (selected ?? list[0]?.id));

  const move = async (status: OrderStatusInputStatus) => {
    if (!order) return;
    setError(null);
    try {
      await update.mutateAsync({ id: order.id, data: { status } });
      setConfirming(false);
      await Promise.all([
        qc.invalidateQueries({ queryKey: getGetAdminOrdersQueryKey() }),
        qc.invalidateQueries({ queryKey: getGetMyOrdersQueryKey() }),
        qc.invalidateQueries({ queryKey: getGetAdminProductsQueryKey() }),
        qc.invalidateQueries({ queryKey: getGetCatalogQueryKey() }),
      ]);
    } catch (err) {
      setError(errorStatus(err) === 409 ? t.conflict : t.genericError);
      void q.refetch();
    }
  };

  return (
    <div className="admin-panel">
      <div className="filter-row" role="group" aria-label={t.tabOrders}>
        {(['all', 'pending', 'processing', 'shipped', 'delivered', 'cancelled'] as const).map((f) => {
          const count = f === 'all' ? q.data?.length ?? 0 : q.data?.filter((o) => o.status === f).length ?? 0;
          return <button key={f} type="button" aria-pressed={filter === f} className={`pill${filter === f ? ' is-on' : ''}`} onClick={() => { setFilter(f); setSelected(null); }} data-testid={`filter-${f}`}>{f === 'all' ? t.all : t.status[f]}<span>{num(count)}</span></button>;
        })}
      </div>
      {q.isLoading || (!q.data && !q.isError) ? <SkeletonRows count={5} /> : q.isError ? <ErrorPanel message={t.loadError} onRetry={() => q.refetch()} /> : list.length === 0 ? (
        <EmptyState title={t.ordersEmptyAdmin} body={t.ordersEmptyAdminBody} />
      ) : (
        <div className="orders-split">
          <ul className="order-list">
            {list.map((o) => (
              <li key={o.id}>
                <button type="button" className={`order-row${order?.id === o.id ? ' is-selected' : ''}`} aria-pressed={order?.id === o.id} onClick={() => { setSelected(o.id); setConfirming(false); setError(null); }} data-testid={`row-admin-order-${o.id}`}>
                  <span className="mono ref">{o.reference}</span>
                  <span className="muted">{o.name} · {date(o.createdAt)}</span>
                  <StatusPill status={o.status} />
                  <span className="mono amt">{money(o.total, o.currency)}</span>
                </button>
              </li>
            ))}
          </ul>
          {order && (
            <div className="order-pane order-detail" aria-live="polite" data-testid={`detail-admin-order-${order.id}`}>
              <div className="detail-head"><div><p className="portal-kicker">{t.orderDetail}</p><h3 className="mono">{order.reference}</h3></div><StatusPill status={order.status} /></div>
              <dl className="detail-grid">
                <div><dt>{t.customer}</dt><dd>{order.name}</dd></div>
                <div><dt>{t.phone}</dt><dd><a href={`tel:${order.phone}`} dir="ltr">{order.phone}</a></dd></div>
                <div className="wide"><dt>{t.deliverTo}</dt><dd>{order.address}</dd></div>
                <div><dt>{t.placed}</dt><dd>{date(order.createdAt)}</dd></div>
                <div><dt>{t.payment}</dt><dd>{t.paymentMethod[order.payment]}</dd></div>
              </dl>
              <ul className="line-items">
                {order.items.map((it, i) => <li key={i}><span className="li-name">{it.name[language]}<small>{it.size} · {t.qty} {num(it.quantity)}</small></span><span className="mono">{money(it.price * it.quantity, order.currency)}</span></li>)}
              </ul>
              <div className="detail-total"><span>{t.total}</span><strong className="mono">{money(order.total, order.currency)}</strong></div>
              <p className="manual-note">{t.paymentPending}</p>
              <div className="status-actions">
                {NEXT[order.status].length === 0 ? <p className="muted small">{t.finalState}</p> : NEXT[order.status].map((s) => s === 'cancelled' ? (
                  confirming ? (
                    <div key={s} className="confirm-box" role="alertdialog" aria-label={t.confirmCancel}>
                      <p>{t.confirmCancel}</p>
                      <button type="button" className="danger-btn" disabled={update.isPending} onClick={() => move('cancelled')} data-testid="button-confirm-cancel">{t.confirmYes}</button>
                      <button type="button" className="ghost-btn" onClick={() => setConfirming(false)}>{t.cancel}</button>
                    </div>
                  ) : <button key={s} type="button" className="ghost-btn danger-text" onClick={() => setConfirming(true)} data-testid="button-cancel-order"><X size={14} />{t.status.cancelled}</button>
                ) : (
                  <button key={s} type="button" className="gold-btn" disabled={update.isPending} onClick={() => move(s)} data-testid={`button-status-${s}`}>{t.advance}: {t.status[s]}</button>
                ))}
              </div>
              {error && <ErrorPanel compact message={error} onRetry={() => q.refetch()} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- messages ---------- */
function Messages({ enabled }: { enabled: boolean }) {
  const { t, date, num } = usePortal();
  const qc = useQueryClient();
  const q = useGetAdminMessages({ query: { enabled, queryKey: getGetAdminMessagesQueryKey(), ...LIVE } });
  const update = useUpdateAdminMessage();
  const [filter, setFilter] = useState<'open' | 'resolved' | 'all'>('open');
  const [rowError, setRowError] = useState<{ id: string; msg: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const list = (q.data ?? []).filter((m) => filter === 'all' || (filter === 'resolved' ? m.resolved : !m.resolved));
  const toggle = async (id: string, resolved: boolean) => {
    setBusy(id); setRowError(null);
    try {
      await update.mutateAsync({ id, data: { resolved } });
      await qc.invalidateQueries({ queryKey: getGetAdminMessagesQueryKey() });
    } catch { setRowError({ id, msg: t.genericError }); } finally { setBusy(null); }
  };
  return (
    <div className="admin-panel">
      <div className="filter-row" role="group" aria-label={t.tabMessages}>
        {(['open', 'resolved', 'all'] as const).map((f) => {
          const count = (q.data ?? []).filter((m) => f === 'all' || (f === 'resolved' ? m.resolved : !m.resolved)).length;
          return <button key={f} type="button" aria-pressed={filter === f} className={`pill${filter === f ? ' is-on' : ''}`} onClick={() => setFilter(f)} data-testid={`filter-msg-${f}`}>{f === 'all' ? t.all : t[f]}<span>{num(count)}</span></button>;
        })}
      </div>
      {q.isLoading || (!q.data && !q.isError) ? <SkeletonRows count={4} /> : q.isError ? <ErrorPanel message={t.loadError} onRetry={() => q.refetch()} /> : list.length === 0 ? (
        <EmptyState title={t.messagesEmpty} body={t.messagesEmptyBody} />
      ) : (
        <ul className="message-list">
          {list.map((m) => (
            <li key={m.id} className={`message${m.resolved ? ' is-resolved' : ''}`} data-testid={`card-message-${m.id}`}>
              <div className="msg-head">
                <span className="avatar" aria-hidden="true">{m.name.trim().slice(0, 1).toUpperCase()}</span>
                <div><strong>{m.name}</strong><a href={`mailto:${m.email}`} className="muted small" dir="ltr">{m.email}</a></div>
                <span className="muted small">{date(m.createdAt)}</span>
              </div>
              <p className="msg-body">{m.message}</p>
              <div className="msg-actions">
                <a className="ghost-btn" href={`mailto:${m.email}`} data-testid={`link-reply-${m.id}`}><Mail size={14} />{t.reply}</a>
                <button type="button" className={m.resolved ? 'ghost-btn' : 'gold-btn'} disabled={busy === m.id} onClick={() => toggle(m.id, !m.resolved)} data-testid={`button-resolve-${m.id}`}>
                  {m.resolved ? <><RotateCcw size={14} />{t.reopen}</> : <><Check size={14} />{t.markResolved}</>}
                </button>
              </div>
              {rowError?.id === m.id && <ErrorPanel compact message={rowError.msg} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AdminPage() {
  const { t } = usePortal();
  const { isLoaded, ready } = useAuthReady();
  const profile = useGetProfile({ query: { enabled: ready, queryKey: getGetProfileQueryKey(), ...LIVE } });
  const isAdmin = profile.data?.role === 'admin';
  const [tab, setTab] = useState<Tab>('catalog');
  const tabs: { id: Tab; label: string }[] = [{ id: 'catalog', label: t.tabCatalog }, { id: 'orders', label: t.tabOrders }, { id: 'messages', label: t.tabMessages }];

  let body;
  if (!isLoaded || (ready && profile.isLoading)) body = <div className="portal-hero"><SkeletonRows count={3} /></div>;
  else if (!ready) body = <SignedOutPanel />;
  else if (profile.isError) body = <ErrorPanel message={t.loadError} onRetry={() => profile.refetch()} />;
  else if (!isAdmin) body = (
    <div className="portal-gate">
      <p className="portal-kicker">{t.adminKicker}</p><h1>{t.notAdminTitle}</h1><p>{t.notAdminBody}</p>
      <Link href="/account" className="gold-btn" data-testid="link-account">{t.goAccount}</Link>
    </div>
  );
  else body = (
    <>
      <div className="portal-hero">
        <p className="portal-kicker">{t.adminKicker}</p>
        <h1>{t.adminTitle}</h1>
        <p className="portal-intro">{t.adminIntro}</p>
      </div>
      <div className="admin-tabs" role="tablist" aria-label={t.adminTitle}>
        {tabs.map((x) => <button key={x.id} type="button" role="tab" id={`tab-${x.id}`} aria-selected={tab === x.id} aria-controls={`panel-${x.id}`} className={tab === x.id ? 'is-on' : ''} onClick={() => setTab(x.id)} data-testid={`tab-${x.id}`}>{x.label}</button>)}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'catalog' && <Catalog enabled={ready && isAdmin} />}
        {tab === 'orders' && <Orders enabled={ready && isAdmin} />}
        {tab === 'messages' && <Messages enabled={ready && isAdmin} />}
      </div>
    </>
  );
  return <PortalShell section="admin">{body}</PortalShell>;
}

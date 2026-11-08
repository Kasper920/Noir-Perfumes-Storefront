import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, MapPin, Phone } from 'lucide-react';
import {
  getGetMyOrderQueryKey, getGetMyOrdersQueryKey, getGetProfileQueryKey,
  useGetMyOrder, useGetMyOrders, useGetProfile, useUpdateProfile,
  type Order, type ProfileInput,
} from '@workspace/api-client-react';
import { EmptyState, ErrorPanel, LIVE, PortalShell, SkeletonRows, StatusPill, errorStatus, useAuthReady, usePortal } from './shared';

const JOURNEY = ['pending', 'processing', 'shipped', 'delivered'] as const;

export function SignedOutPanel() {
  const { t } = usePortal();
  return (
    <div className="portal-gate">
      <p className="portal-kicker">{t.accountKicker}</p>
      <h1>{t.signedOutTitle}</h1>
      <p>{t.signedOutBody}</p>
      <Link href="/sign-in" className="gold-btn" data-testid="link-sign-in">{t.signIn}<ArrowRight size={15} className="flip-rtl" /></Link>
    </div>
  );
}

function ProfileCard() {
  const { t } = usePortal();
  const { ready } = useAuthReady();
  const qc = useQueryClient();
  const profile = useGetProfile({ query: { enabled: ready, queryKey: getGetProfileQueryKey(), ...LIVE } });
  const update = useUpdateProfile();
  const [form, setForm] = useState<ProfileInput>({ name: '', phone: '', address: '' });
  const baseline = useRef<ProfileInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState(0);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (profile.data && !baseline.current) {
      const next = { name: profile.data.name, phone: profile.data.phone, address: profile.data.address };
      baseline.current = next;
      setForm(next);
    }
  }, [profile.data]);

  const dirty = baseline.current ? (['name', 'phone', 'address'] as const).some((k) => form[k] !== baseline.current?.[k]) : false;
  const nameInvalid = form.name.trim().length < 2;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (nameInvalid) return;
    setError(null);
    try {
      const data = { name: form.name.trim(), phone: form.phone.trim(), address: form.address.trim() };
      const saved = await update.mutateAsync({ data });
      const next = { name: saved.name, phone: saved.phone, address: saved.address };
      baseline.current = next;
      setForm(next);
      qc.setQueryData(getGetProfileQueryKey(), saved);
      void qc.invalidateQueries({ queryKey: getGetProfileQueryKey() });
      setSavedAt(Date.now());
    } catch (err) {
      setError(errorStatus(err) === 409 ? t.conflict : t.genericError);
    }
  };

  if (profile.isLoading || (!profile.data && !profile.isError)) return <section className="ledger-card"><SkeletonRows count={4} /></section>;
  if (profile.isError || !profile.data) return <section className="ledger-card"><ErrorPanel message={t.loadError} onRetry={() => profile.refetch()} /></section>;

  return (
    <section className="ledger-card profile-card" aria-labelledby="profile-title">
      <div className="card-head">
        <h2 id="profile-title">{t.profileTitle}</h2>
        {dirty ? <span className="dirty-dot">{t.unsaved}</span> : savedAt > 0 && <span className="saved-note" role="status"><Check size={13} />{t.saved}</span>}
      </div>
      <p className="card-note">{t.profileNote}</p>
      <form className="portal-form" onSubmit={submit} noValidate>
        <div className="field readonly">
          <span className="field-label">{t.email}</span>
          <span className="field-static" data-testid="text-email">{profile.data.email}</span>
        </div>
        <label className={`field${touched && nameInvalid ? ' invalid' : ''}`}>
          <span className="field-label">{t.name}</span>
          <input value={form.name} maxLength={100} autoComplete="name" required aria-invalid={touched && nameInvalid} aria-describedby="name-err"
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} data-testid="input-name" />
          {touched && nameInvalid && <span id="name-err" className="field-error">{t.nameError}</span>}
        </label>
        <label className="field">
          <span className="field-label"><Phone size={12} />{t.phone}</span>
          <input value={form.phone} maxLength={30} type="tel" inputMode="tel" autoComplete="tel" dir="ltr"
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} data-testid="input-phone" />
        </label>
        <label className="field">
          <span className="field-label"><MapPin size={12} />{t.address}</span>
          <textarea value={form.address} maxLength={1000} rows={3} placeholder={t.addressHint} autoComplete="street-address"
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} data-testid="input-address" />
        </label>
        {error && <ErrorPanel compact message={error} />}
        <button type="submit" className="gold-btn" disabled={update.isPending || !dirty} data-testid="button-save-profile">
          {update.isPending ? t.saving : t.save}
        </button>
      </form>
    </section>
  );
}

function OrderDetail({ id }: { id: string }) {
  const { t, language, money, date, num } = usePortal();
  const { ready } = useAuthReady();
  const q = useGetMyOrder(id, { query: { enabled: ready && Boolean(id), queryKey: getGetMyOrderQueryKey(id), ...LIVE } });
  if (q.isLoading || (!q.data && !q.isError)) return <SkeletonRows count={5} />;
  if (q.isError || !q.data) return <ErrorPanel message={t.loadError} onRetry={() => q.refetch()} />;
  const o = q.data;
  const step = JOURNEY.indexOf(o.status as (typeof JOURNEY)[number]);
  return (
    <div className="order-detail" key={o.id} data-testid={`detail-order-${o.id}`}>
      <div className="detail-head">
        <div><p className="portal-kicker">{t.orderDetail}</p><h3 className="mono">{o.reference}</h3></div>
        <StatusPill status={o.status} />
      </div>
      {o.status === 'cancelled' ? <p className="journey-cancelled">{t.status.cancelled}</p> : (
        <ol className="journey" aria-label={t.orderDetail}>
          {JOURNEY.map((s, i) => <li key={s} className={i <= step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}><i />{t.status[s]}</li>)}
        </ol>
      )}
      <dl className="detail-grid">
        <div><dt>{t.placed}</dt><dd>{date(o.createdAt)}</dd></div>
        <div><dt>{t.payment}</dt><dd>{t.paymentMethod[o.payment]}</dd></div>
        <div className="wide"><dt>{t.deliverTo}</dt><dd>{o.name} · <span dir="ltr">{o.phone}</span><br />{o.address}</dd></div>
      </dl>
      <ul className="line-items" aria-label={t.items}>
        {o.items.map((item, i) => (
          <li key={`${item.productId}-${item.size}-${i}`}>
            <span className="li-name">{item.name[language]}<small>{item.size} · {t.qty} {num(item.quantity)}</small></span>
            <span className="mono">{money(item.price * item.quantity, o.currency)}</span>
          </li>
        ))}
      </ul>
      <div className="detail-total"><span>{t.total}</span><strong className="mono">{money(o.total, o.currency)}</strong></div>
      <p className="manual-note">{t.paymentPending}</p>
    </div>
  );
}

function OrderRow({ order, selected, onSelect }: { order: Order; selected: boolean; onSelect: () => void }) {
  const { money, date, num, t } = usePortal();
  const count = order.items.reduce((s, i) => s + i.quantity, 0);
  return (
    <li>
      <button type="button" className={`order-row${selected ? ' is-selected' : ''}`} aria-pressed={selected} onClick={onSelect} data-testid={`row-order-${order.id}`}>
        <span className="mono ref">{order.reference}</span>
        <span className="muted">{date(order.createdAt)} · {num(count)} {t.items}</span>
        <StatusPill status={order.status} />
        <span className="mono amt">{money(order.total, order.currency)}</span>
      </button>
    </li>
  );
}

function Orders() {
  const { t } = usePortal();
  const { ready } = useAuthReady();
  const q = useGetMyOrders({ query: { enabled: ready, queryKey: getGetMyOrdersQueryKey(), ...LIVE } });
  const [selected, setSelected] = useState<string | null>(null);
  const orders = q.data ?? [];
  const activeId = selected ?? orders[0]?.id ?? null;
  return (
    <section className="ledger-card orders-card" aria-labelledby="orders-title">
      <div className="card-head"><h2 id="orders-title">{t.ordersTitle}</h2><span className="muted small">{t.autoRefresh}</span></div>
      {q.isLoading || (!q.data && !q.isError) ? <SkeletonRows count={4} /> : q.isError ? <ErrorPanel message={t.loadError} onRetry={() => q.refetch()} /> : orders.length === 0 ? (
        <EmptyState title={t.ordersEmpty} body={t.ordersEmptyBody} action={<Link href="/shop" className="gold-btn" data-testid="link-discover">{t.discover}<ArrowRight size={15} className="flip-rtl" /></Link>} />
      ) : (
        <div className="orders-split">
          <ul className="order-list">{orders.map((o) => <OrderRow key={o.id} order={o} selected={o.id === activeId} onSelect={() => setSelected(o.id)} />)}</ul>
          <div className="order-pane" aria-live="polite">{activeId ? <OrderDetail id={activeId} /> : <p className="muted">{t.selectOrder}</p>}</div>
        </div>
      )}
    </section>
  );
}

export function AccountPage() {
  const { t } = usePortal();
  const { isLoaded, ready } = useAuthReady();
  const profile = useGetProfile({ query: { enabled: ready, queryKey: getGetProfileQueryKey(), ...LIVE } });
  return (
    <PortalShell section="account">
      {!isLoaded ? <div className="portal-hero"><SkeletonRows count={2} /></div> : !ready ? <SignedOutPanel /> : (
        <>
          <div className="portal-hero">
            <p className="portal-kicker">{t.accountKicker}{profile.data?.role === 'admin' && <span className="role-tag">{t.roleAdmin}</span>}</p>
            <h1 data-testid="text-greeting">{t.greeting(profile.data?.name ?? '')}</h1>
            <p className="portal-intro">{t.accountIntro}</p>
          </div>
          <div className="account-grid">
            <ProfileCard />
            <Orders />
          </div>
        </>
      )}
    </PortalShell>
  );
}

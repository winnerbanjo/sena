'use client';
import { pageMain } from '../../components/design';
import * as React from 'react';
import Link from 'next/link';
import { Topbar } from '../../components/topbar';
import { Button } from '@sena/ui';
import { PwaInstallCard } from '../../components/pwa-install-card';
import { useTranslations, useFormatter } from 'next-intl';
import { LanguageSelect } from '../../components/language-select';
import { LOCALE_META } from '@/i18n/config';
import { useAppLocale } from '@/i18n/provider';
import { setUnsavedWork } from '@/i18n/unsaved';

type Profile = { name: string; propertyType: string; address: string; email: string; phone: string; country: string; timezone: string; checkInTime: string; checkOutTime: string; currency: string; checkInPaymentPolicy?: string; checkOutPaymentPolicy?: string; directBookingPayAtProperty?: boolean; directBookingBankTransfer?: boolean };
type BankAccount = { id: string; accountName: string; bankName: string; accountNumber: string; currency: string; isPrimary: boolean };
export default function SettingsPage() {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const format = useFormatter();
  const { locale } = useAppLocale();
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [tab, setTab] = React.useState('general');
  const [saving, setSaving] = React.useState(false);
  const [feedback, setFeedback] = React.useState('');
  const [failed, setFailed] = React.useState(false);
  const [fields, setFields] = React.useState<Record<string, string[]>>({});
  const [dirty, setDirty] = React.useState(false);
  const [bankAccounts, setBankAccounts] = React.useState<BankAccount[]>([]);
  const [bankForm, setBankForm] = React.useState({ accountName: '', bankName: '', accountNumber: '', currency: 'NGN', isPrimary: false });
  const [bankError, setBankError] = React.useState('');
  const load = React.useCallback(async () => {
    setFailed(false);
    try {
      const response = await fetch('/api/me', { cache: 'no-store' });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (!data.property) throw new Error();
      setProfile(data.property);
      const settings = await fetch('/api/settings', { cache: 'no-store' }).then((res) => (res.ok ? res.json() : null)).catch(() => null);
      if (settings?.bankAccounts) setBankAccounts(settings.bankAccounts);
      if (settings?.paymentPolicies) {
        setProfile((current) => current ? { ...current, ...settings.paymentPolicies } : current);
      }
    } catch { setFailed(true); setFeedback(t('loadFailed')); }
  }, [t]);
  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => {
    setUnsavedWork(dirty);
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => { setUnsavedWork(false); window.removeEventListener('beforeunload', warn); };
  }, [dirty]);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!profile || saving) return;
    setSaving(true); setFeedback(''); setFields({}); setFailed(false);
    try {
      const response = await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) });
      const data = await response.json();
      if (!response.ok) { setFields(data.fields || {}); throw new Error(data.error || t('saveFailed')); }
      setProfile(data.property); setDirty(false); setFeedback(t('saved'));
    } catch (error) { setFailed(true); setFeedback(error instanceof Error ? error.message : t('saveFailed')); }
    finally { setSaving(false); }
  }
  function field(key: Exclude<keyof Profile, 'directBookingPayAtProperty' | 'directBookingBankTransfer'>, label: string, type = 'text') {
    return <div key={key} className="space-y-1.5"><label htmlFor={`setting-${key}`} className="block text-sm font-medium">{label}</label><input id={`setting-${key}`} name={key} type={type} value={profile?.[key] || ''} onChange={event => { setProfile(current => current ? { ...current, [key]: event.target.value } : current); setDirty(true); setFeedback(''); }} aria-invalid={!!fields[key]} aria-describedby={fields[key] ? `error-${key}` : undefined} className="min-h-11 w-full rounded border border-[#E5D4BC] bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85C3E]" />{fields[key] && <p id={`error-${key}`} className="text-sm text-[#9E382A]">{fields[key][0]}</p>}</div>;
  }
  return <div className="flex-1 flex flex-col h-screen overflow-hidden"><Topbar title={t('title')} /><main className={pageMain}>
    <div className="flex flex-wrap justify-between items-center gap-4 border-b border-[#E8E2DA] pb-4"><div><h2 className="text-2xl font-semibold">{t('propertySettings')}</h2><p className="text-sm text-[#7A7267]">{t('propertySettingsSubtitle')}</p></div>{['general', 'policies', 'payments'].includes(tab) && <Button form="property-settings" type="submit" disabled={!profile || saving || !dirty}>{saving ? tCommon('saving') : t('saveChanges')}</Button>}</div>
    <nav aria-label={t('settingsSections')} className="flex gap-4 overflow-x-auto border-b border-[#E8E2DA]">{[['general', t('tabGeneral')],['language', t('tabLanguage')],['policies', t('tabPolicies')],['payments', t('tabPayments')],['notifications', t('tabNotifications')],['subscription', t('tabBilling')]].map(([id,label]) => <button key={id} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined} className={`min-h-11 shrink-0 border-b-2 px-1 text-sm ${tab === id ? 'border-[#B85C3E] text-[#71382D]' : 'border-transparent text-[#7A7267]'}`}>{label}</button>)}</nav>
    {feedback && <p role={failed ? 'alert' : 'status'} className={failed ? 'text-[#9E382A]' : 'text-[#2E6B4F]'}>{feedback}</p>}
    {!profile ? failed ? <Button onClick={load}>{tCommon('tryAgain')}</Button> : <div aria-label={tCommon('loading')} className="max-w-3xl h-80 rounded bg-[#F7F1E8] animate-pulse" /> : <form id="property-settings" onSubmit={save} className="max-w-3xl space-y-6">
      {tab === 'language' && (
        <div className="space-y-6">
          <div className="space-y-4 rounded-lg border border-[#E8E2DA] bg-[#FAF7F2]/40 p-5">
            <div>
              <h3 className="text-lg text-[#71382D] font-semibold">{t('languageHeading')}</h3>
              <p className="text-sm text-[#7A7267] mt-1">{t('languageSubtitle')}</p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="staff-language" className="block text-sm font-medium">{t('languageHeading')}</label>
              <LanguageSelect id="staff-language" />
              <p className="text-sm text-[#7A7267]" lang={LOCALE_META[locale].htmlLang}>
                {t('nativeAndEnglish', { native: LOCALE_META[locale].nativeName, english: LOCALE_META[locale].englishName })}
              </p>
            </div>
          </div>
          <div className="space-y-4 rounded-lg border border-[#E8E2DA] p-5">
            <div>
              <h3 className="text-lg text-[#71382D] font-semibold">{t('regionHeading')}</h3>
              <p className="text-sm text-[#7A7267] mt-1">{t('regionSubtitle')}</p>
            </div>
            <dl className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-[#7A7267]">{t('regionTimezone')}</dt>
                <dd className="font-medium ltr-isolate" dir="ltr">{profile.timezone}</dd>
              </div>
              <div>
                <dt className="text-[#7A7267]">{t('regionCurrency')}</dt>
                <dd className="font-medium ltr-isolate" dir="ltr">{profile.currency}</dd>
              </div>
              <div>
                <dt className="text-[#7A7267]">{t('previewDate')}</dt>
                <dd className="font-medium">{format.dateTime(new Date(), { dateStyle: 'medium', timeZone: profile.timezone })}</dd>
              </div>
              <div>
                <dt className="text-[#7A7267]">{t('previewNumber')}</dt>
                <dd className="font-medium ltr-isolate" dir="ltr">{format.number(12500.5)}</dd>
              </div>
            </dl>
            <p className="text-sm text-[#7A7267]">{t('regionFormatsNote')}</p>
          </div>
        </div>
      )}
      {tab === 'general' && <><div className="grid sm:grid-cols-2 gap-5 rounded-lg border border-[#E8E2DA] p-5">{field('name', t('propertyName'))}{field('propertyType', t('propertyType'))}{field('email', t('contactEmail'),'email')}{field('phone', t('contactPhone'),'tel')}<div className="sm:col-span-2">{field('address', t('address'))}</div>{field('country', t('country'))}{field('timezone', t('propertyTimezone'))}<p className="text-sm text-[#7A7267] sm:col-span-2">{t('currencyNote', { currency: profile.currency })}</p></div><PwaInstallCard /></>}
      {tab === 'policies' && <div className="space-y-5 rounded-lg border border-[#E8E2DA] p-5"><div className="grid sm:grid-cols-2 gap-5">{field('checkInTime', t('checkInFrom'),'time')}{field('checkOutTime', t('checkOutBy'),'time')}</div><p className="text-sm text-[#7A7267]">{t('policiesNote')}</p><Link href="/website" className="text-[#71382D] underline">{t('openWebsiteEditor')}</Link></div>}
      {tab === 'payments' && <div className="space-y-6">
        <div className="space-y-3 rounded-lg border border-[#E8E2DA] p-5">
          <h3 className="text-lg font-semibold">{t('checkInPaymentPolicy')}</h3>
          <label className="flex items-start gap-3 text-sm"><input type="radio" name="check-in-policy" checked={profile.checkInPaymentPolicy !== 'require_full'} onChange={() => { setProfile({ ...profile, checkInPaymentPolicy: 'allow_outstanding' }); setDirty(true); }} /><span>{t('allowOutstandingCheckIn')}</span></label>
          <label className="flex items-start gap-3 text-sm"><input type="radio" name="check-in-policy" checked={profile.checkInPaymentPolicy === 'require_full'} onChange={() => { setProfile({ ...profile, checkInPaymentPolicy: 'require_full' }); setDirty(true); }} /><span>{t('requireFullCheckIn')}</span></label>
        </div>
        <div className="space-y-3 rounded-lg border border-[#E8E2DA] p-5">
          <h3 className="text-lg font-semibold">{t('checkOutPaymentPolicy')}</h3>
          <label className="flex items-start gap-3 text-sm"><input type="radio" name="check-out-policy" checked={profile.checkOutPaymentPolicy !== 'require_settlement'} onChange={() => { setProfile({ ...profile, checkOutPaymentPolicy: 'allow_outstanding' }); setDirty(true); }} /><span>{t('allowOutstandingCheckOut')}</span></label>
          <label className="flex items-start gap-3 text-sm"><input type="radio" name="check-out-policy" checked={profile.checkOutPaymentPolicy === 'require_settlement'} onChange={() => { setProfile({ ...profile, checkOutPaymentPolicy: 'require_settlement' }); setDirty(true); }} /><span>{t('requireSettlementCheckOut')}</span></label>
        </div>
        <div className="space-y-3 rounded-lg border border-[#E8E2DA] p-5">
          <h3 className="text-lg font-semibold">{t('directBookingMethods')}</h3>
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={profile.directBookingPayAtProperty !== false} onChange={(event) => { setProfile({ ...profile, directBookingPayAtProperty: event.target.checked }); setDirty(true); }} /><span>{t('payAtProperty')}</span></label>
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={profile.directBookingBankTransfer !== false} onChange={(event) => { setProfile({ ...profile, directBookingBankTransfer: event.target.checked }); setDirty(true); }} /><span>{t('bankTransferShown')}</span></label>
          <p className="text-sm text-[#7A7267]">{t('payOnlineNote')}</p>
        </div>
        <div className="space-y-3 rounded-lg border border-[#E8E2DA] p-5">
          <h3 className="text-lg font-semibold">{t('bankAccounts')}</h3>
          <p className="text-sm text-[#7A7267]">{t('bankAccountsNote')}</p>
          {bankAccounts.map((account) => (
            <div key={account.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-[#E8E2DA] rounded p-3 text-sm">
              <div>
                <strong>{account.accountName}</strong>
                <p className="text-[#7A7267] ltr-isolate" dir="ltr">{account.bankName} · {account.accountNumber} · {account.currency}{account.isPrimary ? ` · ${t('primarySuffix')}` : ''}</p>
              </div>
              <div className="flex gap-2">
                {!account.isPrimary && <button type="button" className="text-[#71382D] underline" onClick={async () => { await fetch(`/api/settings/bank-accounts/${account.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isPrimary: true }) }); load(); }}>{t('makePrimary')}</button>}
                <button type="button" className="text-red-700 underline" onClick={async () => { await fetch(`/api/settings/bank-accounts/${account.id}`, { method: 'DELETE' }); load(); }}>{tCommon('remove')}</button>
              </div>
            </div>
          ))}
          <div className="grid sm:grid-cols-2 gap-3">
            <input placeholder={t('accountName')} value={bankForm.accountName} onChange={(event) => setBankForm({ ...bankForm, accountName: event.target.value })} className="min-h-11 rounded border border-[#E5D4BC] px-3 text-sm" />
            <input placeholder={t('bankName')} value={bankForm.bankName} onChange={(event) => setBankForm({ ...bankForm, bankName: event.target.value })} className="min-h-11 rounded border border-[#E5D4BC] px-3 text-sm" />
            <input placeholder={t('accountNumber')} value={bankForm.accountNumber} onChange={(event) => setBankForm({ ...bankForm, accountNumber: event.target.value })} className="min-h-11 rounded border border-[#E5D4BC] px-3 text-sm ltr-isolate" dir="ltr" />
            <input placeholder={t('currency')} value={bankForm.currency} onChange={(event) => setBankForm({ ...bankForm, currency: event.target.value.toUpperCase() })} className="min-h-11 rounded border border-[#E5D4BC] px-3 text-sm ltr-isolate" dir="ltr" />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={bankForm.isPrimary} onChange={(event) => setBankForm({ ...bankForm, isPrimary: event.target.checked })} />{t('primaryDefault')}</label>
          {bankError && <p className="text-sm text-[#9E382A]">{bankError}</p>}
          <Button type="button" onClick={async () => {
            setBankError('');
            const res = await fetch('/api/settings/bank-accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bankForm) });
            const data = await res.json();
            if (!res.ok) { setBankError(data.error || t('bankSaveFailed')); return; }
            setBankForm({ accountName: '', bankName: '', accountNumber: '', currency: profile.currency || 'NGN', isPrimary: false });
            load();
          }}>{t('addBankAccount')}</Button>
          <Link className="text-[#71382D] underline block" href="/payments">{t('viewPayments')}</Link>
        </div>
      </div>}
      {tab === 'notifications' && <div className="space-y-3 rounded-lg border border-[#E8E2DA] p-5"><h3 className="text-lg font-semibold">{t('notificationsComing')}</h3><p className="text-sm text-[#7A7267]">{t('notificationsBody')}</p></div>}
      {tab === 'subscription' && <div className="space-y-3 rounded-lg border border-[#E8E2DA] p-5"><h3 className="text-lg font-semibold">{t('tabBilling')}</h3><p className="text-sm text-[#7A7267]">{t('billingBody')}</p><Link className="text-[#71382D] underline" href="/billing">{t('openBilling')}</Link></div>}
    </form>}
  </main></div>;
}

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { getProviderContent } from '@/lib/integrations/platform/provider-content';

export function ProviderEducationSections({
  provider,
  brandName,
  availability,
  connected,
}: {
  provider: string;
  brandName: string;
  availability: string;
  connected: boolean;
}) {
  const t = useTranslations('apps');
  const content = getProviderContent(provider);
  if (!content) return null;

  const comingSoon = availability !== 'available';
  const overviewKey = comingSoon && content.comingSoonOverviewKey ? content.comingSoonOverviewKey : content.overviewKey;

  return (
    <div className="max-w-3xl space-y-8">
      <section className="space-y-2">
        <h2 className="font-serif text-xl text-[#191816]">{t('whatItDoes', { name: brandName })}</h2>
        <p className="text-sm leading-relaxed text-[#5C564C]">{t(overviewKey as 'googleCalendarOverview')}</p>
      </section>

      {content.benefitKeys.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#7A7267]">{t('whyConnect')}</h2>
          <ul className="space-y-2">
            {content.benefitKeys.map((key) => (
              <li key={key} className="flex gap-2 text-sm text-[#191816]">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#B85C3E]" aria-hidden />
                <span>{t(key as 'googleCalendarBenefit1')}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {comingSoon ? (
        <section className="space-y-2 border-t border-[#E8E2DA] pt-6">
          <p className="text-sm font-medium text-[#71382D]">{t('comingSoonDetail')}</p>
          <p className="text-sm leading-relaxed text-[#5C564C]">{t('comingSoonBody')}</p>
        </section>
      ) : null}

      {!connected && !comingSoon ? (
        <>
          <section className="space-y-3 border-t border-[#E8E2DA] pt-6">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#7A7267]">
              {t('beforeYouConnect')}
            </h2>
            <ul className="space-y-2">
              {content.prerequisiteKeys.map((key) => (
                <li key={key} className="flex gap-2 text-sm text-[#191816]">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#71382D]" aria-hidden />
                  <span>{t(key as 'googleCalendarPrereq1')}</span>
                </li>
              ))}
            </ul>
          </section>

          {content.connectionStepKeys.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#7A7267]">
                {t('howToConnect')}
              </h2>
              <ol className="space-y-2">
                {content.connectionStepKeys.map((key, index) => (
                  <li key={key} className="flex gap-3 text-sm text-[#191816]">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F7F1E8] text-[11px] font-medium text-[#71382D]">
                      {index + 1}
                    </span>
                    <span className="pt-0.5">{t(key as 'googleCalendarStep1')}</span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </>
      ) : null}

      {!comingSoon ? (
        <section className="space-y-3 border-t border-[#E8E2DA] pt-6">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#7A7267]">{t('howItWorks')}</h2>
          <div className="rounded-2xl border border-[#E8E2DA] bg-[#FBF8F4] px-4 py-4">
            <p className="text-sm font-medium text-[#191816]">
              {t('senaSourceLabel')} <span className="text-[#7A7267]">{t('flowArrow')}</span>{' '}
              {t('providerTargetLabel', { name: brandName })}
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[#5C564C]">
              <li>{t(content.howCreateKey as 'googleCalendarHowCreate')}</li>
              <li>{t(content.howUpdateKey as 'googleCalendarHowUpdate')}</li>
              {content.howCancelKey ? <li>{t(content.howCancelKey as 'googleCalendarHowCancel')}</li> : null}
            </ul>
          </div>
        </section>
      ) : null}

      <section className="space-y-2 border-t border-[#E8E2DA] pt-6">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#7A7267]">{t('goodToKnow')}</h2>
        <p className="text-sm leading-relaxed text-[#5C564C]">{t(content.goodToKnowKey as 'googleCalendarGoodToKnow')}</p>
      </section>
    </div>
  );
}

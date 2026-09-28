import { requireIsolatedTestDatabase } from './require-isolated-test-database';

process.env.SENA_TEST_DATABASE_URL = process.env.SENA_TEST_DATABASE_URL || `postgresql://${process.env.USER || 'oyekunle'}@localhost:55432/sena_test`;
process.env.SENA_PRODUCTION_DATABASE_URL = process.env.SENA_PRODUCTION_DATABASE_URL || 'postgresql://placeholder-prod-url-for-safety-check:5432/sena_prod_remote';
delete process.env.PAYSTACK_SECRET_KEY;
delete process.env.PAYSTACK_PUBLIC_KEY;
delete process.env.RESEND_API_KEY;
delete process.env.SMTP_PASSWORD;
delete process.env.REDIS_URL;
delete process.env.S3_ACCESS_KEY_ID;
delete process.env.S3_SECRET_ACCESS_KEY;
requireIsolatedTestDatabase();

let total = 0;
let passed = 0;

function assert(condition: boolean, name: string) {
  total++;
  if (condition) {
    passed++;
    console.log(`  PASS ${name}`);
  } else {
    console.error(`  FAIL ${name}`);
  }
}

async function main() {
  const {
    db,
    organizations,
    properties,
    websiteConfigs,
    eq,
  } = await import('../packages/database/src/index');
  const { getWebsiteData } = await import('../apps/dashboard/src/lib/website-data');
  const {
    pickPublishable,
    sanitizeWebsiteConfig,
    saveWebsiteDraft,
    publishWebsiteConfig,
  } = await import('../apps/dashboard/src/lib/website-config-ops');

  const suffix = crypto.randomUUID().slice(0, 8);
  const [org] = await db.insert(organizations).values({ name: `Publish QA ${suffix}`, slug: `pub-qa-${suffix}` }).returning();
  const [legacy] = await db.insert(properties).values({
    organizationId: org.id,
    name: `Legacy Hotel ${suffix}`,
    slug: `legacy-${suffix}`,
    code: `LG${suffix.slice(0, 4).toUpperCase()}`,
    country: 'NG',
    address: '1 Test Street',
    phone: '+2348000000000',
    email: `legacy-${suffix}@example.invalid`,
    timezone: 'Africa/Lagos',
    currency: 'NGN',
  }).returning();
  const [other] = await db.insert(properties).values({
    organizationId: org.id,
    name: `Other Hotel ${suffix}`,
    slug: `other-${suffix}`,
    code: `OT${suffix.slice(0, 4).toUpperCase()}`,
    country: 'NG',
    address: '2 Test Street',
    phone: '+2348000000001',
    email: `other-${suffix}@example.invalid`,
    timezone: 'Africa/Lagos',
    currency: 'NGN',
  }).returning();

  try {
    const picked = pickPublishable({
      theme: 'sena_two',
      draftOnly: true,
      propertyId: other.id,
      id: 'not-a-column',
      evilColumn: 'nope',
      buttonStyle: 'rounded',
    } as any);
    assert(!('draftOnly' in picked), 'pickPublishable drops draftOnly');
    assert(!('propertyId' in picked), 'pickPublishable drops propertyId');
    assert(!('evilColumn' in picked), 'pickPublishable drops unknown keys');
    assert(picked.theme === 'sena_two' && picked.buttonStyle === 'rounded', 'pickPublishable keeps publishable keys');

    const sanitized = sanitizeWebsiteConfig({
      theme: 'sena_one',
      brandColors: { primaryColor: '#1A365D' },
      typography: {},
      buttonStyle: 'soft',
      heroHeadline: '',
      galleryImages: [],
    });
    assert(sanitized.theme === 'sena_one', 'legacy missing heading font still sanitizes');
    assert((sanitized.typography as any).headingFont === 'serif', 'missing heading font defaults to serif');
    assert(Array.isArray(sanitized.galleryImages) && (sanitized.galleryImages as any[]).length === 0, 'empty gallery is valid');

    const before = await db.query.websiteConfigs.findFirst({ where: eq(websiteConfigs.propertyId, legacy.id) });
    assert(!before, 'legacy property starts with no website_configs row');

    const uiPayload = {
      draftOnly: true,
      theme: 'sena_two',
      brandColors: { primaryColor: '#1A365D', accentColor: '#C5A059' },
      typography: { headingFont: 'serif', bodyFont: 'sans' },
      buttonStyle: 'rounded',
      logoUrl: null,
      heroHeadline: 'Draft Headline Only',
      heroSubheading: '',
      heroImageUrl: '',
      heroCtaLabel: 'Reserve Your Stay',
      welcomeEyebrow: 'Hospitality, Simplified',
      welcomeTitle: 'A Tranquil Sanctuary in the City',
      welcomeBody: '',
      aboutStory: '',
      galleryImages: [],
      contactPhone: '',
      contactEmail: '',
      contactWhatsapp: '',
      whatsappEnabled: false,
      seoTitle: '',
      seoDescription: '',
    };

    const liveBeforeDraft = await getWebsiteData(legacy.slug!, false);
    const draftSave = await saveWebsiteDraft(legacy.id, uiPayload as any);
    assert(Boolean(draftSave.config?.id), 'Save Draft creates website_configs for legacy properties');
    assert(draftSave.config.isPublished === false, 'Save Draft does not mark the website published');
    const liveAfterDraft = await getWebsiteData(legacy.slug!, false);
    assert(liveAfterDraft?.config.heroHeadline !== 'Draft Headline Only', 'public renderer stays on pre-publish content after Save Draft');
    assert(liveAfterDraft?.config.theme === liveBeforeDraft?.config.theme, 'Save Draft does not change live theme');

    const published = await publishWebsiteConfig(legacy.id, {});
    assert(published.isPublished === true, 'Publish marks website published');
    assert(published.draftConfig === null, 'Publish clears draft_config');
    assert(published.theme === 'sena_two', 'Publish promotes draft theme');
    assert(published.buttonStyle === 'rounded', 'Publish promotes draft button style');
    assert(published.heroHeadline === 'Draft Headline Only', 'Publish promotes draft headline');
    const liveAfterPublish = await getWebsiteData(legacy.slug!, false);
    assert(liveAfterPublish?.config.theme === 'sena_two', 'public renderer serves published theme');
    assert(liveAfterPublish?.config.heroHeadline === 'Draft Headline Only', 'public renderer serves published headline');

    const republished = await publishWebsiteConfig(legacy.id, {});
    assert(republished.isPublished === true, 'no-draft publish republishes current configuration');
    assert(republished.theme === 'sena_two', 'no-draft publish keeps current theme');

    await saveWebsiteDraft(legacy.id, { heroHeadline: 'Unpublished edit' });
    const live = await getWebsiteData(legacy.slug!, false);
    const [row] = await db.select().from(websiteConfigs).where(eq(websiteConfigs.propertyId, legacy.id));
    assert(live?.config.heroHeadline === 'Draft Headline Only', 'failed or pending draft does not change live site');
    assert((row.draftConfig as any)?.heroHeadline === 'Unpublished edit', 'draft survives independently of live site');

    await saveWebsiteDraft(other.id, { theme: 'sena_three', heroHeadline: 'Other hotel only' });
    const [legacyRow] = await db.select().from(websiteConfigs).where(eq(websiteConfigs.propertyId, legacy.id));
    const [otherRow] = await db.select().from(websiteConfigs).where(eq(websiteConfigs.propertyId, other.id));
    assert(legacyRow.propertyId === legacy.id && otherRow.propertyId === other.id, 'drafts are property-scoped');
    assert((otherRow.draftConfig as any)?.heroHeadline === 'Other hotel only', 'property B draft is isolated');
    assert((legacyRow.draftConfig as any)?.heroHeadline === 'Unpublished edit', 'property A draft is unchanged by property B save');

    console.log(`\nWEBSITE PUBLISH TESTS: ${passed}/${total} passed`);
    if (passed !== total) process.exit(1);
  } finally {
    await db.delete(websiteConfigs).where(eq(websiteConfigs.propertyId, legacy.id));
    await db.delete(websiteConfigs).where(eq(websiteConfigs.propertyId, other.id));
    await db.delete(properties).where(eq(properties.id, legacy.id));
    await db.delete(properties).where(eq(properties.id, other.id));
    await db.delete(organizations).where(eq(organizations.id, org.id));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

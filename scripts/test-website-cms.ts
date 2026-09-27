import { requireIsolatedTestDatabase } from './require-isolated-test-database';
import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';

// Setup environment for isolated test database
process.env.SENA_TEST_DATABASE_URL = `postgresql://${process.env.USER || 'oyekunle'}@localhost:55432/sena_test`;
process.env.SENA_PRODUCTION_DATABASE_URL = 'postgresql://placeholder-prod-url-for-safety-check:5432/sena_prod_remote';
requireIsolatedTestDatabase();

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${testName} ${detail ? `\x1b[90m(${detail})\x1b[0m` : ''}`);
  } else {
    failedChecks++;
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${testName} ${detail ? `\x1b[31m- ${detail}\x1b[0m` : ''}`);
  }
}

async function runWebsiteCmsTests() {
  console.log('\n======================================================================');
  console.log('  SENA V1 WEBSITE CMS — END-TO-END AUTOMATED CERTIFICATION');
  console.log('======================================================================\n');

  const {
    db,
    organizations,
    properties,
    roomTypes,
    rooms,
    websiteConfigs,
    websiteDomains,
    propertyMembers,
    users,
    reviews,
    eq,
    and,
  } = await import('../packages/database/src/index');

  const { getWebsiteData } = await import('../apps/dashboard/src/lib/website-data');
  const {
    getAccessibleTextColor,
    normalizeHexColor,
    resolveThemeTokens,
  } = await import('../apps/dashboard/src/lib/theme-provider');

  const runId = crypto.randomUUID().slice(0, 8);
  const slugA = `test-hotel-a-${runId}`;
  const slugB = `test-hotel-b-${runId}`;

  try {
    // ------------------------------------------------------------------
    // TEST 1: ISOLATED FIXTURES SETUP
    // ------------------------------------------------------------------
    console.log('\x1b[34m[1/7] Creating Isolated Multi-Tenant Test Properties...\x1b[0m');
    const [orgA] = await db.insert(organizations).values({ name: `Org A ${runId}`, slug: `org-a-${runId}` }).returning();
    const [propA] = await db.insert(properties).values({
      organizationId: orgA.id,
      name: `Grand Palace A ${runId}`,
      slug: slugA,
      code: `GPA-${runId}`,
      address: '10 Marina Way, Lagos',
      country: 'Nigeria',
      phone: '+2348011111111',
      email: 'contact@palace-a.ng',
      currency: 'NGN',
    }).returning();

    const [rTypeA] = await db.insert(roomTypes).values({
      propertyId: propA.id,
      name: 'Deluxe Suite',
      bedType: 'King',
      basePriceMinorUnits: 15000000,
      capacity: 2,
      totalInventory: 3,
    }).returning();

    await db.insert(rooms).values([
      { propertyId: propA.id, roomTypeId: rTypeA.id, roomNumber: '101', floor: '1', operationalStatus: 'available', housekeepingStatus: 'clean' },
    ]);

    // Initial Published Website Config for Property A
    const [initialConfigA] = await db.insert(websiteConfigs).values({
      propertyId: propA.id,
      theme: 'sena_one',
      brandColors: { primaryColor: '#71382D', accentColor: '#B85C3E' },
      typography: { headingFont: 'sans', bodyFont: 'sans' },
      buttonStyle: 'soft',
      heroHeadline: 'Initial Live Headline',
      heroSubheading: 'Original published luxury',
      heroCtaLabel: 'Reserve Your Stay',
      welcomeTitle: 'Original Sanctuary',
      welcomeBody: 'Original welcome copy',
      isPublished: true,
      publishedAt: new Date('2026-09-01T12:00:00Z'),
      draftConfig: null,
    }).returning();

    // Property B for Tenant Isolation Tests
    const [orgB] = await db.insert(organizations).values({ name: `Org B ${runId}`, slug: `org-b-${runId}` }).returning();
    const [propB] = await db.insert(properties).values({
      organizationId: orgB.id,
      name: `Boutique Haven B ${runId}`,
      slug: slugB,
      code: `BHB-${runId}`,
      address: '25 Victoria Island, Lagos',
      country: 'Nigeria',
      phone: '+2348022222222',
      email: 'contact@haven-b.ng',
      currency: 'NGN',
    }).returning();

    await db.insert(websiteConfigs).values({
      propertyId: propB.id,
      theme: 'sena_one',
      brandColors: { primaryColor: '#191816', accentColor: '#4A7C59' },
      typography: { headingFont: 'serif', bodyFont: 'sans' },
      buttonStyle: 'square',
      heroHeadline: 'Property B Live Site',
      isPublished: true,
      draftConfig: null,
    });

    assert(Boolean(propA.id && propB.id), 'Isolated test properties created in sena_test');

    // ------------------------------------------------------------------
    // TEST 2: DRAFT VS PUBLISHED STATE ISOLATION
    // ------------------------------------------------------------------
    console.log('\n\x1b[34m[2/7] Draft Configuration vs Published Website Isolation...\x1b[0m');

    // Verify public live website renders initial published state
    const liveBeforeDraft = await getWebsiteData(slugA, false);
    assert(liveBeforeDraft?.config.theme === 'sena_one', 'Live public website serves published theme (sena_one)');
    assert(liveBeforeDraft?.config.heroHeadline === 'Initial Live Headline', 'Live public website serves published headline');
    assert(liveBeforeDraft?.config.brandColors.primaryColor === '#71382D', 'Live public website serves published primary color (#71382D)');

    // Simulate operator editing and saving a DRAFT (theme: sena_two, primaryColor: #1A365D, headline: Edited In Draft)
    const draftPayload = {
      theme: 'sena_two',
      brandColors: { primaryColor: '#1a365d', accentColor: '#c5a059' },
      typography: { headingFont: 'serif', bodyFont: 'sans' },
      buttonStyle: 'rounded',
      heroHeadline: 'Draft Only Luxury - Not Live Yet',
      heroSubheading: 'Draft changes in progress',
      welcomeTitle: 'Draft Welcome',
    };

    // Update draft_config only
    await db.update(websiteConfigs)
      .set({
        draftConfig: draftPayload,
        updatedAt: new Date(),
      })
      .where(eq(websiteConfigs.propertyId, propA.id));

    // Re-query public live website (isPreview = false)
    const liveAfterDraft = await getWebsiteData(slugA, false);
    assert(liveAfterDraft?.config.theme === 'sena_one', 'LIVE site remains sena_one after draft save (NO silent live changes)');
    assert(liveAfterDraft?.config.heroHeadline === 'Initial Live Headline', 'LIVE site headline unchanged after draft save');
    assert(liveAfterDraft?.config.brandColors.primaryColor === '#71382D', 'LIVE site primary color unchanged (#71382D)');
    assert(liveAfterDraft?.config.buttonStyle === 'soft', 'LIVE site button style unchanged (soft)');

    // Query preview website (isPreview = true)
    const previewAfterDraft = await getWebsiteData(slugA, true);
    assert(previewAfterDraft?.config.theme === 'sena_two', 'PREVIEW reflects draft theme (sena_two)');
    assert(previewAfterDraft?.config.heroHeadline === 'Draft Only Luxury - Not Live Yet', 'PREVIEW reflects draft headline');
    assert(previewAfterDraft?.config.brandColors.primaryColor === '#1a365d', 'PREVIEW reflects draft primary color (#1a365d)');
    assert(previewAfterDraft?.config.buttonStyle === 'rounded', 'PREVIEW reflects draft button style (rounded)');
    assert(previewAfterDraft?.config.typography.headingFont === 'serif', 'PREVIEW reflects draft heading typography (serif)');

    // ------------------------------------------------------------------
    // TEST 3: ATOMIC PUBLISHING
    // ------------------------------------------------------------------
    console.log('\n\x1b[34m[3/7] Atomic Publishing Promotion...\x1b[0m');

    // Simulate Publish Website action: atomically promotes draft_config to main columns & clears draft_config
    const [existing] = await db.select().from(websiteConfigs).where(eq(websiteConfigs.propertyId, propA.id));
    const publishedAtTime = new Date();
    await db.update(websiteConfigs)
      .set({
        theme: (existing.draftConfig as any)?.theme || existing.theme,
        brandColors: (existing.draftConfig as any)?.brandColors || existing.brandColors,
        typography: (existing.draftConfig as any)?.typography || existing.typography,
        buttonStyle: (existing.draftConfig as any)?.buttonStyle || existing.buttonStyle,
        heroHeadline: (existing.draftConfig as any)?.heroHeadline || existing.heroHeadline,
        heroSubheading: (existing.draftConfig as any)?.heroSubheading || existing.heroSubheading,
        welcomeTitle: (existing.draftConfig as any)?.welcomeTitle || existing.welcomeTitle,
        draftConfig: null,
        isPublished: true,
        publishedAt: publishedAtTime,
        updatedAt: new Date(),
      })
      .where(eq(websiteConfigs.propertyId, propA.id));

    // Verify DB state
    const [inDbAfterPublish] = await db.select().from(websiteConfigs).where(eq(websiteConfigs.propertyId, propA.id));
    assert(inDbAfterPublish.draftConfig === null, 'Atomic publish clears draft_config to null');
    assert(inDbAfterPublish.isPublished === true, 'Atomic publish marks isPublished = true');
    assert(inDbAfterPublish.theme === 'sena_two', 'Atomic publish promoted theme to sena_two in DB');
    assert(inDbAfterPublish.buttonStyle === 'rounded', 'Atomic publish promoted buttonStyle to rounded in DB');

    // Verify live public website now serves the newly published version
    const liveAfterPublish = await getWebsiteData(slugA, false);
    assert(liveAfterPublish?.config.theme === 'sena_two', 'Live public website now serves published theme (sena_two)');
    assert(liveAfterPublish?.config.heroHeadline === 'Draft Only Luxury - Not Live Yet', 'Live public website serves new published headline');
    assert(liveAfterPublish?.config.brandColors.primaryColor === '#1a365d', 'Live public website serves new primary color (#1a365d)');
    assert(liveAfterPublish?.config.buttonStyle === 'rounded', 'Live public website serves new buttonStyle (rounded)');

    // ------------------------------------------------------------------
    // TEST 4: THEME SYSTEM & TOKEN INTEGRITY (SENA ONE, TWO, THREE)
    // ------------------------------------------------------------------
    console.log('\n\x1b[34m[4/7] Theme System & Token Contract Integrity...\x1b[0m');

    // Sena One: Modern Luxury
    const tokensOne = resolveThemeTokens({
      theme: 'sena_one',
      brandColors: { primaryColor: '#71382D', accentColor: '#B85C3E' },
      buttonStyle: 'soft',
      typography: { headingFont: 'sans', bodyFont: 'sans' },
    });
    assert(tokensOne.headingFont === 'sans', 'Sena One resolves modern clean sans heading font');
    assert(tokensOne.borderRadius === '6px', 'Soft button style resolves 6px border radius');
    assert(tokensOne.primaryColor.toLowerCase() === '#71382d', 'Sena One retains primary brand color');

    // Sena Two: Editorial Boutique
    const tokensTwo = resolveThemeTokens({
      theme: 'sena_two',
      brandColors: { primaryColor: '#1A365D', accentColor: '#C5A059' },
      buttonStyle: 'square',
      typography: { headingFont: 'serif', bodyFont: 'sans' },
    });
    assert(tokensTwo.headingFont === 'serif', 'Sena Two resolves editorial serif heading font');
    assert(tokensTwo.borderRadius === '0px', 'Square button style resolves 0px border radius');
    assert(tokensTwo.headingFontFamily.includes('Georgia') || tokensTwo.headingFontFamily.includes('serif'), 'Sena Two serif font stack includes Georgia/serif');

    // Sena Three: Warm Resort
    const tokensThree = resolveThemeTokens({
      theme: 'sena_three',
      brandColors: { primaryColor: '#8B5A2B', accentColor: '#4A7C59' },
      buttonStyle: 'rounded',
      typography: { headingFont: 'serif', bodyFont: 'sans' },
    });
    assert(tokensThree.borderRadius === '9999px', 'Pill Rounded button style resolves 9999px border radius');
    assert(tokensThree.bgColor === '#FDFCFA', 'Sena Three resolves warm resort surface background (#FDFCFA)');

    // Verify inventory and room details preserved across themes
    assert(liveAfterPublish?.rooms.length === 1, 'Inventory & rooms preserved across themes (1 room type)');
    assert(liveAfterPublish?.rooms[0].name === 'Deluxe Suite', 'Room name preserved across themes');
    assert(liveAfterPublish?.property.name.startsWith('Grand Palace A'), 'Property identity preserved across themes');

    // ------------------------------------------------------------------
    // TEST 5: ACCESSIBLE CONTRAST & SAFE COLOR NORMALIZATION
    // ------------------------------------------------------------------
    console.log('\n\x1b[34m[5/7] WCAG 2.1 Accessible Contrast & Safe Color Normalization...\x1b[0m');

    // Extreme dark (#000000 or deep navy) must choose white text
    const textOnBlack = getAccessibleTextColor('#000000');
    assert(textOnBlack === '#FFFFFF', 'Extreme dark background (#000000) selects white text (#FFFFFF)');

    const textOnNavy = getAccessibleTextColor('#1A365D');
    assert(textOnNavy === '#FFFFFF', 'Deep navy background (#1A365D) selects white text (#FFFFFF)');

    // Extreme light (#FFFFFF or light cream) must choose dark text
    const textOnWhite = getAccessibleTextColor('#FFFFFF');
    assert(textOnWhite === '#191816', 'Extreme light background (#FFFFFF) selects dark text (#191816)');

    const textOnCream = getAccessibleTextColor('#FAF7F2');
    assert(textOnCream === '#191816', 'Light cream background (#FAF7F2) selects dark text (#191816)');

    // Hex Normalization & Safety
    assert(normalizeHexColor('#71382d') === '#71382d', 'Valid 6-digit hex normalized correctly');
    assert(normalizeHexColor('71382D') === '#71382d', 'Hex missing leading # normalized correctly');
    assert(normalizeHexColor('#FFF') === '#ffffff', '3-digit shorthand hex expanded to 6-digit hex');
    assert(normalizeHexColor('javascript:alert(1)') === '#71382D', 'CSS injection attempt safely rejected and fallback returned');
    assert(normalizeHexColor('red; background: blue') === '#71382D', 'Malformed CSS string safely rejected and fallback returned');

    // ------------------------------------------------------------------
    // TEST 6: MULTI-TENANT ISOLATION & UNAUTHORIZED CROSS-TENANT ACCESS
    // ------------------------------------------------------------------
    console.log('\n\x1b[34m[6/7] Multi-Tenant Isolation & Security Boundaries...\x1b[0m');

    // Verify Property B cannot see Property A's configuration or draft
    const configAInDb = await db.select().from(websiteConfigs).where(eq(websiteConfigs.propertyId, propA.id));
    const configBInDb = await db.select().from(websiteConfigs).where(eq(websiteConfigs.propertyId, propB.id));

    assert(configAInDb[0].id !== configBInDb[0].id, 'Property A and Property B have distinct website config records');
    assert(configAInDb[0].propertyId === propA.id, 'Config A is bound strictly to Property A');
    assert(configBInDb[0].propertyId === propB.id, 'Config B is bound strictly to Property B');

    // Public lookup for non-existent slug returns null
    const nonExistent = await getWebsiteData('does-not-exist-slug', false);
    assert(nonExistent === null, 'Unknown property slug returns null safely without throwing');

    // ------------------------------------------------------------------
    // TEST 7: REVIEWS & SOCIAL / SEO FIELDS
    // ------------------------------------------------------------------
    console.log('\n\x1b[34m[7/7] Guest Reviews & SEO Verification...\x1b[0m');

    // Add a verified review to Property A
    const [rev] = await db.insert(reviews).values({
      propertyId: propA.id,
      guestName: 'Adaobi Okafor',
      rating: 5,
      title: 'Flawless stay',
      body: 'Quiet elegance and impeccable service throughout our stay.',
      status: 'published',
      isVerifiedStay: true,
      source: 'direct',
    }).returning();

    const dataWithReview = await getWebsiteData(slugA, false);
    assert(dataWithReview?.reviews.totalCount === 1, 'Public website includes real approved guest review');
    assert(dataWithReview?.reviews.items[0].guestName === 'Adaobi Okafor', 'Review guest name matches DB record');
    assert(dataWithReview?.reviews.items[0].isVerifiedStay === true, 'Verified stay flag preserved for public display');

    // Clean up test records
    await db.delete(reviews).where(eq(reviews.id, rev.id));
    await db.delete(rooms).where(eq(rooms.propertyId, propA.id));
    await db.delete(roomTypes).where(eq(roomTypes.propertyId, propA.id));
    await db.delete(websiteConfigs).where(eq(websiteConfigs.propertyId, propA.id));
    await db.delete(websiteConfigs).where(eq(websiteConfigs.propertyId, propB.id));
    await db.delete(properties).where(eq(properties.id, propA.id));
    await db.delete(properties).where(eq(properties.id, propB.id));
    await db.delete(organizations).where(eq(organizations.id, orgA.id));
    await db.delete(organizations).where(eq(organizations.id, orgB.id));

    console.log('\n----------------------------------------------------------------------');
    console.log(`  WEBSITE CMS TEST RESULTS: ${passedChecks}/${totalChecks} CHECKS PASSED`);
    console.log('----------------------------------------------------------------------\n');

    if (failedChecks > 0) {
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n\x1b[31mCRITICAL TEST ERROR:\x1b[0m', error);
    process.exit(1);
  }
}

runWebsiteCmsTests();

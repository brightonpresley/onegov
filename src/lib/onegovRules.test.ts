import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateGreenerZambiaImpact,
  calculateIllustrativeRoadTax,
  canAccessInstitutionRecords,
  canApproveInstitutionalDecision,
  computeTextSimilarityScore,
  evaluateRevenueZone,
  extractMapsGroundingPlaces,
  extractSearchGroundingSources,
  filterGlobalServiceNavigation,
  getScreenDomainLabel,
  parseZoneCoordinates,
  sanitizeFirestoreId,
  sanitizeSavedLocationInput,
  sanitizeVoiceNoteInput,
  updateBreadcrumbTrail,
  validateSandboxPaymentInput,
} from './onegovRules';

test('calculateIllustrativeRoadTax computes annual private vehicle quote with 5% annual discount', () => {
  const quote = calculateIllustrativeRoadTax({
    engineCc: 1800,
    vehicleClass: 'Private Motor Car',
    quarters: 4,
  });
  // Base 260 * 4 = 1040, carbon 15 * 4 = 60, discount 5% of 1040 = 52 => 1048
  assert.equal(quote.baseQuarterlyZmw, 260);
  assert.equal(quote.carbonLevyZmw, 60);
  assert.equal(quote.digitalFeeDiscountZmw, 52);
  assert.equal(quote.totalZmw, 1048);
  assert.equal(quote.isSimulated, true);
});

test('evaluateRevenueZone classifies Chawama Ward 12 (35%) as critical and Kabulonga (92%) as nominal', () => {
  const chawama = evaluateRevenueZone({
    expectedRevenueZmw: 100000,
    actualRevenueZmw: 35000,
    registeredBusinesses: 420,
    activePermits: 148,
  });
  assert.equal(chawama.performancePct, 35);
  assert.equal(chawama.revenueGapZmw, 65000);
  assert.equal(chawama.permitCoveragePct, 35);
  assert.equal(chawama.status, 'critical');

  const kabulonga = evaluateRevenueZone({
    expectedRevenueZmw: 100000,
    actualRevenueZmw: 92000,
    registeredBusinesses: 210,
    activePermits: 196,
  });
  assert.equal(kabulonga.performancePct, 92);
  assert.equal(kabulonga.status, 'nominal');
});

test('RBAC isolates institutional operational approvals and prevents super_admin override', () => {
  assert.equal(canAccessInstitutionRecords('council_officer', 'LCC', 'LCC'), true);
  assert.equal(canAccessInstitutionRecords('council_officer', 'LCC', 'RTSA'), false);
  assert.equal(canApproveInstitutionalDecision('super_admin', null, 'PACRA'), false);
  assert.equal(canApproveInstitutionalDecision('ip_officer', 'PACRA', 'PACRA'), true);
  assert.equal(canApproveInstitutionalDecision('zra_admin', 'ZRA', 'LCC'), false);
});

test('validateSandboxPaymentInput rejects invalid mobile numbers and zero amounts', () => {
  assert.equal(
    validateSandboxPaymentInput({
      amountZmw: 0,
      channel: 'MTN MoMo',
      accountIdentifier: '0977123456',
    }).valid,
    false,
  );
  assert.equal(
    validateSandboxPaymentInput({
      amountZmw: 500,
      channel: 'MTN MoMo',
      accountIdentifier: '123',
    }).valid,
    false,
  );
  assert.equal(
    validateSandboxPaymentInput({
      amountZmw: 500,
      channel: 'MTN MoMo',
      accountIdentifier: '0977123456',
    }).valid,
    true,
  );
});

test('Greener Zambia impact and IP similarity scoring behave deterministically', () => {
  const green = calculateGreenerZambiaImpact(5, 3);
  assert.equal(green.paperSheetsSaved, 41);
  assert.equal(green.officeTripsAvoided, 8);
  assert.ok(green.co2GramsAvoided > 10000);

  const sim = computeTextSimilarityScore(
    'Solar powered cassava dryer with IoT moisture sensor',
    'Solar cassava drying chamber with wireless moisture telemetry',
  );
  assert.ok(sim > 15);
});

test('parseZoneCoordinates validates lat/lng ranges safely', () => {
  assert.deepEqual(parseZoneCoordinates('-15.4628', '28.2684'), { lat: -15.4628, lng: 28.2684 });
  assert.equal(parseZoneCoordinates('invalid', '28.26'), null);
  assert.equal(parseZoneCoordinates(95, 28.26), null);
});

test('extractSearchGroundingSources and extractMapsGroundingPlaces deduplicate URIs', () => {
  const webSources = extractSearchGroundingSources([
    { web: { uri: 'https://www.zra.org.zm', title: 'ZRA Official' } },
    { web: { uri: 'https://www.zra.org.zm', title: 'Duplicate' } },
    { web: { uri: 'https://www.pacra.org.zm', title: 'PACRA' } },
  ]);
  assert.equal(webSources.length, 2);
  assert.equal(webSources[0].title, 'ZRA Official');

  const mapsPlaces = extractMapsGroundingPlaces([
    {
      maps: {
        uri: 'https://maps.google.com/?cid=123',
        title: 'RTSA Lusaka',
        placeAnswerSources: { reviewSnippets: [{ content: 'Fast service desk' }] },
      },
    },
    { maps: { uri: 'https://maps.google.com/?cid=123', title: 'Duplicate' } },
  ]);
  assert.equal(mapsPlaces.length, 1);
  assert.equal(mapsPlaces[0].snippets[0], 'Fast service desk');
});

test('Firestore sanitization enforces firebase-blueprint.json length and pattern constraints', () => {
  assert.match(sanitizeFirestoreId('user/../../bad id!'), /^[a-zA-Z0-9_-]+$/);
  const loc = sanitizeSavedLocationInput({
    ownerId: 'uid_123',
    title: 'A'.repeat(250),
    institutionCode: 'rtsa!!',
    latitude: -15.41,
    longitude: 28.28,
    notes: 'N'.repeat(700),
  });
  assert.equal(loc.title.length, 160);
  assert.equal(loc.institutionCode, 'RTSA');
  assert.equal(loc.notes?.length, 500);

  const note = sanitizeVoiceNoteInput({
    ownerId: 'uid_123',
    title: 'My Note',
    transcript: 'T'.repeat(5000),
    sourceType: 'transcription',
  });
  assert.equal(note.transcript.length, 4000);
});

test('filterGlobalServiceNavigation ranks matching modules and catalog services cleanly', () => {
  const modules = [
    { id: 'citizen-dashboard', label: 'Citizen Dashboard', keywords: 'home overview' },
    { id: 'transport', label: 'Transport (RTSA)', keywords: 'road tax vehicle licence' },
    { id: 'council-dashboard', label: 'Council GIS Intel', keywords: 'map ward revenue lcc' },
  ];
  const services = [
    {
      code: 'RTSA-ROAD-TAX',
      title: 'Motor Vehicle Road Tax Renewal',
      institutionCode: 'RTSA',
      categoryName: 'Transport',
      description: 'Renew quarterly or annual vehicle road tax.',
      feeZmw: 260,
    },
    {
      code: 'ZESCO-PREPAID',
      title: 'ZESCO Prepaid Electricity Token',
      institutionCode: 'ZESCO',
      categoryName: 'Utilities',
      description: 'Purchase electricity units.',
      feeZmw: 100,
    },
  ];

  const roadRes = filterGlobalServiceNavigation({ query: 'road tax', modules, services });
  assert.equal(roadRes.modules[0]?.id, 'transport');
  assert.equal(roadRes.services[0]?.code, 'RTSA-ROAD-TAX');

  const emptyRes = filterGlobalServiceNavigation({ query: 'nonexistent xyz', modules, services });
  assert.equal(emptyRes.modules.length, 0);
  assert.equal(emptyRes.services.length, 0);
});

test('updateBreadcrumbTrail tracks hierarchy, truncates when returning, and preserves root', () => {
  let trail: string[] = updateBreadcrumbTrail<string>([], 'citizen-dashboard', {
    resetToRoot: true,
  });
  assert.deepEqual(trail, ['citizen-dashboard']);

  trail = updateBreadcrumbTrail(trail, 'service-directory');
  trail = updateBreadcrumbTrail(trail, 'application-workflow');
  trail = updateBreadcrumbTrail(trail, 'payment-receipts');
  assert.deepEqual(trail, [
    'citizen-dashboard',
    'service-directory',
    'application-workflow',
    'payment-receipts',
  ]);

  // Navigating back to an earlier crumb truncates cleanly
  const back = updateBreadcrumbTrail(trail, 'service-directory');
  assert.deepEqual(back, ['citizen-dashboard', 'service-directory']);

  // Exceeding maxLength keeps root and latest tail
  let longTrail: string[] = updateBreadcrumbTrail<string>(['citizen-dashboard'], 'transport');
  longTrail = updateBreadcrumbTrail(longTrail, 'property');
  longTrail = updateBreadcrumbTrail(longTrail, 'utilities');
  longTrail = updateBreadcrumbTrail(longTrail, 'education');
  longTrail = updateBreadcrumbTrail(longTrail, 'permits', { maxLength: 4 });
  assert.equal(longTrail.length, 4);
  assert.equal(longTrail[0], 'citizen-dashboard');
  assert.equal(longTrail[3], 'permits');

  assert.equal(getScreenDomainLabel('council-dashboard'), 'Revenue & GIS Intelligence');
  assert.deepEqual(updateBreadcrumbTrail(longTrail, 'welcome'), []);
});


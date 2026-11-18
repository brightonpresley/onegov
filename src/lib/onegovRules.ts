export type UserRole =
  | 'citizen'
  | 'small_business_owner'
  | 'business_admin'
  | 'government_officer'
  | 'council_officer'
  | 'institutional_admin'
  | 'zra_admin'
  | 'super_admin'
  | 'finance_officer'
  | 'auditor'
  | 'ip_applicant'
  | 'ip_officer';

export interface RoleMetadata {
  role: UserRole;
  label: string;
  shortLabel: string;
  institutionCode: string | null;
  defaultScreen: string;
  description: string;
}

export const ROLE_DEFINITIONS: Record<UserRole, RoleMetadata> = {
  citizen: {
    role: 'citizen',
    label: 'Citizen',
    shortLabel: 'Citizen',
    institutionCode: null,
    defaultScreen: 'citizen-dashboard',
    description: 'Access personal services, transport, utilities, land rates, education, and receipts.',
  },
  small_business_owner: {
    role: 'small_business_owner',
    label: 'Small-Business Owner',
    shortLabel: 'SME Owner',
    institutionCode: null,
    defaultScreen: 'business-dashboard',
    description: 'Guided business registration, permits, council levies, and compliance reminders.',
  },
  business_admin: {
    role: 'business_admin',
    label: 'Business Administrator',
    shortLabel: 'Business Admin',
    institutionCode: null,
    defaultScreen: 'business-dashboard',
    description: 'Manage enterprise entities, multi-branch licences, filings, and corporate receipts.',
  },
  government_officer: {
    role: 'government_officer',
    label: 'Government Officer',
    shortLabel: 'Gov Officer',
    institutionCode: 'RTSA',
    defaultScreen: 'institution-portal',
    description: 'Review and process citizen applications within your assigned government ministry/agency.',
  },
  council_officer: {
    role: 'council_officer',
    label: 'Council Officer',
    shortLabel: 'Council Officer',
    institutionCode: 'LCC',
    defaultScreen: 'council-dashboard',
    description: 'Manage local council permits, market levies, and GIS ward revenue investigations.',
  },
  institutional_admin: {
    role: 'institutional_admin',
    label: 'Institutional Administrator',
    shortLabel: 'Institution Admin',
    institutionCode: 'ZESCO',
    defaultScreen: 'institution-portal',
    description: 'Configure services, review queues, and view isolated records for one institution.',
  },
  zra_admin: {
    role: 'zra_admin',
    label: 'ZRA Revenue Administrator',
    shortLabel: 'ZRA Admin',
    institutionCode: 'ZRA',
    defaultScreen: 'zra-dashboard',
    description: 'Consolidated national revenue oversight across provinces, councils, and institutions.',
  },
  super_admin: {
    role: 'super_admin',
    label: 'Platform Super Administrator',
    shortLabel: 'Super Admin',
    institutionCode: null,
    defaultScreen: 'super-admin',
    description: 'Onboard institutions, configure workflows, monitor integrations, and manage platform config.',
  },
  finance_officer: {
    role: 'finance_officer',
    label: 'Finance & Reconciliation Officer',
    shortLabel: 'Finance Officer',
    institutionCode: null,
    defaultScreen: 'reports-analytics',
    description: 'Monitor payment verification, institutional settlement allocations, and refunds.',
  },
  auditor: {
    role: 'auditor',
    label: 'Auditor',
    shortLabel: 'Auditor',
    institutionCode: null,
    defaultScreen: 'reports-analytics',
    description: 'Read-only access to audit trails, compliance exceptions, and fraud investigation logs.',
  },
  ip_applicant: {
    role: 'ip_applicant',
    label: 'Intellectual-Property Applicant',
    shortLabel: 'IP Applicant',
    institutionCode: null,
    defaultScreen: 'ip-portal',
    description: 'Submit inventions and trademarks, run AI similarity checks, and track PACRA filings.',
  },
  ip_officer: {
    role: 'ip_officer',
    label: 'Authorised IP Officer (PACRA)',
    shortLabel: 'IP Officer',
    institutionCode: 'PACRA',
    defaultScreen: 'ip-portal',
    description: 'Review patent and trademark submissions and manage statutory PACRA examination queues.',
  },
};

export interface RoadTaxQuoteInput {
  engineCc: number;
  vehicleClass: 'Private Motor Car' | 'Light Commercial' | 'Heavy Goods' | 'Motorcycle' | 'Public Service';
  quarters: 1 | 2 | 4;
}

export interface RoadTaxQuote {
  baseQuarterlyZmw: number;
  quarters: number;
  carbonLevyZmw: number;
  digitalFeeDiscountZmw: number;
  totalZmw: number;
  isSimulated: true;
}

export function calculateIllustrativeRoadTax(input: RoadTaxQuoteInput): RoadTaxQuote {
  const cc = Math.max(50, Math.min(10000, Math.round(input.engineCc || 1500)));
  let baseQuarterly = 220;
  if (input.vehicleClass === 'Motorcycle') {
    baseQuarterly = 95;
  } else if (input.vehicleClass === 'Light Commercial') {
    baseQuarterly = cc > 2500 ? 410 : 310;
  } else if (input.vehicleClass === 'Heavy Goods') {
    baseQuarterly = 680;
  } else if (input.vehicleClass === 'Public Service') {
    baseQuarterly = 450;
  } else {
    if (cc <= 1500) baseQuarterly = 195;
    else if (cc <= 2000) baseQuarterly = 260;
    else if (cc <= 3000) baseQuarterly = 345;
    else baseQuarterly = 460;
  }

  const quarters = input.quarters;
  const subtotal = baseQuarterly * quarters;
  const carbonLevyZmw = input.vehicleClass === 'Heavy Goods' ? 45 * quarters : 15 * quarters;
  const digitalFeeDiscountZmw = quarters === 4 ? Math.round(subtotal * 0.05) : 0;
  const totalZmw = subtotal + carbonLevyZmw - digitalFeeDiscountZmw;

  return {
    baseQuarterlyZmw: baseQuarterly,
    quarters,
    carbonLevyZmw,
    digitalFeeDiscountZmw,
    totalZmw,
    isSimulated: true,
  };
}

export type ZoneHealthStatus = 'critical' | 'attention' | 'nominal';

export interface ZoneMetricsSummary {
  performancePct: number;
  revenueGapZmw: number;
  permitCoveragePct: number;
  status: ZoneHealthStatus;
}

export function evaluateRevenueZone(params: {
  expectedRevenueZmw: number;
  actualRevenueZmw: number;
  registeredBusinesses: number;
  activePermits: number;
}): ZoneMetricsSummary {
  const expected = Math.max(1, params.expectedRevenueZmw);
  const actual = Math.max(0, params.actualRevenueZmw);
  const performancePct = Math.round((actual / expected) * 100);
  const revenueGapZmw = Math.max(0, expected - actual);
  const permitCoveragePct =
    params.registeredBusinesses > 0
      ? Math.min(100, Math.round((params.activePermits / params.registeredBusinesses) * 100))
      : 100;

  let status: ZoneHealthStatus = 'nominal';
  if (performancePct < 55) status = 'critical';
  else if (performancePct < 80) status = 'attention';

  return {
    performancePct,
    revenueGapZmw,
    permitCoveragePct,
    status,
  };
}

export function canAccessInstitutionRecords(
  actorRole: UserRole,
  actorInstitutionCode: string | null,
  targetInstitutionCode: string,
): boolean {
  if (actorRole === 'zra_admin' || actorRole === 'auditor' || actorRole === 'finance_officer') {
    return true;
  }
  if (actorRole === 'super_admin') {
    // Super admin configures platform/institutions but cannot silently alter institutional approvals
    return false;
  }
  if (
    actorRole === 'government_officer' ||
    actorRole === 'council_officer' ||
    actorRole === 'institutional_admin' ||
    actorRole === 'ip_officer'
  ) {
    return Boolean(actorInstitutionCode && actorInstitutionCode === targetInstitutionCode);
  }
  return false;
}

export function canApproveInstitutionalDecision(
  actorRole: UserRole,
  actorInstitutionCode: string | null,
  targetInstitutionCode: string,
): boolean {
  // Rule 11 & Role section: Platform Super Admin must NOT automatically override legally restricted institutional approvals.
  if (actorRole === 'super_admin' || actorRole === 'auditor' || actorRole === 'zra_admin') {
    return false;
  }
  if (
    actorRole === 'government_officer' ||
    actorRole === 'council_officer' ||
    actorRole === 'institutional_admin' ||
    actorRole === 'ip_officer'
  ) {
    return actorInstitutionCode === targetInstitutionCode;
  }
  return false;
}

export interface GreenerImpact {
  digitalTransactionsCount: number;
  paperSheetsSaved: number;
  co2GramsAvoided: number;
  officeTripsAvoided: number;
}

export function calculateGreenerZambiaImpact(
  verifiedPaymentsCount: number,
  digitalApplicationsCount: number,
): GreenerImpact {
  const tx = Math.max(0, verifiedPaymentsCount);
  const apps = Math.max(0, digitalApplicationsCount);
  const paperSheetsSaved = tx * 4 + apps * 7;
  const officeTripsAvoided = tx + apps;
  const co2GramsAvoided = paperSheetsSaved * 5 + officeTripsAvoided * 1450;

  return {
    digitalTransactionsCount: tx + apps,
    paperSheetsSaved,
    co2GramsAvoided,
    officeTripsAvoided,
  };
}

export function computeTextSimilarityScore(queryText: string, targetText: string): number {
  const tokenize = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3),
    );
  const a = tokenize(queryText);
  const b = tokenize(targetText);
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  for (const token of a) {
    if (b.has(token)) overlap += 1;
  }
  const union = new Set([...a, ...b]).size;
  return Math.round((overlap / union) * 100);
}

export function formatZmw(amount: number, currencySymbol = 'K'): string {
  return `${currencySymbol}${Math.round(amount).toLocaleString('en-US')}`;
}

export function validateSandboxPaymentInput(params: {
  amountZmw: number;
  channel: 'MTN MoMo' | 'Airtel Money' | 'Zamtel Kwacha' | 'Zanaco Bank' | 'Visa / Mastercard';
  accountIdentifier: string;
}): { valid: boolean; error?: string } {
  if (!Number.isFinite(params.amountZmw) || params.amountZmw <= 0) {
    return { valid: false, error: 'Payment amount must be greater than K0.' };
  }
  const id = params.accountIdentifier.trim();
  if (!id) {
    return { valid: false, error: 'Please enter a mobile money number, bank account, or card reference.' };
  }
  if (
    (params.channel === 'MTN MoMo' ||
      params.channel === 'Airtel Money' ||
      params.channel === 'Zamtel Kwacha') &&
    !/^(09|07|\+?260)[0-9]{7,9}$/.test(id.replace(/\s+/g, ''))
  ) {
    return {
      valid: false,
      error: 'Enter a valid Zambian mobile number (e.g., 0977123456 or +260977123456).',
    };
  }
  return { valid: true };
}

export interface SearchGroundingSource {
  uri: string;
  title: string;
}

export interface MapsGroundingPlace {
  uri: string;
  title: string;
  snippets: string[];
}

export function parseZoneCoordinates(
  latitude: string | number,
  longitude: string | number,
): { lat: number; lng: number } | null {
  const lat = typeof latitude === 'number' ? latitude : Number.parseFloat(String(latitude));
  const lng = typeof longitude === 'number' ? longitude : Number.parseFloat(String(longitude));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export function extractSearchGroundingSources(chunks: unknown): SearchGroundingSource[] {
  if (!Array.isArray(chunks)) return [];
  const seen = new Set<string>();
  const sources: SearchGroundingSource[] = [];
  for (const chunk of chunks) {
    const web = (chunk as { web?: { uri?: string; title?: string } })?.web;
    if (web?.uri && typeof web.uri === 'string' && !seen.has(web.uri)) {
      seen.add(web.uri);
      sources.push({
        uri: web.uri,
        title: typeof web.title === 'string' && web.title.trim() ? web.title.trim() : web.uri,
      });
    }
  }
  return sources;
}

export function extractMapsGroundingPlaces(chunks: unknown): MapsGroundingPlace[] {
  if (!Array.isArray(chunks)) return [];
  const seen = new Set<string>();
  const places: MapsGroundingPlace[] = [];
  for (const chunk of chunks) {
    const maps = (
      chunk as {
        maps?: {
          uri?: string;
          title?: string;
          placeAnswerSources?: { reviewSnippets?: Array<{ content?: string }> };
        };
      }
    )?.maps;
    if (maps?.uri && typeof maps.uri === 'string' && !seen.has(maps.uri)) {
      seen.add(maps.uri);
      const snippets = (maps.placeAnswerSources?.reviewSnippets || [])
        .map((s) => (typeof s?.content === 'string' ? s.content.trim() : ''))
        .filter(Boolean)
        .slice(0, 3);
      places.push({
        uri: maps.uri,
        title: typeof maps.title === 'string' && maps.title.trim() ? maps.title.trim() : 'Google Maps Place',
        snippets,
      });
    }
  }
  return places;
}

// Blueprint-synchronized volumetric constants matching firebase-blueprint.json
export const FIRESTORE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
export const INSTITUTION_CODE_PATTERN = /^[A-Z0-9_-]+$/;
export const ALLOWED_LANGUAGES = ['English', 'Icibemba', 'Chinyanja', 'Chitonga'] as const;
export const ALLOWED_VOICE_NOTE_SOURCES = [
  'transcription',
  'live_voice',
  'search_grounding',
  'maps_grounding',
] as const;

export type OneGovLanguage = (typeof ALLOWED_LANGUAGES)[number];
export type VoiceNoteSourceType = (typeof ALLOWED_VOICE_NOTE_SOURCES)[number];

export function sanitizeFirestoreId(rawId: string): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  return cleaned && FIRESTORE_ID_PATTERN.test(cleaned) ? cleaned : `ogv-${Date.now()}`;
}

export function sanitizeSavedLocationInput(input: {
  ownerId: string;
  title: string;
  institutionCode: string;
  zoneCode?: string;
  mapsUri?: string;
  notes?: string;
  latitude: number;
  longitude: number;
}) {
  const ownerId = sanitizeFirestoreId(input.ownerId);
  const title = (input.title || 'Civic Location').trim().slice(0, 160) || 'Civic Location';
  const rawCode = (input.institutionCode || 'GOV').toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24);
  const institutionCode = rawCode.length >= 2 && INSTITUTION_CODE_PATTERN.test(rawCode) ? rawCode : 'GOV';
  const coords = parseZoneCoordinates(input.latitude, input.longitude) || { lat: -15.4167, lng: 28.2833 };

  const out: {
    ownerId: string;
    title: string;
    institutionCode: string;
    latitude: number;
    longitude: number;
    zoneCode?: string;
    mapsUri?: string;
    notes?: string;
  } = {
    ownerId,
    title,
    institutionCode,
    latitude: coords.lat,
    longitude: coords.lng,
  };

  if (input.zoneCode && input.zoneCode.trim()) {
    out.zoneCode = input.zoneCode.trim().slice(0, 40);
  }
  if (input.mapsUri && input.mapsUri.trim()) {
    out.mapsUri = input.mapsUri.trim().slice(0, 500);
  }
  if (input.notes && input.notes.trim()) {
    out.notes = input.notes.trim().slice(0, 500);
  }
  return out;
}

export function sanitizeVoiceNoteInput(input: {
  ownerId: string;
  title: string;
  transcript: string;
  sourceType: VoiceNoteSourceType;
  sourceUrl?: string;
}) {
  const ownerId = sanitizeFirestoreId(input.ownerId);
  const title = (input.title || 'OneGov Note').trim().slice(0, 160) || 'OneGov Note';
  const transcript = (input.transcript || 'Empty note').trim().slice(0, 4000) || 'Empty note';
  const sourceType: VoiceNoteSourceType = ALLOWED_VOICE_NOTE_SOURCES.includes(input.sourceType)
    ? input.sourceType
    : 'transcription';

  const out: {
    ownerId: string;
    title: string;
    transcript: string;
    sourceType: VoiceNoteSourceType;
    sourceUrl?: string;
  } = {
    ownerId,
    title,
    transcript,
    sourceType,
  };

  if (input.sourceUrl && input.sourceUrl.trim()) {
    out.sourceUrl = input.sourceUrl.trim().slice(0, 500);
  }
  return out;
}

export interface SearchableNavModule {
  id: string;
  label: string;
  keywords?: string;
}

export interface SearchableGovService {
  code: string;
  title: string;
  institutionCode: string;
  categoryName: string;
  description: string;
  feeZmw: number;
}

export function filterGlobalServiceNavigation<
  M extends SearchableNavModule,
  S extends SearchableGovService,
>(params: {
  query: string;
  modules: M[];
  services: S[];
  maxModules?: number;
  maxServices?: number;
}): { modules: M[]; services: S[] } {
  const q = params.query.trim().toLowerCase();
  const maxModules = params.maxModules ?? 8;
  const maxServices = params.maxServices ?? 6;

  if (!q) {
    return {
      modules: params.modules.slice(0, maxModules),
      services: [],
    };
  }

  const terms = q.split(/\s+/).filter(Boolean);

  const scoredModules = params.modules
    .map((m) => {
      const labelLower = m.label.toLowerCase();
      const idLower = m.id.toLowerCase();
      const kwLower = (m.keywords || '').toLowerCase();
      const haystack = `${labelLower} ${idLower} ${kwLower}`;
      const matchesAll = terms.every((t) => haystack.includes(t));
      if (!matchesAll) return null;
      let score = 1;
      if (labelLower.startsWith(q)) score = 4;
      else if (labelLower.includes(q)) score = 3;
      else if (kwLower.includes(q)) score = 2;
      return { item: m, score };
    })
    .filter((entry): entry is { item: M; score: number } => entry !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxModules)
    .map((e) => e.item);

  const scoredServices = params.services
    .map((s) => {
      const titleLower = s.title.toLowerCase();
      const codeLower = s.code.toLowerCase();
      const instLower = s.institutionCode.toLowerCase();
      const haystack = `${titleLower} ${codeLower} ${instLower} ${s.categoryName.toLowerCase()} ${s.description.toLowerCase()}`;
      const matchesAll = terms.every((t) => haystack.includes(t));
      if (!matchesAll) return null;
      let score = 1;
      if (titleLower.startsWith(q) || codeLower === q) score = 4;
      else if (titleLower.includes(q) || instLower === q) score = 3;
      else if (codeLower.includes(q)) score = 2;
      return { item: s, score };
    })
    .filter((entry): entry is { item: S; score: number } => entry !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxServices)
    .map((e) => e.item);

  return {
    modules: scoredModules,
    services: scoredServices,
  };
}

const SCREEN_DOMAIN_LABELS: Record<string, string> = {
  'citizen-dashboard': 'Citizen Portal',
  'business-dashboard': 'Business & SME',
  'service-directory': 'Citizen & SME Services',
  'application-workflow': 'Applications & OCR',
  'application-tracking': 'Applications & OCR',
  'payment-receipts': 'Payments & Ledger',
  transport: 'Vertical Services',
  property: 'Vertical Services',
  utilities: 'Vertical Services',
  education: 'Vertical Services',
  permits: 'Vertical Services',
  'ip-portal': 'PACRA IP Services',
  'council-dashboard': 'Revenue & GIS Intelligence',
  'zra-dashboard': 'National Revenue Oversight',
  'institution-portal': 'Institutional Operations',
  'reports-analytics': 'Audit & Compliance',
  'super-admin': 'Platform Administration',
  'ai-assistant': 'OneGov Intelligence',
  notifications: 'Workspace Alerts',
  'account-settings': 'Account & Security',
};

export function getScreenDomainLabel(screenId: string): string {
  return SCREEN_DOMAIN_LABELS[screenId] || 'Workspace';
}

export function updateBreadcrumbTrail<T extends string>(
  currentTrail: T[],
  nextScreen: T,
  options?: { resetToRoot?: boolean; maxLength?: number },
): T[] {
  if (nextScreen === 'welcome') {
    return [];
  }
  const maxLength = Math.max(2, options?.maxLength ?? 5);
  if (options?.resetToRoot || currentTrail.length === 0) {
    return [nextScreen];
  }
  if (currentTrail[currentTrail.length - 1] === nextScreen) {
    return currentTrail;
  }
  const existingIdx = currentTrail.indexOf(nextScreen);
  if (existingIdx !== -1) {
    return currentTrail.slice(0, existingIdx + 1);
  }
  if (currentTrail.length >= maxLength) {
    const root = currentTrail[0];
    const tail = currentTrail.slice(-(maxLength - 2));
    return [root, ...tail, nextScreen];
  }
  return [...currentTrail, nextScreen];
}


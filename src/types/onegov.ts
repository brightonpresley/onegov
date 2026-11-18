import type { UserRole, RoleMetadata } from '../lib/onegovRules';

export type ScreenId =
  | 'welcome'
  | 'citizen-dashboard'
  | 'business-dashboard'
  | 'service-directory'
  | 'application-workflow'
  | 'application-tracking'
  | 'payment-receipts'
  | 'ai-assistant'
  | 'transport'
  | 'property'
  | 'utilities'
  | 'education'
  | 'permits'
  | 'ip-portal'
  | 'council-dashboard'
  | 'zra-dashboard'
  | 'institution-portal'
  | 'super-admin'
  | 'reports-analytics'
  | 'notifications'
  | 'account-settings';

export interface InstitutionItem {
  id: number;
  code: string;
  name: string;
  type: string;
  province: string;
  status: string;
  integrationMode: string;
  description: string;
}

export interface ServiceItem {
  id: number;
  institutionId: number;
  categoryId: number;
  code: string;
  title: string;
  description: string;
  feeZmw: number;
  slaDays: number;
  requirementsJson: string[];
  workflowStepsJson: string[];
  institutionCode: string;
  institutionName: string;
  categorySlug: string;
  categoryName: string;
  moduleKey: string;
}

export interface UserProfile {
  id: number;
  uid: string;
  email: string;
  fullName: string;
  phone: string | null;
  nrcNumber: string | null;
  role: UserRole;
  institutionId: number | null;
  institutionCode: string | null;
  mfaEnabled: boolean;
  lowDataMode: boolean;
  preferredLanguage: string;
  consentAccepted: boolean;
  isDemo: boolean;
}

export interface VehicleItem {
  id: number;
  plateNumber: string;
  makeModel: string;
  year: number;
  engineCc: number;
  vehicleClass: string;
  roadTaxExpiresAt: string;
  insuranceProvider: string;
  insuranceExpiresAt: string;
}

export interface PropertyItem {
  id: number;
  plotNumber: string;
  councilName: string;
  wardCode: string;
  propertyType: string;
  assessedValueZmw: number;
  annualRatesZmw: number;
  outstandingZmw: number;
}

export interface UtilityAccountItem {
  id: number;
  providerCode: string;
  meterNumber: string;
  accountLabel: string;
  tariffType: string;
  outstandingBalanceZmw: number;
  lastToken: string | null;
}

export interface EducationAccountItem {
  id: number;
  studentId: string;
  studentName: string;
  schoolName: string;
  program: string;
  termBalanceZmw: number;
}

export interface BusinessItem {
  id: number;
  name: string;
  tpin: string;
  pacraRegNo: string;
  sector: string;
  councilArea: string;
  wardCode: string;
  employeesCount: number;
  complianceStatus: string;
}

export interface ApplicationItem {
  id: number;
  referenceCode: string;
  serviceId: number;
  institutionId: number;
  serviceTitle: string;
  serviceCode: string;
  institutionCode: string;
  institutionName: string;
  status: string;
  currentStep: string;
  formDataJson: Record<string, unknown>;
  aiCompletenessScore: number;
  reviewerNotes: string | null;
  createdAt: string;
}

export interface PaymentItem {
  id: number;
  referenceCode: string;
  receiptNumber: string;
  institutionId: number;
  institutionCode: string;
  institutionName: string;
  serviceCode: string;
  serviceTitle: string;
  amountZmw: number;
  channel: string;
  providerRef: string;
  status: string;
  reconciliationStatus: string;
  province: string;
  councilName: string;
  wardCode: string;
  paperPagesSaved: number;
  createdAt: string;
  generatedElectricToken?: string | null;
}

export interface NotificationItem {
  id: number;
  channel: string;
  category: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface RevenueZoneItem {
  id: number;
  zoneCode: string;
  name: string;
  zoneType: string;
  province: string;
  district: string;
  councilName: string;
  institutionCode: string;
  expectedRevenueZmw: number;
  actualRevenueZmw: number;
  registeredBusinesses: number;
  activePermits: number;
  unpaidProperties: number;
  latitude: string;
  longitude: string;
  mapX: number;
  mapY: number;
  indicatorsJson: string[];
  metrics: {
    performancePct: number;
    revenueGapZmw: number;
    permitCoveragePct: number;
    status: 'critical' | 'attention' | 'nominal';
  };
}

export interface InvestigationItem {
  id: number;
  caseCode: string;
  zoneId: number;
  zoneName: string;
  zoneCode: string;
  councilName: string;
  title: string;
  status: string;
  priority: string;
  confirmedFindingsJson: string[];
  possibleExplanationsJson: string[];
  furtherInvestigationJson: string[];
  officerNotes: string | null;
  createdAt: string;
}

export interface IpApplicationItem {
  id: number;
  referenceCode: string;
  ipType: 'patent' | 'trademark';
  title: string;
  description: string;
  classification: string;
  status: string;
  similarityReportJson: {
    overallComparisonSummary?: string;
    topMatches?: Array<{ reference: string; title: string; similarityPct: number; overlapNotes: string }>;
    matches?: Array<{ reference: string; title: string; similarityPct: number; overlapNotes: string }>;
    disclaimer?: string;
  } | null;
  createdAt: string;
}

export interface RegionalConfig {
  country: string;
  countryCode: string;
  currencyCode: string;
  currencySymbol: string;
  defaultLanguage: string;
  supportedLanguages?: Array<{ code: string; label: string }>;
  greenerZambiaEnabled?: boolean;
}

export interface PaymentCheckoutContext {
  serviceCode: string;
  serviceTitle: string;
  amountZmw: number;
  province?: string;
  councilName?: string;
  wardCode?: string;
  propertyId?: number;
  utilityId?: number;
  educationId?: number;
}

export interface CitizenOverviewData {
  vehicles: VehicleItem[];
  properties: PropertyItem[];
  utilities: UtilityAccountItem[];
  education: EducationAccountItem[];
  businesses: BusinessItem[];
  applications: ApplicationItem[];
  payments: PaymentItem[];
  notifications: NotificationItem[];
  greenerImpact: {
    digitalTransactionsCount: number;
    paperSheetsSaved: number;
    co2GramsAvoided: number;
    officeTripsAvoided: number;
  };
}

export type RoleMetaMap = Record<UserRole, RoleMetadata>;

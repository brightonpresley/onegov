import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const institutions = pgTable('institutions', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  province: text('province').notNull().default('Lusaka'),
  status: text('status').notNull().default('active'),
  integrationMode: text('integration_mode').notNull().default('sandbox'),
  description: text('description').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  fullName: text('full_name').notNull(),
  phone: text('phone'),
  nrcNumber: text('nrc_number'),
  role: text('role').notNull().default('citizen'),
  institutionId: integer('institution_id').references(() => institutions.id),
  mfaEnabled: boolean('mfa_enabled').notNull().default(false),
  lowDataMode: boolean('low_data_mode').notNull().default(false),
  preferredLanguage: text('preferred_language').notNull().default('en'),
  consentAccepted: boolean('consent_accepted').notNull().default(true),
  verified: boolean('verified').notNull().default(true),
  isDemo: boolean('is_demo').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const serviceCategories = pgTable('service_categories', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  moduleKey: text('module_key').notNull(),
  description: text('description').notNull(),
});

export const services = pgTable('services', {
  id: serial('id').primaryKey(),
  institutionId: integer('institution_id')
    .references(() => institutions.id)
    .notNull(),
  categoryId: integer('category_id')
    .references(() => serviceCategories.id)
    .notNull(),
  code: text('code').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  feeZmw: integer('fee_zmw').notNull(),
  slaDays: integer('sla_days').notNull().default(3),
  requirementsJson: jsonb('requirements_json').$type<string[]>().notNull(),
  workflowStepsJson: jsonb('workflow_steps_json').$type<string[]>().notNull(),
  isActive: boolean('is_active').notNull().default(true),
  isDemo: boolean('is_demo').notNull().default(true),
});

export const businesses = pgTable('businesses', {
  id: serial('id').primaryKey(),
  ownerUserId: integer('owner_user_id')
    .references(() => users.id)
    .notNull(),
  name: text('name').notNull(),
  tpin: text('tpin').notNull(),
  pacraRegNo: text('pacra_reg_no').notNull(),
  sector: text('sector').notNull(),
  councilArea: text('council_area').notNull(),
  wardCode: text('ward_code').notNull(),
  employeesCount: integer('employees_count').notNull().default(1),
  complianceStatus: text('compliance_status').notNull().default('active'),
  isDemo: boolean('is_demo').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const vehicles = pgTable('vehicles', {
  id: serial('id').primaryKey(),
  ownerUserId: integer('owner_user_id')
    .references(() => users.id)
    .notNull(),
  plateNumber: text('plate_number').notNull(),
  makeModel: text('make_model').notNull(),
  year: integer('year').notNull(),
  engineCc: integer('engine_cc').notNull(),
  vehicleClass: text('vehicle_class').notNull().default('Private Motor Car'),
  roadTaxExpiresAt: text('road_tax_expires_at').notNull(),
  insuranceProvider: text('insurance_provider').notNull(),
  insuranceExpiresAt: text('insurance_expires_at').notNull(),
  isDemo: boolean('is_demo').notNull().default(true),
});

export const properties = pgTable('properties', {
  id: serial('id').primaryKey(),
  ownerUserId: integer('owner_user_id')
    .references(() => users.id)
    .notNull(),
  plotNumber: text('plot_number').notNull(),
  councilName: text('council_name').notNull(),
  wardCode: text('ward_code').notNull(),
  propertyType: text('property_type').notNull(),
  assessedValueZmw: integer('assessed_value_zmw').notNull(),
  annualRatesZmw: integer('annual_rates_zmw').notNull(),
  outstandingZmw: integer('outstanding_zmw').notNull().default(0),
  isDemo: boolean('is_demo').notNull().default(true),
});

export const utilityAccounts = pgTable('utility_accounts', {
  id: serial('id').primaryKey(),
  ownerUserId: integer('owner_user_id')
    .references(() => users.id)
    .notNull(),
  providerCode: text('provider_code').notNull().default('ZESCO'),
  meterNumber: text('meter_number').notNull(),
  accountLabel: text('account_label').notNull(),
  tariffType: text('tariff_type').notNull().default('Residential R1'),
  outstandingBalanceZmw: integer('outstanding_balance_zmw').notNull().default(0),
  lastToken: text('last_token'),
  isDemo: boolean('is_demo').notNull().default(true),
});

export const educationAccounts = pgTable('education_accounts', {
  id: serial('id').primaryKey(),
  ownerUserId: integer('owner_user_id')
    .references(() => users.id)
    .notNull(),
  institutionId: integer('institution_id')
    .references(() => institutions.id)
    .notNull(),
  studentId: text('student_id').notNull(),
  studentName: text('student_name').notNull(),
  schoolName: text('school_name').notNull(),
  program: text('program').notNull(),
  termBalanceZmw: integer('term_balance_zmw').notNull().default(0),
  isDemo: boolean('is_demo').notNull().default(true),
});

export const applications = pgTable('applications', {
  id: serial('id').primaryKey(),
  referenceCode: text('reference_code').notNull().unique(),
  applicantUserId: integer('applicant_user_id')
    .references(() => users.id)
    .notNull(),
  businessId: integer('business_id').references(() => businesses.id),
  serviceId: integer('service_id')
    .references(() => services.id)
    .notNull(),
  institutionId: integer('institution_id')
    .references(() => institutions.id)
    .notNull(),
  status: text('status').notNull().default('submitted'),
  currentStep: text('current_step').notNull().default('Institution Review'),
  formDataJson: jsonb('form_data_json').$type<Record<string, unknown>>().notNull(),
  aiCompletenessScore: integer('ai_completeness_score').notNull().default(100),
  reviewerNotes: text('reviewer_notes'),
  reviewedByUserId: integer('reviewed_by_user_id').references(() => users.id),
  isDemo: boolean('is_demo').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const applicationDocuments = pgTable('application_documents', {
  id: serial('id').primaryKey(),
  applicationId: integer('application_id')
    .references(() => applications.id)
    .notNull(),
  fileName: text('file_name').notNull(),
  docType: text('doc_type').notNull(),
  ocrSummary: text('ocr_summary').notNull(),
  extractedJson: jsonb('extracted_json').$type<Record<string, unknown>>().notNull(),
  validationStatus: text('validation_status').notNull().default('verified'),
  uploadedAt: timestamp('uploaded_at').defaultNow(),
});

export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  referenceCode: text('reference_code').notNull().unique(),
  receiptNumber: text('receipt_number').notNull().unique(),
  payerUserId: integer('payer_user_id')
    .references(() => users.id)
    .notNull(),
  institutionId: integer('institution_id')
    .references(() => institutions.id)
    .notNull(),
  applicationId: integer('application_id').references(() => applications.id),
  serviceCode: text('service_code').notNull(),
  serviceTitle: text('service_title').notNull(),
  amountZmw: integer('amount_zmw').notNull(),
  channel: text('channel').notNull(),
  providerRef: text('provider_ref').notNull(),
  status: text('status').notNull().default('verified'),
  reconciliationStatus: text('reconciliation_status').notNull().default('reconciled'),
  province: text('province').notNull().default('Lusaka'),
  councilName: text('council_name').notNull().default('Lusaka City Council'),
  wardCode: text('ward_code').notNull().default('LSK-W04'),
  paperPagesSaved: integer('paper_pages_saved').notNull().default(4),
  isDemo: boolean('is_demo').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const revenueZones = pgTable('revenue_zones', {
  id: serial('id').primaryKey(),
  zoneCode: text('zone_code').notNull().unique(),
  name: text('name').notNull(),
  zoneType: text('zone_type').notNull(),
  province: text('province').notNull(),
  district: text('district').notNull(),
  councilName: text('council_name').notNull(),
  institutionId: integer('institution_id')
    .references(() => institutions.id)
    .notNull(),
  expectedRevenueZmw: integer('expected_revenue_zmw').notNull(),
  actualRevenueZmw: integer('actual_revenue_zmw').notNull(),
  registeredBusinesses: integer('registered_businesses').notNull(),
  activePermits: integer('active_permits').notNull(),
  unpaidProperties: integer('unpaid_properties').notNull(),
  latitude: text('latitude').notNull(),
  longitude: text('longitude').notNull(),
  mapX: integer('map_x').notNull(),
  mapY: integer('map_y').notNull(),
  indicatorsJson: jsonb('indicators_json').$type<string[]>().notNull(),
  isDemo: boolean('is_demo').notNull().default(true),
});

export const investigations = pgTable('investigations', {
  id: serial('id').primaryKey(),
  caseCode: text('case_code').notNull().unique(),
  zoneId: integer('zone_id')
    .references(() => revenueZones.id)
    .notNull(),
  assignedOfficerId: integer('assigned_officer_id').references(() => users.id),
  title: text('title').notNull(),
  status: text('status').notNull().default('open'),
  priority: text('priority').notNull().default('high'),
  confirmedFindingsJson: jsonb('confirmed_findings_json').$type<string[]>().notNull(),
  possibleExplanationsJson: jsonb('possible_explanations_json').$type<string[]>().notNull(),
  furtherInvestigationJson: jsonb('further_investigation_json').$type<string[]>().notNull(),
  officerNotes: text('officer_notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const ipApplications = pgTable('ip_applications', {
  id: serial('id').primaryKey(),
  referenceCode: text('reference_code').notNull().unique(),
  applicantUserId: integer('applicant_user_id')
    .references(() => users.id)
    .notNull(),
  institutionId: integer('institution_id')
    .references(() => institutions.id)
    .notNull(),
  ipType: text('ip_type').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  classification: text('classification').notNull(),
  status: text('status').notNull().default('submitted'),
  similarityReportJson: jsonb('similarity_report_json').$type<Record<string, unknown>>(),
  reviewedByUserId: integer('reviewed_by_user_id').references(() => users.id),
  isDemo: boolean('is_demo').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const fraudAlerts = pgTable('fraud_alerts', {
  id: serial('id').primaryKey(),
  alertCode: text('alert_code').notNull().unique(),
  institutionId: integer('institution_id').references(() => institutions.id),
  paymentId: integer('payment_id').references(() => payments.id),
  category: text('category').notNull(),
  severity: text('severity').notNull(),
  description: text('description').notNull(),
  status: text('status').notNull().default('flagged'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  channel: text('channel').notNull().default('in_app'),
  category: text('category').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  actorUid: text('actor_uid').notNull(),
  actorRole: text('actor_role').notNull(),
  institutionCode: text('institution_code'),
  action: text('action').notNull(),
  targetEntity: text('target_entity').notNull(),
  details: text('details').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const platformConfig = pgTable('platform_config', {
  id: serial('id').primaryKey(),
  configKey: text('config_key').notNull().unique(),
  configValueJson: jsonb('config_value_json').$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  institution: one(institutions, {
    fields: [users.institutionId],
    references: [institutions.id],
  }),
  applications: many(applications),
  payments: many(payments),
}));

export const applicationsRelations = relations(applications, ({ one, many }) => ({
  applicant: one(users, {
    fields: [applications.applicantUserId],
    references: [users.id],
  }),
  service: one(services, {
    fields: [applications.serviceId],
    references: [services.id],
  }),
  institution: one(institutions, {
    fields: [applications.institutionId],
    references: [institutions.id],
  }),
  documents: many(applicationDocuments),
}));

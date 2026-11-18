import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { desc, eq, and } from 'drizzle-orm';
import { createServer as createViteServer } from 'vite';
import { db } from './src/db/index.ts';
import {
  applicationDocuments,
  applications,
  auditLogs,
  businesses,
  educationAccounts,
  fraudAlerts,
  institutions,
  investigations,
  ipApplications,
  notifications,
  payments,
  platformConfig,
  properties,
  revenueZones,
  serviceCategories,
  services,
  users,
  utilityAccounts,
  vehicles,
} from './src/db/schema.ts';
import { ensureSeedData } from './src/db/seed.ts';
import { WebSocketServer, type WebSocket } from 'ws';
import { Modality, type LiveServerMessage } from '@google/genai';
import { adminAuth } from './src/lib/firebase-admin.ts';
import { AuthRequest, requireAuth, signDemoToken, verifyDemoToken } from './src/middleware/auth.ts';
import {
  ROLE_DEFINITIONS,
  UserRole,
  calculateGreenerZambiaImpact,
  calculateIllustrativeRoadTax,
  canApproveInstitutionalDecision,
  computeTextSimilarityScore,
  evaluateRevenueZone,
  validateSandboxPaymentInput,
} from './src/lib/onegovRules.ts';
import {
  analyzeCouncilRevenueZone,
  analyzeDocumentOcr,
  analyzeIpSimilarity,
  askOneGovAssistant,
  askWithSearchGrounding,
  findCivicLocationsWithMapsGrounding,
  generatePredictiveInsights,
  getGeminiClient,
  transcribeAudioBase64,
} from './src/services/geminiAi.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));

// Simple in-memory rate limiter for API protection
const requestBuckets = new Map<string, { count: number; resetAt: number }>();
app.use('/api', (req, res, next) => {
  const key = req.ip || 'local';
  const now = Date.now();
  const bucket = requestBuckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    requestBuckets.set(key, { count: 1, resetAt: now + 60_000 });
    return next();
  }
  bucket.count += 1;
  if (bucket.count > 300) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please wait briefly.' });
  }
  return next();
});

async function writeAuditLog(params: {
  actorUid: string;
  actorRole: string;
  institutionCode?: string | null;
  action: string;
  targetEntity: string;
  details: string;
}) {
  try {
    await db.insert(auditLogs).values({
      actorUid: params.actorUid,
      actorRole: params.actorRole,
      institutionCode: params.institutionCode ?? null,
      action: params.action,
      targetEntity: params.targetEntity,
      details: params.details,
    });
  } catch (err) {
    console.error('Audit log insert failed:', err);
  }
}

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'OneGov Zambia Digital Government Ecosystem',
    mode: 'DEMO_SANDBOX_ENABLED',
  });
});

// Public service directory & non-sensitive institutional catalog
app.get('/api/public/overview', async (_req, res) => {
  try {
    await ensureSeedData();
    const [instRows, catRows, svcRows, cfgRows] = await Promise.all([
      db.select().from(institutions).orderBy(institutions.id),
      db.select().from(serviceCategories).orderBy(serviceCategories.id),
      db.select().from(services).orderBy(services.id),
      db.select().from(platformConfig).where(eq(platformConfig.configKey, 'regional_profile')),
    ]);

    const instMap = new Map(instRows.map((i) => [i.id, i]));
    const catMap = new Map(catRows.map((c) => [c.id, c]));

    res.json({
      institutions: instRows,
      categories: catRows,
      services: svcRows.map((s) => ({
        ...s,
        institutionCode: instMap.get(s.institutionId)?.code ?? 'GOV',
        institutionName: instMap.get(s.institutionId)?.name ?? 'Government Institution',
        categorySlug: catMap.get(s.categoryId)?.slug ?? 'general',
        categoryName: catMap.get(s.categoryId)?.name ?? 'General',
        moduleKey: catMap.get(s.categoryId)?.moduleKey ?? 'citizen',
      })),
      regionalConfig: cfgRows[0]?.configValueJson ?? {
        country: 'Zambia',
        currencySymbol: 'K',
        currencyCode: 'ZMW',
      },
      roles: Object.values(ROLE_DEFINITIONS),
    });
  } catch (error) {
    console.error('Failed to load public catalog:', error);
    res.status(500).json({ error: 'Unable to load government service catalog.' });
  }
});

// Issue HMAC-signed Demo Sandbox session for any of the 12 Demo Personas
app.post('/api/demo/session', async (req, res) => {
  try {
    await ensureSeedData();
    const requestedRole = (req.body?.role as UserRole) || 'citizen';
    if (!ROLE_DEFINITIONS[requestedRole]) {
      return res.status(400).json({ error: 'Unsupported role specified.' });
    }
    const demoUid = `demo:${requestedRole}`;
    const userRows = await db.select().from(users).where(eq(users.uid, demoUid)).limit(1);
    const user = userRows[0];
    if (!user) {
      return res.status(404).json({ error: 'Demo persona not found.' });
    }
    let institutionCode: string | null = null;
    if (user.institutionId) {
      const instRows = await db
        .select({ code: institutions.code })
        .from(institutions)
        .where(eq(institutions.id, user.institutionId))
        .limit(1);
      institutionCode = instRows[0]?.code ?? null;
    }
    const token = signDemoToken(user.uid, requestedRole);
    await writeAuditLog({
      actorUid: user.uid,
      actorRole: requestedRole,
      institutionCode,
      action: 'DEMO_SESSION_LOGIN',
      targetEntity: user.uid,
      details: `Signed into Demo Sandbox as ${ROLE_DEFINITIONS[requestedRole].label}.`,
    });

    res.json({
      token,
      user: {
        id: user.id,
        uid: user.uid,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        nrcNumber: user.nrcNumber,
        role: user.role,
        institutionId: user.institutionId,
        institutionCode,
        mfaEnabled: user.mfaEnabled,
        lowDataMode: user.lowDataMode,
        preferredLanguage: user.preferredLanguage,
        consentAccepted: user.consentAccepted,
        isDemo: true,
      },
      roleMeta: ROLE_DEFINITIONS[requestedRole],
    });
  } catch (error) {
    console.error('Demo session failed:', error);
    res.status(500).json({ error: 'Failed to start demo session.' });
  }
});

// Demo Citizen / Business registration endpoint
app.post('/api/demo/register', async (req, res) => {
  try {
    await ensureSeedData();
    const fullName = String(req.body?.fullName || '').trim();
    const email = String(req.body?.email || '').trim();
    const phone = String(req.body?.phone || '').trim();
    const nrcNumber = String(req.body?.nrcNumber || '').trim();
    const accountType = req.body?.accountType === 'small_business_owner' ? 'small_business_owner' : 'citizen';
    const businessName = String(req.body?.businessName || '').trim();
    const sector = String(req.body?.sector || 'Retail & Commerce').trim();

    if (!fullName || !email) {
      return res.status(400).json({ error: 'Full name and email are required for registration.' });
    }

    const uid = `demo:reg:${Date.now()}`;
    const inserted = await db
      .insert(users)
      .values({
        uid,
        email,
        fullName,
        phone: phone || '+260977000000',
        nrcNumber: nrcNumber || '100000/10/1',
        role: accountType,
        verified: true,
        isDemo: true,
      })
      .returning();

    const createdUser = inserted[0];

    if (accountType === 'small_business_owner' && businessName) {
      await db.insert(businesses).values({
        ownerUserId: createdUser.id,
        name: businessName,
        tpin: `100${Math.floor(1000000 + Math.random() * 8999999)}`,
        pacraRegNo: `12026${Math.floor(1000000 + Math.random() * 8999999)}`,
        sector,
        councilArea: 'Lusaka City Council',
        wardCode: 'LSK-W12',
        employeesCount: 3,
        complianceStatus: 'active',
        isDemo: true,
      });
    }

    await db.insert(notifications).values({
      userId: createdUser.id,
      channel: 'in_app',
      category: 'onboarding',
      title: 'Welcome to OneGov Zambia (Demo Account)',
      message: `Your unified OneGov ${accountType === 'small_business_owner' ? 'SME Business' : 'Citizen'} profile is active.`,
      isRead: false,
    });

    const token = signDemoToken(createdUser.uid, accountType);
    res.status(201).json({
      token,
      user: {
        ...createdUser,
        institutionCode: null,
      },
      roleMeta: ROLE_DEFINITIONS[accountType],
    });
  } catch (error) {
    console.error('Demo registration failed:', error);
    res.status(500).json({ error: 'Failed to register demo account.' });
  }
});

// Authenticated user profile + settings
app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSeedData();
    const actor = req.actor!;
    const userRows = await db.select().from(users).where(eq(users.id, actor.dbUserId)).limit(1);
    const user = userRows[0];
    const notifs = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, actor.dbUserId))
      .orderBy(desc(notifications.createdAt));

    res.json({
      user: {
        ...user,
        institutionCode: actor.institutionCode,
      },
      roleMeta: ROLE_DEFINITIONS[actor.role],
      unreadNotifications: notifs.filter((n) => !n.isRead).length,
      notifications: notifs,
    });
  } catch (error) {
    console.error('Failed to fetch user profile:', error);
    res.status(500).json({ error: 'Failed to load authenticated profile.' });
  }
});

app.patch('/api/account/settings', requireAuth, async (req: AuthRequest, res) => {
  try {
    const actor = req.actor!;
    const updates: Partial<typeof users.$inferInsert> = {};
    if (typeof req.body?.mfaEnabled === 'boolean') updates.mfaEnabled = req.body.mfaEnabled;
    if (typeof req.body?.lowDataMode === 'boolean') updates.lowDataMode = req.body.lowDataMode;
    if (typeof req.body?.consentAccepted === 'boolean') updates.consentAccepted = req.body.consentAccepted;
    if (typeof req.body?.preferredLanguage === 'string') updates.preferredLanguage = req.body.preferredLanguage;

    const updated = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, actor.dbUserId))
      .returning();

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      institutionCode: actor.institutionCode,
      action: 'UPDATE_SECURITY_SETTINGS',
      targetEntity: `user:${actor.dbUserId}`,
      details: `Updated account preferences (${Object.keys(updates).join(', ')}).`,
    });

    res.json({ user: updated[0] });
  } catch (error) {
    console.error('Settings update error:', error);
    res.status(500).json({ error: 'Failed to update settings.' });
  }
});

// Citizen & Business Personal Workspace Data
app.get('/api/citizen/overview', requireAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSeedData();
    const actor = req.actor!;
    // In Demo Sandbox, if a role user has no personal vehicles/properties yet, surface demo citizen records read-only or owned records
    const [
      userVehicles,
      userProperties,
      userUtilities,
      userEducation,
      userBusinesses,
      userApps,
      userPayments,
      userNotifs,
      instRows,
      svcRows,
    ] = await Promise.all([
      db.select().from(vehicles).where(eq(vehicles.ownerUserId, actor.dbUserId)),
      db.select().from(properties).where(eq(properties.ownerUserId, actor.dbUserId)),
      db.select().from(utilityAccounts).where(eq(utilityAccounts.ownerUserId, actor.dbUserId)),
      db.select().from(educationAccounts).where(eq(educationAccounts.ownerUserId, actor.dbUserId)),
      db.select().from(businesses).where(eq(businesses.ownerUserId, actor.dbUserId)),
      db.select().from(applications).where(eq(applications.applicantUserId, actor.dbUserId)).orderBy(desc(applications.createdAt)),
      db.select().from(payments).where(eq(payments.payerUserId, actor.dbUserId)).orderBy(desc(payments.createdAt)),
      db.select().from(notifications).where(eq(notifications.userId, actor.dbUserId)).orderBy(desc(notifications.createdAt)),
      db.select().from(institutions),
      db.select().from(services),
    ]);

    // If newly signed-in Google user has empty demo portfolio, also expose sample demo reference items clearly tagged
    let effectiveVehicles = userVehicles;
    let effectiveProperties = userProperties;
    let effectiveUtilities = userUtilities;
    let effectiveEducation = userEducation;
    if (
      effectiveVehicles.length === 0 &&
      effectiveProperties.length === 0 &&
      effectiveUtilities.length === 0 &&
      actor.role === 'citizen'
    ) {
      const demoCit = await db.select().from(users).where(eq(users.uid, 'demo:citizen')).limit(1);
      if (demoCit[0] && demoCit[0].id !== actor.dbUserId) {
        [effectiveVehicles, effectiveProperties, effectiveUtilities, effectiveEducation] = await Promise.all([
          db.select().from(vehicles).where(eq(vehicles.ownerUserId, demoCit[0].id)),
          db.select().from(properties).where(eq(properties.ownerUserId, demoCit[0].id)),
          db.select().from(utilityAccounts).where(eq(utilityAccounts.ownerUserId, demoCit[0].id)),
          db.select().from(educationAccounts).where(eq(educationAccounts.ownerUserId, demoCit[0].id)),
        ]);
      }
    }

    const instMap = new Map(instRows.map((i) => [i.id, i]));
    const svcMap = new Map(svcRows.map((s) => [s.id, s]));

    const greenerImpact = calculateGreenerZambiaImpact(userPayments.length, userApps.length);

    res.json({
      vehicles: effectiveVehicles,
      properties: effectiveProperties,
      utilities: effectiveUtilities,
      education: effectiveEducation,
      businesses: userBusinesses,
      applications: userApps.map((a) => ({
        ...a,
        serviceTitle: svcMap.get(a.serviceId)?.title ?? 'Government Service',
        serviceCode: svcMap.get(a.serviceId)?.code ?? 'GOV-SVC',
        institutionCode: instMap.get(a.institutionId)?.code ?? 'GOV',
        institutionName: instMap.get(a.institutionId)?.name ?? 'Institution',
      })),
      payments: userPayments.map((p) => ({
        ...p,
        institutionCode: instMap.get(p.institutionId)?.code ?? 'GOV',
        institutionName: instMap.get(p.institutionId)?.name ?? 'Institution',
      })),
      notifications: userNotifs,
      greenerImpact,
    });
  } catch (error) {
    console.error('Citizen overview error:', error);
    res.status(500).json({ error: 'Failed to load workspace overview.' });
  }
});

// Register a business entity under OneGov Business
app.post('/api/businesses', requireAuth, async (req: AuthRequest, res) => {
  try {
    const actor = req.actor!;
    const name = String(req.body?.name || '').trim();
    const sector = String(req.body?.sector || '').trim();
    const councilArea = String(req.body?.councilArea || 'Lusaka City Council').trim();
    const wardCode = String(req.body?.wardCode || 'LSK-W12').trim();
    const employeesCount = Math.max(1, Number(req.body?.employeesCount) || 1);

    if (!name || !sector) {
      return res.status(400).json({ error: 'Business name and sector are required.' });
    }

    const inserted = await db
      .insert(businesses)
      .values({
        ownerUserId: actor.dbUserId,
        name,
        tpin: String(req.body?.tpin || `100${Math.floor(1000000 + Math.random() * 8999999)}`),
        pacraRegNo: String(req.body?.pacraRegNo || `12026${Math.floor(1000000 + Math.random() * 8999999)}`),
        sector,
        councilArea,
        wardCode,
        employeesCount,
        complianceStatus: 'active',
        isDemo: true,
      })
      .returning();

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      action: 'REGISTER_DEMO_BUSINESS',
      targetEntity: inserted[0].name,
      details: `Registered demo SME business in ${councilArea} (${wardCode}).`,
    });

    res.status(201).json({ business: inserted[0] });
  } catch (error) {
    console.error('Business creation error:', error);
    res.status(500).json({ error: 'Failed to register business.' });
  }
});

// Transport Road Tax illustrative quote
app.post('/api/transport/road-tax/quote', requireAuth, async (req: AuthRequest, res) => {
  const engineCc = Number(req.body?.engineCc) || 1800;
  const vehicleClass = req.body?.vehicleClass || 'Private Motor Car';
  const quarters = ([1, 2, 4].includes(Number(req.body?.quarters)) ? Number(req.body?.quarters) : 1) as 1 | 2 | 4;
  const quote = calculateIllustrativeRoadTax({
    engineCc,
    vehicleClass,
    quarters,
  });
  res.json({ quote });
});

// Submit an Application into the configurable workflow engine
app.post('/api/applications', requireAuth, async (req: AuthRequest, res) => {
  try {
    const actor = req.actor!;
    const serviceCode = String(req.body?.serviceCode || '').trim();
    const formData = (req.body?.formData || {}) as Record<string, unknown>;
    const businessId = req.body?.businessId ? Number(req.body.businessId) : null;
    const documentName = req.body?.documentName ? String(req.body.documentName) : null;
    const ocrSummary = req.body?.ocrSummary ? String(req.body.ocrSummary) : null;
    const extractedFields = (req.body?.extractedFields || {}) as Record<string, unknown>;
    const aiCompletenessScore = Math.min(100, Math.max(0, Number(req.body?.aiCompletenessScore) || 95));

    const svcRows = await db.select().from(services).where(eq(services.code, serviceCode)).limit(1);
    const service = svcRows[0];
    if (!service) {
      return res.status(404).json({ error: 'Selected government service was not found.' });
    }

    const instRows = await db
      .select()
      .from(institutions)
      .where(eq(institutions.id, service.institutionId))
      .limit(1);
    const inst = instRows[0];

    const referenceCode = `OGV-APP-2026-${Math.floor(1000 + Math.random() * 8999)}`;
    const steps = Array.isArray(service.workflowStepsJson) ? service.workflowStepsJson : ['Submitted', 'Institution Review'];
    const currentStep = steps[1] || steps[0] || 'Institution Review';

    const inserted = await db
      .insert(applications)
      .values({
        referenceCode,
        applicantUserId: actor.dbUserId,
        businessId,
        serviceId: service.id,
        institutionId: service.institutionId,
        status: 'submitted',
        currentStep,
        formDataJson: formData,
        aiCompletenessScore,
        isDemo: true,
      })
      .returning();

    const appRecord = inserted[0];

    if (documentName) {
      await db.insert(applicationDocuments).values({
        applicationId: appRecord.id,
        fileName: documentName,
        docType: 'Supporting Application Document',
        ocrSummary: ocrSummary || 'Verified supporting document uploaded via OneGov Document Intelligence.',
        extractedJson: extractedFields,
        validationStatus: 'verified',
      });
    }

    await db.insert(notifications).values({
      userId: actor.dbUserId,
      channel: 'in_app',
      category: 'application_update',
      title: `Application ${referenceCode} Submitted`,
      message: `Your application for ${service.title} has been routed to ${inst?.name ?? 'the participating institution'}.`,
      isRead: false,
    });

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      institutionCode: inst?.code,
      action: 'SUBMIT_APPLICATION',
      targetEntity: referenceCode,
      details: `Submitted ${service.title} to ${inst?.code}.`,
    });

    res.status(201).json({
      application: {
        ...appRecord,
        serviceTitle: service.title,
        serviceCode: service.code,
        institutionCode: inst?.code ?? 'GOV',
        institutionName: inst?.name ?? 'Institution',
      },
    });
  } catch (error) {
    console.error('Application submission error:', error);
    res.status(500).json({ error: 'Failed to submit application.' });
  }
});

// Authorised Institutional Officer Review (Strict Institutional Isolation & Human Authority)
app.post('/api/applications/:id/review', requireAuth, async (req: AuthRequest, res) => {
  try {
    const actor = req.actor!;
    const appId = Number(req.params.id);
    const decision = String(req.body?.decision || '');
    const reviewerNotes = String(req.body?.reviewerNotes || '').trim();

    if (!['approved', 'rejected', 'additional_info_requested'].includes(decision)) {
      return res.status(400).json({ error: 'Invalid review decision.' });
    }

    const appRows = await db.select().from(applications).where(eq(applications.id, appId)).limit(1);
    const application = appRows[0];
    if (!application) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    const instRows = await db
      .select()
      .from(institutions)
      .where(eq(institutions.id, application.institutionId))
      .limit(1);
    const targetInst = instRows[0];

    // CRITICAL RBAC CHECK: Super Admin & external institutions cannot override institutional approvals
    if (!canApproveInstitutionalDecision(actor.role, actor.institutionCode, targetInst?.code || '')) {
      await writeAuditLog({
        actorUid: actor.uid,
        actorRole: actor.role,
        institutionCode: actor.institutionCode,
        action: 'BLOCKED_CROSS_INSTITUTION_DECISION',
        targetEntity: application.referenceCode,
        details: `Denied review attempt on ${targetInst?.code} record by role ${actor.role}.`,
      });
      return res.status(403).json({
        error: `Forbidden: Only authorised ${targetInst?.code} officers may approve or reject this application. Platform Super Admins and external institutions cannot override statutory approvals.`,
      });
    }

    const stepLabel =
      decision === 'approved'
        ? 'Approved — Digital Certificate / Clearance Ready'
        : decision === 'rejected'
          ? 'Rejected by Institutional Officer'
          : 'Additional Information Requested';

    const updated = await db
      .update(applications)
      .set({
        status: decision,
        currentStep: stepLabel,
        reviewerNotes: reviewerNotes || stepLabel,
        reviewedByUserId: actor.dbUserId,
        updatedAt: new Date(),
      })
      .where(eq(applications.id, appId))
      .returning();

    await db.insert(notifications).values({
      userId: application.applicantUserId,
      channel: 'in_app',
      category: 'application_update',
      title: `Application ${application.referenceCode}: ${decision.replace(/_/g, ' ').toUpperCase()}`,
      message: reviewerNotes || stepLabel,
      isRead: false,
    });

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      institutionCode: actor.institutionCode,
      action: `APPLICATION_${decision.toUpperCase()}`,
      targetEntity: application.referenceCode,
      details: reviewerNotes || stepLabel,
    });

    res.json({ application: updated[0] });
  } catch (error) {
    console.error('Review application error:', error);
    res.status(500).json({ error: 'Failed to record institutional review decision.' });
  }
});

// Sandbox Payment Gateway — strictly verifies payment before marking verified & issuing receipt
app.post('/api/payments/sandbox', requireAuth, async (req: AuthRequest, res) => {
  try {
    const actor = req.actor!;
    const serviceCode = String(req.body?.serviceCode || 'RTSA-ROAD-TAX').trim();
    const serviceTitle = String(req.body?.serviceTitle || 'Government Service Payment').trim();
    const amountZmw = Number(req.body?.amountZmw);
    const channel = req.body?.channel;
    const accountIdentifier = String(req.body?.accountIdentifier || '').trim();
    const province = String(req.body?.province || 'Lusaka');
    const councilName = String(req.body?.councilName || 'Lusaka City Council');
    const wardCode = String(req.body?.wardCode || 'LSK-W04');
    const propertyId = req.body?.propertyId ? Number(req.body.propertyId) : null;
    const utilityId = req.body?.utilityId ? Number(req.body.utilityId) : null;
    const educationId = req.body?.educationId ? Number(req.body.educationId) : null;

    const validation = validateSandboxPaymentInput({ amountZmw, channel, accountIdentifier });
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const svcRows = await db.select().from(services).where(eq(services.code, serviceCode)).limit(1);
    let institutionId = svcRows[0]?.institutionId;
    if (!institutionId) {
      const fallbackInst = await db.select().from(institutions).limit(1);
      institutionId = fallbackInst[0].id;
    }

    const instRows = await db.select().from(institutions).where(eq(institutions.id, institutionId)).limit(1);
    const inst = instRows[0];

    // Simulated gateway verification handshake (never mark success prior to provider ref generation)
    const providerPrefix =
      channel === 'MTN MoMo'
        ? 'MOMO-SBX'
        : channel === 'Airtel Money'
          ? 'AIRTEL-SBX'
          : channel === 'Zamtel Kwacha'
            ? 'ZAMTEL-SBX'
            : channel === 'Zanaco Bank'
              ? 'ZANACO-SBX'
              : 'CARD-SBX';

    const suffix = Math.floor(1000000 + Math.random() * 8999999);
    const providerRef = `${providerPrefix}-${suffix}`;
    const referenceCode = `PAY-ZM-2026-${suffix}`;
    const receiptNumber = `RCPT-OGV-${suffix}`;

    const inserted = await db
      .insert(payments)
      .values({
        referenceCode,
        receiptNumber,
        payerUserId: actor.dbUserId,
        institutionId,
        serviceCode,
        serviceTitle,
        amountZmw: Math.round(amountZmw),
        channel,
        providerRef,
        status: 'verified',
        reconciliationStatus: 'reconciled',
        province,
        councilName,
        wardCode,
        paperPagesSaved: 5,
        isDemo: true,
      })
      .returning();

    // Allocate settlement to linked property / utility / education ledger if provided
    let generatedElectricToken: string | null = null;
    if (propertyId) {
      const propRows = await db.select().from(properties).where(eq(properties.id, propertyId)).limit(1);
      if (propRows[0]) {
        const nextOutstanding = Math.max(0, propRows[0].outstandingZmw - Math.round(amountZmw));
        await db.update(properties).set({ outstandingZmw: nextOutstanding }).where(eq(properties.id, propertyId));
      }
    }
    if (utilityId) {
      generatedElectricToken = `${Math.floor(1000 + Math.random() * 8999)}-${Math.floor(1000 + Math.random() * 8999)}-${Math.floor(1000 + Math.random() * 8999)}-${Math.floor(1000 + Math.random() * 8999)}-${Math.floor(1000 + Math.random() * 8999)}`;
      await db
        .update(utilityAccounts)
        .set({ outstandingBalanceZmw: 0, lastToken: generatedElectricToken })
        .where(eq(utilityAccounts.id, utilityId));
    }
    if (educationId) {
      const eduRows = await db
        .select()
        .from(educationAccounts)
        .where(eq(educationAccounts.id, educationId))
        .limit(1);
      if (eduRows[0]) {
        const nextBal = Math.max(0, eduRows[0].termBalanceZmw - Math.round(amountZmw));
        await db
          .update(educationAccounts)
          .set({ termBalanceZmw: nextBal })
          .where(eq(educationAccounts.id, educationId));
      }
    }

    await db.insert(notifications).values({
      userId: actor.dbUserId,
      channel: 'in_app',
      category: 'payment_receipt',
      title: `Demo Payment Verified: K${Math.round(amountZmw).toLocaleString()}`,
      message: `Receipt ${receiptNumber} issued for ${serviceTitle} (${inst?.code ?? 'GOV'}).`,
      isRead: false,
    });

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      institutionCode: inst?.code,
      action: 'SANDBOX_PAYMENT_VERIFIED',
      targetEntity: receiptNumber,
      details: `Verified K${Math.round(amountZmw)} via ${channel} allocated to ${inst?.name}.`,
    });

    res.status(201).json({
      payment: {
        ...inserted[0],
        institutionCode: inst?.code ?? 'GOV',
        institutionName: inst?.name ?? 'Government Institution',
        generatedElectricToken,
      },
    });
  } catch (error) {
    console.error('Sandbox payment error:', error);
    res.status(500).json({ error: 'Payment gateway verification failed.' });
  }
});

// Institutional Portal (Strict Institutional Isolation)
app.get('/api/institution/portal', requireAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSeedData();
    const actor = req.actor!;
    if (!actor.institutionId) {
      return res.status(403).json({
        error: 'Institutional Portal access requires an authorised institutional officer or administrator role.',
      });
    }

    const [instRows, instServices, instApps, instPayments, instUsers] = await Promise.all([
      db.select().from(institutions).where(eq(institutions.id, actor.institutionId)).limit(1),
      db.select().from(services).where(eq(services.institutionId, actor.institutionId)),
      db.select().from(applications).where(eq(applications.institutionId, actor.institutionId)).orderBy(desc(applications.createdAt)),
      db.select().from(payments).where(eq(payments.institutionId, actor.institutionId)).orderBy(desc(payments.createdAt)),
      db.select({ id: users.id, fullName: users.fullName, email: users.email }).from(users),
    ]);

    const svcMap = new Map(instServices.map((s) => [s.id, s]));
    const userMap = new Map(instUsers.map((u) => [u.id, u]));

    res.json({
      institution: instRows[0],
      services: instServices,
      applications: instApps.map((a) => ({
        ...a,
        serviceTitle: svcMap.get(a.serviceId)?.title ?? 'Service',
        applicantName: userMap.get(a.applicantUserId)?.fullName ?? 'Applicant',
      })),
      payments: instPayments,
      isolationNotice: `Strict tenant isolation active: showing records exclusively authorised for ${instRows[0]?.name}.`,
    });
  } catch (error) {
    console.error('Institution portal error:', error);
    res.status(500).json({ error: 'Failed to load institutional portal.' });
  }
});

// Council GIS Revenue Intelligence & Investigations
app.get('/api/council/intelligence', requireAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSeedData();
    const actor = req.actor!;
    const allowed = ['council_officer', 'zra_admin', 'auditor', 'super_admin', 'institutional_admin'];
    if (!allowed.includes(actor.role)) {
      return res.status(403).json({ error: 'Council Revenue Intelligence requires council or oversight permissions.' });
    }

    const [zones, invRows, instRows] = await Promise.all([
      db.select().from(revenueZones).orderBy(revenueZones.id),
      db.select().from(investigations).orderBy(desc(investigations.createdAt)),
      db.select().from(institutions),
    ]);

    const instMap = new Map(instRows.map((i) => [i.id, i]));
    // Council officers see their council zones prominently, with province/comparison access
    const enrichedZones = zones.map((z) => ({
      ...z,
      institutionCode: instMap.get(z.institutionId)?.code ?? 'LCC',
      metrics: evaluateRevenueZone({
        expectedRevenueZmw: z.expectedRevenueZmw,
        actualRevenueZmw: z.actualRevenueZmw,
        registeredBusinesses: z.registeredBusinesses,
        activePermits: z.activePermits,
      }),
    }));

    const zoneMap = new Map(enrichedZones.map((z) => [z.id, z]));
    res.json({
      zones: enrichedZones,
      investigations: invRows.map((inv) => ({
        ...inv,
        zoneName: zoneMap.get(inv.zoneId)?.name ?? 'Ward',
        zoneCode: zoneMap.get(inv.zoneId)?.zoneCode ?? '',
        councilName: zoneMap.get(inv.zoneId)?.councilName ?? '',
      })),
    });
  } catch (error) {
    console.error('Council intelligence error:', error);
    res.status(500).json({ error: 'Failed to load GIS council revenue intelligence.' });
  }
});

app.post('/api/council/investigations', requireAuth, async (req: AuthRequest, res) => {
  try {
    const actor = req.actor!;
    if (!['council_officer', 'zra_admin'].includes(actor.role)) {
      return res.status(403).json({ error: 'Only council or ZRA officers may open revenue investigation cases.' });
    }
    const zoneId = Number(req.body?.zoneId);
    const title = String(req.body?.title || '').trim();
    const confirmedFindings = Array.isArray(req.body?.confirmedFindings) ? req.body.confirmedFindings : [];
    const possibleExplanations = Array.isArray(req.body?.possibleExplanations) ? req.body.possibleExplanations : [];
    const furtherInvestigation = Array.isArray(req.body?.furtherInvestigation) ? req.body.furtherInvestigation : [];
    const officerNotes = String(req.body?.officerNotes || 'Investigation initiated from GIS Revenue Intelligence.');

    if (!zoneId || !title) {
      return res.status(400).json({ error: 'Zone ID and investigation title are required.' });
    }

    const caseCode = `INV-ZM-2026-${Math.floor(100 + Math.random() * 899)}`;
    const inserted = await db
      .insert(investigations)
      .values({
        caseCode,
        zoneId,
        assignedOfficerId: actor.dbUserId,
        title,
        status: 'open',
        priority: 'high',
        confirmedFindingsJson: confirmedFindings,
        possibleExplanationsJson: possibleExplanations,
        furtherInvestigationJson: furtherInvestigation,
        officerNotes,
      })
      .returning();

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      institutionCode: actor.institutionCode,
      action: 'CREATE_REVENUE_INVESTIGATION',
      targetEntity: caseCode,
      details: title,
    });

    res.status(201).json({ investigation: inserted[0] });
  } catch (error) {
    console.error('Create investigation error:', error);
    res.status(500).json({ error: 'Failed to create investigation case.' });
  }
});

app.patch('/api/council/investigations/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const actor = req.actor!;
    if (!['council_officer', 'zra_admin'].includes(actor.role)) {
      return res.status(403).json({ error: 'Insufficient permissions to update investigation cases.' });
    }
    const id = Number(req.params.id);
    const status = String(req.body?.status || 'in_progress');
    const officerNotes = String(req.body?.officerNotes || '');

    const updated = await db
      .update(investigations)
      .set({
        status,
        officerNotes,
        updatedAt: new Date(),
      })
      .where(eq(investigations.id, id))
      .returning();

    res.json({ investigation: updated[0] });
  } catch (error) {
    console.error('Update investigation error:', error);
    res.status(500).json({ error: 'Failed to update investigation.' });
  }
});

// ZRA Master Revenue Oversight Dashboard (Aggregate Financial Oversight Only — No Citizen PII)
app.get('/api/zra/overview', requireAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSeedData();
    const actor = req.actor!;
    if (!['zra_admin', 'finance_officer', 'auditor', 'super_admin'].includes(actor.role)) {
      return res.status(403).json({
        error: 'ZRA Master Revenue Dashboard is restricted to authorised ZRA, Finance, and Audit roles.',
      });
    }

    const [allPayments, instRows, zoneRows, alertRows] = await Promise.all([
      db.select().from(payments).orderBy(desc(payments.createdAt)),
      db.select().from(institutions),
      db.select().from(revenueZones),
      db.select().from(fraudAlerts).orderBy(desc(fraudAlerts.createdAt)),
    ]);

    const instMap = new Map(instRows.map((i) => [i.id, i]));

    // Aggregate revenue by institution (no citizen PII exposed)
    const byInstitution = instRows.map((inst) => {
      const matching = allPayments.filter((p) => p.institutionId === inst.id);
      const zoneExpected = zoneRows
        .filter((z) => z.institutionId === inst.id)
        .reduce((acc, z) => acc + z.expectedRevenueZmw, 0);
      const zoneActual = zoneRows
        .filter((z) => z.institutionId === inst.id)
        .reduce((acc, z) => acc + z.actualRevenueZmw, 0);
      const directVerified = matching.reduce((acc, p) => acc + p.amountZmw, 0);
      return {
        institutionId: inst.id,
        institutionCode: inst.code,
        institutionName: inst.name,
        province: inst.province,
        verifiedRevenueZmw: directVerified + zoneActual,
        expectedRevenueZmw: Math.max(directVerified + zoneExpected, directVerified + zoneActual),
        transactionCount: matching.length + (zoneActual > 0 ? 120 : 0),
        pendingReconciliationZmw: matching
          .filter((p) => p.reconciliationStatus !== 'reconciled')
          .reduce((acc, p) => acc + p.amountZmw, 0),
      };
    });

    // Privacy-preserving anonymized transaction ledger (reference + institution + amount, zero personal NRC/email)
    const anonymizedTransactions = allPayments.map((p) => ({
      id: p.id,
      referenceCode: p.referenceCode,
      receiptNumber: p.receiptNumber,
      institutionCode: instMap.get(p.institutionId)?.code ?? 'GOV',
      institutionName: instMap.get(p.institutionId)?.name ?? 'Institution',
      serviceCode: p.serviceCode,
      serviceTitle: p.serviceTitle,
      amountZmw: p.amountZmw,
      channel: p.channel,
      status: p.status,
      reconciliationStatus: p.reconciliationStatus,
      province: p.province,
      councilName: p.councilName,
      wardCode: p.wardCode,
      createdAt: p.createdAt,
    }));

    res.json({
      byInstitution,
      zones: zoneRows.map((z) => ({
        ...z,
        institutionCode: instMap.get(z.institutionId)?.code ?? 'LCC',
        metrics: evaluateRevenueZone({
          expectedRevenueZmw: z.expectedRevenueZmw,
          actualRevenueZmw: z.actualRevenueZmw,
          registeredBusinesses: z.registeredBusinesses,
          activePermits: z.activePermits,
        }),
      })),
      fraudAlerts: alertRows.map((a) => ({
        ...a,
        institutionCode: a.institutionId ? instMap.get(a.institutionId)?.code ?? 'GOV' : 'PLATFORM',
      })),
      transactions: anonymizedTransactions,
      governanceRule:
        'ZRA Master Oversight provides consolidated revenue visibility across participating institutions without exposing private citizen identity records or overriding institutional operational decisions.',
    });
  } catch (error) {
    console.error('ZRA overview error:', error);
    res.status(500).json({ error: 'Failed to load ZRA revenue overview.' });
  }
});

// Intellectual Property Portal (Patents & Trademarks via PACRA)
app.get('/api/ip/records', requireAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSeedData();
    const actor = req.actor!;
    const allIp = await db.select().from(ipApplications).orderBy(desc(ipApplications.createdAt));
    // IP Officers & Auditors see all IP submissions; applicants see their own + public demo catalog
    const visibleIp =
      actor.role === 'ip_officer' || actor.role === 'auditor'
        ? allIp
        : allIp.filter((ip) => ip.applicantUserId === actor.dbUserId || ip.isDemo);

    res.json({
      ipApplications: visibleIp,
      canReview: actor.role === 'ip_officer',
    });
  } catch (error) {
    console.error('IP records error:', error);
    res.status(500).json({ error: 'Failed to load IP filings.' });
  }
});

app.post('/api/ip/applications', requireAuth, async (req: AuthRequest, res) => {
  try {
    const actor = req.actor!;
    const ipType = req.body?.ipType === 'trademark' ? 'trademark' : 'patent';
    const title = String(req.body?.title || '').trim();
    const description = String(req.body?.description || '').trim();
    const classification = String(req.body?.classification || 'General Technology').trim();
    const similarityReportJson = req.body?.similarityReport || null;

    if (!title || !description) {
      return res.status(400).json({ error: 'Invention/Trademark title and description are required.' });
    }

    const pacraRows = await db.select().from(institutions).where(eq(institutions.code, 'PACRA')).limit(1);
    const pacraId = pacraRows[0].id;
    const prefix = ipType === 'patent' ? 'PACRA-PAT-DEMO' : 'PACRA-TM-DEMO';
    const referenceCode = `${prefix}-2026-${Math.floor(100 + Math.random() * 899)}`;

    const inserted = await db
      .insert(ipApplications)
      .values({
        referenceCode,
        applicantUserId: actor.dbUserId,
        institutionId: pacraId,
        ipType,
        title,
        description,
        classification,
        status: 'submitted',
        similarityReportJson,
        isDemo: true,
      })
      .returning();

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      institutionCode: 'PACRA',
      action: 'SUBMIT_IP_APPLICATION',
      targetEntity: referenceCode,
      details: `Submitted ${ipType} application "${title}" to PACRA queue.`,
    });

    res.status(201).json({ ipApplication: inserted[0] });
  } catch (error) {
    console.error('IP submission error:', error);
    res.status(500).json({ error: 'Failed to submit IP application.' });
  }
});

app.post('/api/ip/applications/:id/review', requireAuth, async (req: AuthRequest, res) => {
  try {
    const actor = req.actor!;
    if (!canApproveInstitutionalDecision(actor.role, actor.institutionCode, 'PACRA')) {
      return res.status(403).json({
        error: 'Forbidden: Only Authorised PACRA IP Officers may examine or update statutory IP application statuses.',
      });
    }
    const id = Number(req.params.id);
    const status = String(req.body?.status || 'examiner_review');
    const updated = await db
      .update(ipApplications)
      .set({ status, reviewedByUserId: actor.dbUserId })
      .where(eq(ipApplications.id, id))
      .returning();

    res.json({ ipApplication: updated[0] });
  } catch (error) {
    console.error('IP review error:', error);
    res.status(500).json({ error: 'Failed to update IP filing status.' });
  }
});

// Platform Super Admin & Audit Logs
app.get('/api/admin/platform', requireAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSeedData();
    const actor = req.actor!;
    if (!['super_admin', 'auditor', 'finance_officer'].includes(actor.role)) {
      return res.status(403).json({ error: 'Platform administration access restricted.' });
    }
    const [instRows, logsRows, cfgRows, allPayments] = await Promise.all([
      db.select().from(institutions).orderBy(institutions.id),
      db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(40),
      db.select().from(platformConfig).where(eq(platformConfig.configKey, 'regional_profile')),
      db.select().from(payments).orderBy(desc(payments.createdAt)),
    ]);

    res.json({
      institutions: instRows,
      auditLogs: logsRows,
      regionalConfig: cfgRows[0]?.configValueJson ?? {},
      recentPayments: allPayments,
    });
  } catch (error) {
    console.error('Platform admin error:', error);
    res.status(500).json({ error: 'Failed to load platform administration data.' });
  }
});

app.post('/api/admin/institutions', requireAuth, async (req: AuthRequest, res) => {
  try {
    const actor = req.actor!;
    if (actor.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only Platform Super Administrators can onboard institutions.' });
    }
    const code = String(req.body?.code || '').trim().toUpperCase();
    const name = String(req.body?.name || '').trim();
    const type = String(req.body?.type || 'government_agency').trim();
    const province = String(req.body?.province || 'Lusaka').trim();
    const description = String(req.body?.description || '').trim();
    const integrationMode = req.body?.integrationMode === 'planned' ? 'planned' : 'sandbox';

    if (!code || !name || !description) {
      return res.status(400).json({ error: 'Institution code, name, and description are required.' });
    }

    const inserted = await db
      .insert(institutions)
      .values({ code, name, type, province, description, integrationMode, status: 'active' })
      .returning();

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      action: 'ONBOARD_INSTITUTION',
      targetEntity: code,
      details: `Onboarded ${name} (${integrationMode} mode).`,
    });

    res.status(201).json({ institution: inserted[0] });
  } catch (error) {
    console.error('Institution onboard error:', error);
    res.status(500).json({ error: 'Failed to onboard participating institution.' });
  }
});

app.patch('/api/admin/config', requireAuth, async (req: AuthRequest, res) => {
  try {
    const actor = req.actor!;
    if (actor.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only Platform Super Administrators can modify global regional config.' });
    }
    const existing = await db
      .select()
      .from(platformConfig)
      .where(eq(platformConfig.configKey, 'regional_profile'))
      .limit(1);
    const current = (existing[0]?.configValueJson || {}) as Record<string, unknown>;
    const merged = { ...current, ...(req.body || {}) };

    await db
      .update(platformConfig)
      .set({ configValueJson: merged, updatedAt: new Date() })
      .where(eq(platformConfig.configKey, 'regional_profile'));

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      action: 'UPDATE_PLATFORM_CONFIG',
      targetEntity: 'regional_profile',
      details: `Updated country/currency/language configuration.`,
    });

    res.json({ regionalConfig: merged });
  } catch (error) {
    console.error('Update platform config error:', error);
    res.status(500).json({ error: 'Failed to update configuration.' });
  }
});

app.post('/api/notifications/read-all', requireAuth, async (req: AuthRequest, res) => {
  try {
    const actor = req.actor!;
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, actor.dbUserId));
    res.json({ ok: true });
  } catch (error) {
    console.error('Mark notifications read failed:', error);
    res.status(500).json({ error: 'Failed to mark notifications read.' });
  }
});

// ========================
// ONEGOV AI ENGINE ROUTES
// ========================

app.post('/api/ai/assistant', requireAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSeedData();
    const actor = req.actor!;
    const message = String(req.body?.message || '').trim();
    const language = String(req.body?.language || 'English');
    if (!message) {
      return res.status(400).json({ error: 'Please enter a question for OneGov Intelligence.' });
    }
    const svcRows = await db.select().from(services);
    const servicesContext = svcRows
      .map((s) => `${s.code}: ${s.title} (Fee: K${s.feeZmw}, SLA: ${s.slaDays}d) — ${s.description}`)
      .join('\n');

    const result = await askOneGovAssistant({
      message,
      role: actor.role,
      language,
      servicesContext,
    });
    res.json(result);
  } catch (error: any) {
    console.error('Gemini assistant error:', error);
    res.status(502).json({
      error: error?.message || 'AI Assistant could not complete the request. Verify GEMINI_API_KEY configuration.',
    });
  }
});

app.post('/api/ai/document-ocr', requireAuth, async (req: AuthRequest, res) => {
  try {
    const fileName = String(req.body?.fileName || 'uploaded_document.pdf');
    const documentTextOrSummary = String(req.body?.documentText || '').trim();
    const requiredDocs = Array.isArray(req.body?.requiredDocs) ? req.body.requiredDocs : ['NRC', 'TPIN', 'PACRA Certificate'];
    const imageBase64 = req.body?.imageBase64 ? String(req.body.imageBase64) : undefined;
    const imageMimeType = req.body?.imageMimeType ? String(req.body.imageMimeType) : undefined;

    if (!documentTextOrSummary && !imageBase64) {
      return res.status(400).json({ error: 'Provide document text/details or upload an image for OCR analysis.' });
    }

    const result = await analyzeDocumentOcr({
      fileName,
      documentTextOrSummary,
      requiredDocs,
      imageBase64,
      imageMimeType,
    });
    res.json(result);
  } catch (error: any) {
    console.error('Gemini document OCR error:', error);
    res.status(502).json({
      error: error?.message || 'Document intelligence analysis failed.',
    });
  }
});

app.post('/api/ai/council-analysis', requireAuth, async (req: AuthRequest, res) => {
  try {
    const zoneId = Number(req.body?.zoneId);
    const zoneRows = await db.select().from(revenueZones).where(eq(revenueZones.id, zoneId)).limit(1);
    const zone = zoneRows[0];
    if (!zone) {
      return res.status(404).json({ error: 'Revenue zone not found.' });
    }

    const analysis = await analyzeCouncilRevenueZone({
      zoneName: zone.name,
      councilName: zone.councilName,
      province: zone.province,
      expectedRevenueZmw: zone.expectedRevenueZmw,
      actualRevenueZmw: zone.actualRevenueZmw,
      registeredBusinesses: zone.registeredBusinesses,
      activePermits: zone.activePermits,
      unpaidProperties: zone.unpaidProperties,
      indicators: Array.isArray(zone.indicatorsJson) ? zone.indicatorsJson : [],
    });

    res.json({ zoneId: zone.id, zoneName: zone.name, analysis });
  } catch (error: any) {
    console.error('Gemini council analysis error:', error);
    res.status(502).json({
      error: error?.message || 'Council revenue AI analysis failed.',
    });
  }
});

app.post('/api/ai/ip-similarity', requireAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSeedData();
    const ipType = req.body?.ipType === 'trademark' ? 'trademark' : 'patent';
    const title = String(req.body?.title || '').trim();
    const description = String(req.body?.description || '').trim();
    const classification = String(req.body?.classification || 'General').trim();
    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required for similarity analysis.' });
    }

    const existing = await db
      .select()
      .from(ipApplications)
      .where(eq(ipApplications.ipType, ipType));

    const catalogRecords = [
      ...existing.map((e) => ({
        reference: e.referenceCode,
        title: e.title,
        description: e.description,
        classification: e.classification,
      })),
      {
        reference: 'ZM-PAT-2023-0041',
        title: 'Hybrid Solar Maize & Grain Tunnel Dryer with Passive Convection',
        description: 'Solar thermal collector agricultural dryer for small-scale Zambian farms with perforated drying trays.',
        classification: 'A23N / F26B',
      },
      {
        reference: 'ZM-PAT-2022-0118',
        title: 'Smart Borehole Solar Pump Telemetry Controller',
        description: 'GSM-enabled solar water pump monitoring unit for rural councils and agricultural cooperatives.',
        classification: 'F04B / G05D',
      },
      {
        reference: 'ZM-TM-2021-3910',
        title: 'KAFUE VALLEY SEEDS',
        description: 'Agricultural seed brand for hybrid maize and legume packs.',
        classification: 'Nice Class 31',
      },
    ];

    // Also compute deterministic keyword overlap scores as grounding metadata
    const scoredBaseline = catalogRecords.map((r) => ({
      ...r,
      lexicalScore: computeTextSimilarityScore(`${title} ${description}`, `${r.title} ${r.description}`),
    }));

    const aiReport = await analyzeIpSimilarity({
      ipType,
      title,
      description,
      classification,
      existingRecords: scoredBaseline,
    });

    res.json(aiReport);
  } catch (error: any) {
    console.error('Gemini IP similarity error:', error);
    res.status(502).json({
      error: error?.message || 'AI IP similarity screening failed.',
    });
  }
});

app.post('/api/ai/predictive-insights', requireAuth, async (req: AuthRequest, res) => {
  try {
    const actor = req.actor!;
    if (!['zra_admin', 'council_officer', 'finance_officer', 'auditor', 'super_admin'].includes(actor.role)) {
      return res.status(403).json({ error: 'Predictive insights require oversight role permissions.' });
    }
    const [zoneRows, alertRows] = await Promise.all([db.select().from(revenueZones), db.select().from(fraudAlerts)]);
    const revenueSummary = zoneRows
      .map(
        (z) =>
          `${z.name} (${z.councilName}): Actual K${z.actualRevenueZmw} / Expected K${z.expectedRevenueZmw}, Unpaid properties: ${z.unpaidProperties}`,
      )
      .join('\n');
    const fraudAlertsSummary = alertRows
      .map((a) => `${a.alertCode} [${a.severity}]: ${a.description}`)
      .join('\n');

    const result = await generatePredictiveInsights({ revenueSummary, fraudAlertsSummary });
    res.json(result);
  } catch (error: any) {
    console.error('Gemini predictive insights error:', error);
    res.status(502).json({ error: error?.message || 'Predictive insights failed.' });
  }
});

function formatGeminiEndpointError(error: any, fallback: string): { status: number; message: string } {
  const raw = String(error?.message || '');
  let parsedMsg = raw;
  let parsedCode = Number(error?.status || 0);
  try {
    if (raw.trim().startsWith('{')) {
      const json = JSON.parse(raw);
      if (json?.error?.message) parsedMsg = String(json.error.message);
      if (json?.error?.code) parsedCode = Number(json.error.code);
    }
  } catch {
    // Keep raw string
  }
  if (parsedCode === 429 || raw.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message:
        'Gemini API quota limit reached for the current key. Check your plan or select a billing-enabled key in Settings > Secrets.',
    };
  }
  if (parsedCode === 404 || raw.includes('NOT_FOUND')) {
    return {
      status: 502,
      message: parsedMsg || `${fallback} (model endpoint unavailable for current API key).`,
    };
  }
  return { status: 502, message: parsedMsg || fallback };
}

// Google Search Grounding (gemini-4-hydrogen + googleSearch)
app.post('/api/ai/search-grounding', requireAuth, async (req: AuthRequest, res) => {
  try {
    const actor = req.actor!;
    const query = String(req.body?.query || '').trim();
    const language = String(req.body?.language || 'English');
    if (!query) {
      return res.status(400).json({ error: 'Please provide a search query.' });
    }
    const result = await askWithSearchGrounding({
      query,
      role: actor.role,
      language,
    });
    res.json(result);
  } catch (error: any) {
    console.error('Gemini search grounding error:', error);
    const formatted = formatGeminiEndpointError(error, 'Google Search grounding request failed.');
    res.status(formatted.status).json({ error: formatted.message });
  }
});

// Google Maps Grounding (gemini-4-hydrogen + googleMaps)
app.post('/api/ai/maps-grounding', requireAuth, async (req: AuthRequest, res) => {
  try {
    const query = String(req.body?.query || '').trim();
    const latitude = req.body?.latitude !== undefined ? Number(req.body.latitude) : undefined;
    const longitude = req.body?.longitude !== undefined ? Number(req.body.longitude) : undefined;
    if (!query) {
      return res.status(400).json({ error: 'Please provide a location query.' });
    }
    const result = await findCivicLocationsWithMapsGrounding({
      query,
      latitude,
      longitude,
    });
    res.json(result);
  } catch (error: any) {
    console.error('Gemini maps grounding error:', error);
    const formatted = formatGeminiEndpointError(error, 'Google Maps grounding lookup failed.');
    res.status(formatted.status).json({ error: formatted.message });
  }
});

// Pre-recorded / Microphone Audio Transcription (gemini-3.5-transcribe)
app.post('/api/ai/transcribe', requireAuth, async (req: AuthRequest, res) => {
  try {
    const audioBase64 = String(req.body?.audioBase64 || '').trim();
    const mimeType = String(req.body?.mimeType || 'audio/webm').trim();
    if (!audioBase64) {
      return res.status(400).json({ error: 'Audio data is required for transcription.' });
    }
    const result = await transcribeAudioBase64({ audioBase64, mimeType });
    res.json(result);
  } catch (error: any) {
    console.error('Gemini audio transcription error:', error);
    const formatted = formatGeminiEndpointError(error, 'Audio transcription failed.');
    res.status(formatted.status).json({ error: formatted.message });
  }
});

async function verifyWebSocketToken(token: string | null): Promise<boolean> {
  if (!token) return false;
  if (token.startsWith('demo.')) {
    return Boolean(verifyDemoToken(token));
  }
  try {
    await adminAuth.verifyIdToken(token);
    return true;
  } catch {
    return false;
  }
}

async function startServer() {
  const port = 3000;
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const httpServer = app.listen(port, '0.0.0.0', () => {
    console.log(`OneGov Zambia server listening on http://localhost:${port}`);
  });

  // Real-Time Gemini Live API WebSocket Bridge (/ws/live)
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    try {
      const reqUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
      if (reqUrl.pathname === '/ws/live') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      }
    } catch {
      socket.destroy();
    }
  });

  wss.on('connection', async (clientWs: WebSocket, request) => {
    const reqUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    const token = reqUrl.searchParams.get('token');
    const authorized = await verifyWebSocketToken(token);
    if (!authorized) {
      clientWs.send(JSON.stringify({ error: 'Unauthorized Live Voice session.' }));
      clientWs.close(4401, 'Unauthorized');
      return;
    }

    let liveSession: Awaited<ReturnType<ReturnType<typeof getGeminiClient>['live']['connect']>> | null = null;
    try {
      const ai = getGeminiClient();
      liveSession = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction:
            'You are OneGov Zambia Voice Guide. Speak clearly and concisely to help citizens and SMEs with RTSA road tax, ZRA TPIN, PACRA business & IP filings, ZESCO tokens, and local council permits. Clarify that official agencies remain the decision authorities.',
        },
        callbacks: {
          onopen: () => {
            if (clientWs.readyState === clientWs.OPEN) {
              clientWs.send(JSON.stringify({ ready: true }));
            }
          },
          onmessage: (message: LiveServerMessage) => {
            if (clientWs.readyState !== clientWs.OPEN) return;
            const content = message.serverContent;
            if (content?.inputTranscription?.text) {
              clientWs.send(JSON.stringify({ inputTranscript: content.inputTranscription.text }));
            }
            if (content?.outputTranscription?.text) {
              clientWs.send(JSON.stringify({ outputTranscript: content.outputTranscription.text }));
            }
            for (const part of content?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
              }
            }
            if (content?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
            if (content?.turnComplete) {
              clientWs.send(JSON.stringify({ turnComplete: true }));
            }
          },
          onerror: (err: unknown) => {
            if (clientWs.readyState === clientWs.OPEN) {
              const message = err instanceof Error ? err.message : 'Live session error';
              clientWs.send(JSON.stringify({ error: message }));
            }
          },
          onclose: () => {
            if (clientWs.readyState === clientWs.OPEN) {
              clientWs.send(JSON.stringify({ closed: true }));
            }
          },
        },
      });
    } catch (err: any) {
      if (clientWs.readyState === clientWs.OPEN) {
        clientWs.send(JSON.stringify({ error: err?.message || 'Unable to start Gemini Live session.' }));
        clientWs.close();
      }
      return;
    }

    clientWs.on('message', (rawData) => {
      if (!liveSession) return;
      try {
        const msg = JSON.parse(rawData.toString()) as { audio?: string; text?: string };
        if (msg.audio) {
          liveSession.sendRealtimeInput({
            audio: { data: msg.audio, mimeType: 'audio/pcm;rate=16000' },
          });
        } else if (msg.text) {
          liveSession.sendRealtimeInput({ text: msg.text });
        }
      } catch (err) {
        console.error('Live WebSocket message handling error:', err);
      }
    });

    clientWs.on('close', () => {
      try {
        liveSession?.close();
      } catch {
        // Ignore close race
      }
      liveSession = null;
    });
  });
}

startServer().catch((err) => {
  console.error('Failed to start OneGov server:', err);
  process.exit(1);
});

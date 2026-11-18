import { count, eq } from 'drizzle-orm';
import { db } from './index.ts';
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
} from './schema.ts';

let seededOnce = false;
let seedingPromise: Promise<void> | null = null;

export async function ensureSeedData(): Promise<void> {
  if (seededOnce) return;
  if (seedingPromise) return seedingPromise;

  seedingPromise = (async () => {
    try {
      const [{ total }] = await db.select({ total: count() }).from(institutions);
      if (Number(total) > 0) {
        seededOnce = true;
        return;
      }

      // 1. Participating Institutions
      const insertedInstitutions = await db
        .insert(institutions)
        .values([
          {
            code: 'ZRA',
            name: 'Zambia Revenue Authority',
            type: 'tax_authority',
            province: 'Lusaka',
            status: 'active',
            integrationMode: 'sandbox',
            description: 'National tax administration and consolidated public revenue oversight.',
          },
          {
            code: 'RTSA',
            name: 'Road Transport and Safety Agency',
            type: 'transport',
            province: 'Lusaka',
            status: 'active',
            integrationMode: 'sandbox',
            description: 'Road tax, vehicle licensing, fitness certificates, and driver services.',
          },
          {
            code: 'LCC',
            name: 'Lusaka City Council',
            type: 'council',
            province: 'Lusaka',
            status: 'active',
            integrationMode: 'sandbox',
            description: 'Municipal trading permits, property rates, market levies, and ward oversight.',
          },
          {
            code: 'KCC',
            name: 'Kitwe City Council',
            type: 'council',
            province: 'Copperbelt',
            status: 'active',
            integrationMode: 'sandbox',
            description: 'Copperbelt municipal licensing, land rates, and market revenue zones.',
          },
          {
            code: 'LVCC',
            name: 'Livingstone City Council',
            type: 'council',
            province: 'Southern',
            status: 'active',
            integrationMode: 'sandbox',
            description: 'Southern tourism & municipal council permits and property revenue.',
          },
          {
            code: 'ZESCO',
            name: 'Zambia Electricity Supply Corporation',
            type: 'utility',
            province: 'Lusaka',
            status: 'active',
            integrationMode: 'sandbox',
            description: 'National electricity billing, prepaid meter tokens, and commercial connections.',
          },
          {
            code: 'PACRA',
            name: 'Patents and Companies Registration Agency',
            type: 'registry',
            province: 'Lusaka',
            status: 'active',
            integrationMode: 'sandbox',
            description: 'Business registration, company filings, patents, and trademarks.',
          },
          {
            code: 'UNZA',
            name: 'University of Zambia & Partner Schools',
            type: 'education',
            province: 'Lusaka',
            status: 'active',
            integrationMode: 'sandbox',
            description: 'Tuition statements, student fee settlement, and academic clearance.',
          },
          {
            code: 'NAPSA',
            name: 'National Pension Scheme Authority',
            type: 'social_security',
            province: 'Lusaka',
            status: 'active',
            integrationMode: 'planned',
            description: 'Employer social security compliance certificates and monthly returns.',
          },
          {
            code: 'ZSIC',
            name: 'ZSIC General Insurance',
            type: 'insurance',
            province: 'Lusaka',
            status: 'active',
            integrationMode: 'sandbox',
            description: 'Motor third-party & comprehensive digital insurance certificates.',
          },
        ])
        .returning();

      const instByCode = new Map(insertedInstitutions.map((i) => [i.code, i]));

      // 2. Demo Users covering all 12 specified roles
      const demoUsers = await db
        .insert(users)
        .values([
          {
            uid: 'demo:citizen',
            email: 'mwansa.banda@demo.onegov.zm',
            fullName: 'Mwansa Banda',
            phone: '+260977100201',
            nrcNumber: '245189/10/1',
            role: 'citizen',
            institutionId: null,
            verified: true,
            isDemo: true,
          },
          {
            uid: 'demo:small_business_owner',
            email: 'chanda.mutale@demo.onegov.zm',
            fullName: 'Chanda Mutale',
            phone: '+260966200302',
            nrcNumber: '318904/10/1',
            role: 'small_business_owner',
            institutionId: null,
            verified: true,
            isDemo: true,
          },
          {
            uid: 'demo:business_admin',
            email: 'bwalya.mwamba@demo.onegov.zm',
            fullName: 'Bwalya Mwamba',
            phone: '+260955300403',
            nrcNumber: '198442/67/1',
            role: 'business_admin',
            institutionId: null,
            verified: true,
            isDemo: true,
          },
          {
            uid: 'demo:government_officer',
            email: 'tembo.rtsa@demo.onegov.zm',
            fullName: 'Lombe Tembo (RTSA Officer)',
            phone: '+260977400504',
            nrcNumber: '177210/10/1',
            role: 'government_officer',
            institutionId: instByCode.get('RTSA')!.id,
            verified: true,
            isDemo: true,
          },
          {
            uid: 'demo:council_officer',
            email: 'mulenga.lcc@demo.onegov.zm',
            fullName: 'Mulenga Phiri (Lusaka Council)',
            phone: '+260978500605',
            nrcNumber: '209876/10/1',
            role: 'council_officer',
            institutionId: instByCode.get('LCC')!.id,
            verified: true,
            isDemo: true,
          },
          {
            uid: 'demo:institutional_admin',
            email: 'kunda.zesco@demo.onegov.zm',
            fullName: 'KundaZulu (ZESCO Admin)',
            phone: '+260966600706',
            nrcNumber: '165031/10/1',
            role: 'institutional_admin',
            institutionId: instByCode.get('ZESCO')!.id,
            verified: true,
            isDemo: true,
          },
          {
            uid: 'demo:zra_admin',
            email: 'mutinta.zra@demo.onegov.zm',
            fullName: 'Mutinta Katongo (ZRA Oversight)',
            phone: '+260977700807',
            nrcNumber: '154990/10/1',
            role: 'zra_admin',
            institutionId: instByCode.get('ZRA')!.id,
            verified: true,
            isDemo: true,
          },
          {
            uid: 'demo:super_admin',
            email: 'platform.admin@demo.onegov.zm',
            fullName: 'Chisomo Lungu (Platform Admin)',
            phone: '+260977800908',
            nrcNumber: '140219/10/1',
            role: 'super_admin',
            institutionId: null,
            verified: true,
            isDemo: true,
          },
          {
            uid: 'demo:finance_officer',
            email: 'reconciliation@demo.onegov.zm',
            fullName: 'Thandiwe Zulu (Finance & Recon)',
            phone: '+260977900109',
            nrcNumber: '221045/10/1',
            role: 'finance_officer',
            institutionId: null,
            verified: true,
            isDemo: true,
          },
          {
            uid: 'demo:auditor',
            email: 'audit.oversight@demo.onegov.zm',
            fullName: 'Kelvin Siame (Statutory Auditor)',
            phone: '+260977010210',
            nrcNumber: '188321/10/1',
            role: 'auditor',
            institutionId: null,
            verified: true,
            isDemo: true,
          },
          {
            uid: 'demo:ip_applicant',
            email: 'mutale.inventor@demo.onegov.zm',
            fullName: 'Mutale Chileshe (Inventor)',
            phone: '+260966111211',
            nrcNumber: '299401/10/1',
            role: 'ip_applicant',
            institutionId: null,
            verified: true,
            isDemo: true,
          },
          {
            uid: 'demo:ip_officer',
            email: 'examiner.pacra@demo.onegov.zm',
            fullName: 'Nkandu Mwape (PACRA IP Officer)',
            phone: '+260977222312',
            nrcNumber: '174098/10/1',
            role: 'ip_officer',
            institutionId: instByCode.get('PACRA')!.id,
            verified: true,
            isDemo: true,
          },
        ])
        .returning();

      const userByUid = new Map(demoUsers.map((u) => [u.uid, u]));
      const citizenUser = userByUid.get('demo:citizen')!;
      const smeUser = userByUid.get('demo:small_business_owner')!;
      const councilOfficer = userByUid.get('demo:council_officer')!;
      const ipApplicant = userByUid.get('demo:ip_applicant')!;

      // 3. Service Categories
      const categories = await db
        .insert(serviceCategories)
        .values([
          {
            slug: 'transport',
            name: 'Transport & Motor Vehicles',
            moduleKey: 'transport',
            description: 'Road tax, vehicle fitness, registration transfers, and motor insurance.',
          },
          {
            slug: 'business',
            name: 'Business & SME Licensing',
            moduleKey: 'business',
            description: 'Business name registration, trading permits, and council levies.',
          },
          {
            slug: 'property',
            name: 'Property & Land Rates',
            moduleKey: 'property',
            description: 'Council property rates, land title clearance, and plot assessments.',
          },
          {
            slug: 'utilities',
            name: 'Electricity & Public Utilities',
            moduleKey: 'utilities',
            description: 'ZESCO prepaid/postpaid billing and utility account services.',
          },
          {
            slug: 'education',
            name: 'Education & Tuition',
            moduleKey: 'education',
            description: 'University and school fee statements and verified digital receipts.',
          },
          {
            slug: 'permits',
            name: 'Licences & Statutory Permits',
            moduleKey: 'permits',
            description: 'Council health permits, fire safety clearances, and trade licences.',
          },
          {
            slug: 'ip',
            name: 'Intellectual Property (Patents & Trademarks)',
            moduleKey: 'ip',
            description: 'Patent filings, AI similarity checks, and trademark registrations via PACRA.',
          },
          {
            slug: 'tax',
            name: 'Tax & Compliance Discovery',
            moduleKey: 'business',
            description: 'TPIN discovery, turnover tax schedules, and ZRA compliance clearance.',
          },
        ])
        .returning();

      const catBySlug = new Map(categories.map((c) => [c.slug, c]));

      // 4. Government Services Catalog
      const insertedServices = await db
        .insert(services)
        .values([
          {
            institutionId: instByCode.get('RTSA')!.id,
            categoryId: catBySlug.get('transport')!.id,
            code: 'RTSA-ROAD-TAX',
            title: 'Motor Vehicle Road Tax Renewal',
            description: 'Quarterly or annual road tax assessment and paperless tax disc receipt.',
            feeZmw: 260,
            slaDays: 1,
            requirementsJson: ['Vehicle Registration Plate', 'NRC / TPIN', 'Active Motor Insurance'],
            workflowStepsJson: ['Vehicle Verification', 'Fee Calculation', 'Verified Payment', 'Digital Tax Disc Issued'],
          },
          {
            institutionId: instByCode.get('ZSIC')!.id,
            categoryId: catBySlug.get('transport')!.id,
            code: 'ZSIC-MOTOR-INS',
            title: 'Digital Motor Insurance Certificate',
            description: 'Third-party or comprehensive motor cover synced with RTSA compliance.',
            feeZmw: 420,
            slaDays: 1,
            requirementsJson: ['Vehicle Registration Book (White Book)', 'Owner NRC'],
            workflowStepsJson: ['Coverage Selection', 'Payment Verification', 'Digital Policy Certificate'],
          },
          {
            institutionId: instByCode.get('RTSA')!.id,
            categoryId: catBySlug.get('transport')!.id,
            code: 'RTSA-FITNESS',
            title: 'Vehicle Roadworthiness & Fitness Booking',
            description: 'Schedule inspection and receive digital certificate upon RTSA verification.',
            feeZmw: 185,
            slaDays: 2,
            requirementsJson: ['Plate Number', 'Previous Fitness Certificate'],
            workflowStepsJson: ['Inspection Booking', 'Officer Inspection', 'Digital Fitness Certificate'],
          },
          {
            institutionId: instByCode.get('LCC')!.id,
            categoryId: catBySlug.get('business')!.id,
            code: 'LCC-TRADING-PERMIT',
            title: 'Retail & SME Trading Permit',
            description: 'Annual municipal trading permit for shops, agro-dealers, and SMEs.',
            feeZmw: 650,
            slaDays: 3,
            requirementsJson: ['PACRA Certificate', 'ZRA TPIN', 'Shop Lease or Plot Reference', 'Owner NRC'],
            workflowStepsJson: ['Guided Submission', 'AI Completeness Check', 'Council Officer Review', 'Payment & Permit Issuance'],
          },
          {
            institutionId: instByCode.get('PACRA')!.id,
            categoryId: catBySlug.get('business')!.id,
            code: 'PACRA-BIZ-NAME',
            title: 'Business Name Registration (Guided)',
            description: 'Register a sole proprietorship or SME business name with PACRA.',
            feeZmw: 280,
            slaDays: 2,
            requirementsJson: ['3 Proposed Business Names', 'Applicant NRC Copy', 'Physical Business Address'],
            workflowStepsJson: ['Name Search', 'Application Filing', 'PACRA Examiner Review', 'Digital Certificate'],
          },
          {
            institutionId: instByCode.get('LCC')!.id,
            categoryId: catBySlug.get('permits')!.id,
            code: 'LCC-MARKET-LEVY',
            title: 'Municipal Market Stall Levy',
            description: 'Monthly or quarterly market trader levy for designated trading zones.',
            feeZmw: 120,
            slaDays: 1,
            requirementsJson: ['Market Zone & Stall Number', 'Trader NRC'],
            workflowStepsJson: ['Stall Verification', 'Verified Payment', 'Digital Levy Pass'],
          },
          {
            institutionId: instByCode.get('LCC')!.id,
            categoryId: catBySlug.get('permits')!.id,
            code: 'LCC-HEALTH-PERMIT',
            title: 'Food & Public Health Clearance Permit',
            description: 'Mandatory public health inspection clearance for food & hospitality businesses.',
            feeZmw: 540,
            slaDays: 5,
            requirementsJson: ['Business Permit Reference', 'Premises Floor Layout', 'Staff Health Certificates'],
            workflowStepsJson: ['Document Upload', 'Health Inspector Review', 'Fee Settlement', 'Digital Clearance'],
          },
          {
            institutionId: instByCode.get('LCC')!.id,
            categoryId: catBySlug.get('property')!.id,
            code: 'LCC-LAND-RATES',
            title: 'Council Property & Land Rates Settlement',
            description: 'Pay semi-annual or annual municipal property rates and obtain clearance.',
            feeZmw: 1450,
            slaDays: 1,
            requirementsJson: ['Plot / Stand Number', 'Council Assessment Account'],
            workflowStepsJson: ['Plot Lookup', 'Rates Calculation', 'Verified Payment', 'Digital Clearance Receipt'],
          },
          {
            institutionId: instByCode.get('ZESCO')!.id,
            categoryId: catBySlug.get('utilities')!.id,
            code: 'ZESCO-PREPAID',
            title: 'ZESCO Prepaid Electricity Token & Bill Payment',
            description: 'Purchase prepaid units or settle postpaid commercial electricity bills.',
            feeZmw: 350,
            slaDays: 1,
            requirementsJson: ['11-Digit ZESCO Meter Number'],
            workflowStepsJson: ['Meter Validation', 'Payment Verification', '20-Digit Token & Receipt'],
          },
          {
            institutionId: instByCode.get('UNZA')!.id,
            categoryId: catBySlug.get('education')!.id,
            code: 'UNZA-TUITION',
            title: 'University & School Fee Payment',
            description: 'Direct tuition settlement allocated to student institutional ledger.',
            feeZmw: 2800,
            slaDays: 1,
            requirementsJson: ['Student ID Number', 'Academic Term / Semester'],
            workflowStepsJson: ['Student Record Match', 'Payment Verification', 'Institutional Fee Receipt'],
          },
          {
            institutionId: instByCode.get('PACRA')!.id,
            categoryId: catBySlug.get('ip')!.id,
            code: 'PACRA-PATENT-FILE',
            title: 'Patent Application Filing & AI Similarity Pre-Check',
            description: 'Submit invention technical disclosures with preliminary AI similarity screening.',
            feeZmw: 950,
            slaDays: 14,
            requirementsJson: ['Invention Title & Abstract', 'Technical Claims', 'Drawings / Supporting PDF'],
            workflowStepsJson: ['AI Similarity Screening', 'Formal Filing', 'PACRA Examiner Review', 'Filing Receipt'],
          },
          {
            institutionId: instByCode.get('PACRA')!.id,
            categoryId: catBySlug.get('ip')!.id,
            code: 'PACRA-TRADEMARK-FILE',
            title: 'Trademark Name & Logo Registration',
            description: 'Search Nice classes, check brand collisions, and submit trademark filings to PACRA.',
            feeZmw: 780,
            slaDays: 10,
            requirementsJson: ['Brand Mark / Wordmark', 'Nice Classification', 'Applicant Details'],
            workflowStepsJson: ['Mark Similarity Search', 'Application Submission', 'PACRA IP Review', 'Digital Certificate'],
          },
        ])
        .returning();

      const svcByCode = new Map(insertedServices.map((s) => [s.code, s]));

      // 5. Businesses
      const insertedBusinesses = await db
        .insert(businesses)
        .values([
          {
            ownerUserId: smeUser.id,
            name: 'Kafue Agro Supplies Ltd',
            tpin: '1004829104',
            pacraRegNo: '120230048912',
            sector: 'Agricultural Retail & Inputs',
            councilArea: 'Lusaka City Council',
            wardCode: 'LSK-W12',
            employeesCount: 8,
            complianceStatus: 'renewal_due',
          },
          {
            ownerUserId: userByUid.get('demo:business_admin')!.id,
            name: 'Copperbelt Logistics & Cold Chain Plc',
            tpin: '1002918832',
            pacraRegNo: '120190011245',
            sector: 'Transport & Cold Storage',
            councilArea: 'Kitwe City Council',
            wardCode: 'KIT-W02',
            employeesCount: 42,
            complianceStatus: 'active',
          },
        ])
        .returning();

      // 6. Vehicles, Properties, Utilities, Education Accounts
      await db.insert(vehicles).values([
        {
          ownerUserId: citizenUser.id,
          plateNumber: 'BAA 4821 ZM',
          makeModel: 'Toyota Hilux Double Cab 2.4D',
          year: 2021,
          engineCc: 2393,
          vehicleClass: 'Light Commercial',
          roadTaxExpiresAt: '2026-11-30',
          insuranceProvider: 'ZSIC General Insurance',
          insuranceExpiresAt: '2027-02-15',
        },
        {
          ownerUserId: citizenUser.id,
          plateNumber: 'BAD 1904 ZM',
          makeModel: 'Toyota Corolla Fielder Hybrid',
          year: 2019,
          engineCc: 1496,
          vehicleClass: 'Private Motor Car',
          roadTaxExpiresAt: '2026-12-18',
          insuranceProvider: 'Madison General',
          insuranceExpiresAt: '2027-01-20',
        },
      ]);

      await db.insert(properties).values([
        {
          ownerUserId: citizenUser.id,
          plotNumber: 'Plot LSK/4418/M (Ibex Hill)',
          councilName: 'Lusaka City Council',
          wardCode: 'LSK-W04',
          propertyType: 'Residential Dwelling',
          assessedValueZmw: 1850000,
          annualRatesZmw: 2400,
          outstandingZmw: 1200,
        },
        {
          ownerUserId: smeUser.id,
          plotNumber: 'Stand 884/Chawama Commercial',
          councilName: 'Lusaka City Council',
          wardCode: 'LSK-W12',
          propertyType: 'Commercial Shopfront',
          assessedValueZmw: 920000,
          annualRatesZmw: 3100,
          outstandingZmw: 1550,
        },
      ]);

      await db.insert(utilityAccounts).values([
        {
          ownerUserId: citizenUser.id,
          providerCode: 'ZESCO',
          meterNumber: '04281993104',
          accountLabel: 'Ibex Hill Residence Meter',
          tariffType: 'Residential R1',
          outstandingBalanceZmw: 0,
          lastToken: '4821-9034-1129-7740-5512',
        },
        {
          ownerUserId: smeUser.id,
          providerCode: 'ZESCO',
          meterNumber: '07199402815',
          accountLabel: 'Kafue Agro Shopfront C1',
          tariffType: 'Commercial C1',
          outstandingBalanceZmw: 840,
          lastToken: '9021-4481-2209-6104-3819',
        },
      ]);

      await db.insert(educationAccounts).values([
        {
          ownerUserId: citizenUser.id,
          institutionId: instByCode.get('UNZA')!.id,
          studentId: '202408812',
          studentName: 'Mutale Banda',
          schoolName: 'University of Zambia (UNZA)',
          program: 'B.Eng. Civil & Environmental Engineering',
          termBalanceZmw: 2800,
        },
        {
          ownerUserId: citizenUser.id,
          institutionId: instByCode.get('UNZA')!.id,
          studentId: 'SCH-2026-441',
          studentName: 'Taonga Banda',
          schoolName: 'Kabulonga Girls Secondary School',
          program: 'Grade 11 STEM Track',
          termBalanceZmw: 950,
        },
      ]);

      // 7. Applications & Documents
      const insertedApps = await db
        .insert(applications)
        .values([
          {
            referenceCode: 'OGV-APP-2026-8841',
            applicantUserId: smeUser.id,
            businessId: insertedBusinesses[0].id,
            serviceId: svcByCode.get('LCC-TRADING-PERMIT')!.id,
            institutionId: instByCode.get('LCC')!.id,
            status: 'under_review',
            currentStep: 'Council Officer Review',
            formDataJson: {
              businessName: 'Kafue Agro Supplies Ltd',
              ward: 'Chawama Ward 12',
              activity: 'Agricultural seed & fertilizer retail',
              tpin: '1004829104',
            },
            aiCompletenessScore: 96,
            reviewerNotes: 'Awaiting premises floor confirmation from LCC officer.',
          },
          {
            referenceCode: 'OGV-APP-2026-8790',
            applicantUserId: citizenUser.id,
            businessId: null,
            serviceId: svcByCode.get('RTSA-FITNESS')!.id,
            institutionId: instByCode.get('RTSA')!.id,
            status: 'approved',
            currentStep: 'Digital Fitness Certificate Issued',
            formDataJson: {
              plateNumber: 'BAA 4821 ZM',
              inspectionCentre: 'Lusaka Mimosa Station',
            },
            aiCompletenessScore: 100,
            reviewerNotes: 'Vehicle passed emissions and brake inspection.',
          },
        ])
        .returning();

      await db.insert(applicationDocuments).values([
        {
          applicationId: insertedApps[0].id,
          fileName: 'PACRA_Certificate_Kafue_Agro.pdf',
          docType: 'PACRA Registration Certificate',
          ocrSummary: 'Verified PACRA Certificate #120230048912 issued to Kafue Agro Supplies Ltd.',
          extractedJson: {
            entityName: 'Kafue Agro Supplies Ltd',
            registrationNumber: '120230048912',
            status: 'Active',
          },
          validationStatus: 'verified',
        },
      ]);

      // 8. Payments & Digital Receipts
      const insertedPayments = await db
        .insert(payments)
        .values([
          {
            referenceCode: 'PAY-ZM-2026-90121',
            receiptNumber: 'RCPT-OGV-0090121',
            payerUserId: citizenUser.id,
            institutionId: instByCode.get('RTSA')!.id,
            serviceCode: 'RTSA-ROAD-TAX',
            serviceTitle: 'Motor Vehicle Road Tax (BAD 1904 ZM)',
            amountZmw: 790,
            channel: 'MTN MoMo',
            providerRef: 'MOMO-SBX-7782190',
            status: 'verified',
            reconciliationStatus: 'reconciled',
            province: 'Lusaka',
            councilName: 'Lusaka City Council',
            wardCode: 'LSK-W04',
            paperPagesSaved: 4,
          },
          {
            referenceCode: 'PAY-ZM-2026-90144',
            receiptNumber: 'RCPT-OGV-0090144',
            payerUserId: citizenUser.id,
            institutionId: instByCode.get('ZESCO')!.id,
            serviceCode: 'ZESCO-PREPAID',
            serviceTitle: 'ZESCO Prepaid Electricity (Meter 04281993104)',
            amountZmw: 350,
            channel: 'Airtel Money',
            providerRef: 'AIRTEL-SBX-3391042',
            status: 'verified',
            reconciliationStatus: 'reconciled',
            province: 'Lusaka',
            councilName: 'Lusaka City Council',
            wardCode: 'LSK-W04',
            paperPagesSaved: 3,
          },
          {
            referenceCode: 'PAY-ZM-2026-90167',
            receiptNumber: 'RCPT-OGV-0090167',
            payerUserId: smeUser.id,
            institutionId: instByCode.get('LCC')!.id,
            serviceCode: 'LCC-LAND-RATES',
            serviceTitle: 'Lusaka Commercial Property Rates (Stand 884)',
            amountZmw: 1550,
            channel: 'Zanaco Bank',
            providerRef: 'ZANACO-SBX-119023',
            status: 'verified',
            reconciliationStatus: 'reconciled',
            province: 'Lusaka',
            councilName: 'Lusaka City Council',
            wardCode: 'LSK-W12',
            paperPagesSaved: 6,
          },
          {
            referenceCode: 'PAY-ZM-2026-90188',
            receiptNumber: 'RCPT-OGV-0090188',
            payerUserId: userByUid.get('demo:business_admin')!.id,
            institutionId: instByCode.get('KCC')!.id,
            serviceCode: 'LCC-TRADING-PERMIT',
            serviceTitle: 'Kitwe City Council Commercial Depot Licence',
            amountZmw: 3200,
            channel: 'Visa / Mastercard',
            providerRef: 'CARD-SBX-884012',
            status: 'verified',
            reconciliationStatus: 'pending_bank_batch',
            province: 'Copperbelt',
            councilName: 'Kitwe City Council',
            wardCode: 'KIT-W02',
            paperPagesSaved: 5,
          },
          {
            referenceCode: 'PAY-ZM-2026-90201',
            receiptNumber: 'RCPT-OGV-0090201',
            payerUserId: ipApplicant.id,
            institutionId: instByCode.get('PACRA')!.id,
            serviceCode: 'PACRA-PATENT-FILE',
            serviceTitle: 'PACRA Patent Filing Fee (Solar Cassava Dryer)',
            amountZmw: 950,
            channel: 'MTN MoMo',
            providerRef: 'MOMO-SBX-9910421',
            status: 'verified',
            reconciliationStatus: 'reconciled',
            province: 'Lusaka',
            councilName: 'Lusaka City Council',
            wardCode: 'LSK-W04',
            paperPagesSaved: 8,
          },
        ])
        .returning();

      // 9. GIS Revenue Zones (Councils, Wards, Markets, Trading Zones)
      const insertedZones = await db
        .insert(revenueZones)
        .values([
          {
            zoneCode: 'LSK-W12',
            name: 'Chawama Ward 12',
            zoneType: 'ward',
            province: 'Lusaka',
            district: 'Lusaka',
            councilName: 'Lusaka City Council',
            institutionId: instByCode.get('LCC')!.id,
            expectedRevenueZmw: 100000,
            actualRevenueZmw: 35000,
            registeredBusinesses: 420,
            activePermits: 148,
            unpaidProperties: 186,
            latitude: '-15.4628',
            longitude: '28.2684',
            mapX: 390,
            mapY: 365,
            indicatorsJson: [
              'Only 35% of registered businesses hold active 2026 trading permits',
              '186 commercial/residential plots show unpaid land rates',
              '2 POS market levy terminals recorded 14 hours offline downtime last month',
            ],
          },
          {
            zoneCode: 'LSK-W04',
            name: 'Kabulonga Ward 04',
            zoneType: 'ward',
            province: 'Lusaka',
            district: 'Lusaka',
            councilName: 'Lusaka City Council',
            institutionId: instByCode.get('LCC')!.id,
            expectedRevenueZmw: 100000,
            actualRevenueZmw: 92000,
            registeredBusinesses: 210,
            activePermits: 196,
            unpaidProperties: 14,
            latitude: '-15.4241',
            longitude: '28.3292',
            mapX: 435,
            mapY: 335,
            indicatorsJson: [
              '93% active permit compliance across retail outlets',
              'Automated digital property billing reminders active',
            ],
          },
          {
            zoneCode: 'LSK-MKT-SOW',
            name: 'Soweto Market Revenue Zone',
            zoneType: 'market',
            province: 'Lusaka',
            district: 'Lusaka',
            councilName: 'Lusaka City Council',
            institutionId: instByCode.get('LCC')!.id,
            expectedRevenueZmw: 150000,
            actualRevenueZmw: 64500,
            registeredBusinesses: 1240,
            activePermits: 520,
            unpaidProperties: 45,
            latitude: '-15.4192',
            longitude: '28.2711',
            mapX: 375,
            mapY: 342,
            indicatorsJson: [
              '58% stall levy gap between physical stall occupancy and digital receipts',
              'Unreconciled cash-to-mobile-money batch records from Section C',
            ],
          },
          {
            zoneCode: 'LSK-TRD-KAM',
            name: 'Kamwala Trading Zone',
            zoneType: 'trading_zone',
            province: 'Lusaka',
            district: 'Lusaka',
            councilName: 'Lusaka City Council',
            institutionId: instByCode.get('LCC')!.id,
            expectedRevenueZmw: 120000,
            actualRevenueZmw: 98400,
            registeredBusinesses: 540,
            activePermits: 445,
            unpaidProperties: 32,
            latitude: '-15.4285',
            longitude: '28.2882',
            mapX: 408,
            mapY: 348,
            indicatorsJson: [
              '82% collection rate; 95 wholesale permits nearing Q4 renewal',
            ],
          },
          {
            zoneCode: 'KIT-W02',
            name: 'Kitwe Central & Chisokone Zone',
            zoneType: 'market',
            province: 'Copperbelt',
            district: 'Kitwe',
            councilName: 'Kitwe City Council',
            institutionId: instByCode.get('KCC')!.id,
            expectedRevenueZmw: 180000,
            actualRevenueZmw: 147600,
            registeredBusinesses: 890,
            activePermits: 740,
            unpaidProperties: 61,
            latitude: '-12.8024',
            longitude: '28.2132',
            mapX: 355,
            mapY: 225,
            indicatorsJson: [
              '82% collection rate across mining supply SMEs and Chisokone stalls',
              'Pending bank batch reconciliation of K14,200',
            ],
          },
          {
            zoneCode: 'KIT-W09',
            name: 'Wusakile Industrial & Property Zone',
            zoneType: 'property_zone',
            province: 'Copperbelt',
            district: 'Kitwe',
            councilName: 'Kitwe City Council',
            institutionId: instByCode.get('KCC')!.id,
            expectedRevenueZmw: 95000,
            actualRevenueZmw: 41800,
            registeredBusinesses: 185,
            activePermits: 76,
            unpaidProperties: 112,
            latitude: '-12.8380',
            longitude: '28.2410',
            mapX: 382,
            mapY: 245,
            indicatorsJson: [
              '44% collection efficiency; 112 industrial/housing plots missing updated valuation rolls',
              'Low formal business registration coverage in light-industrial annex',
            ],
          },
          {
            zoneCode: 'LVS-W01',
            name: 'Maramba & Livingstone CBD',
            zoneType: 'trading_zone',
            province: 'Southern',
            district: 'Livingstone',
            councilName: 'Livingstone City Council',
            institutionId: instByCode.get('LVCC')!.id,
            expectedRevenueZmw: 110000,
            actualRevenueZmw: 94600,
            registeredBusinesses: 390,
            activePermits: 344,
            unpaidProperties: 19,
            latitude: '-17.8419',
            longitude: '25.8542',
            mapX: 245,
            mapY: 465,
            indicatorsJson: [
              '86% compliance supported by hospitality digital permit renewals',
            ],
          },
          {
            zoneCode: 'NDO-W06',
            name: 'Ndola Masala Trading Ward',
            zoneType: 'ward',
            province: 'Copperbelt',
            district: 'Ndola',
            councilName: 'Kitwe City Council',
            institutionId: instByCode.get('KCC')!.id,
            expectedRevenueZmw: 85000,
            actualRevenueZmw: 40800,
            registeredBusinesses: 310,
            activePermits: 142,
            unpaidProperties: 94,
            latitude: '-12.9766',
            longitude: '28.6366',
            mapX: 405,
            mapY: 235,
            indicatorsJson: [
              '48% collection performance; high ratio of inactive vs active trader accounts',
              'Billing address mismatches delaying rates notices',
            ],
          },
        ])
        .returning();

      // 10. Council Revenue Investigations
      await db.insert(investigations).values([
        {
          caseCode: 'INV-LCC-2026-014',
          zoneId: insertedZones[0].id,
          assignedOfficerId: councilOfficer.id,
          title: 'Chawama Ward 12 Revenue Gap Assessment (35% Collection)',
          status: 'in_progress',
          priority: 'high',
          confirmedFindingsJson: [
            'Verified collections stand at K35,000 against K100,000 target (65% shortfall).',
            '272 out of 420 registered enterprises lack an active 2026 trading permit record.',
            '186 property rate accounts carry unpaid balances exceeding 90 days.',
          ],
          possibleExplanationsJson: [
            'High proportion of informal traders operating without updated digital business profiles.',
            'Intermittent market POS connectivity in Zone B may have delayed levy uploads.',
            'Recent plot subdivisions may not yet be reflected in council valuation rolls.',
          ],
          furtherInvestigationJson: [
            'Conduct physical field verification of 45 inactive commercial permits along Chawama Main Road.',
            'Audit POS terminal sync logs for October–November collection windows.',
            'Issue SMS payment reminders in English, Nyanja, and Bemba to overdue property owners.',
          ],
          officerNotes: 'Field verification scheduled with Lusaka City Council Revenue Unit.',
        },
      ]);

      // 11. IP Applications (Patents & Trademarks)
      await db.insert(ipApplications).values([
        {
          referenceCode: 'PACRA-PAT-DEMO-2026-104',
          applicantUserId: ipApplicant.id,
          institutionId: instByCode.get('PACRA')!.id,
          ipType: 'patent',
          title: 'Solar-Powered Cassava Drying Chamber with IoT Moisture Telemetry',
          description:
            'A closed-loop solar thermal agricultural dryer designed for rural Zambian cooperatives featuring automated humidity vents and low-power GSM moisture alerts.',
          classification: 'A23N / F26B (Agricultural Drying)',
          status: 'examiner_review',
          similarityReportJson: {
            topMatches: [
              {
                reference: 'ZM-PAT-2023-0041',
                title: 'Hybrid Solar Maize & Grain Tunnel Dryer with Passive Convection',
                similarityPct: 48,
                overlapNotes: 'Shares solar collector thermal airflow architecture; differs in IoT moisture telemetry.',
              },
              {
                reference: 'ARIPO-AP-2022-119',
                title: 'Automated Solar Dehydrator for Root Crops',
                similarityPct: 39,
                overlapNotes: 'Similar cassava slicing tray geometry; lacks automated GSM threshold alerts.',
              },
            ],
            disclaimer:
              'Preliminary AI similarity screening only. This does NOT constitute a legal determination of novelty, patentability, or infringement. PACRA retains sole statutory examination authority.',
          },
        },
        {
          referenceCode: 'PACRA-TM-DEMO-2026-219',
          applicantUserId: smeUser.id,
          institutionId: instByCode.get('PACRA')!.id,
          ipType: 'trademark',
          title: 'KAFUE GREEN HARVEST',
          description: 'Wordmark and stylized maize-leaf emblem for certified Zambian agro-inputs and seed packaging.',
          classification: 'Nice Class 31 (Agricultural Seeds & Grains)',
          status: 'submitted',
          similarityReportJson: {
            topMatches: [
              {
                reference: 'ZM-TM-2021-3910',
                title: 'KAFUE VALLEY SEEDS',
                similarityPct: 42,
                overlapNotes: 'Shared geographic prefix "Kafue" in Class 31; distinct secondary terms and emblem.',
              },
            ],
            disclaimer:
              'Preliminary AI trademark screening only. PACRA remains the sole authority for statutory trademark registration.',
          },
        },
      ]);

      // 12. Fraud & Anomaly Alerts
      await db.insert(fraudAlerts).values([
        {
          alertCode: 'ANOM-2026-041',
          institutionId: instByCode.get('LCC')!.id,
          paymentId: insertedPayments[2].id,
          category: 'Reconciliation Discrepancy',
          severity: 'medium',
          description: '3 duplicate mobile money callback attempts detected and blocked prior to receipt issuance in Soweto Market Zone.',
          status: 'flagged',
        },
        {
          alertCode: 'ANOM-2026-042',
          institutionId: instByCode.get('RTSA')!.id,
          paymentId: insertedPayments[0].id,
          category: 'Repeated Failed Attempts',
          severity: 'low',
          description: 'Multiple rapid quote lookups from unverified IP range on RTSA plate verification endpoint (rate-limited).',
          status: 'under_review',
        },
      ]);

      // 13. Notifications
      await db.insert(notifications).values([
        {
          userId: citizenUser.id,
          channel: 'in_app',
          category: 'renewal_reminder',
          title: 'Road Tax Renewal Upcoming (BAA 4821 ZM)',
          message: 'Your illustrative Road Tax cycle for Toyota Hilux BAA 4821 ZM expires on 2026-11-30.',
          isRead: false,
        },
        {
          userId: smeUser.id,
          channel: 'sms',
          category: 'application_update',
          title: 'LCC Trading Permit Under Review',
          message: 'Application OGV-APP-2026-8841 has passed AI document completeness (96%) and is with Lusaka City Council.',
          isRead: false,
        },
        {
          userId: councilOfficer.id,
          channel: 'in_app',
          category: 'revenue_alert',
          title: 'Chawama Ward 12 Collection Below 40% Threshold',
          message: 'AI Revenue Intelligence flagged Chawama Ward 12 at 35% performance (K35,000 / K100,000).',
          isRead: false,
        },
      ]);

      // 14. Audit Logs
      await db.insert(auditLogs).values([
        {
          actorUid: 'demo:zra_admin',
          actorRole: 'zra_admin',
          institutionCode: 'ZRA',
          action: 'VIEW_CONSOLIDATED_REVENUE',
          targetEntity: 'ZRA_MASTER_DASHBOARD',
          details: 'Viewed consolidated revenue metrics across 3 provinces (read-only institutional boundaries enforced).',
        },
        {
          actorUid: 'demo:council_officer',
          actorRole: 'council_officer',
          institutionCode: 'LCC',
          action: 'CREATE_INVESTIGATION',
          targetEntity: 'INV-LCC-2026-014',
          details: 'Opened ward revenue shortfall case for Chawama Ward 12 (LSK-W12).',
        },
      ]);

      // 15. Platform Configuration (Multi-Country / Currency / Language Extensible)
      await db.insert(platformConfig).values([
        {
          configKey: 'regional_profile',
          configValueJson: {
            country: 'Zambia',
            countryCode: 'ZM',
            currencyCode: 'ZMW',
            currencySymbol: 'K',
            defaultLanguage: 'en',
            supportedLanguages: [
              { code: 'en', label: 'English' },
              { code: 'bem', label: 'Icibemba' },
              { code: 'nya', label: 'Chinyanja' },
              { code: 'toi', label: 'Chitonga' },
            ],
            greenerZambiaEnabled: true,
            environmentBanner: 'DEMO / SANDBOX ENVIRONMENT — SIMULATED INSTITUTIONAL INTEGRATIONS',
          },
        },
      ]);

      seededOnce = true;
    } catch (error) {
      console.error('Seed data initialization failed:', error);
      throw error;
    } finally {
      seedingPromise = null;
    }
  })();

  return seedingPromise;
}

export async function getUserByRoleDemo(role: string) {
  const uid = `demo:${role}`;
  const rows = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
  return rows[0] ?? null;
}

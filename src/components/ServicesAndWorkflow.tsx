import React, { useState } from 'react';
import {
  CheckCircle2,
  FileSearch,
  Leaf,
  Printer,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
} from 'lucide-react';
import { useOneGov } from '../context/OneGovContext';
import { formatZmw } from '../lib/onegovRules';
import type { PaymentItem, ServiceItem } from '../types/onegov';

export const ServiceDirectoryView: React.FC = () => {
  const { services, setSelectedService, setActiveScreen, openCheckout } = useOneGov();
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [detailService, setDetailService] = useState<ServiceItem | null>(null);

  const categories = [
    { slug: 'all', label: 'All Services' },
    { slug: 'transport', label: 'Transport' },
    { slug: 'business', label: 'Business & SME' },
    { slug: 'permits', label: 'Licences & Permits' },
    { slug: 'property', label: 'Property & Land' },
    { slug: 'utilities', label: 'Utilities' },
    { slug: 'education', label: 'Education' },
    { slug: 'ip', label: 'Intellectual Property' },
  ];

  const filtered = services.filter((s) => {
    const matchesCat = categoryFilter === 'all' || s.categorySlug === categoryFilter;
    const q = query.trim().toLowerCase();
    const matchesQ =
      !q ||
      s.title.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.institutionCode.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q);
    return matchesCat && matchesQ;
  });

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-xl font-bold text-[#0B192C]">Government Service Directory</h1>
            <p className="text-sm text-slate-600">
              Discover participating government and municipal services without knowing institutional silos.
            </p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              aria-label="Search government services"
              placeholder="Search road tax, trading permit, ZESCO..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg mb-6">
          {categories.map((cat) => (
            <button
              key={cat.slug}
              type="button"
              onClick={() => setCategoryFilter(cat.slug)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                categoryFilter === cat.slug
                  ? 'bg-white text-[#0B192C] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((svc) => (
            <div key={svc.code} className="border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <div className="text-xs text-slate-500 font-mono mb-1">
                  {svc.institutionCode} · {svc.categoryName} · SLA {svc.slaDays}d
                </div>
                <h3 className="text-base font-bold text-[#0B192C] mb-1.5">{svc.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">{svc.description}</p>
              </div>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-sm font-bold font-mono text-[#0B192C]">
                  {formatZmw(svc.feeZmw)}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailService(svc)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
                  >
                    Details
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedService(svc);
                      setActiveScreen('application-workflow');
                    }}
                    className="px-3 py-1.5 text-xs font-semibold bg-[#059669] hover:bg-[#047857] text-white rounded-md cursor-pointer"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {detailService && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="text-xs font-mono text-slate-500">
                Service Details · {detailService.code} · {detailService.institutionName}
              </div>
              <h2 className="text-lg font-bold text-[#0B192C] mt-1">{detailService.title}</h2>
            </div>
            <button
              type="button"
              onClick={() => setDetailService(null)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-xs font-semibold text-slate-700 mb-2">Required Documents & Inputs</h3>
              <ul className="space-y-1.5 text-sm text-slate-600 list-disc pl-4">
                {detailService.requirementsJson.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-700 mb-2">Configurable Institutional Workflow</h3>
              <ol className="space-y-1.5 text-sm text-slate-600 list-decimal pl-4">
                {detailService.workflowStepsJson.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          </div>
          <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setSelectedService(detailService);
                setActiveScreen('application-workflow');
              }}
              className="px-4 py-2 bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              Start Guided Application
            </button>
            <button
              type="button"
              onClick={() =>
                openCheckout({
                  serviceCode: detailService.code,
                  serviceTitle: detailService.title,
                  amountZmw: detailService.feeZmw,
                })
              }
              className="px-4 py-2 bg-[#0B192C] hover:bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              Pay Illustrative Fee ({formatZmw(detailService.feeZmw)})
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const ApplicationWorkflowView: React.FC = () => {
  const {
    services,
    selectedService,
    setSelectedService,
    overview,
    apiFetch,
    refreshWorkspace,
    setActiveScreen,
    openCheckout,
  } = useOneGov();

  const activeSvc = selectedService || services.find((s) => s.code === 'LCC-TRADING-PERMIT') || services[0];
  const [applicantNote, setApplicantNote] = useState('Kafue Agro Supplies Ltd — Stand 884 Chawama Main Road');
  const [entityIdentifier, setEntityIdentifier] = useState('PACRA 120230048912 · TPIN 1004829104');
  const [docName, setDocName] = useState('PACRA_Registration_Cert_2026.pdf');
  const [docSampleText, setDocSampleText] = useState(
    'PATENTS AND COMPANIES REGISTRATION AGENCY (PACRA)\nCertificate of Registration: 120230048912\nEntity Name: Kafue Agro Supplies Ltd\nZRA TPIN: 1004829104\nCouncil Ward: Chawama Ward 12, Lusaka',
  );
  const [imageBase64, setImageBase64] = useState<string | undefined>(undefined);
  const [imageMimeType, setImageMimeType] = useState<string | undefined>(undefined);
  const [ocrResult, setOcrResult] = useState<{
    detectedDocType: string;
    extractedFields: Array<{ key: string; value: string }>;
    completenessScore: number;
    missingItems: string[];
    validationNotes: string;
  } | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedApp, setSubmittedApp] = useState<{ referenceCode: string; serviceTitle: string; institutionCode: string } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocName(file.name);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        const res = String(reader.result || '');
        const base64 = res.split(',')[1];
        setImageBase64(base64);
        setImageMimeType(file.type);
      };
      reader.readAsDataURL(file);
    } else {
      setImageBase64(undefined);
      setImageMimeType(undefined);
      file.text().then((txt) => {
        if (txt) setDocSampleText(txt.slice(0, 3000));
      }).catch(() => undefined);
    }
  };

  const runAiDocumentCheck = async () => {
    setOcrError(null);
    setOcrLoading(true);
    try {
      const res = await apiFetch<typeof ocrResult>('/api/ai/document-ocr', {
        method: 'POST',
        body: JSON.stringify({
          fileName: docName,
          documentText: docSampleText,
          requiredDocs: activeSvc?.requirementsJson || [],
          imageBase64,
          imageMimeType,
        }),
      });
      setOcrResult(res);
    } catch (err: any) {
      setOcrError(err?.message || 'AI Document OCR analysis failed.');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSvc) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const extractedMap: Record<string, unknown> = {};
      ocrResult?.extractedFields.forEach((f) => {
        extractedMap[f.key] = f.value;
      });
      const res = await apiFetch<{ application: { referenceCode: string; serviceTitle: string; institutionCode: string } }>(
        '/api/applications',
        {
          method: 'POST',
          body: JSON.stringify({
            serviceCode: activeSvc.code,
            businessId: overview?.businesses[0]?.id ?? null,
            formData: {
              applicantNote,
              entityIdentifier,
            },
            documentName: docName,
            ocrSummary: ocrResult?.validationNotes || 'Uploaded supporting document.',
            extractedFields: extractedMap,
            aiCompletenessScore: ocrResult?.completenessScore ?? 95,
          }),
        },
      );
      setSubmittedApp(res.application);
      await refreshWorkspace();
    } catch (err: any) {
      setSubmitError(err?.message || 'Unable to submit application.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!activeSvc) return null;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-5">
          <div>
            <div className="text-xs font-mono text-[#059669] mb-1">
              Guided Application & AI Document Intelligence · {activeSvc.institutionCode}
            </div>
            <h1 className="text-xl font-bold text-[#0B192C]">{activeSvc.title}</h1>
          </div>
          <div className="w-full md:w-72">
            <label htmlFor="workflow-service-select" className="block text-[11px] font-semibold text-slate-500 mb-1">
              Switch Service
            </label>
            <select
              id="workflow-service-select"
              value={activeSvc.code}
              onChange={(e) => {
                const found = services.find((s) => s.code === e.target.value);
                if (found) setSelectedService(found);
              }}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              {services.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.institutionCode} — {s.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Workflow Step Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
          {activeSvc.workflowStepsJson.map((step, idx) => (
            <div key={step} className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="text-[11px] font-mono text-slate-500">Step 0{idx + 1}</div>
              <div className="text-xs font-semibold text-[#0B192C] mt-0.5">{step}</div>
            </div>
          ))}
        </div>

        {submittedApp ? (
          <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-emerald-900 font-bold text-base">
              <CheckCircle2 className="w-5 h-5 text-[#059669]" />
              Application Routed to {submittedApp.institutionCode}
            </div>
            <p className="text-sm text-emerald-800">
              Reference <span className="font-mono font-bold">{submittedApp.referenceCode}</span> for{' '}
              <strong>{submittedApp.serviceTitle}</strong> has been saved and routed for authorised human officer review.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveScreen('application-tracking')}
                className="px-4 py-2 bg-[#0B192C] text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Track Application Status
              </button>
              <button
                type="button"
                onClick={() =>
                  openCheckout({
                    serviceCode: activeSvc.code,
                    serviceTitle: activeSvc.title,
                    amountZmw: activeSvc.feeZmw,
                  })
                }
                className="px-4 py-2 bg-[#059669] text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Proceed to Fee Payment ({formatZmw(activeSvc.feeZmw)})
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmitApplication} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 space-y-4">
              <h2 className="text-sm font-bold text-[#0B192C]">1. Guided Application Details</h2>
              {submitError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">{submitError}</div>
              )}
              <div>
                <label htmlFor="app-entity-id" className="block text-xs font-semibold text-slate-700 mb-1">
                  NRC / TPIN / PACRA or Vehicle Identifier
                </label>
                <input
                  id="app-entity-id"
                  type="text"
                  required
                  value={entityIdentifier}
                  onChange={(e) => setEntityIdentifier(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="app-notes" className="block text-xs font-semibold text-slate-700 mb-1">
                  Premises / Service Details
                </label>
                <textarea
                  id="app-notes"
                  rows={3}
                  required
                  value={applicantNote}
                  onChange={(e) => setApplicantNote(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-xs font-semibold text-slate-700 mb-1.5">Required Checklist</div>
                <ul className="space-y-1 text-xs text-slate-600">
                  {activeSvc.requirementsJson.map((req) => (
                    <li key={req}>· {req}</li>
                  ))}
                </ul>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 bg-[#059669] hover:bg-[#047857] text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
              >
                {submitting ? 'Submitting to Institution...' : `Submit Application to ${activeSvc.institutionCode}`}
              </button>
            </div>

            <div className="lg:col-span-6 space-y-4 border-t lg:border-t-0 lg:border-l border-slate-200 pt-5 lg:pt-0 lg:pl-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#0B192C] flex items-center gap-1.5">
                  <FileSearch className="w-4 h-4 text-[#059669]" /> 2. AI Document Upload & OCR Validation
                </h2>
                <span className="text-[11px] text-slate-500">Powered by OneGov Intelligence</span>
              </div>

              <div>
                <label htmlFor="doc-upload-input" className="block text-xs font-semibold text-slate-700 mb-1">
                  Upload Sample Document (Image or Text/PDF)
                </label>
                <label
                  htmlFor="doc-upload-input"
                  className="flex items-center justify-between px-3 py-2 border border-dashed border-slate-300 rounded-lg text-xs text-slate-600 hover:border-[#059669] cursor-pointer"
                >
                  <span className="truncate">{docName}</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-[#059669]">
                    <Upload className="w-3.5 h-3.5" /> Choose File
                  </span>
                </label>
                <input id="doc-upload-input" type="file" onChange={handleFileChange} className="sr-only" />
              </div>

              <div>
                <label htmlFor="doc-ocr-text" className="block text-xs font-semibold text-slate-700 mb-1">
                  Document Text / OCR Sample Content
                </label>
                <textarea
                  id="doc-ocr-text"
                  rows={4}
                  value={docSampleText}
                  onChange={(e) => setDocSampleText(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>

              <button
                type="button"
                onClick={runAiDocumentCheck}
                disabled={ocrLoading}
                className="px-4 py-2 bg-[#0B192C] hover:bg-slate-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {ocrLoading ? 'Running AI OCR & Completeness Check...' : 'Scan Document with AI Intelligence'}
              </button>

              {ocrError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{ocrError}</div>
              )}

              {ocrResult && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#0B192C]">{ocrResult.detectedDocType}</span>
                    <span className="font-mono font-bold text-[#059669]">
                      Completeness: {ocrResult.completenessScore}%
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {ocrResult.extractedFields.map((f) => (
                      <div key={f.key} className="bg-white border border-slate-200 rounded p-2">
                        <div className="text-[11px] text-slate-500">{f.key}</div>
                        <div className="font-mono font-semibold text-[#0B192C] truncate">{f.value}</div>
                      </div>
                    ))}
                  </div>
                  {ocrResult.missingItems.length > 0 && (
                    <div className="text-amber-800">
                      <strong>Missing / Needs Attention:</strong> {ocrResult.missingItems.join(', ')}
                    </div>
                  )}
                  <p className="text-slate-600">{ocrResult.validationNotes}</p>
                </div>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export const ApplicationTrackingView: React.FC = () => {
  const { overview, setActiveScreen } = useOneGov();
  const apps = overview?.applications ?? [];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0B192C]">Application Tracking</h1>
          <p className="text-sm text-slate-600">
            Real-time workflow routing across participating Zambian government institutions.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setActiveScreen('service-directory')}
          className="px-4 py-2 bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold rounded-lg cursor-pointer"
        >
          New Application
        </button>
      </div>

      {apps.length === 0 ? (
        <div className="py-8 text-sm text-slate-500">No applications recorded for this account yet.</div>
      ) : (
        <div className="space-y-4">
          {apps.map((a) => (
            <div key={a.id} className="border border-slate-200 rounded-xl p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div>
                  <div className="text-xs font-mono text-slate-500">
                    {a.referenceCode} · {a.institutionName} ({a.institutionCode})
                  </div>
                  <h2 className="text-base font-bold text-[#0B192C]">{a.serviceTitle}</h2>
                </div>
                <span className="text-xs font-semibold text-[#059669] capitalize">
                  {a.status.replace(/_/g, ' ')} · AI Completeness {a.aiCompletenessScore}%
                </span>
              </div>
              <div className="text-xs text-slate-600 mb-2">
                <strong>Current Stage:</strong> {a.currentStep}
              </div>
              {a.reviewerNotes && (
                <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <strong>Officer / Workflow Note:</strong> {a.reviewerNotes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const PaymentAndReceiptsView: React.FC = () => {
  const {
    overview,
    pendingCheckout,
    clearCheckout,
    activeReceipt,
    setActiveReceipt,
    apiFetch,
    refreshWorkspace,
  } = useOneGov();

  const [channel, setChannel] = useState<
    'MTN MoMo' | 'Airtel Money' | 'Zamtel Kwacha' | 'Zanaco Bank' | 'Visa / Mastercard'
  >('MTN MoMo');
  const [accountIdentifier, setAccountIdentifier] = useState('0977123456');
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [verifiedStage, setVerifiedStage] = useState<'idle' | 'verifying'>('idle');

  const payments = overview?.payments ?? [];

  const handleConfirmSandboxPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingCheckout) return;
    setPayError(null);
    setPaying(true);
    setVerifiedStage('verifying');
    try {
      const res = await apiFetch<{ payment: PaymentItem }>('/api/payments/sandbox', {
        method: 'POST',
        body: JSON.stringify({
          ...pendingCheckout,
          channel,
          accountIdentifier,
        }),
      });
      setActiveReceipt(res.payment);
      clearCheckout();
      await refreshWorkspace();
    } catch (err: any) {
      setPayError(err?.message || 'Payment verification failed.');
    } finally {
      setPaying(false);
      setVerifiedStage('idle');
    }
  };

  return (
    <div className="space-y-6">
      {pendingCheckout && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
            <div>
              <span className="text-xs font-mono text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded">
                DEMO PAYMENT SANDBOX · VERIFIED BEFORE RECEIPT
              </span>
              <h1 className="text-xl font-bold text-[#0B192C] mt-2">{pendingCheckout.serviceTitle}</h1>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Illustrative Amount</div>
              <div className="text-2xl font-bold font-mono text-[#0B192C]">
                {formatZmw(pendingCheckout.amountZmw)}
              </div>
            </div>
          </div>

          {payError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {payError}
            </div>
          )}

          <form onSubmit={handleConfirmSandboxPayment} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label htmlFor="pay-channel" className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Channel
                </label>
                <select
                  id="pay-channel"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as typeof channel)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="MTN MoMo">MTN Mobile Money (Demo Sandbox)</option>
                  <option value="Airtel Money">Airtel Money (Demo Sandbox)</option>
                  <option value="Zamtel Kwacha">Zamtel Kwacha (Demo Sandbox)</option>
                  <option value="Zanaco Bank">Zanaco / Bank Transfer (Demo Sandbox)</option>
                  <option value="Visa / Mastercard">Visa / Mastercard (Demo Sandbox)</option>
                </select>
              </div>
              <div>
                <label htmlFor="pay-account-id" className="block text-xs font-semibold text-slate-700 mb-1">
                  {channel.includes('Bank') || channel.includes('Visa')
                    ? 'Account or Card Reference'
                    : 'Zambian Mobile Number'}
                </label>
                <input
                  id="pay-account-id"
                  type="text"
                  required
                  value={accountIdentifier}
                  onChange={(e) => setAccountIdentifier(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
              <div className="text-xs text-slate-600 space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-[#0B192C]">
                  <ShieldCheck className="w-4 h-4 text-[#059669]" /> Payment Verification Guarantee
                </div>
                <p>
                  OneGov never displays a payment as successful until verified by the payment provider sandbox and
                  allocated to the participating institution ledger.
                </p>
              </div>
              <div className="flex items-center gap-3 mt-4">
                <button
                  type="submit"
                  disabled={paying}
                  className="flex-1 py-2.5 px-4 bg-[#059669] hover:bg-[#047857] text-white text-sm font-semibold rounded-lg cursor-pointer"
                >
                  {verifiedStage === 'verifying'
                    ? 'Verifying with Gateway...'
                    : `Verify & Pay ${formatZmw(pendingCheckout.amountZmw)} (Demo)`}
                </button>
                <button
                  type="button"
                  onClick={clearCheckout}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {activeReceipt && (
        <div
          data-testid="digital-receipt-card"
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <div className="text-xs font-mono text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded inline-block mb-1">
                DEMO / SIMULATED DIGITAL RECEIPT
              </div>
              <h2 className="text-lg font-bold text-[#0B192C]">
                Verified Paperless Receipt · {activeReceipt.receiptNumber}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 self-start cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" /> Print / Save PDF
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <div className="text-slate-500">Service</div>
              <div className="font-semibold text-[#0B192C] mt-0.5">{activeReceipt.serviceTitle}</div>
            </div>
            <div>
              <div className="text-slate-500">Allocated Institution</div>
              <div className="font-semibold text-[#0B192C] mt-0.5">
                {activeReceipt.institutionName} ({activeReceipt.institutionCode})
              </div>
            </div>
            <div>
              <div className="text-slate-500">Verified Amount</div>
              <div className="text-base font-bold font-mono text-[#059669] mt-0.5">
                {formatZmw(activeReceipt.amountZmw)}
              </div>
            </div>
            <div>
              <div className="text-slate-500">Channel & Provider Ref</div>
              <div className="font-mono text-slate-700 mt-0.5">
                {activeReceipt.channel} · {activeReceipt.providerRef}
              </div>
            </div>
          </div>

          {activeReceipt.generatedElectricToken && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 font-mono">
              ZESCO Demo Prepaid Token: <strong>{activeReceipt.generatedElectricToken}</strong>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5 text-[#059669] font-medium">
              <Leaf className="w-3.5 h-3.5" /> Greener Zambia: {activeReceipt.paperPagesSaved} paper sheets saved
            </span>
            <span className="font-mono">Tx Ref: {activeReceipt.referenceCode}</span>
          </div>
        </div>
      )}

      {/* Payment History Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-base font-bold text-[#0B192C] mb-4">Transaction & Digital Receipt History</h2>
        {payments.length === 0 ? (
          <p className="text-sm text-slate-500">No verified sandbox payments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-2 pr-4 font-semibold">Receipt No.</th>
                  <th className="py-2 pr-4 font-semibold">Service</th>
                  <th className="py-2 pr-4 font-semibold">Institution</th>
                  <th className="py-2 pr-4 font-semibold">Channel</th>
                  <th className="py-2 pr-4 text-right font-semibold">Amount</th>
                  <th className="py-2 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-2.5 pr-4 font-mono text-xs text-slate-700">{p.receiptNumber}</td>
                    <td className="py-2.5 pr-4 font-medium text-[#0B192C]">{p.serviceTitle}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs text-slate-600">{p.institutionCode}</td>
                    <td className="py-2.5 pr-4 text-xs text-slate-600">{p.channel}</td>
                    <td className="py-2.5 pr-4 text-right font-mono font-semibold text-[#0B192C]">
                      {formatZmw(p.amountZmw)}
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => setActiveReceipt(p)}
                        className="text-xs font-semibold text-[#059669] hover:underline cursor-pointer"
                      >
                        View Receipt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

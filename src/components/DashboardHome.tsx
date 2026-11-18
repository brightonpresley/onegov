import React, { useState } from 'react';
import {
  ArrowRight,
  Briefcase,
  Car,
  CheckCircle2,
  FileText,
  Home,
  Leaf,
  Plus,
  Receipt,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useOneGov } from '../context/OneGovContext';
import { formatZmw } from '../lib/onegovRules';

export const DashboardHome: React.FC<{ mode: 'citizen' | 'business' }> = ({ mode }) => {
  const {
    user,
    overview,
    services,
    setActiveScreen,
    setSelectedService,
    openCheckout,
    setActiveReceipt,
    apiFetch,
    refreshWorkspace,
  } = useOneGov();

  const [showNewBizForm, setShowNewBizForm] = useState(false);
  const [bizName, setBizName] = useState('');
  const [bizSector, setBizSector] = useState('Retail & Agro Supplies');
  const [bizCouncil, setBizCouncil] = useState('Lusaka City Council');
  const [bizWard, setBizWard] = useState('LSK-W12');
  const [bizEmployees, setBizEmployees] = useState(4);
  const [bizBusy, setBizBusy] = useState(false);
  const [bizError, setBizError] = useState<string | null>(null);

  const vehicles = overview?.vehicles ?? [];
  const properties = overview?.properties ?? [];
  const utilities = overview?.utilities ?? [];
  const education = overview?.education ?? [];
  const businesses = overview?.businesses ?? [];
  const applications = overview?.applications ?? [];
  const payments = overview?.payments ?? [];
  const green = overview?.greenerImpact ?? {
    digitalTransactionsCount: 0,
    paperSheetsSaved: 0,
    co2GramsAvoided: 0,
    officeTripsAvoided: 0,
  };

  const totalOutstandingZmw =
    properties.reduce((s, p) => s + p.outstandingZmw, 0) +
    utilities.reduce((s, u) => s + u.outstandingBalanceZmw, 0) +
    education.reduce((s, e) => s + e.termBalanceZmw, 0);

  const handleRegisterBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    setBizError(null);
    if (!bizName.trim()) {
      setBizError('Enter a business trading name.');
      return;
    }
    setBizBusy(true);
    try {
      await apiFetch('/api/businesses', {
        method: 'POST',
        body: JSON.stringify({
          name: bizName,
          sector: bizSector,
          councilArea: bizCouncil,
          wardCode: bizWard,
          employeesCount: bizEmployees,
        }),
      });
      setBizName('');
      setShowNewBizForm(false);
      await refreshWorkspace();
    } catch (err: any) {
      setBizError(err?.message || 'Failed to register demo business.');
    } finally {
      setBizBusy(false);
    }
  };

  const startServiceApplication = (code: string) => {
    const svc = services.find((s) => s.code === code) || services[0];
    if (svc) {
      setSelectedService(svc);
      setActiveScreen('application-workflow');
    }
  };

  if (mode === 'business') {
    const businessServices = services.filter((s) =>
      ['business', 'permits', 'tax', 'property'].includes(s.categorySlug),
    );
    return (
      <div className="space-y-6">
        {/* Hero / Guided SME Welcome */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-7 p-6 lg:p-7 flex flex-col justify-between">
            <div>
              <p className="text-xs font-medium text-[#059669] mb-1">
                OneGov Business · Simple Guided Compliance for Zambian SMEs
              </p>
              <h1 className="text-2xl font-bold text-[#0B192C] mb-2">
                {businesses[0]?.name || `${user?.fullName}'s Enterprise Workspace`}
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed mb-5">
                Manage trading permits, PACRA registration, council levies, and ZRA compliance discovery without
                navigating separate ministries. Low-data mode and plain-language AI guidance ready.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => startServiceApplication('LCC-TRADING-PERMIT')}
                className="px-4 py-2 bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                Apply for Trading Permit
              </button>
              <button
                type="button"
                onClick={() => setShowNewBizForm((v) => !v)}
                className="px-4 py-2 bg-white border border-slate-300 hover:border-slate-400 text-slate-800 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Register Demo Business
              </button>
              <button
                type="button"
                onClick={() => setActiveScreen('ai-assistant')}
                className="px-4 py-2 bg-[#0B192C] hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" /> Ask SME AI Guide
              </button>
            </div>
          </div>
          <div className="lg:col-span-5 min-h-[200px] bg-slate-100">
            <img
              src="/src/assets/images/zambia_sme_commerce_1795001287832.jpg"
              alt="Zambian small business owner managing digital permits on a tablet"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Guided Business Registration Form */}
        {showNewBizForm && (
          <form
            onSubmit={handleRegisterBusiness}
            className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#0B192C]">Guided Demo Business Registration</h2>
              <span className="text-xs text-slate-500">Demo PACRA & TPIN Sandbox</span>
            </div>
            {bizError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{bizError}</div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label htmlFor="new-biz-name" className="block text-xs font-semibold text-slate-700 mb-1">
                  Business Trading Name
                </label>
                <input
                  id="new-biz-name"
                  type="text"
                  required
                  placeholder="e.g., Mwamba Hardware & Agro"
                  value={bizName}
                  onChange={(e) => setBizName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="new-biz-sector" className="block text-xs font-semibold text-slate-700 mb-1">
                  Sector / Trade Activity
                </label>
                <input
                  id="new-biz-sector"
                  type="text"
                  value={bizSector}
                  onChange={(e) => setBizSector(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="new-biz-council" className="block text-xs font-semibold text-slate-700 mb-1">
                  Local Authority / Council
                </label>
                <select
                  id="new-biz-council"
                  value={bizCouncil}
                  onChange={(e) => setBizCouncil(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Lusaka City Council">Lusaka City Council</option>
                  <option value="Kitwe City Council">Kitwe City Council</option>
                  <option value="Livingstone City Council">Livingstone City Council</option>
                </select>
              </div>
              <div>
                <label htmlFor="new-biz-ward" className="block text-xs font-semibold text-slate-700 mb-1">
                  Ward / Trading Zone Code
                </label>
                <input
                  id="new-biz-ward"
                  type="text"
                  value={bizWard}
                  onChange={(e) => setBizWard(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={bizBusy}
                className="px-4 py-2 bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                {bizBusy ? 'Registering...' : 'Save Demo Business Profile'}
              </button>
              <button
                type="button"
                onClick={() => setShowNewBizForm(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Registered Entities & Obligations */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-base font-bold text-[#0B192C] mb-4">Registered Business Profiles</h2>
            {businesses.length === 0 ? (
              <div className="text-sm text-slate-600 py-6">
                No business entity registered yet. Click &ldquo;Register Demo Business&rdquo; above to create one in seconds.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {businesses.map((b) => (
                  <div key={b.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[#0B192C]">{b.name}</div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                        TPIN: {b.tpin} · PACRA: {b.pacraRegNo} · {b.councilArea} ({b.wardCode})
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                        {b.sector} · {b.employeesCount} employees
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs font-semibold ${
                          b.complianceStatus === 'renewal_due' ? 'text-amber-700' : 'text-[#059669]'
                        }`}
                      >
                        {b.complianceStatus === 'renewal_due' ? 'Permit Renewal Due' : 'Compliant'}
                      </span>
                      <button
                        type="button"
                        onClick={() => startServiceApplication('LCC-TRADING-PERMIT')}
                        className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-[#0B192C] rounded-md whitespace-nowrap cursor-pointer"
                      >
                        Renew Permit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-base font-bold text-[#0B192C] mb-3">Recommended SME Actions</h2>
            <div className="space-y-3">
              {businessServices.slice(0, 4).map((svc) => (
                <div key={svc.code} className="p-3 border border-slate-200 rounded-lg">
                  <div className="text-xs text-slate-500">
                    {svc.institutionCode} · SLA {svc.slaDays}d
                  </div>
                  <div className="text-sm font-semibold text-[#0B192C] mt-0.5">{svc.title}</div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs font-mono font-semibold text-slate-700">
                      {formatZmw(svc.feeZmw)} (Demo)
                    </span>
                    <button
                      type="button"
                      onClick={() => startServiceApplication(svc.code)}
                      className="text-xs font-semibold text-[#059669] hover:underline cursor-pointer"
                    >
                      Start Guided Flow
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Business Applications & Payments */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-[#0B192C]">Business Applications</h2>
              <button
                type="button"
                onClick={() => setActiveScreen('application-tracking')}
                className="text-xs font-semibold text-[#059669] hover:underline cursor-pointer"
              >
                Track All
              </button>
            </div>
            {applications.length === 0 ? (
              <p className="text-sm text-slate-500">No permit applications submitted yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {applications.slice(0, 4).map((a) => (
                  <div key={a.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-[#0B192C]">{a.serviceTitle}</div>
                      <div className="text-xs font-mono text-slate-500">
                        {a.referenceCode} · {a.institutionCode} · {a.currentStep}
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-[#059669] capitalize whitespace-nowrap">
                      {a.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-[#0B192C]">Recent Business Receipts</h2>
              <button
                type="button"
                onClick={() => setActiveScreen('payment-receipts')}
                className="text-xs font-semibold text-[#059669] hover:underline cursor-pointer"
              >
                View Ledger
              </button>
            </div>
            {payments.length === 0 ? (
              <p className="text-sm text-slate-500">No business payments recorded yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {payments.slice(0, 4).map((p) => (
                  <div key={p.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-[#0B192C]">{p.serviceTitle}</div>
                      <div className="text-xs font-mono text-slate-500">
                        {p.receiptNumber} · {p.channel}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold font-mono text-[#0B192C]">
                        {formatZmw(p.amountZmw)}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveReceipt(p);
                          setActiveScreen('payment-receipts');
                        }}
                        className="text-xs text-[#059669] hover:underline cursor-pointer"
                      >
                        Receipt
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // CITIZEN DASHBOARD
  return (
    <div className="space-y-6">
      {/* KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500">Outstanding Statutory & Utility Dues</div>
          <div className="text-2xl font-bold font-mono text-[#0B192C] mt-1">
            {formatZmw(totalOutstandingZmw)}
          </div>
          <div className="text-xs text-amber-700 mt-1">Land rates, ZESCO & tuition balances</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500">Active Applications</div>
          <div className="text-2xl font-bold font-mono text-[#0B192C] mt-1">{applications.length}</div>
          <div className="text-xs text-slate-600 mt-1">Tracked across RTSA, LCC & PACRA</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500">Verified Demo Receipts</div>
          <div className="text-2xl font-bold font-mono text-[#0B192C] mt-1">{payments.length}</div>
          <div className="text-xs text-[#059669] mt-1">100% digital & paperless</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Leaf className="w-3.5 h-3.5 text-[#059669]" /> Greener Zambia Impact
          </div>
          <div className="text-2xl font-bold font-mono text-[#059669] mt-1">
            {green.paperSheetsSaved} sheets saved
          </div>
          <div className="text-xs text-slate-600 mt-1 font-mono">
            {green.officeTripsAvoided} office trips avoided
          </div>
        </div>
      </div>

      {/* Frequently Used Services Quick Launch */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-[#0B192C]">Quick Citizen Services</h2>
          <button
            type="button"
            onClick={() => setActiveScreen('service-directory')}
            className="text-xs font-semibold text-[#059669] hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            Browse All Services <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <button
            type="button"
            onClick={() => setActiveScreen('transport')}
            className="text-left p-4 border border-slate-200 rounded-lg hover:border-[#059669] transition-colors cursor-pointer"
          >
            <Car className="w-5 h-5 text-[#0B192C] mb-2" />
            <div className="text-sm font-semibold text-[#0B192C]">Road Tax & Vehicles</div>
            <div className="text-xs text-slate-500 mt-0.5">{vehicles.length} linked vehicles</div>
          </button>

          <button
            type="button"
            onClick={() => setActiveScreen('property')}
            className="text-left p-4 border border-slate-200 rounded-lg hover:border-[#059669] transition-colors cursor-pointer"
          >
            <Home className="w-5 h-5 text-[#0B192C] mb-2" />
            <div className="text-sm font-semibold text-[#0B192C]">Property & Land Rates</div>
            <div className="text-xs text-slate-500 mt-0.5">{properties.length} council plots</div>
          </button>

          <button
            type="button"
            onClick={() => setActiveScreen('utilities')}
            className="text-left p-4 border border-slate-200 rounded-lg hover:border-[#059669] transition-colors cursor-pointer"
          >
            <Zap className="w-5 h-5 text-[#0B192C] mb-2" />
            <div className="text-sm font-semibold text-[#0B192C]">ZESCO Electricity</div>
            <div className="text-xs text-slate-500 mt-0.5">{utilities.length} linked meters</div>
          </button>

          <button
            type="button"
            onClick={() => setActiveScreen('business-dashboard')}
            className="text-left p-4 border border-slate-200 rounded-lg hover:border-[#059669] transition-colors cursor-pointer"
          >
            <Briefcase className="w-5 h-5 text-[#0B192C] mb-2" />
            <div className="text-sm font-semibold text-[#0B192C]">SME & Business</div>
            <div className="text-xs text-slate-500 mt-0.5">Permits & PACRA filings</div>
          </button>

          <button
            type="button"
            onClick={() => setActiveScreen('ai-assistant')}
            className="text-left p-4 border border-slate-200 rounded-lg hover:border-[#059669] transition-colors cursor-pointer"
          >
            <Sparkles className="w-5 h-5 text-[#059669] mb-2" />
            <div className="text-sm font-semibold text-[#0B192C]">OneGov AI Guide</div>
            <div className="text-xs text-slate-500 mt-0.5">Requirements & guidance</div>
          </button>
        </div>
      </div>

      {/* Upcoming Renewals & Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-base font-bold text-[#0B192C] mb-4">Upcoming Renewals & Obligations</h2>
          <div className="divide-y divide-slate-100">
            {vehicles.map((v) => (
              <div key={v.id} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[#0B192C]">
                    {v.plateNumber} · {v.makeModel}
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    Road Tax due {v.roadTaxExpiresAt} · Insurance: {v.insuranceProvider}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveScreen('transport')}
                  className="px-3 py-1.5 text-xs font-semibold bg-[#059669] text-white rounded-md hover:bg-[#047857] whitespace-nowrap cursor-pointer"
                >
                  Pay Road Tax
                </button>
              </div>
            ))}
            {properties
              .filter((p) => p.outstandingZmw > 0)
              .map((p) => (
                <div key={p.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[#0B192C]">{p.plotNumber}</div>
                    <div className="text-xs text-slate-500">
                      {p.councilName} · Outstanding {formatZmw(p.outstandingZmw)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      openCheckout({
                        serviceCode: 'LCC-LAND-RATES',
                        serviceTitle: `Land Rates (${p.plotNumber})`,
                        amountZmw: p.outstandingZmw,
                        councilName: p.councilName,
                        wardCode: p.wardCode,
                        propertyId: p.id,
                      })
                    }
                    className="px-3 py-1.5 text-xs font-semibold bg-[#0B192C] text-white rounded-md hover:bg-slate-800 whitespace-nowrap cursor-pointer"
                  >
                    Settle Rates
                  </button>
                </div>
              ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-[#0B192C]">Recent Transactions & Digital Receipts</h2>
            <button
              type="button"
              onClick={() => setActiveScreen('payment-receipts')}
              className="text-xs font-semibold text-[#059669] hover:underline cursor-pointer"
            >
              All Receipts
            </button>
          </div>
          {payments.length === 0 ? (
            <div className="py-6 text-sm text-slate-500">
              No transactions yet. Complete any service payment to generate an instant paperless receipt.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {payments.slice(0, 5).map((p) => (
                <div key={p.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#0B192C] truncate">{p.serviceTitle}</div>
                    <div className="text-xs font-mono text-slate-500">
                      {p.receiptNumber} · {p.channel} · {p.institutionCode}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-bold font-mono text-[#0B192C]">
                      {formatZmw(p.amountZmw)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveReceipt(p);
                        setActiveScreen('payment-receipts');
                      }}
                      className="p-1.5 border border-slate-200 rounded-md hover:border-[#059669] text-slate-600 hover:text-[#059669] cursor-pointer"
                      aria-label={`View receipt ${p.receiptNumber}`}
                    >
                      <Receipt className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pending Applications */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-[#0B192C]">Application Progress & Status</h2>
          <button
            type="button"
            onClick={() => setActiveScreen('application-tracking')}
            className="text-xs font-semibold text-[#059669] hover:underline cursor-pointer"
          >
            Open Tracker
          </button>
        </div>
        {applications.length === 0 ? (
          <div className="text-sm text-slate-500 py-3">
            No applications submitted yet. Visit the Service Directory to start a guided application.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-2 pr-4 font-semibold">Reference</th>
                  <th className="py-2 pr-4 font-semibold">Service</th>
                  <th className="py-2 pr-4 font-semibold">Institution</th>
                  <th className="py-2 pr-4 font-semibold">Current Step</th>
                  <th className="py-2 text-right font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {applications.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="py-2.5 pr-4 font-mono text-xs text-slate-700">{a.referenceCode}</td>
                    <td className="py-2.5 pr-4 font-medium text-[#0B192C]">{a.serviceTitle}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs text-slate-600">{a.institutionCode}</td>
                    <td className="py-2.5 pr-4 text-xs text-slate-600">{a.currentStep}</td>
                    <td className="py-2.5 text-right text-xs font-semibold text-[#059669] capitalize">
                      <span className="inline-flex items-center gap-1">
                        {a.status === 'approved' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                        {a.status.replace(/_/g, ' ')}
                      </span>
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

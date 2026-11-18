import React, { useState } from 'react';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Compass,
  Leaf,
  Lock,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { useOneGov } from '../context/OneGovContext';
import { ROLE_DEFINITIONS, type UserRole } from '../lib/onegovRules';
import type { ScreenId } from '../types/onegov';

export const WelcomeAuthView: React.FC = () => {
  const {
    institutions,
    services,
    loginAsDemoRole,
    registerDemoAccount,
    loginWithGoogle,
    authError,
    loading,
  } = useOneGov();

  const [authTab, setAuthTab] = useState<'demo-roles' | 'login' | 'register'>('demo-roles');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [nrcNumber, setNrcNumber] = useState('');
  const [accountType, setAccountType] = useState<'citizen' | 'small_business_owner'>('citizen');
  const [businessName, setBusinessName] = useState('');
  const [sector, setSector] = useState('Agricultural Retail & Inputs');
  const [regError, setRegError] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('482910');
  const [selectedLoginRole, setSelectedLoginRole] = useState<UserRole>('citizen');

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    if (!fullName.trim() || !email.trim()) {
      setRegError('Full name and email address are required.');
      return;
    }
    if (accountType === 'small_business_owner' && !businessName.trim()) {
      setRegError('Please provide your business or trading name.');
      return;
    }
    try {
      await registerDemoAccount({
        fullName,
        email,
        phone,
        nrcNumber,
        accountType,
        businessName,
        sector,
      });
    } catch (err: any) {
      setRegError(err?.message || 'Unable to complete registration.');
    }
  };

  const quickDemos: Array<{
    label: string;
    detail: string;
    role: UserRole;
    screen: ScreenId;
  }> = [
    {
      label: 'Demo 1: Citizen Road Tax',
      detail: 'RTSA quote, Mobile Money sandbox, paperless receipt',
      role: 'citizen',
      screen: 'transport',
    },
    {
      label: 'Demo 2: Small Business Permit',
      detail: 'Guided SME registration, trading permit & AI OCR',
      role: 'small_business_owner',
      screen: 'business-dashboard',
    },
    {
      label: 'Demo 3: Council GIS Intelligence',
      detail: 'Chawama Ward 12 (35%) AI root-cause investigation',
      role: 'council_officer',
      screen: 'council-dashboard',
    },
    {
      label: 'Demo 4: ZRA Master Revenue',
      detail: 'Consolidated national revenue & anomaly oversight',
      role: 'zra_admin',
      screen: 'zra-dashboard',
    },
    {
      label: 'Demo 5: IP Patent & Trademark',
      detail: 'AI similarity screening & PACRA filing tracking',
      role: 'ip_applicant',
      screen: 'ip-portal',
    },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col">
      {/* 3-Zone Top Bar Contract */}
      <header className="bg-white border-b border-slate-200 px-6 lg:px-10 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
          <a
            href="#top"
            className="text-xl font-bold tracking-tight text-[#0B192C] whitespace-nowrap shrink-0 font-display"
          >
            OneGov Zambia
          </a>

          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
          >
            <a href="#demos" className="hover:text-[#0B192C] whitespace-nowrap shrink-0">
              Guided Demos
            </a>
            <a href="#modules" className="hover:text-[#0B192C] whitespace-nowrap shrink-0">
              Platform Modules
            </a>
            <a href="#institutions" className="hover:text-[#0B192C] whitespace-nowrap shrink-0">
              Institutions
            </a>
            <a href="#access" className="hover:text-[#0B192C] whitespace-nowrap shrink-0">
              Role Access
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => loginAsDemoRole('citizen')}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#059669] hover:bg-[#047857] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Open Citizen Demo
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* Hero Split Section */}
        <section className="max-w-7xl mx-auto px-6 lg:px-10 py-7 lg:py-9">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            <div className="lg:col-span-7 flex flex-col justify-between bg-white border border-slate-200 rounded-xl p-8">
              <div>
                <p className="text-xs font-medium text-[#059669] tracking-wide mb-3">
                  Republic of Zambia · Demo & Sandbox Environment · Greener Zambia Digital-First
                </p>
                <h1
                  className="text-3xl lg:text-4xl font-bold text-[#0B192C] tracking-tight leading-tight mb-4"
                  style={{ textWrap: 'balance' }}
                >
                  One Citizen. One Account. One Platform. Every Government Service.
                </h1>
                <p className="text-base text-slate-600 leading-relaxed max-w-2xl mb-6">
                  An independent digital-government integration ecosystem unifying citizen services,
                  SME licensing, RTSA transport, council property rates, ZESCO utilities, school fees,
                  PACRA intellectual property, GIS council revenue diagnostics, and ZRA consolidated oversight.
                </p>

                <div className="flex flex-wrap items-center gap-3 mb-8">
                  <button
                    type="button"
                    onClick={() => loginAsDemoRole('citizen', 'citizen-dashboard')}
                    disabled={loading}
                    className="px-5 py-2.5 bg-[#0B192C] hover:bg-slate-800 text-white text-sm font-semibold rounded-lg transition-colors inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
                  >
                    Enter Citizen Workspace
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => loginAsDemoRole('small_business_owner', 'business-dashboard')}
                    disabled={loading}
                    className="px-5 py-2.5 bg-white border border-slate-300 hover:border-slate-400 text-slate-800 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Enter SME Business Portal
                  </button>
                  <button
                    type="button"
                    onClick={loginWithGoogle}
                    disabled={loading}
                    className="px-4 py-2.5 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-900 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Sign in with Google
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-slate-500">Participating Agencies</div>
                  <div className="text-xl font-bold font-mono text-[#0B192C] mt-0.5">
                    {institutions.length || 10}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Catalogued Services</div>
                  <div className="text-xl font-bold font-mono text-[#0B192C] mt-0.5">
                    {services.length || 12}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Role Portals</div>
                  <div className="text-xl font-bold font-mono text-[#0B192C] mt-0.5">12</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Currency & Mode</div>
                  <div className="text-xl font-bold font-mono text-[#059669] mt-0.5">ZMW · Demo</div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 relative rounded-xl overflow-hidden border border-slate-200 bg-[#0B192C] min-h-[280px]">
              <img
                src="/src/assets/images/lusaka_civic_skyline_1795001285784.jpg"
                alt="Lusaka civic and financial district skyline in Zambia"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B192C]/90 via-[#0B192C]/35 to-transparent flex flex-col justify-end p-6 text-white">
                <p className="text-xs text-emerald-300 font-medium mb-1">
                  Simulated Institutional Sandbox · Lusaka, Copperbelt & Southern
                </p>
                <p className="text-sm text-slate-100 leading-relaxed">
                  All payments, certificates, and institutional connections in this environment operate as clearly
                  labelled DEMO simulations while enforcing real PostgreSQL persistence and RBAC isolation.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 5 Complete End-to-End Demo Journeys */}
        <section id="demos" className="max-w-7xl mx-auto px-6 lg:px-10 pb-10">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
              <div>
                <h2 className="text-lg font-bold text-[#0B192C]">
                  Interactive End-to-End Demo Journeys
                </h2>
                <p className="text-sm text-slate-600">
                  Launch any of the 5 complete OneGov demonstrations immediately with pre-seeded Zambian demo records.
                </p>
              </div>
              <span className="text-xs font-mono text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded-md whitespace-nowrap self-start sm:self-auto">
                DEMO / SIMULATED DATA ONLY
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {quickDemos.map((d) => (
                <button
                  key={d.label}
                  type="button"
                  onClick={() => loginAsDemoRole(d.role, d.screen)}
                  disabled={loading}
                  className="text-left p-4 rounded-lg border border-slate-200 hover:border-[#059669] hover:bg-emerald-50/40 transition-colors flex flex-col justify-between cursor-pointer"
                >
                  <div>
                    <div className="text-sm font-semibold text-[#0B192C] mb-1">{d.label}</div>
                    <p className="text-xs text-slate-600 leading-relaxed">{d.detail}</p>
                  </div>
                  <div className="mt-3 text-xs font-semibold text-[#059669] inline-flex items-center gap-1">
                    Launch Journey <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Access Portal: 12 Roles, Login / MFA, Registration */}
        <section id="access" className="max-w-7xl mx-auto px-6 lg:px-10 pb-12">
          <div className="bg-white border border-slate-200 rounded-xl p-6 lg:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-[#0B192C]">
                  OneGov Access & Role-Based Portals
                </h2>
                <p className="text-sm text-slate-600">
                  Sign in with Google, enter any of the 12 isolated Demo Role Personas, or register a new Citizen / SME account.
                </p>
              </div>
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
                <button
                  type="button"
                  onClick={() => setAuthTab('demo-roles')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    authTab === 'demo-roles' ? 'bg-white text-[#0B192C] shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  12 Role Personas
                </button>
                <button
                  type="button"
                  onClick={() => setAuthTab('login')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    authTab === 'login' ? 'bg-white text-[#0B192C] shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Login & MFA
                </button>
                <button
                  type="button"
                  onClick={() => setAuthTab('register')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    authTab === 'register' ? 'bg-white text-[#0B192C] shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Register Account
                </button>
              </div>
            </div>

            {authError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
                {authError}
              </div>
            )}

            {authTab === 'demo-roles' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {Object.values(ROLE_DEFINITIONS).map((meta) => (
                  <button
                    key={meta.role}
                    type="button"
                    onClick={() => loginAsDemoRole(meta.role)}
                    disabled={loading}
                    className="text-left p-4 rounded-lg border border-slate-200 hover:border-[#0B192C] hover:bg-slate-50 transition-colors cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="text-xs font-mono text-slate-500 mb-1">
                        {meta.institutionCode ? `Institution: ${meta.institutionCode}` : 'User Portal'}
                      </div>
                      <div className="text-sm font-bold text-[#0B192C] mb-1">{meta.label}</div>
                      <p className="text-xs text-slate-600 leading-relaxed">{meta.description}</p>
                    </div>
                    <div className="mt-3 text-xs font-semibold text-[#059669]">
                      Sign in as {meta.shortLabel}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {authTab === 'login' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="text-base font-bold text-[#0B192C] mb-2">
                    Official Google Identity Sign-In
                  </h3>
                  <p className="text-sm text-slate-600 mb-5">
                    Authenticate securely using Firebase Authentication (Google Sign-In) with PostgreSQL profile synchronization.
                  </p>
                  <button
                    type="button"
                    onClick={loginWithGoogle}
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-[#0B192C] hover:bg-slate-800 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Continue with Google Sign-In
                  </button>
                </div>

                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="text-base font-bold text-[#0B192C] mb-2">
                    Demo Sandbox Role Login + MFA Verification
                  </h3>
                  <div className="space-y-4 mt-4">
                    <div>
                      <label htmlFor="login-role-select" className="block text-xs font-semibold text-slate-700 mb-1">
                        Select Authorised Role Persona
                      </label>
                      <select
                        id="login-role-select"
                        value={selectedLoginRole}
                        onChange={(e) => setSelectedLoginRole(e.target.value as UserRole)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                      >
                        {Object.values(ROLE_DEFINITIONS).map((r) => (
                          <option key={r.role} value={r.role}>
                            {r.label} {r.institutionCode ? `(${r.institutionCode})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="mfa-code-input" className="block text-xs font-semibold text-slate-700 mb-1">
                        Simulated 6-Digit MFA Token
                      </label>
                      <input
                        id="mfa-code-input"
                        type="text"
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value)}
                        className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => loginAsDemoRole(selectedLoginRole)}
                      disabled={loading || mfaCode.trim().length < 6}
                      className="w-full py-2.5 px-4 bg-[#059669] hover:bg-[#047857] text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      Verify MFA & Enter Workspace
                    </button>
                  </div>
                </div>
              </div>
            )}

            {authTab === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="max-w-2xl space-y-4">
                {regError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
                    {regError}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="reg-account-type" className="block text-xs font-semibold text-slate-700 mb-1">
                      Account Type
                    </label>
                    <select
                      id="reg-account-type"
                      value={accountType}
                      onChange={(e) => setAccountType(e.target.value as 'citizen' | 'small_business_owner')}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="citizen">Citizen Personal Account</option>
                      <option value="small_business_owner">Small Business / SME Account</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="reg-fullname" className="block text-xs font-semibold text-slate-700 mb-1">
                      Full Name (as on NRC)
                    </label>
                    <input
                      id="reg-fullname"
                      type="text"
                      required
                      placeholder="e.g., Mulenga Mwila"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label htmlFor="reg-email" className="block text-xs font-semibold text-slate-700 mb-1">
                      Email Address
                    </label>
                    <input
                      id="reg-email"
                      type="email"
                      required
                      placeholder="mulenga@example.zm"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label htmlFor="reg-phone" className="block text-xs font-semibold text-slate-700 mb-1">
                      Mobile Number (Mobile Money & SMS)
                    </label>
                    <input
                      id="reg-phone"
                      type="tel"
                      placeholder="+260977123456"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label htmlFor="reg-nrc" className="block text-xs font-semibold text-slate-700 mb-1">
                      NRC Number (Demo Verification)
                    </label>
                    <input
                      id="reg-nrc"
                      type="text"
                      placeholder="245189/10/1"
                      value={nrcNumber}
                      onChange={(e) => setNrcNumber(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                    />
                  </div>
                  {accountType === 'small_business_owner' && (
                    <>
                      <div>
                        <label htmlFor="reg-biz-name" className="block text-xs font-semibold text-slate-700 mb-1">
                          Business / Trading Name
                        </label>
                        <input
                          id="reg-biz-name"
                          type="text"
                          required
                          placeholder="e.g., Lusaka Fresh Mart Ltd"
                          value={businessName}
                          onChange={(e) => setBusinessName(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label htmlFor="reg-sector" className="block text-xs font-semibold text-slate-700 mb-1">
                          Business Sector
                        </label>
                        <input
                          id="reg-sector"
                          type="text"
                          value={sector}
                          onChange={(e) => setSector(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                        />
                      </div>
                    </>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-[#059669] hover:bg-[#047857] text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Create Demo Account & Continue
                </button>
              </form>
            )}
          </div>
        </section>

        {/* Modules & Institutions Summary */}
        <section id="modules" className="max-w-7xl mx-auto px-6 lg:px-10 pb-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center gap-2 text-[#0B192C] font-bold mb-2">
                <Compass className="w-5 h-5 text-[#059669]" />
                <span>Citizen, SME & Vertical Services</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Transport (RTSA Road Tax & Insurance), Property & Land Rates, ZESCO Utilities, University & School Fees,
                and Guided Small Business Trading Permits in one account.
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center gap-2 text-[#0B192C] font-bold mb-2">
                <ShieldCheck className="w-5 h-5 text-[#059669]" />
                <span>ZRA & GIS Council Revenue Intelligence</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Interactive GIS ward maps pinpointing revenue gaps with AI diagnostics that separate confirmed facts
                from hypotheses, while enforcing strict institutional data boundaries.
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center gap-2 text-[#0B192C] font-bold mb-2">
                <Leaf className="w-5 h-5 text-[#059669]" />
                <span>Greener Zambia & PACRA IP Services</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Paperless receipts, low-data accessibility, and AI-assisted patent and trademark similarity screening
                with statutory PACRA tracking.
              </p>
            </div>
          </div>
        </section>

        <section id="institutions" className="max-w-7xl mx-auto px-6 lg:px-10 pb-14">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-[#0B192C]">
                Participating Institutions & Integration Boundaries
              </h2>
              <span className="text-xs text-slate-500">Sandbox & Planned Connectors</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {institutions.map((inst) => (
                <div key={inst.code} className="p-3 border border-slate-200 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-bold text-[#0B192C]">{inst.code}</span>
                    <span className="text-[11px] text-slate-500 capitalize">{inst.integrationMode}</span>
                  </div>
                  <div className="text-xs font-medium text-slate-700 leading-snug">{inst.name}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-white border-t border-slate-200 px-6 lg:px-10 py-5 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-700">OneGov Zambia</span>
            <span aria-hidden="true">·</span>
            <span>Independent Digital-Government Aggregator Prototype (Simulated Demo Environment)</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1">
              <Lock className="w-3.5 h-3.5" /> Strict RBAC Isolation
            </span>
            <span className="inline-flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" /> Participating Institutions
            </span>
            <span className="inline-flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5" /> Human Approval Authority
            </span>
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Greener Zambia Digital-First
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

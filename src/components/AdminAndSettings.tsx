import React, { useEffect, useState } from 'react';
import { Bell, Building2, CheckCircle2, Database, Lock, Shield, Sliders } from 'lucide-react';
import { useOneGov } from '../context/OneGovContext';
import { formatZmw } from '../lib/onegovRules';
import type { InstitutionItem, RegionalConfig } from '../types/onegov';

export const InstitutionPortalView: React.FC = () => {
  const { apiFetch, user } = useOneGov();
  const [institution, setInstitution] = useState<InstitutionItem | null>(null);
  const [apps, setApps] = useState<
    Array<{
      id: number;
      referenceCode: string;
      serviceTitle: string;
      applicantName: string;
      status: string;
      currentStep: string;
      aiCompletenessScore: number;
    }>
  >([]);
  const [payments, setPayments] = useState<
    Array<{ id: number; receiptNumber: string; serviceTitle: string; amountZmw: number; channel: string }>
  >([]);
  const [isolationNotice, setIsolationNotice] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadPortal = async () => {
    setError(null);
    try {
      const res = await apiFetch<{
        institution: InstitutionItem;
        applications: typeof apps;
        payments: typeof payments;
        isolationNotice: string;
      }>('/api/institution/portal');
      setInstitution(res.institution);
      setApps(res.applications);
      setPayments(res.payments);
      setIsolationNotice(res.isolationNotice);
    } catch (err: any) {
      setError(err?.message || 'Unable to access institutional portal.');
    }
  };

  useEffect(() => {
    loadPortal();
  }, [user?.uid]);

  const handleReview = async (id: number, decision: 'approved' | 'rejected' | 'additional_info_requested') => {
    try {
      await apiFetch(`/api/applications/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          reviewerNotes: `Decision (${decision}) recorded by ${user?.fullName}.`,
        }),
      });
      await loadPortal();
    } catch (err: any) {
      setError(err?.message || 'Action denied.');
    }
  };

  if (error) {
    return <div className="bg-white border border-red-200 rounded-xl p-6 text-sm text-red-700">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
          <div>
            <div className="text-xs font-mono text-[#059669]">
              Authorised Institutional Portal · {institution?.code}
            </div>
            <h1 className="text-xl font-bold text-[#0B192C]">{institution?.name}</h1>
            <p className="text-xs text-slate-600 mt-1">{isolationNotice}</p>
          </div>
          <span className="text-xs font-mono text-slate-700 bg-slate-100 px-3 py-1 rounded">
            Mode: {institution?.integrationMode}
          </span>
        </div>

        <h2 className="text-sm font-bold text-[#0B192C] mb-3">Application Review Queue (Human Officer Authority)</h2>
        {apps.length === 0 ? (
          <p className="text-xs text-slate-500 py-4">No applications currently queued for {institution?.code}.</p>
        ) : (
          <div className="space-y-3">
            {apps.map((a) => (
              <div key={a.id} className="border border-slate-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-mono text-slate-500">
                    {a.referenceCode} · Applicant: {a.applicantName} · AI Completeness {a.aiCompletenessScore}%
                  </div>
                  <div className="text-sm font-bold text-[#0B192C]">{a.serviceTitle}</div>
                  <div className="text-xs text-slate-600 capitalize">
                    Status: {a.status.replace(/_/g, ' ')} · {a.currentStep}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleReview(a.id, 'approved')}
                    className="px-3 py-1.5 text-xs font-semibold bg-[#059669] hover:bg-[#047857] text-white rounded-md cursor-pointer"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReview(a.id, 'additional_info_requested')}
                    className="px-3 py-1.5 text-xs font-semibold border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 cursor-pointer"
                  >
                    Request Info
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReview(a.id, 'rejected')}
                    className="px-3 py-1.5 text-xs font-semibold border border-red-200 text-red-700 rounded-md hover:bg-red-50 cursor-pointer"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-base font-bold text-[#0B192C] mb-3">
          Isolated Institution Payment Ledger ({institution?.code})
        </h2>
        {payments.length === 0 ? (
          <p className="text-xs text-slate-500">No direct payments allocated to this institution yet.</p>
        ) : (
          <div className="divide-y divide-slate-100 text-xs">
            {payments.map((p) => (
              <div key={p.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-mono font-semibold text-[#0B192C]">{p.receiptNumber}</span> · {p.serviceTitle} ({p.channel})
                </div>
                <span className="font-mono font-bold text-[#0B192C]">{formatZmw(p.amountZmw)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const SuperAdminView: React.FC = () => {
  const { apiFetch, refreshWorkspace } = useOneGov();
  const [institutions, setInstitutions] = useState<InstitutionItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<
    Array<{ id: number; actorRole: string; institutionCode: string | null; action: string; targetEntity: string; details: string }>
  >([]);
  const [config, setConfig] = useState<RegionalConfig>({
    country: 'Zambia',
    countryCode: 'ZM',
    currencyCode: 'ZMW',
    currencySymbol: 'K',
    defaultLanguage: 'en',
  });
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newMode, setNewMode] = useState<'sandbox' | 'planned'>('sandbox');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAdmin = async () => {
    try {
      const res = await apiFetch<{
        institutions: InstitutionItem[];
        auditLogs: typeof auditLogs;
        regionalConfig: RegionalConfig;
      }>('/api/admin/platform');
      setInstitutions(res.institutions);
      setAuditLogs(res.auditLogs);
      if (res.regionalConfig?.country) setConfig(res.regionalConfig);
    } catch (err: any) {
      setError(err?.message || 'Platform Admin access denied.');
    }
  };

  useEffect(() => {
    loadAdmin();
  }, []);

  const handleOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMsg(null);
    try {
      await apiFetch('/api/admin/institutions', {
        method: 'POST',
        body: JSON.stringify({ code: newCode, name: newName, description: newDesc, integrationMode: newMode }),
      });
      setNewCode('');
      setNewName('');
      setNewDesc('');
      setMsg('Participating institution onboarded.');
      await loadAdmin();
      await refreshWorkspace();
    } catch (err: any) {
      setError(err?.message || 'Onboarding failed.');
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMsg(null);
    try {
      await apiFetch('/api/admin/config', {
        method: 'PATCH',
        body: JSON.stringify(config),
      });
      setMsg('Regional expansion configuration updated.');
      await refreshWorkspace();
    } catch (err: any) {
      setError(err?.message || 'Config update failed.');
    }
  };

  if (error) {
    return <div className="bg-white border border-red-200 rounded-xl p-6 text-sm text-red-700">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="border-b border-slate-100 pb-4 mb-5">
          <div className="text-xs font-mono text-[#059669]">Platform Super Administration · Governance & Integrations</div>
          <h1 className="text-xl font-bold text-[#0B192C]">
            Institutional Onboarding, Regional Config & Audit Logs
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Governance Rule: Super Administrators manage platform configuration and integration health, and cannot
            override statutory approvals inside individual institutions.
          </p>
        </div>

        {msg && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-[#059669]" /> {msg}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form onSubmit={handleOnboard} className="border border-slate-200 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-bold text-[#0B192C] flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-[#059669]" /> Onboard New Participating Institution
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="inst-code" className="block text-xs font-semibold text-slate-700 mb-1">
                  Code
                </label>
                <input
                  id="inst-code"
                  type="text"
                  required
                  placeholder="e.g., LWSC"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="inst-mode" className="block text-xs font-semibold text-slate-700 mb-1">
                  Integration Mode
                </label>
                <select
                  id="inst-mode"
                  value={newMode}
                  onChange={(e) => setNewMode(e.target.value as 'sandbox' | 'planned')}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="sandbox">Sandbox Connector</option>
                  <option value="planned">Planned Integration</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="inst-name" className="block text-xs font-semibold text-slate-700 mb-1">
                Institution Name
              </label>
              <input
                id="inst-name"
                type="text"
                required
                placeholder="Lusaka Water Supply & Sanitation Company"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label htmlFor="inst-desc" className="block text-xs font-semibold text-slate-700 mb-1">
                Mandate Description
              </label>
              <input
                id="inst-desc"
                type="text"
                required
                placeholder="Municipal water utility billing and connections"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              Onboard Institution
            </button>
          </form>

          <form onSubmit={handleSaveConfig} className="border border-slate-200 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-bold text-[#0B192C] flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-[#059669]" /> Multi-Country & Regional Scalability Config
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="cfg-country" className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Country
                </label>
                <input
                  id="cfg-country"
                  type="text"
                  value={config.country}
                  onChange={(e) => setConfig({ ...config, country: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="cfg-currency" className="block text-xs font-semibold text-slate-700 mb-1">
                  Currency Code / Symbol
                </label>
                <input
                  id="cfg-currency"
                  type="text"
                  value={`${config.currencyCode} (${config.currencySymbol})`}
                  readOnly
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg bg-slate-50"
                />
              </div>
            </div>
            <div>
              <label htmlFor="cfg-lang" className="block text-xs font-semibold text-slate-700 mb-1">
                Default Platform Language
              </label>
              <select
                id="cfg-lang"
                value={config.defaultLanguage}
                onChange={(e) => setConfig({ ...config, defaultLanguage: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="en">English (Default)</option>
                <option value="bem">Icibemba</option>
                <option value="nya">Chinyanja</option>
                <option value="toi">Chitonga</option>
              </select>
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-[#0B192C] hover:bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              Save Platform Configuration
            </button>
          </form>
        </div>
      </div>

      {/* Integration Registry & Audit Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-base font-bold text-[#0B192C] mb-3">
            Integration Connectors (Implemented Sandbox vs Planned)
          </h2>
          <div className="divide-y divide-slate-100 text-xs">
            {institutions.map((i) => (
              <div key={i.code} className="py-2.5 flex items-center justify-between gap-2">
                <div>
                  <span className="font-mono font-bold text-[#0B192C]">{i.code}</span> · {i.name}
                </div>
                <span
                  className={`font-semibold capitalize ${
                    i.integrationMode === 'sandbox' ? 'text-[#059669]' : 'text-amber-700'
                  }`}
                >
                  {i.integrationMode}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-base font-bold text-[#0B192C] mb-3">Immutable Security Audit Trail</h2>
          <div className="space-y-2 max-h-72 overflow-y-auto text-xs">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-2.5 border border-slate-200 rounded-lg">
                <div className="font-mono font-semibold text-[#0B192C]">
                  {log.action} · {log.actorRole} {log.institutionCode ? `(${log.institutionCode})` : ''}
                </div>
                <div className="text-slate-600 mt-0.5">{log.details}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const NotificationsView: React.FC = () => {
  const { notifications, apiFetch, refreshWorkspace } = useOneGov();

  const markAllRead = async () => {
    await apiFetch('/api/notifications/read-all', { method: 'POST' });
    await refreshWorkspace();
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0B192C] flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#059669]" /> Notifications & Reminders
          </h1>
          <p className="text-xs text-slate-600">
            In-app, SMS architecture, email alerts, payment reminders, and renewal notices.
          </p>
        </div>
        <button
          type="button"
          onClick={markAllRead}
          className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
        >
          Mark All Read
        </button>
      </div>

      {notifications.length === 0 ? (
        <p className="text-sm text-slate-500 py-4">No notifications for this account.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {notifications.map((n) => (
            <div key={n.id} className="py-3.5 flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-mono text-slate-500 uppercase">
                  {n.channel} · {n.category.replace(/_/g, ' ')}
                </div>
                <div className="text-sm font-bold text-[#0B192C] mt-0.5">{n.title}</div>
                <p className="text-xs text-slate-600 mt-1">{n.message}</p>
              </div>
              {!n.isRead && <span className="text-xs font-semibold text-[#059669]">New</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const AccountSettingsView: React.FC = () => {
  const { user, apiFetch, refreshWorkspace } = useOneGov();
  const [mfaEnabled, setMfaEnabled] = useState(Boolean(user?.mfaEnabled));
  const [lowDataMode, setLowDataMode] = useState(Boolean(user?.lowDataMode));
  const [preferredLanguage, setPreferredLanguage] = useState(user?.preferredLanguage || 'en');
  const [consentAccepted, setConsentAccepted] = useState(user?.consentAccepted ?? true);
  const [saved, setSaved] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    await apiFetch('/api/account/settings', {
      method: 'PATCH',
      body: JSON.stringify({ mfaEnabled, lowDataMode, preferredLanguage, consentAccepted }),
    });
    setSaved(true);
    await refreshWorkspace();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-3xl space-y-5">
        <div>
          <h1 className="text-xl font-bold text-[#0B192C] flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#059669]" /> Account, Security & Privacy Settings
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Manage multi-factor authentication, Zambian local-language preferences, low-data mode, and data consent.
          </p>
        </div>

        {saved && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
            Security and accessibility preferences saved.
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div>
              <div className="text-slate-500">Full Name</div>
              <div className="font-semibold text-[#0B192C] mt-0.5">{user?.fullName}</div>
            </div>
            <div>
              <div className="text-slate-500">Email & Role</div>
              <div className="font-mono text-[#0B192C] mt-0.5">
                {user?.email} · {user?.role}
              </div>
            </div>
          </div>

          <label className="flex items-center justify-between p-3 border border-slate-200 rounded-lg cursor-pointer">
            <div>
              <div className="text-sm font-semibold text-[#0B192C] flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-[#059669]" /> Multi-Factor Authentication (MFA)
              </div>
              <div className="text-xs text-slate-500">Require OTP confirmation for sensitive institutional actions</div>
            </div>
            <input
              type="checkbox"
              checked={mfaEnabled}
              onChange={(e) => setMfaEnabled(e.target.checked)}
              className="w-4 h-4 accent-[#059669]"
            />
          </label>

          <label className="flex items-center justify-between p-3 border border-slate-200 rounded-lg cursor-pointer">
            <div>
              <div className="text-sm font-semibold text-[#0B192C]">Low-Data Accessibility Mode</div>
              <div className="text-xs text-slate-500">
                Optimizes bandwidth for low-connectivity areas across Zambia
              </div>
            </div>
            <input
              type="checkbox"
              checked={lowDataMode}
              onChange={(e) => setLowDataMode(e.target.checked)}
              className="w-4 h-4 accent-[#059669]"
            />
          </label>

          <div>
            <label htmlFor="pref-lang" className="block text-xs font-semibold text-slate-700 mb-1">
              Interface & AI Assistant Language
            </label>
            <select
              id="pref-lang"
              value={preferredLanguage}
              onChange={(e) => setPreferredLanguage(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="en">English</option>
              <option value="bem">Icibemba (Local Language Expansion)</option>
              <option value="nya">Chinyanja (Local Language Expansion)</option>
              <option value="toi">Chitonga (Local Language Expansion)</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={consentAccepted}
              onChange={(e) => setConsentAccepted(e.target.checked)}
              className="w-4 h-4 accent-[#059669]"
            />
            I consent to AI personalisation & service reminders under Zambia Data Protection Act privacy-by-design controls.
          </label>

          <button
            type="submit"
            className="px-5 py-2 bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            Save Security & Privacy Settings
          </button>
        </form>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-3xl">
        <h2 className="text-sm font-bold text-[#0B192C] flex items-center gap-2 mb-2">
          <Database className="w-4 h-4 text-[#059669]" /> System Architecture & Relational Database Summary
        </h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          OneGov runs on PostgreSQL with strict institutional tenant isolation (`institutions`, `users`, `services`,
          `applications`, `payments`, `revenue_zones`, `investigations`, `ip_applications`, `fraud_alerts`, and
          `audit_logs`), plus PostGIS & pgvector reference migrations in <code className="font-mono">migrations/</code>{' '}
          and architectural documentation in <code className="font-mono">docs/ONEGOV_ARCHITECTURE_AND_API.md</code>.
        </p>
      </div>
    </div>
  );
};

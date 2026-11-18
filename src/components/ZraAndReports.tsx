import React, { useEffect, useState } from 'react';
import { AlertOctagon, Download, ShieldAlert, Sparkles } from 'lucide-react';
import { useOneGov } from '../context/OneGovContext';
import { formatZmw } from '../lib/onegovRules';
import type { RevenueZoneItem } from '../types/onegov';

interface ZraInstitutionRow {
  institutionId: number;
  institutionCode: string;
  institutionName: string;
  province: string;
  verifiedRevenueZmw: number;
  expectedRevenueZmw: number;
  transactionCount: number;
  pendingReconciliationZmw: number;
}

interface FraudAlertRow {
  id: number;
  alertCode: string;
  institutionCode: string;
  category: string;
  severity: string;
  description: string;
  status: string;
}

interface AnonymizedTx {
  id: number;
  referenceCode: string;
  receiptNumber: string;
  institutionCode: string;
  institutionName: string;
  serviceTitle: string;
  amountZmw: number;
  channel: string;
  reconciliationStatus: string;
  province: string;
  councilName: string;
}

export const ZraAndReportsView: React.FC<{ mode: 'zra' | 'reports' }> = ({ mode }) => {
  const { apiFetch } = useOneGov();
  const [byInstitution, setByInstitution] = useState<ZraInstitutionRow[]>([]);
  const [zones, setZones] = useState<RevenueZoneItem[]>([]);
  const [fraudAlerts, setFraudAlerts] = useState<FraudAlertRow[]>([]);
  const [transactions, setTransactions] = useState<AnonymizedTx[]>([]);
  const [governanceRule, setGovernanceRule] = useState('');
  const [institutionFilter, setInstitutionFilter] = useState('all');
  const [provinceFilter, setProvinceFilter] = useState('all');
  const [councilFilter, setCouncilFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [predictive, setPredictive] = useState<{
    demandForecast: string;
    revenueOutlook: string;
    leakageRisks: string[];
  } | null>(null);
  const [predLoading, setPredLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch<{
          byInstitution: ZraInstitutionRow[];
          zones: RevenueZoneItem[];
          fraudAlerts: FraudAlertRow[];
          transactions: AnonymizedTx[];
          governanceRule: string;
        }>('/api/zra/overview');
        setByInstitution(res.byInstitution);
        setZones(res.zones);
        setFraudAlerts(res.fraudAlerts);
        setTransactions(res.transactions);
        setGovernanceRule(res.governanceRule);
      } catch (err: any) {
        setError(err?.message || 'Unable to load ZRA consolidated revenue overview.');
      } finally {
        setLoading(false);
      }
    })();
  }, [apiFetch]);

  const runPredictiveAi = async () => {
    setPredLoading(true);
    try {
      const res = await apiFetch<typeof predictive>('/api/ai/predictive-insights', {
        method: 'POST',
      });
      setPredictive(res);
    } catch (err: any) {
      setError(err?.message || 'Predictive insights failed.');
    } finally {
      setPredLoading(false);
    }
  };

  const filteredInstitutions = byInstitution.filter(
    (i) =>
      (institutionFilter === 'all' || i.institutionCode === institutionFilter) &&
      (provinceFilter === 'all' || i.province === provinceFilter),
  );

  const filteredTx = transactions.filter(
    (t) =>
      (institutionFilter === 'all' || t.institutionCode === institutionFilter) &&
      (provinceFilter === 'all' || t.province === provinceFilter) &&
      (councilFilter === 'all' || t.councilName === councilFilter),
  );

  const totalVerified = filteredInstitutions.reduce((s, i) => s + i.verifiedRevenueZmw, 0);
  const totalExpected = filteredInstitutions.reduce((s, i) => s + i.expectedRevenueZmw, 0);
  const totalPendingRecon = filteredInstitutions.reduce((s, i) => s + i.pendingReconciliationZmw, 0);
  const collectionPct = totalExpected > 0 ? Math.round((totalVerified / totalExpected) * 100) : 100;

  const exportCsv = () => {
    const header = 'Receipt,Institution,Service,Amount_ZMW,Channel,Reconciliation,Province,Council\n';
    const rows = filteredTx
      .map(
        (t) =>
          `${t.receiptNumber},${t.institutionCode},"${t.serviceTitle}",${t.amountZmw},${t.channel},${t.reconciliationStatus},${t.province},"${t.councilName}"`,
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'onegov-zra-consolidated-revenue.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (error) {
    return <div className="bg-white border border-red-200 rounded-xl p-6 text-sm text-red-700">{error}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-5">
          <div>
            <div className="text-xs font-mono text-[#059669]">
              {mode === 'zra'
                ? 'Zambia Revenue Authority · Master Consolidated Oversight (Demo)'
                : 'Finance, Reconciliation & Statutory Audit Analytics (Demo)'}
            </div>
            <h1 className="text-xl font-bold text-[#0B192C]">
              {mode === 'zra' ? 'ZRA Master Revenue Dashboard' : 'Revenue Reconciliation & Predictive Reports'}
            </h1>
            <p className="text-xs text-slate-500 mt-1">{governanceRule}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={runPredictiveAi}
              disabled={predLoading}
              className="px-3.5 py-2 bg-[#0B192C] hover:bg-slate-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              {predLoading ? 'Forecasting...' : 'AI Predictive Outlook'}
            </button>
            <button
              type="button"
              onClick={exportCsv}
              className="px-3.5 py-2 border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>
        </div>

        {/* Multi-Dimensional Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div>
            <label htmlFor="zra-inst-filter" className="block text-[11px] font-semibold text-slate-500 mb-1">
              Filter by Institution
            </label>
            <select
              id="zra-inst-filter"
              value={institutionFilter}
              onChange={(e) => setInstitutionFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="all">All Participating Institutions</option>
              {byInstitution.map((i) => (
                <option key={i.institutionCode} value={i.institutionCode}>
                  {i.institutionCode} — {i.institutionName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="zra-prov-filter" className="block text-[11px] font-semibold text-slate-500 mb-1">
              Filter by Province
            </label>
            <select
              id="zra-prov-filter"
              value={provinceFilter}
              onChange={(e) => setProvinceFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="all">All Provinces</option>
              <option value="Lusaka">Lusaka</option>
              <option value="Copperbelt">Copperbelt</option>
              <option value="Southern">Southern</option>
            </select>
          </div>
          <div>
            <label htmlFor="zra-council-filter" className="block text-[11px] font-semibold text-slate-500 mb-1">
              Filter by Council
            </label>
            <select
              id="zra-council-filter"
              value={councilFilter}
              onChange={(e) => setCouncilFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="all">All Local Authorities</option>
              <option value="Lusaka City Council">Lusaka City Council</option>
              <option value="Kitwe City Council">Kitwe City Council</option>
              <option value="Livingstone City Council">Livingstone City Council</option>
            </select>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 border border-slate-200 rounded-xl">
            <div className="text-xs text-slate-500">Total Verified Revenue</div>
            <div className="text-2xl font-bold font-mono text-[#0B192C] mt-1">
              {formatZmw(totalVerified)}
            </div>
            <div className="text-xs text-[#059669] mt-1">Simulated consolidated ledger</div>
          </div>
          <div className="p-4 border border-slate-200 rounded-xl">
            <div className="text-xs text-slate-500">Collection Performance</div>
            <div className="text-2xl font-bold font-mono text-[#0B192C] mt-1">{collectionPct}%</div>
            <div className="text-xs text-slate-500 mt-1 font-mono">
              Target {formatZmw(totalExpected)}
            </div>
          </div>
          <div className="p-4 border border-slate-200 rounded-xl">
            <div className="text-xs text-slate-500">Pending Reconciliation</div>
            <div className="text-2xl font-bold font-mono text-amber-700 mt-1">
              {formatZmw(totalPendingRecon)}
            </div>
            <div className="text-xs text-slate-500 mt-1">Awaiting settlement batch</div>
          </div>
          <div className="p-4 border border-slate-200 rounded-xl">
            <div className="text-xs text-slate-500">Flagged Anomalies</div>
            <div className="text-2xl font-bold font-mono text-red-600 mt-1">{fraudAlerts.length}</div>
            <div className="text-xs text-slate-500 mt-1">Assigned for human audit</div>
          </div>
        </div>
      </div>

      {predictive && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <h2 className="text-base font-bold text-[#0B192C] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#059669]" /> OneGov AI Predictive Revenue & Leakage Briefing
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="font-bold text-[#0B192C] mb-1">Workload & Demand Forecast</div>
              <p className="text-slate-700 leading-relaxed">{predictive.demandForecast}</p>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="font-bold text-[#0B192C] mb-1">Revenue Trend Outlook</div>
              <p className="text-slate-700 leading-relaxed">{predictive.revenueOutlook}</p>
            </div>
          </div>
          <div className="text-xs">
            <div className="font-bold text-amber-800 mb-1">Priority Leakage Signals for Audit</div>
            <ul className="space-y-1 text-slate-700 list-disc pl-4">
              {predictive.leakageRisks.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Revenue By Institution Visual Chart & Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-base font-bold text-[#0B192C] mb-4">Revenue Allocation by Participating Institution</h2>
          {loading ? (
            <p className="text-sm text-slate-500">Loading institutional streams...</p>
          ) : (
            <div className="space-y-3">
              {filteredInstitutions.map((inst) => {
                const pct =
                  inst.expectedRevenueZmw > 0
                    ? Math.min(100, Math.round((inst.verifiedRevenueZmw / inst.expectedRevenueZmw) * 100))
                    : 100;
                return (
                  <div key={inst.institutionCode} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#0B192C]">
                        {inst.institutionCode} · {inst.institutionName}
                      </span>
                      <span className="font-mono font-bold text-[#0B192C]">
                        {formatZmw(inst.verifiedRevenueZmw)} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${pct < 60 ? 'bg-amber-500' : 'bg-[#059669]'}`}
                        style={{ width: `${Math.max(4, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-base font-bold text-[#0B192C] mb-4 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-600" /> Flagged Discrepancies & Fraud Alerts
          </h2>
          <div className="space-y-3">
            {fraudAlerts.map((alert) => (
              <div key={alert.id} className="p-3.5 border border-slate-200 rounded-lg space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-[#0B192C] flex items-center gap-1">
                    <AlertOctagon className="w-3.5 h-3.5 text-red-600" /> {alert.alertCode} · {alert.institutionCode}
                  </span>
                  <span className="uppercase text-[11px] font-semibold text-amber-800">{alert.severity}</span>
                </div>
                <div className="text-xs font-semibold text-slate-800">{alert.category}</div>
                <p className="text-xs text-slate-600">{alert.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Anonymized Transaction Ledger (Privacy-Preserving) */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-[#0B192C]">
            Consolidated Verified Transactions (Privacy-Preserving Ledger)
          </h2>
          <span className="text-xs text-slate-500">Citizen PII masked from oversight summary</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500">
                <th className="py-2 pr-4 font-semibold">Receipt</th>
                <th className="py-2 pr-4 font-semibold">Institution</th>
                <th className="py-2 pr-4 font-semibold">Service</th>
                <th className="py-2 pr-4 font-semibold">Province / Council</th>
                <th className="py-2 pr-4 font-semibold">Reconciliation</th>
                <th className="py-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredTx.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="py-2.5 pr-4 font-mono text-slate-700">{t.receiptNumber}</td>
                  <td className="py-2.5 pr-4 font-mono font-semibold text-[#0B192C]">{t.institutionCode}</td>
                  <td className="py-2.5 pr-4 text-slate-700">{t.serviceTitle}</td>
                  <td className="py-2.5 pr-4 text-slate-600">
                    {t.province} · {t.councilName}
                  </td>
                  <td className="py-2.5 pr-4 capitalize text-slate-700">{t.reconciliationStatus.replace(/_/g, ' ')}</td>
                  <td className="py-2.5 text-right font-mono font-bold text-[#0B192C]">
                    {formatZmw(t.amountZmw)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

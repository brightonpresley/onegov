import React, { useEffect, useState } from 'react';
import { Award, CheckCircle2, FileText, Scale, Sparkles } from 'lucide-react';
import { useOneGov } from '../context/OneGovContext';
import type { IpApplicationItem } from '../types/onegov';

export const IpPortalView: React.FC = () => {
  const { apiFetch } = useOneGov();
  const [records, setRecords] = useState<IpApplicationItem[]>([]);
  const [canReview, setCanReview] = useState(false);
  const [ipType, setIpType] = useState<'patent' | 'trademark'>('patent');
  const [title, setTitle] = useState('Solar-Powered Cassava Drying Unit with IoT Moisture Telemetry');
  const [classification, setClassification] = useState('A23N / F26B (Agricultural Technology)');
  const [description, setDescription] = useState(
    'A low-cost solar thermal cabinet dryer for Zambian farming cooperatives featuring passive thermal convection, perforated drying racks, and GSM humidity threshold alerts.',
  );
  const [similarityReport, setSimilarityReport] = useState<{
    overallComparisonSummary: string;
    matches: Array<{ reference: string; title: string; similarityPct: number; overlapNotes: string }>;
    disclaimer: string;
  } | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadRecords = async () => {
    try {
      const res = await apiFetch<{ ipApplications: IpApplicationItem[]; canReview: boolean }>('/api/ip/records');
      setRecords(res.ipApplications);
      setCanReview(res.canReview);
    } catch (err: any) {
      setError(err?.message || 'Unable to load IP records.');
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const runSimilarityCheck = async () => {
    setError(null);
    setSimLoading(true);
    try {
      const res = await apiFetch<typeof similarityReport>('/api/ai/ip-similarity', {
        method: 'POST',
        body: JSON.stringify({ ipType, title, description, classification }),
      });
      setSimilarityReport(res);
    } catch (err: any) {
      setError(err?.message || 'AI similarity screening failed.');
    } finally {
      setSimLoading(false);
    }
  };

  const handleSubmitIp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{ ipApplication: IpApplicationItem }>('/api/ip/applications', {
        method: 'POST',
        body: JSON.stringify({
          ipType,
          title,
          description,
          classification,
          similarityReport,
        }),
      });
      setSuccessMsg(`Filed ${res.ipApplication.referenceCode} into the PACRA Examination Sandbox.`);
      await loadRecords();
    } catch (err: any) {
      setError(err?.message || 'Failed to submit IP filing.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOfficerReview = async (id: number, status: string) => {
    try {
      await apiFetch(`/api/ip/applications/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      await loadRecords();
    } catch (err: any) {
      setError(err?.message || 'IP status update denied.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-5">
          <div>
            <div className="text-xs font-mono text-[#059669]">
              OneGov Intellectual Property · PACRA Integration Architecture (Demo)
            </div>
            <h1 className="text-xl font-bold text-[#0B192C]">
              Patent & Trademark Application Assistance + AI Similarity Screening
            </h1>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
            <button
              type="button"
              onClick={() => {
                setIpType('patent');
                setSimilarityReport(null);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                ipType === 'patent' ? 'bg-white text-[#0B192C] shadow-sm' : 'text-slate-600'
              }`}
            >
              Patent Invention
            </button>
            <button
              type="button"
              onClick={() => {
                setIpType('trademark');
                setClassification('Nice Class 31 (Agricultural Products)');
                setSimilarityReport(null);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                ipType === 'trademark' ? 'bg-white text-[#0B192C] shadow-sm' : 'text-slate-600'
              }`}
            >
              Trademark & Brand
            </button>
          </div>
        </div>

        {/* Statutory Authority Disclaimer */}
        <div className="mb-5 p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
          <Scale className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <strong>Statutory Notice:</strong> OneGov facilitates digital preparation and AI similarity screening.
            AI similarity analysis is <strong>NOT</strong> a legal determination of novelty, patentability, or
            infringement. <strong>PACRA</strong> remains the sole statutory authority for granting patents and
            trademarks in Zambia.
          </div>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{error}</div>}
        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-[#059669]" /> {successMsg}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={handleSubmitIp} className="lg:col-span-6 space-y-4">
            <div>
              <label htmlFor="ip-title" className="block text-xs font-semibold text-slate-700 mb-1">
                {ipType === 'patent' ? 'Invention Title' : 'Proposed Trademark / Brand Wordmark'}
              </label>
              <input
                id="ip-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label htmlFor="ip-class" className="block text-xs font-semibold text-slate-700 mb-1">
                {ipType === 'patent' ? 'IPC Technical Classification' : 'Nice Trademark Class'}
              </label>
              <input
                id="ip-class"
                type="text"
                value={classification}
                onChange={(e) => setClassification(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label htmlFor="ip-desc" className="block text-xs font-semibold text-slate-700 mb-1">
                {ipType === 'patent'
                  ? 'Technical Disclosure & Invention Abstract'
                  : 'Brand Description & Goods/Services'}
              </label>
              <textarea
                id="ip-desc"
                rows={4}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={runSimilarityCheck}
                disabled={simLoading}
                className="px-4 py-2.5 bg-[#0B192C] hover:bg-slate-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                {simLoading ? 'Screening PACRA Demo Records...' : 'Run AI Similarity Check'}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2.5 bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                {submitting ? 'Submitting...' : `Submit ${ipType === 'patent' ? 'Patent' : 'Trademark'} to PACRA`}
              </button>
            </div>
          </form>

          <div className="lg:col-span-6 bg-slate-50 border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-bold text-[#0B192C] mb-3 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-[#059669]" /> Preliminary AI Similarity Report
            </h2>

            {!similarityReport ? (
              <p className="text-xs text-slate-500 leading-relaxed py-6">
                Enter your invention or trademark details and click <strong>Run AI Similarity Check</strong> to compare
                against demo PACRA and public prior-art records.
              </p>
            ) : (
              <div data-testid="ip-similarity-report" className="space-y-3 text-xs">
                <p className="text-slate-700 leading-relaxed">{similarityReport.overallComparisonSummary}</p>
                <div className="space-y-2">
                  {similarityReport.matches.map((m) => (
                    <div key={m.reference} className="bg-white border border-slate-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono font-bold text-[#0B192C]">{m.reference}</span>
                        <span className="font-mono font-bold text-amber-700">{m.similarityPct}% overlap</span>
                      </div>
                      <div className="font-semibold text-slate-800">{m.title}</div>
                      <p className="text-slate-600 mt-1">{m.overlapNotes}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-amber-800 border-t border-slate-200 pt-2">
                  {similarityReport.disclaimer}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PACRA IP Tracking Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-base font-bold text-[#0B192C] mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#059669]" /> PACRA IP Filing Queue & Application Tracking
        </h2>
        <div className="space-y-3">
          {records.map((rec) => (
            <div key={rec.id} className="border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-mono text-slate-500">
                  {rec.referenceCode} · {rec.ipType.toUpperCase()} · {rec.classification}
                </div>
                <div className="text-sm font-bold text-[#0B192C] mt-0.5">{rec.title}</div>
                <p className="text-xs text-slate-600 mt-1 line-clamp-2">{rec.description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-semibold text-[#059669] capitalize">
                  {rec.status.replace(/_/g, ' ')}
                </span>
                {canReview && (
                  <select
                    aria-label={`PACRA Examiner action for ${rec.referenceCode}`}
                    value={rec.status}
                    onChange={(e) => handleOfficerReview(rec.id, e.target.value)}
                    className="px-2.5 py-1 text-xs border border-slate-300 rounded-md bg-white"
                  >
                    <option value="submitted">Submitted</option>
                    <option value="examiner_review">Examiner Review</option>
                    <option value="approved_by_pacra">Approved by PACRA</option>
                    <option value="clarification_needed">Clarification Needed</option>
                  </select>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

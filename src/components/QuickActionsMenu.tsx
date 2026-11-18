import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  FileCheck2,
  FilePlus2,
  X,
  Zap,
} from 'lucide-react';
import { useOneGov } from '../context/OneGovContext';
import { ISSUE_REPORT_CATEGORIES, validateIssueReportInput } from '../lib/onegovRules';
import type { ScreenId } from '../types/onegov';

interface QuickActionsMenuProps {
  activeScreen: ScreenId;
  onStartNewApplication: () => void;
  onCheckApplicationStatus: () => void;
  onOpenNotifications: () => void;
}

export const QuickActionsMenu: React.FC<QuickActionsMenuProps> = ({
  activeScreen,
  onStartNewApplication,
  onCheckApplicationStatus,
  onOpenNotifications,
}) => {
  const { apiFetch, refreshWorkspace } = useOneGov();
  const [menuOpen, setMenuOpen] = useState(false);
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [category, setCategory] = useState<string>(ISSUE_REPORT_CATEGORIES[0]);
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedTicket, setSubmittedTicket] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setIssueModalOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const openReportIssueModal = () => {
    setMenuOpen(false);
    setSubmitError(null);
    setSubmittedTicket(null);
    setIssueModalOpen(true);
  };

  const handleSubmitIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const check = validateIssueReportInput({ category, subject, details });
    if (!check.valid || !check.sanitized) {
      setSubmitError(check.error || 'Please complete all required fields.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch<{ ticket: { ticketCode: string } }>('/api/support/report-issue', {
        method: 'POST',
        body: JSON.stringify({
          ...check.sanitized,
          activeScreen,
        }),
      });
      setSubmittedTicket(res.ticket.ticketCode);
      setSubject('');
      setDetails('');
      await refreshWorkspace();
    } catch (err: any) {
      setSubmitError(err?.message || 'Unable to log issue report.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div ref={menuRef} className="relative shrink-0">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls="quick-actions-menu-list"
          onClick={() => setMenuOpen((prev) => !prev)}
          className="px-3 py-1.5 text-xs font-semibold bg-[#0B192C] hover:bg-slate-800 text-white rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
        >
          <Zap className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
          <span>Quick Actions</span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>

        {menuOpen && (
          <div
            id="quick-actions-menu-list"
            role="menu"
            aria-label="Quick Actions"
            className="absolute right-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-1.5 space-y-0.5"
          >
            <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Common Shortcuts
            </div>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onStartNewApplication();
              }}
              className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <FilePlus2 className="w-4 h-4 text-[#059669] shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <div className="text-xs font-semibold text-[#0B192C]">Start New Application</div>
                <div className="text-[11px] text-slate-500">Open guided filing &amp; AI OCR</div>
              </div>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onCheckApplicationStatus();
              }}
              className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <FileCheck2 className="w-4 h-4 text-[#059669] shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <div className="text-xs font-semibold text-[#0B192C]">Check Application Status</div>
                <div className="text-[11px] text-slate-500">Track progress &amp; officer steps</div>
              </div>
            </button>

            <div className="my-1 border-t border-slate-100" />

            <button
              type="button"
              role="menuitem"
              onClick={openReportIssueModal}
              className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-amber-50/70 transition-colors cursor-pointer"
            >
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <div className="text-xs font-semibold text-[#0B192C]">Report An Issue</div>
                <div className="text-[11px] text-slate-500">Log a service or receipt ticket</div>
              </div>
            </button>
          </div>
        )}
      </div>

      {issueModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-issue-title"
        >
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <div className="text-xs font-mono text-[#059669]">OneGov Citizen &amp; SME Support</div>
                <h2 id="report-issue-title" className="text-lg font-bold text-[#0B192C]">
                  Report An Issue
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close Report An Issue dialog"
                onClick={() => setIssueModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {submittedTicket ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold">Issue Logged: {submittedTicket}</div>
                    <p className="text-emerald-800">
                      Your report has been recorded in the OneGov support ledger and added to your notifications.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIssueModalOpen(false);
                      onOpenNotifications();
                    }}
                    className="px-3.5 py-2 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    View in Notifications
                  </button>
                  <button
                    type="button"
                    onClick={() => setIssueModalOpen(false)}
                    className="px-4 py-2 bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitIssue} className="space-y-4">
                {submitError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                    {submitError}
                  </div>
                )}

                <div>
                  <label htmlFor="issue-category" className="block text-xs font-semibold text-slate-700 mb-1">
                    Issue Category
                  </label>
                  <select
                    id="issue-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {ISSUE_REPORT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="issue-subject" className="block text-xs font-semibold text-slate-700 mb-1">
                    Subject
                  </label>
                  <input
                    id="issue-subject"
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g., Road tax receipt reference not syncing"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label htmlFor="issue-details" className="block text-xs font-semibold text-slate-700 mb-1">
                    Description &amp; Reference Details
                  </label>
                  <textarea
                    id="issue-details"
                    rows={4}
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="Include any application reference (OGV-APP-...) or receipt number..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIssueModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-[#059669] hover:bg-[#047857] disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    {submitting ? 'Submitting...' : 'Submit Issue Report'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};

import React from 'react';
import { ArrowLeft, ChevronRight, Home } from 'lucide-react';
import { ROLE_DEFINITIONS, getScreenDomainLabel, type UserRole } from '../lib/onegovRules';
import type { ScreenId } from '../types/onegov';

interface BreadcrumbTrailProps {
  role: UserRole;
  activeScreen: ScreenId;
  navigationTrail: ScreenId[];
  labelsByScreen: Record<string, string>;
  activeServiceTitle?: string | null;
  onNavigate: (screenId: ScreenId) => void;
}

export const BreadcrumbTrail: React.FC<BreadcrumbTrailProps> = ({
  role,
  activeScreen,
  navigationTrail,
  labelsByScreen,
  activeServiceTitle,
  onNavigate,
}) => {
  const roleMeta = ROLE_DEFINITIONS[role];
  const rootScreen = (roleMeta?.defaultScreen || 'citizen-dashboard') as ScreenId;
  const rootLabel = labelsByScreen[rootScreen] || 'Workspace Home';
  const domainLabel = getScreenDomainLabel(activeScreen);

  const rawTrail = navigationTrail.length > 0 ? navigationTrail : [activeScreen];
  const previousModule = rawTrail.length > 1 ? rawTrail[rawTrail.length - 2] : null;
  const previousLabel = previousModule ? labelsByScreen[previousModule] || previousModule : null;

  const showWorkspaceHomePrefix = rawTrail[0] !== rootScreen;

  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200/80">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs min-w-0">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li className="inline-flex items-center gap-1.5">
            {activeScreen === rootScreen && !showWorkspaceHomePrefix ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-500">
                <Home className="w-3.5 h-3.5 text-[#059669]" aria-hidden="true" />
                <span>{roleMeta?.shortLabel || 'Workspace'}</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate(rootScreen)}
                className="inline-flex items-center gap-1.5 font-medium text-slate-600 hover:text-[#059669] transition-colors cursor-pointer"
              >
                <Home className="w-3.5 h-3.5 text-[#059669]" aria-hidden="true" />
                <span>{showWorkspaceHomePrefix ? rootLabel : roleMeta?.shortLabel || 'Workspace'}</span>
              </button>
            )}
          </li>

          {rawTrail.length === 1 && (
            <li className="inline-flex items-center gap-1.5 text-slate-400">
              <ChevronRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="font-medium text-slate-500">{domainLabel}</span>
            </li>
          )}

          {rawTrail.map((screenId, idx) => {
            const isLast = idx === rawTrail.length - 1;
            const label = labelsByScreen[screenId] || screenId;
            const isCurrentPage = isLast && !(activeScreen === 'application-workflow' && activeServiceTitle);

            return (
              <li key={`${screenId}-${idx}`} className="inline-flex items-center gap-1.5 min-w-0">
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                {isLast ? (
                  <span
                    aria-current={isCurrentPage ? 'page' : undefined}
                    className={`truncate ${
                      isCurrentPage ? 'font-bold text-[#0B192C]' : 'font-semibold text-slate-700'
                    }`}
                  >
                    {label}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onNavigate(screenId)}
                    className="font-medium text-slate-600 hover:text-[#059669] hover:underline transition-colors truncate cursor-pointer"
                  >
                    {label}
                  </button>
                )}
              </li>
            );
          })}

          {activeScreen === 'application-workflow' && activeServiceTitle && (
            <li className="inline-flex items-center gap-1.5 min-w-0">
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
              <span aria-current="page" className="font-bold text-[#0B192C] truncate max-w-[260px] sm:max-w-xs">
                {activeServiceTitle}
              </span>
            </li>
          )}
        </ol>
      </nav>

      {previousModule && previousLabel && (
        <button
          type="button"
          onClick={() => onNavigate(previousModule)}
          className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:border-[#059669] hover:text-[#059669] rounded-md inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          Back to {previousLabel}
        </button>
      )}
    </div>
  );
};

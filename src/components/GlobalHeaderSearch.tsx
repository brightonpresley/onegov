import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Compass, Search, Sparkles, X } from 'lucide-react';
import { filterGlobalServiceNavigation, formatZmw } from '../lib/onegovRules';
import type { ScreenId, ServiceItem } from '../types/onegov';

export interface NavSearchModuleItem {
  id: ScreenId;
  label: string;
  keywords?: string;
  icon: React.FC<{ className?: string }>;
}

interface GlobalHeaderSearchProps {
  modules: NavSearchModuleItem[];
  services: ServiceItem[];
  activeScreen: ScreenId;
  onSelectModule: (screenId: ScreenId) => void;
  onSelectService: (service: ServiceItem) => void;
}

export const GlobalHeaderSearch: React.FC<GlobalHeaderSearchProps> = ({
  modules,
  services,
  activeScreen,
  onSelectModule,
  onSelectService,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(
    () =>
      filterGlobalServiceNavigation({
        query,
        modules,
        services,
        maxModules: 7,
        maxServices: 5,
      }),
    [query, modules, services],
  );

  const flatActions = useMemo(() => {
    const items: Array<
      | { type: 'module'; key: string; mod: NavSearchModuleItem }
      | { type: 'service'; key: string; svc: ServiceItem }
    > = [];
    for (const mod of filtered.modules) {
      items.push({ type: 'module', key: `mod:${mod.id}`, mod });
    }
    for (const svc of filtered.services) {
      items.push({ type: 'service', key: `svc:${svc.code}`, svc });
    }
    return items;
  }, [filtered]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [query]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (!isTyping && event.key === '/') {
        event.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const activateItem = (index: number) => {
    const entry = flatActions[index];
    if (!entry) return;
    if (entry.type === 'module') {
      onSelectModule(entry.mod.id);
    } else {
      onSelectService(entry.svc);
    }
    setIsOpen(false);
    setQuery('');
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      if (flatActions.length > 0) {
        setActiveIndex((prev) => (prev + 1) % flatActions.length);
      }
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIsOpen(true);
      if (flatActions.length > 0) {
        setActiveIndex((prev) => (prev <= 0 ? flatActions.length - 1 : prev - 1));
      }
      return;
    }
    if (e.key === 'Enter' && flatActions.length > 0) {
      e.preventDefault();
      activateItem(activeIndex >= 0 ? activeIndex : 0);
    }
  };

  const hasResults = filtered.modules.length > 0 || filtered.services.length > 0;

  return (
    <div
      ref={containerRef}
      className="relative order-last w-full md:order-none md:flex-1 md:max-w-md"
    >
      <div className="relative flex items-center">
        <Search
          className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="global-module-search-results"
          aria-autocomplete="list"
          aria-label="Search OneGov service modules and government services"
          placeholder="Jump to module or service (RTSA, ZESCO, GIS, TPIN...)"
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="w-full pl-9 pr-9 py-1.5 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg text-[#0B192C] placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#059669] focus:ring-2 focus:ring-[#059669]/20 transition-colors"
        />
        {query ? (
          <button
            type="button"
            aria-label="Clear module search"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-white border border-slate-200 rounded absolute right-2.5 pointer-events-none">
            /
          </kbd>
        )}
      </div>

      {isOpen && (
        <div
          id="global-module-search-results"
          role="listbox"
          aria-label="Matching OneGov modules and services"
          className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-96 overflow-y-auto divide-y divide-slate-100"
        >
          {!hasResults ? (
            <div className="p-4 text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span>
                No matching modules or services found for &ldquo;{query.trim()}&rdquo;.
              </span>
              <button
                type="button"
                onClick={() => {
                  onSelectModule('ai-assistant');
                  setIsOpen(false);
                  setQuery('');
                }}
                className="px-2.5 py-1.5 bg-[#059669] hover:bg-[#047857] text-white font-semibold rounded-md inline-flex items-center gap-1 self-start cursor-pointer"
              >
                <Sparkles className="w-3 h-3" /> Ask OneGov AI Guide
              </button>
            </div>
          ) : (
            <>
              {filtered.modules.length > 0 && (
                <div className="p-2">
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {query.trim() ? 'Matching Service Modules' : 'Quick Jump Modules'}
                  </div>
                  <div className="space-y-0.5">
                    {filtered.modules.map((mod, idx) => {
                      const Icon = mod.icon;
                      const isCurrent = activeScreen === mod.id;
                      const isHighlighted = activeIndex === idx;
                      return (
                        <button
                          key={mod.id}
                          type="button"
                          role="option"
                          aria-selected={isHighlighted}
                          onClick={() => {
                            onSelectModule(mod.id);
                            setIsOpen(false);
                            setQuery('');
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                            isHighlighted
                              ? 'bg-emerald-50 text-[#0B192C]'
                              : 'hover:bg-slate-50 text-slate-800'
                          }`}
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <Icon className="w-4 h-4 text-[#059669] shrink-0" />
                            <span className="font-semibold text-[#0B192C] truncate">
                              {mod.label}
                            </span>
                          </span>
                          <span className="text-[11px] font-mono text-slate-400 shrink-0 ml-2 flex items-center gap-1">
                            {isCurrent ? 'Active' : 'Open'}
                            <ArrowRight className="w-3 h-3" />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {filtered.services.length > 0 && (
                <div className="p-2">
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Catalog Services
                  </div>
                  <div className="space-y-0.5">
                    {filtered.services.map((svc, idx) => {
                      const flatIdx = filtered.modules.length + idx;
                      const isHighlighted = activeIndex === flatIdx;
                      return (
                        <button
                          key={svc.code}
                          type="button"
                          role="option"
                          aria-selected={isHighlighted}
                          onClick={() => {
                            onSelectService(svc);
                            setIsOpen(false);
                            setQuery('');
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                            isHighlighted
                              ? 'bg-emerald-50 text-[#0B192C]'
                              : 'hover:bg-slate-50 text-slate-800'
                          }`}
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <Compass className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="min-w-0">
                              <span className="font-semibold text-[#0B192C] block truncate">
                                {svc.title}
                              </span>
                              <span className="text-[11px] font-mono text-slate-500">
                                {svc.institutionCode} · {svc.code}
                              </span>
                            </span>
                          </span>
                          <span className="text-[11px] font-mono font-semibold text-[#059669] shrink-0 ml-2">
                            {formatZmw(svc.feeZmw)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

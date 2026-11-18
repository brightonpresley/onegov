import React, { useEffect, useState } from 'react';
import {
  Bookmark,
  CheckCircle2,
  ClipboardCheck,
  Download,
  ExternalLink,
  MapPin,
  Navigation,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useOneGov } from '../context/OneGovContext';
import { formatZmw, parseZoneCoordinates, type MapsGroundingPlace } from '../lib/onegovRules';
import type { InvestigationItem, RevenueZoneItem } from '../types/onegov';
import { CivicGoogleMap, hasGoogleMapsApiKey } from './CivicGoogleMap';

export const CouncilGisIntelligenceView: React.FC = () => {
  const {
    apiFetch,
    user,
    isFirebaseUser,
    savedLocations,
    saveLocationBookmark,
    removeLocationBookmark,
  } = useOneGov();
  const [zones, setZones] = useState<RevenueZoneItem[]>([]);
  const [investigations, setInvestigations] = useState<InvestigationItem[]>([]);
  const [selectedZone, setSelectedZone] = useState<RevenueZoneItem | null>(null);
  const [provinceFilter, setProvinceFilter] = useState<string>('all');
  const [mapMode, setMapMode] = useState<'google' | 'schematic'>(
    hasGoogleMapsApiKey() ? 'google' : 'schematic',
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [locatorQuery, setLocatorQuery] = useState(
    'Find nearest Lusaka City Council, ZRA, and RTSA service stations near Chawama Lusaka',
  );
  const [locatorLoading, setLocatorLoading] = useState(false);
  const [locatorError, setLocatorError] = useState<string | null>(null);
  const [locatorResult, setLocatorResult] = useState<{
    reply: string;
    places: MapsGroundingPlace[];
  } | null>(null);
  const [bookmarkMsg, setBookmarkMsg] = useState<string | null>(null);

  const [aiAnalysis, setAiAnalysis] = useState<{
    confirmedFindings: string[];
    possibleExplanations: string[];
    areasForFurtherInvestigation: string[];
    recommendedOfficerActions: string[];
  } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [caseSavedMsg, setCaseSavedMsg] = useState<string | null>(null);

  const loadCouncilData = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    setLoadError(null);
    try {
      const res = await apiFetch<{ zones: RevenueZoneItem[]; investigations: InvestigationItem[] }>(
        '/api/council/intelligence',
      );
      setZones(res.zones);
      setInvestigations(res.investigations);
      setSelectedZone((prev) => {
        if (prev) {
          const updated = res.zones.find((z) => z.id === prev.id);
          if (updated) return updated;
        }
        return res.zones.find((z) => z.zoneCode === 'LSK-W12') || res.zones[0] || null;
      });
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to load council GIS intelligence.');
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    loadCouncilData(true);
  }, []);

  const filteredZones = zones.filter(
    (z) => provinceFilter === 'all' || z.province === provinceFilter,
  );

  const runAiDiagnostic = async (zone: RevenueZoneItem) => {
    setAiError(null);
    setAiLoading(true);
    setCaseSavedMsg(null);
    try {
      const res = await apiFetch<{ analysis: typeof aiAnalysis }>('/api/ai/council-analysis', {
        method: 'POST',
        body: JSON.stringify({ zoneId: zone.id }),
      });
      setAiAnalysis(res.analysis);
    } catch (err: any) {
      setAiError(err?.message || 'AI root-cause analysis failed.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleOpenInvestigationCase = async () => {
    if (!selectedZone) return;
    setCaseSavedMsg(null);
    try {
      const res = await apiFetch<{ investigation: { caseCode: string } }>('/api/council/investigations', {
        method: 'POST',
        body: JSON.stringify({
          zoneId: selectedZone.id,
          title: `${selectedZone.name} Shortfall Investigation (${selectedZone.metrics.performancePct}% Collection)`,
          confirmedFindings:
            aiAnalysis?.confirmedFindings || selectedZone.indicatorsJson,
          possibleExplanations:
            aiAnalysis?.possibleExplanations || ['Potential unpaid trading permits and property rates.'],
          furtherInvestigation:
            aiAnalysis?.areasForFurtherInvestigation || ['Field officer permit audit & POS sync review.'],
          officerNotes: `Opened by ${user?.fullName || 'Council Officer'} from OneGov GIS Map.`,
        }),
      });
      setCaseSavedMsg(`Investigation case ${res.investigation.caseCode} created and assigned.`);
      await loadCouncilData();
    } catch (err: any) {
      setAiError(err?.message || 'Failed to create investigation case.');
    }
  };

  const handleUpdateInvestigationStatus = async (inv: InvestigationItem, nextStatus: string) => {
    try {
      await apiFetch(`/api/council/investigations/${inv.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: nextStatus,
          officerNotes: inv.officerNotes || `Status updated to ${nextStatus}`,
        }),
      });
      await loadCouncilData();
    } catch (err: any) {
      setAiError(err?.message || 'Could not update investigation status.');
    }
  };

  const exportWardReport = () => {
    if (!selectedZone) return;
    const report = {
      generatedAt: new Date().toISOString(),
      environment: 'DEMO / SIMULATED DATA',
      zone: selectedZone,
      aiDiagnostics: aiAnalysis,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `onegov-ward-investigation-${selectedZone.zoneCode}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const runMapsGroundingSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!locatorQuery.trim()) return;
    setLocatorLoading(true);
    setLocatorError(null);
    try {
      const coords = selectedZone
        ? parseZoneCoordinates(selectedZone.latitude, selectedZone.longitude)
        : null;
      const res = await apiFetch<{ reply: string; places: MapsGroundingPlace[] }>(
        '/api/ai/maps-grounding',
        {
          method: 'POST',
          body: JSON.stringify({
            query: locatorQuery.trim(),
            latitude: coords?.lat ?? -15.4167,
            longitude: coords?.lng ?? 28.2833,
          }),
        },
      );
      setLocatorResult(res);
    } catch (err: any) {
      setLocatorError(err?.message || 'Unable to query grounded civic locations.');
    } finally {
      setLocatorLoading(false);
    }
  };

  const handleBookmarkSelectedZone = async () => {
    if (!selectedZone) return;
    setBookmarkMsg(null);
    const coords = parseZoneCoordinates(selectedZone.latitude, selectedZone.longitude);
    if (!coords) return;
    try {
      await saveLocationBookmark({
        id: `ward-${selectedZone.zoneCode}`,
        title: selectedZone.name,
        institutionCode: selectedZone.institutionCode || 'LCC',
        zoneCode: selectedZone.zoneCode,
        notes: `${selectedZone.councilName} (${selectedZone.metrics.performancePct}% performance)`,
        latitude: coords.lat,
        longitude: coords.lng,
      });
      setBookmarkMsg(`Saved ${selectedZone.name} to your Firestore workspace.`);
    } catch (err: any) {
      setBookmarkMsg(err?.message || 'Bookmark requires verified Google Sign-In.');
    }
  };

  if (loadError) {
    return (
      <div className="bg-white border border-red-200 rounded-xl p-6 text-sm text-red-800">
        {loadError}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-5">
          <div>
            <div className="text-xs font-mono text-[#059669]">
              OneGov Council Revenue Intelligence · GIS Spatial Analytics (Demo)
            </div>
            <h1 className="text-xl font-bold text-[#0B192C]">
              Geographical Revenue Performance & Ward Shortfall Diagnostics
            </h1>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
            {['all', 'Lusaka', 'Copperbelt', 'Southern'].map((prov) => (
              <button
                key={prov}
                type="button"
                onClick={() => setProvinceFilter(prov)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  provinceFilter === prov
                    ? 'bg-white text-[#0B192C] shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {prov === 'all' ? 'All Provinces' : prov}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Interactive GIS Spatial Map (Google Maps + Ward Schematic) */}
          <div className="lg:col-span-7 border border-slate-200 rounded-xl p-4 bg-[#f8fafc]">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[#0B192C]">
                  Interactive Zambia Council &amp; Ward Revenue Map
                </span>
                <div className="inline-flex bg-slate-200/80 p-0.5 rounded-md">
                  <button
                    type="button"
                    onClick={() => setMapMode('google')}
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded cursor-pointer ${
                      mapMode === 'google'
                        ? 'bg-white text-[#0B192C] shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Google Map
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapMode('schematic')}
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded cursor-pointer ${
                      mapMode === 'schematic'
                        ? 'bg-white text-[#0B192C] shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Ward Schematic
                  </button>
                </div>
              </div>
              <span className="font-mono flex items-center gap-3 flex-wrap">
                <span className="text-red-600 font-semibold whitespace-nowrap">● &lt;55% Critical</span>
                <span className="text-amber-600 font-semibold whitespace-nowrap">● 55–79% Attention</span>
                <span className="text-[#059669] font-semibold whitespace-nowrap">● ≥80% Nominal</span>
              </span>
            </div>

            {mapMode === 'google' ? (
              <CivicGoogleMap
                zones={filteredZones}
                selectedZone={selectedZone}
                onSelectZone={(zone) => {
                  setSelectedZone(zone);
                  setAiAnalysis(null);
                  setCaseSavedMsg(null);
                }}
                onFallbackToSchematic={() => setMapMode('schematic')}
              />
            ) : (
              <div className="relative w-full overflow-hidden rounded-lg border border-slate-200 bg-white">
                <svg
                  viewBox="0 0 640 540"
                  className="w-full h-[380px]"
                  role="img"
                  aria-label="Zambia Council GIS Revenue Heatmap"
                  data-testid="gis-revenue-map"
                >
                  {/* Stylized Republic of Zambia geographic boundary */}
                  <path
                    d="M150,150 L235,95 L320,85 L430,75 L525,115 L560,210 L515,305 L485,375 L425,425 L325,470 L210,490 L120,445 L105,345 L135,250 Z"
                    fill="#f1f5f9"
                    stroke="#94a3b8"
                    strokeWidth="2"
                  />
                  {/* Provincial zone corridors */}
                  <ellipse cx="380" cy="215" rx="95" ry="56" fill="#e2e8f0" opacity="0.55" />
                  <text x="380" y="148" textAnchor="middle" className="fill-slate-500 text-[11px] font-semibold">
                    Copperbelt Corridor
                  </text>
                  <ellipse cx="395" cy="345" rx="110" ry="62" fill="#e2e8f0" opacity="0.65" />
                  <text x="395" y="424" textAnchor="middle" className="fill-slate-500 text-[11px] font-semibold">
                    Lusaka Metro Councils
                  </text>
                  <ellipse cx="245" cy="462" rx="64" ry="30" fill="#e2e8f0" opacity="0.6" />
                  <text x="245" y="508" textAnchor="middle" className="fill-slate-500 text-[11px] font-semibold">
                    Southern (Livingstone)
                  </text>

                  {filteredZones.map((zone) => {
                    const isSelected = selectedZone?.id === zone.id;
                    const fill =
                      zone.metrics.status === 'critical'
                        ? '#dc2626'
                        : zone.metrics.status === 'attention'
                          ? '#d97706'
                          : '#059669';

                    const layoutMap: Record<
                      string,
                      { x: number; y: number; dx: number; dy: number; anchor: 'start' | 'end' }
                    > = {
                      'KIT-W02': { x: 332, y: 194, dx: -14, dy: -10, anchor: 'end' },
                      'KIT-W09': { x: 365, y: 235, dx: -14, dy: 14, anchor: 'end' },
                      'NDO-W06': { x: 432, y: 210, dx: 14, dy: 4, anchor: 'start' },
                      'LSK-MKT-SOW': { x: 335, y: 318, dx: -14, dy: -8, anchor: 'end' },
                      'LSK-W04': { x: 455, y: 318, dx: 14, dy: -8, anchor: 'start' },
                      'LSK-TRD-KAM': { x: 438, y: 362, dx: 14, dy: 12, anchor: 'start' },
                      'LSK-W12': { x: 355, y: 378, dx: -14, dy: 14, anchor: 'end' },
                      'LVS-W01': { x: 245, y: 462, dx: 14, dy: 4, anchor: 'start' },
                    };
                    const pos = layoutMap[zone.zoneCode] || {
                      x: zone.mapX,
                      y: zone.mapY,
                      dx: 12,
                      dy: -8,
                      anchor: 'start' as const,
                    };

                    return (
                      <g
                        key={zone.id}
                        onClick={() => {
                          setSelectedZone(zone);
                          setAiAnalysis(null);
                          setCaseSavedMsg(null);
                        }}
                        className="cursor-pointer"
                      >
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r={isSelected ? 20 : 14}
                          fill={fill}
                          fillOpacity={0.18}
                          stroke={fill}
                          strokeWidth={isSelected ? 2.5 : 1.5}
                        />
                        <circle cx={pos.x} cy={pos.y} r={6.5} fill={fill} />
                        <text
                          x={pos.x + pos.dx}
                          y={pos.y + pos.dy}
                          textAnchor={pos.anchor}
                          className="fill-[#0B192C] text-[10.5px] font-bold"
                        >
                          {zone.zoneCode} ({zone.metrics.performancePct}%)
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}

            {/* Zone Quick Picker List for Accessibility & Keyboard Navigation */}
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredZones.map((zone) => (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => {
                    setSelectedZone(zone);
                    setAiAnalysis(null);
                    setCaseSavedMsg(null);
                  }}
                  className={`text-left p-2.5 rounded-lg border text-xs transition-colors cursor-pointer flex items-center justify-between ${
                    selectedZone?.id === zone.id
                      ? 'border-[#0B192C] bg-white shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <span className="font-semibold text-[#0B192C] truncate pr-2">
                    {zone.name}
                  </span>
                  <span
                    className={`font-mono font-bold shrink-0 ${
                      zone.metrics.status === 'critical'
                        ? 'text-red-600'
                        : zone.metrics.status === 'attention'
                          ? 'text-amber-600'
                          : 'text-[#059669]'
                    }`}
                  >
                    {zone.metrics.performancePct}%
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Selected Zone Diagnostic & AI Root Cause Panel */}
          <div className="lg:col-span-5 space-y-4">
            {loading || !selectedZone ? (
              <div className="p-6 border border-slate-200 rounded-xl text-sm text-slate-500">
                Loading revenue zone telemetry...
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-mono text-slate-500 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> {selectedZone.councilName} · {selectedZone.zoneCode}
                    </div>
                    <h2 className="text-lg font-bold text-[#0B192C] mt-0.5">{selectedZone.name}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={exportWardReport}
                    className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:text-[#0B192C] cursor-pointer"
                    aria-label="Download ward investigation report"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div>
                    <div className="text-[11px] text-slate-500">Expected</div>
                    <div className="text-sm font-bold font-mono text-[#0B192C]">
                      {formatZmw(selectedZone.expectedRevenueZmw)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">Actual Verified</div>
                    <div className="text-sm font-bold font-mono text-[#0B192C]">
                      {formatZmw(selectedZone.actualRevenueZmw)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">Performance</div>
                    <div
                      className={`text-sm font-bold font-mono ${
                        selectedZone.metrics.status === 'critical' ? 'text-red-600' : 'text-[#059669]'
                      }`}
                    >
                      {selectedZone.metrics.performancePct}%
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 border border-slate-200 rounded-lg">
                    <div className="text-slate-500">Businesses</div>
                    <div className="font-mono font-bold text-[#0B192C]">{selectedZone.registeredBusinesses}</div>
                  </div>
                  <div className="p-2.5 border border-slate-200 rounded-lg">
                    <div className="text-slate-500">Active Permits</div>
                    <div className="font-mono font-bold text-[#0B192C]">
                      {selectedZone.activePermits} ({selectedZone.metrics.permitCoveragePct}%)
                    </div>
                  </div>
                  <div className="p-2.5 border border-slate-200 rounded-lg">
                    <div className="text-slate-500">Unpaid Plots</div>
                    <div className="font-mono font-bold text-amber-700">{selectedZone.unpaidProperties}</div>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-slate-700 mb-1.5">
                    Verified Operational Indicators
                  </div>
                  <ul className="space-y-1 text-xs text-slate-600">
                    {selectedZone.indicatorsJson.map((ind) => (
                      <li key={ind}>· {ind}</li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => runAiDiagnostic(selectedZone)}
                    disabled={aiLoading}
                    className="flex-1 py-2.5 px-4 bg-[#0B192C] hover:bg-slate-800 text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    {aiLoading ? 'Analysing Ward Shortfall...' : 'Analyse Why with OneGov AI'}
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenInvestigationCase}
                    className="py-2.5 px-3.5 bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Open Case
                  </button>
                  {isFirebaseUser && (
                    <button
                      type="button"
                      onClick={handleBookmarkSelectedZone}
                      className="py-2.5 px-3 border border-slate-300 hover:border-[#0B192C] bg-white text-[#0B192C] text-xs font-semibold rounded-lg inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Bookmark className="w-3.5 h-3.5" /> Save Ward
                    </button>
                  )}
                </div>

                {bookmarkMsg && (
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
                    {bookmarkMsg}
                  </div>
                )}

                {aiError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{aiError}</div>
                )}
                {caseSavedMsg && (
                  <div
                    data-testid="case-saved-banner"
                    className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0" /> {caseSavedMsg}
                  </div>
                )}

                {aiAnalysis && (
                  <div
                    data-testid="ai-council-diagnostic"
                    className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-[#0B192C] mb-1">1. Confirmed Findings (Data-Verified)</div>
                      <ul className="space-y-1 text-slate-700 list-disc pl-4">
                        {aiAnalysis.confirmedFindings.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="font-bold text-amber-800 mb-1">2. Possible Explanations (Hypotheses)</div>
                      <ul className="space-y-1 text-slate-700 list-disc pl-4">
                        {aiAnalysis.possibleExplanations.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="font-bold text-[#059669] mb-1">3. Areas Requiring Further Investigation</div>
                      <ul className="space-y-1 text-slate-700 list-disc pl-4">
                        {aiAnalysis.areasForFurtherInvestigation.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Officer Investigation Case Tracking */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-[#0B192C] flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-[#059669]" /> Council Revenue Investigation Cases
          </h2>
          <span className="text-xs text-slate-500">Human Officer Follow-Up & Task Tracking</span>
        </div>

        <div className="space-y-4">
          {investigations.map((inv) => (
            <div key={inv.id} className="border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-mono text-slate-500">
                    {inv.caseCode} · {inv.zoneName} ({inv.councilName})
                  </div>
                  <h3 className="text-sm font-bold text-[#0B192C]">{inv.title}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    aria-label={`Status for ${inv.caseCode}`}
                    value={inv.status}
                    onChange={(e) => handleUpdateInvestigationStatus(inv, e.target.value)}
                    className="px-2.5 py-1 text-xs border border-slate-300 rounded-md bg-white font-semibold"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-lg">
                  <div className="font-semibold text-[#0B192C] mb-1">Confirmed Findings</div>
                  <ul className="space-y-1 text-slate-600">
                    {inv.confirmedFindingsJson.map((f) => (
                      <li key={f}>· {f}</li>
                    ))}
                  </ul>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <div className="font-semibold text-amber-800 mb-1">Possible Explanations</div>
                  <ul className="space-y-1 text-slate-600">
                    {inv.possibleExplanationsJson.map((f) => (
                      <li key={f}>· {f}</li>
                    ))}
                  </ul>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <div className="font-semibold text-[#059669] mb-1">Follow-Up Actions</div>
                  <ul className="space-y-1 text-slate-600">
                    {inv.furtherInvestigationJson.map((f) => (
                      <li key={f}>· {f}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Nearby Civic Service Stations (Google Maps Grounding + Firestore Bookmarks) */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-[#0B192C] flex items-center gap-2">
              <Navigation className="w-4 h-4 text-[#059669]" /> Grounded Civic Office &amp; Collection Point Locator
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Locate real ZRA, RTSA, PACRA, and Council service stations around the active ward using Google Maps Grounding.
            </p>
          </div>
        </div>

        <form onSubmit={runMapsGroundingSearch} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            aria-label="Search nearby civic offices with Google Maps Grounding"
            value={locatorQuery}
            onChange={(e) => setLocatorQuery(e.target.value)}
            className="flex-1 px-3.5 py-2 text-xs border border-slate-300 rounded-lg"
            placeholder="Find RTSA stations, City Council revenue desks, or PACRA branches..."
          />
          <button
            type="submit"
            disabled={locatorLoading}
            className="px-4 py-2 bg-[#0B192C] hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            {locatorLoading ? 'Locating...' : 'Find Civic Stations'}
          </button>
        </form>

        {locatorError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            {locatorError}
          </div>
        )}

        {locatorResult && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
            <div className="text-slate-700 whitespace-pre-wrap leading-relaxed">
              {locatorResult.reply}
            </div>
            {locatorResult.places.length > 0 && (
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <div className="font-bold text-[#0B192C]">Google Maps Verified Places</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {locatorResult.places.map((place) => (
                    <div
                      key={place.uri}
                      className="p-3 bg-white border border-slate-200 rounded-lg flex flex-col justify-between gap-2"
                    >
                      <div>
                        <a
                          href={place.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-[#0B192C] hover:text-[#059669] inline-flex items-center gap-1"
                        >
                          {place.title} <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                        {place.snippets.length > 0 && (
                          <p className="text-[11px] text-slate-500 mt-1">
                            “{place.snippets[0]}”
                          </p>
                        )}
                      </div>
                      {isFirebaseUser && (
                        <button
                          type="button"
                          onClick={() => {
                            const coords = selectedZone
                              ? parseZoneCoordinates(selectedZone.latitude, selectedZone.longitude)
                              : null;
                            saveLocationBookmark({
                              title: place.title,
                              institutionCode: 'GOV',
                              mapsUri: place.uri,
                              notes: place.snippets[0] || 'Saved from Google Maps Grounding',
                              latitude: coords?.lat ?? -15.4167,
                              longitude: coords?.lng ?? 28.2833,
                            });
                          }}
                          className="self-start text-[11px] font-semibold text-[#059669] hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Bookmark className="w-3 h-3" /> Bookmark Location
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {savedLocations.length > 0 && (
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <div className="text-xs font-bold text-[#0B192C]">
              Saved Workspace Locations (Synced via Firestore)
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {savedLocations.map((loc) => (
                <div
                  key={loc.id}
                  className="p-3 border border-slate-200 rounded-lg bg-slate-50 flex items-start justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-[#0B192C] truncate">{loc.title}</div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      {loc.institutionCode} {loc.zoneCode ? `· ${loc.zoneCode}` : ''}
                    </div>
                    {loc.mapsUri && (
                      <a
                        href={loc.mapsUri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-[#059669] hover:underline inline-flex items-center gap-1 mt-1"
                      >
                        Open Maps <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${loc.title}`}
                    onClick={() => removeLocationBookmark(loc.id)}
                    className="text-slate-400 hover:text-red-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { Car, CheckCircle2, FileCheck2, GraduationCap, Home, Zap } from 'lucide-react';
import { useOneGov } from '../context/OneGovContext';
import { calculateIllustrativeRoadTax, formatZmw, type RoadTaxQuote } from '../lib/onegovRules';

export const TransportView: React.FC = () => {
  const { overview, openCheckout, setSelectedService, setActiveScreen, services } = useOneGov();
  const vehicles = overview?.vehicles ?? [];

  const [plateNumber, setPlateNumber] = useState(vehicles[0]?.plateNumber || 'BAA 4821 ZM');
  const [engineCc, setEngineCc] = useState<number>(vehicles[0]?.engineCc || 2393);
  const [vehicleClass, setVehicleClass] = useState<
    'Private Motor Car' | 'Light Commercial' | 'Heavy Goods' | 'Motorcycle' | 'Public Service'
  >('Light Commercial');
  const [quarters, setQuarters] = useState<1 | 2 | 4>(4);
  const [quote, setQuote] = useState<RoadTaxQuote>(() =>
    calculateIllustrativeRoadTax({ engineCc: 2393, vehicleClass: 'Light Commercial', quarters: 4 }),
  );

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    setQuote(calculateIllustrativeRoadTax({ engineCc, vehicleClass, quarters }));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-5">
          <div>
            <div className="text-xs font-mono text-[#059669]">OneGov Transport · RTSA & Insurance Sandbox</div>
            <h1 className="text-xl font-bold text-[#0B192C]">Road Tax, Vehicle Licensing & Insurance</h1>
          </div>
          <span className="text-xs font-mono text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded">
            ILLUSTRATIVE DEMO FEES
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={handleCalculate} className="lg:col-span-6 space-y-4">
            <h2 className="text-sm font-bold text-[#0B192C]">Road Tax Assessment Calculator</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="rt-plate" className="block text-xs font-semibold text-slate-700 mb-1">
                  Vehicle Registration Plate
                </label>
                <input
                  id="rt-plate"
                  type="text"
                  required
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="rt-cc" className="block text-xs font-semibold text-slate-700 mb-1">
                  Engine Capacity (cc)
                </label>
                <input
                  id="rt-cc"
                  type="number"
                  min={50}
                  max={10000}
                  value={engineCc}
                  onChange={(e) => setEngineCc(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="rt-class" className="block text-xs font-semibold text-slate-700 mb-1">
                  Vehicle Class
                </label>
                <select
                  id="rt-class"
                  value={vehicleClass}
                  onChange={(e) => setVehicleClass(e.target.value as typeof vehicleClass)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Private Motor Car">Private Motor Car</option>
                  <option value="Light Commercial">Light Commercial</option>
                  <option value="Heavy Goods">Heavy Goods</option>
                  <option value="Public Service">Public Service</option>
                  <option value="Motorcycle">Motorcycle</option>
                </select>
              </div>
              <div>
                <label htmlFor="rt-quarters" className="block text-xs font-semibold text-slate-700 mb-1">
                  Tax Duration
                </label>
                <select
                  id="rt-quarters"
                  value={quarters}
                  onChange={(e) => setQuarters(Number(e.target.value) as 1 | 2 | 4)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value={1}>1 Quarter (3 Months)</option>
                  <option value={2}>2 Quarters (6 Months)</option>
                  <option value={4}>Annual (4 Quarters · 5% Paperless Discount)</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-[#0B192C] hover:bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              Calculate Illustrative Road Tax
            </button>
          </form>

          <div className="lg:col-span-6 bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="text-xs font-mono text-slate-500 mb-1">
                Simulated RTSA Assessment · {plateNumber}
              </div>
              <div className="text-3xl font-bold font-mono text-[#0B192C]">
                {formatZmw(quote.totalZmw)}
              </div>
              <div className="mt-4 space-y-1.5 text-xs text-slate-600 font-mono">
                <div className="flex justify-between">
                  <span>Base Rate ({quote.quarters}Q × {formatZmw(quote.baseQuarterlyZmw)})</span>
                  <span>{formatZmw(quote.baseQuarterlyZmw * quote.quarters)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Carbon / Environmental Levy</span>
                  <span>{formatZmw(quote.carbonLevyZmw)}</span>
                </div>
                {quote.digitalFeeDiscountZmw > 0 && (
                  <div className="flex justify-between text-[#059669]">
                    <span>Greener Zambia Annual Digital Discount</span>
                    <span>-{formatZmw(quote.digitalFeeDiscountZmw)}</span>
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                openCheckout({
                  serviceCode: 'RTSA-ROAD-TAX',
                  serviceTitle: `Motor Vehicle Road Tax (${plateNumber} · ${quarters}Q)`,
                  amountZmw: quote.totalZmw,
                  province: 'Lusaka',
                  councilName: 'Lusaka City Council',
                })
              }
              className="mt-5 w-full py-2.5 px-4 bg-[#059669] hover:bg-[#047857] text-white text-sm font-semibold rounded-lg cursor-pointer"
            >
              Proceed to Sandbox Payment ({formatZmw(quote.totalZmw)})
            </button>
          </div>
        </div>
      </div>

      {/* Linked Fleet & Motor Insurance */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-base font-bold text-[#0B192C] mb-4">Registered Vehicles & Motor Insurance</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {vehicles.map((v) => (
            <div key={v.id} className="p-4 border border-slate-200 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-bold text-[#0B192C] flex items-center gap-1.5">
                  <Car className="w-4 h-4 text-[#059669]" /> {v.plateNumber}
                </span>
                <span className="text-xs text-slate-500">{v.vehicleClass}</span>
              </div>
              <div className="text-sm font-medium text-slate-700">
                {v.makeModel} ({v.year}) · {v.engineCc}cc
              </div>
              <div className="text-xs font-mono text-slate-500">
                Road Tax Expiry: {v.roadTaxExpiresAt} · Insurance: {v.insuranceProvider} (Exp {v.insuranceExpiresAt})
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setPlateNumber(v.plateNumber);
                    setEngineCc(v.engineCc);
                    setQuote(calculateIllustrativeRoadTax({ engineCc: v.engineCc, vehicleClass: 'Private Motor Car', quarters: 4 }));
                  }}
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-[#0B192C] rounded-md cursor-pointer"
                >
                  Load into Calculator
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const insSvc = services.find((s) => s.code === 'ZSIC-MOTOR-INS');
                    if (insSvc) {
                      setSelectedService(insSvc);
                      setActiveScreen('application-workflow');
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-[#059669] border border-emerald-200 rounded-md hover:bg-emerald-50 cursor-pointer"
                >
                  Renew Insurance
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const PropertyView: React.FC = () => {
  const { overview, openCheckout } = useOneGov();
  const properties = overview?.properties ?? [];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
      <div>
        <div className="text-xs font-mono text-[#059669]">OneGov Property & Land · Council Valuation Roll</div>
        <h1 className="text-xl font-bold text-[#0B192C]">Land Rates & Property Records</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {properties.map((p) => (
          <div key={p.id} className="border border-slate-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-bold text-[#0B192C] flex items-center gap-2">
                <Home className="w-4 h-4 text-[#059669]" /> {p.plotNumber}
              </div>
              <span className="text-xs font-mono text-slate-500">{p.wardCode}</span>
            </div>
            <div className="text-xs text-slate-600">
              {p.councilName} · {p.propertyType}
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-xs">
              <div>
                <div className="text-slate-500">Assessed Value</div>
                <div className="font-mono font-semibold text-[#0B192C]">{formatZmw(p.assessedValueZmw)}</div>
              </div>
              <div>
                <div className="text-slate-500">Annual Rates</div>
                <div className="font-mono font-semibold text-[#0B192C]">{formatZmw(p.annualRatesZmw)}</div>
              </div>
              <div>
                <div className="text-slate-500">Outstanding</div>
                <div className={`font-mono font-bold ${p.outstandingZmw > 0 ? 'text-amber-700' : 'text-[#059669]'}`}>
                  {formatZmw(p.outstandingZmw)}
                </div>
              </div>
            </div>
            {p.outstandingZmw > 0 ? (
              <button
                type="button"
                onClick={() =>
                  openCheckout({
                    serviceCode: 'LCC-LAND-RATES',
                    serviceTitle: `Land Rates Settlement (${p.plotNumber})`,
                    amountZmw: p.outstandingZmw,
                    councilName: p.councilName,
                    wardCode: p.wardCode,
                    propertyId: p.id,
                  })
                }
                className="w-full py-2 bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Pay Outstanding Rates ({formatZmw(p.outstandingZmw)})
              </button>
            ) : (
              <div className="text-xs font-semibold text-[#059669] flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Property Rates Cleared
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export const UtilitiesView: React.FC = () => {
  const { overview, openCheckout } = useOneGov();
  const utilities = overview?.utilities ?? [];
  const [topupAmount, setTopupAmount] = useState(250);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="text-xs font-mono text-[#059669]">OneGov Utilities · ZESCO Sandbox Integration</div>
          <h1 className="text-xl font-bold text-[#0B192C]">Electricity Accounts & Prepaid Tokens</h1>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="zesco-topup" className="text-xs font-semibold text-slate-600">
            Prepaid Top-Up (ZMW):
          </label>
          <input
            id="zesco-topup"
            type="number"
            min={50}
            value={topupAmount}
            onChange={(e) => setTopupAmount(Math.max(50, Number(e.target.value)))}
            className="w-24 px-2.5 py-1.5 text-sm font-mono border border-slate-300 rounded-lg"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {utilities.map((u) => (
          <div key={u.id} className="border border-slate-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-bold text-[#0B192C] flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-600" /> {u.accountLabel}
              </div>
              <span className="text-xs font-mono text-slate-500">{u.providerCode}</span>
            </div>
            <div className="text-xs font-mono text-slate-600">
              Meter: {u.meterNumber} · Tariff: {u.tariffType}
            </div>
            {u.lastToken && (
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs font-mono text-slate-700">
                Last Demo Token: {u.lastToken}
              </div>
            )}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-600">
                Bill Due: <strong className="font-mono">{formatZmw(u.outstandingBalanceZmw)}</strong>
              </span>
              <button
                type="button"
                onClick={() =>
                  openCheckout({
                    serviceCode: 'ZESCO-PREPAID',
                    serviceTitle: `ZESCO Meter ${u.meterNumber}`,
                    amountZmw: u.outstandingBalanceZmw > 0 ? u.outstandingBalanceZmw : topupAmount,
                    utilityId: u.id,
                  })
                }
                className="px-4 py-2 bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                {u.outstandingBalanceZmw > 0
                  ? `Settle Bill (${formatZmw(u.outstandingBalanceZmw)})`
                  : `Buy Token (${formatZmw(topupAmount)})`}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const EducationView: React.FC = () => {
  const { overview, openCheckout } = useOneGov();
  const accounts = overview?.education ?? [];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
      <div>
        <div className="text-xs font-mono text-[#059669]">OneGov Education · Institution-Isolated Fee Ledgers</div>
        <h1 className="text-xl font-bold text-[#0B192C]">School & University Fee Statements</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.map((acc) => (
          <div key={acc.id} className="border border-slate-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-bold text-[#0B192C] flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-[#059669]" /> {acc.studentName}
              </div>
              <span className="text-xs font-mono text-slate-500">ID: {acc.studentId}</span>
            </div>
            <div className="text-sm font-medium text-slate-700">{acc.schoolName}</div>
            <div className="text-xs text-slate-500">{acc.program}</div>
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div>
                <div className="text-xs text-slate-500">Term Balance</div>
                <div className="text-lg font-bold font-mono text-[#0B192C]">
                  {formatZmw(acc.termBalanceZmw)}
                </div>
              </div>
              {acc.termBalanceZmw > 0 ? (
                <button
                  type="button"
                  onClick={() =>
                    openCheckout({
                      serviceCode: 'UNZA-TUITION',
                      serviceTitle: `Tuition Payment — ${acc.studentName} (${acc.schoolName})`,
                      amountZmw: acc.termBalanceZmw,
                      educationId: acc.id,
                    })
                  }
                  className="px-4 py-2 bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Pay School Fees
                </button>
              ) : (
                <span className="text-xs font-semibold text-[#059669]">Fees Settled</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const PermitsView: React.FC = () => {
  const { services, setSelectedService, setActiveScreen } = useOneGov();
  const permitServices = services.filter((s) => ['permits', 'business'].includes(s.categorySlug));

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
      <div>
        <div className="text-xs font-mono text-[#059669]">OneGov Licences & Permits · Guided Compliance</div>
        <h1 className="text-xl font-bold text-[#0B192C]">Business Permits, Council & Statutory Licences</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {permitServices.map((svc) => (
          <div key={svc.code} className="border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="text-xs font-mono text-slate-500 mb-1">
                {svc.institutionName} ({svc.institutionCode}) · SLA {svc.slaDays} days
              </div>
              <h2 className="text-base font-bold text-[#0B192C] flex items-center gap-2 mb-1.5">
                <FileCheck2 className="w-4 h-4 text-[#059669]" /> {svc.title}
              </h2>
              <p className="text-xs text-slate-600 mb-3">{svc.description}</p>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="font-mono text-sm font-bold text-[#0B192C]">{formatZmw(svc.feeZmw)}</span>
              <button
                type="button"
                onClick={() => {
                  setSelectedService(svc);
                  setActiveScreen('application-workflow');
                }}
                className="px-4 py-1.5 bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Start Application
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

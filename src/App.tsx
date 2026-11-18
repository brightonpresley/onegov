import React, { useEffect, useState } from 'react';
import {
  Award,
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  Car,
  Compass,
  FileCheck2,
  FileText,
  GraduationCap,
  Home,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Receipt,
  Settings,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { OneGovProvider, useOneGov } from './context/OneGovContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ROLE_DEFINITIONS, type UserRole } from './lib/onegovRules';
import type { ScreenId } from './types/onegov';
import { WelcomeAuthView } from './components/WelcomeAuthView';
import { DashboardHome } from './components/DashboardHome';
import {
  ApplicationTrackingView,
  ApplicationWorkflowView,
  PaymentAndReceiptsView,
  ServiceDirectoryView,
} from './components/ServicesAndWorkflow';
import {
  EducationView,
  PermitsView,
  PropertyView,
  TransportView,
  UtilitiesView,
} from './components/VerticalModules';
import { CouncilGisIntelligenceView } from './components/CouncilGisIntelligence';
import { ZraAndReportsView } from './components/ZraAndReports';
import { IpPortalView } from './components/IpPortal';
import {
  AccountSettingsView,
  InstitutionPortalView,
  NotificationsView,
  SuperAdminView,
} from './components/AdminAndSettings';
import { AiAssistantPanel } from './components/AiAssistantPanel';
import { BreadcrumbTrail } from './components/BreadcrumbTrail';
import { GlobalHeaderSearch } from './components/GlobalHeaderSearch';
import { QuickActionsMenu } from './components/QuickActionsMenu';
import { TopNavigationProgressBar } from './components/TopNavigationProgressBar';

interface NavItem {
  id: ScreenId;
  label: string;
  keywords?: string;
  icon: React.FC<{ className?: string }>;
  roles?: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { id: 'citizen-dashboard', label: 'Citizen Dashboard', keywords: 'home personal overview summary', icon: LayoutDashboard },
  { id: 'business-dashboard', label: 'Business & SME', keywords: 'company enterprise sme pacra tpin registration', icon: Briefcase },
  { id: 'service-directory', label: 'Service Directory', keywords: 'catalog browse all services agencies', icon: Compass },
  { id: 'application-workflow', label: 'Apply & AI OCR', keywords: 'submit form upload document scan', icon: FileText },
  { id: 'application-tracking', label: 'Track Applications', keywords: 'status pending reference code workflow', icon: FileCheck2 },
  { id: 'payment-receipts', label: 'Payments & Receipts', keywords: 'momo airtel zamtel zanaco card pay receipt', icon: Receipt },
  { id: 'transport', label: 'Transport (RTSA)', keywords: 'road tax vehicle licence fitness insurance plate', icon: Car },
  { id: 'property', label: 'Property & Land', keywords: 'land rates plot council valuation deeds', icon: Home },
  { id: 'utilities', label: 'Utilities (ZESCO)', keywords: 'electricity prepaid token meter water', icon: Zap },
  { id: 'education', label: 'Education Fees', keywords: 'school tuition bursary exam university', icon: GraduationCap },
  { id: 'permits', label: 'Licences & Permits', keywords: 'trading fire health liquor council lcc', icon: FileCheck2 },
  { id: 'ip-portal', label: 'IP Patents & TM', keywords: 'pacra trademark patent invention similarity', icon: Award },
  {
    id: 'council-dashboard',
    label: 'Council GIS Intel',
    keywords: 'map google maps wards shortfall lcc revenue spatial',
    icon: MapPin,
    roles: ['council_officer', 'zra_admin', 'auditor', 'super_admin', 'institutional_admin'],
  },
  {
    id: 'zra-dashboard',
    label: 'ZRA Revenue Master',
    keywords: 'tax national revenue collection oversight treasury',
    icon: BarChart3,
    roles: ['zra_admin', 'finance_officer', 'auditor', 'super_admin'],
  },
  {
    id: 'institution-portal',
    label: 'Institution Portal',
    keywords: 'agency queue review approve reject officer',
    icon: Building2,
    roles: ['government_officer', 'council_officer', 'institutional_admin', 'zra_admin', 'ip_officer'],
  },
  {
    id: 'reports-analytics',
    label: 'Reports & Fraud',
    keywords: 'audit anomaly compliance reconciliation forecast',
    icon: ShieldCheck,
    roles: ['zra_admin', 'finance_officer', 'auditor', 'super_admin'],
  },
  {
    id: 'super-admin',
    label: 'Platform Super Admin',
    keywords: 'configuration onboarding institutions governance logs',
    icon: Settings,
    roles: ['super_admin', 'auditor'],
  },
  { id: 'ai-assistant', label: 'OneGov AI Guide', keywords: 'chat search grounding maps live voice transcription', icon: Sparkles },
  { id: 'notifications', label: 'Notifications', keywords: 'alerts inbox messages unread', icon: Bell },
  { id: 'account-settings', label: 'Account & Security', keywords: 'profile mfa low data language google', icon: Settings },
];

const SCREEN_LABELS: Record<string, string> = Object.fromEntries(
  NAV_ITEMS.map((item) => [item.id, item.label]),
);

const WorkspaceShell: React.FC = () => {
  const {
    user,
    activeScreen,
    navigationTrail,
    setActiveScreen,
    services,
    selectedService,
    setSelectedService,
    unreadCount,
    loginAsDemoRole,
    logout,
    loading,
    isBackgroundLoading,
  } = useOneGov();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!user) {
    return <WelcomeAuthView />;
  }

  const visibleNav = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(user.role),
  );

  const currentNavLabel =
    NAV_ITEMS.find((n) => n.id === activeScreen)?.label || 'Workspace';

  const renderScreen = () => {
    switch (activeScreen) {
      case 'citizen-dashboard':
        return <DashboardHome mode="citizen" />;
      case 'business-dashboard':
        return <DashboardHome mode="business" />;
      case 'service-directory':
        return <ServiceDirectoryView />;
      case 'application-workflow':
        return <ApplicationWorkflowView />;
      case 'application-tracking':
        return <ApplicationTrackingView />;
      case 'payment-receipts':
        return <PaymentAndReceiptsView />;
      case 'ai-assistant':
        return <AiAssistantPanel />;
      case 'transport':
        return <TransportView />;
      case 'property':
        return <PropertyView />;
      case 'utilities':
        return <UtilitiesView />;
      case 'education':
        return <EducationView />;
      case 'permits':
        return <PermitsView />;
      case 'ip-portal':
        return <IpPortalView />;
      case 'council-dashboard':
        return <CouncilGisIntelligenceView />;
      case 'zra-dashboard':
        return <ZraAndReportsView mode="zra" />;
      case 'reports-analytics':
        return <ZraAndReportsView mode="reports" />;
      case 'institution-portal':
        return <InstitutionPortalView />;
      case 'super-admin':
        return <SuperAdminView />;
      case 'notifications':
        return <NotificationsView />;
      case 'account-settings':
        return <AccountSettingsView />;
      default:
        return <DashboardHome mode="citizen" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex">
      <TopNavigationProgressBar isLoading={isBackgroundLoading} />
      {/* Desktop Sidebar (256px) */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col bg-[#0B192C] text-slate-100 shrink-0">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="text-lg font-bold tracking-tight text-white font-display">
            OneGov Zambia
          </div>
          <div className="text-[11px] text-emerald-300 font-mono mt-0.5 truncate">
            {ROLE_DEFINITIONS[user.role]?.label || user.role}
          </div>
        </div>

        <nav aria-label="Workspace modules" className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = activeScreen === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveScreen(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-[#059669] text-white'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.id === 'notifications' && unreadCount > 0 && (
                  <span className="font-mono text-[11px] font-bold text-emerald-300">
                    {unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-2 text-xs">
          <div className="text-slate-300 truncate font-medium">{user.fullName}</div>
          <button
            type="button"
            onClick={logout}
            className="w-full py-2 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-slate-100 font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-64 bg-[#0B192C] text-white flex flex-col h-full">
            <div className="px-4 py-4 border-b border-white/10 flex items-center justify-between">
              <span className="font-bold font-display">OneGov Zambia</span>
              <button
                type="button"
                aria-label="Close navigation menu"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {visibleNav.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveScreen(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium cursor-pointer ${
                      activeScreen === item.id ? 'bg-[#059669] text-white' : 'text-slate-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-3 border-t border-white/10">
              <button
                type="button"
                onClick={logout}
                className="w-full py-2 px-3 rounded-lg bg-white/10 text-xs font-semibold text-white cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
          <div
            className="flex-1 bg-black/40"
            onClick={() => setMobileMenuOpen(false)}
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Workspace Bar */}
        <header className="bg-white border-b border-slate-200 px-4 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3 md:gap-4">
          <div className="flex items-center gap-3 min-w-0 shrink-0">
            <button
              type="button"
              aria-label="Open navigation menu"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 border border-slate-200 rounded-lg text-slate-700 cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="text-sm font-medium text-slate-500 truncate">
              <span className="hidden sm:inline text-[#0B192C] font-semibold">OneGov</span>
              <span className="hidden sm:inline mx-2">/</span>
              <span className="text-[#0B192C] sm:text-slate-600 font-semibold sm:font-medium">
                {currentNavLabel}
              </span>
            </div>
          </div>

          <div className="order-last w-full md:order-none md:flex-1 md:max-w-xl flex items-center gap-2">
            <GlobalHeaderSearch
              modules={visibleNav}
              services={services}
              activeScreen={activeScreen}
              onSelectModule={(screenId) => setActiveScreen(screenId)}
              onSelectService={(svc) => {
                setSelectedService(svc);
                setActiveScreen('application-workflow');
              }}
            />
            <QuickActionsMenu
              activeScreen={activeScreen}
              onStartNewApplication={() => {
                if (!selectedService && services.length > 0) {
                  setSelectedService(services[0]);
                }
                setActiveScreen('application-workflow');
              }}
              onCheckApplicationStatus={() => setActiveScreen('application-tracking')}
              onOpenNotifications={() => setActiveScreen('notifications')}
            />
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="hidden sm:block text-xs font-mono text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded whitespace-nowrap">
              {user.isDemo ? 'DEMO SANDBOX' : 'VERIFIED SESSION'}
            </div>

            {user.isDemo && (
              <div className="flex items-center gap-1.5">
                <label htmlFor="header-role-switcher" className="sr-only">
                  Switch Demo Role
                </label>
                <select
                  id="header-role-switcher"
                  value={user.role}
                  disabled={loading}
                  onChange={(e) => loginAsDemoRole(e.target.value as UserRole)}
                  className="px-2 sm:px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white text-[#0B192C] max-w-[145px] sm:max-w-[190px]"
                >
                  {Object.values(ROLE_DEFINITIONS).map((r) => (
                    <option key={r.role} value={r.role}>
                      {r.shortLabel}
                      {r.institutionCode ? ` (${r.institutionCode})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">
          <BreadcrumbTrail
            role={user.role}
            activeScreen={activeScreen}
            navigationTrail={navigationTrail}
            labelsByScreen={SCREEN_LABELS}
            activeServiceTitle={selectedService?.title}
            onNavigate={(screenId) => setActiveScreen(screenId)}
          />
          {renderScreen()}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  useEffect(() => {
    const onQuotaExceeded = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  return (
    <ErrorBoundary>
      {mapsQuotaExceeded && (
        <div
          role="alert"
          className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm"
        >
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}
      <OneGovProvider>
        <WorkspaceShell />
      </OneGovProvider>
    </ErrorBoundary>
  );
}

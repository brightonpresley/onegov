import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import {
  deleteSavedLocationFromFirestore,
  deleteVoiceNoteFromFirestore,
  isVerifiedFirebaseSession,
  saveCivicLocationToFirestore,
  saveVoiceNoteToFirestore,
  subscribeSavedCivicLocations,
  subscribeVoiceNotes,
  syncAuthenticatedUserProfileToFirestore,
  type FirestoreSavedLocation,
  type FirestoreVoiceNote,
} from '../lib/firestoreStore';
import {
  isMajorModuleNavigation,
  updateBreadcrumbTrail,
  type UserRole,
  type VoiceNoteSourceType,
} from '../lib/onegovRules';
import type {
  CitizenOverviewData,
  InstitutionItem,
  NotificationItem,
  PaymentCheckoutContext,
  PaymentItem,
  RegionalConfig,
  ScreenId,
  ServiceItem,
  UserProfile,
} from '../types/onegov';

interface OneGovContextValue {
  token: string | null;
  user: UserProfile | null;
  activeScreen: ScreenId;
  navigationTrail: ScreenId[];
  setActiveScreen: (screen: ScreenId) => void;
  institutions: InstitutionItem[];
  services: ServiceItem[];
  regionalConfig: RegionalConfig;
  overview: CitizenOverviewData | null;
  notifications: NotificationItem[];
  unreadCount: number;
  selectedService: ServiceItem | null;
  setSelectedService: (service: ServiceItem | null) => void;
  pendingCheckout: PaymentCheckoutContext | null;
  openCheckout: (ctx: PaymentCheckoutContext) => void;
  clearCheckout: () => void;
  activeReceipt: PaymentItem | null;
  setActiveReceipt: (receipt: PaymentItem | null) => void;
  loading: boolean;
  isBackgroundLoading: boolean;
  authError: string | null;
  isFirebaseUser: boolean;
  savedLocations: FirestoreSavedLocation[];
  voiceNotes: FirestoreVoiceNote[];
  saveLocationBookmark: (input: {
    id?: string;
    title: string;
    institutionCode: string;
    zoneCode?: string;
    mapsUri?: string;
    notes?: string;
    latitude: number;
    longitude: number;
  }) => Promise<string>;
  removeLocationBookmark: (docId: string) => Promise<void>;
  saveVoiceNoteBookmark: (input: {
    title: string;
    transcript: string;
    sourceType: VoiceNoteSourceType;
    sourceUrl?: string;
  }) => Promise<string>;
  removeVoiceNoteBookmark: (docId: string) => Promise<void>;
  loginAsDemoRole: (role: UserRole, targetScreen?: ScreenId) => Promise<void>;
  registerDemoAccount: (payload: {
    fullName: string;
    email: string;
    phone: string;
    nrcNumber: string;
    accountType: 'citizen' | 'small_business_owner';
    businessName?: string;
    sector?: string;
  }) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshWorkspace: () => Promise<void>;
  apiFetch: <T = unknown>(url: string, init?: RequestInit) => Promise<T>;
}

const OneGovContext = createContext<OneGovContextValue | null>(null);

export const OneGovProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const didInitRef = useRef<boolean>(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeScreen, setActiveScreenState] = useState<ScreenId>('welcome');
  const activeScreenRef = useRef<ScreenId>('welcome');
  const [navigationTrail, setNavigationTrail] = useState<ScreenId[]>([]);
  const [navTransitionLoading, setNavTransitionLoading] = useState<boolean>(false);
  const navPulseTimerRef = useRef<number | null>(null);
  const refreshWorkspaceRef = useRef<() => Promise<void>>(async () => {});
  const refreshInFlightRef = useRef<boolean>(false);

  const setActiveScreen = useCallback((nextScreen: ScreenId, resetToRoot = false) => {
    const prevScreen = activeScreenRef.current;
    activeScreenRef.current = nextScreen;
    setActiveScreenState(nextScreen);
    setNavigationTrail((prev) =>
      updateBreadcrumbTrail(prev, nextScreen, { resetToRoot, maxLength: 5 }),
    );

    if (isMajorModuleNavigation(prevScreen, nextScreen) && tokenRef.current) {
      if (navPulseTimerRef.current !== null) {
        window.clearTimeout(navPulseTimerRef.current);
      }
      setNavTransitionLoading(true);
      navPulseTimerRef.current = window.setTimeout(() => {
        setNavTransitionLoading(false);
        navPulseTimerRef.current = null;
      }, 280);
      refreshWorkspaceRef.current().catch(() => undefined);
    }
  }, []);
  const [institutions, setInstitutions] = useState<InstitutionItem[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [regionalConfig, setRegionalConfig] = useState<RegionalConfig>({
    country: 'Zambia',
    countryCode: 'ZM',
    currencyCode: 'ZMW',
    currencySymbol: 'K',
    defaultLanguage: 'en',
  });
  const [overview, setOverview] = useState<CitizenOverviewData | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [pendingCheckout, setPendingCheckout] = useState<PaymentCheckoutContext | null>(null);
  const [activeReceipt, setActiveReceipt] = useState<PaymentItem | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [pendingRequestCount, setPendingRequestCount] = useState<number>(0);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isFirebaseReady, setIsFirebaseReady] = useState<boolean>(false);
  const [firebaseUid, setFirebaseUid] = useState<string | null>(null);
  const [savedLocations, setSavedLocations] = useState<FirestoreSavedLocation[]>([]);
  const [voiceNotes, setVoiceNotes] = useState<FirestoreVoiceNote[]>([]);
  const [firestoreFatalError, setFirestoreFatalError] = useState<Error | null>(null);

  if (firestoreFatalError) {
    throw firestoreFatalError;
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setIsFirebaseReady(true);
      setFirebaseUid(fbUser ? fbUser.uid : null);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!isFirebaseReady || !firebaseUid || !user || user.isDemo) {
      setSavedLocations([]);
      setVoiceNotes([]);
      return;
    }
    const unsubLocs = subscribeSavedCivicLocations(
      (items) => setSavedLocations(items),
      (err) => setFirestoreFatalError(err),
    );
    const unsubNotes = subscribeVoiceNotes(
      (items) => setVoiceNotes(items),
      (err) => setFirestoreFatalError(err),
    );
    return () => {
      unsubLocs();
      unsubNotes();
    };
  }, [isFirebaseReady, firebaseUid, user]);

  const apiFetch = useCallback(
    async <T = unknown>(url: string, init: RequestInit = {}, overrideToken?: string): Promise<T> => {
      const activeTok = overrideToken ?? tokenRef.current;
      const headers = new Headers(init.headers || {});
      if (!headers.has('Content-Type') && init.body) {
        headers.set('Content-Type', 'application/json');
      }
      if (activeTok) {
        headers.set('Authorization', `Bearer ${activeTok}`);
      }
      setPendingRequestCount((c) => c + 1);
      try {
        const res = await fetch(url, { ...init, headers });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 429) {
            const msg = String((data as { error?: string }).error || '');
            if (msg.includes('OVER_QUERY_LIMIT') || msg.includes('maps.googleapis.com')) {
              window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
            }
          }
          throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
        }
        return data as T;
      } finally {
        setPendingRequestCount((c) => Math.max(0, c - 1));
      }
    },
    [],
  );

  const loadPublicOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/public/overview');
      if (!res.ok) return;
      const data = await res.json();
      setInstitutions(data.institutions || []);
      setServices(data.services || []);
      if (data.regionalConfig) {
        setRegionalConfig(data.regionalConfig);
      }
    } catch (err) {
      console.error('Public catalog load failed:', err);
    }
  }, []);

  const fetchAuthenticatedData = useCallback(
    async (activeTok: string) => {
      const [meRes, citRes] = await Promise.all([
        apiFetch<{ user: UserProfile; notifications: NotificationItem[] }>('/api/auth/me', {}, activeTok),
        apiFetch<CitizenOverviewData>('/api/citizen/overview', {}, activeTok),
      ]);
      setUser(meRes.user);
      setNotifications(meRes.notifications || citRes.notifications || []);
      setOverview(citRes);
      return meRes.user;
    },
    [apiFetch],
  );

  const loginAsDemoRole = useCallback(
    async (role: UserRole, targetScreen?: ScreenId) => {
      setAuthError(null);
      setLoading(true);
      try {
        const res = await fetch('/api/demo/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to enter Demo Sandbox.');
        }
        tokenRef.current = data.token;
        setToken(data.token);
        await fetchAuthenticatedData(data.token);
        const defaultScreen = (targetScreen || data.roleMeta?.defaultScreen || 'citizen-dashboard') as ScreenId;
        setActiveScreen(defaultScreen, true);
      } catch (err: any) {
        setAuthError(err?.message || 'Unable to start demo session.');
      } finally {
        setLoading(false);
      }
    },
    [fetchAuthenticatedData],
  );

  const registerDemoAccount = useCallback(
    async (payload: {
      fullName: string;
      email: string;
      phone: string;
      nrcNumber: string;
      accountType: 'citizen' | 'small_business_owner';
      businessName?: string;
      sector?: string;
    }) => {
      setAuthError(null);
      setLoading(true);
      try {
        const res = await fetch('/api/demo/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Demo registration failed.');
        }
        tokenRef.current = data.token;
        setToken(data.token);
        await fetchAuthenticatedData(data.token);
        setActiveScreen(
          payload.accountType === 'small_business_owner' ? 'business-dashboard' : 'citizen-dashboard',
          true,
        );
      } catch (err: any) {
        setAuthError(err?.message || 'Registration failed.');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchAuthenticatedData],
  );

  const loginWithGoogle = useCallback(async () => {
    setAuthError(null);
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await cred.user.getIdToken();
      tokenRef.current = idToken;
      setToken(idToken);
      const profile = await fetchAuthenticatedData(idToken);
      await syncAuthenticatedUserProfileToFirestore({
        displayName: profile.fullName || cred.user.displayName || 'OneGov Citizen',
        email: profile.email || cred.user.email || '',
        phone: profile.phone,
        preferredLanguage: profile.preferredLanguage,
        lowDataMode: profile.lowDataMode,
      });
      setActiveScreen(
        profile.role === 'small_business_owner' ? 'business-dashboard' : 'citizen-dashboard',
        true,
      );
    } catch (err: any) {
      setAuthError(err?.message || 'Google Sign-In was cancelled or failed.');
    } finally {
      setLoading(false);
    }
  }, [fetchAuthenticatedData]);

  const logout = useCallback(async () => {
    try {
      await signOut(auth).catch(() => undefined);
    } finally {
      if (navPulseTimerRef.current !== null) {
        window.clearTimeout(navPulseTimerRef.current);
        navPulseTimerRef.current = null;
      }
      setNavTransitionLoading(false);
      tokenRef.current = null;
      setToken(null);
      setUser(null);
      setOverview(null);
      setNotifications([]);
      setSavedLocations([]);
      setVoiceNotes([]);
      setPendingCheckout(null);
      setActiveReceipt(null);
      setActiveScreen('welcome', true);
    }
  }, [setActiveScreen]);

  const refreshWorkspace = useCallback(async () => {
    const activeTok = tokenRef.current;
    if (!activeTok || refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    try {
      await Promise.all([loadPublicOverview(), fetchAuthenticatedData(activeTok)]);
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [loadPublicOverview, fetchAuthenticatedData]);

  useEffect(() => {
    refreshWorkspaceRef.current = refreshWorkspace;
  }, [refreshWorkspace]);

  useEffect(() => {
    return () => {
      if (navPulseTimerRef.current !== null) {
        window.clearTimeout(navPulseTimerRef.current);
      }
    };
  }, []);

  const openCheckout = useCallback((ctx: PaymentCheckoutContext) => {
    setPendingCheckout(ctx);
    setActiveReceipt(null);
    setActiveScreen('payment-receipts');
  }, []);

  const clearCheckout = useCallback(() => {
    setPendingCheckout(null);
  }, []);

  const saveLocationBookmark = useCallback(
    async (input: {
      id?: string;
      title: string;
      institutionCode: string;
      zoneCode?: string;
      mapsUri?: string;
      notes?: string;
      latitude: number;
      longitude: number;
    }) => {
      return saveCivicLocationToFirestore(input);
    },
    [],
  );

  const removeLocationBookmark = useCallback(async (docId: string) => {
    await deleteSavedLocationFromFirestore(docId);
  }, []);

  const saveVoiceNoteBookmark = useCallback(
    async (input: {
      title: string;
      transcript: string;
      sourceType: VoiceNoteSourceType;
      sourceUrl?: string;
    }) => {
      return saveVoiceNoteToFirestore(input);
    },
    [],
  );

  const removeVoiceNoteBookmark = useCallback(async (docId: string) => {
    await deleteVoiceNoteFromFirestore(docId);
  }, []);

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    (async () => {
      await loadPublicOverview();
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        const requestedRole = (params.get('role') as UserRole) || 'citizen';
        await loginAsDemoRole(requestedRole);
      }
    })();
  }, [loadPublicOverview, loginAsDemoRole]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const isFirebaseUser = Boolean(isFirebaseReady && firebaseUid && isVerifiedFirebaseSession() && !user?.isDemo);
  const isBackgroundLoading = loading || pendingRequestCount > 0 || navTransitionLoading;

  return (
    <OneGovContext.Provider
      value={{
        token,
        user,
        activeScreen,
        navigationTrail,
        setActiveScreen,
        institutions,
        services,
        regionalConfig,
        overview,
        notifications,
        unreadCount,
        selectedService,
        setSelectedService,
        pendingCheckout,
        openCheckout,
        clearCheckout,
        activeReceipt,
        setActiveReceipt,
        loading,
        isBackgroundLoading,
        authError,
        isFirebaseUser,
        savedLocations,
        voiceNotes,
        saveLocationBookmark,
        removeLocationBookmark,
        saveVoiceNoteBookmark,
        removeVoiceNoteBookmark,
        loginAsDemoRole,
        registerDemoAccount,
        loginWithGoogle,
        logout,
        refreshWorkspace,
        apiFetch,
      }}
    >
      {children}
    </OneGovContext.Provider>
  );
};

export function useOneGov() {
  const ctx = useContext(OneGovContext);
  if (!ctx) throw new Error('useOneGov must be used inside OneGovProvider');
  return ctx;
}

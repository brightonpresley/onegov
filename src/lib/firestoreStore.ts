import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import {
  ALLOWED_LANGUAGES,
  sanitizeFirestoreId,
  sanitizeSavedLocationInput,
  sanitizeVoiceNoteInput,
  type OneGovLanguage,
  type VoiceNoteSourceType,
} from './onegovRules';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface FirestoreSavedLocation {
  id: string;
  ownerId: string;
  title: string;
  institutionCode: string;
  zoneCode?: string;
  mapsUri?: string;
  notes?: string;
  latitude: number;
  longitude: number;
}

export interface FirestoreVoiceNote {
  id: string;
  ownerId: string;
  title: string;
  transcript: string;
  sourceType: VoiceNoteSourceType;
  sourceUrl?: string;
}

export function isVerifiedFirebaseSession(): boolean {
  return Boolean(auth.currentUser && auth.currentUser.emailVerified);
}

export async function syncAuthenticatedUserProfileToFirestore(params: {
  displayName: string;
  email: string;
  phone?: string | null;
  preferredLanguage?: string;
  lowDataMode?: boolean;
}): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) return;

  const uid = sanitizeFirestoreId(currentUser.uid);
  const profileRef = doc(db, 'users', uid);
  const privateRef = doc(db, 'users', uid, 'private', 'info');

  const safeLanguage: OneGovLanguage = ALLOWED_LANGUAGES.includes(
    params.preferredLanguage as OneGovLanguage,
  )
    ? (params.preferredLanguage as OneGovLanguage)
    : 'English';

  const safeName = (params.displayName || 'OneGov Citizen').trim().slice(0, 120) || 'OneGov Citizen';
  const safeEmail = (params.email || currentUser.email || '').trim().slice(0, 200);
  if (safeEmail.length < 3) return;

  try {
    const batch = writeBatch(db);
    batch.set(
      profileRef,
      {
        uid,
        displayName: safeName,
        preferredLanguage: safeLanguage,
        lowDataMode: Boolean(params.lowDataMode),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: false },
    );

    const privatePayload: Record<string, unknown> = {
      uid,
      email: safeEmail,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (params.phone && params.phone.trim()) {
      privatePayload.phone = params.phone.trim().slice(0, 32);
    }
    batch.set(privateRef, privatePayload, { merge: false });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
  }
}

export function subscribeSavedCivicLocations(
  onData: (items: FirestoreSavedLocation[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    onData([]);
    return () => {};
  }
  const ownerId = sanitizeFirestoreId(currentUser.uid);
  const path = 'savedLocations';
  const q = query(
    collection(db, path),
    where('ownerId', '==', ownerId),
    orderBy('updatedAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items: FirestoreSavedLocation[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ownerId: String(data.ownerId || ownerId),
          title: String(data.title || ''),
          institutionCode: String(data.institutionCode || 'GOV'),
          zoneCode: data.zoneCode ? String(data.zoneCode) : undefined,
          mapsUri: data.mapsUri ? String(data.mapsUri) : undefined,
          notes: data.notes ? String(data.notes) : undefined,
          latitude: Number(data.latitude || -15.4167),
          longitude: Number(data.longitude || 28.2833),
        };
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) onError(wrapped);
      }
    },
  );
}

export async function saveCivicLocationToFirestore(input: {
  id?: string;
  title: string;
  institutionCode: string;
  zoneCode?: string;
  mapsUri?: string;
  notes?: string;
  latitude: number;
  longitude: number;
}): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) {
    throw new Error('Sign in with a verified Google account to bookmark civic locations to Firestore.');
  }
  const ownerId = sanitizeFirestoreId(currentUser.uid);
  const docId = sanitizeFirestoreId(input.id || `loc-${Date.now()}`);
  const payload = sanitizeSavedLocationInput({
    ownerId,
    title: input.title,
    institutionCode: input.institutionCode,
    zoneCode: input.zoneCode,
    mapsUri: input.mapsUri,
    notes: input.notes,
    latitude: input.latitude,
    longitude: input.longitude,
  });

  const path = `savedLocations/${docId}`;
  try {
    await setDoc(doc(db, 'savedLocations', docId), {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteSavedLocationFromFirestore(docId: string): Promise<void> {
  const safeId = sanitizeFirestoreId(docId);
  const path = `savedLocations/${safeId}`;
  try {
    await deleteDoc(doc(db, 'savedLocations', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeVoiceNotes(
  onData: (items: FirestoreVoiceNote[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    onData([]);
    return () => {};
  }
  const ownerId = sanitizeFirestoreId(currentUser.uid);
  const path = 'voiceNotes';
  const q = query(
    collection(db, path),
    where('ownerId', '==', ownerId),
    orderBy('updatedAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items: FirestoreVoiceNote[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ownerId: String(data.ownerId || ownerId),
          title: String(data.title || ''),
          transcript: String(data.transcript || ''),
          sourceType: (data.sourceType as VoiceNoteSourceType) || 'transcription',
          sourceUrl: data.sourceUrl ? String(data.sourceUrl) : undefined,
        };
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) onError(wrapped);
      }
    },
  );
}

export async function saveVoiceNoteToFirestore(input: {
  title: string;
  transcript: string;
  sourceType: VoiceNoteSourceType;
  sourceUrl?: string;
}): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) {
    throw new Error('Sign in with a verified Google account to save voice transcripts to Firestore.');
  }
  const ownerId = sanitizeFirestoreId(currentUser.uid);
  const docId = sanitizeFirestoreId(`note-${Date.now()}`);
  const payload = sanitizeVoiceNoteInput({
    ownerId,
    title: input.title,
    transcript: input.transcript,
    sourceType: input.sourceType,
    sourceUrl: input.sourceUrl,
  });

  const path = `voiceNotes/${docId}`;
  try {
    await setDoc(doc(db, 'voiceNotes', docId), {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteVoiceNoteFromFirestore(docId: string): Promise<void> {
  const safeId = sanitizeFirestoreId(docId);
  const path = `voiceNotes/${safeId}`;
  try {
    await deleteDoc(doc(db, 'voiceNotes', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fetchUserLocationsOnce(): Promise<FirestoreSavedLocation[]> {
  const currentUser = auth.currentUser;
  if (!currentUser) return [];
  const ownerId = sanitizeFirestoreId(currentUser.uid);
  const path = 'savedLocations';
  try {
    const snap = await getDocs(
      query(collection(db, path), where('ownerId', '==', ownerId)),
    );
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ownerId: String(data.ownerId || ownerId),
        title: String(data.title || ''),
        institutionCode: String(data.institutionCode || 'GOV'),
        zoneCode: data.zoneCode ? String(data.zoneCode) : undefined,
        mapsUri: data.mapsUri ? String(data.mapsUri) : undefined,
        notes: data.notes ? String(data.notes) : undefined,
        latitude: Number(data.latitude || -15.4167),
        longitude: Number(data.longitude || 28.2833),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

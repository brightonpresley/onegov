# OneGov Zambia — Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Identity Integrity**: Every document in `/users/{userId}`, `/users/{userId}/private/{docId}`, `/savedLocations/{locationId}`, and `/voiceNotes/{noteId}` must carry a `uid` / `ownerId` matching `request.auth.uid`, and only email-verified Firebase accounts (`request.auth.token.email_verified == true`) may write.
2. **PII Isolation**: Private contact info (`email`, `phone`) is stored in `/users/{userId}/private/{docId}` and readable/writable exclusively by the owning `userId` or a verified bootstrapped admin.
3. **Immutable Ownership & Timestamps**: `uid`, `ownerId`, and `createdAt` cannot be modified after creation. `createdAt == request.time` on create; `updatedAt == request.time` on update.
4. **Volumetric Bounds**: Every string and document ID obeys `isValidId()` (`^[a-zA-Z0-9_-]+$`, `<= 128`) and explicit `.size()` bounds synchronized with `firebase-blueprint.json`.
5. **Query Security**: `allow list` never trusts client filters; it evaluates `resource.data.ownerId == request.auth.uid` directly without `get()`/`exists()` calls.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return `PERMISSION_DENIED`)
1. **Identity Spoofing on Create**: User A writes `/savedLocations/loc1` with `{ ownerId: "userB", ... }`.
2. **Shadow Field Injection ("Ghost Field")**: User A creates `/voiceNotes/note1` including an undeclared field `isVerified: true` or `role: "super_admin"`.
3. **Email Spoofing (Unverified Admin Claim)**: Token with `email: "brightonsinaz@gmail.com"` and `email_verified: false` tries to read User B's `/users/userB/private/info`.
4. **PII Cross-User Read**: Authenticated User A tries `get(/users/userB/private/info)`.
5. **Blanket Collection List Scrape**: Authenticated User A issues `collection('savedLocations')` query without `where('ownerId', '==', userA)`.
6. **ID Poisoning**: Write to `/voiceNotes/..%2Finvalid$id` or a 200-character ID failing `isValidId()`.
7. **Denial-of-Wallet Oversized String**: Write to `/voiceNotes/note1` with `transcript` > 4000 characters.
8. **Ownership Hijack via Update**: User A updates `/savedLocations/locA` changing `ownerId` to `"userB"`.
9. **Client Timestamp Tampering**: Create `/voiceNotes/note1` with client-forged `createdAt` != `request.time`.
10. **Immutable CreatedAt Mutation**: Update `/voiceNotes/note1` changing `createdAt`.
11. **Invalid Enum Poisoning**: Create `/voiceNotes/note1` with `sourceType: "admin_override"`.
12. **Unparented / Missing Parent Subcollection Write**: User A tries to create `/users/userA/private/extra` when `docId != 'info'` or `/users/userA` parent profile does not exist.

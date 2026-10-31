import {
  applyActionCode,
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
  verifyPasswordResetCode,
  type ActionCodeSettings,
  type User,
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { normalizePhone, sanitizeText } from '../lib/validation';
import {
  ensureCustomerProfile,
  loadCachedCustomerProfile,
  saveCachedCustomerProfile,
  updateCustomerProfileDetails,
} from '../services/pharmacyService';
import type { DeliveryZone, UserPrivateProfile, UserPublicProfile } from '../types/pharmacy';

interface AuthContextValue {
  user: User | null;
  userPublic: UserPublicProfile | null;
  userPrivate: UserPrivateProfile | null;
  isAuthReady: boolean;
  emailVerified: boolean;
  loginWithEmail: (email: string, password: string) => Promise<boolean>;
  registerWithEmail: (name: string, email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  verifyResetCode: (oobCode: string) => Promise<string>;
  completePasswordReset: (oobCode: string, newPassword: string) => Promise<void>;
  applyEmailVerificationCode: (oobCode: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  refreshVerificationState: () => Promise<boolean>;
  saveProfileDetails: (params: {
    displayName: string;
    phone: string;
    defaultZone: DeliveryZone;
  }) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function buildContinueActionSettings(path = '/login'): ActionCodeSettings | undefined {
  if (typeof window === 'undefined' || !window.location?.origin) {
    return undefined;
  }
  return {
    url: `${window.location.origin}${path}`,
    handleCodeInApp: false,
  };
}

function isContinueUriConfigError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('auth/unauthorized-continue-uri') ||
    msg.includes('auth/invalid-continue-uri') ||
    msg.includes('auth/missing-continue-uri')
  );
}

async function sendVerificationWithFallback(targetUser: User): Promise<void> {
  const settings = buildContinueActionSettings('/login?verified=1');
  if (settings) {
    try {
      await sendEmailVerification(targetUser, settings);
      return;
    } catch (err) {
      if (!isContinueUriConfigError(err)) {
        throw err;
      }
    }
  }
  await sendEmailVerification(targetUser);
}

async function sendPasswordResetWithFallback(cleanEmail: string): Promise<void> {
  const settings = buildContinueActionSettings(
    `/login?reset=1&email=${encodeURIComponent(cleanEmail)}`
  );
  if (settings) {
    try {
      await sendPasswordResetEmail(auth, cleanEmail, settings);
      return;
    } catch (err) {
      if (!isContinueUriConfigError(err)) {
        throw err;
      }
    }
  }
  await sendPasswordResetEmail(auth, cleanEmail);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userPublic, setUserPublic] = useState<UserPublicProfile | null>(null);
  const [userPrivate, setUserPrivate] = useState<UserPrivateProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);

  useEffect(() => {
    let unsubPub: (() => void) | null = null;
    let unsubPriv: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubPub) {
        unsubPub();
        unsubPub = null;
      }
      if (unsubPriv) {
        unsubPriv();
        unsubPriv = null;
      }

      setUser(firebaseUser);
      setEmailVerified(Boolean(firebaseUser?.emailVerified));

      if (!firebaseUser) {
        setUserPublic(null);
        setUserPrivate(null);
        setIsAuthReady(true);
        return;
      }

      const uid = firebaseUser.uid;
      const cached = loadCachedCustomerProfile(uid);
      const initialName =
        cached?.displayName ||
        firebaseUser.displayName ||
        firebaseUser.email?.split('@')[0] ||
        'Customer';
      const initialEmail = firebaseUser.email || cached?.email || '';

      // Hydrate immediately from Auth + UID-scoped cache so inputs never flash blank
      setUserPublic((prev) => ({
        uid,
        displayName: prev?.uid === uid && prev.displayName ? prev.displayName : initialName,
        wishlistProductIds: prev?.uid === uid ? prev.wishlistProductIds : [],
        accountDeletionRequested:
          prev?.uid === uid ? prev.accountDeletionRequested : false,
        createdAt: prev?.uid === uid ? prev.createdAt : null,
        updatedAt: prev?.uid === uid ? prev.updatedAt : null,
      }));

      setUserPrivate((prev) => ({
        uid,
        email: initialEmail,
        phone: prev?.uid === uid && prev.phone ? prev.phone : cached?.phone || '',
        defaultZone:
          prev?.uid === uid && prev.defaultZone
            ? prev.defaultZone
            : cached?.defaultZone || 'inside_dhaka',
        createdAt: prev?.uid === uid ? prev.createdAt : null,
        updatedAt: prev?.uid === uid ? prev.updatedAt : null,
      }));

      // Always attach real-time listeners independently of ensureCustomerProfile
      unsubPub = onSnapshot(
        doc(db, 'users', uid),
        (snap) => {
          if (!snap.exists()) return;
          const raw = snap.data() as Record<string, unknown>;
          const resolvedName = sanitizeText(
            (typeof raw.displayName === 'string' && raw.displayName) ||
              (typeof raw.name === 'string' && raw.name) ||
              firebaseUser.displayName ||
              initialName,
            100
          );

          setUserPublic({
            uid,
            displayName: resolvedName || 'Customer',
            wishlistProductIds: Array.isArray(raw.wishlistProductIds)
              ? (raw.wishlistProductIds as string[])
              : [],
            accountDeletionRequested: Boolean(raw.accountDeletionRequested),
            createdAt: (raw.createdAt as UserPublicProfile['createdAt']) ?? null,
            updatedAt: (raw.updatedAt as UserPublicProfile['updatedAt']) ?? null,
          });

          saveCachedCustomerProfile(uid, {
            displayName: resolvedName || 'Customer',
          });

          // Support shared Admin Panel flat fields if present on /users/{uid}
          if (typeof raw.phone === 'string' || typeof raw.defaultZone === 'string') {
            const legacyPhone =
              typeof raw.phone === 'string' ? normalizePhone(raw.phone) : undefined;
            const legacyZone: DeliveryZone | undefined =
              raw.defaultZone === 'outside_dhaka' || raw.defaultZone === 'inside_dhaka'
                ? raw.defaultZone
                : undefined;

            setUserPrivate((prev) => {
              const nextPhone = prev?.phone || legacyPhone || '';
              const nextZone = prev?.defaultZone || legacyZone || 'inside_dhaka';
              saveCachedCustomerProfile(uid, {
                phone: nextPhone,
                defaultZone: nextZone,
              });
              return {
                uid,
                email: prev?.email || initialEmail,
                phone: nextPhone,
                defaultZone: nextZone,
                createdAt: prev?.createdAt ?? null,
                updatedAt: prev?.updatedAt ?? null,
              };
            });
          }
        },
        () => {
          // Firestore rules may still be pending publication in external project
        }
      );

      unsubPriv = onSnapshot(
        doc(db, 'users', uid, 'private', 'profile'),
        (snap) => {
          if (!snap.exists()) return;
          const priv = snap.data() as UserPrivateProfile;
          const cleanPriv: UserPrivateProfile = {
            uid,
            email: priv.email || initialEmail,
            phone: normalizePhone(priv.phone || ''),
            defaultZone:
              priv.defaultZone === 'outside_dhaka' ? 'outside_dhaka' : 'inside_dhaka',
            createdAt: priv.createdAt ?? null,
            updatedAt: priv.updatedAt ?? null,
          };
          setUserPrivate(cleanPriv);
          saveCachedCustomerProfile(uid, {
            email: cleanPriv.email,
            phone: cleanPriv.phone,
            defaultZone: cleanPriv.defaultZone,
          });
        },
        () => {
          // Firestore rules may still be pending publication in external project
        }
      );

      setIsAuthReady(true);

      try {
        const ensured = await ensureCustomerProfile({
          uid,
          displayName: initialName,
          email: initialEmail,
        });
        setUserPublic((prev) =>
          prev && prev.uid === uid && prev.createdAt ? prev : ensured.publicProfile
        );
        setUserPrivate((prev) =>
          prev && prev.uid === uid && prev.createdAt ? prev : ensured.privateProfile
        );
      } catch {
        // Allow authentication session to succeed even if Firestore rules are not yet published
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubPub) unsubPub();
      if (unsubPriv) unsubPriv();
    };
  }, []);

  const loginWithEmail = async (email: string, password: string): Promise<boolean> => {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    try {
      await cred.user.reload();
      if (cred.user.emailVerified) {
        await cred.user.getIdToken(true);
      }
    } catch {
      // Proceed with cached user state if network reload is momentarily unavailable
    }

    const activeUser = auth.currentUser || cred.user;
    const isVerified = Boolean(activeUser.emailVerified);
    setUser(activeUser);
    setEmailVerified(isVerified);

    try {
      const ensured = await ensureCustomerProfile({
        uid: activeUser.uid,
        displayName: activeUser.displayName || activeUser.email?.split('@')[0] || 'Customer',
        email: activeUser.email || email.trim(),
      });
      setUserPublic(ensured.publicProfile);
      setUserPrivate(ensured.privateProfile);
    } catch {
      // Profile document will initialize once Firestore rules are published
    }

    return isVerified;
  };

  const registerWithEmail = async (name: string, email: string, password: string) => {
    const cleanName = sanitizeText(name, 100);
    const cleanEmail = email.trim();
    const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    const resolvedName = cleanName || cred.user.email?.split('@')[0] || 'Customer';

    saveCachedCustomerProfile(cred.user.uid, {
      displayName: resolvedName,
      email: cred.user.email || cleanEmail,
    });

    if (cleanName) {
      await updateProfile(cred.user, { displayName: cleanName });
    }

    await sendVerificationWithFallback(cred.user);

    setUser(cred.user);
    setEmailVerified(Boolean(cred.user.emailVerified));

    try {
      const updated = await updateCustomerProfileDetails({
        uid: cred.user.uid,
        displayName: resolvedName,
        email: cred.user.email || cleanEmail,
        phone: '',
        defaultZone: 'inside_dhaka',
      });
      setUserPublic(updated.publicProfile);
      setUserPrivate(updated.privateProfile);
    } catch {
      // Profile document will initialize once Firestore rules are published
    }
  };

  const sendPasswordReset = async (email: string) => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      throw new Error('auth/invalid-email');
    }
    await sendPasswordResetWithFallback(cleanEmail);
  };

  const verifyResetCode = async (oobCode: string): Promise<string> => {
    return await verifyPasswordResetCode(auth, oobCode.trim());
  };

  const completePasswordReset = async (oobCode: string, newPassword: string): Promise<void> => {
    await confirmPasswordReset(auth, oobCode.trim(), newPassword);
  };

  const applyEmailVerificationCode = async (oobCode: string): Promise<void> => {
    await applyActionCode(auth, oobCode.trim());
    if (auth.currentUser) {
      await auth.currentUser.reload();
      if (auth.currentUser.emailVerified) {
        await auth.currentUser.getIdToken(true);
      }
      setUser(auth.currentUser);
      setEmailVerified(Boolean(auth.currentUser.emailVerified));
    }
  };

  const resendVerification = async () => {
    if (!auth.currentUser) {
      throw new Error('ভেরিফিকেশন ইমেইল পাঠাতে প্রথমে লগইন করুন।');
    }
    await auth.currentUser.reload();
    if (auth.currentUser.emailVerified) {
      await auth.currentUser.getIdToken(true);
      setEmailVerified(true);
      return;
    }
    await sendVerificationWithFallback(auth.currentUser);
  };

  const refreshVerificationState = async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    const verified = Boolean(auth.currentUser.emailVerified);
    if (verified) {
      await auth.currentUser.getIdToken(true);
    }
    setUser(auth.currentUser);
    setEmailVerified(verified);

    try {
      const ensured = await ensureCustomerProfile({
        uid: auth.currentUser.uid,
        displayName:
          auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'Customer',
        email: auth.currentUser.email || '',
      });
      setUserPublic(ensured.publicProfile);
      setUserPrivate(ensured.privateProfile);
    } catch {
      // Profile document will initialize once Firestore rules are published
    }

    return verified;
  };

  const saveProfileDetails = async (params: {
    displayName: string;
    phone: string;
    defaultZone: DeliveryZone;
  }) => {
    const activeUser = auth.currentUser || user;
    if (!activeUser) {
      throw new Error('প্রোফাইল সংরক্ষণের জন্য প্রথমে লগইন করুন।');
    }

    const updated = await updateCustomerProfileDetails({
      uid: activeUser.uid,
      displayName: params.displayName,
      email: activeUser.email || '',
      phone: params.phone,
      defaultZone: params.defaultZone,
    });

    setUser(auth.currentUser || activeUser);
    setEmailVerified(Boolean((auth.currentUser || activeUser).emailVerified));
    setUserPublic((prev) => ({
      ...updated.publicProfile,
      wishlistProductIds:
        prev?.wishlistProductIds ?? updated.publicProfile.wishlistProductIds,
      accountDeletionRequested:
        prev?.accountDeletionRequested ?? updated.publicProfile.accountDeletionRequested,
    }));
    setUserPrivate(updated.privateProfile);
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!auth.currentUser || !auth.currentUser.email) {
      throw new Error('পাসওয়ার্ড পরিবর্তনের জন্য পুনরায় লগইন করুন।');
    }
    const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
    await reauthenticateWithCredential(auth.currentUser, credential);
    await updatePassword(auth.currentUser, newPassword);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userPublic,
        userPrivate,
        isAuthReady,
        emailVerified,
        loginWithEmail,
        registerWithEmail,
        sendPasswordReset,
        verifyResetCode,
        completePasswordReset,
        applyEmailVerificationCode,
        resendVerification,
        refreshVerificationState,
        saveProfileDetails,
        changePassword,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

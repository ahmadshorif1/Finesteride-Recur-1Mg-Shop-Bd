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
import { sanitizeText } from '../lib/validation';
import { ensureCustomerProfile } from '../services/pharmacyService';
import type { UserPrivateProfile, UserPublicProfile } from '../types/pharmacy';

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

      try {
        await ensureCustomerProfile({
          uid: firebaseUser.uid,
          displayName:
            firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Customer',
          email: firebaseUser.email || '',
        });

        unsubPub = onSnapshot(
          doc(db, 'users', firebaseUser.uid),
          (snap) => {
            if (snap.exists()) {
              setUserPublic(snap.data() as UserPublicProfile);
            }
          },
          () => {
            // Firestore rules may still be pending publication in external project
          }
        );

        unsubPriv = onSnapshot(
          doc(db, 'users', firebaseUser.uid, 'private', 'profile'),
          (snap) => {
            if (snap.exists()) {
              setUserPrivate(snap.data() as UserPrivateProfile);
            }
          },
          () => {
            // Firestore rules may still be pending publication in external project
          }
        );
      } catch {
        // Allow authentication session to succeed even if Firestore rules are not yet published
      }

      setIsAuthReady(true);
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
      await ensureCustomerProfile({
        uid: activeUser.uid,
        displayName: activeUser.displayName || activeUser.email?.split('@')[0] || 'Customer',
        email: activeUser.email || email.trim(),
      });
    } catch {
      // Profile document will initialize once Firestore rules are published
    }

    return isVerified;
  };

  const registerWithEmail = async (name: string, email: string, password: string) => {
    const cleanName = sanitizeText(name, 100);
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    if (cleanName) {
      await updateProfile(cred.user, { displayName: cleanName });
    }

    await sendVerificationWithFallback(cred.user);

    setUser(cred.user);
    setEmailVerified(Boolean(cred.user.emailVerified));

    try {
      await ensureCustomerProfile({
        uid: cred.user.uid,
        displayName: cleanName || cred.user.email?.split('@')[0] || 'Customer',
        email: cred.user.email || email.trim(),
      });
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
      await ensureCustomerProfile({
        uid: auth.currentUser.uid,
        displayName:
          auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'Customer',
        email: auth.currentUser.email || '',
      });
    } catch {
      // Profile document will initialize once Firestore rules are published
    }

    return verified;
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

import {
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
  type User,
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  auth,
  db,
  resolvePendingGoogleRedirect,
  signInWithGoogleSmart,
} from '../lib/firebase';
import { sanitizeText } from '../lib/validation';
import { ensureCustomerProfile } from '../services/pharmacyService';
import type { UserPrivateProfile, UserPublicProfile } from '../types/pharmacy';

interface AuthContextValue {
  user: User | null;
  userPublic: UserPublicProfile | null;
  userPrivate: UserPrivateProfile | null;
  isAuthReady: boolean;
  emailVerified: boolean;
  loginWithGoogle: () => Promise<User | null>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (name: string, email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  refreshVerificationState: () => Promise<boolean>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userPublic, setUserPublic] = useState<UserPublicProfile | null>(null);
  const [userPrivate, setUserPrivate] = useState<UserPrivateProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);

  useEffect(() => {
    void resolvePendingGoogleRedirect().then((redirectCred) => {
      if (redirectCred?.user) {
        setUser(redirectCred.user);
        setEmailVerified(true);
      }
    });

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
      // Accounts are immediately active upon sign-in/registration (Google or Email/Password)
      setEmailVerified(Boolean(firebaseUser));

      if (!firebaseUser) {
        setUserPublic(null);
        setUserPrivate(null);
        setIsAuthReady(true);
        return;
      }

      try {
        await ensureCustomerProfile({
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Customer',
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

  const loginWithGoogle = async (): Promise<User | null> => {
    const cred = await signInWithGoogleSmart();
    if (cred?.user) {
      setUser(cred.user);
      setEmailVerified(true);
      try {
        await ensureCustomerProfile({
          uid: cred.user.uid,
          displayName: cred.user.displayName || cred.user.email?.split('@')[0] || 'Customer',
          email: cred.user.email || '',
        });
      } catch {
        // Profile document will initialize once Firestore rules are published
      }
      return cred.user;
    }
    return auth.currentUser;
  };

  const loginWithEmail = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    setUser(cred.user);
    setEmailVerified(true);
    try {
      await ensureCustomerProfile({
        uid: cred.user.uid,
        displayName: cred.user.displayName || cred.user.email?.split('@')[0] || 'Customer',
        email: cred.user.email || email.trim(),
      });
    } catch {
      // Profile document will initialize once Firestore rules are published
    }
  };

  const registerWithEmail = async (name: string, email: string, password: string) => {
    const cleanName = sanitizeText(name, 100);
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    if (cleanName) {
      await updateProfile(cred.user, { displayName: cleanName });
    }
    setUser(cred.user);
    setEmailVerified(true);
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
    await sendPasswordResetEmail(auth, email.trim());
  };

  const resendVerification = async () => {
    if (auth.currentUser && !auth.currentUser.emailVerified) {
      await sendEmailVerification(auth.currentUser);
    }
  };

  const refreshVerificationState = async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    setEmailVerified(true);
    try {
      await ensureCustomerProfile({
        uid: auth.currentUser.uid,
        displayName: auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'Customer',
        email: auth.currentUser.email || '',
      });
    } catch {
      // Profile document will initialize once Firestore rules are published
    }
    return true;
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
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        sendPasswordReset,
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

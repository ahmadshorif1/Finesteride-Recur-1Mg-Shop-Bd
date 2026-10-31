import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  MailCheck,
  RefreshCw,
  Send,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { BrandLogoMark } from '../components/PharmacyIcons';
import { SEOHead } from '../components/SEOHead';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useStore } from '../contexts/StoreContext';

type AuthViewMode = 'login' | 'register' | 'reset' | 'confirm-reset';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESET_COOLDOWN_SECONDS = 45;

export function AuthPage() {
  const {
    user,
    emailVerified,
    loginWithEmail,
    registerWithEmail,
    sendPasswordReset,
    verifyResetCode,
    completePasswordReset,
    applyEmailVerificationCode,
    resendVerification,
    refreshVerificationState,
    logout,
  } = useAuth();
  const { siteSettings } = useStore();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const redirectTarget = searchParams.get('redirect') || '/account';
  const actionModeParam = searchParams.get('mode');
  const oobCodeParam = searchParams.get('oobCode');

  const resolveInitialMode = (): AuthViewMode => {
    if (oobCodeParam && actionModeParam === 'resetPassword') {
      return 'confirm-reset';
    }
    if (
      location.pathname === '/forgot-password' ||
      actionModeParam === 'forgot' ||
      actionModeParam === 'reset'
    ) {
      return 'reset';
    }
    if (location.pathname === '/register') {
      return 'register';
    }
    return 'login';
  };

  const [mode, setMode] = useState<AuthViewMode>(resolveInitialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState(() => searchParams.get('email') || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Forgot Password & Reset Confirmation state
  const [resetEmailSentTo, setResetEmailSentTo] = useState<string | null>(null);
  const [resetCooldown, setResetCooldown] = useState(0);
  const [activeOobCode, setActiveOobCode] = useState<string | null>(
    oobCodeParam && actionModeParam === 'resetPassword' ? oobCodeParam : null
  );
  const [verifyingResetCode, setVerifyingResetCode] = useState(
    Boolean(oobCodeParam && actionModeParam === 'resetPassword')
  );
  const [resetCodeAccountEmail, setResetCodeAccountEmail] = useState<string | null>(null);
  const [resetCodeInvalid, setResetCodeInvalid] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sync mode if user navigates between /login, /register, and /forgot-password
  useEffect(() => {
    if (oobCodeParam && actionModeParam === 'resetPassword') {
      setMode('confirm-reset');
      setActiveOobCode(oobCodeParam);
      return;
    }
    if (location.pathname === '/forgot-password') {
      setMode('reset');
    } else if (location.pathname === '/register' && mode === 'login') {
      setMode('register');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, oobCodeParam, actionModeParam]);

  // Show helpful banner when returning from Firebase hosted password reset page (?reset=1)
  useEffect(() => {
    if (searchParams.get('reset') === '1' && !oobCodeParam) {
      const returnedEmail = searchParams.get('email');
      if (returnedEmail) {
        setEmail(returnedEmail);
      }
      setSuccessMsg(
        t(
          'পাসওয়ার্ড রিসেট সম্পন্ন হলে আপনার নতুন পাসওয়ার্ড দিয়ে নিচে লগইন করুন।',
          'Once you have set your new password, sign in below with your updated credentials.'
        )
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown timer for Resend Password Reset Email
  useEffect(() => {
    if (resetCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResetCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resetCooldown]);

  // Handle in-app Firebase Email Verification link (?mode=verifyEmail&oobCode=...)
  useEffect(() => {
    if (!oobCodeParam || actionModeParam !== 'verifyEmail') return;

    let cancelled = false;
    const runVerifyCode = async () => {
      setBusy(true);
      setErrorMsg(null);
      try {
        await applyEmailVerificationCode(oobCodeParam);
        if (cancelled) return;
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('mode');
        nextParams.delete('oobCode');
        nextParams.delete('apiKey');
        setSearchParams(nextParams, { replace: true });
        setSuccessMsg(
          t(
            'অভিনন্দন! আপনার ইমেইল সফলভাবে ভেরিফাই হয়েছে। এখন লগইন করতে পারেন।',
            'Your email address has been verified! You can now sign in.'
          )
        );
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(mapFirebaseAuthError(err));
        }
      } finally {
        if (!cancelled) {
          setBusy(false);
        }
      }
    };

    void runVerifyCode();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oobCodeParam, actionModeParam]);

  // Handle in-app Firebase Password Reset Code verification (?mode=resetPassword&oobCode=...)
  useEffect(() => {
    if (!activeOobCode || mode !== 'confirm-reset') return;

    let cancelled = false;
    setVerifyingResetCode(true);
    setResetCodeInvalid(false);
    setErrorMsg(null);

    verifyResetCode(activeOobCode)
      .then((verifiedEmail) => {
        if (cancelled) return;
        setResetCodeAccountEmail(verifiedEmail);
        setEmail(verifiedEmail);
      })
      .catch((err) => {
        if (cancelled) return;
        setResetCodeInvalid(true);
        setErrorMsg(mapFirebaseAuthError(err));
      })
      .finally(() => {
        if (!cancelled) {
          setVerifyingResetCode(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOobCode, mode]);

  // Redirect authenticated + verified users unless they are completing a password reset link
  useEffect(() => {
    if (user && emailVerified && mode !== 'confirm-reset') {
      navigate(redirectTarget, { replace: true });
    }
  }, [user, emailVerified, mode, navigate, redirectTarget]);

  const mapFirebaseAuthError = (err: unknown): string => {
    const raw = err instanceof Error ? err.message : String(err);
    if (raw.includes('auth/operation-not-allowed')) {
      return t(
        'বর্তমানে ইমেইল/পাসওয়ার্ড সাইন-ইন সাময়িকভাবে বন্ধ রয়েছে। Firebase Console > Authentication > Sign-in method থেকে Email/Password চালু করুন।',
        'Email/Password sign-in is currently disabled. Please enable Email/Password in Firebase Console > Authentication > Sign-in method.'
      );
    }
    if (raw.includes('auth/expired-action-code') || raw.includes('auth/invalid-action-code')) {
      return t(
        'এই ভেরিফিকেশন বা পাসওয়ার্ড রিসেট লিংকটির মেয়াদ শেষ হয়েছে অথবা ইতিমধ্যে ব্যবহৃত হয়েছে। অনুগ্রহ করে নতুন লিংকের জন্য অনুরোধ করুন।',
        'This verification or password reset link has expired or has already been used. Please request a new link.'
      );
    }
    if (raw.includes('auth/user-disabled')) {
      return t(
        'এই একাউন্টটি সাময়িকভাবে নিষ্ক্রিয় করা হয়েছে। সহায়তার জন্য কাস্টমার সাপোর্টে যোগাযোগ করুন।',
        'This account has been disabled. Please contact customer support for assistance.'
      );
    }
    if (raw.includes('auth/user-not-found') && mode === 'reset') {
      return t(
        'এই ইমেইল ঠিকানা দিয়ে কোনো একাউন্ট পাওয়া যায়নি। ইমেইলটি পুনরায় যাচাই করুন অথবা নতুন একাউন্ট রেজিস্টার করুন।',
        'No account was found with this email address. Please check the spelling or register a new account.'
      );
    }
    if (
      raw.includes('auth/invalid-credential') ||
      raw.includes('auth/wrong-password') ||
      raw.includes('auth/user-not-found')
    ) {
      return t(
        'ইমেইল অথবা পাসওয়ার্ড সঠিক নয়। পাসওয়ার্ড ভুলে গেলে "পাসওয়ার্ড ভুলে গেছেন?" অপশন ব্যবহার করুন।',
        'Invalid email or password. Use "Forgot password?" if you need to recover your account.'
      );
    }
    if (raw.includes('auth/invalid-email')) {
      return t('অনুগ্রহ করে সঠিক ইমেইল ঠিকানা লিখুন।', 'Please enter a valid email address.');
    }
    if (raw.includes('auth/email-already-in-use')) {
      return t(
        'এই ইমেইল দিয়ে ইতিমধ্যে একটি একাউন্ট খোলা হয়েছে। অনুগ্রহ করে লগইন করুন অথবা পাসওয়ার্ড ভুলে গেলে রিসেট করুন।',
        'An account already exists with this email. Please log in or reset your password if forgotten.'
      );
    }
    if (raw.includes('auth/weak-password')) {
      return t('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।', 'Password must be at least 6 characters.');
    }
    if (raw.includes('auth/too-many-requests')) {
      return t(
        'নিরাপত্তার স্বার্থে অতিরিক্ত চেষ্টার কারণে সাময়িক বিরতি দেওয়া হয়েছে। কিছুক্ষণ অপেক্ষা করে আবার চেষ্টা করুন।',
        'Too many attempts. For your security, please wait a moment before trying again.'
      );
    }
    if (raw.includes('auth/invalid-api-key') || raw.includes('auth/app-not-authorized')) {
      return t(
        'Firebase API Key বা ডোমেইন কনফিগারেশন যাচাই করুন (Vercel Environment Variables-এ অতিরিক্ত কোটেশন ছাড়া মান দিন)।',
        'Please verify your Firebase API key and domain restrictions in Vercel Environment Variables.'
      );
    }
    if (raw.includes('auth/network-request-failed')) {
      return t(
        'নেটওয়ার্ক সংযোগে সমস্যা হয়েছে। আপনার ইন্টারনেট চেক করে আবার চেষ্টা করুন।',
        'Network error. Please check your internet connection and try again.'
      );
    }
    return t(
      'কার্যক্রমটি সম্পন্ন করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
      'Could not complete the request. Please try again.'
    );
  };

  const switchMode = (nextMode: AuthViewMode) => {
    setMode(nextMode);
    setErrorMsg(null);
    setSuccessMsg(null);
    if (nextMode !== 'reset') {
      setResetEmailSentTo(null);
    }
    if (location.pathname === '/forgot-password' && nextMode !== 'reset') {
      navigate('/login', { replace: true });
    }
  };

  const triggerPasswordResetEmail = async (targetEmail: string) => {
    const cleanEmail = targetEmail.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(cleanEmail)) {
      setErrorMsg(
        t('অনুগ্রহ করে একটি বৈধ ইমেইল ঠিকানা লিখুন।', 'Please enter a valid email address.')
      );
      return;
    }

    setBusy(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await sendPasswordReset(cleanEmail);
      setEmail(cleanEmail);
      setResetEmailSentTo(cleanEmail);
      setResetCooldown(RESET_COOLDOWN_SECONDS);
      setSuccessMsg(
        t(
          'পাসওয়ার্ড পুনরুদ্ধারের ভেরিফিকেশন লিংক আপনার ইমেইলে পাঠানো হয়েছে!',
          'Password recovery verification link has been sent to your email!'
        )
      );
    } catch (err) {
      setErrorMsg(mapFirebaseAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (mode === 'reset') {
      await triggerPasswordResetEmail(email);
      return;
    }

    const cleanEmail = email.trim();
    if (!EMAIL_PATTERN.test(cleanEmail)) {
      setErrorMsg(
        t('অনুগ্রহ করে একটি বৈধ ইমেইল ঠিকানা লিখুন।', 'Please enter a valid email address.')
      );
      return;
    }

    setBusy(true);
    try {
      if (mode === 'login') {
        const isVerified = await loginWithEmail(cleanEmail, password);
        if (isVerified) {
          navigate(redirectTarget, { replace: true });
        } else {
          setSuccessMsg(
            t(
              'লগইন সফল হয়েছে। একাউন্ট সম্পূর্ণ সক্রিয় করতে আপনার ইমেইল ভেরিফাই করুন।',
              'Logged in successfully. Please verify your email address to complete activation.'
            )
          );
        }
      } else if (mode === 'register') {
        if (password.length < 6) {
          setErrorMsg(
            t(
              'নিরাপত্তার জন্য কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড দিন।',
              'Password must be at least 6 characters.'
            )
          );
          setBusy(false);
          return;
        }
        await registerWithEmail(name, cleanEmail, password);
        setSuccessMsg(
          t(
            'একাউন্ট তৈরি হয়েছে এবং আপনার ইমেইলে একটি ভেরিফিকেশন লিংক পাঠানো হয়েছে! ইনবক্স বা Spam ফোল্ডার চেক করুন।',
            'Account created and a verification link has been sent to your email! Please check your Inbox or Spam folder.'
          )
        );
      }
    } catch (err) {
      setErrorMsg(mapFirebaseAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmNewPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!activeOobCode) {
      setErrorMsg(
        t(
          'রিসেট কোড পাওয়া যায়নি। অনুগ্রহ করে নতুন পাসওয়ার্ড রিসেট লিংকের অনুরোধ করুন।',
          'Reset code is missing. Please request a new password reset link.'
        )
      );
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg(
        t(
          'নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।',
          'New password must be at least 6 characters.'
        )
      );
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setErrorMsg(
        t(
          'নতুন পাসওয়ার্ড এবং নিশ্চিতকরণ পাসওয়ার্ড দুটি মিলছে না।',
          'New password and confirmation password do not match.'
        )
      );
      return;
    }

    setBusy(true);
    try {
      await completePasswordReset(activeOobCode, newPassword);
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('mode');
      nextParams.delete('oobCode');
      nextParams.delete('apiKey');
      setSearchParams(nextParams, { replace: true });

      setActiveOobCode(null);
      setNewPassword('');
      setConfirmNewPassword('');
      setPassword('');
      setMode('login');
      setSuccessMsg(
        t(
          'আপনার পাসওয়ার্ড সফলভাবে রিসেট হয়েছে! এখন নতুন পাসওয়ার্ড দিয়ে লগইন করুন।',
          'Your password has been reset successfully! Please log in with your new password.'
        )
      );
    } catch (err) {
      setErrorMsg(mapFirebaseAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleCheckVerification = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setBusy(true);
    try {
      const verified = await refreshVerificationState();
      if (verified) {
        setSuccessMsg(
          t(
            'অভিনন্দন! আপনার ইমেইল ভেরিফিকেশন সফলভাবে সম্পন্ন হয়েছে।',
            'Your email has been verified successfully!'
          )
        );
        navigate(redirectTarget, { replace: true });
      } else {
        setErrorMsg(
          t(
            'এখনো ইমেইল ভেরিফাই সম্পন্ন হয়নি। আপনার ইমেইলে পাঠানো ভেরিফিকেশন লিংকে ক্লিক করার পর এই বাটনে আবার ক্লিক করুন।',
            'Your email is not verified yet. Please click the verification link in your email first, then tap this button again.'
          )
        );
      }
    } catch (err) {
      setErrorMsg(mapFirebaseAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleResendVerification = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setBusy(true);
    try {
      await resendVerification();
      setSuccessMsg(
        t(
          'নতুন ভেরিফিকেশন লিংক আপনার ইমেইলে পাঠানো হয়েছে। অনুগ্রহ করে ইনবক্স এবং Spam/Promotions ফোল্ডার চেক করুন।',
          'A new verification link has been sent to your email. Please check your Inbox and Spam/Promotions folder.'
        )
      );
    } catch (err) {
      setErrorMsg(mapFirebaseAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSwitchAccount = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    await logout();
  };

  // 1. In-App Password Reset Confirmation View (?mode=resetPassword&oobCode=...)
  if (mode === 'confirm-reset') {
    return (
      <div className="max-w-md mx-auto px-4 py-10 sm:py-14">
        <SEOHead
          title={`${t('নতুন পাসওয়ার্ড সেট করুন', 'Set New Password')} – ${siteSettings.brandName}`}
          description={t(
            'আপনার ভেরিফাইড ইমেইল লিংকের মাধ্যমে নিরাপদে নতুন পাসওয়ার্ড সেট করুন।',
            'Securely set a new password for your pharmacy account.'
          )}
          canonicalPath="/login"
        />

        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-5">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-[#edf6f1] text-[#146c43] mx-auto flex items-center justify-center">
              <KeyRound className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-extrabold text-slate-900">
              {t('নতুন পাসওয়ার্ড সেট করুন', 'Set New Password')}
            </h1>
            {resetCodeAccountEmail && (
              <p className="text-xs font-semibold text-[#0f5435] break-all">
                {resetCodeAccountEmail}
              </p>
            )}
          </div>

          {verifyingResetCode ? (
            <div className="py-6 text-center space-y-2 text-xs text-slate-600">
              <RefreshCw className="w-5 h-5 text-[#146c43] animate-spin mx-auto" />
              <p>{t('পাসওয়ার্ড রিসেট লিংক যাচাই করা হচ্ছে...', 'Verifying password reset link...')}</p>
            </div>
          ) : resetCodeInvalid ? (
            <div className="space-y-4">
              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  const nextParams = new URLSearchParams(searchParams);
                  nextParams.delete('mode');
                  nextParams.delete('oobCode');
                  setSearchParams(nextParams, { replace: true });
                  setActiveOobCode(null);
                  setResetCodeInvalid(false);
                  switchMode('reset');
                }}
                className="w-full py-3 rounded-xl bg-[#146c43] hover:bg-[#0f5435] text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer"
              >
                {t('নতুন পাসওয়ার্ড রিসেট লিংক পাঠান', 'Request a New Reset Link')}
              </button>
              <button
                type="button"
                onClick={() => {
                  const nextParams = new URLSearchParams(searchParams);
                  nextParams.delete('mode');
                  nextParams.delete('oobCode');
                  setSearchParams(nextParams, { replace: true });
                  setActiveOobCode(null);
                  switchMode('login');
                }}
                className="w-full text-center text-xs font-semibold text-[#146c43] hover:underline cursor-pointer"
              >
                {t('← লগইন পেইজে ফিরে যান', '← Back to Login')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleConfirmNewPasswordSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('নতুন পাসওয়ার্ড *', 'New Password *')}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t('কমপক্ষে ৬ অক্ষর', 'Minimum 6 characters')}
                    className="w-full pl-9 pr-10 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#146c43]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    aria-label={
                      showNewPassword
                        ? t('পাসওয়ার্ড লুকান', 'Hide password')
                        : t('পাসওয়ার্ড দেখুন', 'Show password')
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('নতুন পাসওয়ার্ড নিশ্চিত করুন *', 'Confirm New Password *')}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder={t('আবার নতুন পাসওয়ার্ড লিখুন', 'Re-enter new password')}
                    className="w-full pl-9 pr-10 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#146c43]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-3 rounded-xl bg-[#146c43] hover:bg-[#0f5435] text-white text-sm font-bold transition-colors disabled:opacity-60 cursor-pointer"
              >
                {busy
                  ? t('পাসওয়ার্ড সংরক্ষণ হচ্ছে...', 'Saving new password...')
                  : t('নতুন পাসওয়ার্ড সংরক্ষণ করুন', 'Save New Password')}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // 2. Dedicated Email Verification View when user is signed in with Email/Password but not yet verified
  if (user && !emailVerified) {
    return (
      <div className="max-w-md mx-auto px-4 py-10 sm:py-14">
        <SEOHead
          title={`${t('ইমেইল ভেরিফিকেশন', 'Email Verification')} – ${siteSettings.brandName}`}
          description={t(
            'আপনার ফার্মেসি কাস্টমার একাউন্টের ইমেইল ভেরিফিকেশন সম্পন্ন করুন।',
            'Verify your email address to activate your pharmacy customer account.'
          )}
          canonicalPath="/login"
        />

        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-5">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-[#edf6f1] text-[#146c43] mx-auto flex items-center justify-center">
              <MailCheck className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-extrabold text-slate-900">
              {t('ইমেইল ভেরিফাই করুন', 'Verify Your Email')}
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              {t(
                'আপনার একাউন্টের নিরাপত্তার জন্য নিচের ইমেইল ঠিকানায় একটি ভেরিফিকেশন লিংক পাঠানো হয়েছে:',
                'For account security, we sent a verification link to:'
              )}
            </p>
            <p className="text-sm font-bold text-[#0f5435] break-all">{user.email}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed">
            {t(
              '১. আপনার ইমেইলের Inbox (অথবা Spam/Junk ফোল্ডার) ওপেন করে ভেরিফিকেশন লিংকে ক্লিক করুন।\n২. লিংকে ক্লিক করার পর নিচের "ভেরিফিকেশন যাচাই করুন" বাটনে ক্লিক করুন।',
              '1. Open your email Inbox (or Spam/Junk folder) and click the verification link.\n2. Return here and click "I Have Verified My Email" below.'
            )
              .split('\n')
              .map((line, idx) => (
                <p key={idx} className={idx > 0 ? 'mt-1.5' : ''}>
                  {line}
                </p>
              ))}
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#146c43] shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="space-y-2.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleCheckVerification()}
              className="w-full py-3 px-4 rounded-xl bg-[#146c43] hover:bg-[#0f5435] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
              <span>
                {busy
                  ? t('যাচাই করা হচ্ছে...', 'Checking...')
                  : t('ভেরিফিকেশন সম্পন্ন করেছি (যাচাই করুন)', 'I Have Verified My Email')}
              </span>
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => void handleResendVerification()}
              className="w-full py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 text-[#146c43]" />
              <span>
                {t('পুনরায় ভেরিফিকেশন লিংক পাঠান', 'Resend Verification Email')}
              </span>
            </button>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
            <button
              type="button"
              onClick={() => navigate(redirectTarget)}
              className="font-semibold text-slate-600 hover:text-[#146c43] cursor-pointer"
            >
              {t('পরে ভেরিফাই করব →', 'Continue for now →')}
            </button>

            <button
              type="button"
              onClick={() => void handleSwitchAccount()}
              className="inline-flex items-center gap-1 font-semibold text-red-600 hover:underline cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t('অন্য ইমেইল ব্যবহার করুন', 'Use another email')}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Dedicated Forgot Password / Email Account Recovery View
  if (mode === 'reset') {
    return (
      <div className="max-w-md mx-auto px-4 py-10 sm:py-14">
        <SEOHead
          title={`${t('পাসওয়ার্ড পুনরুদ্ধার', 'Forgot Password')} – ${siteSettings.brandName}`}
          description={t(
            'ইমেইল ভেরিফিকেশনের মাধ্যমে নিরাপদে আপনার ফার্মেসি কাস্টমার একাউন্টের পাসওয়ার্ড পুনরুদ্ধার করুন।',
            'Securely recover your pharmacy customer account password via email verification.'
          )}
          canonicalPath="/forgot-password"
        />

        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-5">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-[#edf6f1] text-[#146c43] mx-auto flex items-center justify-center">
              <KeyRound className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-extrabold text-slate-900">
              {t('পাসওয়ার্ড ভুলে গেছেন?', 'Forgot Your Password?')}
            </h1>
            <p className="text-xs text-slate-500 leading-relaxed">
              {t(
                'আপনার একাউন্টের রেজিস্টার্ড ইমেইল ঠিকানা দিন। ইমেইল যাচাইয়ের মাধ্যমে নিরাপদে নতুন পাসওয়ার্ড সেট করার লিংক পাঠানো হবে।',
                'Enter your registered email address and we will send a secure verification link to reset your password.'
              )}
            </p>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {resetEmailSentTo ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-2">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#146c43] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">
                      {t('পাসওয়ার্ড রিসেট ইমেইল পাঠানো হয়েছে!', 'Password Reset Email Sent!')}
                    </p>
                    <p className="text-emerald-900 break-all">
                      {t('প্রাপক ইমেইল:', 'Sent to:')} <strong>{resetEmailSentTo}</strong>
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1.5 leading-relaxed">
                <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#146c43] shrink-0" />
                  <span>{t('পরবর্তী ধাপসমূহ:', 'Next Steps to Recover Your Account:')}</span>
                </p>
                <p>
                  {t(
                    '১. আপনার ইমেইলের Inbox (এবং না পেলে Spam/Junk ফোল্ডার) চেক করুন।',
                    '1. Check your email Inbox (and Spam/Junk folder if not visible).'
                  )}
                </p>
                <p>
                  {t(
                    '২. ইমেইলে থাকা নিরাপদ পাসওয়ার্ড রিসেট লিংকে ক্লিক করে নতুন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর) নির্ধারণ করুন।',
                    '2. Click the secure password reset link in the email and set a new password (min. 6 characters).'
                  )}
                </p>
                <p>
                  {t(
                    '৩. এরপর লগইন পেইজে ফিরে এসে নতুন পাসওয়ার্ড দিয়ে সাইন ইন করুন।',
                    '3. Return to the login page and sign in with your new password.'
                  )}
                </p>
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="w-full py-3 rounded-xl bg-[#146c43] hover:bg-[#0f5435] text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer"
                >
                  {t('নতুন পাসওয়ার্ড দিয়ে লগইন করুন', 'Proceed to Login')}
                </button>

                <button
                  type="button"
                  disabled={busy || resetCooldown > 0}
                  onClick={() => void triggerPasswordResetEmail(resetEmailSentTo)}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 text-[#146c43]" />
                  <span>
                    {resetCooldown > 0
                      ? t(
                          `পুনরায় রিসেট লিংক পাঠান (${resetCooldown} সেকেন্ড)`,
                          `Resend Reset Link (${resetCooldown}s)`
                        )
                      : t('পুনরায় রিসেট লিংক পাঠান', 'Resend Password Reset Email')}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setResetEmailSentTo(null);
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="w-full text-center text-xs font-semibold text-slate-600 hover:text-[#146c43] cursor-pointer pt-1"
                >
                  {t('ইমেইল ঠিকানা পরিবর্তন করুন', 'Use a different email address')}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('রেজিস্টার্ড ইমেইল ঠিকানা *', 'Registered Email Address *')}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#146c43]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-3 rounded-xl bg-[#146c43] hover:bg-[#0f5435] text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>
                  {busy
                    ? t('রিসেট লিংক পাঠানো হচ্ছে...', 'Sending reset link...')
                    : t('পাসওয়ার্ড রিসেট লিংক পাঠান', 'Send Password Reset Link')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => switchMode('login')}
                className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-[#146c43] hover:underline cursor-pointer pt-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{t('লগইন পেইজে ফিরে যান', 'Back to Login')}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // 4. Standard Email & Password Login / Registration View
  return (
    <div className="max-w-md mx-auto px-4 py-10 sm:py-14">
      <SEOHead
        title={`${t('লগইন ও রেজিস্ট্রেশন', 'Login & Registration')} – ${siteSettings.brandName}`}
        description={t(
          'ইমেইল ও পাসওয়ার্ড দিয়ে আপনার ফার্মেসি কাস্টমার একাউন্টে লগইন বা নতুন রেজিস্ট্রেশন ও ভেরিফাই করুন।',
          'Sign in or register with your email and password and verify your account.'
        )}
        canonicalPath="/login"
      />

      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-5">
        <div className="text-center space-y-2">
          <div className="inline-flex justify-center">
            <BrandLogoMark className="w-12 h-12" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">
            {mode === 'login'
              ? t('কাস্টমার লগইন', 'Customer Login')
              : t('নতুন একাউন্ট তৈরি করুন', 'Create New Account')}
          </h1>
          <p className="text-xs text-slate-500">{siteSettings.brandName}</p>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              mode === 'login' ? 'bg-white text-[#0f5435] shadow-xs' : 'text-slate-600'
            }`}
          >
            {t('লগইন', 'Login')}
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            className={`py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              mode === 'register' ? 'bg-white text-[#0f5435] shadow-xs' : 'text-slate-600'
            }`}
          >
            {t('রেজিস্ট্রেশন', 'Register')}
          </button>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#146c43] shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('পূর্ণ নাম *', 'Full Name *')}
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('আপনার নাম', 'Your full name')}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#146c43]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('ইমেইল ঠিকানা *', 'Email Address *')}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#146c43]"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">
                {t('পাসওয়ার্ড *', 'Password *')}
              </label>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => switchMode('reset')}
                  className="text-[11px] font-semibold text-[#146c43] hover:underline cursor-pointer"
                >
                  {t('পাসওয়ার্ড ভুলে গেছেন?', 'Forgot password?')}
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-10 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#146c43]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={
                  showPassword
                    ? t('পাসওয়ার্ড লুকান', 'Hide password')
                    : t('পাসওয়ার্ড দেখুন', 'Show password')
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {mode === 'register' && (
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {t(
                'রেজিস্ট্রেশন করার পর আপনার ইমেইলে একটি ভেরিফিকেশন লিংক পাঠানো হবে।',
                'A verification link will be sent to your email address upon registration.'
              )}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 rounded-xl bg-[#146c43] hover:bg-[#0f5435] text-white text-sm font-bold transition-colors disabled:opacity-60 cursor-pointer"
          >
            {busy
              ? t('অপেক্ষা করুন...', 'Please wait...')
              : mode === 'login'
              ? t('লগইন করুন', 'Login')
              : t('একাউন্ট খুলুন ও ভেরিফাই করুন', 'Create Account & Verify Email')}
          </button>

          {mode === 'login' && (
            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={() => switchMode('reset')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#146c43] transition-colors cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>
                  {t(
                    'একাউন্টে প্রবেশ করতে পারছেন না? ইমেইলের মাধ্যমে পাসওয়ার্ড রিসেট করুন',
                    'Trouble signing in? Recover account via email'
                  )}
                </span>
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

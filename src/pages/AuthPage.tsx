import { AlertCircle, CheckCircle2, Lock, Mail, User as UserIcon } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BrandLogoMark } from '../components/PharmacyIcons';
import { SEOHead } from '../components/SEOHead';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useStore } from '../contexts/StoreContext';
import {
  auth,
  consumeLastRedirectError,
  warmUpGooglePopupResolver,
} from '../lib/firebase';

export function AuthPage() {
  const {
    user,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    sendPasswordReset,
  } = useAuth();
  const { siteSettings } = useStore();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTarget = searchParams.get('redirect') || '/account';

  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    void warmUpGooglePopupResolver();
    const redirectErr = consumeLastRedirectError();
    if (redirectErr) {
      setErrorMsg(mapFirebaseAuthError(redirectErr));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user) {
      navigate(redirectTarget, { replace: true });
    }
  }, [user, navigate, redirectTarget]);

  const mapFirebaseAuthError = (err: unknown): string => {
    const raw = err instanceof Error ? err.message : String(err);
    if (raw.includes('auth/operation-not-allowed')) {
      return t(
        'বর্তমানে এই মাধ্যমে সাইন-ইন সাময়িকভাবে বন্ধ রয়েছে। Firebase Console > Authentication > Sign-in method থেকে Google এবং Email/Password চালু করুন।',
        'This sign-in method is currently disabled. Please enable Google and Email/Password in Firebase Console > Authentication > Sign-in method.'
      );
    }
    if (raw.includes('auth/invalid-credential') || raw.includes('auth/wrong-password')) {
      return t('ইমেইল অথবা পাসওয়ার্ড সঠিক নয়।', 'Invalid email or password.');
    }
    if (raw.includes('auth/email-already-in-use')) {
      return t(
        'এই ইমেইল দিয়ে ইতিমধ্যে একটি একাউন্ট খোলা হয়েছে। অনুগ্রহ করে লগইন করুন।',
        'An account already exists with this email. Please log in.'
      );
    }
    if (raw.includes('auth/account-exists-with-different-credential')) {
      return t(
        'এই ইমেইল দিয়ে ইতিমধ্যে পাসওয়ার্ডসহ একাউন্ট রয়েছে। অনুগ্রহ করে ইমেইল ও পাসওয়ার্ড দিয়ে লগইন করুন।',
        'An account already exists with this email using a different sign-in method. Please log in with Email & Password.'
      );
    }
    if (raw.includes('auth/weak-password')) {
      return t('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।', 'Password must be at least 6 characters.');
    }
    if (raw.includes('auth/unauthorized-domain')) {
      const host = typeof window !== 'undefined' ? window.location.hostname : '';
      return t(
        `গুগল সাইন-ইনের জন্য বর্তমান ডোমেইনটি (${host}) Firebase Console > Authentication > Settings > Authorized domains এ যুক্ত করুন (নোট: Vercel-এর মূল ডোমেইন ও প্রিভিউ ডোমেইন আলাদা হতে পারে)।`,
        `Please add this exact domain (${host}) to Firebase Console > Authentication > Settings > Authorized domains for Google Sign-In (Note: Vercel preview and production domains differ).`
      );
    }
    if (raw.includes('auth/popup-blocked')) {
      return t(
        'ব্রাউজার পপআপ ব্লক করেছে। Google সাইন-ইন চ্যানেল এখন প্রস্তুত — অনুগ্রহ করে আরেকবার বাটনে ক্লিক করুন অথবা ব্রাউজারের অ্যাড্রেস বার থেকে পপআপ (Pop-ups) অনুমতি দিন।',
        'Browser blocked the popup. The Google sign-in channel is now ready — please click Continue with Google once more or allow popups in your browser address bar.'
      );
    }
    if (raw.includes('auth/web-storage-unsupported')) {
      return t(
        'ব্রাউজারে থার্ড-পার্টি স্টোরেজ/কুকি ব্লক থাকায় Google পপআপ সম্পন্ন হয়নি। অনুগ্রহ করে সাধারণ ব্রাউজার উইন্ডো ব্যবহার করুন অথবা কুকি অনুমতি দিন।',
        'Third-party cookies/storage are blocked in this browser mode. Please allow cookies for Google Sign-In or use a standard browser window.'
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
    if (raw.includes('auth/popup-closed-by-user')) {
      return t(
        'সাইন-ইন পপআপটি বন্ধ করা হয়েছে। আবার চেষ্টা করুন।',
        'Sign-in popup was closed. Please try again.'
      );
    }
    return t(
      'লগইন সম্পন্ন করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
      'Could not complete sign-in. Please try again.'
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setBusy(true);

    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
        navigate(redirectTarget);
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
        await registerWithEmail(name, email, password);
        setSuccessMsg(
          t(
            'আপনার একাউন্ট সফলভাবে তৈরি ও সক্রিয় হয়েছে!',
            'Your account has been created and activated!'
          )
        );
        navigate(redirectTarget);
      } else {
        await sendPasswordReset(email);
        setSuccessMsg(
          t(
            'পাসওয়ার্ড রিসেট লিংক আপনার ইমেইলে পাঠানো হয়েছে।',
            'Password reset link has been sent to your email.'
          )
        );
      }
    } catch (err) {
      setErrorMsg(mapFirebaseAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setBusy(true);
    try {
      const signedInUser = await loginWithGoogle();
      if (signedInUser || auth.currentUser) {
        navigate(redirectTarget, { replace: true });
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      if (!raw.includes('auth/cancelled-popup-request')) {
        setErrorMsg(mapFirebaseAuthError(err));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-10 sm:py-14">
      <SEOHead
        title={`${t('লগইন ও রেজিস্ট্রেশন', 'Login & Registration')} – ${siteSettings.brandName}`}
        description={t(
          'আপনার ফার্মেসি কাস্টমার একাউন্টে লগইন বা নতুন রেজিস্ট্রেশন করুন।',
          'Sign in or create a new customer account with instant activation.'
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
              : mode === 'register'
              ? t('নতুন একাউন্ট তৈরি করুন', 'Create New Account')
              : t('পাসওয়ার্ড রিসেট', 'Reset Password')}
          </h1>
          <p className="text-xs text-slate-500">{siteSettings.brandName}</p>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              mode === 'login' ? 'bg-white text-[#0f5435] shadow-xs' : 'text-slate-600'
            }`}
          >
            {t('লগইন', 'Login')}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              mode === 'register' ? 'bg-white text-[#0f5435] shadow-xs' : 'text-slate-600'
            }`}
          >
            {t('রেজিস্ট্রেশন', 'Register')}
          </button>
        </div>

        {/* Google Sign-In (Instant Account Activation + Smart Redirect Fallback) */}
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleGoogleSignIn()}
          className="w-full py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-bold flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
            <path
              fill="#EA4335"
              d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12s4.3 9.5 9.5 9.5c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.6H12z"
            />
          </svg>
          <span>{t('Google একাউন্ট দিয়ে দ্রুত প্রবেশ করুন', 'Continue with Google')}</span>
        </button>

        <div className="relative flex items-center py-1">
          <div className="flex-grow border-t border-slate-200" />
          <span className="px-3 text-[11px] text-slate-400">
            {t('অথবা ইমেইল ব্যবহার করুন', 'or continue with email')}
          </span>
          <div className="flex-grow border-t border-slate-200" />
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

          {mode !== 'reset' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  {t('পাসওয়ার্ড *', 'Password *')}
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => setMode('reset')}
                    className="text-[11px] font-semibold text-[#146c43] hover:underline cursor-pointer"
                  >
                    {t('পাসওয়ার্ড ভুলে গেছেন?', 'Forgot password?')}
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#146c43]"
                />
              </div>
            </div>
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
              : mode === 'register'
              ? t('একাউন্ট খুলুন', 'Create Account')
              : t('রিসেট লিংক পাঠান', 'Send Reset Link')}
          </button>

          {mode === 'reset' && (
            <button
              type="button"
              onClick={() => setMode('login')}
              className="w-full text-center text-xs font-semibold text-[#146c43] hover:underline cursor-pointer pt-1"
            >
              {t('← লগইন পেইজে ফিরে যান', '← Back to Login')}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

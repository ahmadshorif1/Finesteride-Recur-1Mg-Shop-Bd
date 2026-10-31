import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  CheckCircle2,
  FileCheck2,
  Lock,
  MapPin,
  ShieldAlert,
  Tag,
  Wallet,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BkashBadge, NagadBadge } from '../components/PharmacyIcons';
import { PrescriptionModal } from '../components/PrescriptionModal';
import { SEOHead } from '../components/SEOHead';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useStore } from '../contexts/StoreContext';
import { db } from '../lib/firebase';
import {
  formatTaka,
  generateSafeDocId,
  isValidBangladeshPhone,
} from '../lib/validation';
import {
  placeVerifiedPharmacyOrder,
  saveDeliveryAddress,
  verifyCouponCode,
} from '../services/pharmacyService';
import type {
  Coupon,
  DeliveryAddress,
  PaymentMethod,
  PrescriptionReview,
} from '../types/pharmacy';

export function CheckoutPage() {
  const { user, userPublic, userPrivate } = useAuth();
  const {
    items,
    subtotal,
    hasRxProducts,
    rxProductIds,
    selectedZone,
    setSelectedZone,
    clearCart,
  } = useCart();
  const { siteSettings, hasCustomSiteSettings } = useStore();
  const { lang, t } = useLanguage();
  const navigate = useNavigate();

  // Stable idempotency seed per checkout session to prevent duplicate orders on network retry
  const [checkoutSeed] = useState(() => generateSafeDocId('chk'));

  const [savedAddresses, setSavedAddresses] = useState<DeliveryAddress[]>([]);
  const [userPrescriptions, setUserPrescriptions] = useState<PrescriptionReview[]>([]);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [district, setDistrict] = useState('Dhaka');
  const [area, setArea] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [saveAddressForLater, setSaveAddressForLater] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [paymentSenderRef, setPaymentSenderRef] = useState('');
  const [gatewayStatus, setGatewayStatus] = useState<{
    bkashGatewayConfigured: boolean;
    nagadGatewayConfigured: boolean;
  }>({ bkashGatewayConfigured: false, nagadGatewayConfigured: false });

  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponFeedback, setCouponFeedback] = useState<string | null>(null);

  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState('');
  const [rxModalOpen, setRxModalOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (userPublic?.displayName && !customerName) {
      setCustomerName(userPublic.displayName);
    }
    if (userPrivate?.phone && !customerPhone) {
      setCustomerPhone(userPrivate.phone);
    }
  }, [userPublic, userPrivate, customerName, customerPhone]);

  useEffect(() => {
    fetch('/api/payment-status')
      .then((r) => r.json())
      .then((data) => setGatewayStatus(data))
      .catch(() => {});
  }, []);

  // Load saved addresses & prescription submissions for signed-in user
  useEffect(() => {
    if (!user) return;

    const unsubAddr = onSnapshot(
      collection(db, 'users', user.uid, 'addresses'),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<DeliveryAddress, 'id'>),
        }));
        setSavedAddresses(list);
        const def = list.find((a) => a.isDefault) || list[0];
        if (def && !deliveryAddress) {
          setCustomerName(def.recipientName);
          setCustomerPhone(def.phone);
          setSelectedZone(def.zone);
          setDistrict(def.district);
          setArea(def.area);
          setDeliveryAddress(def.streetAddress);
        }
      },
      () => {}
    );

    const rxQ = query(
      collection(db, 'prescriptionReviews'),
      where('userId', '==', user.uid)
    );
    const unsubRx = onSnapshot(
      rxQ,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<PrescriptionReview, 'id'>) }))
          .filter((r) => r.status !== 'rejected');
        setUserPrescriptions(list);
        if (list.length > 0 && !selectedPrescriptionId) {
          setSelectedPrescriptionId(list[0].id);
        }
      },
      () => {}
    );

    return () => {
      unsubAddr();
      unsubRx();
    };
  }, [user, deliveryAddress, selectedPrescriptionId, setSelectedZone]);

  const discountAmount = useMemo(() => {
    if (!appliedCoupon) return 0;
    if (subtotal < appliedCoupon.minOrderAmount) return 0;
    if (appliedCoupon.discountType === 'percentage') {
      const raw = Math.round((subtotal * appliedCoupon.discountValue) / 100);
      return appliedCoupon.maxDiscountAmount > 0
        ? Math.min(raw, appliedCoupon.maxDiscountAmount)
        : raw;
    }
    return Math.min(appliedCoupon.discountValue, subtotal);
  }, [appliedCoupon, subtotal]);

  const netSubtotal = Math.max(0, subtotal - discountAmount);
  const deliveryFee = useMemo(() => {
    if (items.length === 0) return 0;
    if (
      siteSettings.freeDeliveryThreshold > 0 &&
      netSubtotal >= siteSettings.freeDeliveryThreshold
    ) {
      return 0;
    }
    return selectedZone === 'inside_dhaka'
      ? siteSettings.insideDhakaFee
      : siteSettings.outsideDhakaFee;
  }, [items.length, netSubtotal, selectedZone, siteSettings]);

  const estimatedFinalTotal = netSubtotal + deliveryFee;

  const handleApplyCoupon = async () => {
    setCouponFeedback(null);
    if (!couponInput.trim()) return;
    const found = await verifyCouponCode(couponInput.trim());
    if (!found) {
      setAppliedCoupon(null);
      setCouponFeedback(
        t('কুপন কোডটি বৈধ নয় বা মেয়াদ শেষ হয়েছে।', 'Coupon code is invalid or expired.')
      );
      return;
    }
    if (subtotal < found.minOrderAmount) {
      setAppliedCoupon(null);
      setCouponFeedback(
        t(
          `এই কুপন ব্যবহারের জন্য ন্যূনতম ${formatTaka(found.minOrderAmount)} অর্ডার প্রয়োজন।`,
          `Minimum order of ${formatTaka(found.minOrderAmount)} is required for this coupon.`
        )
      );
      return;
    }
    setAppliedCoupon(found);
    setCouponFeedback(
      t(`"${found.code}" কুপন যুক্ত হয়েছে!`, `Coupon "${found.code}" applied!`)
    );
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!user) {
      navigate('/login?redirect=/checkout');
      return;
    }
    if (!isValidBangladeshPhone(customerPhone)) {
      setErrorMsg(
        t(
          'সঠিক বাংলাদেশী ১১ সংখ্যার মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)।',
          'Please enter a valid 11-digit Bangladesh mobile number (e.g., 017XXXXXXXX).'
        )
      );
      return;
    }
    if (district.trim().length < 2 || area.trim().length < 2 || deliveryAddress.trim().length < 4) {
      setErrorMsg(
        t(
          'জেলা, এলাকা এবং সম্পূর্ণ ডেলিভারি ঠিকানা সঠিকভাবে পূরণ করুন।',
          'Please fill in district, area, and complete street delivery address.'
        )
      );
      return;
    }
    if (hasRxProducts && !selectedPrescriptionId) {
      setErrorMsg(
        t(
          'কার্টে থাকা Rx ঔষধের জন্য বৈধ প্রেসক্রিপশন নির্বাচন বা আপলোড করুন।',
          'Please select or upload a valid prescription for Rx items in your cart.'
        )
      );
      return;
    }
    if ((paymentMethod === 'bkash' || paymentMethod === 'nagad') && paymentSenderRef.trim().length < 4) {
      setErrorMsg(
        t(
          `${paymentMethod === 'bkash' ? 'bKash' : 'Nagad'} পেমেন্ট যাচাইয়ের জন্য আপনার সেন্ডার নম্বর বা TrxID লিখুন। (কখনোই PIN লিখবেন না)`,
          `Please enter your ${paymentMethod === 'bkash' ? 'bKash' : 'Nagad'} sender number or TrxID for verification. (Never enter your PIN)`
        )
      );
      return;
    }

    setSubmitting(true);
    try {
      if (saveAddressForLater) {
        await saveDeliveryAddress(user.uid, {
          label: t('ডিফল্ট ঠিকানা', 'Default Address'),
          recipientName: customerName,
          phone: customerPhone,
          zone: selectedZone,
          district,
          area,
          streetAddress: deliveryAddress,
          isDefault: savedAddresses.length === 0,
        });
      }

      const result = await placeVerifiedPharmacyOrder({
        uid: user.uid,
        customerName,
        customerPhone,
        deliveryZone: selectedZone,
        district,
        area,
        deliveryAddress,
        deliveryInstructions,
        orderNotes,
        paymentMethod,
        paymentSenderRef,
        couponCode: appliedCoupon ? appliedCoupon.code : '',
        prescriptionId: hasRxProducts ? selectedPrescriptionId : '',
        checkoutAttemptSeed: checkoutSeed,
        language: lang,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      });

      await clearCart();
      navigate(`/track-order/${result.orderId}?confirmed=1`);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : t('অর্ডার সম্পন্ন করতে সমস্যা হয়েছে।', 'Could not complete your order. Please try again.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-slate-900 mb-2">
          {t('আপনার কার্ট খালি', 'Your Cart is Empty')}
        </h1>
        <p className="text-xs text-slate-500 mb-5">
          {t('চেকআউট করতে প্রথমে পণ্য কার্টে যোগ করুন।', 'Add products to your cart before proceeding to checkout.')}
        </p>
        <Link
          to="/products"
          className="px-5 py-2.5 bg-[#146c43] text-white text-xs font-bold rounded-lg"
        >
          {t('পণ্য দেখুন', 'Browse Products')}
        </Link>
      </div>
    );
  }

  const resolvedBkashInstructions =
    lang === 'en' && !hasCustomSiteSettings
      ? 'Upon confirmation, our team will share the official bKash Merchant payment details or verify your submitted TrxID. Never share your PIN or OTP.'
      : siteSettings.bkashInstructions;

  const resolvedNagadInstructions =
    lang === 'en' && !hasCustomSiteSettings
      ? 'Upon confirmation, our team will share the official Nagad Merchant payment details or verify your submitted TrxID. Never share your PIN or OTP.'
      : siteSettings.nagadInstructions;

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-8">
      <SEOHead
        title={`${t('চেকআউট', 'Checkout')} – ${siteSettings.brandName}`}
        description={t(
          'ডেলিভারি ঠিকানা ও নিরাপদ পেমেন্ট মাধ্যম নির্বাচন করে অর্ডার নিশ্চিত করুন।',
          'Confirm your pharmacy order with secure delivery address and verified payment methods.'
        )}
        canonicalPath="/checkout"
      />

      <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-6">
        {t('নিরাপদ চেকআউট (Secure Checkout)', 'Secure Checkout')}
      </h1>

      {/* Authentication Gate */}
      {!user ? (
        <div className="mb-6 p-5 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="text-xs text-amber-900">
            <p className="font-bold text-sm">
              {t('অর্ডার নিশ্চিত করতে লগইন প্রয়োজন', 'Sign In Required to Confirm Order')}
            </p>
            <p className="mt-0.5">
              {t(
                'নিরাপদ অর্ডার ট্র্যাকিং ও ডাটা সুরক্ষার জন্য আপনার কাস্টমার একাউন্টে সাইন ইন করুন। আপনার কার্টের সকল পণ্য সংরক্ষিত থাকবে।',
                'Sign in to your customer account for secure order tracking and data protection. All items in your cart will be preserved.'
              )}
            </p>
          </div>
          <Link
            to="/login?redirect=/checkout"
            className="px-5 py-2.5 bg-[#146c43] text-white text-xs font-bold rounded-lg whitespace-nowrap"
          >
            {t('লগইন / রেজিস্ট্রেশন করুন', 'Login / Register')}
          </Link>
        </div>
      ) : null}

      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Checkout Sections */}
        <div className="lg:col-span-7 space-y-6">
          {errorMsg && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
              {errorMsg}
            </div>
          )}

          {/* Section 1: Delivery Information */}
          <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#146c43]" />
              <h2 className="text-base font-bold text-slate-900">
                {t('১. ডেলিভারি ঠিকানা ও তথ্য', '1. Delivery Address & Information')}
              </h2>
            </div>

            {savedAddresses.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-2">
                  {t('সংরক্ষিত ঠিকানা থেকে বেছে নিন:', 'Choose from saved addresses:')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {savedAddresses.map((addr) => (
                    <button
                      key={addr.id}
                      type="button"
                      onClick={() => {
                        setCustomerName(addr.recipientName);
                        setCustomerPhone(addr.phone);
                        setSelectedZone(addr.zone);
                        setDistrict(addr.district);
                        setArea(addr.area);
                        setDeliveryAddress(addr.streetAddress);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 hover:border-[#146c43] bg-slate-50 text-xs font-medium text-slate-800 cursor-pointer"
                    >
                      {addr.label}: {addr.area}, {addr.district}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('গ্রাহকের নাম *', 'Recipient Full Name *')}
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={t('পূর্ণ নাম লিখুন', 'Enter full name')}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#146c43]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('মোবাইল নম্বর *', 'Mobile Number *')}
                </label>
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="017XXXXXXXX"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#146c43]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t('ডেলিভারি জোন *', 'Delivery Zone *')}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedZone('inside_dhaka');
                    setDistrict('Dhaka');
                  }}
                  className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                    selectedZone === 'inside_dhaka'
                      ? 'border-[#146c43] bg-[#edf6f1]'
                      : 'border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <p className="text-xs font-bold text-slate-900">
                    {t('ঢাকা সিটির ভেতরে', 'Inside Dhaka City')}
                  </p>
                  <p className="text-[11px] text-slate-600 mt-0.5 tabular-nums">
                    {t(
                      `চার্জ: ${formatTaka(siteSettings.insideDhakaFee)} (১–২ কার্যদিবস)`,
                      `Fee: ${formatTaka(siteSettings.insideDhakaFee)} (1–2 working days)`
                    )}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedZone('outside_dhaka')}
                  className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                    selectedZone === 'outside_dhaka'
                      ? 'border-[#146c43] bg-[#edf6f1]'
                      : 'border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <p className="text-xs font-bold text-slate-900">
                    {t('ঢাকার বাইরে (সারা বাংলাদেশ)', 'Outside Dhaka (Nationwide)')}
                  </p>
                  <p className="text-[11px] text-slate-600 mt-0.5 tabular-nums">
                    {t(
                      `চার্জ: ${formatTaka(siteSettings.outsideDhakaFee)} (৩–৫ কার্যদিবস)`,
                      `Fee: ${formatTaka(siteSettings.outsideDhakaFee)} (3–5 working days)`
                    )}
                  </p>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('জেলা *', 'District *')}
                </label>
                <input
                  type="text"
                  required
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder={t('যেমন: Dhaka, Chattogram...', 'e.g., Dhaka, Chattogram...')}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#146c43]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('থানা / এলাকা *', 'Thana / Area *')}
                </label>
                <input
                  type="text"
                  required
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder={t('যেমন: ধানমন্ডি, উত্তরা, মিরপুর...', 'e.g., Dhanmondi, Uttara, Mirpur...')}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#146c43]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('বিস্তারিত বাসা/রোড ঠিকানা *', 'Detailed Street / House Address *')}
              </label>
              <textarea
                rows={2}
                required
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder={t('বাসা নম্বর, রোড নম্বর, ব্লক/সেক্টর...', 'House no., road no., block/sector...')}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#146c43]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('ডেলিভারি নির্দেশনা (ঐচ্ছিক)', 'Delivery Instructions (Optional)')}
                </label>
                <input
                  type="text"
                  value={deliveryInstructions}
                  onChange={(e) => setDeliveryInstructions(e.target.value)}
                  placeholder={t('যেমন: আসার আগে কল দিন', 'e.g., Call before arriving')}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#146c43]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('অর্ডার নোট (ঐচ্ছিক)', 'Order Notes (Optional)')}
                </label>
                <input
                  type="text"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder={t('অতিরিক্ত কোনো নোট...', 'Any additional notes...')}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#146c43]"
                />
              </div>
            </div>

            {user && (
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveAddressForLater}
                  onChange={(e) => setSaveAddressForLater(e.target.checked)}
                  className="rounded accent-[#146c43]"
                />
                <span>
                  {t(
                    'ভবিষ্যৎ অর্ডারের জন্য এই ঠিকানাটি প্রোফাইলে সংরক্ষণ করুন',
                    'Save this address to my profile for future orders'
                  )}
                </span>
              </label>
            )}
          </section>

          {/* Section 2: Mandatory Prescription Verification (When Rx Medicine is in Cart) */}
          {hasRxProducts && (
            <section className="bg-amber-50/70 border border-amber-200 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FileCheck2 className="w-5 h-5 text-amber-700" />
                  <h2 className="text-base font-bold text-slate-900">
                    {t('২. প্রেসক্রিপশন সংযুক্তকরণ (Rx বাধ্যতামূলক)', '2. Attach Prescription (Rx Required)')}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setRxModalOpen(true)}
                  className="px-3.5 py-2 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold cursor-pointer"
                >
                  {t('+ নতুন প্রেসক্রিপশন জমা দিন', '+ Upload New Prescription')}
                </button>
              </div>

              <p className="text-xs text-amber-900 leading-relaxed">
                {t(
                  'আপনার কার্টে প্রেসক্রিপশন বাধ্যতামূলক ঔষধ রয়েছে। নিচে আপনার জমাকৃত বৈধ প্রেসক্রিপশন নির্বাচন করুন। ফার্মাসিস্ট প্রেসক্রিপশন যাচাই করার পর অর্ডার কনফার্ম হবে।',
                  'Your cart contains prescription-required (Rx) medicines. Select a valid submitted prescription below. A licensed pharmacist will review it before dispatch.'
                )}
              </p>

              {userPrescriptions.length === 0 ? (
                <p className="text-xs font-semibold text-red-700">
                  {t(
                    'এখনো কোনো প্রেসক্রিপশন জমা দেওয়া হয়নি। উপরের “+ নতুন প্রেসক্রিপশন জমা দিন” বাটনে ক্লিক করুন।',
                    'No prescription uploaded yet. Click “+ Upload New Prescription” above to submit one.'
                  )}
                </p>
              ) : (
                <div className="space-y-2">
                  {userPrescriptions.map((rx) => (
                    <label
                      key={rx.id}
                      className={`flex items-center justify-between p-3 rounded-xl border bg-white cursor-pointer ${
                        selectedPrescriptionId === rx.id
                          ? 'border-[#146c43] ring-1 ring-[#146c43]'
                          : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 text-xs">
                        <input
                          type="radio"
                          name="selectedRx"
                          checked={selectedPrescriptionId === rx.id}
                          onChange={() => setSelectedPrescriptionId(rx.id)}
                          className="accent-[#146c43]"
                        />
                        <div>
                          <p className="font-bold text-slate-900">
                            {t('ডা.', 'Dr.')} {rx.doctorName} ({rx.clinicOrHospital})
                          </p>
                          <p className="text-slate-500">
                            {t('তারিখ:', 'Date:')} {rx.prescriptionDate} · {t('অবস্থা:', 'Status:')}{' '}
                            {rx.status}
                          </p>
                        </div>
                      </div>
                      <CheckCircle2 className="w-4 h-4 text-[#146c43]" />
                    </label>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Section 3: Bangladesh Payment Methods */}
          <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-[#146c43]" />
              <h2 className="text-base font-bold text-slate-900">
                {hasRxProducts
                  ? t('৩. পেমেন্ট মাধ্যম নির্বাচন করুন', '3. Select Payment Method')
                  : t('২. পেমেন্ট মাধ্যম নির্বাচন করুন', '2. Select Payment Method')}
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {siteSettings.codEnabled && (
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cod')}
                  className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                    paymentMethod === 'cod'
                      ? 'border-[#146c43] bg-[#edf6f1]'
                      : 'border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <p className="text-xs font-bold text-slate-900">
                    {t('ক্যাশ অন ডেলিভারি', 'Cash on Delivery')}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {t('পণ্য হাতে পেয়ে মূল্য পরিশোধ', 'Pay upon receiving your order')}
                  </p>
                </button>
              )}

              {siteSettings.bkashEnabled && (
                <button
                  type="button"
                  onClick={() => setPaymentMethod('bkash')}
                  className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                    paymentMethod === 'bkash'
                      ? 'border-[#e2136e] bg-pink-50/40'
                      : 'border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <BkashBadge />
                  <p className="text-[11px] text-slate-500 mt-1">
                    {gatewayStatus.bkashGatewayConfigured
                      ? t('মার্চেন্ট গেটওয়ে ভেরিফাইড', 'Merchant Gateway Verified')
                      : t('অ্যাডমিন TrxID ভেরিফিকেশন', 'Admin TrxID Verification')}
                  </p>
                </button>
              )}

              {siteSettings.nagadEnabled && (
                <button
                  type="button"
                  onClick={() => setPaymentMethod('nagad')}
                  className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                    paymentMethod === 'nagad'
                      ? 'border-[#f7941d] bg-orange-50/40'
                      : 'border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <NagadBadge />
                  <p className="text-[11px] text-slate-500 mt-1">
                    {gatewayStatus.nagadGatewayConfigured
                      ? t('মার্চেন্ট গেটওয়ে ভেরিফাইড', 'Merchant Gateway Verified')
                      : t('অ্যাডমিন TrxID ভেরিফিকেশন', 'Admin TrxID Verification')}
                  </p>
                </button>
              )}
            </div>

            {(paymentMethod === 'bkash' || paymentMethod === 'nagad') && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                <p className="text-slate-700 leading-relaxed">
                  {paymentMethod === 'bkash'
                    ? resolvedBkashInstructions
                    : resolvedNagadInstructions}
                </p>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    {t(
                      'আপনার সেন্ডার নম্বর বা ট্রানজেকশন আইডি (TrxID) *',
                      'Your Sender Mobile Number or Transaction ID (TrxID) *'
                    )}
                  </label>
                  <input
                    type="text"
                    required
                    value={paymentSenderRef}
                    onChange={(e) => setPaymentSenderRef(e.target.value)}
                    placeholder={t('যেমন: 9K7A2M8P অথবা 017XXXXXXXX', 'e.g., 9K7A2M8P or 017XXXXXXXX')}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-[#146c43]"
                  />
                </div>

                <div className="flex items-start gap-2 text-[11px] text-amber-800">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    {t(
                      'নিরাপত্তা সতর্কতা: আমরা কখনোই আপনার bKash বা Nagad PIN, পাসওয়ার্ড বা OTP চাই না। অ্যাডমিন সার্ভার থেকে লেনদেন যাচাই না হওয়া পর্যন্ত পেমেন্ট স্ট্যাটাস “Pending Verification” থাকবে।',
                      'Security Notice: We NEVER ask for your bKash or Nagad PIN, password, or OTP. Payment status remains “Pending Verification” until verified by our admin/payment server.'
                    )}
                  </span>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Right Authoritative Order Summary */}
        <aside className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-5 sticky top-6">
          <h2 className="text-base font-bold text-slate-900">
            {t('অর্ডারকৃত পণ্য ও হিসাব', 'Order Items & Summary')}
          </h2>

          <ul className="divide-y divide-slate-100 max-h-64 overflow-y-auto pr-1">
            {items.map((entry) => (
              <li key={entry.productId} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">
                    {entry.product.name} × {entry.quantity}
                  </p>
                  <p className="text-slate-500">
                    {entry.product.brand}
                    {entry.product.requiresPrescription ? ' · Rx' : ''}
                  </p>
                </div>
                <span className="font-bold text-slate-900 tabular-nums shrink-0">
                  {formatTaka(entry.lineTotal)}
                </span>
              </li>
            ))}
          </ul>

          {/* Coupon Box */}
          <div className="pt-2 border-t border-slate-200">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t('প্রোমো / ডিসকাউন্ট কুপন কোড', 'Promo / Discount Coupon Code')}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  placeholder={t('যেমন: HEALTH50', 'e.g., HEALTH50')}
                  className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-xs uppercase"
                />
              </div>
              <button
                type="button"
                onClick={() => void handleApplyCoupon()}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                {t('প্রয়োগ', 'Apply')}
              </button>
            </div>
            {couponFeedback && (
              <p
                className={`text-[11px] mt-1 font-medium ${
                  appliedCoupon ? 'text-[#146c43]' : 'text-red-600'
                }`}
              >
                {couponFeedback}
              </p>
            )}
          </div>

          {/* Totals Breakdown */}
          <div className="space-y-2 pt-3 border-t border-slate-200 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>{t('সাবটোটাল', 'Subtotal')}</span>
              <span className="font-semibold text-slate-900 tabular-nums">
                {formatTaka(subtotal)}
              </span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-[#146c43]">
                <span>
                  {t('কুপন ছাড়', 'Coupon Discount')} ({appliedCoupon?.code})
                </span>
                <span className="font-bold tabular-nums">- {formatTaka(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>
                {t('ডেলিভারি চার্জ', 'Delivery Fee')} (
                {selectedZone === 'inside_dhaka'
                  ? t('ঢাকার ভেতরে', 'Inside Dhaka')
                  : t('ঢাকার বাইরে', 'Outside Dhaka')}
                )
              </span>
              <span className="font-semibold text-slate-900 tabular-nums">
                {deliveryFee === 0 ? t('ফ্রি', 'Free') : formatTaka(deliveryFee)}
              </span>
            </div>
            <div className="pt-3 border-t border-slate-200 flex justify-between text-base font-extrabold text-slate-900">
              <span>{t('সর্বমোট প্রদেয়', 'Total Payable')}</span>
              <span className="text-[#146c43] tabular-nums">
                {formatTaka(estimatedFinalTotal)}
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !user}
            className="w-full py-3.5 px-6 rounded-xl bg-[#146c43] hover:bg-[#0f5435] text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Lock className="w-4 h-4" />
            <span>
              {submitting
                ? t('সার্ভারে যাচাই ও অর্ডার তৈরি হচ্ছে...', 'Verifying & Placing Order...')
                : t('অর্ডার কনফার্ম করুন', 'Confirm Order')}
            </span>
          </button>
        </aside>
      </form>

      <PrescriptionModal
        isOpen={rxModalOpen}
        onClose={() => setRxModalOpen(false)}
        productIds={rxProductIds}
        productNames={items
          .filter((i) => i.product.requiresPrescription)
          .map((i) => i.product.name)}
        defaultCustomerName={customerName}
        defaultPhone={customerPhone}
        onSubmitted={(rxId) => setSelectedPrescriptionId(rxId)}
      />
    </div>
  );
}

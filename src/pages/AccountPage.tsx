import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  FileText,
  Heart,
  HelpCircle,
  Lock,
  MailWarning,
  MapPin,
  Package,
  RefreshCw,
  Search,
  Send,
  Trash2,
  User as UserIcon,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { ResilientImage } from '../components/ResilientImage';
import { SEOHead } from '../components/SEOHead';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useStore } from '../contexts/StoreContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { formatTaka, isValidBangladeshPhone } from '../lib/validation';
import {
  closeCustomerSupportTicket,
  createSupportTicket,
  deleteDeliveryAddress,
  fetchOrderWithItems,
  getPrivatePrescriptionDownloadUrl,
  markNotificationAsRead,
  requestCustomerAccountDeletion,
  saveDeliveryAddress,
  updatePrescriptionAdditionalInfo,
} from '../services/pharmacyService';
import type {
  DeliveryAddress,
  DeliveryZone,
  NotificationItem,
  Order,
  OrderItem,
  OrderStatus,
  PrescriptionReview,
  SupportTicket,
} from '../types/pharmacy';

type AccountTab =
  | 'profile'
  | 'addresses'
  | 'orders'
  | 'prescriptions'
  | 'wishlist'
  | 'notifications'
  | 'support'
  | 'security';

type OrderHistoryFilter = 'all' | 'active' | 'delivered' | 'cancelled';

function getOrderTimestampMillis(createdAt: unknown): number {
  if (!createdAt) return 0;
  if (typeof createdAt === 'object') {
    const maybeTs = createdAt as {
      toMillis?: () => number;
      toDate?: () => Date;
      seconds?: number;
    };
    if (typeof maybeTs.toMillis === 'function') {
      return maybeTs.toMillis();
    }
    if (typeof maybeTs.toDate === 'function') {
      return maybeTs.toDate().getTime();
    }
    if (typeof maybeTs.seconds === 'number') {
      return maybeTs.seconds * 1000;
    }
  }
  if (typeof createdAt === 'string' || typeof createdAt === 'number') {
    const parsed = new Date(createdAt).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function formatOrderDate(createdAt: unknown, lang: 'bn' | 'en'): string {
  const millis = getOrderTimestampMillis(createdAt);
  if (!millis) {
    return lang === 'en' ? 'Just now' : 'এইমাত্র';
  }
  const date = new Date(millis);
  try {
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'bn-BD', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return date.toLocaleDateString();
  }
}

function getOrderStatusMeta(
  status: OrderStatus,
  t: (bn: string, en: string) => string
): {
  label: string;
  colorClass: string;
  bucket: Exclude<OrderHistoryFilter, 'all'>;
} {
  switch (status) {
    case 'Delivered':
      return {
        label: t('ডেলিভারি সম্পন্ন', 'Delivered'),
        colorClass: 'text-[#146c43]',
        bucket: 'delivered',
      };
    case 'Cancelled':
      return {
        label: t('বাতিলকৃত', 'Cancelled'),
        colorClass: 'text-red-600',
        bucket: 'cancelled',
      };
    case 'Refund Pending':
      return {
        label: t('রিফান্ড প্রক্রিয়াধীন', 'Refund Pending'),
        colorClass: 'text-amber-700',
        bucket: 'cancelled',
      };
    case 'Refunded':
      return {
        label: t('রিফান্ড সম্পন্ন', 'Refunded'),
        colorClass: 'text-slate-600',
        bucket: 'cancelled',
      };
    case 'Awaiting Review':
      return {
        label: t('প্রেসক্রিপশন যাচাই চলছে', 'Awaiting Rx Review'),
        colorClass: 'text-amber-700',
        bucket: 'active',
      };
    case 'Pending':
      return {
        label: t('অপেক্ষমাণ', 'Pending'),
        colorClass: 'text-amber-700',
        bucket: 'active',
      };
    case 'Confirmed':
      return {
        label: t('নিশ্চিতকৃত', 'Confirmed'),
        colorClass: 'text-sky-700',
        bucket: 'active',
      };
    case 'Processing':
      return {
        label: t('প্রস্তুত হচ্ছে', 'Processing'),
        colorClass: 'text-sky-700',
        bucket: 'active',
      };
    case 'Ready for Dispatch':
      return {
        label: t('ডিসপ্যাচ প্রস্তুত', 'Ready for Dispatch'),
        colorClass: 'text-teal-700',
        bucket: 'active',
      };
    case 'Shipped':
      return {
        label: t('পথে রয়েছে', 'Shipped'),
        colorClass: 'text-indigo-700',
        bucket: 'active',
      };
    default:
      return {
        label: status,
        colorClass: 'text-slate-700',
        bucket: 'active',
      };
  }
}

function formatPaymentStatusLabel(
  paymentStatus: Order['paymentStatus'],
  t: (bn: string, en: string) => string
): string {
  switch (paymentStatus) {
    case 'paid':
      return t('পরিশোধিত', 'Paid');
    case 'pending_verification':
      return t('যাচাই চলছে', 'Pending Verification');
    case 'refunded':
      return t('রিফান্ডকৃত', 'Refunded');
    default:
      return t('অপরিশোধিত', 'Unpaid');
  }
}

export function AccountPage() {
  const {
    user,
    userPublic,
    userPrivate,
    isAuthReady,
    emailVerified,
    resendVerification,
    refreshVerificationState,
    saveProfileDetails,
    changePassword,
    logout,
  } = useAuth();
  const { catalogProducts, siteSettings } = useStore();
  const { lang, t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = (searchParams.get('tab') as AccountTab) || 'profile';

  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [defaultZone, setDefaultZone] = useState<DeliveryZone>('inside_dhaka');

  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [orderFilter, setOrderFilter] = useState<OrderHistoryFilter>('all');
  const [orderSearch, setOrderSearch] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [expandedItemsMap, setExpandedItemsMap] = useState<Record<string, OrderItem[]>>({});
  const [loadingItemsOrderId, setLoadingItemsOrderId] = useState<string | null>(null);
  const [prescriptions, setPrescriptions] = useState<PrescriptionReview[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);

  const [addrLabel, setAddrLabel] = useState('');
  const [addrRecipient, setAddrRecipient] = useState('');
  const [addrPhone, setAddrPhone] = useState('');
  const [addrZone, setAddrZone] = useState<DeliveryZone>('inside_dhaka');
  const [addrDistrict, setAddrDistrict] = useState('Dhaka');
  const [addrArea, setAddrArea] = useState('');
  const [addrStreet, setAddrStreet] = useState('');

  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketCategory, setTicketCategory] = useState<SupportTicket['category']>('order');
  const [ticketOrderNo, setTicketOrderNo] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');

  const [currPass, setCurrPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmDeleteText, setConfirmDeleteText] = useState('');

  const [rxFollowUpNotes, setRxFollowUpNotes] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileStatus, setProfileStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [verifyingBusy, setVerifyingBusy] = useState(false);

  useEffect(() => {
    const resolvedName = userPublic?.displayName || user?.displayName || '';
    if (resolvedName) {
      setDisplayName(resolvedName);
    }
  }, [userPublic?.displayName, user?.displayName]);

  useEffect(() => {
    if (userPrivate) {
      setPhone(userPrivate.phone || '');
      setDefaultZone(userPrivate.defaultZone || 'inside_dhaka');
    }
  }, [userPrivate?.phone, userPrivate?.defaultZone]);

  // Isolated per-customer Firestore subscriptions
  useEffect(() => {
    if (!user || !isAuthReady) {
      setOrders([]);
      setOrdersLoading(false);
      return;
    }
    const uid = user.uid;
    setOrdersLoading(true);

    const uAddr = onSnapshot(
      collection(db, 'users', uid, 'addresses'),
      (s) =>
        setAddresses(
          s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DeliveryAddress, 'id'>) }))
        ),
      () => {}
    );

    const uOrd = onSnapshot(
      query(collection(db, 'orders'), where('userId', '==', uid)),
      (s) => {
        setOrders(
          s.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<Order, 'id'>) }))
            .sort(
              (a, b) => getOrderTimestampMillis(b.createdAt) - getOrderTimestampMillis(a.createdAt)
            )
        );
        setOrdersLoading(false);
      },
      (err) => {
        setOrdersLoading(false);
        handleFirestoreError(err, OperationType.LIST, 'orders');
      }
    );

    const uRx = onSnapshot(
      query(collection(db, 'prescriptionReviews'), where('userId', '==', uid)),
      (s) =>
        setPrescriptions(
          s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PrescriptionReview, 'id'>) }))
        ),
      () => {}
    );

    const uNotif = onSnapshot(
      query(collection(db, 'notifications'), where('userId', '==', uid)),
      (s) =>
        setNotifications(
          s.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<NotificationItem, 'id'>) }))
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
        ),
      () => {}
    );

    const uTkt = onSnapshot(
      query(collection(db, 'supportTickets'), where('userId', '==', uid)),
      (s) =>
        setTickets(
          s.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<SupportTicket, 'id'>) }))
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
        ),
      () => {}
    );

    return () => {
      uAddr();
      uOrd();
      uRx();
      uNotif();
      uTkt();
    };
  }, [user, isAuthReady]);

  if (!isAuthReady) {
    return (
      <div className="max-w-4xl mx-auto p-10 text-center text-sm">
        {t('লোড হচ্ছে...', 'Loading...')}
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login?redirect=/account" replace />;
  }

  const wishlistedProducts = catalogProducts.filter((p) =>
    userPublic?.wishlistProductIds?.includes(p.id)
  );

  const deliveredOrdersCount = orders.filter((o) => o.status === 'Delivered').length;
  const activeOrdersCount = orders.filter(
    (o) => getOrderStatusMeta(o.status, t).bucket === 'active'
  ).length;

  const filteredOrders = orders.filter((ord) => {
    const meta = getOrderStatusMeta(ord.status, t);
    if (orderFilter !== 'all' && meta.bucket !== orderFilter) {
      return false;
    }
    const q = orderSearch.trim().toUpperCase();
    if (!q) return true;
    return (
      ord.orderNumber.toUpperCase().includes(q) ||
      ord.id.toUpperCase().includes(q) ||
      ord.status.toUpperCase().includes(q)
    );
  });

  const handleToggleOrderItems = async (orderId: string) => {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
      return;
    }
    setExpandedOrderId(orderId);
    if (expandedItemsMap[orderId]) {
      return;
    }
    setLoadingItemsOrderId(orderId);
    try {
      const res = await fetchOrderWithItems(orderId, user.uid);
      if (res) {
        setExpandedItemsMap((prev) => ({ ...prev, [orderId]: res.items }));
      }
    } finally {
      setLoadingItemsOrderId((curr) => (curr === orderId ? null : curr));
    }
  };

  const renderStatusIcon = (status: OrderStatus) => {
    if (status === 'Delivered') {
      return <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />;
    }
    if (status === 'Cancelled' || status === 'Refund Pending' || status === 'Refunded') {
      return <XCircle className="w-3.5 h-3.5 shrink-0" />;
    }
    return <Clock className="w-3.5 h-3.5 shrink-0" />;
  };

  const navItems: Array<{ key: AccountTab; label: string; icon: React.ReactNode }> = [
    {
      key: 'profile',
      label: t('প্রোফাইল তথ্য', 'Profile Info'),
      icon: <UserIcon className="w-4 h-4" />,
    },
    {
      key: 'orders',
      label: `${t('অর্ডারসমূহ', 'Orders')} (${orders.length})`,
      icon: <Package className="w-4 h-4" />,
    },
    {
      key: 'addresses',
      label: t('ডেলিভারি ঠিকানা', 'Delivery Addresses'),
      icon: <MapPin className="w-4 h-4" />,
    },
    {
      key: 'prescriptions',
      label: t('প্রেসক্রিপশন রিভিউ', 'Prescriptions (Rx)'),
      icon: <FileText className="w-4 h-4" />,
    },
    {
      key: 'wishlist',
      label: `${t('পছন্দের তালিকা', 'Wishlist')} (${wishlistedProducts.length})`,
      icon: <Heart className="w-4 h-4" />,
    },
    {
      key: 'notifications',
      label: `${t('নোটিফিকেশন', 'Notifications')} (${notifications.filter((n) => !n.isRead).length})`,
      icon: <Bell className="w-4 h-4" />,
    },
    {
      key: 'support',
      label: t('সাপোর্ট রিকোয়েস্ট', 'Support Tickets'),
      icon: <HelpCircle className="w-4 h-4" />,
    },
    {
      key: 'security',
      label: t('পাসওয়ার্ড ও গোপনীয়তা', 'Password & Privacy'),
      icon: <Lock className="w-4 h-4" />,
    },
  ];

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-8">
      <SEOHead
        title={`${t('আমার একাউন্ট', 'My Account')} – ${siteSettings.brandName}`}
        description={t(
          'আপনার প্রোফাইল, অর্ডার হিস্ট্রি, সংরক্ষিত ঠিকানা ও প্রেসক্রিপশন পরিচালনা করুন।',
          'Manage your customer profile, order history, saved addresses, and prescriptions.'
        )}
        canonicalPath="/account"
      />

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
            {t('কাস্টমার একাউন্ট ড্যাশবোর্ড', 'Customer Account Dashboard')}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-0.5">
            <p className="text-xs text-slate-500">{user.email}</p>
            {emailVerified ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-[#0f5435]">
                <CheckCircle2 className="w-3 h-3" />
                <span>{t('ইমেইল ভেরিফাইড', 'Verified')}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-800">
                <MailWarning className="w-3 h-3" />
                <span>{t('ভেরিফিকেশন বাকি', 'Unverified')}</span>
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
        >
          {t('লগআউট', 'Logout')}
        </button>
      </div>

      {!emailVerified && (
        <div className="mb-5 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-amber-950 space-y-0.5">
            <p className="font-bold">
              {t('আপনার ইমেইল ঠিকানা ভেরিফাই করুন', 'Please Verify Your Email Address')}
            </p>
            <p className="text-amber-800">
              {t(
                'আপনার ইমেইলে পাঠানো ভেরিফিকেশন লিংকে ক্লিক করে নিচের যাচাই বাটনে ক্লিক করুন (Spam ফোল্ডারও চেক করুন)।',
                'Click the verification link sent to your email (check Spam folder too) and tap Verify Status.'
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={verifyingBusy}
              onClick={async () => {
                setVerifyingBusy(true);
                try {
                  const ok = await refreshVerificationState();
                  setFeedback(
                    ok
                      ? t(
                          'আপনার ইমেইল সফলভাবে ভেরিফাই হয়েছে!',
                          'Your email has been verified successfully!'
                        )
                      : t(
                          'এখনো ভেরিফাই সম্পন্ন হয়নি। ইমেইলের লিংকে ক্লিক করে আবার চেষ্টা করুন।',
                          'Not verified yet. Please click the link in your email first.'
                        )
                  );
                } catch {
                  setFeedback(
                    t(
                      'ভেরিফিকেশন স্ট্যাটাস যাচাই করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।',
                      'Could not check verification status. Please try again.'
                    )
                  );
                } finally {
                  setVerifyingBusy(false);
                }
              }}
              className="px-3.5 py-2 rounded-lg bg-[#146c43] hover:bg-[#0f5435] text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${verifyingBusy ? 'animate-spin' : ''}`} />
              <span>{t('ভেরিফিকেশন যাচাই করুন', 'Verify Status')}</span>
            </button>
            <button
              type="button"
              disabled={verifyingBusy}
              onClick={async () => {
                setVerifyingBusy(true);
                try {
                  await resendVerification();
                  setFeedback(
                    t(
                      'নতুন ভেরিফিকেশন লিংক আপনার ইমেইলে পাঠানো হয়েছে।',
                      'A new verification email has been sent.'
                    )
                  );
                } catch {
                  setFeedback(
                    t(
                      'ভেরিফিকেশন ইমেইল ইতিমধ্যে পাঠানো হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।',
                      'Verification email was recently sent. Please wait a moment and try again.'
                    )
                  );
                } finally {
                  setVerifyingBusy(false);
                }
              }}
              className="px-3.5 py-2 rounded-lg bg-white border border-amber-300 hover:bg-amber-100/50 text-amber-950 text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{t('লিংক পুনরায় পাঠান', 'Resend Link')}</span>
            </button>
          </div>
        </div>
      )}

      {feedback && (
        <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-950">
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Sidebar Navigation */}
        <aside className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setFeedback(null);
                setSearchParams({ tab: item.key });
              }}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === item.key
                  ? 'bg-[#146c43] text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </aside>

        {/* Main Content Panel */}
        <div className="lg:col-span-9 bg-white border border-slate-200 rounded-2xl p-6">
          {/* TAB 1: PROFILE + PAST ORDER HISTORY SECTION */}
          {activeTab === 'profile' && (
            <div className="space-y-10">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setProfileStatus(null);
                  setFeedback(null);

                  const trimmedName = displayName.trim();
                  if (!trimmedName) {
                    const errText = t(
                      'অনুগ্রহ করে আপনার পূর্ণ নাম লিখুন।',
                      'Please enter your full name.'
                    );
                    setProfileStatus({ type: 'error', message: errText });
                    return;
                  }

                  const trimmedPhone = phone.trim();
                  if (trimmedPhone && !isValidBangladeshPhone(trimmedPhone)) {
                    const errText = t(
                      'সঠিক ১১ সংখ্যার বাংলাদেশী মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)।',
                      'Please enter a valid 11-digit Bangladesh mobile number (e.g., 017XXXXXXXX).'
                    );
                    setProfileStatus({ type: 'error', message: errText });
                    return;
                  }

                  setSavingProfile(true);
                  try {
                    await saveProfileDetails({
                      displayName: trimmedName,
                      phone: trimmedPhone,
                      defaultZone,
                    });
                    const okText = t(
                      'প্রোফাইল সফলভাবে সংরক্ষিত হয়েছে।',
                      'Profile updated successfully.'
                    );
                    setProfileStatus({ type: 'success', message: okText });
                    setFeedback(okText);
                  } catch {
                    const failText = t(
                      'প্রোফাইল সংরক্ষণে সমস্যা হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।',
                      'Could not save profile changes. Please try again.'
                    );
                    setProfileStatus({ type: 'error', message: failText });
                  } finally {
                    setSavingProfile(false);
                  }
                }}
                className="space-y-4 max-w-lg"
              >
                <h2 className="text-base font-bold text-slate-900">
                  {t('প্রোফাইল ও যোগাযোগের তথ্য', 'Profile & Contact Details')}
                </h2>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('পূর্ণ নাম', 'Full Name')}
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => {
                      setDisplayName(e.target.value);
                      if (profileStatus) setProfileStatus(null);
                    }}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('ইমেইল', 'Email Address')}
                  </label>
                  <input
                    type="email"
                    disabled
                    value={user.email || ''}
                    className="w-full px-3.5 py-2.5 border border-slate-200 bg-slate-50 rounded-lg text-sm text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('মোবাইল নম্বর', 'Mobile Number')}
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (profileStatus) setProfileStatus(null);
                    }}
                    placeholder="017XXXXXXXX"
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('ডিফল্ট ডেলিভারি জোন', 'Default Delivery Zone')}
                  </label>
                  <select
                    value={defaultZone}
                    onChange={(e) => {
                      setDefaultZone(e.target.value as DeliveryZone);
                      if (profileStatus) setProfileStatus(null);
                    }}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    <option value="inside_dhaka">{t('ঢাকার ভেতরে', 'Inside Dhaka')}</option>
                    <option value="outside_dhaka">{t('ঢাকার বাইরে', 'Outside Dhaka')}</option>
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="px-6 py-2.5 bg-[#146c43] hover:bg-[#0f5435] text-white text-xs font-bold rounded-lg whitespace-nowrap shrink-0 disabled:opacity-60 inline-flex items-center gap-2 cursor-pointer"
                  >
                    {savingProfile && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>
                      {savingProfile
                        ? t('সংরক্ষণ হচ্ছে...', 'Saving...')
                        : t('পরিবর্তন সংরক্ষণ করুন', 'Save Changes')}
                    </span>
                  </button>

                  {profileStatus && (
                    <span
                      role="status"
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                        profileStatus.type === 'success' ? 'text-[#146c43]' : 'text-red-600'
                      }`}
                    >
                      {profileStatus.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 shrink-0" />
                      )}
                      <span>{profileStatus.message}</span>
                    </span>
                  )}
                </div>
              </form>

              {/* Dedicated Past Order History Section on Account Overview */}
              <section
                aria-labelledby="past-order-history-heading"
                className="pt-8 border-t border-slate-200 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2
                      id="past-order-history-heading"
                      className="text-base font-bold text-slate-900"
                    >
                      {t('পূর্ববর্তী অর্ডার হিস্ট্রি', 'Past Order History')}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5 tabular-nums">
                      <span>
                        {t('মোট অর্ডার:', 'Total orders:')} {orders.length}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {t('ডেলিভারি সম্পন্ন:', 'Delivered:')} {deliveredOrdersCount}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {t('চলমান:', 'In progress:')} {activeOrdersCount}
                      </span>
                    </div>
                  </div>

                  {orders.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setFeedback(null);
                        setSearchParams({ tab: 'orders' });
                      }}
                      className="px-3.5 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {t('সব অর্ডার দেখুন', 'View All Orders')}
                    </button>
                  )}
                </div>

                {ordersLoading ? (
                  <p className="py-6 text-xs text-slate-500">
                    {t('অর্ডার হিস্ট্রি লোড হচ্ছে...', 'Loading past orders...')}
                  </p>
                ) : orders.length === 0 ? (
                  <div className="py-6 border-t border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">
                      {t(
                        'আপনার একাউন্টে এখনো কোনো পূর্ববর্তী অর্ডার পাওয়া যায়নি।',
                        'No past orders found for your account yet.'
                      )}
                    </p>
                    <Link
                      to="/products"
                      className="px-4 py-2 bg-[#146c43] hover:bg-[#0f5435] text-white text-xs font-bold rounded-lg whitespace-nowrap shrink-0 self-start sm:self-auto"
                    >
                      {t('পণ্য দেখুন', 'Browse Products')}
                    </Link>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                          <th className="py-2.5 pr-4">{t('অর্ডার নম্বর', 'Order')}</th>
                          <th className="py-2.5 px-4">{t('তারিখ', 'Date')}</th>
                          <th className="py-2.5 px-4">{t('অবস্থা', 'Status')}</th>
                          <th className="py-2.5 px-4 text-right">
                            {t('মোট পরিমাণ', 'Total Amount')}
                          </th>
                          <th className="py-2.5 pl-4 text-right">{t('অ্যাকশন', 'Action')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {orders.slice(0, 5).map((ord) => {
                          const statusMeta = getOrderStatusMeta(ord.status, t);
                          return (
                            <tr key={ord.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-3 pr-4">
                                <p className="font-bold text-slate-900 tabular-nums">
                                  #{ord.orderNumber}
                                </p>
                                <p className="text-slate-500 tabular-nums">
                                  {ord.itemCount}{' '}
                                  {t('টি পণ্য', ord.itemCount === 1 ? 'item' : 'items')} ·{' '}
                                  {ord.paymentMethod.toUpperCase()}
                                </p>
                              </td>
                              <td className="py-3 px-4 text-slate-600 tabular-nums whitespace-nowrap">
                                {formatOrderDate(ord.createdAt, lang)}
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`inline-flex items-center gap-1.5 font-semibold whitespace-nowrap ${statusMeta.colorClass}`}
                                >
                                  {renderStatusIcon(ord.status)}
                                  <span>{statusMeta.label}</span>
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right font-extrabold text-[#0f5435] tabular-nums whitespace-nowrap">
                                {formatTaka(ord.totalAmount)}
                              </td>
                              <td className="py-3 pl-4 text-right whitespace-nowrap">
                                <Link
                                  to={`/track-order/${ord.id}`}
                                  className="inline-flex items-center gap-1 text-[#146c43] hover:text-[#0f5435] font-semibold hover:underline"
                                >
                                  <span>{t('ট্র্যাক করুন', 'Track')}</span>
                                  <ExternalLink className="w-3 h-3" />
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* TAB 2: ORDERS */}
          {activeTab === 'orders' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {t('পূর্ববর্তী অর্ডার হিস্ট্রি', 'Past Order History')}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                    {t('মোট অর্ডার:', 'Total orders:')} {orders.length} ·{' '}
                    {t('ডেলিভারি সম্পন্ন:', 'Delivered:')} {deliveredOrdersCount} ·{' '}
                    {t('চলমান:', 'In progress:')} {activeOrdersCount}
                  </p>
                </div>

                {orders.length > 0 && (
                  <div className="relative w-full sm:w-60">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      placeholder={t('অর্ডার নম্বর খুঁজুন...', 'Search order #...')}
                      className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                )}
              </div>

              {orders.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
                  {(
                    [
                      { key: 'all', label: `${t('সব', 'All')} (${orders.length})` },
                      { key: 'active', label: `${t('চলমান', 'Active')} (${activeOrdersCount})` },
                      {
                        key: 'delivered',
                        label: `${t('ডেলিভারি সম্পন্ন', 'Delivered')} (${deliveredOrdersCount})`,
                      },
                      {
                        key: 'cancelled',
                        label: `${t('বাতিল / রিফান্ড', 'Cancelled')} (${
                          orders.length - activeOrdersCount - deliveredOrdersCount
                        })`,
                      },
                    ] as Array<{ key: OrderHistoryFilter; label: string }>
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setOrderFilter(tab.key)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                        orderFilter === tab.key
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}

              {ordersLoading ? (
                <p className="py-8 text-center text-xs text-slate-500">
                  {t('আপনার অর্ডার হিস্ট্রি লোড হচ্ছে...', 'Loading your order history...')}
                </p>
              ) : orders.length === 0 ? (
                <div className="py-8 text-center space-y-3 border-t border-slate-100">
                  <p className="text-xs text-slate-500">
                    {t('আপনার এখনো কোনো অর্ডার নেই।', 'You have not placed any orders yet.')}
                  </p>
                  <Link
                    to="/products"
                    className="inline-block px-5 py-2 bg-[#146c43] hover:bg-[#0f5435] text-white text-xs font-bold rounded-lg whitespace-nowrap shrink-0"
                  >
                    {t('কেনাকাটা শুরু করুন', 'Start Shopping')}
                  </Link>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="py-8 text-center space-y-2 border-t border-slate-100">
                  <p className="text-xs text-slate-500">
                    {t(
                      'নির্বাচিত ফিল্টারে কোনো অর্ডার পাওয়া যায়নি।',
                      'No orders match your current filter or search.'
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setOrderFilter('all');
                      setOrderSearch('');
                    }}
                    className="text-xs font-semibold text-[#146c43] hover:underline cursor-pointer"
                  >
                    {t('ফিল্টার রিসেট করুন', 'Reset filters')}
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-200 border-t border-b border-slate-200">
                  {filteredOrders.map((ord) => {
                    const statusMeta = getOrderStatusMeta(ord.status, t);
                    const isExpanded = expandedOrderId === ord.id;
                    const cachedItems = expandedItemsMap[ord.id];
                    const isLoadingItems = loadingItemsOrderId === ord.id;

                    return (
                      <div key={ord.id} className="py-4 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="text-xs space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-bold text-slate-900 tabular-nums">
                                #{ord.orderNumber}
                              </span>
                              <span className="text-slate-300" aria-hidden="true">
                                ·
                              </span>
                              <span className="text-slate-600 tabular-nums">
                                {t('তারিখ:', 'Date:')} {formatOrderDate(ord.createdAt, lang)}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-slate-600">
                              <span
                                className={`inline-flex items-center gap-1 font-semibold ${statusMeta.colorClass}`}
                              >
                                {renderStatusIcon(ord.status)}
                                <span>
                                  {t('অবস্থা:', 'Status:')} {statusMeta.label}
                                </span>
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="tabular-nums">
                                {ord.itemCount}{' '}
                                {t('টি পণ্য', ord.itemCount === 1 ? 'item' : 'items')}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>
                                {t('পেমেন্ট:', 'Payment:')} {ord.paymentMethod.toUpperCase()} (
                                {formatPaymentStatusLabel(ord.paymentStatus, t)})
                              </span>
                            </div>

                            <p className="text-slate-500">
                              {t('ঠিকানা:', 'Address:')} {ord.area}, {ord.district}
                              {ord.trackingReference
                                ? ` · ${t('ট্র্যাকিং রেফারেন্স:', 'Tracking Ref:')} ${ord.trackingReference}`
                                : ''}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 shrink-0">
                            <div className="sm:text-right mr-1">
                              <p className="text-[11px] text-slate-500">
                                {t('সর্বমোট', 'Total Amount')}
                              </p>
                              <p className="text-base font-extrabold text-[#0f5435] tabular-nums">
                                {formatTaka(ord.totalAmount)}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => void handleToggleOrderItems(ord.id)}
                              className="px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <span>{t('পণ্যের তালিকা', 'Items')}</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>

                            <Link
                              to={`/track-order/${ord.id}`}
                              className="px-3.5 py-2 bg-[#edf6f1] hover:bg-[#dceee4] text-[#0f5435] text-xs font-bold rounded-lg whitespace-nowrap shrink-0"
                            >
                              {t('বিস্তারিত ও ট্র্যাকিং', 'Details & Tracking')}
                            </Link>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="pt-3 pl-0 sm:pl-4 border-t border-slate-100 space-y-2 text-xs">
                            {isLoadingItems ? (
                              <p className="text-slate-500 py-2">
                                {t('পণ্যের বিবরণ লোড হচ্ছে...', 'Loading ordered items...')}
                              </p>
                            ) : !cachedItems || cachedItems.length === 0 ? (
                              <p className="text-slate-500 py-2">
                                {t(
                                  'পণ্যের বিস্তারিত দেখতে ট্র্যাকিং পেজে যান।',
                                  'Open Details & Tracking to view full receipt details.'
                                )}
                              </p>
                            ) : (
                              <div className="space-y-2">
                                <div className="divide-y divide-slate-100">
                                  {cachedItems.map((item) => (
                                    <div
                                      key={item.id}
                                      className="py-2 flex items-center justify-between gap-3"
                                    >
                                      <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded bg-[#f6faf7] shrink-0 overflow-hidden">
                                          <ResilientImage
                                            src={item.imageUrl}
                                            alt={item.productName}
                                            className="w-full h-full object-contain p-1"
                                          />
                                        </div>
                                        <div className="min-w-0">
                                          <p className="font-semibold text-slate-900 truncate">
                                            {item.productName}
                                          </p>
                                          <p className="text-slate-500 tabular-nums">
                                            {formatTaka(item.unitPrice)} × {item.quantity}
                                          </p>
                                        </div>
                                      </div>
                                      <span className="font-bold text-slate-900 tabular-nums whitespace-nowrap">
                                        {formatTaka(item.lineTotal)}
                                      </span>
                                    </div>
                                  ))}
                                </div>

                                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-end gap-4 text-slate-600 tabular-nums">
                                  <span>
                                    {t('সাবটোটাল:', 'Subtotal:')} {formatTaka(ord.subtotal)}
                                  </span>
                                  {ord.discountAmount > 0 && (
                                    <span className="text-[#146c43]">
                                      {t('ছাড়:', 'Discount:')} -{formatTaka(ord.discountAmount)}
                                    </span>
                                  )}
                                  <span>
                                    {t('ডেলিভারি চার্জ:', 'Delivery:')} {formatTaka(ord.deliveryFee)}
                                  </span>
                                  <span className="font-bold text-slate-900">
                                    {t('সর্বমোট:', 'Total:')} {formatTaka(ord.totalAmount)}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ADDRESSES */}
          {activeTab === 'addresses' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-bold text-slate-900 mb-3">
                  {t('সংরক্ষিত ডেলিভারি ঠিকানা', 'Saved Delivery Addresses')}
                </h2>
                {addresses.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    {t('কোনো ঠিকানা সংরক্ষিত নেই।', 'No saved addresses yet.')}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {addresses.map((addr) => (
                      <div
                        key={addr.id}
                        className="p-4 rounded-xl border border-slate-200 flex justify-between gap-2 text-xs"
                      >
                        <div className="space-y-1">
                          <p className="font-bold text-slate-900">
                            {addr.label} · {addr.recipientName}
                          </p>
                          <p className="text-slate-600 tabular-nums">{addr.phone}</p>
                          <p className="text-slate-600">
                            {addr.streetAddress}, {addr.area}, {addr.district}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void deleteDeliveryAddress(user.uid, addr.id)}
                          aria-label={t('ঠিকানা মুছুন', 'Delete address')}
                          className="text-slate-400 hover:text-red-600 self-start cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!isValidBangladeshPhone(addrPhone)) {
                    setFeedback(
                      t(
                        'সঠিক বাংলাদেশী মোবাইল নম্বর দিন।',
                        'Please enter a valid 11-digit Bangladesh mobile number.'
                      )
                    );
                    return;
                  }
                  await saveDeliveryAddress(user.uid, {
                    label: addrLabel || t('বাসা', 'Home'),
                    recipientName: addrRecipient,
                    phone: addrPhone,
                    zone: addrZone,
                    district: addrDistrict,
                    area: addrArea,
                    streetAddress: addrStreet,
                    isDefault: addresses.length === 0,
                  });
                  setAddrArea('');
                  setAddrStreet('');
                  setFeedback(
                    t('নতুন ডেলিভারি ঠিকানা যুক্ত হয়েছে।', 'New delivery address saved.')
                  );
                }}
                className="pt-4 border-t border-slate-200 space-y-3 max-w-xl"
              >
                <h3 className="text-sm font-bold text-slate-900">
                  {t('নতুন ঠিকানা যোগ করুন', 'Add New Address')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    required
                    value={addrLabel}
                    onChange={(e) => setAddrLabel(e.target.value)}
                    placeholder={t('লেবেল (বাসা / অফিস)', 'Label (Home / Office)')}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                  <input
                    type="text"
                    required
                    value={addrRecipient}
                    onChange={(e) => setAddrRecipient(e.target.value)}
                    placeholder={t('প্রাপকের নাম', 'Recipient Name')}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                  <input
                    type="tel"
                    required
                    value={addrPhone}
                    onChange={(e) => setAddrPhone(e.target.value)}
                    placeholder={t('মোবাইল নম্বর', 'Mobile Number')}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <select
                    value={addrZone}
                    onChange={(e) => setAddrZone(e.target.value as DeliveryZone)}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    <option value="inside_dhaka">{t('ঢাকার ভেতরে', 'Inside Dhaka')}</option>
                    <option value="outside_dhaka">{t('ঢাকার বাইরে', 'Outside Dhaka')}</option>
                  </select>
                  <input
                    type="text"
                    required
                    value={addrDistrict}
                    onChange={(e) => setAddrDistrict(e.target.value)}
                    placeholder={t('জেলা', 'District')}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                  <input
                    type="text"
                    required
                    value={addrArea}
                    onChange={(e) => setAddrArea(e.target.value)}
                    placeholder={t('থানা / এলাকা', 'Thana / Area')}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <input
                  type="text"
                  required
                  value={addrStreet}
                  onChange={(e) => setAddrStreet(e.target.value)}
                  placeholder={t(
                    'বাসা/রোড নম্বর ও বিস্তারিত ঠিকানা',
                    'House/Road No. & Detailed Street Address'
                  )}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#146c43] text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  {t('ঠিকানা সংরক্ষণ করুন', 'Save Address')}
                </button>
              </form>
            </div>
          )}

          {/* TAB 4: PRESCRIPTIONS */}
          {activeTab === 'prescriptions' && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900">
                {t('প্রেসক্রিপশন রিভিউ স্ট্যাটাস', 'Prescription Review Status')}
              </h2>
              {prescriptions.length === 0 ? (
                <p className="text-xs text-slate-500">
                  {t(
                    'আপনি এখনো কোনো প্রেসক্রিপশন জমা দেননি।',
                    'You have not uploaded any prescriptions yet.'
                  )}
                </p>
              ) : (
                prescriptions.map((rx) => (
                  <div
                    key={rx.id}
                    className="p-4 rounded-xl border border-slate-200 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        {t('ডা.', 'Dr.')} {rx.doctorName} — {rx.clinicOrHospital}
                      </span>
                      <span className="font-semibold text-[#146c43]">{rx.status}</span>
                    </div>
                    <p className="text-slate-600">
                      {t('তারিখ:', 'Date:')} {rx.prescriptionDate}
                    </p>
                    {rx.pharmacistNotes && (
                      <p className="p-2.5 rounded bg-amber-50 text-amber-900">
                        {t('ফার্মাসিস্ট নোট:', 'Pharmacist Note:')} {rx.pharmacistNotes}
                      </p>
                    )}
                    {rx.storageFilePath && !rx.storageFilePath.startsWith('pending_') && (
                      <button
                        type="button"
                        onClick={async () => {
                          const url = await getPrivatePrescriptionDownloadUrl(rx.storageFilePath);
                          if (url) {
                            setFeedback(
                              t(
                                `নিরাপদ ফাইল লিংক প্রস্তুত: ${url}`,
                                `Secure private file URL ready: ${url}`
                              )
                            );
                          }
                        }}
                        className="text-[#146c43] font-semibold hover:underline cursor-pointer"
                      >
                        {t('আপলোডকৃত ফাইল যাচাই করুন', 'Verify Uploaded File')}
                      </button>
                    )}

                    {rx.status === 'needs_info' && (
                      <div className="pt-2 flex gap-2">
                        <input
                          type="text"
                          value={rxFollowUpNotes[rx.id] || ''}
                          onChange={(e) =>
                            setRxFollowUpNotes((prev) => ({ ...prev, [rx.id]: e.target.value }))
                          }
                          placeholder={t(
                            'ফার্মাসিস্টের চাওয়া অতিরিক্ত তথ্য লিখুন...',
                            'Provide additional details requested by the pharmacist...'
                          )}
                          className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            await updatePrescriptionAdditionalInfo({
                              prescriptionId: rx.id,
                              notes: rxFollowUpNotes[rx.id] || rx.notes,
                              storageFilePath: rx.storageFilePath,
                            });
                            setFeedback(
                              t(
                                'অতিরিক্ত তথ্য পুনরায় রিভিউয়ের জন্য পাঠানো হয়েছে।',
                                'Additional information submitted for pharmacist re-review.'
                              )
                            );
                          }}
                          className="px-3.5 py-1.5 bg-[#146c43] text-white font-semibold rounded-lg cursor-pointer"
                        >
                          {t('জমা দিন', 'Submit')}
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 5: WISHLIST */}
          {activeTab === 'wishlist' && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900">
                {t('পছন্দের তালিকা (Wishlist)', 'Saved Wishlist')}
              </h2>
              {wishlistedProducts.length === 0 ? (
                <p className="text-xs text-slate-500">
                  {t(
                    'আপনার পছন্দের তালিকায় কোনো পণ্য নেই।',
                    'There are no products in your wishlist yet.'
                  )}
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {wishlistedProducts.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="space-y-3">
              <h2 className="text-base font-bold text-slate-900">
                {t('নোটিফিকেশন হিস্ট্রি', 'Notification History')}
              </h2>
              {notifications.length === 0 ? (
                <p className="text-xs text-slate-500">
                  {t('কোনো নোটিফিকেশন নেই।', 'No notifications yet.')}
                </p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 text-xs ${
                      n.isRead ? 'border-slate-200 bg-white' : 'border-emerald-200 bg-emerald-50/40'
                    }`}
                  >
                    <div>
                      <p className="font-bold text-slate-900">{n.title}</p>
                      <p className="text-slate-600 mt-0.5">{n.message}</p>
                    </div>
                    {!n.isRead && (
                      <button
                        type="button"
                        onClick={() => void markNotificationAsRead(n.id)}
                        className="text-[#146c43] font-semibold whitespace-nowrap hover:underline cursor-pointer"
                      >
                        {t('পঠিত হিসেবে চিহ্নিত করুন', 'Mark as read')}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 7: SUPPORT TICKETS */}
          {activeTab === 'support' && (
            <div className="space-y-6">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await createSupportTicket({
                    uid: user.uid,
                    customerName: displayName || user.displayName || 'Customer',
                    email: user.email || '',
                    phone,
                    subject: ticketSubject,
                    category: ticketCategory,
                    orderNumber: ticketOrderNo,
                    message: ticketMessage,
                  });
                  setTicketSubject('');
                  setTicketOrderNo('');
                  setTicketMessage('');
                  setFeedback(
                    t('আপনার সাপোর্ট রিকোয়েস্ট জমা হয়েছে।', 'Your support ticket has been submitted.')
                  );
                }}
                className="space-y-3 max-w-xl"
              >
                <h2 className="text-base font-bold text-slate-900">
                  {t('নতুন সাপোর্ট রিকোয়েস্ট পাঠান', 'Submit a Support Ticket')}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select
                    value={ticketCategory}
                    onChange={(e) =>
                      setTicketCategory(e.target.value as SupportTicket['category'])
                    }
                    className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    <option value="order">{t('অর্ডার সংক্রান্ত', 'Order Inquiry')}</option>
                    <option value="delivery">{t('ডেলিভারি সংক্রান্ত', 'Delivery Issue')}</option>
                    <option value="payment">{t('পেমেন্ট সংক্রান্ত', 'Payment Verification')}</option>
                    <option value="medicine_query">{t('পণ্য/তথ্য জিজ্ঞাসা', 'Product Question')}</option>
                    <option value="account">{t('একাউন্ট ও গোপনীয়তা', 'Account & Privacy')}</option>
                    <option value="other">{t('অন্যান্য', 'Other')}</option>
                  </select>
                  <input
                    type="text"
                    value={ticketOrderNo}
                    onChange={(e) => setTicketOrderNo(e.target.value)}
                    placeholder={t('অর্ডার নম্বর (থাকলে)', 'Order Number (if applicable)')}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <input
                  type="text"
                  required
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  placeholder={t('বিষয় *', 'Subject *')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
                <textarea
                  rows={3}
                  required
                  value={ticketMessage}
                  onChange={(e) => setTicketMessage(e.target.value)}
                  placeholder={t('বিস্তারিত বিবরণ লিখুন *', 'Describe your issue in detail *')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#146c43] text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  {t('সাপোর্টে পাঠান', 'Send Ticket')}
                </button>
              </form>

              <div className="space-y-3 pt-4 border-t border-slate-200">
                <h3 className="text-sm font-bold text-slate-900">
                  {t('পূর্ববর্তী রিকোয়েস্টসমূহ', 'Previous Support Tickets')}
                </h3>
                {tickets.map((tkt) => (
                  <div
                    key={tkt.id}
                    className="p-3.5 rounded-xl border border-slate-200 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{tkt.subject}</span>
                      <span className="font-semibold text-[#146c43]">{tkt.status}</span>
                    </div>
                    <p className="text-slate-600">{tkt.message}</p>
                    {tkt.adminReply && (
                      <p className="p-2.5 rounded bg-emerald-50 text-emerald-950">
                        {t('অ্যাডমিন উত্তর:', 'Admin Reply:')} {tkt.adminReply}
                      </p>
                    )}
                    {tkt.status !== 'closed' && (
                      <button
                        type="button"
                        onClick={() => void closeCustomerSupportTicket(tkt.id)}
                        className="text-slate-500 hover:text-slate-800 underline cursor-pointer"
                      >
                        {t('সমাধান হয়েছে (টিকেট বন্ধ করুন)', 'Mark Resolved (Close Ticket)')}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 8: SECURITY & PRIVACY */}
          {activeTab === 'security' && (
            <div className="space-y-8 max-w-lg">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await changePassword(currPass, newPass);
                    setCurrPass('');
                    setNewPass('');
                    setFeedback(
                      t(
                        'পাসওয়ার্ড সফলভাবে পরিবর্তিত হয়েছে।',
                        'Password updated successfully.'
                      )
                    );
                  } catch (err) {
                    setFeedback(
                      err instanceof Error && !err.message.includes('Firebase:')
                        ? err.message
                        : t(
                            'পাসওয়ার্ড পরিবর্তনে সমস্যা হয়েছে। বর্তমান পাসওয়ার্ডটি সঠিকভাবে লিখে আবার চেষ্টা করুন।',
                            'Could not update password. Please verify your current password and try again.'
                          )
                    );
                  }
                }}
                className="space-y-3"
              >
                <h2 className="text-base font-bold text-slate-900">
                  {t('পাসওয়ার্ড পরিবর্তন', 'Change Password')}
                </h2>
                <input
                  type="password"
                  required
                  value={currPass}
                  onChange={(e) => setCurrPass(e.target.value)}
                  placeholder={t('বর্তমান পাসওয়ার্ড', 'Current Password')}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs"
                />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder={t('নতুন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)', 'New Password (min 6 characters)')}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs"
                />
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#146c43] text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  {t('পাসওয়ার্ড আপডেট করুন', 'Update Password')}
                </button>
              </form>

              <div className="pt-5 border-t border-slate-200 space-y-3 text-xs">
                <h3 className="text-sm font-bold text-red-700">
                  {t('একাউন্ট ডিলিট অনুরোধ (Privacy & Deletion)', 'Account Deletion Request (Privacy)')}
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  {t(
                    'আপনার ব্যক্তিগত তথ্য কেবল আপনার নিজস্ব একাউন্টে সীমাবদ্ধ। আপনি একাউন্ট মুছে ফেলতে চাইলে নিচে DELETE লিখে অনুরোধ জমা দিন।',
                    'Your personal data is strictly isolated to your own account. Type DELETE below to request permanent account deletion.'
                  )}
                </p>
                {userPublic?.accountDeletionRequested ? (
                  <p className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-semibold">
                    {t(
                      'আপনার একাউন্ট ডিলিট অনুরোধ ইতিমধ্যে গৃহীত হয়েছে এবং অ্যাডমিন প্রসেসিংয়ে রয়েছে।',
                      'Your account deletion request has been received and is queued for processing.'
                    )}
                  </p>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={confirmDeleteText}
                      onChange={(e) => setConfirmDeleteText(e.target.value)}
                      placeholder={t('নিশ্চিত করতে DELETE লিখুন', 'Type DELETE to confirm')}
                      className="px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    />
                    <button
                      type="button"
                      disabled={confirmDeleteText !== 'DELETE'}
                      onClick={async () => {
                        await requestCustomerAccountDeletion(user.uid);
                        setFeedback(
                          t(
                            'একাউন্ট মুছে ফেলার অনুরোধ জমা হয়েছে।',
                            'Account deletion request submitted.'
                          )
                        );
                      }}
                      className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg disabled:opacity-40 cursor-pointer"
                    >
                      {t('অনুরোধ পাঠান', 'Submit Request')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  Bell,
  FileText,
  Heart,
  HelpCircle,
  Lock,
  MapPin,
  Package,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { SEOHead } from '../components/SEOHead';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useStore } from '../contexts/StoreContext';
import { db } from '../lib/firebase';
import { formatTaka, isValidBangladeshPhone } from '../lib/validation';
import {
  closeCustomerSupportTicket,
  createSupportTicket,
  deleteDeliveryAddress,
  getPrivatePrescriptionDownloadUrl,
  markNotificationAsRead,
  requestCustomerAccountDeletion,
  saveDeliveryAddress,
  updateCustomerProfileDetails,
  updatePrescriptionAdditionalInfo,
} from '../services/pharmacyService';
import type {
  DeliveryAddress,
  DeliveryZone,
  NotificationItem,
  Order,
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

export function AccountPage() {
  const {
    user,
    userPublic,
    userPrivate,
    isAuthReady,
    changePassword,
    logout,
  } = useAuth();
  const { catalogProducts, siteSettings } = useStore();
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = (searchParams.get('tab') as AccountTab) || 'profile';

  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [defaultZone, setDefaultZone] = useState<DeliveryZone>('inside_dhaka');

  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
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

  useEffect(() => {
    if (userPublic) setDisplayName(userPublic.displayName);
    if (userPrivate) {
      setPhone(userPrivate.phone);
      setDefaultZone(userPrivate.defaultZone);
    }
  }, [userPublic, userPrivate]);

  // Isolated per-customer Firestore subscriptions
  useEffect(() => {
    if (!user) return;
    const uid = user.uid;

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
      (s) =>
        setOrders(
          s.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<Order, 'id'>) }))
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
        ),
      () => {}
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
  }, [user]);

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
          <p className="text-xs text-slate-500">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
        >
          {t('লগআউট', 'Logout')}
        </button>
      </div>

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
          {/* TAB 1: PROFILE */}
          {activeTab === 'profile' && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (phone && !isValidBangladeshPhone(phone)) {
                  setFeedback(
                    t(
                      'সঠিক বাংলাদেশী মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)।',
                      'Please enter a valid 11-digit Bangladesh mobile number (e.g., 017XXXXXXXX).'
                    )
                  );
                  return;
                }
                await updateCustomerProfileDetails({
                  uid: user.uid,
                  displayName,
                  email: user.email || '',
                  phone,
                  defaultZone,
                });
                setFeedback(
                  t('প্রোফাইল সফলভাবে সংরক্ষিত হয়েছে।', 'Profile updated successfully.')
                );
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
                  onChange={(e) => setDisplayName(e.target.value)}
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
                  onChange={(e) => setPhone(e.target.value)}
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
                  onChange={(e) => setDefaultZone(e.target.value as DeliveryZone)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="inside_dhaka">{t('ঢাকার ভেতরে', 'Inside Dhaka')}</option>
                  <option value="outside_dhaka">{t('ঢাকার বাইরে', 'Outside Dhaka')}</option>
                </select>
              </div>
              <button
                type="submit"
                className="px-6 py-2.5 bg-[#146c43] hover:bg-[#0f5435] text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                {t('পরিবর্তন সংরক্ষণ করুন', 'Save Changes')}
              </button>
            </form>
          )}

          {/* TAB 2: ORDERS */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900">
                {t('অর্ডার হিস্ট্রি', 'Order History')}
              </h2>
              {orders.length === 0 ? (
                <p className="text-xs text-slate-500">
                  {t('আপনার এখনো কোনো অর্ডার নেই।', 'You have not placed any orders yet.')}
                </p>
              ) : (
                <div className="space-y-3">
                  {orders.map((ord) => (
                    <div
                      key={ord.id}
                      className="p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="text-xs space-y-1">
                        <p className="text-sm font-bold text-slate-900">#{ord.orderNumber}</p>
                        <p className="text-slate-600">
                          {t('অবস্থা:', 'Status:')} <strong>{ord.status}</strong> ·{' '}
                          {t('পেমেন্ট:', 'Payment:')} {ord.paymentMethod.toUpperCase()} (
                          {ord.paymentStatus})
                        </p>
                        <p className="text-slate-500">
                          {t('ঠিকানা:', 'Address:')} {ord.area}, {ord.district}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-base font-extrabold text-[#0f5435] tabular-nums">
                          {formatTaka(ord.totalAmount)}
                        </span>
                        <Link
                          to={`/track-order/${ord.id}`}
                          className="px-3.5 py-2 bg-[#edf6f1] hover:bg-[#dceee4] text-[#0f5435] text-xs font-bold rounded-lg"
                        >
                          {t('বিস্তারিত ও ট্র্যাকিং', 'Details & Tracking')}
                        </Link>
                      </div>
                    </div>
                  ))}
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
                      err instanceof Error
                        ? err.message
                        : t(
                            'পাসওয়ার্ড পরিবর্তনে সমস্যা হয়েছে (Google একাউন্টের ক্ষেত্রে পাসওয়ার্ড Google থেকে নিয়ন্ত্রিত)।',
                            'Could not update password (for Google Sign-In accounts, passwords are managed via Google).'
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

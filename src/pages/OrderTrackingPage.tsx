import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  CheckCircle2,
  Clock,
  Package,
  Search,
  Truck,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ResilientImage } from '../components/ResilientImage';
import { SEOHead } from '../components/SEOHead';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useStore } from '../contexts/StoreContext';
import { db } from '../lib/firebase';
import { formatTaka } from '../lib/validation';
import {
  fetchOrderWithItems,
  requestOrderCancellation,
} from '../services/pharmacyService';
import type { Order, OrderItem, OrderStatus } from '../types/pharmacy';

const STANDARD_STEPS: OrderStatus[] = [
  'Pending',
  'Confirmed',
  'Processing',
  'Ready for Dispatch',
  'Shipped',
  'Delivered',
];

export function OrderTrackingPage() {
  const { orderId: routeOrderId } = useParams<{ orderId?: string }>();
  const [searchParams] = useSearchParams();
  const isNewlyConfirmed = searchParams.get('confirmed') === '1';

  const { user } = useAuth();
  const { siteSettings } = useStore();
  const { t } = useLanguage();

  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>(routeOrderId || '');
  const [searchNumber, setSearchNumber] = useState('');
  const [orderDetail, setOrderDetail] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [cancelReason, setCancelReason] = useState('');
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelFeedback, setCancelFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (routeOrderId) setSelectedOrderId(routeOrderId);
  }, [routeOrderId]);

  // Real-time listener on authenticated customer's own orders
  useEffect(() => {
    if (!user) {
      setMyOrders([]);
      return;
    }

    const q = query(collection(db, 'orders'), where('userId', '==', user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const loaded = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Order, 'id'>) }))
          .sort((a, b) => {
            const ta = a.createdAt?.seconds || 0;
            const tb = b.createdAt?.seconds || 0;
            return tb - ta;
          });
        setMyOrders(loaded);
        if (!selectedOrderId && loaded.length > 0) {
          setSelectedOrderId(loaded[0].id);
        }
      },
      () => {}
    );

    return () => unsub();
  }, [user, selectedOrderId]);

  // Fetch selected order + verified items
  useEffect(() => {
    if (!user || !selectedOrderId) {
      setOrderDetail(null);
      setOrderItems([]);
      return;
    }

    let active = true;
    setLoadingDetail(true);
    fetchOrderWithItems(selectedOrderId, user.uid)
      .then((res) => {
        if (!active) return;
        if (res) {
          setOrderDetail(res.order);
          setOrderItems(res.items);
        } else {
          setOrderDetail(null);
          setOrderItems([]);
        }
        setLoadingDetail(false);
      })
      .catch(() => {
        if (active) setLoadingDetail(false);
      });

    return () => {
      active = false;
    };
  }, [user, selectedOrderId, myOrders]);

  const handleSearchByOrderNumber = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = searchNumber.trim().toUpperCase();
    if (!cleaned) return;
    const found = myOrders.find(
      (o) => o.orderNumber.toUpperCase() === cleaned || o.id.toUpperCase() === cleaned
    );
    if (found) {
      setSelectedOrderId(found.id);
    }
  };

  const handleRequestCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderDetail) return;
    try {
      await requestOrderCancellation(orderDetail.id, cancelReason);
      setCancelModalOpen(false);
      setCancelReason('');
      setCancelFeedback(
        t('আপনার অর্ডার বাতিলের অনুরোধ জমা হয়েছে।', 'Your order cancellation request has been submitted.')
      );
    } catch (err) {
      setCancelFeedback(
        err instanceof Error
          ? err.message
          : t('অনুরোধ পাঠানো যায়নি।', 'Could not submit cancellation request.')
      );
    }
  };

  const canRequestCancellation = Boolean(
    orderDetail &&
      (orderDetail.status === 'Pending' || orderDetail.status === 'Awaiting Review') &&
      !orderDetail.cancellationRequested
  );

  const activeStepIndex = orderDetail
    ? orderDetail.status === 'Awaiting Review'
      ? 0
      : STANDARD_STEPS.indexOf(orderDetail.status)
    : -1;

  const translateStep = (step: OrderStatus): string => {
    switch (step) {
      case 'Pending':
        return t('অপেক্ষমাণ (Pending)', 'Pending');
      case 'Confirmed':
        return t('নিশ্চিতকৃত (Confirmed)', 'Confirmed');
      case 'Processing':
        return t('প্রস্তুত হচ্ছে (Processing)', 'Processing');
      case 'Ready for Dispatch':
        return t('ডিসপ্যাচ প্রস্তুত', 'Ready for Dispatch');
      case 'Shipped':
        return t('পথে রয়েছে (Shipped)', 'Shipped');
      case 'Delivered':
        return t('ডেলিভারি সম্পন্ন', 'Delivered');
      default:
        return step;
    }
  };

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-8">
      <SEOHead
        title={`${t('অর্ডার ট্র্যাকিং', 'Order Tracking')} – ${siteSettings.brandName}`}
        description={t(
          'আপনার ফার্মেসি অর্ডারের বর্তমান অবস্থা, কুরিয়ার তথ্য ও রশিদ দেখুন।',
          'Track your pharmacy order status, courier dispatch details, and itemized receipt.'
        )}
        canonicalPath="/track-order"
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
            {t('অর্ডার ট্র্যাকিং ও কনফার্মেশন', 'Order Tracking & Confirmation')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {t(
              'গ্রাহকের গোপনীয়তা সুরক্ষার জন্য শুধুমাত্র আপনার নিজস্ব একাউন্টের অর্ডার প্রদর্শিত হয়।',
              'For customer privacy protection, only orders belonging to your signed-in account are displayed.'
            )}
          </p>
        </div>

        {user && myOrders.length > 0 && (
          <form onSubmit={handleSearchByOrderNumber} className="flex gap-2">
            <input
              type="text"
              value={searchNumber}
              onChange={(e) => setSearchNumber(e.target.value)}
              placeholder={t('অর্ডার নম্বর (যেমন: FRB-...)', 'Order Number (e.g., FRB-...)')}
              className="px-3.5 py-2 border border-slate-300 rounded-lg text-xs bg-white"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-[#146c43] text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>{t('খুঁজুন', 'Find')}</span>
            </button>
          </form>
        )}
      </div>

      {!user ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center max-w-lg mx-auto">
          <Package className="w-11 h-11 text-[#146c43] mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900 mb-1">
            {t('অর্ডার ট্র্যাক করতে সাইন ইন করুন', 'Sign In to Track Your Orders')}
          </h2>
          <p className="text-xs text-slate-600 mb-5 leading-relaxed">
            {t(
              'অন্য কোনো গ্রাহকের অর্ডার বা ব্যক্তিগত ঠিকানা যাতে কেউ দেখতে না পারে, সেজন্য অর্ডার ট্র্যাকিং আপনার ভেরিফাইড একাউন্টের সাথে সুরক্ষিত।',
              'To protect private healthcare orders and delivery addresses, order tracking is strictly bound to your authenticated account.'
            )}
          </p>
          <Link
            to="/login?redirect=/track-order"
            className="inline-block px-6 py-2.5 bg-[#146c43] text-white text-xs font-bold rounded-lg"
          >
            {t('লগইন করুন', 'Login')}
          </Link>
        </div>
      ) : myOrders.length === 0 && !loadingDetail ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <p className="text-sm font-bold text-slate-800 mb-2">
            {t('আপনার এখনো কোনো অর্ডার নেই', 'You have not placed any orders yet')}
          </p>
          <Link
            to="/products"
            className="inline-block px-5 py-2 bg-[#146c43] text-white text-xs font-semibold rounded-lg"
          >
            {t('কেনাকাটা শুরু করুন', 'Start Shopping')}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Customer Order Selector */}
          <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
            <h2 className="text-xs font-bold text-slate-500 px-2 pb-1">
              {t('আপনার সাম্প্রতিক অর্ডারসমূহ', 'Your Recent Orders')}
            </h2>
            {myOrders.map((ord) => (
              <button
                key={ord.id}
                type="button"
                onClick={() => setSelectedOrderId(ord.id)}
                className={`w-full text-left p-3 rounded-xl border transition-colors cursor-pointer ${
                  selectedOrderId === ord.id
                    ? 'border-[#146c43] bg-[#edf6f1]'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                  <span>#{ord.orderNumber}</span>
                  <span className="text-[#0f5435] tabular-nums">{formatTaka(ord.totalAmount)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-600">
                  <span>
                    {t('অবস্থা:', 'Status:')} {ord.status}
                  </span>
                  <span>{ord.paymentMethod.toUpperCase()}</span>
                </div>
              </button>
            ))}
          </aside>

          {/* Right: Live Order Tracking & Verified Receipt */}
          <div className="lg:col-span-8 space-y-5">
            {isNewlyConfirmed && orderDetail && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-xs text-emerald-950">
                <CheckCircle2 className="w-5 h-5 text-[#146c43] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold">
                    {t(
                      `ধন্যবাদ! আপনার অর্ডার #${orderDetail.orderNumber} সফলভাবে গৃহীত হয়েছে।`,
                      `Thank you! Your order #${orderDetail.orderNumber} has been received.`
                    )}
                  </p>
                  <p className="mt-0.5">
                    {orderDetail.requiresPrescription
                      ? t(
                          'আপনার সংযুক্ত প্রেসক্রিপশনটি ফার্মাসিস্ট রিভিউয়ের পর ডিসপ্যাচ প্রক্রিয়া শুরু হবে।',
                          'Dispatch will begin once a licensed pharmacist reviews your attached prescription.'
                        )
                      : t(
                          'অ্যাডমিন প্যানেল থেকে অর্ডার স্ট্যাটাস আপডেট হলে এখানে রিয়েল-টাইমে দেখতে পাবেন।',
                          'Order status updates from the Admin Panel will appear here in real time.'
                        )}
                  </p>
                </div>
              </div>
            )}

            {cancelFeedback && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                {cancelFeedback}
              </div>
            )}

            {loadingDetail || !orderDetail ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-500">
                {t('অর্ডারের তথ্য লোড হচ্ছে...', 'Loading order details...')}
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200">
                  <div>
                    <p className="text-xs text-slate-500">{t('অর্ডার নম্বর', 'Order Number')}</p>
                    <h2 className="text-lg font-extrabold text-slate-900">
                      #{orderDetail.orderNumber}
                    </h2>
                    <p className="text-xs text-slate-600 mt-1">
                      {t('বর্তমান স্ট্যাটাস:', 'Current Status:')}{' '}
                      <strong className="text-[#146c43]">{orderDetail.status}</strong> ·{' '}
                      {t('পেমেন্ট:', 'Payment:')}{' '}
                      <strong>
                        {orderDetail.paymentMethod.toUpperCase()} ({orderDetail.paymentStatus})
                      </strong>
                    </p>
                  </div>

                  {canRequestCancellation && (
                    <button
                      type="button"
                      onClick={() => setCancelModalOpen(true)}
                      className="px-3.5 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold cursor-pointer"
                    >
                      {t('অর্ডার বাতিলের অনুরোধ', 'Request Cancellation')}
                    </button>
                  )}
                </div>

                {/* Status Timeline */}
                {orderDetail.status === 'Cancelled' ||
                orderDetail.status === 'Refund Pending' ||
                orderDetail.status === 'Refunded' ? (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3 text-xs text-red-800">
                    <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                    <span>
                      {t('অর্ডারের বর্তমান অবস্থা:', 'Current Order Status:')} {orderDetail.status}
                    </span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                    {STANDARD_STEPS.map((step, idx) => {
                      const completed = idx <= activeStepIndex;
                      const label =
                        idx === 0 && orderDetail.status === 'Awaiting Review'
                          ? t('প্রেসক্রিপশন যাচাই', 'Awaiting Rx Review')
                          : translateStep(step);
                      return (
                        <div
                          key={step}
                          className={`p-2.5 rounded-xl border text-center text-[11px] font-semibold ${
                            completed
                              ? 'border-[#146c43] bg-[#edf6f1] text-[#0f5435]'
                              : 'border-slate-200 text-slate-400'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5 mx-auto mb-1" />
                          <span>{label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {orderDetail.cancellationRequested && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                    {t('বাতিলের অনুরোধ প্রেরিত হয়েছে:', 'Cancellation Request Submitted:')} &ldquo;
                    {orderDetail.cancellationReason}&rdquo;
                  </div>
                )}

                {/* Courier Reference (Only displayed if genuinely provided by Admin) */}
                {(orderDetail.courierName || orderDetail.trackingReference) && (
                  <div className="p-4 rounded-xl bg-[#f4faf6] border border-emerald-900/10 flex items-center gap-3 text-xs text-slate-800">
                    <Truck className="w-5 h-5 text-[#146c43] shrink-0" />
                    <div>
                      <p className="font-bold">
                        {t('কুরিয়ার ও শিপমেন্ট তথ্য', 'Courier & Shipment Information')}
                      </p>
                      <p className="mt-0.5">
                        {orderDetail.courierName &&
                          `${t('কুরিয়ার:', 'Courier:')} ${orderDetail.courierName}`}{' '}
                        {orderDetail.trackingReference &&
                          `· ${t('ট্র্যাকিং রেফারেন্স:', 'Tracking Ref:')} ${orderDetail.trackingReference}`}
                      </p>
                    </div>
                  </div>
                )}

                {/* Verified Items Snapshot */}
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-3">
                    {t('অর্ডারকৃত পণ্যসমূহ', 'Ordered Items')}
                  </h3>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {orderItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 flex items-center justify-between gap-3 bg-white text-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded bg-[#f6faf7] shrink-0 overflow-hidden">
                            <ResilientImage
                              src={item.imageUrl}
                              alt={item.productName}
                              className="w-full h-full object-contain p-1"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate">{item.productName}</p>
                            <p className="text-slate-500 tabular-nums">
                              {formatTaka(item.unitPrice)} × {item.quantity}
                            </p>
                          </div>
                        </div>
                        <span className="font-bold text-slate-900 tabular-nums">
                          {formatTaka(item.lineTotal)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Delivery & Price Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs">
                  <div className="p-4 rounded-xl bg-slate-50 space-y-1 text-slate-600">
                    <p className="font-bold text-slate-900 mb-1">
                      {t('ডেলিভারি ঠিকানা', 'Delivery Address')}
                    </p>
                    <p>{orderDetail.customerName}</p>
                    <p className="tabular-nums">{orderDetail.customerPhone}</p>
                    <p>
                      {orderDetail.deliveryAddress}, {orderDetail.area}, {orderDetail.district}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 space-y-1.5 text-slate-600">
                    <div className="flex justify-between">
                      <span>{t('সাবটোটাল', 'Subtotal')}</span>
                      <span className="font-semibold text-slate-900 tabular-nums">
                        {formatTaka(orderDetail.subtotal)}
                      </span>
                    </div>
                    {orderDetail.discountAmount > 0 && (
                      <div className="flex justify-between text-[#146c43]">
                        <span>{t('ছাড়', 'Discount')}</span>
                        <span className="font-semibold tabular-nums">
                          - {formatTaka(orderDetail.discountAmount)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>{t('ডেলিভারি চার্জ', 'Delivery Fee')}</span>
                      <span className="font-semibold text-slate-900 tabular-nums">
                        {formatTaka(orderDetail.deliveryFee)}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-extrabold text-slate-900">
                      <span>{t('সর্বমোট', 'Total')}</span>
                      <span className="text-[#146c43] tabular-nums">
                        {formatTaka(orderDetail.totalAmount)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cancellation Modal */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setCancelModalOpen(false)}
          />
          <form
            onSubmit={handleRequestCancel}
            className="relative z-10 w-full max-w-md bg-white rounded-2xl p-6 space-y-4 shadow-xl"
          >
            <h3 className="text-base font-bold text-slate-900">
              {t('অর্ডার বাতিলের কারণ উল্লেখ করুন', 'Specify Reason for Cancellation')}
            </h3>
            <textarea
              required
              minLength={3}
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder={t(
                'কেন অর্ডারটি বাতিল করতে চাচ্ছেন...',
                'Please describe why you wish to cancel this order...'
              )}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
              >
                {t('ফিরে যান', 'Back')}
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                {t('অনুরোধ পাঠান', 'Submit Request')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

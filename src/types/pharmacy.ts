import type { Timestamp } from 'firebase/firestore';

export type DeliveryZone = 'inside_dhaka' | 'outside_dhaka';
export type PaymentMethod = 'cod' | 'bkash' | 'nagad';
export type PaymentStatus = 'unpaid' | 'pending_verification' | 'paid' | 'refunded';

export type OrderStatus =
  | 'Pending'
  | 'Awaiting Review'
  | 'Confirmed'
  | 'Processing'
  | 'Ready for Dispatch'
  | 'Shipped'
  | 'Delivered'
  | 'Cancelled'
  | 'Refund Pending'
  | 'Refunded';

export type PrescriptionStatus = 'pending_review' | 'approved' | 'needs_info' | 'rejected';

export interface SiteSetting {
  isPublic: boolean;
  brandName: string;
  tagline: string;
  heroKicker: string;
  heroTitle: string;
  heroSubtitle: string;
  heroDescription: string;
  heroCtaText: string;
  heroImageUrl: string;
  topBarDeliveryText: string;
  topBarAuthenticText: string;
  supportPhone: string;
  supportEmail: string;
  supportHours: string;
  officeAddress: string;
  insideDhakaFee: number;
  outsideDhakaFee: number;
  freeDeliveryThreshold: number;
  codEnabled: boolean;
  bkashEnabled: boolean;
  bkashInstructions: string;
  nagadEnabled: boolean;
  nagadInstructions: string;
  aboutContent: string;
  deliveryPolicy: string;
  returnPolicy: string;
  privacyPolicy: string;
  termsConditions: string;
  updatedAt?: Timestamp | string | null;
}

export interface Category {
  id: string;
  nameBn: string;
  nameEn: string;
  slug: string;
  description: string;
  iconKey: string;
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
  featured: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface Product {
  id: string;
  name: string;
  nameBn: string;
  slug: string;
  genericName: string;
  brand: string;
  categoryId: string;
  categoryNameBn: string;
  categoryNameEn: string;
  strength: string;
  packSize: string;
  price: number;
  compareAtPrice: number;
  stockQuantity: number;
  maxOrderQuantity: number;
  sku: string;
  imageUrl: string;
  description: string;
  usageInfo: string;
  storageInfo: string;
  warningText: string;
  requiresPrescription: boolean;
  isFeatured: boolean;
  demandLabel: string;
  isActive: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface Coupon {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount: number;
  isActive: boolean;
  description: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface UserPublicProfile {
  uid: string;
  displayName: string;
  wishlistProductIds: string[];
  accountDeletionRequested: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface UserPrivateProfile {
  uid: string;
  email: string;
  phone: string;
  defaultZone: DeliveryZone;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface DeliveryAddress {
  id: string;
  userId: string;
  label: string;
  recipientName: string;
  phone: string;
  zone: DeliveryZone;
  district: string;
  area: string;
  streetAddress: string;
  isDefault: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface CartDocItem {
  userId: string;
  productId: string;
  quantity: number;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface EnrichedCartItem {
  productId: string;
  quantity: number;
  product: Product;
  lineTotal: number;
  isOutOfStock: boolean;
  exceedsMaxQuantity: boolean;
}

export interface PrescriptionReview {
  id: string;
  userId: string;
  customerName: string;
  phone: string;
  productIds: string[];
  doctorName: string;
  clinicOrHospital: string;
  prescriptionDate: string;
  storageFilePath: string;
  notes: string;
  status: PrescriptionStatus;
  pharmacistNotes: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  customerName: string;
  customerPhone: string;
  deliveryZone: DeliveryZone;
  district: string;
  area: string;
  deliveryAddress: string;
  deliveryInstructions: string;
  orderNotes: string;
  itemCount: number;
  subtotal: number;
  discountAmount: number;
  couponCode: string;
  deliveryFee: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentSenderRef: string;
  requiresPrescription: boolean;
  prescriptionId: string;
  status: OrderStatus;
  courierName: string;
  trackingReference: string;
  cancellationRequested: boolean;
  cancellationReason: string;
  idempotencyKey: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface OrderItem {
  id: string;
  orderId: string;
  userId: string;
  productId: string;
  productName: string;
  brand: string;
  packSize: string;
  imageUrl: string;
  requiresPrescription: boolean;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  createdAt?: Timestamp | null;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'order' | 'prescription' | 'support' | 'system';
  relatedId: string;
  isRead: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface SupportTicket {
  id: string;
  userId: string;
  customerName: string;
  email: string;
  phone: string;
  subject: string;
  category: 'order' | 'medicine_query' | 'delivery' | 'payment' | 'account' | 'other';
  orderNumber: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  adminReply: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

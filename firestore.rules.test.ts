/**
 * Firestore Security Rules — Dirty Dozen Verification Suite
 * Designed for execution against Firebase Local Emulator Suite (@firebase/rules-unit-testing).
 */

export interface DirtyDozenCase {
  id: string;
  title: string;
  targetPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: { uid: string; email: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TEST_CASES: DirtyDozenCase[] = [
  {
    id: 'DD-01',
    title: 'Self-Assigned Admin Escalation',
    targetPath: '/admins/attacker_uid',
    operation: 'create',
    auth: { uid: 'attacker_uid', email: 'attacker@example.com', email_verified: true },
    payload: { uid: 'attacker_uid', email: 'attacker@example.com', role: 'admin', createdAt: 'SERVER_TIMESTAMP' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-02',
    title: 'Unverified Admin Email Spoof Attack',
    targetPath: '/products/recur_1mg',
    operation: 'update',
    auth: { uid: 'spoof_uid', email: 'ahmadshorif00001@gmail.com', email_verified: false },
    payload: { price: 1 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-03',
    title: 'Customer Direct Product Price or Stock Tampering',
    targetPath: '/products/recur_1mg',
    operation: 'update',
    auth: { uid: 'cust_1', email: 'cust1@example.com', email_verified: true },
    payload: { price: 1, stockQuantity: 999 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-04',
    title: 'Cross-Customer PII Profile Read',
    targetPath: '/users/cust_2/private/profile',
    operation: 'get',
    auth: { uid: 'cust_1', email: 'cust1@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-05',
    title: 'Shadow Field Injection on User Profile',
    targetPath: '/users/cust_1',
    operation: 'create',
    auth: { uid: 'cust_1', email: 'cust1@example.com', email_verified: true },
    payload: {
      uid: 'cust_1',
      displayName: 'Customer One',
      wishlistProductIds: [],
      accountDeletionRequested: false,
      isAdmin: true,
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-06',
    title: 'Forged 1-Taka Order Item Price Against 450-Taka Product',
    targetPath: '/orders/idem_123456/items/recur_1mg',
    operation: 'create',
    auth: { uid: 'cust_1', email: 'cust1@example.com', email_verified: true },
    payload: {
      orderId: 'idem_123456',
      userId: 'cust_1',
      productId: 'recur_1mg',
      productName: 'Finesteride Recur 1Mg',
      brand: 'Beximco',
      packSize: '30 tablets',
      imageUrl: '/images/products/recur-1mg.svg',
      requiresPrescription: true,
      quantity: 1,
      unitPrice: 1,
      lineTotal: 1,
      createdAt: 'SERVER_TIMESTAMP',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-07',
    title: 'Prescription Bypass on Restricted Rx Medicine',
    targetPath: '/orders/idem_rx_bypass',
    operation: 'create',
    auth: { uid: 'cust_1', email: 'cust1@example.com', email_verified: true },
    payload: {
      idempotencyKey: 'idem_rx_bypass',
      userId: 'cust_1',
      requiresPrescription: true,
      prescriptionId: '',
      paymentStatus: 'unpaid',
      status: 'Awaiting Review',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-08',
    title: 'Client-Side Fake Paid Status on Order Creation',
    targetPath: '/orders/idem_fake_paid',
    operation: 'create',
    auth: { uid: 'cust_1', email: 'cust1@example.com', email_verified: true },
    payload: {
      idempotencyKey: 'idem_fake_paid',
      userId: 'cust_1',
      paymentMethod: 'bkash',
      paymentStatus: 'paid',
      status: 'Confirmed',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-09',
    title: 'Terminal State Order Mutation After Delivery',
    targetPath: '/orders/idem_delivered_order',
    operation: 'update',
    auth: { uid: 'cust_1', email: 'cust1@example.com', email_verified: true },
    payload: {
      cancellationRequested: true,
      cancellationReason: 'Trying to cancel after delivery',
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-10',
    title: 'Unfiltered Global Order Scraping by Customer',
    targetPath: '/orders',
    operation: 'list',
    auth: { uid: 'cust_1', email: 'cust1@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-11',
    title: 'Path ID Poisoning and Oversized Payload Exhaustion',
    targetPath: '/users/cust_1/addresses/invalid$id!poison',
    operation: 'create',
    auth: { uid: 'cust_1', email: 'cust1@example.com', email_verified: true },
    payload: {
      userId: 'cust_1',
      streetAddress: 'X'.repeat(5000),
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-12',
    title: 'Value Poisoning on Whitelisted User Update Key',
    targetPath: '/users/cust_1',
    operation: 'update',
    auth: { uid: 'cust_1', email: 'cust1@example.com', email_verified: true },
    payload: {
      displayName: true,
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
];

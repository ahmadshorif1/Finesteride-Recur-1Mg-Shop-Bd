# Finesteride Recur 1Mg Shop Bd — Shared Firebase Schema, Cloud Functions & Deployment Guide

## 1. Shared Firebase Project Connection

This **Customer Panel** connects to the exact same Firebase project (`admin-panel-5ecd8`) used by the separately hosted **Admin Panel**.

Configure `.env` (see `.env.example`) when deploying to Vercel or another Node.js host:

```env
VITE_FIREBASE_API_KEY=AIzaSyD89nsawFkbSFYK4RfefkJAatvhIiqWnPA
VITE_FIREBASE_AUTH_DOMAIN=admin-panel-5ecd8.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=admin-panel-5ecd8
VITE_FIREBASE_STORAGE_BUCKET=admin-panel-5ecd8.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=381397372094
VITE_FIREBASE_APP_ID=1:381397372094:web:2489a714b0c8f4c0b6a2ef
VITE_FIREBASE_DATABASE_ID=(default)

# Server-side AI Pharmacy Assistant (Optional on Vercel if configured in project env)
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"

# Payment Gateway Key Pair & Server Merchant Credentials (Server-Only — NEVER prefix with VITE_)
GATEWAY_KEY_PAIR=""
BKASH_APP_KEY=""
BKASH_APP_SECRET=""
NAGAD_MERCHANT_ID=""
NAGAD_MERCHANT_PRIVATE_KEY=""
```

---

## 2. Shared Firestore Collections & Field Schema

Both the **Admin Panel** and **Customer Panel** read and write using these exact collection paths and field names:

| Collection Path | Managed By | Read Access | Key Fields & Conventions |
| :--- | :--- | :--- | :--- |
| `/admins/{uid}` | Admin | Owner / Admin | `email`, `role` (`'admin'`), `createdAt`. Bootstrap admin email: `ahmadshorif00001@gmail.com`. |
| `/siteSettings/main` | Admin | Public (`isPublic == true`) | `brandName`, `tagline`, `supportPhone`, `supportEmail`, `supportHours`, `insideDhakaFee`, `outsideDhakaFee`, `freeDeliveryThreshold`, `heroBadge`, `heroTitle`, `heroSubtitle`, `heroDescription`, `heroImageUrl`, `codEnabled`, `bkashEnabled`, `nagadEnabled`, `bkashInstructions`, `nagadInstructions`, `aboutContent`, `deliveryPolicy`, `returnPolicy`, `privacyPolicy`, `termsConditions`, `officeAddress`, `isPublic` |
| `/categories/{categoryId}` (also `/Categories`) | Admin | Public (`limit <= 100` or `isActive == true`) | `slug`, `nameBn`, `nameEn` (or `name` / `title`), `description`, `iconKey`, `sortOrder`, `isActive` / `active` (treated as active unless explicitly `false`) |
| `/products/{productId}` (also `/Products`, `/medicines`) | Admin | Public (`limit <= 100` or `isActive == true`) | Auto-normalizes both Customer & Admin Panel fields (`name`/`title`/`productName`, `nameBn`, `brand`/`company`/`manufacturer`, `genericName`, `price`/`regularPrice`/`mrp`/`discountPrice`/`sellingPrice`/`offerPrice`, `stockQuantity`/`stock`/`quantity`/`inStock`, `imageUrl`/`image`/`thumbnail`/`images`, `categoryId`/`category`/`categoryName`, `isFeatured`/`isPopular`, `requiresPrescription`/`prescriptionRequired`, `isActive`/`active`/`status`) |
| `/coupons/{code}` | Admin | Public `get` (`isActive == true`) | `code`, `description`, `discountType` (`'percentage' \| 'fixed'`), `discountValue`, `minOrderAmount`, `maxDiscountAmount`, `isActive` |
| `/users/{uid}` | Customer / Admin | Owner / Admin | Non-PII profile: `uid`, `displayName`, `wishlistProductIds` (`string[]`), `accountDeletionRequested`, `createdAt`, `updatedAt` |
| `/users/{uid}/private/profile` | Customer / Admin | Owner / Admin | Isolated PII: `uid`, `email`, `phone`, `defaultZone`, `createdAt`, `updatedAt` |
| `/users/{uid}/addresses/{addressId}` | Customer | Owner / Admin | `userId`, `label`, `recipientName`, `phone`, `zone` (`'inside_dhaka' \| 'outside_dhaka'`), `district`, `area`, `streetAddress`, `isDefault`, `createdAt`, `updatedAt` |
| `/users/{uid}/cart/{productId}` | Customer | Owner only | `userId`, `productId`, `quantity`, `updatedAt` |
| `/prescriptionReviews/{rxId}` | Customer & Admin | Owner / Admin | `userId`, `customerName`, `phone`, `productIds`, `doctorName`, `clinicOrHospital`, `prescriptionDate`, `storageFilePath` (`prescriptions/{uid}/{file}`), `notes`, `status` (`'pending_review' \| 'approved' \| 'rejected' \| 'needs_info'`), `pharmacistNotes`, `createdAt`, `updatedAt` |
| `/orders/{orderId}` | Customer (Create/Cancel Req) & Admin | Owner / Admin | `orderNumber`, `userId`, `customerName`, `customerPhone`, `deliveryZone`, `district`, `area`, `deliveryAddress`, `deliveryInstructions`, `orderNotes`, `itemCount`, `subtotal`, `discountAmount`, `couponCode`, `deliveryFee`, `totalAmount`, `paymentMethod` (`'cod' \| 'bkash' \| 'nagad'`), `paymentStatus` (`'unpaid' \| 'pending_verification' \| 'paid' \| 'failed' \| 'refunded'`), `paymentSenderRef`, `requiresPrescription`, `prescriptionId`, `status`, `courierName`, `trackingReference`, `cancellationRequested`, `cancellationReason`, `idempotencyKey` (`== orderId`), `createdAt`, `updatedAt` |
| `/orders/{orderId}/items/{productId}` | Customer (Create) & Admin | Owner / Admin | `orderId`, `userId`, `productId`, `productName`, `brand`, `packSize`, `imageUrl`, `requiresPrescription`, `quantity`, `unitPrice` (enforced equal to live `/products/{productId}.price`), `lineTotal`, `createdAt` |
| `/notifications/{notifId}` | Customer / Admin | Owner / Admin | `userId`, `title`, `message`, `type` (`'order' \| 'prescription' \| 'support' \| 'system'`), `relatedId`, `isRead`, `createdAt`, `updatedAt` |
| `/supportTickets/{ticketId}` | Customer & Admin | Owner / Admin | `userId`, `customerName`, `email`, `phone`, `subject`, `category`, `orderNumber`, `message`, `status` (`'open' \| 'in_progress' \| 'resolved' \| 'closed'`), `adminReply`, `createdAt`, `updatedAt` |

---

## 3. Security Rules (`firestore.rules` & `storage.rules`)

1. **Email & Password Authentication + Email Verification**:
   - Customer accounts sign up and log in exclusively via **Email & Password** (`createUserWithEmailAndPassword` / `signInWithEmailAndPassword`) with built-in **Email Verification** (`sendEmailVerification` + live verification status check). Google Sign-In is disabled on the storefront.
2. **Zero-Trust Catalog & Pricing**:
   - Customers cannot create, update, or delete `/products`, `/categories`, `/coupons`, or `/siteSettings`.
   - When creating `/orders/{orderId}/items/{productId}`, `firestore.rules` fetches `/products/{productId}` directly inside the rule (`get(...)`) and verifies `isActive == true`, `stockQuantity >= quantity`, `unitPrice == product.price`, and `lineTotal == unitPrice * quantity`.
3. **Prescription (`Rx`) Safeguard**:
   - If an order has `requiresPrescription == true`, both `/api/checkout/validate` and `firestore.rules` verify that `/prescriptionReviews/{prescriptionId}` exists, belongs to `request.auth.uid`, and is not `rejected`, and force initial order status to `'Awaiting Review'`.
4. **Private Prescription Storage (`storage.rules`)**:
   - Prescription uploads are restricted to `/prescriptions/{userId}/{fileName}` (max 8 MB, `image/*` or `application/pdf`), readable only by `request.auth.uid == userId` or verified admins.

---

## 4. Trusted Backend & Shared Firebase Cloud Functions

### A. Built-in Server Routes (Express `server.ts` + Vercel `/api/*`)
- `POST /api/checkout/validate` (`src/server/checkoutValidationCore.ts` & `api/checkout/validate.ts`): Verifies Firebase Auth Bearer token, re-fetches live product prices, stock, coupons, delivery fees, and prescription status from Firestore, and returns a deterministic `idempotencyKey` (`ord_...`) so network retries never create duplicate orders.
- `GET /api/payment-status` (`api/payment-status.ts`): Reports active server-side payment gateway readiness without exposing merchant keys.
- `POST /api/chat` (`src/server/aiChatCore.ts` & `api/chat.ts`): Analyzes live store catalog and delivery/policy settings to answer customer questions in Bangla and English without fabricating unsupported medical claims.

### B. Shared Firebase Cloud Functions (`functions/src/index.ts`) for Atomic Inventory Reservation & Restoration
Because client browsers are strictly prohibited from mutating `/products/{productId}.stockQuantity`, deploy this Cloud Function in your shared Firebase project (`admin-panel-5ecd8`) so stock is atomically decremented on order creation and restored if an order is cancelled:

```ts
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

// 1. Atomically reserve/decrement stock when a new order is placed
export const onPharmacyOrderCreated = onDocumentCreated('orders/{orderId}', async (event) => {
  const orderId = event.params.orderId;
  const itemsSnap = await db.collection(`orders/${orderId}/items`).get();
  if (itemsSnap.empty) return;

  await db.runTransaction(async (tx) => {
    const orderRef = db.doc(`orders/${orderId}`);
    const orderDoc = await tx.get(orderRef);
    if (!orderDoc.exists || orderDoc.data()?.inventoryReserved) return;

    for (const itemDoc of itemsSnap.docs) {
      const { productId, quantity } = itemDoc.data() as { productId: string; quantity: number };
      const prodRef = db.doc(`products/${productId}`);
      const prodSnap = await tx.get(prodRef);
      if (!prodSnap.exists) continue;

      const currentStock = Number(prodSnap.data()?.stockQuantity ?? 0);
      if (currentStock < quantity) {
        tx.update(orderRef, {
          status: 'Cancelled',
          cancellationReason: 'Insufficient stock during atomic reservation',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return;
      }

      tx.update(prodRef, {
        stockQuantity: currentStock - quantity,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    tx.update(orderRef, {
      inventoryReserved: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
});

// 2. Restore stock if an order transitions to Cancelled after inventory reservation
export const onPharmacyOrderUpdated = onDocumentUpdated('orders/{orderId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;

  if (
    before.status !== 'Cancelled' &&
    after.status === 'Cancelled' &&
    after.inventoryReserved === true &&
    after.inventoryRestored !== true
  ) {
    const orderId = event.params.orderId;
    const itemsSnap = await db.collection(`orders/${orderId}/items`).get();

    await db.runTransaction(async (tx) => {
      for (const itemDoc of itemsSnap.docs) {
        const { productId, quantity } = itemDoc.data() as { productId: string; quantity: number };
        const prodRef = db.doc(`products/${productId}`);
        const prodSnap = await tx.get(prodRef);
        if (prodSnap.exists) {
          const currentStock = Number(prodSnap.data()?.stockQuantity ?? 0);
          tx.update(prodRef, {
            stockQuantity: currentStock + quantity,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }
      tx.update(db.doc(`orders/${orderId}`), {
        inventoryRestored: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
  }
});
```

---

## 5. Deployment Instructions (Vercel & Node.js)

1. **Firebase Console Setup (`admin-panel-5ecd8`)**:
   - Under **Authentication → Sign-in method**, ensure **Email/Password** is enabled.
   - Under **Authentication → Settings → Authorized domains**, ensure your Vercel hostname (e.g., `your-pharmacy.vercel.app`) is listed so email verification and password reset links work seamlessly.
   - Publish `firestore.rules` and `storage.rules` via Firebase CLI:
     ```bash
     firebase deploy --only firestore:rules,storage --project admin-panel-5ecd8
     ```
2. **Vercel Deployment**:
   - Import repository into Vercel; `vercel.json` automatically routes `/api/*` to serverless functions (`/api/checkout/validate.ts`, `/api/payment-status.ts`, `/api/chat.ts`) and serves the SPA fallback for client routes.
   - Add the environment variables from `.env.example` in **Vercel Project Settings → Environment Variables**.
3. **Self-Hosted Node.js / Cloud Run Deployment**:
   ```bash
   npm install
   npm run build
   NODE_ENV=production npm run start
   ```

---

## 6. Admin ↔ Customer Panel QA Test Checklist

- [ ] **Real-Time Catalog Sync**: Add or edit a product/price/discount in the Admin Panel (or click **Sync Reference Catalog** as admin `ahmadshorif00001@gmail.com`) → verify immediate update on Homepage & `/products`.
- [ ] **Out-of-Stock & Inactive Handling**: Set `stockQuantity: 0` or `isActive: false` on a product in Admin → verify out-of-stock badge disables cart checkout or inactive product disappears immediately.
- [ ] **Site Settings & Banner Sync**: Update `heroSubtitle`, `insideDhakaFee`, or `freeDeliveryThreshold` in `/siteSettings/main` → verify live update on Homepage, Header, Footer, and Checkout.
- [ ] **Bilingual Toggle (`বাংলা` / `EN`)**: Switch between `বাংলা` and `EN` in Header → verify navigation, homepage, filters, product details, cart, checkout, order tracking, auth, and account dashboard update cleanly.
- [ ] **Email & Password + Verification Flow**: Register with Email & Password → verify verification link is sent, test Resend + Check Verification Status, and verify login, password reset, cart sync, and checkout access.
- [ ] **Prescription (`Rx`) Safeguard**: Add an Rx item (`requiresPrescription: true`) to cart → attempt checkout without prescription → verify blocked; upload prescription via modal → verify order starts in `Awaiting Review`.
- [ ] **Authoritative Checkout & Idempotency**: Place COD and bKash/Nagad (`pending_verification`) orders → verify `/orders/{idempotencyKey}` uses catalog prices and duplicate clicks never create duplicate orders.
- [ ] **Live Order Tracking & Privacy Isolation**: Update order status (`Confirmed` → `Shipped` + courier ref) in Admin Panel → verify live timeline update on Customer `/track-order`, and confirm Customer B cannot read Customer A's orders, profile PII, or prescriptions.

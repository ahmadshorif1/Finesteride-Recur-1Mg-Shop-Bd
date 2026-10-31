# Security Specification — Finesteride Recur 1Mg Shop Bd

## 1. Data Invariants & Relationship Mapping

1. **Default-Deny Catch-All**: All unspecified paths default to `allow read, write: if false`.
2. **Admin Privilege Verification & Instant Customer Account Activation**:
   - Standard customer accounts (via Google or Email/Password, `request.auth != null && request.auth.token.firebase.sign_in_provider != 'anonymous'`) are immediately active upon sign-in/registration without requiring separate email verification links.
   - Admin status is granted ONLY if `exists(/databases/$(database)/documents/admins/$(request.auth.uid))` OR (`request.auth.token.email_verified == true && request.auth.token.email == 'ahmadshorif00001@gmail.com'`). Never trust client claims or unverified email strings for admin escalation.
3. **Catalog & Settings Integrity**: Only authorized administrators (`isAdmin()`) may create, update, or delete `/products/{productId}`, `/categories/{categoryId}`, `/siteSettings/{settingId}`, or `/coupons/{couponCode}`. Customers can ONLY read active records (`isActive == true` or `isPublic == true`).
4. **PII Split-Collection Isolation**: Customer PII (`email`, `phone`) is strictly isolated in `/users/{userId}/private/{docId}` and delivery addresses in `/users/{userId}/addresses/{addressId}`. Access is strictly restricted to `isOwner(userId) || isAdmin()`, with Master Gate verifying parent `/users/{userId}` existence.
5. **Authoritative Order & Price Enforcement**:
   - Customers cannot mark an order as `paid` (`paymentStatus` on creation must be `'unpaid'` for COD or `'pending_verification'` for mobile payment submission).
   - Every `/orders/{orderId}/items/{itemId}` creation verifies that `/products/{productId}` exists, is active, has `stockQuantity >= quantity`, and `unitPrice == product.data.price` and `lineTotal == unitPrice * quantity`.
   - Restricted prescription products (`product.data.requiresPrescription == true`) require the parent order (`getAfter`) to have `requiresPrescription == true` and a valid `prescriptionId` owned by `request.auth.uid` in `/prescriptionReviews/{prescriptionId}`.
   - Order IDs must match `idempotencyKey` (`orderId == incoming().idempotencyKey`) to prevent duplicate orders on retry.
6. **Terminal State Locking**: Orders in terminal states (`Delivered`, `Cancelled`, `Refunded`) and Support Tickets in `'closed'` state cannot be modified by customers. Customers can only request cancellation (`cancellationRequested`, `cancellationReason`, `updatedAt`) while an order is in `Pending` or `Awaiting Review`.
7. **Temporal Integrity**: Every `createdAt` on create and `updatedAt` on update must equal `request.time`. Immutable fields (`uid`, `userId`, `orderId`, `createdAt`) cannot change during updates.

---

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return `PERMISSION_DENIED`)

1. **Payload 01 — Self-Assigned Admin Escalation**: Authenticated customer attempts `setDoc('/admins/attacker_uid', { uid: 'attacker_uid', email: 'attacker@example.com', role: 'admin', createdAt: serverTimestamp() })`.
2. **Payload 02 — Unverified Email Spoof Attack**: Attacker signs up with unverified email matching `'ahmadshorif00001@gmail.com'` (`email_verified: false`, not in `/admins/{uid}`) and attempts to write to `/products/prod_1`.
3. **Payload 03 — Product Price / Stock Tampering by Customer**: Verified customer attempts `updateDoc('/products/recur-1mg', { price: 1, stockQuantity: 9999 })`.
4. **Payload 04 — Cross-Customer PII Blanket Read**: Customer A (`uid_a`) attempts `getDoc('/users/uid_b/private/profile')` or `getDocs('/users/uid_b/addresses')`.
5. **Payload 05 — Shadow Field Injection on User Profile**: Customer A attempts `setDoc('/users/uid_a', { ..., isAdmin: true, role: 'superadmin' })`.
6. **Payload 06 — Forged 1-Taka Order Line Item**: Customer creates `/orders/ord_1/items/recur-1mg` with `unitPrice: 1` while `/products/recur-1mg` has authoritative `price: 450`.
7. **Payload 07 — Prescription Bypass on Restricted Medicine**: Customer creates order item for `/products/recur-1mg` (`requiresPrescription: true`) linked to an order with `requiresPrescription: false, prescriptionId: ''`.
8. **Payload 08 — Client-Side Fake Paid Status**: Customer creates `/orders/ord_2` with `paymentStatus: 'paid'` or `status: 'Delivered'`.
9. **Payload 09 — Terminal State Mutation**: Customer attempts to update `/orders/ord_delivered` (`status: 'Delivered'`) to request cancellation or alter delivery address.
10. **Payload 10 — Unauthorized Order List Scraping (Query Enforcer Test)**: Customer A executes an unfiltered `getDocs(collection(db, 'orders'))` attempting to read all customer orders without `where('userId', '==', 'uid_a')`.
11. **Payload 11 — Path ID Poisoning / Resource Exhaustion**: Attacker attempts to create `/users/uid_a/addresses/bad$id!with/slashes` or a 200-char junk ID, or injects a 10,000-character `streetAddress`.
12. **Payload 12 — Value Poisoning on Allowed Update Key**: Customer updates `/users/uid_a` whitelisted field `displayName` with a boolean `true` or mutates immutable `createdAt`.

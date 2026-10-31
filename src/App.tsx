/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { CartDrawer } from './components/CartDrawer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { PharmacyChatbot } from './components/PharmacyChatbot';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { StoreProvider } from './contexts/StoreContext';
import { AccountPage } from './pages/AccountPage';
import { AuthPage } from './pages/AuthPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { HomePage } from './pages/HomePage';
import { OrderTrackingPage } from './pages/OrderTrackingPage';
import { ProductDetailsPage } from './pages/ProductDetailsPage';
import { ProductsPage } from './pages/ProductsPage';
import {
  AboutPage,
  BrandsPage,
  ContactPage,
  OffersPage,
  PolicyPage,
} from './pages/StoreInfoPages';

function FirebaseAuthActionBridge() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname === '/' && location.search.includes('oobCode=')) {
      const params = new URLSearchParams(location.search);
      const mode = params.get('mode');
      if (mode === 'resetPassword' || mode === 'verifyEmail') {
        navigate(`/login${location.search}`, { replace: true });
      }
    }
  }, [location.pathname, location.search, navigate]);

  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <LanguageProvider>
          <StoreProvider>
            <CartProvider>
              <BrowserRouter>
                <FirebaseAuthActionBridge />
                <div className="min-h-screen flex flex-col bg-[#f8faf9] text-slate-900">
                  <Header />

                <main className="flex-1">
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/products" element={<ProductsPage />} />
                    <Route path="/product/:slug" element={<ProductDetailsPage />} />
                    <Route path="/cart" element={<CartPage />} />
                    <Route path="/checkout" element={<CheckoutPage />} />
                    <Route path="/login" element={<AuthPage />} />
                    <Route path="/register" element={<AuthPage />} />
                    <Route path="/forgot-password" element={<AuthPage />} />
                    <Route path="/account" element={<AccountPage />} />
                    <Route path="/track-order" element={<OrderTrackingPage />} />
                    <Route path="/track-order/:orderId" element={<OrderTrackingPage />} />
                    <Route path="/brands" element={<BrandsPage />} />
                    <Route path="/offers" element={<OffersPage />} />
                    <Route path="/about" element={<AboutPage />} />
                    <Route path="/contact" element={<ContactPage />} />
                    <Route path="/policy/:policyType" element={<PolicyPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </main>

                <Footer />
                <CartDrawer />
                <PharmacyChatbot />
              </div>
            </BrowserRouter>
          </CartProvider>
        </StoreProvider>
        </LanguageProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

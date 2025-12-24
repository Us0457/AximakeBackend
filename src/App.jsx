import React, { useEffect } from 'react';
    import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
    import Layout from '@/components/Layout';
    import HomePage from '@/pages/HomePage';
    import CustomPrintPage from '@/pages/CustomPrintPage';
    import CheckoutPage from '@/pages/CheckoutPage';
    import DashboardPage from '@/pages/DashboardPage';
    import AdminPanelPage from '@/pages/AdminPanelPage';
    import AuthPage from '@/pages/AuthPage';
    import CartPage from '@/pages/CartPage';
    import PrivacyPolicyPage from '@/pages/PrivacyPolicyPage';
    import TermsAndConditionsPage from '@/pages/TermsAndConditionsPage';
    import { Toaster } from '@/components/ui/toaster';
    import { AuthProvider } from '@/contexts/AuthContext';
    import CustomerManagementPage from '@/pages/admin/CustomerManagementPage';
    import ProductManagementPage from '@/pages/admin/ProductManagementPage';
    import OrderManagementPage from '@/pages/admin/OrderManagementPage';
    import PaymentManagementPage from '@/pages/admin/PaymentManagementPage';
    import DiscountsManagementPage from '@/pages/admin/DiscountsManagementPage';
    import StoreSettingsPage from '@/pages/admin/StoreSettingsPage';
    import PersonalInfoPage from '@/pages/PersonalInfoPage';
    import SavedAddressesPage from '@/pages/SavedAddressesPage';
    import YourQuotesPage from '@/pages/YourQuotesPage';
    import WishlistPage from '@/pages/WishlistPage';
    import PaymentsCardsPage from '@/pages/PaymentsCardsPage';
    import ProductDetailPage from '@/pages/ProductDetailPage';
    import ProductGalleryPage from '@/pages/ProductGalleryPage';
    import ElectronicsGalleryPage from '@/pages/ElectronicsGalleryPage';
    import ElectronicsKitDetailPage from '@/pages/ElectronicsKitDetailPage';
    import ThankYouPage from '@/pages/ThankYouPage';
    import UserOrdersPage from '@/pages/UserOrdersPage';
    import CustomPrintSettingsPage from '@/pages/CustomPrintSettingsPage';
    import AdminSettingsPage from '@/pages/AdminSettingsPage';
    import ReviewForm from '@/pages/ReviewForm';
    import ProductReviewsPage from '@/pages/ProductReviewsPage';
    import SupportForumPage from '@/pages/SupportForumPage';
    import SupportThreadPage from '@/pages/SupportThreadPage';
    import CouponsManagementPage from '@/pages/admin/CouponsManagementPage';
    import './index.css';

    function ScrollToTop() {
      const location = useLocation();
      useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      }, [location.pathname]);
      return null;
    }

    function App() {
      // Place Zoho SalesIQ Live Chat widget
      useEffect(() => {
        if (document.getElementById('zsiqscript')) return;
        const zohoScript1 = document.createElement('script');
        zohoScript1.innerHTML = "window.$zoho=window.$zoho || {}; $zoho.salesiq=$zoho.salesiq||{ready:function(){}}";
        document.body.appendChild(zohoScript1);
        const zohoScript2 = document.createElement('script');
        zohoScript2.id = 'zsiqscript';
        zohoScript2.src = 'https://salesiq.zohopublic.in/widget?wc=siq16d5d0f8ca48bf0d24c18489b220aae81529c2527a907be913ae26d60b373179';
        zohoScript2.defer = true;
        document.body.appendChild(zohoScript2);

        // Tawk.to Live Chat (uncomment to enable)
        /*
        if (!document.getElementById('tawkto-script')) {
          var Tawk_API = window.Tawk_API || {}, Tawk_LoadStart = new Date();
          var s1 = document.createElement('script');
          s1.id = 'tawkto-script';
          s1.async = true;
          s1.src = 'https://embed.tawk.to/684b9e7f4b5a53190afc625f/1itjm692t';
          s1.charset = 'UTF-8';
          s1.setAttribute('crossorigin', '*');
          var s0 = document.getElementsByTagName('script')[0];
          s0.parentNode.insertBefore(s1, s0);
        }
        */
      }, []);

      return (
        <AuthProvider>
          <Router>
            <ScrollToTop />
            <Layout>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/custom-print" element={<CustomPrintPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/admin" element={<AdminPanelPage />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/cart" element={<CartPage />} />
                <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
                <Route path="/terms-and-conditions" element={<TermsAndConditionsPage />} />
                <Route path="/admin/customers" element={<CustomerManagementPage />} />
                <Route path="/admin/products" element={<ProductManagementPage />} />
                <Route path="/admin/orders" element={<OrderManagementPage />} />
                <Route path="/admin/payments" element={<PaymentManagementPage />} />
                <Route path="/admin/discounts" element={<DiscountsManagementPage />} />
                <Route path="/admin/settings" element={<CustomPrintSettingsPage />} />
                <Route path="/dashboard/personal" element={<PersonalInfoPage />} />
                <Route path="/dashboard/addresses" element={<SavedAddressesPage />} />
                <Route path="/dashboard/quotes" element={<YourQuotesPage />} />
                <Route path="/dashboard/wishlist" element={<WishlistPage />} />
                <Route path="/dashboard/payments" element={<PaymentsCardsPage />} />
                <Route path="/dashboard/orders" element={<UserOrdersPage />} />
                <Route path="/product/:id" element={<ProductDetailPage />} />
                <Route path="/products/:id" element={<ProductDetailPage />} />
                <Route path="/products" element={<ProductGalleryPage />} />
                <Route path="/kits" element={<ElectronicsGalleryPage />} />
                <Route path="/kit/:id" element={<ElectronicsKitDetailPage />} />
                <Route path="/thank-you" element={<ThankYouPage />} />
                <Route path="/admin/custom-print-settings" element={<CustomPrintSettingsPage />} />
                <Route path="/review/:orderId/:productId" element={<ReviewForm />} />
                <Route path="/product/:id/reviews" element={<ProductReviewsPage />} />
                <Route path="/support/forum" element={<SupportForumPage />} />
                <Route path="/support/forum/:id" element={<SupportThreadPage />} />
                <Route path="/admin/coupons" element={<CouponsManagementPage />} />
              </Routes>
            </Layout>
            <Toaster />
          </Router>
        </AuthProvider>
      );
    }

    export default App;
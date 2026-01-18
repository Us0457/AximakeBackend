import React from 'react';
    import Header from '@/components/Header';
    import HeroCarousel from '@/components/HeroCarousel';
    import DiscountBanners from '@/components/DiscountBanners';
    import { useLocation } from 'react-router-dom';
    import Footer from '@/components/Footer';

    const Layout = ({ children }) => {
      const location = useLocation();
      const isHome = location && location.pathname === '/';
      return (
        <div className="flex flex-col min-h-screen bg-gradient-to-br from-background to-secondary/30">
            <Header />
            {/* Render discount banners and the full-width hero carousel only on the home page (path === '/')
              Placing banners here ensures they sit immediately below the navbar, above the hero/Shop sections. */}
            {isHome && <DiscountBanners />}
            {isHome && <HeroCarousel />}
            {/* Dev probe removed */}
          <main className={`flex-grow container mx-auto px-2 sm:px-4 lg:px-2 py-8 ${isHome ? 'min-h-screen' : ''}`}>
            {children ?? (isHome ? <div className="min-h-screen" /> : null)}
          </main>
          <Footer />
        </div>
      );
    };

    export default Layout;
import React from 'react';
    import Header from '@/components/Header';
    import HeroCarousel from '@/components/HeroCarousel';
    import { useLocation } from 'react-router-dom';
    import Footer from '@/components/Footer';

    const Layout = ({ children }) => {
      const location = useLocation();
      const isHome = location && location.pathname === '/';
      return (
        <div className="flex flex-col min-h-screen bg-gradient-to-br from-background to-secondary/30">
            <Header />
            {/* Render the full-width hero carousel only on the home page (path === '/')
              Placing it here ensures it sits immediately below the navbar and
              doesn't affect other pages or layouts. */}
            {isHome && <HeroCarousel />}
            {/* Dev probe removed */}
          <main className={`flex-grow container mx-auto px-4 py-8 ${isHome ? 'min-h-screen' : ''}`}>
            {children ?? (isHome ? <div className="min-h-screen" /> : null)}
          </main>
          <Footer />
        </div>
      );
    };

    export default Layout;
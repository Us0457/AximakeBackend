import React from 'react';
    import Header from '@/components/Header';
    import Footer from '@/components/Footer';

    const Layout = ({ children }) => {
      return (
        <div className="flex flex-col min-h-screen bg-gradient-to-br from-background to-secondary/30">
          <Header />
          <main className="flex-grow container mx-auto px-4 py-8">{children}</main>
          <Footer />
        </div>
      );
    };

    export default Layout;
import React, { useEffect, useState } from 'react';
    import { supabase } from '@/lib/supabaseClient';
    // HeroSection has been migrated into the site-wide HeroCarousel (Home-only)
    import BusinessOverview from '@/components/home/BusinessOverview';
    import Categories from '@/components/home/Categories';
    import HowItWorks from '@/components/home/HowItWorks';
    import TypesOfPrinting from '@/components/home/TypesOfPrinting';
    import FeaturedProducts from '@/components/home/FeaturedProducts';
    import Testimonials from '@/components/home/Testimonials';
    import AboutUs from '@/components/home/AboutUs';
    import MeetOurTeam from '@/components/home/MeetOurTeam';
    import FAQs from '@/components/home/FAQs';
    import ContactFormSection from '@/components/home/ContactFormSection';
    import { useLocation } from 'react-router-dom';
    import ShopSection from '@/components/home/ShopSection';

    const HomePage = () => {
      const location = useLocation();
      useEffect(() => {
        if (location.state && location.state.scrollTo) {
          setTimeout(() => {
            const el = document.getElementById(location.state.scrollTo);
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }
      }, [location.state]);
      // SEO: set page title
      useEffect(() => {
        document.title = 'Home — Aximake';
      }, []);
      // SEO: set meta description
      useEffect(() => {
        const desc = 'Aximake — custom 3D printing, electronics kits, and maker supplies.';
        let m = document.querySelector('meta[name="description"]');
        if (!m) { m = document.createElement('meta'); m.name = 'description'; document.head.appendChild(m); }
        m.content = desc.slice(0, 160);
      }, []);
  
  
      return (
        <div className="space-y-0">
          {/* Discount Banners are rendered by Layout to ensure they appear at the top */}
          {/* HeroSection removed — now rendered as the first slide inside HeroCarousel (in Layout) */}
          <Categories edgeToEdge />
           <ShopSection />
           <BusinessOverview />
          <HowItWorks />
          <TypesOfPrinting />
          <FeaturedProducts />
          <Testimonials />
          <AboutUs />
          <MeetOurTeam />
          <FAQs />
          <ContactFormSection />
        </div>
      );
    };

    export default HomePage;
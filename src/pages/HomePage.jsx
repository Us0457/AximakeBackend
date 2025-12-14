import React, { useEffect, useState } from 'react';
    import { supabase } from '@/lib/supabaseClient';
    import HeroSection from '@/components/home/HeroSection';
    import BusinessOverview from '@/components/home/BusinessOverview';
    import HowItWorks from '@/components/home/HowItWorks';
    import TypesOfPrinting from '@/components/home/TypesOfPrinting';
    import FeaturedProducts from '@/components/home/FeaturedProducts';
    import Testimonials from '@/components/home/Testimonials';
    import AboutUs from '@/components/home/AboutUs';
    import MeetOurTeam from '@/components/home/MeetOurTeam';
    import FAQs from '@/components/home/FAQs';
    import ContactFormSection from '@/components/home/ContactFormSection';
    import { useLocation } from 'react-router-dom';

    const HomePage = () => {
      const [banners, setBanners] = useState([]);
      const location = useLocation();
      useEffect(() => {
        if (location.state && location.state.scrollTo) {
          setTimeout(() => {
            const el = document.getElementById(location.state.scrollTo);
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }
      }, [location.state]);
      useEffect(() => {
        async function fetchBanners() {
          const { data } = await supabase.from('discount_banners').select('id, text, color').order('id');
          setBanners(data || []);
        }
        fetchBanners();
      }, []);
      return (
        <div className="space-y-0">
          {/* Discount Banners (full width, flush with top) */}
          {banners.length > 0 && (
            <div className="w-full">
              {banners.map(banner => (
                <div
                  key={banner.id}
                  className="w-full rounded-none shadow-none flex items-center justify-center px-0 py-1 text-white text-sm font-semibold tracking-wide relative overflow-hidden"
                  style={{ background: banner.color, minHeight: 32, margin: 0, borderRadius: 0, boxShadow: 'none' }}
                >
                  <span className="z-10 text-center w-full" style={{ textShadow: '0 1px 4px #0004' }}>{banner.text}</span>
                </div>
              ))}
            </div>
          )}
          <HeroSection />
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
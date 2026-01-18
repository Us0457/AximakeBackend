import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

function BannerDisplay({ banner }) {
  const containerRef = React.useRef(null);
  const textRef = React.useRef(null);
  const [duration, setDuration] = React.useState(10);

  React.useEffect(() => {
    if (!banner.moving) return;
    const c = containerRef.current;
    const t = textRef.current;
    if (!c || !t) return;
    const measure = () => {
      const cw = c.getBoundingClientRect().width || 0;
      const tw = t.getBoundingClientRect().width || 0;
      const speed = Number(banner.speed) || 100;
      const dist = cw + tw;
      const dur = Math.max(4, dist / Math.max(1, speed));
      setDuration(dur);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [banner.moving, banner.speed, banner.text]);

  const bg = banner.bg_color || banner.color || '#f59e42';
  const fg = banner.font_color || '#ffffff';

  return (
    <div style={{ background: bg }} className="w-full rounded-none shadow-none px-0 py-2 text-sm font-semibold tracking-wide relative overflow-hidden" aria-hidden={!banner.is_active}>
      {!banner.moving ? (
        <div className="text-center w-full" style={{ color: fg, minHeight: (banner.height || 40), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>{banner.text}</span>
        </div>
      ) : (
        <div ref={containerRef} className="w-full overflow-hidden" style={{ minHeight: (banner.height || 40) }}>
          <div
            ref={textRef}
            style={{
              display: 'inline-block',
              whiteSpace: 'nowrap',
              color: fg,
              textShadow: '0 1px 4px rgba(0,0,0,0.3)',
              paddingLeft: '100%',
              animation: `marquee ${duration}s linear infinite`
            }}
          >
            {banner.text}
          </div>
          <style>{`@keyframes marquee { from { transform: translateX(0%); } to { transform: translateX(-100%); } }`}</style>
        </div>
      )}
    </div>
  );
}

const DiscountBanners = () => {
  const [banners, setBanners] = useState([]);

  useEffect(() => {
    async function fetchBanners() {
      try {
        const { data, error } = await supabase.from('discount_banners').select('id, text, bg_color, font_color, is_active, moving, speed, "order", height').order('"order"', { ascending: true });
        if (error) throw error;
        setBanners(data || []);
      } catch (e) {
        try {
          const { data: data2 } = await supabase.from('discount_banners').select('id, text, color').order('id');
          const normalized = (data2 || []).map(r => ({ id: r.id, text: r.text, bg_color: r.color, font_color: '#ffffff', is_active: true, moving: false, speed: 100, order: r.id, height: 40 }));
          setBanners(normalized);
        } catch (e2) {
          setBanners([]);
        }
      }
    }
    fetchBanners();
  }, []);

  if (!banners || banners.filter(b => b.is_active !== false).length === 0) return null;

  return (
    <div className="w-full">
      {banners.filter(b => b.is_active !== false).map(banner => (
        <BannerDisplay key={banner.id} banner={banner} />
      ))}
    </div>
  );
};

export default DiscountBanners;

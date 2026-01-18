import React, { useEffect, useRef, useState } from 'react';
import HeroSection from '@/components/home/HeroSection';

// A responsive, accessible, auto-scrolling hero carousel.
// - Full-width edge-to-edge
// - Auto-scroll with pause on hover/interaction
// - Manual navigation (arrows + swipe)
// - Optimized for no layout shift: uses fixed heights per breakpoint

const DEFAULT_SLIDES = [
  // First slide embeds the existing HeroSection component so its styles, markup
  // and animations are preserved exactly inside the carousel.
  {
    id: 's1',
    isHeroSection: true
  },
  // {
  //   id: 's2',
  //   title: 'End-to-end Manufacturing Support',
  //   subtitle: 'Design reviews · Prototyping · Volume production',
  //   image: '/assets/hero/Hero1.png',
  //   mobilePortraitImage: '/assets/hero/HeroM1.png',
  //   ctaText: 'Explore Services',
  //   ctaLink: '/services'
  // },
  // {
  //   id: 's3',
  //   title: 'Scale With Confidence',
  //   subtitle: 'Reliable supply chain and shipping integrations',
  //   image: '/assets/hero/Hero2.png',
  //   mobilePortraitImage: '/assets/hero/HeroM2.png',
  //   ctaText: 'Contact Sales',
  //   ctaLink: '/contact'
  // },
  {
    id: 's2',
    title: 'Arduino Starter Kit',
    subtitle: 'India’s Most Thoughtfully Curated Arduino Learning Kit',
    image: '/assets/hero/Hero3.png',
    mobilePortraitImage: '/assets/hero/HeroM3.png',
    // Per-slide sizing overrides (optional)
    mobilePortraitWidth: '100%',
    mobilePortraitHeight: '62vh',
    mobilePortraitMaxHeight: '170vh',
    width: '100%',
    height: '60vh',
    ctaText: 'Contact Sales',
    ctaLink: '/contact'
  },
  {
    id: 's3',
    title: 'Customizable Kits',
    subtitle: 'India’s First Truly Customizable Electronics Starter Kit',
    image: '/assets/hero/Hero4.png',
    mobilePortraitImage: '/assets/hero/HeroM4.png',
    // Per-slide sizing overrides (optional)
    mobilePortraitWidth: '100%',
    mobilePortraitHeight: '62vh',
    mobilePortraitMaxHeight: '170vh',
    width: '100%',
    height: '60vh',
    ctaText: 'Contact Sales',
    ctaLink: '/contact'
  },
  {
    id: 's4',
    title: 'Ready-To-Print 3D Models',
    subtitle: 'Upload your CAD File and Get it 3D Printed in No Time',
    image: '/assets/hero/Hero5.png',
    mobilePortraitImage: '/assets/hero/HeroM5.png',
    // Per-slide sizing overrides (optional)
    mobilePortraitWidth: '100%',
    mobilePortraitHeight: '62vh',
    mobilePortraitMaxHeight: '170vh',
    width: '100%',
    height: '60vh',
    ctaText: 'Contact Sales',
    ctaLink: '/contact'
  },
];

const HeroCarousel = ({ slides = DEFAULT_SLIDES, interval = 5000 }) => {
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const containerRef = useRef(null);
  const autoplayRef = useRef(null);
  const touchStartX = useRef(null);
  const touchDeltaX = useRef(0);
  const [isMobilePortrait, setIsMobilePortrait] = useState(false);

  const slideCount = slides.length;

  useEffect(() => {
    startAutoplay();
    return stopAutoplay;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, isPaused]);

  // Detect mobile portrait (<=768px and portrait orientation)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 768px) and (orientation: portrait)');
    const onChange = (e) => setIsMobilePortrait(!!e.matches);
    setIsMobilePortrait(!!mq.matches);
    try {
      mq.addEventListener('change', onChange);
    } catch (e) {
      mq.addListener(onChange);
    }
    return () => {
      try { mq.removeEventListener('change', onChange); } catch (e) { mq.removeListener(onChange); }
    };
  }, []);

  function startAutoplay() {
    stopAutoplay();
    if (isPaused) return;
    autoplayRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % slideCount);
    }, interval);
  }

  function stopAutoplay() {
    if (autoplayRef.current) {
      clearInterval(autoplayRef.current);
      autoplayRef.current = null;
    }
  }

  const goPrev = () => {
    setIndex((i) => (i - 1 + slideCount) % slideCount);
    setIsPaused(true);
    stopAutoplay();
  };

  const goNext = () => {
    setIndex((i) => (i + 1) % slideCount);
    setIsPaused(true);
    stopAutoplay();
  };

  // Touch handlers for mobile swipe
  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
    setIsPaused(true);
    stopAutoplay();
  };
  const onTouchMove = (e) => {
    if (!touchStartX.current) return;
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };
  const onTouchEnd = () => {
    if (!touchStartX.current) return;
    const threshold = 50;
    if (touchDeltaX.current > threshold) goPrev();
    else if (touchDeltaX.current < -threshold) goNext();
    touchStartX.current = null;
    touchDeltaX.current = 0;
  };

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Hero carousel"
      className="w-full overflow-hidden relative"
      onMouseEnter={() => { setIsPaused(true); stopAutoplay(); }}
      onMouseLeave={() => { setIsPaused(false); startAutoplay(); }}
      ref={containerRef}
    >
      <div className="relative w-full" style={{ height: '60vh', minHeight: 320 }}>
        {slides.map((s, i) => {
          const isCurrent = i === index;
          const imgSrc = (isMobilePortrait && s.mobilePortraitImage) ? s.mobilePortraitImage : s.image;
          if (s.isHeroSection) {
            // Render hero section; on mobile portrait we show/hide it like other slides
            if (isMobilePortrait) {
              return (
                <div
                  key={s.id}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${i + 1} of ${slideCount}`}
                  className={`absolute inset-0 transition-opacity duration-300 ${isCurrent ? 'opacity-100' : 'opacity-0' } ${isCurrent ? '' : 'pointer-events-none'}`}
                  onTouchStart={onTouchStart}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onTouchEnd}
                  style={{ zIndex: isCurrent ? 20 : 10 }}
                >
                  <div className="w-full h-full flex items-center justify-center bg-transparent">
                    <HeroSection />
                  </div>
                </div>
              );
            }

            return (
              <div
                key={s.id}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${slideCount}`}
                className={`absolute inset-0 transition-transform duration-800 ease-out will-change-transform`}
                style={{ transform: `translateX(${(i - index) * 100}%)`, transitionDuration: '800ms' }}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
              >
                <div className="w-full h-full flex items-center justify-center bg-transparent">
                  <HeroSection edgeToEdge />
                </div>
              </div>
            );
          }

          if (isMobilePortrait) {
            return (
              <div
                key={s.id}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${slideCount}`}
                className={`absolute inset-0 transition-opacity duration-300 ${isCurrent ? 'opacity-100' : 'opacity-0'} ${isCurrent ? '' : 'pointer-events-none'}`}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                style={{ zIndex: isCurrent ? 20 : 10 }}
              >
                <div className="w-full h-full flex items-center justify-center" aria-hidden style={{ height: s.mobilePortraitHeight || '60vh', overflow: 'hidden' }}>
                  <img
                    src={imgSrc}
                    alt={s.title || ''}
                    loading="lazy"
                    className={s.mobilePortraitClassName || ''}
                    style={{ width: s.mobilePortraitWidth || 'auto', height: '100%', objectFit: s.mobilePortraitObjectFit || 'cover', maxHeight: s.mobilePortraitMaxHeight || '100vh', display: 'block' }}
                    onError={(e) => { if (s.mobilePortraitImage && e.currentTarget.src !== s.image) e.currentTarget.src = s.image; }}
                  />
                </div>
              </div>
            );
          }

          return (
            <div
              key={s.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${slideCount}`}
              className={`absolute inset-0 transition-transform duration-800 ease-out will-change-transform`} 
              style={{
                transform: `translateX(${(i - index) * 100}%)`,
                transitionDuration: '800ms',
              }}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <div className="absolute inset-0 bg-gray-100" aria-hidden>
                <img
                  src={imgSrc}
                  alt={s.title || ''}
                  loading="lazy"
                  className={s.desktopClassName || 'w-full h-full object-cover'}
                  style={{ width: s.width || '100%', height: s.height || '100%' }}
                />
              </div>
            </div>
          );
        })}

        {/* Left/right arrows */}
        <button
          aria-label="Previous slide"
          onClick={goPrev}
          className="hidden md:flex items-center justify-center absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 text-gray-800 hover:bg-white z-20 shadow"
        >
          ‹
        </button>
        <button
          aria-label="Next slide"
          onClick={goNext}
          className="hidden md:flex items-center justify-center absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 text-gray-800 hover:bg-white z-20 shadow"
        >
          ›
        </button>

        {/* Dots */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-3">
          {slides.map((s, i) => (
            <button
              key={s.id}
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => { setIndex(i); setIsPaused(true); stopAutoplay(); }}
              className={`w-3 h-3 rounded-full ${i === index ? 'bg-white' : 'bg-white/50'} transition`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroCarousel;

import React, { useState, useEffect, useRef } from 'react';
    import { Card, CardTitle, CardDescription } from '@/components/ui/card';
    import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
    import { motion, AnimatePresence } from 'framer-motion';
    import { containerVariants, itemVariants } from '@/components/home/motionVariants';
import { supabase } from '@/lib/supabaseClient';

    // Keep a small fallback list only for development; production should fetch from DB.
    const FALLBACK_TESTIMONIALS = [
      { id: 1, name: "Sarah L.", quote: "Aximake delivered my prototype parts incredibly fast and the quality was outstanding.", avatarSeed: "Sarah", alt: "Avatar of Sarah L.", rating: 5 },
      { id: 2, name: "Mike P.", quote: "I needed a custom enclosure for my electronics project, and Aximake nailed it.", avatarSeed: "Mike", alt: "Avatar of Mike P.", rating: 5 },
    ];

    const AUTO_SCROLL_INTERVAL = 5000; // ms

    const Testimonials = () => {
      const [testimonials, setTestimonials] = useState(FALLBACK_TESTIMONIALS);
      const [current, setCurrent] = useState(0);
      const [dir, setDir] = useState(1); // 1 = next (enter from right), -1 = prev (enter from left)
      const prevRef = useRef(0);
      const [paused, setPaused] = useState(false);
      const timeoutRef = useRef(null);
      const dragThreshold = 60; // px to trigger swipe

      useEffect(() => {
        if (!paused && testimonials.length > 0) {
          timeoutRef.current = setTimeout(() => {
            setDir(1);
            setCurrent((prev) => (prev + 1) % testimonials.length);
          }, AUTO_SCROLL_INTERVAL);
        }
        return () => clearTimeout(timeoutRef.current);
      }, [current, paused, testimonials]);

      // Fetch testimonials dynamically, filter for 5-star, order latest first.
      useEffect(() => {
        let mounted = true;
        async function fetchTestimonials() {
          try {
            const { data, error } = await supabase
              .from('reviews')
              .select('*')
              .eq('rating', 5)
              .order('created_at', { ascending: false })
              .limit(20);
            if (error) throw error;
            if (!mounted) return;
            if (Array.isArray(data) && data.length > 0) {
              setTestimonials(data);
              setDir(1);
              setCurrent(0);
            }
          } catch (err) {
            // keep fallback testimonials; do not crash UI
            console.warn('Failed to fetch testimonials, using fallback', err);
          }
        }
        fetchTestimonials();
        return () => { mounted = false; };
      }, []);

      // Ensure current index stays valid when testimonials array size changes
      useEffect(() => {
        if (testimonials.length === 0) return;
        if (current >= testimonials.length) setCurrent(0);
      }, [testimonials, current]);

      // Track previous index only; `dir` is set explicitly where we change `current` to avoid
      // conflicting updates that cause snap-back/jitter during swipe interactions.
      useEffect(() => { prevRef.current = current; }, [current]);

      return (
        <motion.section
          id="testimonials-section"
          className="py-16 md:py-24 bg-gradient-to-br from-blue-50 via-indigo-50 to-white"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          <div className="container mx-auto px-2 sm:px-4 lg:px-6">
            <motion.h2 variants={itemVariants} className="text-3xl md:text-4xl font-bold text-center mb-12">What Our Clients Say</motion.h2>
            <div className="relative max-w-xl mx-auto h-[340px] overflow-hidden">
              <AnimatePresence initial={false} custom={dir}>
                <motion.div
                  key={current}
                  initial={{ opacity: 0, x: `${dir * 100}%` }}
                  animate={{ opacity: 1, x: '0%' }}
                  exit={{ opacity: 0, x: `${-dir * 100}%` }}
                  transition={{ type: 'spring', stiffness: 280, damping: 30 }}
                  onMouseEnter={() => setPaused(true)}
                  onMouseLeave={() => setPaused(false)}
                  className="flex flex-col items-center"
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '100%', touchAction: 'pan-y', willChange: 'transform' }}
                  // Allow horizontal drag on the single centered card.
                  drag="x"
                  dragElastic={0.12}
                  dragMomentum={true}
                  // lock Y while dragging to avoid vertical jitter from simultaneous y animations
                  whileDrag={{ y: 0 }}
                  onDragStart={() => setPaused(true)}
                  onDragEnd={(event, info) => {
                    const offsetX = info.offset.x;
                    const velocityX = info.velocity.x || 0;
                    const swipeValue = offsetX + velocityX * 50; // combine distance + flick velocity
                    const n = testimonials.length || 1;
                    if (swipeValue > dragThreshold || velocityX > 800) {
                      // Right swipe -> go to previous. Set direction to -1 (enter from left) before changing index.
                      requestAnimationFrame(() => {
                        setDir(-1);
                        setCurrent((prev) => (prev - 1 + n) % n);
                      });
                    } else if (swipeValue < -dragThreshold || velocityX < -800) {
                      // Left swipe -> go to next. Set direction to 1 (enter from right) before changing index.
                      requestAnimationFrame(() => {
                        setDir(1);
                        setCurrent((prev) => (prev + 1) % n);
                      });
                    }
                    setPaused(false);
                  }}
                >
                {/* Rendering the active testimonial card. Kept exact layout and animations. */}
                <Card className="h-full p-8 bg-white/90 shadow-xl border-blue-100 flex flex-col items-center text-center rounded-2xl transition-all duration-500 pointer-events-auto">
                  <Avatar className="w-20 h-20 mb-4 border-2 border-blue-400 shadow-lg">
                    {testimonials[current] && testimonials[current].avatar_url ? (
                      <AvatarImage src={testimonials[current].avatar_url} alt={testimonials[current].alt || testimonials[current].name} />
                    ) : (
                      // Fallback to seeded DiceBear avatar using name (keeps avatar stable if data changes)
                      <img alt={testimonials[current]?.alt} className="w-full h-full object-cover rounded-full" src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(testimonials[current]?.avatarSeed || testimonials[current]?.name || 'user')}`} />
                    )}
                    <AvatarFallback>{testimonials[current] ? `${testimonials[current].name.substring(0,1)}${testimonials[current].name.includes(' ') ? testimonials[current].name.split(' ')[1].substring(0,1) : ''}` : ''}</AvatarFallback>
                  </Avatar>
                  <CardTitle className="text-xl mb-2 text-[#1a237e]">{testimonials[current]?.name}</CardTitle>
                  <div className="flex justify-center mb-2">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className="text-yellow-400 text-lg">★</span>
                    ))}
                  </div>
                  <CardDescription className="text-zinc-600 italic text-lg">"{testimonials[current]?.quote}"</CardDescription>
                </Card>
              </motion.div>
              </AnimatePresence>
            </div>
            {/* Carousel dots placed outside the overflow-hidden card area so they don't overlap content */}
            <div className="max-w-xl mx-auto mt-6 flex justify-center gap-2">
              {testimonials.map((_, idx) => (
                <button
                  key={idx}
                  className={`w-3 h-3 rounded-full border-2 border-blue-300 transition-all duration-300 ${current === idx ? 'bg-blue-500 scale-125' : 'bg-blue-100'}`}
                  onClick={() => {
                    if (idx === current) return;
                    setDir(idx > current ? 1 : -1);
                    setCurrent(idx);
                  }}
                  aria-label={`Go to testimonial ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </motion.section>
      );
    };
    export default Testimonials;
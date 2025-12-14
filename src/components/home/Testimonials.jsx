import React, { useState, useEffect, useRef } from 'react';
    import { Card, CardTitle, CardDescription } from '@/components/ui/card';
    import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
    import { motion } from 'framer-motion';
    import { containerVariants, itemVariants } from '@/components/home/motionVariants';

    const testimonialsData = [
      { name: "Sarah L.", quote: "Aximake delivered my prototype parts incredibly fast and the quality was outstanding. Their team was super helpful throughout the process!", avatarSeed: "Sarah", alt: "Avatar of Sarah L." },
      { name: "Mike P.", quote: "I needed a custom enclosure for my electronics project, and Aximake nailed it. The precision and material strength were exactly what I hoped for.", avatarSeed: "Mike", alt: "Avatar of Mike P." },
      { name: "Innovatech Ltd.", quote: "We've partnered with Aximake for multiple short-run production parts. Their reliability and consistent quality are why we keep coming back.", avatarSeed: "Innovatech", alt: "Avatar of Innovatech Ltd." },
      { name: "Priya S.", quote: "The design team at Aximake helped me optimize my 3D model for printing. The results were perfect and the price was fair.", avatarSeed: "Priya", alt: "Avatar of Priya S." },
      { name: "Rohit G.", quote: "Excellent customer service and fast turnaround. I recommend Aximake to anyone needing custom prints.", avatarSeed: "Rohit", alt: "Avatar of Rohit G." },
      { name: "TechMakers Inc.", quote: "Aximake's attention to detail and quality control is top-notch. Our clients are always happy with the parts we source from them.", avatarSeed: "TechMakers", alt: "Avatar of TechMakers Inc." },
      { name: "Emily W.", quote: "I was amazed by the finish and strength of the parts. The online ordering process was smooth and easy.", avatarSeed: "Emily", alt: "Avatar of Emily W." },
      { name: "Arjun V.", quote: "Aximake's team went above and beyond to meet my tight deadline. Will use again!", avatarSeed: "Arjun", alt: "Avatar of Arjun V." },
    ];

    const AUTO_SCROLL_INTERVAL = 5000; // ms

    const Testimonials = () => {
      const [current, setCurrent] = useState(0);
      const [paused, setPaused] = useState(false);
      const timeoutRef = useRef(null);

      useEffect(() => {
        if (!paused) {
          timeoutRef.current = setTimeout(() => {
            setCurrent((prev) => (prev + 1) % testimonialsData.length);
          }, AUTO_SCROLL_INTERVAL);
        }
        return () => clearTimeout(timeoutRef.current);
      }, [current, paused]);

      return (
        <motion.section
          id="testimonials-section"
          className="py-16 md:py-24 bg-gradient-to-br from-blue-50 via-indigo-50 to-white"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          <div className="container mx-auto px-4">
            <motion.h2 variants={itemVariants} className="text-3xl md:text-4xl font-bold text-center mb-12">What Our Clients Say</motion.h2>
            <div className="relative max-w-xl mx-auto">
              <motion.div
                key={current}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -40 }}
                transition={{ duration: 0.6, type: 'spring' }}
                onMouseEnter={() => setPaused(true)}
                onMouseLeave={() => setPaused(false)}
                className="flex flex-col items-center"
                style={{ minHeight: 340 }}
              >
                <Card className="h-full p-8 bg-white/90 shadow-xl border-blue-100 flex flex-col items-center text-center rounded-2xl transition-all duration-500">
                  <Avatar className="w-20 h-20 mb-4 border-2 border-blue-400 shadow-lg">
                    <img alt={testimonialsData[current].alt} className="w-full h-full object-cover rounded-full" src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(testimonialsData[current].avatarSeed)}`} />
                    <AvatarFallback>{testimonialsData[current].name.substring(0,1)}{testimonialsData[current].name.includes(' ') ? testimonialsData[current].name.split(' ')[1].substring(0,1) : ''}</AvatarFallback>
                  </Avatar>
                  <CardTitle className="text-xl mb-2 text-[#1a237e]">{testimonialsData[current].name}</CardTitle>
                  <div className="flex justify-center mb-2">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className="text-yellow-400 text-lg">★</span>
                    ))}
                  </div>
                  <CardDescription className="text-zinc-600 italic text-lg">"{testimonialsData[current].quote}"</CardDescription>
                </Card>
              </motion.div>
              {/* Carousel dots */}
              <div className="flex justify-center gap-2 mt-6">
                {testimonialsData.map((_, idx) => (
                  <button
                    key={idx}
                    className={`w-3 h-3 rounded-full border-2 border-blue-300 transition-all duration-300 ${current === idx ? 'bg-blue-500 scale-125' : 'bg-blue-100'}`}
                    onClick={() => setCurrent(idx)}
                    aria-label={`Go to testimonial ${idx + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </motion.section>
      );
    };
    export default Testimonials;
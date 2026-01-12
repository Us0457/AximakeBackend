import React from 'react';
    import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
    import { motion } from 'framer-motion';
    import { containerVariants, itemVariants } from '@/components/home/motionVariants';
    import { BadgeCheck, Upload, Clock, Settings, DollarSign, HelpCircle } from 'lucide-react';

    const features = [
      {
        icon: <BadgeCheck className="w-10 h-10 md:w-14 md:h-14 text-blue-600" />, // Unmatched Quality
        title: 'Unmatched Quality',
        description: 'Precision FDM printing with top-grade materials.'
      },
      {
        icon: <Upload className="w-10 h-10 md:w-14 md:h-14 text-cyan-500" />, // Easy File Upload
        title: 'Easy File Upload',
        description: 'Upload STL, OBJ, or 3MF models instantly.'
      },
      {
        icon: <Clock className="w-10 h-10 md:w-14 md:h-14 text-blue-400" />, // Fast Turnaround
        title: 'Fast Turnaround',
        description: 'Speedy production and shipping.'
      },
      {
        icon: <Settings className="w-10 h-10 md:w-14 md:h-14 text-indigo-500" />, // Customization Options
        title: 'Customization Options',
        description: 'Choose your color, strength, and surface finish.'
      },
      {
        icon: <DollarSign className="w-10 h-10 md:w-14 md:h-14 text-blue-700" />, // Competitive Pricing
        title: 'Competitive Pricing',
        description: 'Transparent pricing, no hidden fees.'
      },
      {
        icon: <HelpCircle className="w-10 h-10 md:w-14 md:h-14 text-blue-500" />, // Expert Support
        title: 'Expert Support',
        description: 'Talk to real humans who know 3D printing.'
      },
    ];

    
    const featureVariants = {
      hidden: { opacity: 0, y: 18 },
      visible: (i) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.08, duration: 0.6, type: 'spring', bounce: 0.12 },
      }),
    };

    const BusinessOverview = () => (
      <motion.section
        id="why-choose-us-section"
        className="py-12 md:py-20 bg-gradient-to-b from-sky-800/95 to-slate-800/95"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
      >
        <div className="container mx-auto px-2 sm:px-4 lg:px-6 max-w-6xl">
          <motion.h2
            variants={itemVariants}
            className="text-2xl md:text-3xl font-semibold text-center mb-2 text-slate-50"
          >
            Why Choose Aximake?
          </motion.h2>
          <motion.p
            variants={itemVariants}
            className="text-sm md:text-base text-slate-200 text-center max-w-2xl mx-auto mb-8 md:mb-12 font-medium"
          >
            Premium 3D printing — precision, speed, and friendly support.
          </motion.p>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 md:gap-3 items-start">
            {features.map((feature, i) => {
              // pastel color palette for icon backgrounds and subtle accents
              // icons should be bright and high-contrast (white/aqua)
              const iconColor = [
                'text-white',
                'text-white',
                'text-white',
                'text-white',
                'text-white',
                'text-white',
              ];

              return (
                <motion.div
                  key={feature.title}
                  className="flex flex-col items-center justify-start p-0 md:p-2 lg:p-0 m-0 group w-full min-w-0"
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.6 }}
                  custom={i}
                  variants={featureVariants}
                >
                  <div className="relative flex items-center justify-center w-32 h-32 md:w-36 md:h-36 transition-transform duration-300 group-hover:-translate-y-1">
                    {/* gradient ring */}
                    <div
                      className="rounded-full flex items-center justify-center"
                      style={{
                        padding: '6px',
                        borderRadius: '9999px',
                        background: 'conic-gradient(from 200deg at 50% 50%, #07283f, #0a7d86)',
                        boxShadow: '0 18px 40px rgba(2,16,28,0.45)',
                      }}
                    >
                      {/* inner white circle */}
                      <div className="rounded-full bg-white flex items-center justify-center" style={{ width: '78px', height: '78px' }}>
                        {/* render icon as provided so its original accent color remains */}
                        {feature.icon}
                      </div>
                    </div>
                  </div>

                  <h3 className="mt-4 text-sm md:text-base font-semibold text-slate-100 text-center leading-snug" style={{ width: '8rem' }}>
                    {feature.title}
                  </h3>

                  <p className="mt-1 text-xs md:text-sm text-slate-200 text-center max-w-[9rem] leading-tight">
                    {feature.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.section>
    );

    export default BusinessOverview;
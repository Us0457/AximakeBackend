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
      hidden: { opacity: 0, y: 40 },
      visible: (i) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.15, duration: 0.7, type: 'spring', bounce: 0.18 },
      }),
    };

    const BusinessOverview = () => (
      <motion.section
        id="why-choose-us-section"
        className="py-16 md:py-24 bg-white"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
      >
        <div className="container mx-auto px-4 max-w-8xl">
          <motion.h2 variants={itemVariants} className="text-3xl md:text-4xl font-bold text-center mb-4 text-neutral-900 drop-shadow">Why Choose Aximake?</motion.h2>
          <motion.p variants={itemVariants} className="text-lg text-neutral-700 text-center max-w-2xl mx-auto mb-12 font-medium">We are dedicated to providing top-tier 3D printing solutions with a focus on quality, speed, and customer satisfaction.</motion.p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                className="flex flex-col items-center bg-neutral-50 rounded-2xl shadow-md px-6 py-8 md:px-8 md:py-8 hover:shadow-lg transition-shadow duration-300 w-full min-h-[220px] md:min-h-[180px] border-2 border-blue-200 hover:border-blue-500 group relative overflow-hidden"
                style={{ minWidth: '0' }}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.5 }}
                custom={i}
                variants={featureVariants}
              >
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-600 opacity-90 group-hover:opacity-100 transition-all duration-300 rounded-t-2xl z-10" />
                <div className="rounded-full bg-white shadow flex items-center justify-center p-4 md:p-6 mb-4 z-20 border border-blue-100">
                  {feature.icon}
                </div>
                <h3 className="text-xl md:text-2xl font-semibold mb-2 text-neutral-900 text-center w-full z-20">{feature.title}</h3>
                <p className="text-neutral-600 text-base md:text-lg leading-relaxed text-center w-full z-20">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>
    );

    export default BusinessOverview;
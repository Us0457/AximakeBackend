import React from 'react';
import { motion, useAnimation, useInView } from 'framer-motion';
import { CheckCircle, Zap, Shield, Users, Award, Globe, Star } from 'lucide-react';

const features = [
  {
    icon: <Zap className="w-12 h-12 md:w-12 md:h-12 lg:w-16 lg:h-16 text-blue-500" />, // Vibrant brand color
    title: 'Rapid Turnaround',
    desc: 'Get your 3D prints delivered fast with our streamlined workflow and in-house production.',
  },
  {
    icon: <Shield className="w-12 h-12 md:w-12 md:h-12 lg:w-16 lg:h-16 text-green-500" />,
    title: 'Quality Assurance',
    desc: 'Every part is inspected for dimensional accuracy and finish before shipping.',
  },
  {
    icon: <Users className="w-12 h-12 md:w-12 md:h-12 lg:w-16 lg:h-16 text-purple-500" />,
    title: 'Expert Support',
    desc: 'Our team of engineers is ready to help you with design, material selection, and troubleshooting.',
  },
  {
    icon: <Award className="w-12 h-12 md:w-12 md:h-12 lg:w-16 lg:h-16 text-yellow-500" />,
    title: 'Industrial-Grade Materials',
    desc: 'Choose from a wide range of professional materials for prototypes and end-use parts.',
  },
  {
    icon: <Globe className="w-12 h-12 md:w-12 md:h-12 lg:w-16 lg:h-16 text-pink-500" />,
    title: 'Nationwide Delivery',
    desc: 'We ship anywhere in India with reliable, trackable logistics partners.',
  },
  {
    icon: <Star className="w-12 h-12 md:w-12 md:h-12 lg:w-16 lg:h-16 text-orange-500" />,
    title: 'Customer Satisfaction',
    desc: 'We’re committed to your success and offer a satisfaction guarantee on every order.',
  },
];

const featureVariants = {
  hidden: { opacity: 0, x: -60 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.18, duration: 0.7, type: 'spring', bounce: 0.2 },
  }),
};

const WhyChooseAximake = () => {
  return (
    <section id="why-choose-aximake" className="py-16 md:py-24 bg-white">
      <div className="mx-auto w-full max-w-5xl md:max-w-full lg:max-w-7xl px-4 md:px-6">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-blue-800">Why Choose Aximake? - test</h2>
            <div className="grid grid-cols-2 md:grid-cols-[repeat(3,minmax(0,1fr))] xl:grid-cols-6 gap-6 md:gap-4">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              className="flex flex-col items-center text-center bg-white rounded-2xl shadow-md p-6 md:p-3 lg:p-6 w-full min-w-0"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.5 }}
              custom={i}
              variants={featureVariants}
              style={{ zIndex: 10 - i }}
            >
              <div className="flex-shrink-0 mb-4 flex items-center justify-center">
                {feature.icon}
              </div>
              <div className="flex-1">
                <h3 className="text-lg md:text-xl font-semibold mb-1 text-gray-900">{feature.title}</h3>
                <p className="text-gray-600 text-sm md:text-base leading-relaxed">{feature.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyChooseAximake;

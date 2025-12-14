import React from 'react';
import { motion, useAnimation, useInView } from 'framer-motion';
import { CheckCircle, Zap, Shield, Users, Award, Globe, Star } from 'lucide-react';

const features = [
  {
    icon: <Zap className="w-12 h-12 md:w-16 md:h-16 text-blue-500" />, // Vibrant brand color
    title: 'Rapid Turnaround',
    desc: 'Get your 3D prints delivered fast with our streamlined workflow and in-house production.',
  },
  {
    icon: <Shield className="w-12 h-12 md:w-16 md:h-16 text-green-500" />,
    title: 'Quality Assurance',
    desc: 'Every part is inspected for dimensional accuracy and finish before shipping.',
  },
  {
    icon: <Users className="w-12 h-12 md:w-16 md:h-16 text-purple-500" />,
    title: 'Expert Support',
    desc: 'Our team of engineers is ready to help you with design, material selection, and troubleshooting.',
  },
  {
    icon: <Award className="w-12 h-12 md:w-16 md:h-16 text-yellow-500" />,
    title: 'Industrial-Grade Materials',
    desc: 'Choose from a wide range of professional materials for prototypes and end-use parts.',
  },
  {
    icon: <Globe className="w-12 h-12 md:w-16 md:h-16 text-pink-500" />,
    title: 'Nationwide Delivery',
    desc: 'We ship anywhere in India with reliable, trackable logistics partners.',
  },
  {
    icon: <Star className="w-12 h-12 md:w-16 md:h-16 text-orange-500" />,
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
      <div className="container mx-auto px-4 max-w-5xl">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-blue-800">Why Choose Aximake?</h2>
        <div className="flex flex-col gap-12">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              className="relative flex flex-col md:flex-row items-center md:items-stretch w-full bg-white rounded-2xl shadow-md md:shadow-lg px-4 md:px-8 py-8 md:py-12 mb-2 md:mb-0"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.5 }}
              custom={i}
              variants={featureVariants}
              style={{ zIndex: 10 - i, position: 'sticky', top: i === 0 ? '2rem' : '4rem' }}
            >
              <div className="flex-shrink-0 mb-4 md:mb-0 md:mr-8 flex items-center justify-center">
                {feature.icon}
              </div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-xl md:text-2xl font-semibold mb-2 text-gray-900">{feature.title}</h3>
                <p className="text-gray-600 text-base md:text-lg leading-relaxed">{feature.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyChooseAximake;

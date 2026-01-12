import React from 'react';
    import { motion } from 'framer-motion';
    import { containerVariants, itemVariants } from '@/components/home/motionVariants';

    const AboutUs = () => (
      <motion.section
        id="about-us-section"
        className="py-16 md:py-24"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
      >
        <div className="container mx-auto px-2 sm:px-4 lg:px-6">
          <motion.h2 variants={itemVariants} className="text-3xl md:text-4xl font-bold text-center mb-6">Who We Are</motion.h2>
          <motion.p variants={itemVariants} className="text-lg text-muted-foreground text-center max-w-3xl mx-auto mb-12">
            Aximake was founded by a team of passionate engineers and designers who believe in the transformative power of 3D printing. We started with a simple mission: to make high-quality, custom 3D printing accessible to everyone, from individual hobbyists to large corporations.
          </motion.p>
          <motion.div variants={itemVariants} className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <img  alt="Modern 3D printing lab with multiple printers operating" className="rounded-lg shadow-xl w-full h-auto object-cover aspect-video" src="https://images.unsplash.com/photo-1611117775350-ac3950990985" />
            </div>
            <div className="space-y-4">
              <h3 className="text-2xl font-semibold gradient-text">Our Vision</h3>
              <p className="text-muted-foreground">To be the leading provider of innovative 3D printing solutions, empowering creators and businesses to bring their ideas to life with speed, precision, and unparalleled quality.</p>
              <h3 className="text-2xl font-semibold gradient-text">Our Commitment</h3>
              <p className="text-muted-foreground">We are committed to leveraging the latest technology, sustainable practices, and a customer-centric approach to deliver exceptional value and foster long-term partnerships.</p>
            </div>
          </motion.div>
        </div>
      </motion.section>
    );
    export default AboutUs;
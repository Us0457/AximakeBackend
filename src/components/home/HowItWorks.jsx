import React from 'react';
    import { Button } from '@/components/ui/button';
    import { Card } from '@/components/ui/card';
    import { FaArrowRight } from 'react-icons/fa';
    import { Link } from 'react-router-dom';
    import { motion } from 'framer-motion';
    import { containerVariants, itemVariants } from '@/components/home/motionVariants';
    import uploadImg from '@/assets/upload.jpg';
    import quoteImg from '@/assets/quote1.jpg';
    import printShipImg from '@/assets/print&ship.jpg';

    const steps = [
      {
        step: 1,
        title: 'Upload Your Design',
        description: 'Submit your 3D model (STL, OBJ, etc.) through our secure portal.',
        img: uploadImg,
        alt: 'Upload 3D model',
      },
      {
        step: 2,
        title: 'Customize & Quote',
        description: 'Choose materials, colors, and quantity. Get an instant price estimate.',
        img: quoteImg,
        alt: 'Customize and get quote',
      },
      {
        step: 3,
        title: 'Print & Ship',
        description: 'We print your design with precision and ship it directly to your doorstep.',
        img: printShipImg,
        alt: 'Print and ship',
      },
    ];

    const HowItWorks = () => (
      <motion.section 
        id="how-it-works-section"
        className="py-16 md:py-24 bg-muted/30"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
      >
        <div className="container mx-auto px-2 sm:px-4 lg:px-6">
          <motion.h2 variants={itemVariants} className="text-3xl md:text-4xl font-bold text-center mb-12">How It Works</motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 justify-items-center">
            {steps.map((item, index) => (
              <motion.div variants={itemVariants} key={index}>
                <Card className="group p-0 h-full flex flex-col items-center bg-white/90 border-0 shadow-xl rounded-3xl transition-transform duration-300 hover:scale-105 hover:shadow-2xl">
                  <div className="w-full h-56 md:h-64 rounded-t-3xl overflow-hidden shadow-md bg-gray-100 flex items-center justify-center">
                    <img src={item.img} alt={item.alt} className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105" />
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center p-4">
                    <p className="text-xs font-bold text-blue-600 mb-1 tracking-widest">STEP {item.step}</p>
                    <h3 className="text-lg font-bold mb-2 text-gray-900">{item.title}</h3>
                    <p className="text-gray-600 text-sm mb-2">{item.description}</p>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
          <motion.div variants={itemVariants} className="text-center mt-12">
            <Button size="lg" asChild className="bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity text-primary-foreground shadow-lg transform hover:scale-105">
              <Link to="/custom-print">
                Get Started Now <FaArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </motion.section>
    );
    export default HowItWorks;
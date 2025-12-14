import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const ThankYouPage = () => {
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      transition={{ duration: 0.4 }}
      className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-16 bg-gradient-to-br from-primary/10 to-accent/10 rounded-xl shadow-xl mt-8 mb-12"
    >
      {/* Use a large emoji icon for universal compatibility */}
      <div className="text-6xl md:text-7xl mb-6 drop-shadow-lg" role="img" aria-label="Celebration">🎉</div>
      <h1 className="text-4xl md:text-5xl font-extrabold text-primary mb-4 text-center">Thank You for Ordering with Aximake!</h1>
      <p className="text-lg md:text-xl text-muted-foreground mb-8 text-center max-w-xl">
        Your payment was successful and your order has been received.<br />
        We&apos;ve sent a confirmation email with your order details and invoice.<br />
        Our team will process your order soon!
      </p>
      <Button className="text-lg px-8 py-3 mt-2" onClick={() => navigate('/')}>Back to Home</Button>
    </motion.div>
  );
};

export default ThankYouPage;

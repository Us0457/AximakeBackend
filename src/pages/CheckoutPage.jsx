import React, { useEffect } from 'react';
    import { motion } from 'framer-motion';

    const CheckoutPage = () => {
      // SEO: page title
      useEffect(() => {
        document.title = 'Checkout — Aximake';
      }, []);
      // SEO: meta description for checkout
      useEffect(() => {
        const desc = 'Securely complete your purchase at Aximake. Fast shipping and reliable support.';
        let m = document.querySelector('meta[name="description"]');
        if (!m) { m = document.createElement('meta'); m.name = 'description'; document.head.appendChild(m); }
        m.content = desc.slice(0, 160);
      }, []);
      return (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="container mx-auto px-4 py-8"
        >
          <h1 className="text-4xl font-bold mb-8 gradient-text">Checkout</h1>
          <p className="text-lg text-muted-foreground">
            Securely complete your purchase. This section is currently under development. We'll integrate Stripe for payments soon!
          </p>
        </motion.div>
      );
    };

    export default CheckoutPage;
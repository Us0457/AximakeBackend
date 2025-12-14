import React from 'react';
    import { motion } from 'framer-motion';

    const CheckoutPage = () => {
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
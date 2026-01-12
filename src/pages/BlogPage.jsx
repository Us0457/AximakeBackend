import React from 'react';
    import { motion } from 'framer-motion';

    const BlogPage = () => {
      return (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="container mx-auto px-2 sm:px-4 lg:px-6 py-8"
        >
          <h1 className="text-4xl font-bold mb-8 gradient-text">Our Blog</h1>
          <p className="text-lg text-muted-foreground">
            Stay updated with the latest news, tips, and project showcases from the world of 3D printing. This section is currently under development.
          </p>
        </motion.div>
      );
    };

    export default BlogPage;
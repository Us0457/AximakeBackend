import React from 'react';
    import { Button } from '@/components/ui/button';
    import { ArrowRight, UploadCloud } from 'lucide-react';
    import { motion } from 'framer-motion';

    const HeroSection = ({ edgeToEdge = false }) => {
      const outerStyle = edgeToEdge ? { width: '100vw', marginLeft: 'calc(50% - 50vw)', marginRight: 'calc(50% - 50vw)' } : undefined;
      const [headerOffsetStyle, setHeaderOffsetStyle] = React.useState({});

      React.useEffect(() => {
        if (!edgeToEdge) return;
        const header = document.querySelector('header');
        if (!header) return;
        const prevPosition = header.style.position;
        const prevZ = header.style.zIndex;
        // ensure header appears above the hero
        header.style.position = prevPosition || 'relative';
        header.style.zIndex = '50';
        const h = header.getBoundingClientRect().height || 0;
        // move hero up underneath header visually while preserving internal spacing
        setHeaderOffsetStyle({ marginTop: `-${h}px`, paddingTop: `${h}px` });
        return () => {
          // restore header styles
          header.style.position = prevPosition;
          header.style.zIndex = prevZ;
          setHeaderOffsetStyle({});
        };
      }, [edgeToEdge]);

      return (
      <motion.section 
        id="hero-section"
        style={{ ...(outerStyle || {}), ...(headerOffsetStyle || {}), ...(edgeToEdge ? { height: '100%' } : {}) }}
        className={`text-center bg-gradient-to-br from-primary/10 via-transparent to-accent/10 ${edgeToEdge ? 'h-full py-0 md:py-0 rounded-none shadow-none' : 'py-20 md:py-32 rounded-xl shadow-xl'} overflow-hidden`}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
            <div className={`${edgeToEdge ? 'w-full px-4 sm:px-6 lg:px-8' : 'container mx-auto px-4 sm:px-4 lg:px-6'} ${edgeToEdge ? 'h-full flex flex-col justify-center min-h-0' : ''}`}>
          <motion.h1 
            className="text-5xl md:text-7xl font-bold mb-6"
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          >
            Bring Your <span className="gradient-text">Digital</span> Designs to <span className="gradient-text">Physical</span> Reality
          </motion.h1>
            <motion.p 
            className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-10"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
          >
            High-quality 3D printing services for prototypes, custom parts, and creative projects. Fast, reliable, and precise with Aximake.
          </motion.p>
          <motion.div 
            className="space-y-4 sm:space-y-0 sm:space-x-4 flex flex-col sm:flex-row justify-center items-center"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6, ease: 'easeOut' }}
          >
            <Button
              size="lg"
              className="w-full sm:w-auto bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity text-primary-foreground shadow-lg transform hover:scale-105 flex items-center justify-center"
              onClick={() => window.location.href = '/custom-print'}
              style={{ minHeight: '3rem', minWidth: '12rem' }}
            >
              Upload Your File <UploadCloud className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-auto shadow-lg transform hover:scale-105 hover:bg-secondary/50 flex items-center justify-center hover:text-primary hover:border-primary"
              onClick={() => window.location.href = '/products'}
              style={{ minHeight: '3rem', minWidth: '12rem' }}
            >
              Explore Products <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </motion.div>
        </div>
        <motion.div 
          className="absolute -bottom-1/4 left-0 right-0 h-1/2 bg-gradient-to-t from-background to-transparent opacity-50 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ duration: 1, delay: 0.8 }}
        />
      </motion.section>
    );
  };

export default HeroSection;
import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { containerVariants, itemVariants } from '@/components/home/motionVariants';

const categories = [
  { key: 'electronics', title: 'Electronic Components', image: '/assets/categories/Comp.jpg', alt: 'Electronic components on PCB' },
  { key: 'kits', title: 'Custom Kit Builder', image: '/assets/categories/Kit.jpg', alt: 'Custom electronics kit' },
  { key: 'ecad', title: 'ECAD Upload Tool', image: '/assets/categories/ECADTool.jpg', alt: 'ECAD layout and schematic' },
  { key: 'products', title: '3D Products', image: '/assets/categories/3D.jpg', alt: '3D printed product' },
];

const Categories = ({ edgeToEdge = false }) => (
  <motion.section
    id="categories"
    className="pt-4 md:pt-6 pb-8 md:pb-8 bg-gradient-to-b from-white/95 to-neutral-200/95"
    variants={containerVariants}
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, amount: 0.2 }}
  >
    <div className={edgeToEdge ? 'w-full' : 'container mx-auto'} style={edgeToEdge ? { width: '100vw', marginLeft: 'calc(50% - 50vw)', marginRight: 'calc(50% - 50vw)' } : undefined}>
      <div className={`${edgeToEdge ? 'px-0' : 'px-2 sm:px-4 lg:px-6'} max-w-6xl mx-auto`}> 
        <motion.div variants={itemVariants} className="text-center mb-4 md:mb-6">
          <h2 className="text-xl md:text-2xl font-bold text-neutral-900">Categories</h2>
          <p className="text-sm md:text-base text-neutral-600 mt-1">Explore what you can build with Aximake</p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 items-start px-4 md:px-6">
          {categories.map((cat, i) => (
            <motion.div key={cat.key} variants={itemVariants} className="group flex flex-col items-center text-center">
              <Link to={cat.key === 'kits' ? '/custom-kit' : '#'} aria-label={cat.title} className="w-full flex flex-col items-center">
                <div className="rounded-full bg-transparent shadow-sm p-0 w-32 h-32 md:w-40 md:h-40 flex items-center justify-center transition-transform duration-200 group-hover:-translate-y-1">
                  <div
                    className="rounded-full flex items-center justify-center"
                    style={{
                      padding: '6px',
                      borderRadius: '9999px',
                      background: 'linear-gradient(140deg,#07283f 0%, #0a7d86 100%)',
                      boxShadow: '0 14px 34px rgba(2,16,28,0.28)',
                    }}
                  >
                    <div className="rounded-full overflow-hidden w-28 h-28 md:w-36 md:h-36">
                      <img
                        src={cat.image}
                        alt={cat.alt}
                        className="rounded-full w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  </div>
                </div>
              </Link>

              <span className="mt-3 text-sm md:text-base text-neutral-900 font-medium">{cat.title}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  </motion.section>
);

export default Categories;

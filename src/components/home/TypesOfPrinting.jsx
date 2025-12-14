import React from 'react';
    import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
    import { Layers, Palette, Cpu, CheckCircle, Paintbrush, Wrench, Sparkles, PaletteIcon, CogIcon} from 'lucide-react';
    import { motion } from 'framer-motion';
    import { containerVariants, itemVariants } from '@/components/home/motionVariants';
    import fdmRealImg from '@/assets/fdm.png'; // Use your best real FDM printer image here

    const fdmBenefits = [
      'Cost-effective for prototypes and production',
      'Fast turnaround and rapid iteration',
      'Wide material choice: PLA, PETG, ABS, and more',
      'Ideal for functional parts and large models',
    ];

    const postProcessing = [
      { icon: <Paintbrush className="text-red-500 w-6 h-6" />, label: 'Sanding & Smoothing' },
      { icon: <PaletteIcon className="text-brown-500 w-6 h-6" />, label: 'Priming & Painting' },
      { icon: <Wrench className="text-teal-500 w-6 h-6" />, label: 'Assembly' },
    ];

    const TypesOfPrinting = () => (
      <motion.section
        id="fdm-section"
        className="pt-6 pb-12 md:pt-8 md:pb-20 bg-white"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
      >
        <div className="container mx-auto px-4 max-w-5xl">
          <motion.h2
            variants={itemVariants}
            className="text-3xl md:text-4xl font-bold text-center mb-2 md:mb-3 text-blue-800 leading-tight"
          >
            FDM 3D Printing Services
          </motion.h2>
          <motion.p variants={itemVariants} className="text-lg md:text-xl text-center mb-6 md:mb-8 text-gray-700 max-w-2xl mx-auto">
            Fused Deposition Modeling (FDM) is the industry standard for fast, affordable, and versatile 3D printing. Our FDM service delivers robust parts with a wide range of materials and colors, perfect for prototypes, functional components, and large-scale models.
          </motion.p>
          <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10 mb-10">
            <div className="md:w-1/2 w-full flex justify-center">
              <div className="w-full max-w-2xl h-56 md:h-72 bg-gray-100 rounded-xl shadow-2xl flex items-center justify-center overflow-hidden border border-blue-100">
                <img src={fdmRealImg} alt="FDM 3D Printer in action" className="object-cover w-full h-full" />
              </div>
            </div>
            <div className="md:w-1/2 w-full mt-4 md:mt-0">
              <h3 className="text-xl md:text-2xl font-semibold mb-3 text-blue-700">Why Choose FDM?</h3>
              <ul className="space-y-2">
                {fdmBenefits.map((benefit) => (
                  <li key={benefit} className="flex items-center text-gray-700 text-base md:text-lg">
                    <CheckCircle className="text-green-500 w-5 h-5 mr-2" /> {benefit}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
            <div>
              <h3 className="text-xl md:text-2xl font-semibold mb-4 text-blue-700 flex items-center"><CogIcon className="w-6 h-6 mr-2 text-gray-500" />Professional Post-Processing</h3>
              <p className="text-gray-700 mb-4">Enhance your FDM prints with our expert finishing services:</p>
              <ul className="space-y-2">
                {postProcessing.map((proc) => (
                  <li key={proc.label} className="flex items-center text-gray-700 text-base">
                    {proc.icon}
                    <span className="ml-2">{proc.label}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xl md:text-2xl font-semibold mb-4 text-blue-700 flex items-center"><Sparkles className="w-6 h-6 mr-2 text-yellow-500" />Electroplating for PLA</h3>
              <p className="text-gray-700 mb-4">Take your prints to the next level with our optional electroplating service. We can add a real metallic finish to PLA parts, providing both stunning aesthetics and improved durability. Perfect for display models, functional prototypes, and custom projects.</p>
              <ul className="list-disc ml-6 text-gray-600 text-base">
                <li>Wide range of metal finishes available</li>
                <li>Enhances both look and strength</li>
                <li>Ideal for decorative and functional parts</li>
              </ul>
            </div>
          </div>
          {/* <div className="text-center mt-8">
            <a href="#contact" className="inline-block px-8 py-3 rounded-full bg-gradient-to-r from-blue-600 to-blue-400 text-white font-semibold shadow-lg hover:scale-105 hover:shadow-2xl transition-transform duration-200">Get a Free FDM Quote</a>
          </div> */}
        </div>
      </motion.section>
    );

    export default TypesOfPrinting;
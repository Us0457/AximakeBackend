import React from 'react';
    import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
    import { motion } from 'framer-motion';
    import { containerVariants, itemVariants } from '@/components/home/motionVariants';

    const FAQs = () => (
      <motion.section
        id="faqs-section"
        className="py-16 md:py-24 bg-muted/30"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
      >
        <div className="container mx-auto px-2 sm:px-4 lg:px-6 max-w-3xl">
          <motion.h2 variants={itemVariants} className="text-3xl md:text-4xl font-bold text-center mb-12">Frequently Asked Questions</motion.h2>
          <motion.div variants={itemVariants}>
            <Accordion type="single" collapsible className="w-full space-y-4">
              {[
                { q: "What file formats do you accept?", a: "We primarily accept STL files, but can also work with OBJ, 3MF, and STEP files. If you have another format, please contact us." },
                { q: "What is your typical turnaround time?", a: "Turnaround time depends on the complexity, size, and quantity of your order, as well as current demand. Simple prints can often be completed within 1-3 business days, while more complex projects may take longer. We provide an estimated timeframe with your quote." },
                { q: "What materials can I choose from?", a: "We offer a wide range of materials including PLA, PETG, ABS, ASA, TPU (flexible), Nylon, and various resin options for SLA printing. Check our materials guide or contact us for specific needs." },
                { q: "Can you help with 3D modeling or design?", a: "While our primary service is 3D printing, we can offer basic design modifications or connect you with design partners for more complex modeling needs. Please inquire with details about your project." },
                { q: "How do you ensure print quality?", a: "We use high-quality, well-maintained 3D printers and premium materials. Our experienced technicians monitor the printing process and perform quality checks on all finished parts to ensure they meet our standards and your specifications." },
              ].map((faq, index) => (
                <AccordionItem value={`item-${index + 1}`} key={index} className="bg-card/80 backdrop-blur-sm border border-primary/20 rounded-lg shadow-md">
                  <AccordionTrigger className="p-4 sm:p-6 text-left font-semibold text-foreground hover:no-underline">{faq.q}</AccordionTrigger>
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                  >
                    <AccordionContent className="p-4 sm:p-6 pt-0 text-muted-foreground">{faq.a}</AccordionContent>
                  </motion.div>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </motion.section>
    );
    export default FAQs;
import React, { useState } from 'react';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Textarea } from '@/components/ui/textarea';
    import { Mail } from 'lucide-react';
    import { motion } from 'framer-motion';
    import { containerVariants, itemVariants } from '@/components/home/motionVariants';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/supabaseClient'; // adjust path as needed


    const ContactFormSection = () => {
      const { toast } = useToast();
      const [sending, setSending] = useState(false);

      const handleSubmit = async (e) => {
        e.preventDefault();
        setSending(true);
        const formData = new FormData(e.target);
        const name = formData.get('home-contact-name');
        const email = formData.get('home-contact-email');
        const subject = formData.get('home-contact-subject');
        const message = formData.get('home-contact-message');

        // Send to PHP mailer endpoint (expects JSON)
        // Use VITE_PHP_BASE_URL in development if available to avoid hitting Vite dev server
        const phpBase = (import.meta && import.meta.env && import.meta.env.VITE_PHP_BASE_URL) || '';
        const endpoint = phpBase ? phpBase.replace(/\/$/, '') + '/send-email.php' : '/send-email.php';

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
          body: new URLSearchParams({
            name,
            email,
            subject,
            message,
          }).toString(),
        });

        let json;
        try {
          json = await response.json();
        } catch (err) {
          setSending(false);
          toast({
            title: 'Error',
            description: 'Invalid server response. Please try again later.',
            variant: 'destructive',
          });
          return;
        }

        setSending(false);
        if (response.ok && json && json.success) {
          toast({
            title: 'Message Sent!',
            description: `Thank you, ${name || 'friend'}! We've received your message and will get back to you at ${email || 'your email'} soon.`,
          });
          e.target.reset();
        } else {
          toast({
            title: 'Error',
            description: (json && (json.message || json.error)) || 'There was a problem sending your message. Please try again later.',
            variant: 'destructive',
          });
        }
      };

      return (
        <motion.section
          id="contact-section"
          className="py-16 md:py-24"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          <div className="container mx-auto px-2 sm:px-4 lg:px-6">
            <motion.h2 variants={itemVariants} className="text-3xl md:text-4xl font-bold text-center mb-8 gradient-text">Get In Touch</motion.h2>
            <motion.p variants={itemVariants} className="text-lg text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
              Have questions or need assistance with your 3D printing project? We're here to help! Reach out via the form below.
            </motion.p>
            
            <motion.div variants={itemVariants} className="max-w-2xl mx-auto bg-card/50 backdrop-blur-sm p-8 rounded-lg shadow-xl border border-primary/20">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="home-contact-name" className="text-foreground">Full Name</Label>
                  <Input id="home-contact-name" name="home-contact-name" type="text" placeholder="Your Name" className="mt-1 bg-background/70" required />
                </div>
                <div>
                  <Label htmlFor="home-contact-email" className="text-foreground">Email Address</Label>
                  <Input id="home-contact-email" name="home-contact-email" type="email" placeholder="your.email@example.com" className="mt-1 bg-background/70" required />
                </div>
                <div>
                  <Label htmlFor="home-contact-subject" className="text-foreground">Subject</Label>
                  <Input id="home-contact-subject" name="home-contact-subject" type="text" placeholder="Inquiry about..." className="mt-1 bg-background/70" required />
                </div>
                <div>
                  <Label htmlFor="home-contact-message" className="text-foreground">Message</Label>
                  <Textarea id="home-contact-message" name="home-contact-message" placeholder="Your message here..." rows={5} className="mt-1 bg-background/70" required />
                </div>
                <Button type="submit" className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90 transition-opacity" disabled={sending}>
                  {sending ? 'Sending...' : (<><span>Send Message</span> <Mail className="ml-2 h-4 w-4" /></>)}
                </Button>
              </form>
            </motion.div>
          </div>
        </motion.section>
      );
    };
    export default ContactFormSection;
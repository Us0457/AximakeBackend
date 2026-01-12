import React from 'react';
    import { motion } from 'framer-motion';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Textarea } from '@/components/ui/textarea';
    import { Mail, Phone, MessageSquare } from 'lucide-react';

    const ContactPage = () => {
      return (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="container mx-auto px-2 sm:px-4 lg:px-6 py-8"
        >
          <h1 className="text-4xl font-bold mb-8 text-center gradient-text">Get In Touch</h1>
          <p className="text-lg text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Have questions or need assistance with your 3D printing project? We're here to help! Reach out via the form below, or use our live chat feature.
          </p>
          
          <div className="grid md:grid-cols-2 gap-12">
            <div className="bg-card/50 backdrop-blur-sm p-8 rounded-lg shadow-xl border border-primary/20">
              <h2 className="text-2xl font-semibold mb-6 text-foreground">Send us a Message</h2>
              <form className="space-y-6">
                <div>
                  <Label htmlFor="contact-name" className="text-foreground">Full Name</Label>
                  <Input id="contact-name" type="text" placeholder="Your Name" className="mt-1 bg-background/70" />
                </div>
                <div>
                  <Label htmlFor="contact-email" className="text-foreground">Email Address</Label>
                  <Input id="contact-email" type="email" placeholder="your.email@example.com" className="mt-1 bg-background/70" />
                </div>
                <div>
                  <Label htmlFor="contact-subject" className="text-foreground">Subject</Label>
                  <Input id="contact-subject" type="text" placeholder="Inquiry about..." className="mt-1 bg-background/70" />
                </div>
                <div>
                  <Label htmlFor="contact-message" className="text-foreground">Message</Label>
                  <Textarea id="contact-message" placeholder="Your message here..." rows={5} className="mt-1 bg-background/70" />
                </div>
                <Button type="submit" className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90 transition-opacity">
                  Send Message
                </Button>
              </form>
            </div>

            <div className="space-y-8">
              <div className="bg-card/50 backdrop-blur-sm p-8 rounded-lg shadow-xl border border-accent/20">
                <h2 className="text-2xl font-semibold mb-4 text-foreground">Contact Information</h2>
                <div className="space-y-3 text-muted-foreground">
                  <p className="flex items-center"><Mail className="mr-3 h-5 w-5 text-primary" /> support@aximake.in</p>
                  <p className="flex items-center"><Phone className="mr-3 h-5 w-5 text-primary" /> (555) 123-4567</p>
                  <p>Channasandra, Bengaluru</p>
                </div>
              </div>
              <div className="bg-card/50 backdrop-blur-sm p-8 rounded-lg shadow-xl border border-accent/20">
                <h2 className="text-2xl font-semibold mb-4 text-foreground">Live Chat</h2>
                <p className="text-muted-foreground mb-4">
                  Need immediate assistance? Our live chat support is available during business hours.
                </p>
                <Button variant="outline" className="w-full hover:bg-primary/10 hover:text-primary">
                  <MessageSquare className="mr-2 h-5 w-5" /> Start Live Chat (Coming Soon)
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      );
    };

    export default ContactPage;
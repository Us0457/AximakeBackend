import React from 'react';
    import { Link } from 'react-router-dom';
    import { Printer, Facebook, Twitter, Instagram } from 'lucide-react';
import { FaFacebook, FaWhatsapp } from 'react-icons/fa';

    const Footer = () => {
      const currentYear = new Date().getFullYear();
      return (
        <footer className="bg-muted/50 border-t border-border/40 py-12 text-muted-foreground">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
              <div>
                <Link to="/" className="flex items-center space-x-2 mb-4">
                
                  <span className="text-xl font-bold text-foreground">Aximake</span>
                </Link>
                <p className="text-sm">
                  Your partner for high-quality 3D printing services. From prototypes to end-use parts, we bring your ideas to life.
                </p>
              </div>
              <div>
                <p className="font-semibold text-foreground mb-3">Quick Links</p>
                <ul className="space-y-2 text-sm">
                  <li><Link to="/products" className="hover:text-primary transition-colors">Products</Link></li>
                  <li><Link to="/custom-print" className="hover:text-primary transition-colors">Custom Prints</Link></li>
                  <li><Link to="/pricing-calculator" className="hover:text-primary transition-colors">Pricing</Link></li>
                  <li><Link to="/blog" className="hover:text-primary transition-colors">Blog</Link></li>
                  <li><Link to="/privacy-policy" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
                  <li><Link to="/terms-and-conditions" className="hover:text-primary transition-colors">Terms & Conditions</Link></li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-foreground mb-3">Connect With Us</p>
                <div className="flex space-x-4">
                  <a href="#" aria-label="WhatsApp" className="hover:text-green-600 transition-colors"><FaWhatsapp size={20} /></a>
                  <a href="#" aria-label="Facebook" className="hover:text-blue-700 transition-colors"><FaFacebook size={20} /></a>
                  <a href="#" aria-label="Twitter" className="hover:text-sky-600 transition-colors"><Twitter size={20} /></a>
                  <a href="#" aria-label="Instagram" className="hover:text-pink-600 transition-colors"><Instagram size={20} /></a>
                </div>
                <p className="text-sm mt-4">
                  Whitefield, Bangalore 560067
                </p>
                <p className="text-sm">
                  contact@aximake.in
                </p>
              </div>
            </div>
            <div className="border-t border-border/40 pt-8 text-center text-sm">
              <p>&copy; {currentYear} Aximake. All rights reserved.</p>
            </div>
          </div>
        </footer>
      );
    };

    export default Footer;
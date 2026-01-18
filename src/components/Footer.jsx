import React from 'react';
import { Link } from 'react-router-dom';
import { Headphones, Phone, Facebook, Twitter, Instagram } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="w-full">
      {/* Live Support Strip */}
      <div className="w-full bg-gradient-to-r from-sky-50 to-slate-100">
        <div className="container mx-auto px-2 sm:px-4 lg:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Headphones className="w-6 h-6 text-sky-700" />
              <div>
                <div className="text-sm md:text-base font-medium text-slate-900">Got questions? We're here to help</div>
                <div className="text-xs text-slate-600">Talk to a real expert</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-slate-700" />
              <a href="tel:+916206676009" className="text-sm md:text-base font-semibold text-slate-900">+91 6206676009</a>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Grid */}
      <div className="bg-gradient-to-b from-white/95 to-neutral-200/95 border-t border-slate-200">
        <div className="container mx-auto px-4 sm:px-6 lg:px-6 py-10 md:py-12">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            {/* Column 1 - Brand */}
            <div className="col-span-2 md:col-span-1">
                <Link to="/" className="flex items-center space-x-3 mb-3">
                  {/* Compact footer logo: visually lighter and smaller than navbar. */}
                  <img src="/assets/BrandLogo.png" alt="Aximake" className="h-6 w-auto object-contain opacity-90" />
                  <span className="sr-only">Aximake</span>
                </Link>
              <p className="text-sm text-slate-700">Your partner for electronics, DIY kits, and 3D printing — from prototypes to production.</p>
              <div className="text-sm text-slate-700 mt-3">
                <div>Whitefield, Bangalore 560067</div>
                <div className="mt-1">contact@aximake.com</div>
              </div>
            </div>

            {/* Column 2 - My Account */}
            <div className="md:col-span-1">
              <h4 className="text-sm font-semibold text-slate-900 mb-3 hidden md:block">My Account</h4>
              <details className="md:hidden"> 
                <summary className="text-sm font-semibold text-slate-900 mb-2">My Account</summary>
                <div className="mt-2" />
              </details>
              <ul className="space-y-2 text-sm text-slate-700">
                <li><Link to="/dashboard" className="hover:text-blue-900 transition">Dashboard</Link></li>
                <li><Link to="/dashboard/orders" className="hover:text-blue-900 transition">Orders</Link></li>
                <li><Link to="/payments" className="hover:text-blue-900 transition">Payments &amp; Cards</Link></li>
                <li><Link to="/cart" className="hover:text-blue-900 transition">Cart</Link></li>
                <li><Link to="/dashboard/wishlist" className="hover:text-blue-900 transition">Wishlist</Link></li>
              </ul>
            </div>

            {/* Column 3 - Services */}
            <div className="md:col-span-1">
              <h4 className="text-sm font-semibold text-slate-900 mb-3 hidden md:block">Services</h4>
              <details className="md:hidden">
                <summary className="text-sm font-semibold text-slate-900 mb-2">Services</summary>
                <div className="mt-2" />
              </details>
              <ul className="space-y-2 text-sm text-slate-700">
                <li><Link to="/3d-printing" className="hover:text-blue-900 transition font-medium">3D Printing Service</Link></li>
                <li><Link to="/custom-print" className="hover:text-blue-900 transition font-medium">Custom Prints</Link></li>
                <li><Link to="/ecad-upload" className="hover:text-blue-900 transition font-medium">ECAD Upload Tool</Link></li>
                <li><Link to="/about" className="hover:text-blue-900 transition">About Us</Link></li>
              </ul>
            </div>

            {/* Column 4 - Blog */}
            <div className="md:col-span-1">
              <h4 className="text-sm font-semibold text-slate-900 mb-3 hidden md:block">Blog</h4>
              <details className="md:hidden">
                <summary className="text-sm font-semibold text-slate-900 mb-2">Blog</summary>
                <div className="mt-2" />
              </details>
              <ul className="space-y-2 text-sm text-slate-700 mb-4">
                <li><Link to="/blog/infill" className="hover:text-blue-900 transition">What is infill in 3D printing?</Link></li>
                <li><Link to="/blog/pricing" className="hover:text-blue-900 transition">How is 3D print cost calculated?</Link></li>
                <li><Link to="/blog/materials" className="hover:text-blue-900 transition">Which 3D printing material should I choose?</Link></li>
                <li><Link to="/blog/what-is-3d-printing" className="hover:text-blue-900 transition">What is 3D printing?</Link></li>
              </ul>
            </div>

            {/* Column 5 - Policies & Help + Social */}
            <div className="md:col-span-1">
              <h4 className="text-sm font-semibold text-slate-900 mb-3 hidden md:block">Policies &amp; Help</h4>
              <details className="md:hidden">
                <summary className="text-sm font-semibold text-slate-900 mb-2">Policies &amp; Help</summary>
                <div className="mt-2" />
              </details>
              <ul className="space-y-2 text-sm text-slate-700 mb-4">
                <li><Link to="/terms-and-conditions" className="hover:text-blue-900 transition">Terms &amp; Conditions</Link></li>
                <li><Link to="/privacy-policy" className="hover:text-blue-900 transition">Privacy Policy</Link></li>
                <li><Link to="/shipping-policy" className="hover:text-blue-900 transition">Shipping Policy</Link></li>
                <li><Link to="/refunds" className="hover:text-blue-900 transition">Refund &amp; Returns</Link></li>
                <li><Link to="/faq" className="hover:text-blue-900 transition">FAQs</Link></li>
                <li><Link to="/support/forum" className="hover:text-blue-900 transition">Tech Support Forum</Link></li>
              </ul>

              <div className="flex items-center gap-4">
                <a href="#" aria-label="WhatsApp" className="text-slate-800 hover:text-green-600 transition-transform transform hover:scale-105"><FaWhatsapp className="w-5 h-5" /></a>
                <a href="#" aria-label="Facebook" className="text-slate-800 hover:text-blue-700 transition-transform transform hover:scale-105"><Facebook className="w-5 h-5" /></a>
                <a href="#" aria-label="Twitter" className="text-slate-800 hover:text-sky-600 transition-transform transform hover:scale-105"><Twitter className="w-5 h-5" /></a>
                <a href="#" aria-label="Instagram" className="text-slate-800 hover:text-pink-600 transition-transform transform hover:scale-105"><Instagram className="w-5 h-5" /></a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom dark bar */}
      <div className="w-full bg-slate-900 text-white">
        <div className="container mx-auto px-2 sm:px-4 lg:px-6 py-3 text-center text-sm">
          <div>&copy; {currentYear} Aximake. All rights reserved. <span className="hidden sm:inline">• Made in India 🇮🇳</span></div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
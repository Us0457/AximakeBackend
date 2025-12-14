import React from "react";

const TermsAndConditionsPage = () => (
  <div className="max-w-3xl mx-auto px-4 py-12 text-foreground bg-white rounded-lg shadow-lg border border-gray-200">
    <h1 className="text-3xl md:text-4xl font-bold mb-6 text-center text-primary">Terms & Conditions</h1>
    <p className="mb-4 text-lg text-center">Welcome to Axi! By accessing or using our website and services, you agree to be bound by the following terms and conditions. Please read them carefully.</p>
    <div className="divide-y divide-gray-200">
      <section className="py-6">
        <h2 className="text-2xl font-semibold mb-2 text-primary">1. Use of Our Service</h2>
        <ul className="list-disc pl-6 space-y-1 text-base">
          <li>You must be at least 18 years old or have parental consent to use our services.</li>
          <li>You agree to provide accurate and complete information when placing an order.</li>
          <li>Use of our website for unlawful purposes is strictly prohibited.</li>
        </ul>
      </section>
      <section className="py-6">
        <h2 className="text-2xl font-semibold mb-2 text-primary">2. Orders & Payments</h2>
        <ul className="list-disc pl-6 space-y-1 text-base">
          <li>All orders are subject to acceptance and availability.</li>
          <li>Prices are subject to change without notice.</li>
          <li>Payment must be made in full before production begins.</li>
        </ul>
      </section>
      <section className="py-6">
        <h2 className="text-2xl font-semibold mb-2 text-primary">3. Intellectual Property</h2>
        <ul className="list-disc pl-6 space-y-1 text-base">
          <li>All content on this website, including text, graphics, logos, and images, is the property of Axi or its licensors.</li>
          <li>You may not reproduce, distribute, or use any content without our written permission.</li>
        </ul>
      </section>
      <section className="py-6">
        <h2 className="text-2xl font-semibold mb-2 text-primary">4. Limitation of Liability</h2>
        <ul className="list-disc pl-6 space-y-1 text-base">
          <li>We strive to provide accurate information, but we do not guarantee that our website will be error-free or uninterrupted.</li>
          <li>Axi is not liable for any indirect, incidental, or consequential damages arising from your use of our services.</li>
        </ul>
      </section>
      <section className="py-6">
        <h2 className="text-2xl font-semibold mb-2 text-primary">5. Returns & Refunds</h2>
        <ul className="list-disc pl-6 space-y-1 text-base">
          <li>Custom 3D printed products are non-refundable unless defective or damaged upon arrival.</li>
          <li>Contact us within 7 days of receiving your order to request a return or report an issue.</li>
        </ul>
      </section>
      <section className="py-6">
        <h2 className="text-2xl font-semibold mb-2 text-primary">6. Changes to Terms</h2>
        <p className="text-base">We reserve the right to update these Terms & Conditions at any time. Changes will be posted on this page with an updated effective date.</p>
      </section>
      <section className="py-6">
        <h2 className="text-2xl font-semibold mb-2 text-primary">7. Contact Us</h2>
        <p className="text-base">If you have any questions about these Terms & Conditions, please contact us at <a href="mailto:admin@aximake.in" className="text-primary underline">admin@aximake.in</a>.</p>
      </section>
    </div>
  </div>
);

export default TermsAndConditionsPage;

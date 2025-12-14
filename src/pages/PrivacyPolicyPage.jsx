import React from "react";

const PrivacyPolicyPage = () => (
  <div className="max-w-3xl mx-auto px-4 py-12 text-foreground bg-white rounded-lg shadow-lg border border-gray-200">
    <h1 className="text-3xl md:text-4xl font-bold mb-6 text-center text-primary">Privacy Policy</h1>
    <p className="mb-4 text-lg text-center">At Axi, we are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website and use our services.</p>
    <div className="divide-y divide-gray-200">
      <section className="py-6">
        <h2 className="text-2xl font-semibold mb-2 text-primary">Information We Collect</h2>
        <ul className="list-disc pl-6 space-y-1 text-base">
          <li>Personal identification information (Name, email address, phone number, etc.)</li>
          <li>Order and payment details</li>
          <li>Usage data and cookies</li>
          <li>Any information you voluntarily provide via forms or communication</li>
        </ul>
      </section>
      <section className="py-6">
        <h2 className="text-2xl font-semibold mb-2 text-primary">How We Use Your Information</h2>
        <ul className="list-disc pl-6 space-y-1 text-base">
          <li>To process and fulfill your orders</li>
          <li>To communicate with you regarding your orders or inquiries</li>
          <li>To improve our website and services</li>
          <li>To send promotional emails (you can opt out at any time)</li>
          <li>To comply with legal obligations</li>
        </ul>
      </section>
      <section className="py-6">
        <h2 className="text-2xl font-semibold mb-2 text-primary">How We Protect Your Information</h2>
        <ul className="list-disc pl-6 space-y-1 text-base">
          <li>We use industry-standard security measures to protect your data</li>
          <li>Access to your personal information is restricted to authorized personnel only</li>
          <li>We do not sell or rent your personal information to third parties</li>
        </ul>
      </section>
      <section className="py-6">
        <h2 className="text-2xl font-semibold mb-2 text-primary">Cookies</h2>
        <p className="text-base">We use cookies to enhance your experience on our website. You can choose to disable cookies through your browser settings, but this may affect your ability to use certain features.</p>
      </section>
      <section className="py-6">
        <h2 className="text-2xl font-semibold mb-2 text-primary">Third-Party Services</h2>
        <p className="text-base">We may use third-party services for analytics, payment processing, and marketing. These providers have their own privacy policies, and we encourage you to review them.</p>
      </section>
      <section className="py-6">
        <h2 className="text-2xl font-semibold mb-2 text-primary">Your Rights</h2>
        <ul className="list-disc pl-6 space-y-1 text-base">
          <li>You can request access to, correction, or deletion of your personal data</li>
          <li>You can opt out of marketing communications at any time</li>
          <li>Contact us at <a href="mailto:admin@aximake.in" className="text-primary underline">admin@aximake.in</a> for any privacy-related requests</li>
        </ul>
      </section>
      <section className="py-6">
        <h2 className="text-2xl font-semibold mb-2 text-primary">Changes to This Policy</h2>
        <p className="text-base">We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated effective date.</p>
      </section>
      <section className="py-6">
        <h2 className="text-2xl font-semibold mb-2 text-primary">Contact Us</h2>
        <p className="text-base">If you have any questions about this Privacy Policy, please contact us at <a href="mailto:admin@aximake.in" className="text-primary underline">admin@aximake.in</a>.</p>
      </section>
    </div>
  </div>
);

export default PrivacyPolicyPage;

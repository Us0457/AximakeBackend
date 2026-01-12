import React from 'react';

const PrivacyPolicyPage = () => {
  return (
    <main className="mx-auto px-4 sm:px-6 lg:px-8 py-1">
      <article className="bg-white rounded-md shadow-sm p-6 md:p-1">
        <header className="mb-6">
          <h1 className="text-3xl font-extrabold leading-tight text-slate-900">Privacy Policy</h1>
          {/* <p className="mt-3 text-sm text-slate-600">This Privacy Policy describes how Aximake (“we”, “our”, “us”) collects, uses, discloses, and safeguards your personal information when you visit or make a purchase from our website.</p> */}
        </header>

        <section className="text-slate-700 space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">SECTION 1 – COLLECTION AND USE OF INFORMATION</h2>
            <p className="text-base leading-7 mb-2">When you make a purchase from our store, we collect the personal information you voluntarily provide to us, such as your name, billing address, shipping address, email address, and contact number, as part of the buying and selling process.</p>
            <p className="text-base leading-7 mb-2">When you browse our website, we may automatically collect certain information about your device, including your Internet Protocol (IP) address, browser type, and operating system. This information helps us understand how visitors use our website and allows us to improve our services and user experience.</p>
            <p className="text-base leading-7"><strong>Email Communications:</strong> With your consent, we may send you emails regarding your order, new products, updates, promotional offers, or other information related to our services. You may opt out of such communications at any time.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">SECTION 2 – CONSENT</h2>
            <p className="text-base leading-7 mb-2"><strong>How do we obtain your consent?</strong></p>
            <p className="text-base leading-7 mb-2">When you provide personal information to complete a transaction, place an order, verify payment, arrange for delivery, or request a return, you consent to the collection and use of that information solely for the purpose for which it was provided.</p>
            <p className="text-base leading-7 mb-2">If we require your personal information for any secondary purpose, such as marketing or promotional communication, we will either seek your explicit consent or provide you with a clear option to decline.</p>
            <p className="text-base leading-7"><strong>How can you withdraw your consent?</strong></p>
            <p className="text-base leading-7">If you choose to withdraw your consent after opting in, you may do so at any time by responding to our emails, or contacting us via phone or WhatsApp. Withdrawal of consent may limit our ability to provide certain services.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">SECTION 3 – DISCLOSURE OF INFORMATION</h2>
            <p className="text-base leading-7">We may disclose your personal information if required to do so by law, regulation, legal process, or governmental request, or if you violate our Terms of Service.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">SECTION 4 – THIRD-PARTY SERVICES</h2>
            <p className="text-base leading-7 mb-2">In general, third-party service providers engaged by us will collect, use, and disclose your information only to the extent necessary to perform the services they provide to us.</p>
            <p className="text-base leading-7 mb-2">Certain third-party service providers, such as payment gateways and payment processors, have their own privacy policies governing the information required to process your transactions. We encourage you to review their privacy policies to understand how your personal information is handled.</p>
            <p className="text-base leading-7 mb-2">All direct payment gateways comply with the PCI-DSS (Payment Card Industry Data Security Standard) as managed by the PCI Security Standards Council, ensuring secure handling of credit and debit card information.</p>
            <p className="text-base leading-7">Please note that some third-party service providers may be located in jurisdictions different from yours or ours. If you proceed with a transaction involving such services, your information may be subject to the laws of those jurisdictions. Once you leave our website or are redirected to a third-party website or application, you are no longer governed by this Privacy Policy or our Terms of Service.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">SECTION 5 – DATA SECURITY</h2>
            <p className="text-base leading-7">We take reasonable and appropriate security measures and follow industry best practices to protect your personal information from unauthorized access, loss, misuse, alteration, disclosure, or destruction. However, no method of transmission over the internet or electronic storage is completely secure, and we cannot guarantee absolute security.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">SECTION 6 – COOKIES</h2>
            <p className="text-base leading-7">We use cookies and similar technologies to enhance your browsing experience, analyze website traffic, and improve our services. Cookies are small data files stored on your device that help us understand user interactions with our website. Most web browsers automatically accept cookies, but you may modify your browser settings to refuse cookies or alert you when cookies are being sent. Please note that disabling cookies may affect the functionality of certain features of our website.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">SECTION 7 – CHANGES TO THIS PRIVACY POLICY</h2>
            <p className="text-base leading-7">We reserve the right to update or modify this Privacy Policy at any time. Any changes will take effect immediately upon posting on the website. If material changes are made, we will update this page to reflect what information we collect, how it is used, and under what circumstances it may be disclosed. In the event of a merger, acquisition, or transfer of ownership, your personal information may be transferred to the new entity to ensure continuity of service.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">QUESTIONS AND CONTACT INFORMATION</h2>
            <p className="text-base leading-7">If you would like to access, correct, amend, or delete any personal information we hold about you, register a complaint, or request additional information, please contact us at:</p>
            <p className="text-base leading-7 mt-2">support@aximake.com</p>
          </div>
        </section>
      </article>
    </main>
  );
};

export default PrivacyPolicyPage;

import React from 'react';

const TermsAndConditionsPage = () => {
  return (
    <main className="mx-auto px-4 sm:px-6 lg:px-8 py-1">
      <article className="bg-white rounded-md shadow-sm p-6 md:p-10">
        <header className="mb-6">
          <h1 className="text-3xl font-extrabold leading-tight text-slate-900">TERMS AND CONDITIONS</h1>
          {/* <p className="mt-3 text-sm text-slate-600">Welcome to Aximake. By accessing, browsing, or making a purchase through our website, you acknowledge that you have read, understood, and agreed to be bound by these Terms and Conditions, along with any related policies referenced herein.</p> */}
        </header>

        <section className="text-slate-700 space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">1. INTRODUCTION &amp; ACCEPTANCE</h2>
            <p className="text-base leading-7">Welcome to Aximake. This website is owned and operated by Aximake. Throughout this document, the terms “Aximake,” “we,” “us,” and “our” refer to the company operating this website and its services.</p>
            <p className="text-base leading-7">By accessing, browsing, or making a purchase through our website, you acknowledge that you have read, understood, and agreed to be bound by these Terms and Conditions, along with any related policies referenced herein. These Terms apply to all users of the website, including visitors, customers, vendors, and contributors of content.</p>
            <p className="text-base leading-7">If you do not agree with any part of these Terms, you must discontinue use of the website and services immediately.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">2. USE OF THE WEBSITE</h2>
            <p className="text-base leading-7">By using this website, you confirm that:</p>
            <ul className="list-disc list-inside text-base leading-7 space-y-1 mt-2">
              <li>You are legally capable of entering into a binding agreement under applicable laws, or</li>
              <li>You are using the website under the supervision and consent of a legal guardian.</li>
            </ul>
            <p className="text-base leading-7 mt-2">You agree to use the website and its services strictly for lawful purposes and in compliance with all applicable regulations. Any misuse, unauthorized activity, or violation of these Terms may result in suspension or termination of access.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">3. ACCOUNTABILITY &amp; USER RESPONSIBILITIES</h2>
            <p className="text-base leading-7">You must not:</p>
            <ul className="list-disc list-inside text-base leading-7 space-y-1 mt-2">
              <li>Engage in fraudulent, illegal, or misleading activities</li>
              <li>Upload or transmit malicious software, viruses, or harmful code</li>
              <li>Interfere with the functionality, security, or integrity of the website</li>
              <li>Attempt to gain unauthorized access to systems or data</li>
            </ul>
            <p className="text-base leading-7 mt-2">Any breach of these obligations may result in immediate restriction or termination of services.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">4. GENERAL CONDITIONS</h2>
            <p className="text-base leading-7">Aximake reserves the right to refuse service to any individual or entity at its discretion, without obligation to provide justification.</p>
            <p className="text-base leading-7 mt-2">Non-payment-related content transmitted through the website may pass through multiple networks and systems. All payment-related information is encrypted and handled using industry-standard security practices.</p>
            <p className="text-base leading-7 mt-2">No part of the website or its services may be copied, resold, or exploited without prior written authorization from Aximake.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">5. INFORMATION ACCURACY &amp; SITE CONTENT</h2>
            <p className="text-base leading-7">All content provided on this website is intended for general informational purposes only. While we strive for accuracy, Aximake does not guarantee that all information is complete, current, or error-free.</p>
            <p className="text-base leading-7 mt-2">We reserve the right to modify, update, or remove website content at any time without prior notice. It is your responsibility to stay informed of any changes.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">6. PRICING, SERVICES &amp; AVAILABILITY</h2>
            <p className="text-base leading-7">Product prices, service offerings, and availability are subject to change without notice.</p>
            <p className="text-base leading-7 mt-2">Aximake may modify, suspend, or discontinue any product, service, or feature at its sole discretion. We shall not be held liable for such changes or discontinuations.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">7. PRODUCTS &amp; ORDERS</h2>
            <p className="text-base leading-7">Certain products or services may be available exclusively online and may be offered in limited quantities.</p>
            <p className="text-base leading-7 mt-2">We reserve the right to:</p>
            <ul className="list-disc list-inside text-base leading-7 space-y-1 mt-2">
              <li>Limit sales by customer, location, or order quantity</li>
              <li>Refuse or cancel orders suspected of resale, abuse, or policy violation</li>
              <li>Discontinue any product at any time</li>
            </ul>
            <p className="text-base leading-7 mt-2">Product images and descriptions are presented as accurately as possible; however, variations may occur due to device display differences.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">8. BILLING &amp; PAYMENT INFORMATION</h2>
            <p className="text-base leading-7">You agree to provide accurate, current, and complete billing and account information for all purchases.</p>
            <p className="text-base leading-7 mt-2">Aximake reserves the right to cancel or restrict orders if discrepancies, inaccuracies, or suspicious activity are identified. In such cases, we may attempt to notify you using the contact details provided at checkout.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">9. OPTIONAL &amp; THIRD-PARTY SERVICES</h2>
            <p className="text-base leading-7">We may offer access to third-party tools, platforms, or integrations. These services are provided “as is” and “as available”, without warranties or endorsements from Aximake.</p>
            <p className="text-base leading-7 mt-2">Use of third-party services is entirely at your own discretion and subject to their respective terms and policies.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">10. EXTERNAL LINKS</h2>
            <p className="text-base leading-7">The website may include links to third-party websites not operated by Aximake. We do not control or assume responsibility for their content, accuracy, or practices.</p>
            <p className="text-base leading-7 mt-2">Any interaction or transaction with third-party platforms is solely between you and the respective provider.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">11. FEEDBACK, COMMENTS &amp; SUBMISSIONS</h2>
            <p className="text-base leading-7">Any feedback, ideas, suggestions, or materials submitted to Aximake may be used, reproduced, or distributed without restriction or obligation.</p>
            <p className="text-base leading-7 mt-2">You agree that your submissions:</p>
            <ul className="list-disc list-inside text-base leading-7 space-y-1 mt-2">
              <li>Do not violate third-party rights</li>
              <li>Do not contain unlawful, abusive, or harmful content</li>
              <li>Are accurate and truthful to the best of your knowledge</li>
            </ul>
            <p className="text-base leading-7 mt-2">You remain solely responsible for the content you submit.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">12. PERSONAL INFORMATION</h2>
            <p className="text-base leading-7">The collection and use of personal information through the website are governed by our Privacy Policy, which forms an integral part of these Terms.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">13. ERRORS &amp; CORRECTIONS</h2>
            <p className="text-base leading-7">Occasionally, information on the website may contain inaccuracies related to product details, pricing, availability, or promotions.</p>
            <p className="text-base leading-7 mt-2">Aximake reserves the right to correct such issues, update information, or cancel affected orders at any time, including after an order has been placed.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">14. PROHIBITED ACTIVITIES</h2>
            <p className="text-base leading-7">You are prohibited from using the website or its content to:</p>
            <ul className="list-disc list-inside text-base leading-7 space-y-1 mt-2">
              <li>Violate laws or regulations</li>
              <li>Infringe intellectual property rights</li>
              <li>Harass, abuse, or discriminate against others</li>
              <li>Spread malware or malicious code</li>
              <li>Collect or misuse personal data</li>
              <li>Circumvent security measures</li>
            </ul>
            <p className="text-base leading-7 mt-2">Violation of these restrictions may result in termination of access and legal action where applicable.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">15. DISCLAIMER &amp; LIMITATION OF LIABILITY</h2>
            <p className="text-base leading-7">All services, products, and content provided by Aximake are offered “as is” and “as available”, without warranties of any kind, express or implied.</p>
            <p className="text-base leading-7 mt-2">Aximake shall not be liable for any indirect, incidental, special, or consequential damages arising from the use or inability to use the website, products, or services.</p>
            <p className="text-base leading-7 mt-2">Any repairs or replacements required due to misuse, negligence, or unauthorized handling by the customer may be chargeable. Please refer to our Returns Policy for further details.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">16. INDEMNIFICATION</h2>
            <p className="text-base leading-7">You agree to indemnify and hold harmless Aximake, its affiliates, employees, partners, and service providers from any claims, damages, or expenses arising from your breach of these Terms or violation of applicable laws.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">17. SEVERABILITY</h2>
            <p className="text-base leading-7">If any provision of these Terms is held to be invalid or unenforceable, the remaining provisions shall continue to remain in full force and effect.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">18. TERMINATION</h2>
            <p className="text-base leading-7">These Terms remain effective unless terminated by either party.</p>
            <p className="text-base leading-7 mt-2">Aximake reserves the right to suspend or terminate access to the website or services without prior notice if a violation of these Terms is suspected or confirmed.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">19. ENTIRE AGREEMENT</h2>
            <p className="text-base leading-7">These Terms, together with our Privacy Policy and other referenced policies, constitute the complete agreement between you and Aximake and supersede any prior understandings or communications.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">20. GOVERNING LAW</h2>
            <p className="text-base leading-7">These Terms shall be governed by and interpreted in accordance with the laws applicable in India.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">21. CHANGES TO TERMS</h2>
            <p className="text-base leading-7">Aximake may update or revise these Terms at any time. Continued use of the website after changes are posted constitutes acceptance of the revised Terms.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">22. CONTACT INFORMATION</h2>
            <p className="text-base leading-7">For questions or concerns regarding these Terms, please contact us at:</p>
            <p className="text-base leading-7 mt-2">support@aximake.com</p>
          </div>
        </section>
      </article>
    </main>
  );
};

export default TermsAndConditionsPage;

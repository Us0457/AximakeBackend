import React from 'react';
export default function ShippingPolicy() {
  return (
    <main className="mx-auto px-4 sm:px-6 lg:px-8 py-1">
      <article className="bg-white rounded-md shadow-sm p-6 md:p-10">
        <header className="mb-6">
          <h1 className="text-3xl font-extrabold leading-tight text-slate-900">Shipping Policy</h1>
          {/* <p className="mt-3 text-sm text-slate-600">At Aximake we are committed to delivering your order safely, accurately and on time.</p> */}
        </header>

        <section className="text-slate-700">
          <div className="mb-6">
            <p className="text-base leading-7">At Aximake we are committed to delivering your electronic components and custom 3D‑printed parts safely, accurately and on time. This Shipping Policy explains how we process and dispatch orders, what to expect in delivery, and how we handle damaged or tampered packages.</p>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-3">Order Processing &amp; Dispatch</h2>
            <p className="text-base leading-7 mb-2">Orders are usually processed and shipped within 0–2 business days from the date of order confirmation. For custom 3D‑printed parts, very large orders, or temporary stock unavailability, dispatch may take up to 5 working days.</p>
            <p className="text-base leading-7">We ship Monday through Saturday, excluding public holidays. Orders placed on Sundays or public holidays are processed on the next working day.</p>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-3">Delivery Estimates</h2>
            <p className="text-base leading-7">Estimated delivery times shown at checkout are provided as guidance and depend on your location, courier operations, and external factors beyond our control. We work with reliable courier partners to help ensure deliveries meet estimated timelines.</p>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-3">Dispatch Delays &amp; Custom Items</h2>
            <p className="text-base leading-7 mb-2">Custom parts require additional time for production and quality checks. When an item is custom-made we clearly indicate the expected dispatch time at the product page or during checkout.</p>
            <p className="text-base leading-7">If an unexpected delay occurs (for example, supplier delays or sudden stock shortages) we will notify you and provide an updated dispatch estimate. Our communications will be clear and helpful.</p>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-3">Shipping Partners</h2>
            <p className="text-base leading-7">We use reputed courier partners for all shipments to provide secure and trackable delivery. Courier assignment is made based on destination, parcel type, and service availability. Tracking details will be shared by email and in your order status once the shipment is dispatched.</p>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-3">Split Shipments</h2>
            <p className="text-base leading-7">To get your items to you as quickly and safely as possible, an order containing multiple products (for example, electronic components and one or more custom 3D parts) may be dispatched in separate shipments. When a split shipment occurs, tracking information for each parcel will be provided and you will be informed of the split.</p>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-3">Tracking Your Order</h2>
            <p className="text-base leading-7 mb-2">Once your order is dispatched, you will receive tracking information by email. Use the tracking number with the courier’s website or tracking service to follow the parcel.</p>
            <p className="text-base leading-7">If you do not receive tracking details within a reasonable time after dispatch, contact our support team and we will assist.</p>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-3">Damaged or Tampered Packages</h2>
            <p className="text-base leading-7 mb-2">If a package appears damaged, opened or tampered with at delivery, please do not accept the shipment if possible.</p>
            <p className="text-base leading-7">If you accept it, note the condition with the delivery person and retain all packaging. Contact Aximake immediately with your order reference, courier name and tracking number, and photographs of the damage and the packaging. We will guide you through the next steps and help resolve the issue.</p>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-3">Invoice &amp; Tax Compliance</h2>
            <p className="text-base leading-7">As required under Indian tax regulations, all shipments include a tax invoice that lists the product value. This invoice is provided with the shipment and is also available in your order records on our website.</p>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-3">Returns &amp; Exchanges (Delivery‑Related)</h2>
            <p className="text-base leading-7">If a delivery issue affects your ability to return or exchange an item, please contact our support team for help. We aim to provide clear instructions and assistance for resolution.</p>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-3">Our Commitment</h2>
            <p className="text-base leading-7">Aximake is committed to delivering your order in good condition and within the timelines we advertise. We continuously work with our logistics partners to provide secure, reliable delivery and prompt support whenever you need assistance.</p>
          </div>

          <div className="mb-1">
            <h2 className="text-xl font-semibold text-slate-900 mb-3">Contact Us</h2>
            <p className="text-base leading-7">Support Email: <a className="text-slate-800 underline" href="mailto:support@aximake.com">support@aximake.com</a></p>
            <p className="text-base leading-7">Contact Number: <a className="text-slate-800 underline" href="tel:+916206676009">+91 62066 76009</a></p>
          </div>
        </section>
      </article>
    </main>
  );
}

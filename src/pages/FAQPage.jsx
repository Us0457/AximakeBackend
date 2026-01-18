import React, { useEffect } from 'react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';

const FAQPage = () => {
  useEffect(() => {
    document.title = 'FAQ — Aximake';
  }, []);

  return (
    <div className="container mx-auto px-2 sm:px-4 lg:px-6 py-12">
      <h1 className="text-3xl font-bold mb-4">Frequently Asked Questions</h1>
      <p className="text-muted-foreground mb-8">Answers to common questions about orders, shipping, refunds, 3D printing, custom kits, and more.</p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Orders</h2>
        <Accordion type="single" collapsible className="space-y-2">
          <AccordionItem value="order-placement">
            <AccordionTrigger className="py-3 text-left">How do I place an order?</AccordionTrigger>
            <AccordionContent>
              Add items to your cart, go to checkout, enter shipping and payment details, and confirm the order. You will receive an order confirmation email with the order reference.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="modify-after-checkout">
            <AccordionTrigger className="py-3 text-left">Can I modify my order after checkout?</AccordionTrigger>
            <AccordionContent>
              Minor changes (shipping address, phone number) may be possible if the order is not yet processed. Contact support immediately with your order number — modifications are time-sensitive and not guaranteed.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="order-confirmation-tracking">
            <AccordionTrigger className="py-3 text-left">When will I get order confirmation and tracking?</AccordionTrigger>
            <AccordionContent>
              You will receive an order confirmation email right after payment clears. Once the order ships, we send tracking details by email and update your dashboard under "Your Orders".
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="failed-duplicate-payments">
            <AccordionTrigger className="py-3 text-left">What if my payment failed or I was charged twice?</AccordionTrigger>
            <AccordionContent>
              Failed payments are not recorded as confirmed orders. Duplicate charges can occur with some banks — if you see multiple charges, contact us with the payment reference and we will investigate and refund any accidental duplicates.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="bulk-orders">
            <AccordionTrigger className="py-3 text-left">Do you support bulk or business orders?</AccordionTrigger>
            <AccordionContent>
              Yes. For bulk pricing, lead times, and invoicing, contact our business sales team via contact@aximake.com with your requirements and estimated quantities.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Cancellation</h2>
        <Accordion type="single" collapsible className="space-y-2">
          <AccordionItem value="cancellation-eligibility">
            <AccordionTrigger className="py-3 text-left">When can I cancel my order?</AccordionTrigger>
            <AccordionContent>
              Orders can be cancelled before production/fulfilment starts. Eligibility depends on the order status — check your order page or contact support immediately to request cancellation.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="partial-cancellations">
            <AccordionTrigger className="py-3 text-left">Can I cancel part of my order (partial cancellation)?</AccordionTrigger>
            <AccordionContent>
              Partial cancellations may be possible for multi-item orders if the other items have not been processed. Contact support with item details and order number.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="in-production">
            <AccordionTrigger className="py-3 text-left">What if my order is already in production?</AccordionTrigger>
            <AccordionContent>
              Once in production we cannot guarantee cancellations. We will assess case-by-case; refunds for items already produced may be partial after deduction of production costs.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="custom-made-cancellations">
            <AccordionTrigger className="py-3 text-left">Can I cancel custom or made-to-order items?</AccordionTrigger>
            <AccordionContent>
              Custom items are subject to stricter cancellation rules. If production hasn't started we will attempt a cancellation; if printing or assembly has begun, cancellation may not be possible.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Shipping & Delivery</h2>
        <Accordion type="single" collapsible className="space-y-2">
          <AccordionItem value="shipping-timelines">
            <AccordionTrigger className="py-3 text-left">How long does shipping take?</AccordionTrigger>
            <AccordionContent>
              Standard orders typically ship within the timeline shown on the product or at checkout. Custom 3D prints and kits may require additional production time — estimated lead times are shown on the product page.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="delivery-coverage">
            <AccordionTrigger className="py-3 text-left">Do you deliver to my area?</AccordionTrigger>
            <AccordionContent>
              We ship across our serviceable pincodes. Enter your pincode at checkout or contact support with your pincode for confirmation on serviceability and estimated delivery times.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="delayed-shipments">
            <AccordionTrigger className="py-3 text-left">What if my shipment is delayed?</AccordionTrigger>
            <AccordionContent>
              Delays can occur due to carrier issues or production backlogs. If your tracking shows no movement for an extended period, contact support and we will coordinate with the carrier and keep you updated.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="damaged-missing">
            <AccordionTrigger className="py-3 text-left">What if items arrive damaged or missing?</AccordionTrigger>
            <AccordionContent>
              Inspect your package on receipt and report damaged or missing items within 48 hours with photos and the packing slip. We will initiate return/replacement or partial refund as appropriate.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="international-shipping">
            <AccordionTrigger className="py-3 text-left">Do you ship internationally?</AccordionTrigger>
            <AccordionContent>
              International shipping is available for select products. Checkout will show international shipping options when supported. Import duties and customs are the customer's responsibility.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Refunds & Returns</h2>
        <Accordion type="single" collapsible className="space-y-2">
          <AccordionItem value="refund-eligibility">
            <AccordionTrigger className="py-3 text-left">When am I eligible for a refund?</AccordionTrigger>
            <AccordionContent>
              Refunds are issued for faulty, damaged, or not-as-described items, and in cases of successful cancellations as per our cancellation policy. Eligibility is assessed case-by-case.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="refund-timelines">
            <AccordionTrigger className="py-3 text-left">How long does a refund take?</AccordionTrigger>
            <AccordionContent>
              Refunds are processed within 7–14 business days after approval depending on the payment provider. We notify you by email when the refund is initiated.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="partial-refunds">
            <AccordionTrigger className="py-3 text-left">Will I receive a partial refund?</AccordionTrigger>
            <AccordionContent>
              Partial refunds may apply for returned items that are used or for orders partially cancelled after production costs are deducted. We will explain any deductions clearly.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="non-refundable">
            <AccordionTrigger className="py-3 text-left">Are any items non-refundable?</AccordionTrigger>
            <AccordionContent>
              Custom-made, personalised, or heavily modified items may be non-refundable once production has started. Check the product page and the customization terms before ordering.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">3D Printing Services</h2>
        <Accordion type="single" collapsible className="space-y-2">
          <AccordionItem value="materials-tech">
            <AccordionTrigger className="py-3 text-left">Which materials and technologies do you support?</AccordionTrigger>
            <AccordionContent>
              We support common FDM and SLA materials listed on the product page. Material options and technologies vary by product — check the specific service page or contact us for special materials.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="print-quality">
            <AccordionTrigger className="py-3 text-left">What quality and tolerances can I expect?</AccordionTrigger>
            <AccordionContent>
              Print quality depends on material, layer height, and post-processing. We provide typical tolerances on the service page. If your design requires tight tolerances, mention it during quote or contact support.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="design-responsibility">
            <AccordionTrigger className="py-3 text-left">Am I responsible for design readiness?</AccordionTrigger>
            <AccordionContent>
              Yes — files should be printable (STL/OBJ) and checked for watertight geometry, correct scale, and supported overhangs. We offer pre-print checks as part of some services; contact us for help.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="failed-prints">
            <AccordionTrigger className="py-3 text-left">What happens if a print fails?</AccordionTrigger>
            <AccordionContent>
              Failed prints are uncommon but can occur. We will assess the cause — material, file issues, or machine — and, where appropriate, offer a reprint or refund per our failure policy.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="size-limits">
            <AccordionTrigger className="py-3 text-left">Are there print size limitations?</AccordionTrigger>
            <AccordionContent>
              Yes — maximum build volume depends on the printer used. Large models may be printed in parts and assembled. Check the service page or ask support for large-format prints.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">3D Quote System</h2>
        <Accordion type="single" collapsible className="space-y-2">
          <AccordionItem value="how-quotes-work">
            <AccordionTrigger className="py-3 text-left">How are instant quotes calculated?</AccordionTrigger>
            <AccordionContent>
              Quotes consider material volume, print time, complexity, infill, finishing, and quantity. Our instant quote algorithm estimates these factors to give you a quick price — final quotes may change after manual review.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="pricing-factors">
            <AccordionTrigger className="py-3 text-left">What affects the price most?</AccordionTrigger>
            <AccordionContent>
              Material choice, part volume, print time, surface finish, and quantity are the biggest drivers. Complexity that increases print or post-processing time will raise the price.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="quote-validity">
            <AccordionTrigger className="py-3 text-left">How long is a quote valid?</AccordionTrigger>
            <AccordionContent>
              Quotes are typically valid for a limited time (shown on the quote). Prices may vary with material costs and demand — confirm before placing a bulk or time-sensitive order.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="estimate-vs-final">
            <AccordionTrigger className="py-3 text-left">Why might the final price differ from the estimate?</AccordionTrigger>
            <AccordionContent>
              Final pricing may change after manual inspection for manufacturability, supports, or unexpected material requirements. We will notify you before charging any additional amount.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Custom Printing</h2>
        <Accordion type="single" collapsible className="space-y-2">
          <AccordionItem value="custom-options">
            <AccordionTrigger className="py-3 text-left">What customization options are available?</AccordionTrigger>
            <AccordionContent>
              Options include material choice, color, surface finish, post-processing, and assembly. Some custom features may require extra setup fees — we will quote those separately.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="ownership-confidentiality">
            <AccordionTrigger className="py-3 text-left">Who owns the design and how is confidentiality handled?</AccordionTrigger>
            <AccordionContent>
              You retain ownership of your design. We treat customer files as confidential; sign an NDA for sensitive projects if required — contact sales for institutional or IP-sensitive work.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="approval-process">
            <AccordionTrigger className="py-3 text-left">Will I approve the print before production?</AccordionTrigger>
            <AccordionContent>
              For custom jobs we provide a production confirmation step when significant changes or costs are involved. You will receive a confirmation before we proceed with production.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="revisions">
            <AccordionTrigger className="py-3 text-left">What is the revisions and rework policy?</AccordionTrigger>
            <AccordionContent>
              Minor adjustments are often free before production begins. Rework after production may incur additional charges; we will discuss options if a reprint is required.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Custom Electronic Kits</h2>
        <Accordion type="single" collapsible className="space-y-2">
          <AccordionItem value="what-included">
            <AccordionTrigger className="py-3 text-left">What is included in a custom kit?</AccordionTrigger>
            <AccordionContent>
              Kits typically include PCB, components, connectors, and documentation. The product page lists exact contents. Assemblies, soldering, or enclosure options are specified per kit.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="moq">
            <AccordionTrigger className="py-3 text-left">Is there a minimum order quantity?</AccordionTrigger>
            <AccordionContent>
              Standard kits are available in single units. For custom-branded or bulk kit orders, minimum quantities may apply — contact sales for MOQ details.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="lead-times-kits">
            <AccordionTrigger className="py-3 text-left">How long does kit preparation take?</AccordionTrigger>
            <AccordionContent>
              Lead times depend on component availability and assembly complexity. Typical turnaround for simple kits is shown on the product page; custom kits take longer.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="support-docs">
            <AccordionTrigger className="py-3 text-left">Do you provide documentation and support for kits?</AccordionTrigger>
            <AccordionContent>
              Yes — kits include assembly guides and links to support resources. For bulk or custom kits we provide additional documentation and can offer onboarding support on request.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Additional Questions</h2>
        <Accordion type="single" collapsible className="space-y-2">
          <AccordionItem value="account-questions">
            <AccordionTrigger className="py-3 text-left">How do I update my account details?</AccordionTrigger>
            <AccordionContent>
              Go to your Dashboard → Personal Information to update name, address, and avatar. For email changes contact support for verification steps.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="warranty-support">
            <AccordionTrigger className="py-3 text-left">Do you provide warranty or support?</AccordionTrigger>
            <AccordionContent>
              Warranty and support vary by product. Electronic kits and printed parts may have limited warranty — check the product page or contact support for warranty specifics.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="bulk-discounts">
            <AccordionTrigger className="py-3 text-left">Are there discounts for bulk purchases or partnerships?</AccordionTrigger>
            <AccordionContent>
              Yes — we offer bulk discounts and partnership pricing. Contact our sales team with expected volumes and timelines for a tailored quote.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="data-privacy">
            <AccordionTrigger className="py-3 text-left">How do you handle file security and privacy?</AccordionTrigger>
            <AccordionContent>
              Customer files are stored securely and access is restricted. For highly sensitive files we recommend an NDA; consult our Privacy Policy for details on data handling.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>
    </div>
  );
};

export default FAQPage;

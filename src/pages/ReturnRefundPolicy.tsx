import Header from "@/components/Header";
import Footer from "@/components/Footer";

const ReturnRefundPolicy = () => (
  <div className="min-h-screen bg-background">
    <Header />
    <main className="container max-w-3xl py-12 md:py-16 prose prose-neutral prose-headings:font-heading prose-headings:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground">
      <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground">Return &amp; Replacement Policy</h1>
      <p className="text-sm text-muted-foreground">Last Updated: July 21, 2026</p>
      <p>At <strong>UVEDIQ</strong>, a brand owned by <strong>Leaf &amp; Kernel Superfoods Company</strong>, we are committed to delivering high-quality products. If there is an issue with your order, we're here to help.</p>

      <h2>1. Return &amp; Replacement Eligibility</h2>
      <p>We accept returns or replacements only in the following cases:</p>
      <ul>
        <li>You received a damaged product.</li>
        <li>You received the wrong product.</li>
        <li>The product is defective or unfit for use upon delivery.</li>
        <li>The product is missing from your order.</li>
      </ul>
      <p>To be eligible, you must notify us within <strong>48 hours</strong> of receiving your order.</p>

      <h2>2. Products Not Eligible for Return</h2>
      <p>For safety and hygiene reasons, we do not accept returns or exchanges for:</p>
      <ul>
        <li>Opened or used products.</li>
        <li>Products damaged due to improper storage or misuse after delivery.</li>
        <li>Products returned without their original packaging.</li>
        <li>Products returned after the eligible reporting period.</li>
        <li>Products purchased during clearance or special sale offers, unless damaged or incorrectly delivered.</li>
      </ul>

      <h2>3. How to Request a Return or Replacement</h2>
      <p>Please contact our Customer Support with:</p>
      <ul>
        <li>Your Order Number</li>
        <li>Product name</li>
        <li>A brief description of the issue</li>
        <li>Clear photographs of the product, packaging, and shipping label</li>
      </ul>
      <p>Our team will review your request and respond within <strong>2 business days</strong>.</p>

      <h2>4. Replacement Process</h2>
      <p>If approved, we will ship a replacement at no additional cost (subject to stock availability), or offer an alternative product of equal value.</p>

      <h2>5. Refunds</h2>
      <p>If a replacement cannot be arranged, a refund may be issued. Approved refunds are processed to the original payment method within <strong>5–10 business days</strong>. Shipping charges are non-refundable unless the return is due to our error.</p>

      <h2>6. Order Cancellation</h2>
      <p>Orders may be cancelled before they are shipped. Once dispatched, orders cannot be cancelled — but you may request a return or replacement if the product qualifies under this policy.</p>

      <h2>7. Quality Assurance</h2>
      <p>Our products undergo quality checks before dispatch. If you receive a product that appears damaged, leaking, or tampered with, please avoid using it and contact us immediately.</p>

      <h2>8. Important Notes</h2>
      <ul>
        <li>Minor variations in colour, texture, aroma, or taste may occur due to natural ingredients and do not qualify as defects.</li>
        <li>Product images are for illustration only. Actual packaging may vary slightly.</li>
        <li>UVEDIQ reserves the right to inspect the returned product before approving a replacement or refund.</li>
      </ul>

      <h2>9. Contact Us</h2>
      <p>
        <strong>LEAF AND KERNEL SUPERFOODS COMPANY</strong> (Brand: UVEDIQ)<br />
        <strong>Registered Office:</strong> Shop No. 4, Ground Floor, F-8/25, Sector 15, Rohini, New Delhi – 110089, India (Landmark: Near Happy Associates)<br />
        <strong>GSTIN:</strong> 07AANFL1400G1ZO · <strong>FSSAI:</strong> 13326998000385<br />
        <strong>Customer Care:</strong> <a href="mailto:customercare@leafandkernel.com">customercare@leafandkernel.com</a> | +91 8796745590<br />
        <strong>Business Hours:</strong> Monday to Saturday, 10:00 AM – 6:00 PM (IST)
      </p>
    </main>
    <Footer />
  </div>
);

export default ReturnRefundPolicy;
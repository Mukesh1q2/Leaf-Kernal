import Header from "@/components/Header";
import Footer from "@/components/Footer";

const ShippingPolicy = () => (
  <div className="min-h-screen bg-background">
    <Header />
    <main className="container max-w-3xl py-12 md:py-16 prose prose-neutral prose-headings:font-heading prose-headings:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground">
      <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground">Shipping Policy</h1>
      <p className="text-sm text-muted-foreground">Last Updated: July 21, 2026</p>
      <p>At <strong>UVEDIQ</strong>, a brand owned by <strong>Leaf &amp; Kernel Superfoods Company</strong>, we strive to deliver your orders safely and as quickly as possible.</p>

      <h2>1. Order Processing</h2>
      <ul>
        <li>Orders are processed within <strong>1–2 business days</strong> after successful payment confirmation.</li>
        <li>Orders placed on Sundays or public holidays will be processed on the next business day.</li>
        <li>During festivals, promotional sales, or unforeseen circumstances, order processing may take slightly longer.</li>
      </ul>

      <h2>2. Shipping &amp; Delivery</h2>
      <p>We currently ship across India. Estimated delivery timelines:</p>
      <ul>
        <li><strong>Metro Cities:</strong> 2–5 business days</li>
        <li><strong>Other Cities &amp; Towns:</strong> 3–7 business days</li>
        <li><strong>Remote Areas:</strong> 5–10 business days</li>
      </ul>
      <p>Timelines may vary depending on the courier partner and delivery location.</p>

      <h2>3. Shipping Charges</h2>
      <ul>
        <li>Shipping charges, if applicable, will be displayed during checkout before payment.</li>
        <li>We may offer <strong>free shipping</strong> on selected products, promotional campaigns, or orders above a specified value.</li>
      </ul>

      <h2>4. Order Tracking</h2>
      <p>Once dispatched, you will receive a shipping confirmation via email and/or SMS with your tracking details.</p>

      <h2>5. Delivery Attempts</h2>
      <ul>
        <li>Courier partners will make multiple delivery attempts if you are unavailable.</li>
        <li>If undelivered due to incorrect address, unavailable recipient, or refusal, the shipment may be returned.</li>
        <li>Additional charges may apply for re-dispatch.</li>
      </ul>

      <h2>6. Incorrect Shipping Information</h2>
      <p>Please ensure your address, contact number, and PIN code are accurate. UVEDIQ is not responsible for delays or failed deliveries due to incorrect details.</p>

      <h2>7. Damaged or Tampered Packages</h2>
      <p>If your package appears damaged, opened, or tampered with: do not accept it if damage is significant, take photographs, and contact us within <strong>48 hours</strong> of delivery.</p>

      <h2>8. Delays Beyond Our Control</h2>
      <p>Delays may occur due to weather, natural disasters, government restrictions, holidays, transport disruptions, or courier delays.</p>

      <h2>9. International Shipping</h2>
      <p>Currently, UVEDIQ ships only within India.</p>

      <h2>10. Contact Us</h2>
      <p><strong>UVEDIQ</strong> — Leaf &amp; Kernel Superfoods Company<br />
        Business Hours: Monday to Saturday, 10:00 AM – 6:00 PM (IST)</p>
    </main>
    <Footer />
  </div>
);

export default ShippingPolicy;
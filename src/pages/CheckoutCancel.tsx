import { Link } from "react-router-dom";
import { XCircle } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const CheckoutCancel = () => (
  <div className="min-h-screen bg-background">
    <Header />
    <main className="container py-16 text-center">
      <XCircle size={64} className="text-destructive mx-auto mb-6" />
      <h1 className="text-3xl font-heading font-bold text-foreground mb-3">Checkout Cancelled</h1>
      <p className="text-muted-foreground mb-8 max-w-md mx-auto">
        Your order was not placed. Don't worry — your cart items are still saved.
      </p>
      <div className="flex items-center justify-center gap-4">
        <Link to="/cart" className="px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-forest-light transition-colors">
          Return to Cart
        </Link>
        <Link to="/shop" className="px-6 py-3 border border-border text-foreground font-semibold rounded-lg hover:bg-muted transition-colors">
          Continue Shopping
        </Link>
      </div>
    </main>
    <Footer />
  </div>
);

export default CheckoutCancel;

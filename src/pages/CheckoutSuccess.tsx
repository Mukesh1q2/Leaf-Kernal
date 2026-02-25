import { Link } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const CheckoutSuccess = () => (
  <div className="min-h-screen bg-background">
    <Header />
    <main className="container py-16 text-center">
      <CheckCircle size={64} className="text-secondary mx-auto mb-6" />
      <h1 className="text-3xl font-heading font-bold text-foreground mb-3">Order Confirmed!</h1>
      <p className="text-muted-foreground mb-8 max-w-md mx-auto">
        Thank you for your purchase. You'll receive an email confirmation shortly with your order details.
      </p>
      <div className="flex items-center justify-center gap-4">
        <Link to="/account" className="px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-forest-light transition-colors">
          View Orders
        </Link>
        <Link to="/shop" className="px-6 py-3 border border-border text-foreground font-semibold rounded-lg hover:bg-muted transition-colors">
          Continue Shopping
        </Link>
      </div>
    </main>
    <Footer />
  </div>
);

export default CheckoutSuccess;

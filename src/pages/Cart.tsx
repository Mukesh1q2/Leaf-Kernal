import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, Loader2, Tag, Gift, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PincodeChecker from "@/components/PincodeChecker";
import CartBundleUpsell from "@/components/CartBundleUpsell";
import { useLoyaltyBalance, useLoyaltySettings, computeMaxRedeemable, pointsToRupees } from "@/lib/loyalty";
import { Star } from "lucide-react";
import ProductImage from "@/components/ProductImage";
import { emitCommerceEvent } from "@/lib/commerceEvents";
import {
  validateCouponWithBackend,
  fetchStorefrontPromotions,
  formatDiscountLabel,
  formatCouponTerms,
  isOfferEligibleForProduct,
  type StorefrontCoupon,
  type CouponCartItem,
} from "@/lib/couponPromotions";
import { fetchFreeShippingThreshold } from "@/lib/announcements";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface AppliedCouponInfo {
  code: string;
  discountAmount: number;
  discountType: "percentage" | "fixed" | "free_shipping";
  discountValue: number;
  maxDiscount?: number | null;
  freeShipping?: boolean;
  displayTitle?: string | null;
  displayMessage?: string | null;
}

const Cart = () => {
  const { items, loading, subtotal, updateQuantity, removeFromCart, clearCart } = useCart();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCouponInfo | null>(null);
  const [availableOffers, setAvailableOffers] = useState<StorefrontCoupon[]>([]);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState<number>(999);
  const { balance: loyaltyBalance, tier } = useLoyaltyBalance();
  const loyaltySettings = useLoyaltySettings();
  const [redeemPoints, setRedeemPoints] = useState(0);

  // Fetch free shipping threshold
  useEffect(() => {
    fetchFreeShippingThreshold().then((thresh) => {
      if (thresh && thresh > 0) setFreeShippingThreshold(thresh);
    });
  }, []);

  // Fetch active storefront promotions
  useEffect(() => {
    let mounted = true;
    fetchStorefrontPromotions().then((offers) => {
      if (mounted) {
        // Filter down to offers that are applicable to the current cart items or all
        const applicable = offers.filter((offer) => {
          if (!offer.applicable_to || offer.applicable_to === "all") return true;
          return items.some((item) =>
            isOfferEligibleForProduct(offer, item.product_id, (item.product as any)?.category_id || null)
          );
        });
        setAvailableOffers(applicable);
      }
    });
    return () => {
      mounted = false;
    };
  }, [items]);

  const shipping = appliedCoupon?.freeShipping ? 0 : subtotal >= freeShippingThreshold ? 0 : 79;
  const discount = appliedCoupon ? appliedCoupon.discountAmount : 0;
  const maxRedeemable = computeMaxRedeemable(loyaltyBalance, subtotal, loyaltySettings);
  const loyaltyDiscount = pointsToRupees(redeemPoints, loyaltySettings.redeemRate);
  const total = Math.max(subtotal + shipping - discount - loyaltyDiscount, 0);

  const applyCoupon = async (overrideCode?: string) => {
    const code = (overrideCode || couponCode).trim().toUpperCase();
    if (!code) return;
    setCouponLoading(true);

    const cartItemsPayload: CouponCartItem[] = items.map((i) => ({
      product_id: i.product_id,
      category_id: (i.product as any)?.category_id || null,
      price: i.product?.price || 0,
      quantity: i.quantity,
    }));

    const result = await validateCouponWithBackend(code, subtotal, cartItemsPayload, user?.id);

    if (!result.valid) {
      toast({
        title: "Coupon cannot be applied",
        description: result.error || "This coupon code is not valid.",
        variant: "destructive",
      });
      setCouponLoading(false);
      return;
    }

    setAppliedCoupon({
      code: result.code || code,
      discountAmount: Number(result.discount_amount) || 0,
      discountType: result.discount_type || "percentage",
      discountValue: Number(result.discount_value) || 0,
      maxDiscount: result.max_discount,
      freeShipping: Boolean(result.free_shipping),
      displayTitle: result.display_title,
      displayMessage: result.display_message,
    });
    setCouponCode(result.code || code);

    toast({
      title: "Coupon applied!",
      description: `${result.code} applied successfully — saved ₹${(result.discount_amount || 0).toFixed(2)}${
        result.free_shipping ? " (Free Shipping)" : ""
      }`,
    });
    setCouponLoading(false);
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
  };

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (window.Razorpay) { resolve(true); return; }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleCheckout = async () => {
    if (!user) {
      toast({ title: "Please sign in", description: "You need to be logged in to checkout.", variant: "destructive" });
      return;
    }

    setCheckoutLoading(true);
    try {
      emitCommerceEvent({
        eventName: "begin_checkout",
        itemCount: items.length,
        totalValue: total,
      });

      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error("Failed to load payment gateway");

      const { data, error } = await supabase.functions.invoke("create-razorpay-order", {
        body: {
          redeem_points: redeemPoints,
          coupon_code: appliedCoupon?.code || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const options = {
        key: data.razorpay_key_id,
        amount: data.amount,
        currency: data.currency,
        name: "Leaf & Kernel",
        description: "Superfood Order",
        order_id: data.razorpay_order_id,
        prefill: { email: data.user_email, name: data.user_name },
        theme: { color: "#1A4D2E" },
        handler: async (response: any) => {
          try {
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke("verify-razorpay-payment", {
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                order_id: data.order_id,
              },
            });
            if (verifyError) throw verifyError;
            if (verifyData?.error) throw new Error(verifyData.error);

            emitCommerceEvent({
              eventName: "purchase",
              orderId: data.order_id,
              totalValue: Number(data.amount) / 100,
              itemCount: items.length,
            });

            await clearCart();
            navigate("/checkout/success");
          } catch (e: any) {
            toast({ title: "Payment verification failed", description: e.message, variant: "destructive" });
          }
        },
        modal: {
          ondismiss: () => {
            setCheckoutLoading(false);
            toast({ title: "Payment cancelled", description: "You can try again anytime." });
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (response: any) => {
        toast({ title: "Payment failed", description: response.error?.description || "Please try again.", variant: "destructive" });
        setCheckoutLoading(false);
      });
      rzp.open();
    } catch (e: any) {
      toast({ title: "Checkout failed", description: e.message, variant: "destructive" });
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8 md:py-16">
        <h1 className="text-3xl font-heading font-bold text-foreground mb-8">Your Cart</h1>

        {items.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingBag size={48} className="text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-heading font-semibold text-foreground mb-2">Your cart is empty</h2>
            <p className="text-muted-foreground mb-6">Discover our plant-powered superfoods</p>
            <Link to="/shop" className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-forest-light transition-colors">
              Shop Now <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              {items.map(item => (
                <div key={item.id} className="flex gap-4 p-4 bg-background border border-border rounded-xl">
                  <Link to={`/product/${item.product.slug}`} className="w-20 h-20 rounded-lg bg-cream-dark overflow-hidden shrink-0">
                    <ProductImage
                      src={item.product.image_url}
                      slug={item.product.slug}
                      name={item.product.name}
                      className="w-full h-full object-cover"
                    />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/product/${item.product.slug}`} className="font-heading font-semibold text-foreground text-sm hover:text-secondary">{item.product.name}</Link>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-bold text-foreground">₹{item.product.price}</span>
                      {item.product.original_price && <span className="text-xs text-muted-foreground line-through">₹{item.product.original_price}</span>}
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center border border-border rounded-lg">
                        <button onClick={() => updateQuantity(item.product_id, item.quantity - 1)} className="p-1.5 hover:bg-muted"><Minus size={14} /></button>
                        <span className="px-3 text-sm">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.product_id, item.quantity + 1)} className="p-1.5 hover:bg-muted"><Plus size={14} /></button>
                      </div>
                      <button onClick={() => removeFromCart(item.product_id)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={16} /></button>
                    </div>
                  </div>
                </div>
              ))}
              <CartBundleUpsell />
            </div>

            <div className="bg-muted rounded-xl p-6 h-fit sticky top-24">
              <h3 className="font-heading font-semibold text-lg text-foreground mb-4">Order Summary</h3>
              
              {/* Coupon Section */}
              <div className="mb-4 pb-4 border-b border-border">
                {appliedCoupon ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between bg-primary/10 rounded-lg px-3 py-2.5 border border-primary/20">
                      <div className="flex items-center gap-2 min-w-0">
                        <Tag size={15} className="text-primary shrink-0" />
                        <div className="truncate">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-sm text-primary">{appliedCoupon.code}</span>
                            <span className="text-[11px] font-semibold bg-primary text-primary-foreground px-1.5 py-0.2 rounded">
                              {appliedCoupon.freeShipping
                                ? "Free Shipping"
                                : appliedCoupon.discountType === "percentage"
                                ? `${appliedCoupon.discountValue}% OFF`
                                : `₹${appliedCoupon.discountValue} OFF`}
                            </span>
                          </div>
                          {appliedCoupon.displayTitle && (
                            <p className="text-xs text-muted-foreground truncate">{appliedCoupon.displayTitle}</p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={removeCoupon}
                        className="text-xs text-destructive hover:underline font-medium shrink-0 ml-2"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Coupon code"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary font-mono uppercase"
                      />
                      <button
                        type="button"
                        onClick={() => applyCoupon(couponCode)}
                        disabled={couponLoading || !couponCode.trim()}
                        className="px-4 py-2 text-sm font-medium bg-secondary text-secondary-foreground rounded-lg hover:opacity-90 transition-colors disabled:opacity-50"
                      >
                        {couponLoading ? <Loader2 size={14} className="animate-spin" /> : "Apply"}
                      </button>
                    </div>

                    {availableOffers.length > 0 && (
                      <div className="pt-2">
                        <div className="flex items-center gap-1.5 mb-2">
                          <Gift size={13} className="text-primary" />
                          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                            Available Offers ({availableOffers.length})
                          </span>
                        </div>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                          {availableOffers.map((offer) => {
                            const discountBadge = formatDiscountLabel(offer);
                            const terms = formatCouponTerms(offer);
                            return (
                              <div
                                key={offer.id}
                                className="flex items-center justify-between p-2 rounded-lg bg-background border border-border hover:border-primary/40 transition-colors text-xs"
                              >
                                <div className="min-w-0 pr-2">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-primary">{discountBadge}</span>
                                    <span className="font-mono text-muted-foreground font-semibold">
                                      ({offer.code})
                                    </span>
                                  </div>
                                  {offer.display_title && (
                                    <p className="text-[11px] text-foreground font-medium truncate">
                                      {offer.display_title}
                                    </p>
                                  )}
                                  {terms && (
                                    <p className="text-[10px] text-muted-foreground truncate">{terms}</p>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => applyCoupon(offer.code)}
                                  disabled={couponLoading}
                                  className="px-2.5 py-1 text-xs font-semibold rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0"
                                >
                                  Apply
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-medium text-foreground">₹{subtotal.toFixed(2)}</span></div>
                {discount > 0 && (
                  <div className="flex justify-between text-primary"><span>Discount</span><span className="font-medium">-₹{discount.toFixed(2)}</span></div>
                )}
                {loyaltyDiscount > 0 && (
                  <div className="flex justify-between text-primary"><span>Loyalty ({redeemPoints} pts)</span><span className="font-medium">-₹{loyaltyDiscount.toFixed(2)}</span></div>
                )}
                <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span className="font-medium text-foreground">{shipping === 0 ? "FREE" : `₹${shipping}`}</span></div>
                {shipping > 0 && <p className="text-xs text-secondary">Add ₹{(freeShippingThreshold - subtotal).toFixed(0)} more for free shipping</p>}
                <div className="border-t border-border pt-3 flex justify-between text-base"><span className="font-semibold text-foreground">Total</span><span className="font-bold text-foreground">₹{total.toFixed(2)}</span></div>
              </div>

              {user && loyaltyBalance > 0 && (
                <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Star size={14} className="text-secondary fill-secondary" />
                      <span className="font-medium">Use Loyalty Points</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-secondary/20 text-secondary">{tier.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{loyaltyBalance} avail.</span>
                  </div>
                  {maxRedeemable > 0 ? (
                    <>
                      <input type="range" min={0} max={maxRedeemable} step={10} value={redeemPoints}
                        onChange={(e) => setRedeemPoints(Number(e.target.value))}
                        className="w-full accent-primary"
                      />
                      <div className="flex justify-between text-xs mt-1">
                        <span className="text-muted-foreground">{redeemPoints} pts → ₹{loyaltyDiscount.toFixed(2)}</span>
                        <button type="button" onClick={() => setRedeemPoints(maxRedeemable)} className="text-primary font-medium hover:underline">Max ({maxRedeemable})</button>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">Add more items to unlock redemption.</p>
                  )}
                </div>
              )}
              <button
                onClick={handleCheckout}
                disabled={checkoutLoading}
                className="w-full mt-6 py-3.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-forest-light transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {checkoutLoading ? <><Loader2 size={16} className="animate-spin" /> Processing...</> : "Pay with Razorpay"}
              </button>
              <p className="text-xs text-center text-muted-foreground mt-2">UPI, Cards, Net Banking & more</p>
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs font-medium text-muted-foreground mb-2">Check Delivery Availability</p>
                <PincodeChecker />
              </div>
              <Link to="/shop" className="block text-center text-sm text-secondary hover:underline mt-3">Continue Shopping</Link>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Cart;

import React, { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

declare global {
  interface Window {
    Razorpay: any;
  }
}

export interface RazorpayCheckoutButtonProps {
  /** Amount in INR (Rupees) */
  amount: number;
  currency?: string;
  name?: string;
  description?: string;
  receipt?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  buttonText?: string;
  className?: string;
  disabled?: boolean;
  onSuccess?: (paymentData: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  onError?: (error: Error) => void;
  onDismiss?: () => void;
}

export const RazorpayCheckoutButton: React.FC<RazorpayCheckoutButtonProps> = ({
  amount,
  currency = "INR",
  name = "Leaf & Kernel",
  description = "Superfood Order",
  receipt,
  prefill,
  buttonText,
  className,
  disabled = false,
  onSuccess,
  onError,
  onDismiss,
}) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(true));
        existing.addEventListener("error", () => resolve(false));
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayment = async () => {
    const amountInPaise = Math.round(amount * 100);

    if (amountInPaise < 100) {
      toast({
        title: "Invalid Amount",
        description: "Payment amount must be at least ₹1.00 (100 paise).",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error("Unable to load Razorpay checkout script.");
      }

      // Step 1: Call backend order creation endpoint
      const response = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountInPaise,
          currency,
          receipt: receipt || `rcpt_${Date.now()}`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create Razorpay order.");
      }

      const order = await response.json();
      const razorpayKey =
        order.razorpay_key_id ||
        import.meta.env.VITE_RAZORPAY_KEY_ID;

      // Step 2: Open Razorpay Checkout modal
      const options = {
        key: razorpayKey,
        amount: order.amount,
        currency: order.currency,
        name,
        description,
        order_id: order.order_id,
        prefill: {
          name: prefill?.name || "",
          email: prefill?.email || "",
          contact: prefill?.contact || "",
        },
        theme: {
          color: "#1A4D2E",
        },
        handler: async (paymentResponse: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          try {
            // Step 3: Call backend signature verification endpoint
            const verifyRes = await fetch("/api/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: paymentResponse.razorpay_order_id,
                razorpay_payment_id: paymentResponse.razorpay_payment_id,
                razorpay_signature: paymentResponse.razorpay_signature,
              }),
            });

            if (!verifyRes.ok) {
              const verifyError = await verifyRes.json().catch(() => ({}));
              throw new Error(verifyError.error || "Payment verification failed.");
            }

            toast({
              title: "Payment Successful",
              description: `Payment ID: ${paymentResponse.razorpay_payment_id}. Verified successfully.`,
            });

            if (onSuccess) {
              onSuccess(paymentResponse);
            }
          } catch (verifyErr: any) {
            toast({
              title: "Verification Failed",
              description: verifyErr.message || "Could not verify payment signature.",
              variant: "destructive",
            });
            if (onError) onError(verifyErr);
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            toast({
              title: "Payment Cancelled",
              description: "You cancelled the Razorpay payment window.",
            });
            if (onDismiss) onDismiss();
          },
        },
      };

      const rzpInstance = new window.Razorpay(options);
      rzpInstance.on("payment.failed", (failResponse: any) => {
        setLoading(false);
        const failMessage =
          failResponse.error?.description || "Payment failed. Please try again.";
        toast({
          title: "Payment Failed",
          description: failMessage,
          variant: "destructive",
        });
        if (onError) {
          onError(new Error(failMessage));
        }
      });

      rzpInstance.open();
    } catch (err: any) {
      setLoading(false);
      toast({
        title: "Checkout Error",
        description: err.message || "An error occurred while launching Razorpay checkout.",
        variant: "destructive",
      });
      if (onError) onError(err);
    }
  };

  return (
    <button
      type="button"
      onClick={handlePayment}
      disabled={disabled || loading}
      className={
        className ||
        "w-full py-3.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-forest-light transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      }
    >
      {loading ? (
        <>
          <Loader2 size={16} className="animate-spin" />
          <span>Processing Payment...</span>
        </>
      ) : (
        <>
          <ShieldCheck size={18} />
          <span>{buttonText || `Pay ₹${amount.toFixed(2)} with Razorpay`}</span>
        </>
      )}
    </button>
  );
};

export default RazorpayCheckoutButton;

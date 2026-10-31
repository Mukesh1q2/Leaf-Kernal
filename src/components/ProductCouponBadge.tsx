import React, { useState } from "react";
import { Tag, Copy, Check } from "lucide-react";
import { formatDiscountLabel, type StorefrontCoupon } from "@/lib/couponPromotions";
import { useToast } from "@/hooks/use-toast";

interface Props {
  offer: StorefrontCoupon;
  className?: string;
  compact?: boolean;
}

export const ProductCouponBadge: React.FC<Props> = ({ offer, className = "", compact = false }) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(offer.code);
    setCopied(true);
    toast({
      title: "Coupon code copied!",
      description: `Code ${offer.code} copied to clipboard (${formatDiscountLabel(offer)}).`,
    });
    setTimeout(() => setCopied(false), 2500);
  };

  const discountLabel = formatDiscountLabel(offer);

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleCopy}
        title={`Apply code ${offer.code} for ${discountLabel}`}
        aria-label={`Copy coupon code ${offer.code}`}
        className={`inline-flex items-center gap-1 text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors shadow-2xs ${className}`}
      >
        <Tag className="h-2.5 w-2.5 text-emerald-600 shrink-0" aria-hidden="true" />
        <span>{discountLabel}</span>
        <span className="font-mono opacity-80">({offer.code})</span>
        {copied ? (
          <Check className="h-2.5 w-2.5 text-emerald-700 ml-0.5" aria-hidden="true" />
        ) : (
          <Copy className="h-2.5 w-2.5 text-emerald-600 opacity-60 ml-0.5" aria-hidden="true" />
        )}
      </button>
    );
  }

  return (
    <div
      className={`flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-emerald-50/90 border border-emerald-200/80 text-emerald-950 ${className}`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <Tag className="h-3.5 w-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
        <div className="truncate">
          <span className="font-bold text-emerald-800">{discountLabel}</span>
          {offer.display_title && (
            <span className="text-muted-foreground ml-1 hidden sm:inline">
              · {offer.display_title}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-white text-emerald-900 border border-emerald-300 hover:bg-emerald-100 transition-colors shadow-2xs ml-2 shrink-0"
        aria-label={`Copy coupon code ${offer.code}`}
      >
        <span>{offer.code}</span>
        {copied ? (
          <Check className="h-3 w-3 text-emerald-700" aria-hidden="true" />
        ) : (
          <Copy className="h-3 w-3 text-emerald-600" aria-hidden="true" />
        )}
      </button>
    </div>
  );
};

export default ProductCouponBadge;

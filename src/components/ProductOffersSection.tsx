import { useEffect, useState } from "react";
import { Tag, Copy, Check, Gift } from "lucide-react";
import {
  fetchStorefrontPromotions,
  formatDiscountLabel,
  formatCouponTerms,
  type StorefrontCoupon,
} from "@/lib/couponPromotions";
import { useToast } from "@/hooks/use-toast";

interface Props {
  productId: string;
  categoryId?: string | null;
}

export const ProductOffersSection = ({ productId, categoryId }: Props) => {
  const [offers, setOffers] = useState<StorefrontCoupon[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchStorefrontPromotions({ productId, categoryId })
      .then((data) => {
        if (mounted) setOffers(data);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [productId, categoryId]);

  if (loading || offers.length === 0) return null;

  const handleCopy = (code: string, discountLabel: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast({
      title: "Coupon code copied!",
      description: `Code ${code} (${discountLabel}) copied. Apply it in your cart!`,
    });
    setTimeout(() => setCopiedCode(null), 3000);
  };

  return (
    <section aria-labelledby="product-offers-heading" className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Gift className="h-4 w-4 text-primary" aria-hidden="true" />
        <h3 id="product-offers-heading" className="text-sm font-semibold text-foreground">
          Available Offers & Promotions
        </h3>
      </div>

      <div className="space-y-2">
        {offers.map((offer) => {
          const discountLabel = formatDiscountLabel(offer);
          const terms = formatCouponTerms(offer);
          const isCopied = copiedCode === offer.code;

          return (
            <div
              key={offer.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-background border border-border hover:border-primary/40 transition-colors shadow-2xs"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">
                    {discountLabel}
                  </span>
                  {offer.display_title && (
                    <span className="text-xs font-medium text-foreground">
                      {offer.display_title}
                    </span>
                  )}
                </div>
                {offer.display_message && (
                  <p className="text-xs text-muted-foreground">{offer.display_message}</p>
                )}
                {terms && (
                  <p className="text-[11px] text-muted-foreground/80">{terms}</p>
                )}
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopy(offer.code, discountLabel)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono font-bold border border-primary/30 bg-primary/5 hover:bg-primary/15 text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                  aria-label={`Copy coupon code ${offer.code}`}
                >
                  <Tag className="h-3 w-3" aria-hidden="true" />
                  <span>{offer.code}</span>
                  {isCopied ? (
                    <Check className="h-3.5 w-3.5 text-green-600" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3 w-3 text-primary/70" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default ProductOffersSection;

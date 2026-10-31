import { useEffect, useState } from "react";
import { Sparkles, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  fetchActiveStorefrontAnnouncement,
  type ActiveStorefrontAnnouncement,
} from "@/lib/announcements";

export const StorefrontPromoStrip = () => {
  const [announcement, setAnnouncement] = useState<ActiveStorefrontAnnouncement | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;
    fetchActiveStorefrontAnnouncement()
      .then((active) => {
        if (mounted) {
          setAnnouncement(active);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Error loading storefront announcement bar:", err);
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  // When loading or when disabled/not scheduled, don't render an empty gap
  if (loading || !announcement) {
    return null;
  }

  const handleCopy = (code: string, discountLabel?: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast({
      title: "Coupon code copied!",
      description: `Use code ${code} at checkout to receive ${discountLabel || "your discount"}.`,
    });
    setTimeout(() => setCopiedCode(null), 3000);
  };

  const coupon = announcement.coupon;

  return (
    <aside
      role="region"
      aria-label="Store Announcement"
      className="bg-primary text-primary-foreground py-2 px-3 text-xs md:text-sm shadow-sm transition-all duration-200"
    >
      <div className="container mx-auto flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-center">
        {/* Announcement Message & Sparkles */}
        <div className="flex items-center gap-1.5 font-medium">
          <Sparkles className="h-3.5 w-3.5 text-secondary animate-pulse shrink-0" aria-hidden="true" />
          <span>{announcement.announcement_copy}</span>
        </div>

        {/* Linked Promotional Coupon Portion (Rendered ONLY if eligible public coupon exists) */}
        {coupon && (
          <div className="inline-flex flex-wrap items-center justify-center gap-1.5 font-normal">
            {/* Discount Badge */}
            {coupon.discount_label && (
              <span className="font-semibold text-secondary-foreground bg-secondary/90 px-2 py-0.5 rounded text-[11px] uppercase tracking-wider shrink-0">
                {coupon.discount_label}
              </span>
            )}

            {/* Custom Callout / Template Message */}
            {coupon.formatted_callout && (
              <span className="hidden sm:inline text-primary-foreground/90 text-xs">
                {coupon.formatted_callout}
              </span>
            )}

            {/* Terms Snippet */}
            {coupon.terms && (
              <span className="hidden md:inline text-[11px] text-primary-foreground/75 font-normal">
                ({coupon.terms})
              </span>
            )}

            {/* Accessible Interactive Copy Pill */}
            <div className="flex items-center gap-1 ml-0.5 shrink-0">
              <span className="text-primary-foreground/80 text-xs hidden sm:inline">Use code:</span>
              <button
                type="button"
                onClick={() => handleCopy(coupon.code, coupon.discount_label)}
                className="inline-flex items-center gap-1 font-mono font-bold bg-background text-foreground px-2 py-0.5 rounded text-xs hover:bg-muted transition-colors shadow-xs focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-1 focus:ring-offset-primary"
                aria-label={`Copy coupon code ${coupon.code}`}
              >
                <span>{coupon.code}</span>
                {copiedCode === coupon.code ? (
                  <Check className="h-3 w-3 text-green-600" aria-hidden="true" />
                ) : (
                  <Copy className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default StorefrontPromoStrip;

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Check, X, Loader2, Truck } from "lucide-react";

interface PincodeResult {
  available: boolean;
  city?: string;
  state?: string;
  cod_available?: boolean;
  estimated_days?: number;
}

const PincodeChecker = () => {
  const [pincode, setPincode] = useState("");
  const [result, setResult] = useState<PincodeResult | null>(null);
  const [loading, setLoading] = useState(false);

  const checkPincode = async () => {
    if (pincode.length !== 6) return;
    setLoading(true);
    setResult(null);

    const { data } = await supabase
      .from("serviceable_pincodes" as any)
      .select("*")
      .eq("pincode", pincode)
      .maybeSingle();

    if (data) {
      setResult({
        available: true,
        city: (data as any).city,
        state: (data as any).state,
        cod_available: (data as any).cod_available,
        estimated_days: (data as any).estimated_days,
      });
    } else {
      setResult({ available: false });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={pincode}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 6);
              setPincode(v);
              if (v.length < 6) setResult(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && checkPincode()}
            placeholder="Enter pincode"
            className="w-full pl-9 pr-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
            maxLength={6}
          />
        </div>
        <button
          onClick={checkPincode}
          disabled={pincode.length !== 6 || loading}
          className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check"}
        </button>
      </div>

      {result && (
        <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${result.available ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
          {result.available ? (
            <>
              <Check className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Delivery available to {result.city}, {result.state}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-green-700">
                  <span className="flex items-center gap-1"><Truck className="h-3 w-3" /> Est. {result.estimated_days} days</span>
                  {result.cod_available && <span>✓ COD available</span>}
                </div>
              </div>
            </>
          ) : (
            <>
              <X className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Sorry, we don't deliver to this pincode yet</p>
                <p className="text-xs mt-0.5">Try a nearby pincode or contact support</p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default PincodeChecker;

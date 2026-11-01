import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Check, X, Loader2, Truck, ShieldCheck } from "lucide-react";

interface PincodeResult {
  available: boolean;
  city?: string;
  state?: string;
  cod_available?: boolean;
  estimated_days?: number;
  message?: string;
}

// In-memory cache to prevent duplicate network/DB lookups during the session
const pincodeCache = new Map<string, PincodeResult>();

/**
 * Returns estimated business days and fallback state/region based on Indian postal zone prefixes
 */
function getZoneFallback(pincode: string): { state: string; days: number } {
  const prefix2 = parseInt(pincode.slice(0, 2), 10);
  if (prefix2 === 11) return { state: "Delhi NCR", days: 2 };
  if (prefix2 >= 12 && prefix2 <= 13) return { state: "Haryana", days: 3 };
  if (prefix2 >= 14 && prefix2 <= 16) return { state: "Punjab / Chandigarh", days: 3 };
  if (prefix2 === 17) return { state: "Himachal Pradesh", days: 4 };
  if (prefix2 >= 18 && prefix2 <= 19) return { state: "Jammu & Kashmir", days: 5 };
  if (prefix2 >= 20 && prefix2 <= 28) return { state: "Uttar Pradesh & Uttarakhand", days: 3 };
  if (prefix2 >= 30 && prefix2 <= 34) return { state: "Rajasthan", days: 4 };
  if (prefix2 >= 36 && prefix2 <= 39) return { state: "Gujarat", days: 4 };
  if (prefix2 >= 40 && prefix2 <= 44) return { state: "Maharashtra & Goa", days: 3 };
  if (prefix2 >= 45 && prefix2 <= 49) return { state: "Madhya Pradesh & Chhattisgarh", days: 4 };
  if (prefix2 >= 50 && prefix2 <= 53) return { state: "Andhra Pradesh & Telangana", days: 4 };
  if (prefix2 >= 56 && prefix2 <= 59) return { state: "Karnataka", days: 4 };
  if (prefix2 >= 60 && prefix2 <= 64) return { state: "Tamil Nadu & Puducherry", days: 4 };
  if (prefix2 >= 67 && prefix2 <= 69) return { state: "Kerala", days: 4 };
  if (prefix2 >= 70 && prefix2 <= 74) return { state: "West Bengal", days: 4 };
  if (prefix2 >= 75 && prefix2 <= 77) return { state: "Odisha", days: 5 };
  if (prefix2 >= 78 && prefix2 <= 79) return { state: "Assam & North East", days: 6 };
  if (prefix2 >= 80 && prefix2 <= 85) return { state: "Bihar & Jharkhand", days: 4 };
  return { state: "India", days: 5 };
}

const PincodeChecker = () => {
  const [pincode, setPincode] = useState("");
  const [result, setResult] = useState<PincodeResult | null>(null);
  const [loading, setLoading] = useState(false);

  const checkPincode = async () => {
    const cleanPin = pincode.trim();
    if (!/^[1-9][0-9]{5}$/.test(cleanPin)) {
      setResult({
        available: false,
        message: "Please enter a valid 6-digit Indian PIN code",
      });
      return;
    }

    if (pincodeCache.has(cleanPin)) {
      setResult(pincodeCache.get(cleanPin)!);
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // 1. Check local database for admin-configured overrides or custom rules
      const { data: dbData } = await supabase
        .from("serviceable_pincodes" as any)
        .select("*")
        .eq("pincode", cleanPin)
        .maybeSingle();

      if (dbData) {
        const res: PincodeResult = {
          available: true,
          city: (dbData as any).city || "Your City",
          state: (dbData as any).state || "India",
          cod_available: (dbData as any).cod_available ?? true,
          estimated_days: (dbData as any).estimated_days || 3,
        };
        pincodeCache.set(cleanPin, res);
        setResult(res);
        setLoading(false);
        return;
      }

      // 2. Query India Post live postal API for pan-India verification
      let apiResolved = false;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);
        const apiRes = await fetch(`https://api.postalpincode.in/pincode/${cleanPin}`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (apiRes.ok) {
          const json = await apiRes.json();
          if (Array.isArray(json) && json[0]?.Status === "Success" && Array.isArray(json[0]?.PostOffice) && json[0].PostOffice.length > 0) {
            const po = json[0].PostOffice[0];
            const city = po.District || po.Block || po.Circle || "Your City";
            const state = po.State || "India";
            const zone = getZoneFallback(cleanPin);

            const res: PincodeResult = {
              available: true,
              city,
              state,
              cod_available: true,
              estimated_days: zone.days,
            };
            pincodeCache.set(cleanPin, res);
            setResult(res);
            apiResolved = true;
          } else if (Array.isArray(json) && json[0]?.Status === "Error") {
            // Official postal registry confirmed no such pincode exists
            const res: PincodeResult = {
              available: false,
              message: "PIN code not found in postal registry. Please recheck your 6 digits.",
            };
            pincodeCache.set(cleanPin, res);
            setResult(res);
            apiResolved = true;
          }
        }
      } catch {
        // Fallback to zone heuristics if API fails or network timeout occurs
      }

      // 3. Fallback: If postal API timed out or network was offline, use zone heuristic
      if (!apiResolved) {
        const zone = getZoneFallback(cleanPin);
        const res: PincodeResult = {
          available: true,
          city: zone.state,
          state: "Pan-India Delivery",
          cod_available: true,
          estimated_days: zone.days,
        };
        pincodeCache.set(cleanPin, res);
        setResult(res);
      }
    } catch {
      setResult({
        available: false,
        message: "Unable to verify delivery right now. Doorstep delivery is available pan-India.",
      });
    } finally {
      setLoading(false);
    }
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
            placeholder="Enter 6-digit PIN code"
            className="w-full pl-9 pr-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-primary/20"
            maxLength={6}
          />
        </div>
        <button
          onClick={checkPincode}
          disabled={pincode.length !== 6 || loading}
          className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Checking...</span>
            </>
          ) : (
            "Check"
          )}
        </button>
      </div>

      {result && (
        <div
          className={`flex items-start gap-2.5 p-3 rounded-lg text-sm transition-all ${
            result.available
              ? "bg-green-500/10 text-green-900 dark:text-green-200 border border-green-500/30"
              : "bg-red-500/10 text-red-900 dark:text-red-200 border border-red-500/30"
          }`}
        >
          {result.available ? (
            <>
              <Check className="h-4 w-4 mt-0.5 text-green-600 dark:text-green-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-xs sm:text-sm">
                  Delivery available to {result.city}
                  {result.state && result.state !== result.city ? `, ${result.state}` : ""}
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-green-700 dark:text-green-300">
                  <span className="flex items-center gap-1">
                    <Truck className="h-3.5 w-3.5" /> Est. {result.estimated_days}–{Number(result.estimated_days) + 2} business days
                  </span>
                  {result.cod_available && (
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5" /> COD & Prepaid Available
                    </span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <X className="h-4 w-4 mt-0.5 text-red-600 dark:text-red-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-xs sm:text-sm">
                  {result.message || "Sorry, we don't deliver to this pincode yet"}
                </p>
                <p className="text-xs opacity-80 mt-0.5">
                  Try a nearby PIN code or contact customer care for assistance.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default PincodeChecker;

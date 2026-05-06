import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, TrendingUp, ArrowDown, ArrowUp, Crown, Award } from "lucide-react";
import { format } from "date-fns";
import { useLoyaltyBalance, useLoyaltySettings, pointsToRupees } from "@/lib/loyalty";

const LoyaltyPoints = () => {
  const { user } = useAuth();
  const { balance, lifetime, tier } = useLoyaltyBalance();
  const settings = useLoyaltySettings();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const load = async () => {
      const { data: hist } = await supabase.from("loyalty_points").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
      setHistory(hist || []);
      setLoading(false);
    };
    load();
  }, [user]);

  const pointsValue = pointsToRupees(balance, settings.redeemRate);
  const nextTier = tier.name === "Bronze" ? { name: "Silver", min: settings.silverMin } : tier.name === "Silver" ? { name: "Gold", min: settings.goldMin } : null;
  const tierIcon = tier.name === "Gold" ? <Crown className="h-5 w-5" /> : tier.name === "Silver" ? <Award className="h-5 w-5" /> : <Star className="h-5 w-5" />;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-12 max-w-3xl">
        <div className="text-center mb-10">
          <Star className="h-12 w-12 text-secondary mx-auto mb-4" />
          <h1 className="text-3xl font-heading font-bold text-foreground mb-2">Loyalty Points</h1>
          <p className="text-muted-foreground">Earn points on every purchase & redeem them for discounts</p>
        </div>

        {!user ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground mb-4">Please sign in to view your loyalty points</p>
              <Button asChild><a href="/auth">Sign In</a></Button>
            </CardContent>
          </Card>
        ) : loading ? (
          <p className="text-center text-muted-foreground">Loading...</p>
        ) : (
          <div className="space-y-6">
            {/* Balance card */}
            <Card className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
              <CardContent className="py-8 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/15 rounded-full text-xs mb-3">
                  {tierIcon}
                  <span className="font-medium">{tier.name} Tier · {tier.multiplier}x earnings</span>
                </div>
                <p className="text-sm opacity-80 mb-1">Available Points</p>
                <div className="text-5xl font-bold mb-2">{balance}</div>
                <p className="text-sm opacity-80">Worth ₹{pointsValue} in discounts</p>
                {nextTier && (
                  <div className="mt-4 max-w-xs mx-auto">
                    <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                      <div className="h-full bg-white" style={{ width: `${Math.min(100, (lifetime / nextTier.min) * 100)}%` }} />
                    </div>
                    <p className="text-xs opacity-80 mt-1">{nextTier.min - lifetime} pts to {nextTier.name}</p>
                  </div>
                )}
                <div className="mt-4 flex justify-center gap-4 text-xs opacity-70">
                  <span>🛒 1 pt per ₹{settings.earnPerRupees}</span>
                  <span>💰 {settings.redeemRate} pts = ₹1 off</span>
                </div>
              </CardContent>
            </Card>

            {/* How to earn */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Purchase", points: "1pt/₹10", icon: "🛒" },
                { label: "Review", points: "+50 pts", icon: "⭐" },
                { label: "Referral", points: "+200 pts", icon: "👥" },
                { label: "Birthday", points: "+100 pts", icon: "🎂" },
              ].map(item => (
                <Card key={item.label}>
                  <CardContent className="pt-4 pb-3 text-center">
                    <span className="text-2xl">{item.icon}</span>
                    <p className="text-xs font-medium mt-1">{item.label}</p>
                    <p className="text-xs text-primary font-bold">{item.points}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* History */}
            <Card>
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Points History</CardTitle></CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6">No points activity yet. Make your first purchase to start earning!</p>
                ) : (
                  <div className="divide-y divide-border">
                    {history.map(h => (
                      <div key={h.id} className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3">
                          {h.type === "earn" ? (
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center"><ArrowUp className="h-4 w-4 text-primary" /></div>
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center"><ArrowDown className="h-4 w-4 text-destructive" /></div>
                          )}
                          <div>
                            <p className="text-sm font-medium">{h.description || (h.type === "earn" ? "Points earned" : "Points redeemed")}</p>
                            <p className="text-xs text-muted-foreground">{format(new Date(h.created_at), "MMM dd, yyyy")}</p>
                          </div>
                        </div>
                        <Badge variant={h.type === "earn" ? "default" : "destructive"}>
                          {h.type === "earn" ? "+" : "-"}{Math.abs(h.points)} pts
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default LoyaltyPoints;

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Copy, Gift, Users, Check } from "lucide-react";

const ReferralProgram = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [referralCode, setReferralCode] = useState("");
  const [referrals, setReferrals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const load = async () => {
      // Get or create referral code
      const { data: existing } = await supabase.from("referral_codes").select("code").eq("user_id", user.id).single();
      if (existing) {
        setReferralCode(existing.code);
      } else {
        const code = `LK${user.id.slice(0, 6).toUpperCase()}`;
        await supabase.from("referral_codes").insert({ user_id: user.id, code });
        setReferralCode(code);
      }
      // Get referrals
      const { data: refs } = await supabase.from("referrals").select("*").eq("referrer_id", user.id).order("created_at", { ascending: false });
      setReferrals(refs || []);
      setLoading(false);
    };
    load();
  }, [user]);

  const copyCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    toast({ title: "Copied!", description: "Referral code copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const shareUrl = `${window.location.origin}/auth?ref=${referralCode}`;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-12 max-w-3xl">
        <div className="text-center mb-10">
          <Gift className="h-12 w-12 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-heading font-bold text-foreground mb-2">Refer & Earn</h1>
          <p className="text-muted-foreground">Share Leaf & Kernel with friends and earn rewards when they make their first purchase</p>
        </div>

        {!user ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground mb-4">Please sign in to access your referral program</p>
              <Button asChild><a href="/auth">Sign In</a></Button>
            </CardContent>
          </Card>
        ) : loading ? (
          <p className="text-center text-muted-foreground">Loading...</p>
        ) : (
          <div className="space-y-6">
            {/* How it works */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { step: "1", title: "Share Your Code", desc: "Send your unique referral code to friends" },
                { step: "2", title: "Friend Signs Up", desc: "They create an account using your code" },
                { step: "3", title: "Both Earn Rewards", desc: "You get ₹100 off, they get ₹50 off" },
              ].map(s => (
                <Card key={s.step}>
                  <CardContent className="pt-6 text-center">
                    <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-3 font-bold">{s.step}</div>
                    <h3 className="font-heading font-semibold mb-1">{s.title}</h3>
                    <p className="text-sm text-muted-foreground">{s.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Referral code */}
            <Card>
              <CardHeader><CardTitle className="text-lg">Your Referral Code</CardTitle></CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Input value={referralCode} readOnly className="font-mono text-lg font-bold text-center tracking-widest" />
                  <Button onClick={copyCode} variant="secondary">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-3">Share link: <span className="font-mono">{shareUrl}</span></p>
              </CardContent>
            </Card>

            {/* Referral stats */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6 text-center">
                  <Users className="h-6 w-6 text-primary mx-auto mb-2" />
                  <div className="text-2xl font-bold">{referrals.length}</div>
                  <p className="text-xs text-muted-foreground">Total Referrals</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <Check className="h-6 w-6 text-primary mx-auto mb-2" />
                  <div className="text-2xl font-bold">{referrals.filter(r => r.status === "completed").length}</div>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <Gift className="h-6 w-6 text-primary mx-auto mb-2" />
                  <div className="text-2xl font-bold">₹{referrals.filter(r => r.reward_given).length * 100}</div>
                  <p className="text-xs text-muted-foreground">Rewards Earned</p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default ReferralProgram;

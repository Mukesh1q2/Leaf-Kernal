import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { User, Package, Heart, MapPin, LogOut } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const Account = () => {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("profile");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("user_id", user.id).single().then(({ data }) => setProfile(data));
    supabase.from("orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).then(({ data }) => setOrders(data || []));
  }, [user]);

  if (!user) return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-16 text-center">
        <h1 className="text-2xl font-heading font-bold mb-4">Please sign in</h1>
        <Link to="/auth" className="text-secondary hover:underline">Go to Login</Link>
      </div>
      <Footer />
    </div>
  );

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "orders", label: "Orders", icon: Package },
    { id: "wishlist", label: "Wishlist", icon: Heart },
    { id: "addresses", label: "Addresses", icon: MapPin },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8 md:py-16">
        <h1 className="text-3xl font-heading font-bold text-foreground mb-8">My Account</h1>
        <div className="grid md:grid-cols-4 gap-8">
          <aside className="space-y-1">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.id ? "bg-secondary text-secondary-foreground" : "text-foreground hover:bg-muted"}`}>
                <tab.icon size={18} /> {tab.label}
              </button>
            ))}
            <button onClick={signOut} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors">
              <LogOut size={18} /> Sign Out
            </button>
          </aside>

          <div className="md:col-span-3">
            {activeTab === "profile" && (
              <div className="bg-background border border-border rounded-xl p-6">
                <h2 className="font-heading font-semibold text-lg text-foreground mb-4">Profile Information</h2>
                <div className="space-y-3">
                  <div><span className="text-sm text-muted-foreground">Name</span><p className="font-medium text-foreground">{profile?.full_name || "Not set"}</p></div>
                  <div><span className="text-sm text-muted-foreground">Email</span><p className="font-medium text-foreground">{user.email}</p></div>
                  <div><span className="text-sm text-muted-foreground">Phone</span><p className="font-medium text-foreground">{profile?.phone || "Not set"}</p></div>
                </div>
              </div>
            )}

            {activeTab === "orders" && (
              <div>
                <h2 className="font-heading font-semibold text-lg text-foreground mb-4">Order History</h2>
                {orders.length === 0 ? (
                  <div className="text-center py-12 bg-muted rounded-xl">
                    <Package size={40} className="text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No orders yet</p>
                    <Link to="/shop" className="text-secondary hover:underline mt-2 inline-block">Start shopping</Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orders.map(order => (
                      <div key={order.id} className="bg-background border border-border rounded-xl p-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground text-sm">Order #{order.id.slice(0, 8)}</p>
                          <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-foreground">₹{order.total}</p>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${order.status === "delivered" ? "bg-leaf/10 text-secondary" : order.status === "cancelled" ? "bg-destructive/10 text-destructive" : "bg-gold-light text-accent-foreground"}`}>{order.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "wishlist" && (
              <div className="text-center py-12 bg-muted rounded-xl">
                <Heart size={40} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Your wishlist is empty</p>
                <Link to="/shop" className="text-secondary hover:underline mt-2 inline-block">Browse products</Link>
              </div>
            )}

            {activeTab === "addresses" && (
              <div className="text-center py-12 bg-muted rounded-xl">
                <MapPin size={40} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No saved addresses</p>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Account;

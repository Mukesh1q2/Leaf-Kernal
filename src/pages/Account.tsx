import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { supabase } from "@/integrations/supabase/client";
import { User, Package, Heart, MapPin, LogOut, Edit2, Save, Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const Account = () => {
  const { user, signOut } = useAuth();
  const { wishlistProducts, toggleWishlist } = useWishlist();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("profile");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({ full_name: "", phone: "" });

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("user_id", user.id).single().then(({ data }) => {
      setProfile(data);
      if (data) setEditForm({ full_name: data.full_name || "", phone: data.phone || "" });
    });
    supabase.from("orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).then(({ data }) => setOrders(data || []));
    supabase.from("addresses").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).then(({ data }) => setAddresses(data || []));
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: editForm.full_name, phone: editForm.phone }).eq("user_id", user.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setProfile({ ...profile, ...editForm });
      setEditing(false);
      toast({ title: "Profile updated!" });
    }
    setSaving(false);
  };

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
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-heading font-semibold text-lg text-foreground">Profile Information</h2>
                  {!editing ? (
                    <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-sm text-secondary hover:underline">
                      <Edit2 size={14} /> Edit
                    </button>
                  ) : (
                    <button onClick={handleSaveProfile} disabled={saving} className="flex items-center gap-1.5 text-sm text-secondary hover:underline disabled:opacity-50">
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
                    </button>
                  )}
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-muted-foreground">Name</label>
                    {editing ? (
                      <input value={editForm.full_name} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" placeholder="Your full name" />
                    ) : (
                      <p className="font-medium text-foreground">{profile?.full_name || "Not set"}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Email</label>
                    <p className="font-medium text-foreground">{user.email}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Phone</label>
                    {editing ? (
                      <input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" placeholder="Your phone number" />
                    ) : (
                      <p className="font-medium text-foreground">{profile?.phone || "Not set"}</p>
                    )}
                  </div>
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
              <div>
                <h2 className="font-heading font-semibold text-lg text-foreground mb-4">My Wishlist</h2>
                {wishlistProducts.length === 0 ? (
                  <div className="text-center py-12 bg-muted rounded-xl">
                    <Heart size={40} className="text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">Your wishlist is empty</p>
                    <Link to="/shop" className="text-secondary hover:underline mt-2 inline-block">Browse products</Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {wishlistProducts.map(p => (
                      <div key={p.id} className="bg-background border border-border rounded-xl overflow-hidden">
                        <Link to={`/product/${p.slug}`}>
                          <div className="aspect-square bg-cream-dark overflow-hidden">
                            <img src={p.image_url || "/placeholder.svg"} alt={p.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                          </div>
                        </Link>
                        <div className="p-3">
                          <Link to={`/product/${p.slug}`} className="font-heading font-semibold text-sm text-foreground hover:text-secondary">{p.name}</Link>
                          <div className="flex items-center justify-between mt-2">
                            <span className="font-bold text-foreground">₹{p.price}</span>
                            <button onClick={() => toggleWishlist(p.id)} className="text-muted-foreground hover:text-destructive"><Trash2 size={16} /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "addresses" && (
              <div>
                <h2 className="font-heading font-semibold text-lg text-foreground mb-4">Saved Addresses</h2>
                {addresses.length === 0 ? (
                  <div className="text-center py-12 bg-muted rounded-xl">
                    <MapPin size={40} className="text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No saved addresses</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {addresses.map(addr => (
                      <div key={addr.id} className="bg-background border border-border rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium bg-muted px-2 py-0.5 rounded text-muted-foreground">{addr.label || "Home"}</span>
                          {addr.is_default && <span className="text-xs font-medium text-secondary">Default</span>}
                        </div>
                        <p className="font-medium text-foreground text-sm">{addr.full_name}</p>
                        <p className="text-sm text-muted-foreground">{addr.address_line1}{addr.address_line2 ? `, ${addr.address_line2}` : ""}</p>
                        <p className="text-sm text-muted-foreground">{addr.city}, {addr.state} - {addr.pincode}</p>
                        {addr.phone && <p className="text-sm text-muted-foreground mt-1">📞 {addr.phone}</p>}
                      </div>
                    ))}
                  </div>
                )}
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

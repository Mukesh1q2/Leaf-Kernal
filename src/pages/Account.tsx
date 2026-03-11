import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { supabase } from "@/integrations/supabase/client";
import { User, Package, Heart, MapPin, LogOut, Edit2, Save, Loader2, Trash2, Plus, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const emptyAddress = { full_name: "", phone: "", address_line1: "", address_line2: "", city: "", state: "", pincode: "", label: "Home", is_default: false };

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
  const [addressForm, setAddressForm] = useState(emptyAddress);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("user_id", user.id).single().then(({ data }) => {
      setProfile(data);
      if (data) setEditForm({ full_name: data.full_name || "", phone: data.phone || "" });
    });
    supabase.from("orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).then(({ data }) => setOrders(data || []));
    fetchAddresses();
  }, [user]);

  const fetchAddresses = async () => {
    if (!user) return;
    const { data } = await supabase.from("addresses").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setAddresses(data || []);
  };

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

  const handleSaveAddress = async () => {
    if (!user) return;
    setSaving(true);

    // If setting as default, unset others first
    if (addressForm.is_default) {
      await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id);
    }

    if (editingAddressId) {
      const { error } = await supabase.from("addresses").update(addressForm).eq("id", editingAddressId).eq("user_id", user.id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
      else { toast({ title: "Address updated!" }); }
    } else {
      const { error } = await supabase.from("addresses").insert({ ...addressForm, user_id: user.id });
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
      else { toast({ title: "Address added!" }); }
    }

    setShowAddressForm(false);
    setEditingAddressId(null);
    setAddressForm(emptyAddress);
    await fetchAddresses();
    setSaving(false);
  };

  const handleEditAddress = (addr: any) => {
    setAddressForm({
      full_name: addr.full_name, phone: addr.phone || "", address_line1: addr.address_line1,
      address_line2: addr.address_line2 || "", city: addr.city, state: addr.state,
      pincode: addr.pincode, label: addr.label || "Home", is_default: addr.is_default || false,
    });
    setEditingAddressId(addr.id);
    setShowAddressForm(true);
  };

  const handleDeleteAddress = async (id: string) => {
    await supabase.from("addresses").delete().eq("id", id).eq("user_id", user!.id);
    toast({ title: "Address deleted" });
    await fetchAddresses();
  };

  const handleSetDefault = async (id: string) => {
    if (!user) return;
    await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id);
    await supabase.from("addresses").update({ is_default: true }).eq("id", id);
    toast({ title: "Default address updated" });
    await fetchAddresses();
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
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-heading font-semibold text-lg text-foreground">Saved Addresses</h2>
                  <button
                    onClick={() => { setAddressForm(emptyAddress); setEditingAddressId(null); setShowAddressForm(true); }}
                    className="flex items-center gap-1.5 text-sm font-medium text-secondary hover:underline"
                  >
                    <Plus size={14} /> Add Address
                  </button>
                </div>

                {showAddressForm && (
                  <div className="bg-muted rounded-xl p-5 mb-4 space-y-3">
                    <h3 className="font-heading font-semibold text-foreground text-sm">{editingAddressId ? "Edit Address" : "New Address"}</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <input placeholder="Full Name *" value={addressForm.full_name} onChange={e => setAddressForm({ ...addressForm, full_name: e.target.value })} className="px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" required />
                      <input placeholder="Phone" value={addressForm.phone} onChange={e => setAddressForm({ ...addressForm, phone: e.target.value })} className="px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
                    </div>
                    <input placeholder="Address Line 1 *" value={addressForm.address_line1} onChange={e => setAddressForm({ ...addressForm, address_line1: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" required />
                    <input placeholder="Address Line 2" value={addressForm.address_line2} onChange={e => setAddressForm({ ...addressForm, address_line2: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
                    <div className="grid grid-cols-3 gap-3">
                      <input placeholder="City *" value={addressForm.city} onChange={e => setAddressForm({ ...addressForm, city: e.target.value })} className="px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" required />
                      <input placeholder="State *" value={addressForm.state} onChange={e => setAddressForm({ ...addressForm, state: e.target.value })} className="px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" required />
                      <input placeholder="Pincode *" value={addressForm.pincode} onChange={e => setAddressForm({ ...addressForm, pincode: e.target.value })} className="px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" required />
                    </div>
                    <div className="flex items-center gap-4">
                      <select value={addressForm.label} onChange={e => setAddressForm({ ...addressForm, label: e.target.value })} className="px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm">
                        <option value="Home">Home</option>
                        <option value="Work">Work</option>
                        <option value="Other">Other</option>
                      </select>
                      <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                        <input type="checkbox" checked={addressForm.is_default} onChange={e => setAddressForm({ ...addressForm, is_default: e.target.checked })} className="rounded" />
                        Set as default
                      </label>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={handleSaveAddress} disabled={saving || !addressForm.full_name || !addressForm.address_line1 || !addressForm.city || !addressForm.state || !addressForm.pincode} className="px-5 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-forest-light transition-colors disabled:opacity-50">
                        {saving ? "Saving..." : editingAddressId ? "Update" : "Save"}
                      </button>
                      <button onClick={() => { setShowAddressForm(false); setEditingAddressId(null); }} className="px-5 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
                    </div>
                  </div>
                )}

                {addresses.length === 0 && !showAddressForm ? (
                  <div className="text-center py-12 bg-muted rounded-xl">
                    <MapPin size={40} className="text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No saved addresses</p>
                    <button onClick={() => setShowAddressForm(true)} className="text-secondary hover:underline mt-2 inline-block text-sm">Add your first address</button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {addresses.map(addr => (
                      <div key={addr.id} className="bg-background border border-border rounded-xl p-4">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium bg-muted px-2 py-0.5 rounded text-muted-foreground">{addr.label || "Home"}</span>
                            {addr.is_default && <span className="text-xs font-medium text-secondary flex items-center gap-0.5"><Star size={10} /> Default</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            {!addr.is_default && (
                              <button onClick={() => handleSetDefault(addr.id)} className="text-xs text-muted-foreground hover:text-secondary">Set default</button>
                            )}
                            <button onClick={() => handleEditAddress(addr)} className="text-muted-foreground hover:text-secondary"><Edit2 size={14} /></button>
                            <button onClick={() => handleDeleteAddress(addr.id)} className="text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
                          </div>
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

import { useState } from "react";
import { Mail, Phone, MapPin, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const Contact = () => {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.from("contact_inquiries" as any).insert(form as any);
    if (error) {
      toast.error("Something went wrong. Please try again.");
    } else {
      toast.success("Thank you! We'll get back to you within 24 hours.");
      setForm({ name: "", email: "", subject: "", message: "" });
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <div className="bg-primary py-12 text-center">
          <h1 className="text-3xl md:text-4xl font-heading font-bold text-primary-foreground">Contact Us</h1>
          <p className="text-primary-foreground/70 mt-2">We'd love to hear from you</p>
        </div>
        <div className="container py-12">
          <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
            <div>
              <h2 className="text-2xl font-heading font-bold text-foreground mb-6">Get in Touch</h2>
              <div className="space-y-6">
                <div className="flex gap-4"><Mail size={24} className="text-secondary shrink-0 mt-1" /><div><h3 className="font-semibold text-foreground">Email</h3><p className="text-muted-foreground">hello@leafandkernel.com</p></div></div>
                <div className="flex gap-4"><Phone size={24} className="text-secondary shrink-0 mt-1" /><div><h3 className="font-semibold text-foreground">Phone</h3><p className="text-muted-foreground">+91 98765 43210</p></div></div>
                <div className="flex gap-4"><MapPin size={24} className="text-secondary shrink-0 mt-1" /><div><h3 className="font-semibold text-foreground">Office</h3><p className="text-muted-foreground">Leaf & Kernel HQ, Bengaluru, Karnataka, India</p></div></div>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="text" placeholder="Your Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50" required />
              <input type="email" placeholder="Your Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50" required />
              <input type="text" placeholder="Subject" value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50" required />
              <textarea placeholder="Your Message" value={form.message} onChange={e => setForm({...form, message: e.target.value})} rows={5} className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50 resize-none" required />
              <button type="submit" disabled={submitting} className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-forest-light transition-colors disabled:opacity-50">
                {submitting ? <><Loader2 size={16} className="animate-spin" /> Sending...</> : <>Send Message <Send size={16} /></>}
              </button>
            </form>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Contact;

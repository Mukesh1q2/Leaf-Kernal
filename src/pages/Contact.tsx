import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Phone, MapPin, Send, Loader2, ShoppingBag, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[\d\s().-]{7,}$/;

const Contact = () => {
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name is required.";
    if (!form.email.trim()) e.email = "Email is required.";
    else if (!EMAIL_RE.test(form.email)) e.email = "Enter a valid email.";
    if (form.phone && !PHONE_RE.test(form.phone)) e.phone = "Enter a valid phone number.";
    if (!form.subject.trim()) e.subject = "Subject is required.";
    if (!form.message.trim()) e.message = "Message is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    const payload: any = {
      name: form.name.trim(),
      email: form.email.trim(),
      subject: form.subject.trim(),
      message: form.phone ? `Phone: ${form.phone}\n\n${form.message.trim()}` : form.message.trim(),
    };
    const { error } = await supabase.from("contact_inquiries" as any).insert(payload);
    if (error) {
      toast.error("Something went wrong. Please try again.");
    } else {
      toast.success("Thank you! We'll get back to you within 24 hours.");
      setForm({ name: "", email: "", phone: "", subject: "", message: "" });
      setSubmitted(true);
    }
    setSubmitting(false);
  };

  const fieldClass = (key: string) =>
    `w-full px-4 py-3 rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 ${
      errors[key] ? "border-destructive focus:ring-destructive/40" : "border-border focus:ring-secondary/50"
    }`;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Contact Customer Care"
        description="Get in touch with the Leaf & Kernel customer wellness team for product questions, order support, and wholesale inquiries."
        url="https://leafandkernel.com/contact"
      />
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
            {submitted ? (
              <div className="border border-secondary/30 bg-secondary/5 rounded-2xl p-8 text-center flex flex-col items-center">
                <CheckCircle2 size={48} className="text-secondary mb-3" />
                <h3 className="text-xl font-heading font-bold text-foreground">Message sent!</h3>
                <p className="text-muted-foreground mt-1">We'll get back to you within 24 hours.</p>
                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                  <Link to="/shop" className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-forest-light transition-colors">
                    <ShoppingBag size={16} /> Shop Now
                  </Link>
                  <button onClick={() => setSubmitted(false)} className="px-6 py-3 rounded-lg border border-border text-foreground hover:bg-muted transition-colors font-medium">
                    Send another message
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <div>
                  <input type="text" placeholder="Your Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={fieldClass("name")} />
                  {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
                </div>
                <div>
                  <input type="email" placeholder="Your Email *" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={fieldClass("email")} />
                  {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
                </div>
                <div>
                  <input type="tel" placeholder="Phone Number (optional)" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className={fieldClass("phone")} />
                  {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone}</p>}
                </div>
                <div>
                  <input type="text" placeholder="Subject *" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} className={fieldClass("subject")} />
                  {errors.subject && <p className="text-xs text-destructive mt-1">{errors.subject}</p>}
                </div>
                <div>
                  <textarea placeholder="Your Message *" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} rows={5} className={`${fieldClass("message")} resize-none`} />
                  {errors.message && <p className="text-xs text-destructive mt-1">{errors.message}</p>}
                </div>
                <button type="submit" disabled={submitting} className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-forest-light transition-colors disabled:opacity-50">
                  {submitting ? <><Loader2 size={16} className="animate-spin" /> Sending...</> : <>Send Message <Send size={16} /></>}
                </button>
                <Link to="/shop" className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-lg border border-border text-foreground hover:bg-muted transition-colors font-medium">
                  <ShoppingBag size={16} /> Shop Now
                </Link>
              </form>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Contact;

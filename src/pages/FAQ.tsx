import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, ChevronUp } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const FAQ = () => {
  const [faqs, setFaqs] = useState<any[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("faqs").select("*").order("sort_order").then(({ data }) => setFaqs(data || []));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <div className="bg-primary py-12 text-center">
          <h1 className="text-3xl md:text-4xl font-heading font-bold text-primary-foreground">Frequently Asked Questions</h1>
        </div>
        <div className="container py-12 max-w-3xl mx-auto">
          {faqs.length === 0 && (
            <div className="text-center text-muted-foreground py-12">Loading FAQs…</div>
          )}
          <div className="space-y-3">
            {faqs.map(faq => (
              <div key={faq.id} className="border border-border rounded-xl overflow-hidden">
                <button onClick={() => setOpenId(openId === faq.id ? null : faq.id)} className="w-full flex items-center justify-between p-5 text-left">
                  <span className="font-heading font-semibold text-foreground pr-4">{faq.question}</span>
                  {openId === faq.id ? <ChevronUp size={20} className="text-secondary shrink-0" /> : <ChevronDown size={20} className="text-muted-foreground shrink-0" />}
                </button>
                {openId === faq.id && (
                  <div className="px-5 pb-5 text-muted-foreground leading-relaxed">{faq.answer}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default FAQ;

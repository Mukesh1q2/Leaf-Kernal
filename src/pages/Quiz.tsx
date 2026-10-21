import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Sparkles, ShoppingBag, RefreshCw, Loader2, Check } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { recommendProducts, type QuizAnswers, type ScoredProduct } from "@/lib/quiz";
import { trackActivity } from "@/lib/activity";

const LIFESTYLES = [
  { id: "active", label: "Active", desc: "Workouts, sports, on the move" },
  { id: "sedentary", label: "Sedentary", desc: "Mostly desk-bound days" },
  { id: "stressed", label: "Stressed", desc: "High pressure, low sleep" },
  { id: "balanced", label: "Balanced", desc: "Steady routines" },
];
const AGES = [
  { id: "18-30", label: "18 – 30" },
  { id: "31-45", label: "31 – 45" },
  { id: "46-60", label: "46 – 60" },
  { id: "60+", label: "60+" },
];
const FORMATS = [
  { id: "powders", label: "Powders" },
  { id: "capsules", label: "Capsules" },
  { id: "teas", label: "Teas & Infusions" },
  { id: "any", label: "No preference" },
];

const Quiz = () => {
  const { user } = useAuth();
  const { addToCart } = useCart();
  const [step, setStep] = useState(0);
  const [concerns, setConcerns] = useState<{ slug: string; name: string }[]>([]);
  const [answers, setAnswers] = useState<QuizAnswers>({ concerns: [], lifestyle: "", ageBand: "", format: "any" });
  const [results, setResults] = useState<ScoredProduct[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("health_concerns").select("slug,name").order("sort_order")
      .then(({ data }) => setConcerns(data || []));
  }, []);

  const totalSteps = 4;
  const canNext =
    (step === 0 && answers.concerns.length > 0) ||
    (step === 1 && answers.lifestyle) ||
    (step === 2 && answers.ageBand) ||
    (step === 3 && answers.format);

  const submit = async () => {
    setLoading(true);
    try {
      const r = await recommendProducts(answers, 6);
      setResults(r);
      trackActivity("quiz_complete", undefined, { answers, count: r.length });
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setResults(null); setStep(0); setAnswers({ concerns: [], lifestyle: "", ageBand: "", format: "any" }); };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead
        title="Personalized Ayurvedic Wellness Quiz"
        description="Take our 60-second Ayurvedic superfood assessment to find the perfect plant-powered routine for your health goals."
        url="https://leafandkernel.com/quiz"
      />
      <Header />
      <main className="flex-1">
        <section className="bg-gradient-to-br from-primary to-forest-light text-primary-foreground py-12">
          <div className="container">
            <div className="flex items-center gap-2 mb-3 opacity-90">
              <Sparkles size={18} />
              <span className="text-sm font-medium">Your Personalised Wellness Plan</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-heading font-bold">Find your superfoods in 60 seconds</h1>
            <p className="opacity-80 mt-2 max-w-xl">Answer 4 quick questions and we'll curate Ayurvedic picks tailored to your goals, lifestyle and age.</p>
          </div>
        </section>

        <section className="container py-12">
          {!results ? (
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center gap-2 mb-6">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-secondary" : "bg-muted"}`} />
                ))}
              </div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Step {step + 1} of {totalSteps}</p>

              <AnimatePresence mode="wait">
                <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
                  {step === 0 && (
                    <>
                      <h2 className="text-2xl font-heading font-bold mb-1">What are your top wellness goals?</h2>
                      <p className="text-muted-foreground mb-6">Pick all that apply.</p>
                      <div className="grid grid-cols-2 gap-3">
                        {concerns.map((c) => {
                          const sel = answers.concerns.includes(c.slug);
                          return (
                            <button key={c.slug} onClick={() => {
                              setAnswers((a) => ({ ...a, concerns: sel ? a.concerns.filter((x) => x !== c.slug) : [...a.concerns, c.slug] }));
                            }} className={`p-4 rounded-xl border text-left transition-all ${sel ? "border-secondary bg-secondary/5 shadow-sm" : "border-border hover:border-secondary/50"}`}>
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-foreground">{c.name}</span>
                                {sel && <Check size={16} className="text-secondary" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                  {step === 1 && (
                    <>
                      <h2 className="text-2xl font-heading font-bold mb-1">How would you describe your lifestyle?</h2>
                      <p className="text-muted-foreground mb-6">Choose the closest match.</p>
                      <div className="grid grid-cols-2 gap-3">
                        {LIFESTYLES.map((l) => (
                          <button key={l.id} onClick={() => setAnswers((a) => ({ ...a, lifestyle: l.id }))} className={`p-4 rounded-xl border text-left transition-all ${answers.lifestyle === l.id ? "border-secondary bg-secondary/5" : "border-border hover:border-secondary/50"}`}>
                            <div className="font-medium text-foreground">{l.label}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{l.desc}</div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {step === 2 && (
                    <>
                      <h2 className="text-2xl font-heading font-bold mb-1">Your age group?</h2>
                      <p className="text-muted-foreground mb-6">Helps us tune dosages and ingredients.</p>
                      <div className="grid grid-cols-2 gap-3">
                        {AGES.map((a) => (
                          <button key={a.id} onClick={() => setAnswers((x) => ({ ...x, ageBand: a.id }))} className={`p-4 rounded-xl border text-center transition-all ${answers.ageBand === a.id ? "border-secondary bg-secondary/5" : "border-border hover:border-secondary/50"}`}>
                            <span className="font-semibold text-foreground">{a.label}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {step === 3 && (
                    <>
                      <h2 className="text-2xl font-heading font-bold mb-1">Preferred format?</h2>
                      <p className="text-muted-foreground mb-6">We'll favour this in your recommendations.</p>
                      <div className="grid grid-cols-2 gap-3">
                        {FORMATS.map((f) => (
                          <button key={f.id} onClick={() => setAnswers((a) => ({ ...a, format: f.id }))} className={`p-4 rounded-xl border text-center transition-all ${answers.format === f.id ? "border-secondary bg-secondary/5" : "border-border hover:border-secondary/50"}`}>
                            <span className="font-medium text-foreground">{f.label}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>

              <div className="flex items-center justify-between mt-8">
                <button disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30">
                  <ArrowLeft size={16} /> Back
                </button>
                {step < totalSteps - 1 ? (
                  <button disabled={!canNext} onClick={() => setStep((s) => s + 1)} className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-forest-light transition-colors disabled:opacity-50">
                    Next <ArrowRight size={16} />
                  </button>
                ) : (
                  <button disabled={!canNext || loading} onClick={submit} className="inline-flex items-center gap-2 px-6 py-3 bg-secondary text-secondary-foreground font-semibold rounded-lg hover:bg-leaf transition-colors disabled:opacity-50">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} See My Plan
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="max-w-5xl mx-auto">
              <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
                <div>
                  <h2 className="text-2xl md:text-3xl font-heading font-bold">Your wellness plan</h2>
                  <p className="text-muted-foreground mt-1">{results.length} curated picks for {answers.concerns.length} goals.</p>
                </div>
                <button onClick={reset} className="inline-flex items-center gap-1.5 text-sm text-secondary hover:underline">
                  <RefreshCw size={14} /> Retake quiz
                </button>
              </div>
              {results.length === 0 ? (
                <div className="text-center py-16 bg-muted rounded-2xl">
                  <p className="text-muted-foreground mb-3">No matches yet — try broader goals.</p>
                  <button onClick={reset} className="text-secondary hover:underline">Retake quiz</button>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {results.map(({ product, reasons }, idx) => (
                    <motion.div key={product.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} className="bg-background border border-border rounded-2xl overflow-hidden flex flex-col">
                      <Link to={`/product/${product.slug}`} className="aspect-square bg-cream-dark overflow-hidden">
                        <img src={product.image_url || "/placeholder.svg"} alt={product.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                      </Link>
                      <div className="p-4 flex-1 flex flex-col">
                        <Link to={`/product/${product.slug}`} className="font-heading font-semibold text-foreground hover:text-secondary">{product.name}</Link>
                        {reasons.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {reasons.slice(0, 2).map((r, i) => (
                              <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                <Check size={12} className="text-secondary mt-0.5 shrink-0" /> {r}
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="mt-auto pt-3 flex items-center justify-between">
                          <span className="font-bold text-foreground">₹{product.price}</span>
                          <button onClick={() => addToCart(product.id, 1)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-forest-light transition-colors">
                            <ShoppingBag size={12} /> Add
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
              <div className="text-center mt-10 text-sm text-muted-foreground">
                {user ? "Your plan is saved to your activity." : <>Sign in to save your plan. <Link to="/auth" className="text-secondary hover:underline">Sign in</Link></>}
              </div>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Quiz;
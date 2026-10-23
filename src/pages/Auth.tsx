import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Leaf, Loader2, MailCheck, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { validateRegistrationInput, formatAuthError } from "@/lib/authValidation";

type AuthMode = "email" | "phone";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawNext = searchParams.get("next");
  const nextPath = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  const goNext = () => {
    if (nextPath.startsWith("/")) window.location.href = nextPath;
    else navigate("/");
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    if (isLogin) {
      if (!email.trim() || !password) {
        toast.error("Please enter both email and password.");
        return;
      }
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) {
        toast.error(formatAuthError(error));
      } else {
        toast.success("Welcome back!");
        goNext();
      }
      setLoading(false);
    } else {
      const validation = validateRegistrationInput({
        fullName,
        email,
        password,
        confirmPassword,
        agreedToTerms,
      });

      if (!validation.isValid) {
        setFieldErrors(validation.errors);
        const firstError = Object.values(validation.errors)[0];
        toast.error(firstError);
        return;
      }

      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { full_name: fullName.trim() },
          emailRedirectTo: window.location.origin + nextPath,
        },
      });

      if (error) {
        toast.error(formatAuthError(error));
      } else if (data?.session) {
        // Auto-confirmed session
        toast.success("Account created successfully! Welcome to UVEDIQ.");
        goNext();
      } else {
        // Email confirmation required
        setVerificationEmail(email.trim().toLowerCase());
        setVerificationSent(true);
        toast.success("Verification link sent! Please check your email.");
      }
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!verificationEmail) return;
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: verificationEmail,
      options: {
        emailRedirectTo: window.location.origin + nextPath,
      },
    });
    if (error) {
      toast.error(formatAuthError(error));
    } else {
      toast.success("New verification link dispatched to your email!");
    }
    setResending(false);
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    setLoading(true);

    const formattedPhone = phone.startsWith("+") ? phone : `+91${phone}`;
    const { error } = await supabase.auth.signInWithOtp({ phone: formattedPhone });

    if (error) {
      toast.error(error.message);
    } else {
      setOtpSent(true);
      toast.success("OTP sent to your phone!");
    }
    setLoading(false);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) return;
    setLoading(true);

    const formattedPhone = phone.startsWith("+") ? phone : `+91${phone}`;
    const { error } = await supabase.auth.verifyOtp({
      phone: formattedPhone,
      token: otp,
      type: "sms",
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Welcome!");
      goNext();
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + nextPath,
        },
      });

      if (error) {
        toast.error(error.message || "Google sign-in failed");
        setGoogleLoading(false);
        return;
      }
      // signInWithOAuth redirects the browser; no further action needed
    } catch (err) {
      toast.error("Google sign-in failed. Please try again.");
    }
    setGoogleLoading(false);
  };

  const inputClass = "w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50";

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-16 max-w-md mx-auto">
        <div className="text-center mb-8">
          <Leaf size={40} className="text-secondary mx-auto mb-4" />
          <h1 className="text-3xl font-heading font-bold text-foreground">
            {isLogin ? "Welcome Back" : "Join Leaf & Kernel"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isLogin ? "Sign in to your account" : "Create your wellness account"}
          </p>
        </div>

        {verificationSent ? (
          <div className="border border-border bg-card rounded-2xl p-8 text-center space-y-5 animate-fade-in shadow-sm">
            <div className="w-16 h-16 rounded-full bg-secondary/10 text-secondary mx-auto flex items-center justify-center">
              <MailCheck size={36} />
            </div>
            <h2 className="text-2xl font-heading font-bold text-foreground">Verify Your Email</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              We sent an account activation link to <strong className="text-foreground">{verificationEmail}</strong>.
              Please check your inbox (and spam folder) and click the link to activate your account.
            </p>
            <div className="pt-2 space-y-3">
              <Button
                variant="outline"
                className="w-full py-2.5 text-sm"
                onClick={handleResendVerification}
                disabled={resending}
              >
                {resending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Resend verification email
              </Button>
              <button
                type="button"
                onClick={() => { setVerificationSent(false); setIsLogin(true); }}
                className="text-sm text-secondary hover:underline block w-full text-center font-medium"
              >
                ← Back to Sign In
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Google Sign In */}
            <Button
              variant="outline"
              className="w-full py-3 mb-4 flex items-center justify-center gap-3 text-base"
              onClick={handleGoogleLogin}
              disabled={googleLoading}
            >
              {googleLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              Continue with Google
            </Button>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            {/* Auth mode tabs */}
            <div className="flex rounded-lg border border-border overflow-hidden mb-6">
              <button
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${authMode === "email" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}
                onClick={() => { setAuthMode("email"); setOtpSent(false); setFieldErrors({}); }}
              >
                Email
              </button>
              <button
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${authMode === "phone" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}
                onClick={() => { setAuthMode("phone"); setOtpSent(false); setFieldErrors({}); }}
              >
                Phone (OTP)
              </button>
            </div>

            {authMode === "email" ? (
              <form onSubmit={handleEmailSubmit} className="space-y-4" noValidate>
                {!isLogin && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Full Name</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => { setFullName(e.target.value); setFieldErrors(prev => ({ ...prev, fullName: "" })); }}
                      className={`${inputClass} ${fieldErrors.fullName ? "border-destructive focus:ring-destructive" : ""}`}
                      placeholder="e.g. Ramesh Kumar"
                      required
                    />
                    {fieldErrors.fullName && <p className="text-xs text-destructive mt-1">{fieldErrors.fullName}</p>}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setFieldErrors(prev => ({ ...prev, email: "" })); }}
                    className={`${inputClass} ${fieldErrors.email ? "border-destructive focus:ring-destructive" : ""}`}
                    placeholder="name@example.com"
                    required
                  />
                  {fieldErrors.email && <p className="text-xs text-destructive mt-1">{fieldErrors.email}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setFieldErrors(prev => ({ ...prev, password: "" })); }}
                    className={`${inputClass} ${fieldErrors.password ? "border-destructive focus:ring-destructive" : ""}`}
                    placeholder={isLogin ? "Enter your password" : "At least 8 chars, letters & numbers"}
                    minLength={6}
                    required
                  />
                  {fieldErrors.password && <p className="text-xs text-destructive mt-1">{fieldErrors.password}</p>}
                </div>

                {!isLogin && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Confirm Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setFieldErrors(prev => ({ ...prev, confirmPassword: "" })); }}
                      className={`${inputClass} ${fieldErrors.confirmPassword ? "border-destructive focus:ring-destructive" : ""}`}
                      placeholder="Repeat your password"
                      required
                    />
                    {fieldErrors.confirmPassword && <p className="text-xs text-destructive mt-1">{fieldErrors.confirmPassword}</p>}
                  </div>
                )}

                {!isLogin && (
                  <div>
                    <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={agreedToTerms}
                        onChange={(e) => { setAgreedToTerms(e.target.checked); setFieldErrors(prev => ({ ...prev, terms: "" })); }}
                        className="mt-0.5 rounded border-border text-primary focus:ring-primary h-4 w-4"
                      />
                      <span>
                        I agree to the{" "}
                        <Link to="/terms-conditions" className="text-secondary underline hover:opacity-80">
                          Terms &amp; Conditions
                        </Link>{" "}
                        and{" "}
                        <Link to="/return-policy" className="text-secondary underline hover:opacity-80">
                          Privacy Policy
                        </Link>.
                      </span>
                    </label>
                    {fieldErrors.terms && <p className="text-xs text-destructive mt-1">{fieldErrors.terms}</p>}
                  </div>
                )}

                {isLogin && (
                  <div className="text-right">
                    <Link to="/forgot-password" className="text-sm text-secondary hover:underline">Forgot password?</Link>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-forest-light transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Please wait...
                    </>
                  ) : isLogin ? (
                    "Sign In"
                  ) : (
                    "Create Account"
                  )}
                </button>
              </form>
            ) : (
          <>
            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Phone Number</label>
                  <div className="flex gap-2">
                    <span className="flex items-center px-3 rounded-lg border border-border bg-muted text-sm text-muted-foreground">+91</span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      className={inputClass}
                      placeholder="Enter 10-digit number"
                      maxLength={10}
                      required
                    />
                  </div>
                </div>
                <button type="submit" disabled={loading || phone.length !== 10} className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-forest-light transition-colors disabled:opacity-50">
                  {loading ? "Sending OTP..." : "Send OTP"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  Enter the 6-digit OTP sent to +91{phone}
                </p>
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <button type="submit" disabled={loading || otp.length !== 6} className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-forest-light transition-colors disabled:opacity-50">
                  {loading ? "Verifying..." : "Verify & Sign In"}
                </button>
                <button type="button" onClick={() => { setOtpSent(false); setOtp(""); }} className="w-full text-sm text-secondary hover:underline">
                  Change phone number
                </button>
              </form>
            )}
          </>
        )}

        {authMode === "email" && (
          <p className="text-center mt-6 text-sm text-muted-foreground">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button onClick={() => { setIsLogin(!isLogin); setFieldErrors({}); }} className="text-secondary font-medium hover:underline">
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </p>
        )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Auth;

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Leaf, ShieldCheck } from "lucide-react";

type AuthOps = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};

const oauth = (supabase.auth as unknown as { oauth: AuthOps }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      setEmail(sess.session.user.email ?? null);
      try {
        const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
        if (!active) return;
        if (error) {
          setError(error.message || "Could not load authorization request");
          return;
        }
        const immediate = data?.redirect_url ?? data?.redirect_to;
        if (immediate && !data?.client) {
          window.location.href = immediate;
          return;
        }
        setDetails(data);
      } catch (e: any) {
        setError(e?.message || "Failed to load authorization request");
      }
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    try {
      const { data, error } = approve
        ? await oauth.approveAuthorization(authorizationId)
        : await oauth.denyAuthorization(authorizationId);
      if (error) {
        setBusy(false);
        setError(error.message);
        return;
      }
      const target = data?.redirect_url ?? data?.redirect_to;
      if (!target) {
        setBusy(false);
        setError("No redirect returned by the authorization server.");
        return;
      }
      window.location.href = target;
    } catch (e: any) {
      setBusy(false);
      setError(e?.message || "Something went wrong");
    }
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full bg-card border border-border rounded-xl p-6 text-center">
          <p className="text-destructive font-medium mb-2">Authorization error</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  }

  if (!details) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-secondary" />
      </main>
    );
  }

  const clientName = details.client?.name ?? details.client?.client_name ?? "an app";
  const redirectUri = details.client?.redirect_uris?.[0] ?? details.client?.redirect_uri ?? null;

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full bg-card border border-border rounded-xl p-6 shadow-lg">
        <div className="text-center mb-6">
          <Leaf className="h-10 w-10 text-secondary mx-auto mb-3" />
          <h1 className="text-2xl font-heading font-bold text-foreground">
            Connect {clientName} to Leaf & Kernel
          </h1>
          {email && (
            <p className="text-sm text-muted-foreground mt-2">
              Signed in as <span className="font-medium text-foreground">{email}</span>
            </p>
          )}
        </div>

        <div className="bg-muted/40 border border-border rounded-lg p-4 mb-6 space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 text-secondary mt-0.5 shrink-0" />
            <p className="text-foreground">
              This lets <span className="font-medium">{clientName}</span> use Leaf & Kernel as you — searching
              products and reading your orders, deliveries, and loyalty points.
            </p>
          </div>
          {redirectUri && (
            <p className="text-xs text-muted-foreground break-all">
              Redirects to: <span className="font-mono">{redirectUri}</span>
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            This does not bypass Leaf & Kernel's permissions or backend policies.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Button className="w-full" disabled={busy} onClick={() => decide(true)}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Approve & connect`}
          </Button>
          <Button variant="outline" className="w-full" disabled={busy} onClick={() => decide(false)}>
            Cancel connection
          </Button>
        </div>
      </div>
    </main>
  );
}
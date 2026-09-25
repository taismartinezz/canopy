"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// After Google OAuth, Supabase redirects here with ?code=... (PKCE flow).
// We exchange the code for a session, store Google tokens for Calendar/Gmail,
// then route to dashboard or onboarding.

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error || !code) {
      router.replace("/login?error=oauth_failed");
      return;
    }

    (async () => {
      const { data, error: exchErr } = await supabase.auth.exchangeCodeForSession(code);
      if (exchErr || !data.session) {
        router.replace("/login?error=session_failed");
        return;
      }

      const { session } = data;
      const user = session.user;

      // Persist Google tokens so Calendar/Gmail API routes can use them
      if (session.provider_token && isSupabaseConfigured) {
        const expiresAt = session.expires_at
          ? new Date(session.expires_at * 1000).toISOString()
          : null;
        await supabase.from("user_profiles").update({
          google_access_token: session.provider_token,
          google_refresh_token: session.provider_refresh_token ?? null,
          google_token_expiry: expiresAt,
        }).eq("id", user.id);
      }

      // Route based on lab membership (same logic as login page)
      if (!isSupabaseConfigured) {
        router.replace("/");
        return;
      }
      const { data: member } = await supabase
        .from("team_members").select("id").eq("user_id", user.id).maybeSingle();
      if (member) {
        router.replace("/");
      } else {
        const { data: profile } = await supabase
          .from("user_profiles").select("id").eq("id", user.id).maybeSingle();
        router.replace(profile ? "/" : "/onboarding");
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--color-canvas)",
        fontFamily: "var(--font-roboto)",
        fontSize: 14,
        color: "var(--color-secondary)",
      }}
    >
      Signing you in&hellip;
    </div>
  );
}

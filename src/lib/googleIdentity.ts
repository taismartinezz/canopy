// Google Identity Services (GIS) utilities for the invisible-overlay sign-in pattern.
// We render the GIS button iframe at near-zero opacity so it intercepts clicks,
// while our own AuthButton stays visible and always shows "Continue with Google".

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            nonce?: string;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
            itp_support?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: "standard" | "icon";
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              shape?: "rectangular" | "pill" | "circle" | "square";
              width?: number;
            }
          ) => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

/** Generate a cryptographically random nonce string (base64url, 32 bytes). */
export function generateNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  // base64url encode without padding
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** SHA-256 hash a string, return base64url result (for the GIS nonce param). */
export async function hashNonce(raw: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return btoa(String.fromCharCode(...hashArray))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Load the GIS script if not already present. Resolves when google.accounts is ready. */
export function loadGisScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") { reject(new Error("no window")); return; }
    if (window.google?.accounts?.id) { resolve(); return; }

    const existing = document.getElementById("gis-script");
    if (existing) {
      // Already injected but not yet loaded -- wait for load
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("GIS script failed")));
      return;
    }

    const script = document.createElement("script");
    script.id = "gis-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("GIS script failed to load"));
    document.head.appendChild(script);
  });
}

/**
 * Initialize GIS with the given client ID and hashed nonce.
 * `onToken` fires with the raw ID token when the user completes sign-in.
 */
export function initGis(
  clientId: string,
  hashedNonce: string,
  onToken: (idToken: string) => void
): void {
  if (!window.google?.accounts?.id) return;
  window.google.accounts.id.disableAutoSelect();
  window.google.accounts.id.initialize({
    client_id: clientId,
    nonce: hashedNonce,
    // Disable One Tap -- we control the button ourselves
    auto_select: false,
    cancel_on_tap_outside: false,
    itp_support: true,
    callback: (response) => {
      if (response?.credential) onToken(response.credential);
    },
  });
}

/**
 * Render the GIS button inside `container`.
 * Uses `width` (capped at 400 px) so it fills our button exactly.
 * The container should be absolutely positioned over our AuthButton at opacity ~0.
 */
export function renderGisButton(container: HTMLElement, width: number): void {
  if (!window.google?.accounts?.id) return;
  // Clear any previous render (GIS errors if you call renderButton twice on same element)
  container.innerHTML = "";
  window.google.accounts.id.renderButton(container, {
    type: "standard",
    theme: "outline",
    size: "large",
    text: "continue_with",
    shape: "rectangular",
    width: Math.min(width, 400),
  });
}

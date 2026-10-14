import { createBrowserClient } from "@supabase/ssr";

// Browser client: only uses the public URL + publishable (anon) key.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}

import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && key && !url.includes("YOUR-PROJECT"));

export const supabase = createBrowserClient(
  url ?? "https://placeholder.supabase.co",
  key ?? "placeholder",
);

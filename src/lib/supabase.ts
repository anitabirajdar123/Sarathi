import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && key && !url.includes("YOUR-PROJECT"));

export const supabase = createBrowserClient(
  url ?? "https://placeholder.supabase.co",
  key ?? "placeholder",
);

/** Public URL of a driver's photo (stored in the public "driver-photos" bucket). */
export const photoUrl = (path: string | null | undefined) =>
  path ? supabase.storage.from("driver-photos").getPublicUrl(path).data.publicUrl : null;

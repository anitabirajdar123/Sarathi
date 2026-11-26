export const rupees = (paise: number) =>
  "₹" + Math.round(paise / 100).toLocaleString("en-IN");

export const km = (m: number) => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`);

/** Turn a database error into one plain sentence. */
export const errText = (e: unknown) =>
  (e as { message?: string })?.message?.replace(/^.*?:\s*/, "") ?? "Something went wrong";

/** Solapur city centre, used when the browser does not share location. */
export const DEFAULT_POS = { lat: 17.6599, lng: 75.9064 };

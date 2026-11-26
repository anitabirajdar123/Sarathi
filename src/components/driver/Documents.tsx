"use client";
import { useCallback, useEffect, useState } from "react";
import { Upload, BadgeCheck, FileText, Camera, IdCard } from "lucide-react";
import { supabase, photoUrl } from "@/lib/supabase";
import { errText } from "@/lib/format";
import { Badge } from "@/components/ui/Stat";
import { Notice } from "@/components/Shell";

type Kind = "photo" | "licence" | "aadhaar";
interface Doc { kind: Kind; path: string; status: "pending" | "approved" | "rejected"; note: string | null; uploaded_at: string }

const KINDS: { kind: Kind; title: string; hint: string; icon: typeof Camera }[] = [
  { kind: "photo", title: "Your photo", hint: "Clear face photo. Customers see it when you accept their trip.", icon: Camera },
  { kind: "licence", title: "Driving licence", hint: "Front side, all text readable.", icon: IdCard },
  { kind: "aadhaar", title: "Aadhaar card", hint: "Only the Saarthi team can see this.", icon: FileText },
];
const MAX_MB = 5;

export function DriverDocuments({ verified }: { verified: boolean }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [busy, setBusy] = useState<Kind | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("driver_documents").select("kind, path, status, note, uploaded_at");
    setDocs((data ?? []) as Doc[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const upload = async (kind: Kind, file: File) => {
    setErr(null);
    if (file.size > MAX_MB * 1024 * 1024) { setErr(`File is bigger than ${MAX_MB} MB.`); return; }
    if (!/^image\/|^application\/pdf$/.test(file.type)) { setErr("Upload a photo (JPG/PNG) or a PDF."); return; }
    setBusy(kind);
    const { data: { user } } = await supabase.auth.getUser();
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user!.id}/${kind}-${Date.now()}.${ext}`;
    const bucket = kind === "photo" ? "driver-photos" : "driver-docs";
    const up = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type });
    if (up.error) { setBusy(null); setErr(errText(up.error)); return; }
    const { error } = await supabase.rpc("driver_save_document", { p_kind: kind, p_path: path });
    setBusy(null);
    if (error) setErr(errText(error)); else load();
  };

  const approved = docs.filter((d) => d.status === "approved").length;

  return (
    <div className="space-y-6">
      <div className={`card flex items-center gap-4 ${verified ? "border-sky-500/40" : ""}`}>
        <BadgeCheck size={36} className={verified ? "text-sky-400" : "text-gray-600"} />
        <div>
          <p className="text-lg font-semibold">{verified ? "You are a Verified Saarthi" : "Get your Verified badge"}</p>
          <p className="text-sm text-gray-400">{verified ? "Customers see a blue tick next to your name." : `Upload all three documents. ${approved} of 3 approved so far.`}</p>
        </div>
      </div>
      {err && <Notice>{err}</Notice>}
      <div className="grid gap-4 md:grid-cols-3">
        {KINDS.map(({ kind, title, hint, icon: Icon }) => {
          const d = docs.find((x) => x.kind === kind);
          const img = kind === "photo" ? photoUrl(d?.path) : null;
          return (
            <div key={kind} className="card space-y-3">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 font-semibold"><Icon size={18} className="text-brand" /> {title}</p>
                {d && <Badge tone={d.status === "approved" ? "green" : d.status === "rejected" ? "red" : "brand"}>{d.status === "pending" ? "checking" : d.status}</Badge>}
              </div>
              {img
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={img} alt="Your photo" className="mx-auto h-28 w-28 rounded-full object-cover ring-2 ring-brand/40" />
                : <div className="grid h-28 place-items-center rounded-xl border border-dashed border-line text-xs text-gray-500">{d ? "Uploaded" : "Not uploaded"}</div>}
              <p className="text-xs text-gray-400">{hint}</p>
              {d?.status === "rejected" && d.note && <p className="text-xs text-red-300">Reason: {d.note}</p>}
              {d?.status !== "approved" && (
                <label className={`btn-ghost w-full cursor-pointer ${busy ? "pointer-events-none opacity-50" : ""}`}>
                  <Upload size={16} /> {busy === kind ? "Uploading…" : d ? "Upload again" : "Upload"}
                  <input type="file" accept="image/*,application/pdf" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(kind, f); e.target.value = ""; }} />
                </label>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

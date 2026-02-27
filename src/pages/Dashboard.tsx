import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Link2, Search, Trash2, Archive, Upload, Copy, Check } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

type Submission = {
  id: string;
  public_token: string;
  status: string;
  owner_name: string | null;
  owner_email: string | null;
  entry_date: string | null;
  first_country_of_entry: string | null;
  pets_count: number | null;
  created_at: string;
  updated_at: string;
  data_json: any;
};

// Part 5: Reduced status labels
const STATUS_LABELS: Record<string, string> = {
  Draft: "Draft",
  Submitted: "Submitted",
  NeedsCorrection: "Needs Correction",
  UnderReview: "Submitted",
  ReadyToGenerate: "Data Approved",
  Generated: "AHC Generated",
  Approved: "AHC Generated",
  Downloaded: "AHC Generated",
  Cancelled: "Cancelled",
  Archived: "Archived",
};

// Part 5: Only show reduced filter statuses
const FILTER_STATUSES: { value: string; label: string }[] = [
  { value: "Submitted", label: "Submitted" },
  { value: "NeedsCorrection", label: "Needs Correction" },
  { value: "ReadyToGenerate", label: "Data Approved" },
  { value: "Generated", label: "AHC Generated" },
  { value: "Cancelled", label: "Cancelled" },
  { value: "Archived", label: "Archived" },
];

const NEXT_ACTIONS: Record<string, string> = {
  Draft: "Awaiting client",
  Submitted: "Start review",
  NeedsCorrection: "Awaiting correction",
  UnderReview: "Start review",
  ReadyToGenerate: "Generate AHC",
  Generated: "Send to client",
  Approved: "Send to client",
  Downloaded: "Complete",
  Cancelled: "—",
  Archived: "—",
};

const statusColors: Record<string, string> = {
  Draft: "bg-muted text-muted-foreground",
  Submitted: "bg-coral text-foreground",
  NeedsCorrection: "bg-destructive/10 text-destructive",
  UnderReview: "bg-coral text-foreground",
  ReadyToGenerate: "bg-sky text-foreground",
  Generated: "bg-[hsl(var(--success))]/20 text-foreground",
  Approved: "bg-[hsl(var(--success))]/20 text-foreground",
  Downloaded: "bg-muted text-muted-foreground",
  Cancelled: "bg-destructive/10 text-destructive",
  Archived: "bg-muted text-muted-foreground",
};

const Dashboard = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [copiedLink, setCopiedLink] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) return;
    fetchSubmissions();
  }, [profile]);

  const fetchSubmissions = async () => {
    const { data, error } = await supabase
      .from("submissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) setSubmissions(data as Submission[]);
    setLoading(false);
  };

  const handleCreateClientLink = async () => {
    if (!profile) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/intake-api`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ clinic_id: profile.clinic_id, source: "link" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed to create link", description: data.error || "Unknown error", variant: "destructive" });
        return;
      }

      const url = `${window.location.origin}/intake/${data.public_token}`;
      await navigator.clipboard.writeText(url);
      setCopiedLink(data.id);
      setTimeout(() => setCopiedLink(""), 3000);
      toast({ title: "Client link created and copied!" });
      fetchSubmissions();
    } catch (err) {
      toast({ title: "Error", description: String(err), variant: "destructive" });
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this draft submission?")) return;
    const { error } = await supabase.from("submissions").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Submission deleted" });
      fetchSubmissions();
    }
  };

  const handleArchive = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const { error } = await supabase.from("submissions").update({ status: "Archived" as any }).eq("id", id);
    if (error) {
      toast({ title: "Archive failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Submission archived" });
      fetchSubmissions();
    }
  };

  const [uploading, setUploading] = useState(false);

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setUploading(true);
    const ext = file.name.split(".").pop() || "bin";
    const path = `intake_uploads/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("generated-pdfs").upload(path, file, { contentType: file.type });

    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage.from("generated-pdfs").createSignedUrl(path, 600);
    if (signedUrlError || !signedUrlData?.signedUrl) {
      toast({ title: "Upload failed", description: "Could not create file URL", variant: "destructive" });
      setUploading(false);
      return;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ clinic_id: profile.clinic_id, file_url: signedUrlData.signedUrl, file_type: file.type }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Extraction failed", description: data.error || "Unknown error", variant: "destructive" });
      } else {
        toast({ title: "Data extracted — opening submission" });
        navigate(`/submission/${data.submission_id}`);
      }
    } catch (err) {
      toast({ title: "Error", description: String(err), variant: "destructive" });
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Part 5: Map legacy statuses for filtering
  const getDisplayStatus = (status: string) => {
    const map: Record<string, string> = {
      UnderReview: "Submitted",
      Approved: "Generated",
      Downloaded: "Generated",
    };
    return map[status] || status;
  };

  const filteredSubmissions = submissions.filter(s => {
    if (!statusFilter && s.status === "Archived") return false;
    if (statusFilter) {
      const mapped = getDisplayStatus(s.status);
      if (mapped !== statusFilter && s.status !== statusFilter) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return (
        s.owner_name?.toLowerCase().includes(q) ||
        s.owner_email?.toLowerCase().includes(q) ||
        s.first_country_of_entry?.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getOwnerName = (s: Submission) => {
    if (s.owner_name) return s.owner_name;
    const d = s.data_json;
    if (d?.owner?.firstName) return `${d.owner.firstName} ${d.owner.lastName || ""}`.trim();
    return "—";
  };

  const getPetNames = (s: Submission) => {
    const d = s.data_json;
    if (d?.pet?.name) return d.pet.name;
    return "—";
  };

  const canDelete = (status: string) => status === "Draft";
  const canArchive = (status: string) => !["Draft", "Archived", "Cancelled"].includes(status);

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="section-title mb-0">Submissions</h1>
        <div className="flex items-center gap-2">
          <button onClick={handleCreateClientLink} className="btn-primary flex items-center gap-2 text-xs">
            <Link2 className="w-4 h-4" /> Create Client Link
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="btn-secondary flex items-center gap-2 text-xs" disabled={uploading}>
            <Upload className="w-4 h-4" /> {uploading ? "Extracting..." : "Upload Form"}
          </button>
          <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.webp,.doc,.docx,.tiff,.bmp" className="hidden" onChange={handleUploadFile} />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6 border border-border rounded-3xl p-4 bg-white">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by owner, email, country..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="form-input pl-10"
          />
        </div>
        {/* Part 4: Just "All" */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="form-input w-full sm:w-48 appearance-none cursor-pointer"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23605810' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" }}
        >
          <option value="">All</option>
          {FILTER_STATUSES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : filteredSubmissions.length === 0 ? (
        <div className="border border-border rounded-3xl p-12 text-center bg-white">
          <p className="text-sm text-muted-foreground mb-4">No submissions found.</p>
          <button onClick={handleCreateClientLink} className="btn-primary text-xs">
            Create Client Link
          </button>
        </div>
      ) : (
        <div className="border border-border rounded-3xl overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Owner</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Pet</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">First Country</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Next Action</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Created</th>
                  <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubmissions.map(s => (
                  <tr
                    key={s.id}
                    onClick={() => navigate(`/submission/${s.id}`)}
                    className="border-b border-border/30 hover:bg-secondary/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{getOwnerName(s)}</div>
                      {s.owner_email && <div className="text-xs text-muted-foreground">{s.owner_email}</div>}
                    </td>
                    <td className="px-4 py-3">{getPetNames(s)}</td>
                    <td className="px-4 py-3">{s.first_country_of_entry || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${statusColors[s.status] || "bg-muted"}`}>
                        {STATUS_LABELS[s.status] || s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {NEXT_ACTIONS[s.status] || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {format(new Date(s.created_at), "dd MMM yyyy")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {copiedLink === s.id && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1"><Check className="w-3 h-3" /> Copied</span>
                        )}
                        {canDelete(s.status) && (
                          <button onClick={(e) => handleDelete(e, s.id)} className="p-1.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Delete draft">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        {canArchive(s.status) && (
                          <button onClick={(e) => handleArchive(e, s.id)} className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Archive">
                            <Archive className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default Dashboard;
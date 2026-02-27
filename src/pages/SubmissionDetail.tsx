import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { ArrowLeft, CheckCircle2, Download, FileText, Edit2, Save, X, Eye, EyeOff } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;


const DISPLAY_STATUSES: { value: string; label: string }[] = [
  { value: "Submitted", label: "Submitted" },
  { value: "NeedsCorrection", label: "Needs Correction" },
  { value: "ReadyToGenerate", label: "Data Approved" },
  { value: "Generated", label: "AHC Generated" },
  { value: "Cancelled", label: "Cancelled" },
  { value: "Archived", label: "Archived" },
];

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

const AUDIT_ACTION_FOR_STATUS: Record<string, string> = {
  UnderReview: "submitted",
  NeedsCorrection: "correction_requested",
  ReadyToGenerate: "approved",
  Generated: "generated",
  Approved: "approved",
  Downloaded: "downloaded",
  Cancelled: "correction_requested",
  Archived: "approved",
};

const statusBadgeColor = (status: string) => {
  if (status === "Submitted") return "bg-coral text-foreground";
  if (status === "Draft") return "bg-muted text-muted-foreground";
  if (status === "NeedsCorrection") return "bg-destructive/10 text-destructive";
  if (["Generated", "Approved", "Downloaded", "ReadyToGenerate"].includes(status)) return "bg-[hsl(var(--success))]/20 text-foreground";
  return "bg-secondary text-foreground";
};

const LOCKED_STATUSES = ["Generated", "Approved", "Downloaded", "Archived", "Cancelled"];

// ── Extracted sub-components (stable references, no remount on parent state change) ──

const EditableRowInput = ({ field, value, onChange }: { field: string; value: string; onChange: (field: string, val: string) => void }) => (
  <input
    value={value}
    onChange={e => onChange(field, e.target.value)}
    className="form-input py-1 px-2 text-sm w-[60%] text-right"
  />
);

const SummaryRowDisplay = ({ label, value }: { label: string; value: string }) => (
  value ? (
    <div className="flex justify-between py-1.5 border-b border-border/30 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right max-w-[60%]">{value}</span>
    </div>
  ) : null
);

const SubmissionDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [submission, setSubmission] = useState<any>(null);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [correctionMessage, setCorrectionMessage] = useState("");

  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});

  const [practices, setPractices] = useState<any[]>([]);
  const [vets, setVets] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [issueData, setIssueData] = useState({
    issuing_practice_id: "",
    issuing_vet_id: "",
    issue_datetime: "",
    issue_place: "",
    certificate_number: "",
    selected_template_id: "",
  });
  const [generating, setGenerating] = useState(false);
  const [showOvGuides, setShowOvGuides] = useState(true);

  useEffect(() => { if (id) fetchAll(); }, [id]);

  const fetchAll = async () => {
    const [subRes, auditRes, attachRes, practicesRes, vetsRes, templatesRes] = await Promise.all([
      supabase.from("submissions").select("*").eq("id", id!).single(),
      supabase.from("audit_log").select("*").eq("submission_id", id!).order("created_at", { ascending: false }),
      supabase.from("attachments").select("*").eq("submission_id", id!),
      supabase.from("vet_practices").select("*"),
      supabase.from("vets").select("*"),
      supabase.from("ahc_templates").select("id, template_code, first_country_entry, language_pair").eq("is_active", true).order("first_country_entry"),
    ]);
    if (subRes.data) {
      setSubmission(subRes.data);
      // Auto-select template based on first country (fuzzy)
      const country = (subRes.data.first_country_of_entry || (subRes.data.data_json as any)?.travel?.firstCountry || "").toLowerCase().trim();
      let autoTemplateId = subRes.data.selected_template_id || "";
      if (!autoTemplateId && country && templatesRes.data) {
        const match = templatesRes.data.find((t: any) => t.first_country_entry.toLowerCase() === country)
          || templatesRes.data.find((t: any) => t.first_country_entry.toLowerCase().includes(country) || country.includes(t.first_country_entry.toLowerCase()));
        if (match) autoTemplateId = match.id;
      }
      setIssueData({
        issuing_practice_id: subRes.data.issuing_practice_id || "",
        issuing_vet_id: subRes.data.issuing_vet_id || "",
        issue_datetime: subRes.data.issue_datetime ? format(new Date(subRes.data.issue_datetime), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
        issue_place: subRes.data.issue_place || "",
        certificate_number: subRes.data.certificate_number || "",
        selected_template_id: autoTemplateId,
      });
    }
    if (auditRes.data) setAuditLog(auditRes.data);
    if (attachRes.data) setAttachments(attachRes.data);
    if (practicesRes.data) setPractices(practicesRes.data);
    if (vetsRes.data) setVets(vetsRes.data);
    if (templatesRes.data) setTemplates(templatesRes.data);
    setLoading(false);
  };

  const updateStatus = async (status: string) => {
    const auditAction = AUDIT_ACTION_FOR_STATUS[status] || "approved";
    await supabase.from("submissions").update({ status: status as any }).eq("id", id!);
    await supabase.from("audit_log").insert({
      submission_id: id!,
      user_id: profile?.user_id,
      action: auditAction as any,
      details_json: { status, from: submission?.status },
    });
    fetchAll();
    toast({ title: `Status → ${STATUS_LABELS[status] || status}` });
  };

  const getIntakeUrl = (forCorrection = false) => {
    const base = `${window.location.origin}/intake/${submission.public_token}`;
    return forCorrection ? `${base}?step=review` : base;
  };

  const copyLink = () => {
    navigator.clipboard.writeText(getIntakeUrl());
    toast({ title: "Link copied to clipboard" });
  };

  const requestCorrection = async () => {
    if (!correctionMessage.trim()) {
      toast({ title: "Enter a correction message", variant: "destructive" });
      return;
    }
    await supabase.from("submissions").update({
      status: "NeedsCorrection" as any,
      correction_message: correctionMessage,
    }).eq("id", id!);
    await supabase.from("audit_log").insert({
      submission_id: id!,
      user_id: profile?.user_id,
      action: "correction_requested" as any,
      details_json: { message: correctionMessage },
    });

    const correctionUrl = getIntakeUrl(true);
    navigator.clipboard.writeText(correctionUrl);

    setCorrectionMessage("");
    fetchAll();
    toast({ title: "Correction requested & link copied" });
  };

  const isEditable = !LOCKED_STATUSES.includes(submission?.status);

  const startEdit = (section: string, data: any) => {
    if (!isEditable) return;
    setEditingSection(section);
    setEditData(JSON.parse(JSON.stringify(data || {})));
  };

  const cancelEdit = () => { setEditingSection(null); setEditData({}); };

  // Stable callback for EditableRowInput onChange
  const handleFieldChange = useCallback((field: string, value: string) => {
    setEditData((prev: any) => ({ ...prev, [field]: value }));
  }, []);

  const saveEdit = async (section: string) => {
    const d = { ...submission.data_json };
    d[section] = editData;
    const updates: any = { data_json: d };
    if (section === "owner") {
      updates.owner_name = editData.firstName ? `${editData.firstName} ${editData.lastName || ""}`.trim() : null;
      updates.owner_email = editData.email || null;
    }
    if (section === "travel") {
      updates.first_country_of_entry = editData.firstCountry || null;
      updates.final_destination = editData.finalCountry || null;
      updates.entry_date = editData.dateOfEntry || null;
    }
    const { error } = await supabase.from("submissions").update(updates).eq("id", id!);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    setEditingSection(null);
    setEditData({});
    fetchAll();
    toast({ title: "Changes saved" });
  };

  const saveIssueData = async () => {
    const { error } = await supabase.from("submissions").update({
      issuing_practice_id: issueData.issuing_practice_id || null,
      issuing_vet_id: issueData.issuing_vet_id || null,
      issue_datetime: issueData.issue_datetime ? new Date(issueData.issue_datetime).toISOString() : null,
      issue_place: issueData.issue_place || null,
      certificate_number: issueData.certificate_number || null,
      selected_template_id: issueData.selected_template_id || null,
    } as any).eq("id", id!);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Issue details saved" });
      fetchAll();
    }
  };

  const generateAhc = async () => {
    const errors: string[] = [];
    if (!issueData.issuing_practice_id) errors.push("Select a practice");
    if (!issueData.issuing_vet_id) errors.push("Select a vet");
    if (!issueData.issue_datetime) errors.push("Set issue date/time");
    if (!issueData.issue_place) errors.push("Enter issue place");
    if (!issueData.certificate_number) errors.push("Enter certificate number");
    if (errors.length > 0) {
      toast({ title: "Missing issuer details", description: errors.join(", "), variant: "destructive" });
      return;
    }
    await saveIssueData();
    setGenerating(true);
    try {
      // Use the authenticated user's session token instead of the anon key
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const authToken = currentSession?.access_token || SUPABASE_ANON_KEY;
      const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-ahc`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${authToken}` },
        body: JSON.stringify({
          submission_id: id,
          show_ov_guides: showOvGuides,
          strict_template_compliance: false,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        const unresolved = Array.isArray(err?.unresolved_france_categories) ? err.unresolved_france_categories : [];
        const missing = Array.isArray(err?.missing_required_canonical_keys) ? err.missing_required_canonical_keys : [];
        const detailParts: string[] = [];
        if (unresolved.length > 0) detailParts.push(`Unresolved cross-out categories: ${unresolved.join(", ")}`);
        if (missing.length > 0) detailParts.push(`Missing required fields: ${missing.join(", ")}`);
        const detail = detailParts.join(" | ");
        throw new Error(detail ? `${err.error || "Generation failed"} (${detail})` : (err.error || "Generation failed"));
      }
      await supabase.from("submissions").update({ status: "Generated" as any }).eq("id", id!);
      toast({ title: "AHC generated successfully!" });
      fetchAll();
    } catch (err) {
      toast({ title: "Generation failed", description: String(err), variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <DashboardLayout><p className="text-sm text-muted-foreground">Loading...</p></DashboardLayout>;
  if (!submission) return <DashboardLayout><p className="text-sm text-muted-foreground">Submission not found.</p></DashboardLayout>;

  const d = submission.data_json || {};
  const canRequestCorrection = ["Submitted", "UnderReview", "NeedsCorrection"].includes(submission.status);

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "answers", label: "Answers" },
    { id: "documents", label: "Documents" },
    { id: "issue", label: "Issue & Sign" },
  ];

  // Render helpers using stable references
  const renderEditableField = (label: string, field: string, displayValue: string, isEditing: boolean) => (
    <div key={field} className="flex justify-between py-1.5 border-b border-border/30 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      {isEditing ? (
        <EditableRowInput field={field} value={editData[field] ?? ""} onChange={handleFieldChange} />
      ) : (
        <span className="font-medium text-right max-w-[60%]">{displayValue || "—"}</span>
      )}
    </div>
  );

  const renderSectionHeader = (title: string, section: string, data: any) => (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider">{title}</h3>
      {isEditable && (
        editingSection === section ? (
          <div className="flex items-center gap-1">
            <button onClick={() => saveEdit(section)} className="p-1 rounded-full hover:bg-secondary text-foreground"><Save className="w-4 h-4" /></button>
            <button onClick={cancelEdit} className="p-1 rounded-full hover:bg-secondary text-muted-foreground"><X className="w-4 h-4" /></button>
          </div>
        ) : (
          <button onClick={() => startEdit(section, data)} className="p-1 rounded-full hover:bg-secondary text-muted-foreground"><Edit2 className="w-4 h-4" /></button>
        )
      )}
    </div>
  );

  return (
    <DashboardLayout>
      <button onClick={() => navigate("/")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors uppercase tracking-widest">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="section-title mb-1">{d.owner?.firstName ? `${d.owner.firstName} ${d.owner.lastName}` : "New Submission"}</h1>
          <p className="text-xs text-muted-foreground">Created {format(new Date(submission.created_at), "dd MMM yyyy HH:mm")}</p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border mb-6">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-xs uppercase tracking-widest font-semibold transition-colors border-b-2 -mb-px whitespace-nowrap ${activeTab === t.id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="summary-section">
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3">Status</h3>
            <div className="flex items-center gap-3">
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${statusBadgeColor(submission.status)}`}>
                {STATUS_LABELS[submission.status] || submission.status}
              </span>
              <select
                value={submission.status}
                onChange={e => updateStatus(e.target.value)}
                className="form-input py-1.5 px-3 text-xs w-auto"
              >
                {DISPLAY_STATUSES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="summary-section">
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3">Key Details</h3>
            <SummaryRowDisplay label="Owner" value={d.owner?.firstName ? `${d.owner.firstName} ${d.owner.lastName}` : "—"} />
            <SummaryRowDisplay label="Email" value={d.owner?.email || "—"} />
            <SummaryRowDisplay label="Pet" value={d.pet?.name || "—"} />
            <SummaryRowDisplay label="Species" value={d.pet?.species || "—"} />
            <SummaryRowDisplay label="Entry Date" value={d.travel?.dateOfEntry || "—"} />
            <SummaryRowDisplay label="First Country" value={d.travel?.firstCountry || "—"} />
            <SummaryRowDisplay label="Final Destination" value={d.travel?.finalCountry || "—"} />
          </div>

          {canRequestCorrection && (
            <div className="summary-section">
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3">Request Correction</h3>
              {submission.correction_message && (
                <div className="mb-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                  <p className="text-xs font-medium text-destructive mb-1">Current correction message:</p>
                  <p className="text-xs text-muted-foreground">{submission.correction_message}</p>
                </div>
              )}
              <textarea
                value={correctionMessage}
                onChange={e => setCorrectionMessage(e.target.value)}
                className="form-input mb-2"
                rows={3}
                placeholder="Describe what needs to be corrected..."
              />
              <div className="flex gap-2">
                <button onClick={requestCorrection} className="btn-secondary text-xs">
                  Send Correction Request & Copy Link
                </button>
              </div>
            </div>
          )}

          <div className="summary-section">
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3">Audit Log</h3>
            {auditLog.length === 0 ? (
              <p className="text-sm text-muted-foreground">No actions recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {auditLog.map(a => (
                  <div key={a.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">{format(new Date(a.created_at), "dd MMM HH:mm")}</span>
                    <span className="font-medium text-foreground">{a.action}</span>
                    {a.details_json?.from && <span>({a.details_json.from} → {a.details_json.status})</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Answers Tab - Editable */}
      {activeTab === "answers" && (
        <div className="space-y-4">
          <div className="summary-section">
            {renderSectionHeader("Owner Details", "owner", d.owner)}
            {renderEditableField("First Name", "firstName", d.owner?.firstName, editingSection === "owner")}
            {renderEditableField("Last Name", "lastName", d.owner?.lastName, editingSection === "owner")}
            {renderEditableField("House/Number", "houseNameNumber", d.owner?.houseNameNumber, editingSection === "owner")}
            {renderEditableField("Street", "street", d.owner?.street, editingSection === "owner")}
            {renderEditableField("Town/City", "townCity", d.owner?.townCity, editingSection === "owner")}
            {renderEditableField("Postal Code", "postalCode", d.owner?.postalCode, editingSection === "owner")}
            {renderEditableField("Country", "country", d.owner?.country, editingSection === "owner")}
            {renderEditableField("Phone", "phone", d.owner?.phone, editingSection === "owner")}
            {renderEditableField("Email", "email", d.owner?.email, editingSection === "owner")}
          </div>

          <div className="summary-section">
            {renderSectionHeader("Transport", "transport", d.transport)}
            {renderEditableField("Transported By", "transportedBy", d.transport?.transportedBy, editingSection === "transport")}
            {renderEditableField("Carrier Name", "carrierName", d.transport?.carrierName, editingSection === "transport")}
          </div>

          {(d.transport?.transportedBy === "authorised" || d.transport?.transportedBy === "carrier") && d.authorisedPerson && (
            <div className="summary-section">
              {renderSectionHeader("Authorised Person", "authorisedPerson", d.authorisedPerson)}
              {editingSection === "authorisedPerson" ? (
                <>
                  {renderEditableField("First Name", "firstName", d.authorisedPerson?.firstName, true)}
                  {renderEditableField("Last Name", "lastName", d.authorisedPerson?.lastName, true)}
                  {renderEditableField("Phone", "phone", d.authorisedPerson?.phone, true)}
                  {renderEditableField("Email", "email", d.authorisedPerson?.email, true)}
                </>
              ) : (
                <>
                  <SummaryRowDisplay label="Name" value={d.authorisedPerson?.firstName ? `${d.authorisedPerson.firstName} ${d.authorisedPerson.lastName}` : ""} />
                  <SummaryRowDisplay label="Phone" value={d.authorisedPerson?.phone || ""} />
                  <SummaryRowDisplay label="Email" value={d.authorisedPerson?.email || ""} />
                </>
              )}
            </div>
          )}

          <div className="summary-section">
            {renderSectionHeader("Pet Information", "pet", d.pet)}
            {renderEditableField("Name", "name", d.pet?.name, editingSection === "pet")}
            {renderEditableField("Species", "species", d.pet?.species, editingSection === "pet")}
            {renderEditableField("Breed", "breed", editingSection === "pet" ? d.pet?.breed : (d.pet?.breed === "Other" ? d.pet?.breedOther || "Other" : d.pet?.breed), editingSection === "pet")}
            {renderEditableField("DOB", "dateOfBirth", d.pet?.dateOfBirth, editingSection === "pet")}
            {renderEditableField("Colour", "colour", d.pet?.colour, editingSection === "pet")}
            {renderEditableField("Sex", "sex", d.pet?.sex, editingSection === "pet")}
            {renderEditableField("Neutered", "neutered", d.pet?.neutered, editingSection === "pet")}
            {renderEditableField("Microchip", "microchipNumber", d.pet?.microchipNumber, editingSection === "pet")}
            {renderEditableField("Microchip Date", "microchipDate", d.pet?.microchipDate, editingSection === "pet")}
          </div>

          <div className="summary-section">
            {renderSectionHeader("Travel", "travel", d.travel)}
            {renderEditableField("Means", "meansOfTravel", d.travel?.meansOfTravel, editingSection === "travel")}
            {renderEditableField("Entry Date", "dateOfEntry", d.travel?.dateOfEntry, editingSection === "travel")}
            {renderEditableField("First Country", "firstCountry", d.travel?.firstCountry, editingSection === "travel")}
            {renderEditableField("Final Destination", "finalCountry", d.travel?.finalCountry, editingSection === "travel")}
          </div>

          <div className="summary-section">
            {renderSectionHeader("Rabies Vaccination", "rabies", d.rabies)}
            {renderEditableField("Date", "vaccinationDate", d.rabies?.vaccinationDate, editingSection === "rabies")}
            {renderEditableField("Vaccine", "vaccineName", d.rabies?.vaccineName, editingSection === "rabies")}
            {renderEditableField("Manufacturer", "manufacturer", d.rabies?.manufacturer, editingSection === "rabies")}
            {renderEditableField("Batch", "batchNumber", d.rabies?.batchNumber, editingSection === "rabies")}
            {renderEditableField("Valid From", "validFrom", d.rabies?.validFrom, editingSection === "rabies")}
            {renderEditableField("Valid To", "validTo", d.rabies?.validTo, editingSection === "rabies")}
          </div>

          {d.uploads?.rabiesCertificateName && (
            <div className="summary-section">
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3">Rabies Certificate</h3>
              <SummaryRowDisplay label="File" value={d.uploads.rabiesCertificateName} />
              {d.uploads.rabiesCertificate && (
                <a href={d.uploads.rabiesCertificate} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs mt-2 inline-flex items-center gap-1">
                  <Download className="w-3.5 h-3.5" /> View Upload
                </a>
              )}
            </div>
          )}

          <div className="summary-section">
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3">Declaration</h3>
            <SummaryRowDisplay label="Agreed" value={d.declaration?.agreed ? "Yes" : "No"} />
            <SummaryRowDisplay label="Signature" value={d.declaration?.signature || ""} />
            <SummaryRowDisplay label="Date" value={d.declaration?.date || ""} />
          </div>
        </div>
      )}

      {/* Documents Tab */}
      {activeTab === "documents" && (
        <div className="space-y-4">
          {d.uploads?.rabiesCertificateName && (
            <div className="summary-section flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{d.uploads.rabiesCertificateName}</p>
                <p className="text-xs text-muted-foreground">Client upload (rabies certificate)</p>
              </div>
              {d.uploads.rabiesCertificate && (
                <a href={d.uploads.rabiesCertificate} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs">View</a>
              )}
            </div>
          )}

          <div className="summary-section">
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3">Generated Certificates</h3>
            {submission.final_ahc_pdf_url ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <span className="text-sm">Animal Health Certificate</span>
                      {submission.issue_datetime && (
                        <p className="text-xs text-muted-foreground">Generated {format(new Date(submission.updated_at), "dd MMM yyyy HH:mm")}</p>
                      )}
                    </div>
                  </div>
                  <a href={`/pdf?file=${encodeURIComponent(submission.final_ahc_pdf_path)}`} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs flex items-center gap-1">
                    <Download className="w-3.5 h-3.5" /> Download
                  </a>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Password: ETV2026</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No certificates generated yet. Go to Issue & Sign tab.</p>
            )}
          </div>
        </div>
      )}

      {/* Issue & Sign Tab */}
      {activeTab === "issue" && (
        <div className="space-y-4">
          <div className="summary-section">
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-4">Generate Animal Health Certificate</h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="form-label">Practice</label>
                <select
                  value={issueData.issuing_practice_id}
                  onChange={e => setIssueData(prev => ({ ...prev, issuing_practice_id: e.target.value }))}
                  className="form-input"
                >
                  <option value="">Select practice...</option>
                  {practices.map(p => (
                    <option key={p.id} value={p.id}>{p.practice_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Vet</label>
                <select
                  value={issueData.issuing_vet_id}
                  onChange={e => setIssueData(prev => ({ ...prev, issuing_vet_id: e.target.value }))}
                  className="form-input"
                >
                  <option value="">Select vet...</option>
                  {vets.map(v => (
                    <option key={v.id} value={v.id}>{v.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Issue Date</label>
                <input
                  type="date"
                  value={issueData.issue_datetime}
                  onChange={e => setIssueData(prev => ({ ...prev, issue_datetime: e.target.value }))}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Place of Issue</label>
                <select
                  value={issueData.issue_place}
                  onChange={e => setIssueData(prev => ({ ...prev, issue_place: e.target.value }))}
                  className="form-input"
                >
                  <option value="">Select location...</option>
                  {practices.map(p => {
                    const loc = [p.city, p.postcode].filter(Boolean).join(", ");
                    return <option key={p.id} value={loc || p.practice_name}>{loc || p.practice_name}</option>;
                  })}
                </select>
              </div>
              <div>
                <label className="form-label">Certificate Number</label>
                <input
                  type="text"
                  value={issueData.certificate_number}
                  onChange={e => setIssueData(prev => ({ ...prev, certificate_number: e.target.value }))}
                  className="form-input"
                  placeholder="e.g. GB/AHC/2024/001"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="form-label">AHC Template</label>
                <select
                  value={issueData.selected_template_id}
                  onChange={e => setIssueData(prev => ({ ...prev, selected_template_id: e.target.value }))}
                  className="form-input"
                >
                  <option value="">Auto-detect from country...</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.first_country_entry} ({t.language_pair}) — {t.template_code}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Auto-selected based on first country of entry. Override manually if needed.
                </p>
              </div>
            </div>

            <div className="flex gap-2 mt-6 items-center">
              <button onClick={saveIssueData} className="btn-secondary text-xs">Save Details</button>
              <button onClick={generateAhc} disabled={generating} className="btn-primary text-xs">
                {generating ? "Generating..." : submission.final_ahc_pdf_url ? "Re-generate Certificate" : "Generate Certificate"}
              </button>
              <div className="flex items-center gap-2 ml-4 border-l border-border pl-4">
                <Switch
                  id="ov-guides"
                  checked={showOvGuides}
                  onCheckedChange={setShowOvGuides}
                />
                <label htmlFor="ov-guides" className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1">
                  {showOvGuides ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  OV stamp guides
                </label>
              </div>
            </div>

            {submission.final_ahc_pdf_url && (
              <div className="mt-4 p-4 rounded-xl bg-[hsl(var(--success))]/10 border border-[hsl(var(--success))]/30">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-success" /> Certificate Generated
                    </span>
                    {submission.issue_datetime && (
                      <p className="text-xs text-muted-foreground mt-1">Generated {format(new Date(submission.updated_at), "dd MMM yyyy HH:mm")}</p>
                    )}
                  </div>
                  <a href={`/pdf?file=${encodeURIComponent(submission.final_ahc_pdf_path)}`} target="_blank" rel="noopener noreferrer" className="btn-primary text-xs flex items-center gap-1">
                    <Download className="w-3.5 h-3.5" /> Download
                  </a>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Password: ETV2026</p>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default SubmissionDetail;

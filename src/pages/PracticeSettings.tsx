import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Plus, Edit2, Trash2, X, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const emptyPractice = {
  practice_name: "", trading_name: "", address_line_1: "", address_line_2: "",
  city: "", postcode: "", country: "United Kingdom", phone: "", email: "",
  rcvs_premises_ref: "", ov_practice_id: "",
};

const emptyVet = {
  full_name: "", email: "", phone: "", rcvs_number: "", role_title: "",
  signature_text: "",
};

const PracticeSettings = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<"practices" | "vets">("practices");

  // Practices state
  const [practices, setPractices] = useState<any[]>([]);
  const [practiceLoading, setPracticeLoading] = useState(true);
  const [editingPractice, setEditingPractice] = useState<any>(null);
  const [showPracticeForm, setShowPracticeForm] = useState(false);
  const [practiceForm, setPracticeForm] = useState(emptyPractice);

  // Vets state
  const [vetsList, setVetsList] = useState<any[]>([]);
  const [vetLoading, setVetLoading] = useState(true);
  const [editingVet, setEditingVet] = useState<any>(null);
  const [showVetForm, setShowVetForm] = useState(false);
  const [vetForm, setVetForm] = useState(emptyVet);

  useEffect(() => { fetchPractices(); fetchVets(); }, []);

  const fetchPractices = async () => {
    const { data } = await supabase.from("vet_practices").select("*").order("practice_name");
    if (data) setPractices(data);
    setPracticeLoading(false);
  };

  const fetchVets = async () => {
    const { data } = await supabase.from("vets").select("*").order("full_name");
    if (data) setVetsList(data);
    setVetLoading(false);
  };

  // Practice CRUD
  const handleSavePractice = async () => {
    if (!profile) return;
    if (!practiceForm.practice_name.trim()) {
      toast({ title: "Practice name is required", variant: "destructive" });
      return;
    }
    if (editingPractice) {
      const { error } = await supabase.from("vet_practices").update({ ...practiceForm } as any).eq("id", editingPractice.id);
      if (error) { toast({ title: "Update failed", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Practice updated" });
    } else {
      const { error } = await supabase.from("vet_practices").insert({ ...practiceForm, clinic_id: profile.clinic_id } as any);
      if (error) { toast({ title: "Create failed", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Practice created" });
    }
    setShowPracticeForm(false); setEditingPractice(null); setPracticeForm(emptyPractice); fetchPractices();
  };

  const handleEditPractice = (p: any) => {
    setEditingPractice(p);
    setPracticeForm({
      practice_name: p.practice_name || "", trading_name: p.trading_name || "",
      address_line_1: p.address_line_1 || "", address_line_2: p.address_line_2 || "",
      city: p.city || "", postcode: p.postcode || "", country: p.country || "United Kingdom",
      phone: p.phone || "", email: p.email || "",
      rcvs_premises_ref: p.rcvs_premises_ref || "", ov_practice_id: p.ov_practice_id || "",
    });
    setShowPracticeForm(true);
  };

  const handleDeletePractice = async (id: string) => {
    if (!confirm("Delete this practice?")) return;
    await supabase.from("vet_practices").delete().eq("id", id);
    toast({ title: "Practice deleted" }); fetchPractices();
  };

  // Vet CRUD
  const handleSaveVet = async () => {
    if (!profile) return;
    if (!vetForm.full_name.trim()) {
      toast({ title: "Full name is required", variant: "destructive" });
      return;
    }
    if (editingVet) {
      const { error } = await supabase.from("vets").update({ ...vetForm } as any).eq("id", editingVet.id);
      if (error) { toast({ title: "Update failed", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Vet updated" });
    } else {
      const { error } = await supabase.from("vets").insert({ ...vetForm, clinic_id: profile.clinic_id } as any);
      if (error) { toast({ title: "Create failed", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Vet created" });
    }
    setShowVetForm(false); setEditingVet(null); setVetForm(emptyVet); fetchVets();
  };

  const handleEditVet = (v: any) => {
    setEditingVet(v);
    setVetForm({
      full_name: v.full_name || "", email: v.email || "", phone: v.phone || "",
      rcvs_number: v.rcvs_number || "", role_title: v.role_title || "",
      signature_text: v.signature_text || "",
    });
    setShowVetForm(true);
  };

  const handleDeleteVet = async (id: string) => {
    if (!confirm("Delete this vet?")) return;
    await supabase.from("vets").delete().eq("id", id);
    toast({ title: "Vet deleted" }); fetchVets();
  };

  const sectionTab = (id: "practices" | "vets", label: string) => (
    <button
      onClick={() => setActiveSection(id)}
      className={`px-4 py-2 text-xs uppercase tracking-widest font-semibold transition-colors border-b-2 -mb-px ${activeSection === id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
    >
      {label}
    </button>
  );

  return (
    <DashboardLayout>
      <h1 className="section-title mb-6">Practice Settings</h1>

      <div className="flex gap-1 border-b border-border mb-6">
        {sectionTab("practices", "Practices")}
        {sectionTab("vets", "Vets")}
      </div>

      {/* Practices Section */}
      {activeSection === "practices" && (
        <>
          <div className="flex items-center justify-end mb-4">
            <button onClick={() => { setEditingPractice(null); setPracticeForm(emptyPractice); setShowPracticeForm(true); }} className="btn-primary flex items-center gap-2 text-xs">
              <Plus className="w-4 h-4" /> Add Practice
            </button>
          </div>

          {showPracticeForm && (
            <div className="summary-section mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider">{editingPractice ? "Edit Practice" : "New Practice"}</h3>
                <button onClick={() => { setShowPracticeForm(false); setEditingPractice(null); }} className="p-1"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label className="form-label">Practice Name *</label><input value={practiceForm.practice_name} onChange={e => setPracticeForm(p => ({ ...p, practice_name: e.target.value }))} className="form-input" /></div>
                <div><label className="form-label">Trading Name</label><input value={practiceForm.trading_name} onChange={e => setPracticeForm(p => ({ ...p, trading_name: e.target.value }))} className="form-input" /></div>
                <div><label className="form-label">Address Line 1</label><input value={practiceForm.address_line_1} onChange={e => setPracticeForm(p => ({ ...p, address_line_1: e.target.value }))} className="form-input" /></div>
                <div><label className="form-label">Address Line 2</label><input value={practiceForm.address_line_2} onChange={e => setPracticeForm(p => ({ ...p, address_line_2: e.target.value }))} className="form-input" /></div>
                <div><label className="form-label">City</label><input value={practiceForm.city} onChange={e => setPracticeForm(p => ({ ...p, city: e.target.value }))} className="form-input" /></div>
                <div><label className="form-label">Postcode</label><input value={practiceForm.postcode} onChange={e => setPracticeForm(p => ({ ...p, postcode: e.target.value }))} className="form-input" /></div>
                <div><label className="form-label">Phone</label><input value={practiceForm.phone} onChange={e => setPracticeForm(p => ({ ...p, phone: e.target.value }))} className="form-input" /></div>
                <div><label className="form-label">Email</label><input value={practiceForm.email} onChange={e => setPracticeForm(p => ({ ...p, email: e.target.value }))} className="form-input" /></div>
                <div><label className="form-label">RCVS Premises Ref</label><input value={practiceForm.rcvs_premises_ref} onChange={e => setPracticeForm(p => ({ ...p, rcvs_premises_ref: e.target.value }))} className="form-input" /></div>
                <div><label className="form-label">OV Practice ID</label><input value={practiceForm.ov_practice_id} onChange={e => setPracticeForm(p => ({ ...p, ov_practice_id: e.target.value }))} className="form-input" /></div>
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={handleSavePractice} className="btn-primary text-xs flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Save</button>
                <button onClick={() => { setShowPracticeForm(false); setEditingPractice(null); }} className="btn-secondary text-xs">Cancel</button>
              </div>
            </div>
          )}

          {practiceLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : practices.length === 0 ? (
            <div className="border border-border rounded-3xl p-12 text-center bg-white">
              <p className="text-sm text-muted-foreground">No practices added yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {practices.map(p => (
                <div key={p.id} className="summary-section flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">{p.practice_name}</p>
                    {p.trading_name && <p className="text-xs text-muted-foreground">{p.trading_name}</p>}
                    <p className="text-xs text-muted-foreground mt-1">{[p.address_line_1, p.city, p.postcode].filter(Boolean).join(", ")}</p>
                    {p.rcvs_premises_ref && <p className="text-xs text-muted-foreground">RCVS: {p.rcvs_premises_ref}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleEditPractice(p)} className="p-1.5 rounded-full hover:bg-secondary text-muted-foreground"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDeletePractice(p.id)} className="p-1.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Vets Section */}
      {activeSection === "vets" && (
        <>
          <div className="flex items-center justify-end mb-4">
            <button onClick={() => { setEditingVet(null); setVetForm(emptyVet); setShowVetForm(true); }} className="btn-primary flex items-center gap-2 text-xs">
              <Plus className="w-4 h-4" /> Add Vet
            </button>
          </div>

          {showVetForm && (
            <div className="summary-section mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider">{editingVet ? "Edit Vet" : "New Vet"}</h3>
                <button onClick={() => { setShowVetForm(false); setEditingVet(null); }} className="p-1"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label className="form-label">Full Name *</label><input value={vetForm.full_name} onChange={e => setVetForm(p => ({ ...p, full_name: e.target.value }))} className="form-input" /></div>
                <div><label className="form-label">RCVS Number</label><input value={vetForm.rcvs_number} onChange={e => setVetForm(p => ({ ...p, rcvs_number: e.target.value }))} className="form-input" /></div>
                <div><label className="form-label">Role / Title</label><input value={vetForm.role_title} onChange={e => setVetForm(p => ({ ...p, role_title: e.target.value }))} className="form-input" /></div>
                <div><label className="form-label">Email</label><input value={vetForm.email} onChange={e => setVetForm(p => ({ ...p, email: e.target.value }))} className="form-input" /></div>
                <div><label className="form-label">Phone</label><input value={vetForm.phone} onChange={e => setVetForm(p => ({ ...p, phone: e.target.value }))} className="form-input" /></div>
                <div><label className="form-label">Signature Text</label><input value={vetForm.signature_text} onChange={e => setVetForm(p => ({ ...p, signature_text: e.target.value }))} className="form-input" placeholder="e.g. Dr J Smith MRCVS" /></div>
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={handleSaveVet} className="btn-primary text-xs flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Save</button>
                <button onClick={() => { setShowVetForm(false); setEditingVet(null); }} className="btn-secondary text-xs">Cancel</button>
              </div>
            </div>
          )}

          {vetLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : vetsList.length === 0 ? (
            <div className="border border-border rounded-3xl p-12 text-center bg-white">
              <p className="text-sm text-muted-foreground">No vets added yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {vetsList.map(v => (
                <div key={v.id} className="summary-section flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">{v.full_name}</p>
                    {v.role_title && <p className="text-xs text-muted-foreground">{v.role_title}</p>}
                    {v.rcvs_number && <p className="text-xs text-muted-foreground">RCVS: {v.rcvs_number}</p>}
                    {v.email && <p className="text-xs text-muted-foreground">{v.email}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleEditVet(v)} className="p-1.5 rounded-full hover:bg-secondary text-muted-foreground"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDeleteVet(v.id)} className="p-1.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
};

export default PracticeSettings;

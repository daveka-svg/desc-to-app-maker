import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Plus, Edit2, Trash2, X, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Practices = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [practices, setPractices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);

  const emptyPractice = {
    practice_name: "", trading_name: "", address_line_1: "", address_line_2: "",
    city: "", postcode: "", country: "United Kingdom", phone: "", email: "",
    rcvs_premises_ref: "", ov_practice_id: "",
  };

  const [form, setForm] = useState(emptyPractice);

  useEffect(() => { fetchPractices(); }, []);

  const fetchPractices = async () => {
    const { data } = await supabase.from("vet_practices").select("*").order("practice_name");
    if (data) setPractices(data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!profile) return;
    if (!form.practice_name.trim()) {
      toast({ title: "Practice name is required", variant: "destructive" });
      return;
    }

    if (editing) {
      const { error } = await supabase.from("vet_practices").update({ ...form } as any).eq("id", editing.id);
      if (error) { toast({ title: "Update failed", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Practice updated" });
    } else {
      const { error } = await supabase.from("vet_practices").insert({ ...form, clinic_id: profile.clinic_id } as any);
      if (error) { toast({ title: "Create failed", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Practice created" });
    }

    setShowForm(false);
    setEditing(null);
    setForm(emptyPractice);
    fetchPractices();
  };

  const handleEdit = (p: any) => {
    setEditing(p);
    setForm({
      practice_name: p.practice_name || "",
      trading_name: p.trading_name || "",
      address_line_1: p.address_line_1 || "",
      address_line_2: p.address_line_2 || "",
      city: p.city || "",
      postcode: p.postcode || "",
      country: p.country || "United Kingdom",
      phone: p.phone || "",
      email: p.email || "",
      rcvs_premises_ref: p.rcvs_premises_ref || "",
      ov_practice_id: p.ov_practice_id || "",
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this practice?")) return;
    await supabase.from("vet_practices").delete().eq("id", id);
    toast({ title: "Practice deleted" });
    fetchPractices();
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="section-title mb-0">Practices</h1>
        <button onClick={() => { setEditing(null); setForm(emptyPractice); setShowForm(true); }} className="btn-primary flex items-center gap-2 text-xs">
          <Plus className="w-4 h-4" /> Add Practice
        </button>
      </div>

      {showForm && (
        <div className="summary-section mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider">{editing ? "Edit Practice" : "New Practice"}</h3>
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="p-1"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="form-label">Practice Name *</label><input value={form.practice_name} onChange={e => setForm(p => ({ ...p, practice_name: e.target.value }))} className="form-input" /></div>
            <div><label className="form-label">Trading Name</label><input value={form.trading_name} onChange={e => setForm(p => ({ ...p, trading_name: e.target.value }))} className="form-input" /></div>
            <div><label className="form-label">Address Line 1</label><input value={form.address_line_1} onChange={e => setForm(p => ({ ...p, address_line_1: e.target.value }))} className="form-input" /></div>
            <div><label className="form-label">Address Line 2</label><input value={form.address_line_2} onChange={e => setForm(p => ({ ...p, address_line_2: e.target.value }))} className="form-input" /></div>
            <div><label className="form-label">City</label><input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} className="form-input" /></div>
            <div><label className="form-label">Postcode</label><input value={form.postcode} onChange={e => setForm(p => ({ ...p, postcode: e.target.value }))} className="form-input" /></div>
            <div><label className="form-label">Phone</label><input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className="form-input" /></div>
            <div><label className="form-label">Email</label><input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="form-input" /></div>
            <div><label className="form-label">RCVS Premises Ref</label><input value={form.rcvs_premises_ref} onChange={e => setForm(p => ({ ...p, rcvs_premises_ref: e.target.value }))} className="form-input" /></div>
            <div><label className="form-label">OV Practice ID</label><input value={form.ov_practice_id} onChange={e => setForm(p => ({ ...p, ov_practice_id: e.target.value }))} className="form-input" /></div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={handleSave} className="btn-primary text-xs flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Save</button>
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="btn-secondary text-xs">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
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
                <button onClick={() => handleEdit(p)} className="p-1.5 rounded-full hover:bg-secondary text-muted-foreground"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
};

export default Practices;

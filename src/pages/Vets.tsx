import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Plus, Edit2, Trash2, X, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Vets = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [vetsList, setVetsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);

  const emptyVet = {
    full_name: "", email: "", phone: "", rcvs_number: "", role_title: "",
    signature_text: "",
  };

  const [form, setForm] = useState(emptyVet);

  useEffect(() => { fetchVets(); }, []);

  const fetchVets = async () => {
    const { data } = await supabase.from("vets").select("*").order("full_name");
    if (data) setVetsList(data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!profile) return;
    if (!form.full_name.trim()) {
      toast({ title: "Full name is required", variant: "destructive" });
      return;
    }

    if (editing) {
      const { error } = await supabase.from("vets").update({ ...form } as any).eq("id", editing.id);
      if (error) { toast({ title: "Update failed", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Vet updated" });
    } else {
      const { error } = await supabase.from("vets").insert({ ...form, clinic_id: profile.clinic_id } as any);
      if (error) { toast({ title: "Create failed", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Vet created" });
    }

    setShowForm(false);
    setEditing(null);
    setForm(emptyVet);
    fetchVets();
  };

  const handleEdit = (v: any) => {
    setEditing(v);
    setForm({
      full_name: v.full_name || "",
      email: v.email || "",
      phone: v.phone || "",
      rcvs_number: v.rcvs_number || "",
      role_title: v.role_title || "",
      signature_text: v.signature_text || "",
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this vet?")) return;
    await supabase.from("vets").delete().eq("id", id);
    toast({ title: "Vet deleted" });
    fetchVets();
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="section-title mb-0">Vets</h1>
        <button onClick={() => { setEditing(null); setForm(emptyVet); setShowForm(true); }} className="btn-primary flex items-center gap-2 text-xs">
          <Plus className="w-4 h-4" /> Add Vet
        </button>
      </div>

      {showForm && (
        <div className="summary-section mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider">{editing ? "Edit Vet" : "New Vet"}</h3>
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="p-1"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="form-label">Full Name *</label><input value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} className="form-input" /></div>
            <div><label className="form-label">RCVS Number</label><input value={form.rcvs_number} onChange={e => setForm(p => ({ ...p, rcvs_number: e.target.value }))} className="form-input" /></div>
            <div><label className="form-label">Role / Title</label><input value={form.role_title} onChange={e => setForm(p => ({ ...p, role_title: e.target.value }))} className="form-input" /></div>
            <div><label className="form-label">Email</label><input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="form-input" /></div>
            <div><label className="form-label">Phone</label><input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className="form-input" /></div>
            <div><label className="form-label">Signature Text</label><input value={form.signature_text} onChange={e => setForm(p => ({ ...p, signature_text: e.target.value }))} className="form-input" placeholder="e.g. Dr J Smith MRCVS" /></div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={handleSave} className="btn-primary text-xs flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Save</button>
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="btn-secondary text-xs">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
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
                <button onClick={() => handleEdit(v)} className="p-1.5 rounded-full hover:bg-secondary text-muted-foreground"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(v.id)} className="p-1.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
};

export default Vets;

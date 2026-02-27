import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Plus, Pencil, Trash2, ExternalLink, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const EU_COUNTRIES = [
  "Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czech Republic",
  "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Hungary",
  "Ireland", "Italy", "Latvia", "Lithuania", "Luxembourg", "Malta",
  "Netherlands", "Northern Ireland", "Poland", "Portugal", "Romania",
  "Slovakia", "Slovenia", "Spain", "Sweden",
];

const LANGUAGE_CODES: Record<string, string> = {
  Austria: "de", Belgium: "fr", Bulgaria: "bg", Croatia: "hr", Cyprus: "el",
  "Czech Republic": "cs", Denmark: "da", Estonia: "et", Finland: "fi",
  France: "fr", Germany: "de", Greece: "el", Hungary: "hu", Ireland: "en",
  Italy: "it", Latvia: "lv", Lithuania: "lt", Luxembourg: "fr", Malta: "mt",
  Netherlands: "nl", "Northern Ireland": "en", Poland: "pl", Portugal: "pt",
  Romania: "ro", Slovakia: "sk", Slovenia: "sl", Spain: "es", Sweden: "sv",
};

type Template = {
  id: string;
  name: string;
  first_country_of_entry: string;
  second_language_code: string;
  template_pdf_url: string;
  active: boolean;
  mapping_schema_json: any;
  created_at: string;
};

const Templates = () => {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    first_country_of_entry: "",
    second_language_code: "",
    template_pdf_url: "",
    active: true,
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    const { data } = await supabase.from("document_templates").select("*").order("first_country_of_entry");
    if (data) setTemplates(data as Template[]);
    setLoading(false);
  };

  const resetForm = () => {
    setForm({ name: "", first_country_of_entry: "", second_language_code: "", template_pdf_url: "", active: true });
    setEditId(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!form.name || !form.first_country_of_entry || !form.template_pdf_url) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }

    if (editId) {
      await supabase.from("document_templates").update(form as any).eq("id", editId);
      toast({ title: "Template updated" });
    } else {
      await supabase.from("document_templates").insert(form as any);
      toast({ title: "Template added" });
    }

    resetForm();
    fetchTemplates();
  };

  const handleEdit = (t: Template) => {
    setForm({
      name: t.name,
      first_country_of_entry: t.first_country_of_entry,
      second_language_code: t.second_language_code,
      template_pdf_url: t.template_pdf_url,
      active: t.active,
    });
    setEditId(t.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("document_templates").delete().eq("id", id);
    fetchTemplates();
    toast({ title: "Template deleted" });
  };

  const handleCountryChange = (country: string) => {
    setForm(prev => ({
      ...prev,
      first_country_of_entry: country,
      second_language_code: LANGUAGE_CODES[country] || "",
      name: prev.name || `AHC - English/${country}`,
    }));
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="section-title mb-0">Template Library</h1>
        {isAdmin && (
          <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Add Template
          </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="summary-section mb-6">
          <h3 className="text-sm font-semibold mb-4">{editId ? "Edit Template" : "Add Template"}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="form-label">First Country of Entry *</label>
              <select
                value={form.first_country_of_entry}
                onChange={e => handleCountryChange(e.target.value)}
                className="form-input"
              >
                <option value="">Select country...</option>
                {EU_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Second Language Code</label>
              <input
                value={form.second_language_code}
                onChange={e => setForm(prev => ({ ...prev, second_language_code: e.target.value }))}
                className="form-input"
                placeholder="e.g. fr, de, es"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">Template Name *</label>
              <input
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                className="form-input"
                placeholder="e.g. AHC - English/French (France)"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">Template PDF URL *</label>
              <input
                value={form.template_pdf_url}
                onChange={e => setForm(prev => ({ ...prev, template_pdf_url: e.target.value }))}
                className="form-input"
                placeholder="https://www.improve-ov.com/..."
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.active}
                onChange={e => setForm(prev => ({ ...prev, active: e.target.checked }))}
                className="rounded border-border"
              />
              <label className="text-sm">Active</label>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleSave} className="btn-primary text-xs flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Save
            </button>
            <button onClick={resetForm} className="btn-secondary text-xs flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Templates List */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : templates.length === 0 ? (
        <p className="text-sm text-muted-foreground">No templates added yet.</p>
      ) : (
        <div className="border border-border rounded-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Country</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Language</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Active</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Template URL</th>
                  {isAdmin && <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {templates.map(t => (
                  <tr key={t.id} className="border-b border-border/50">
                    <td className="px-4 py-3 font-medium">{t.name}</td>
                    <td className="px-4 py-3">{t.first_country_of_entry}</td>
                    <td className="px-4 py-3">{t.second_language_code}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs ${t.active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                        {t.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <a href={t.template_pdf_url} target="_blank" rel="noopener noreferrer" className="text-xs underline hover:opacity-80 flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" /> View PDF
                      </a>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => handleEdit(t)} className="text-muted-foreground hover:text-foreground">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(t.id)} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
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

export default Templates;

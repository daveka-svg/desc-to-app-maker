import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Lock, Loader2 } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const PdfView = () => {
  const [searchParams] = useSearchParams();
  const filePath = searchParams.get("file");
  const [password, setPassword] = useState("");
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!filePath || !password) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/serve-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, file_path: filePath }),
      });

      if (res.status === 403) {
        setError("Incorrect password. Please try again.");
        return;
      }
      if (!res.ok) {
        setError("Failed to load document.");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl(url);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!filePath) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <p className="text-muted-foreground text-sm">No document specified.</p>
      </div>
    );
  }

  if (pdfBlobUrl) {
    return (
      <div className="fixed inset-0 bg-background">
        <iframe
          src={pdfBlobUrl}
          className="w-full h-full border-0"
          title="AHC Certificate"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="summary-section text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-lg font-semibold mb-1">Protected Document</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Enter the password to view this certificate.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              className="form-input text-center"
              autoFocus
              disabled={loading}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Verifying..." : "Unlock Document"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PdfView;

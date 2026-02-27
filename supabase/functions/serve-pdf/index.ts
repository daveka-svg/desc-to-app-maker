import "jsr:@supabase/functions-js@2.4.1/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GENERATED_PDF_PASSWORD = Deno.env.get("GENERATED_PDF_PASSWORD") || "ETV2026";
const GENERATED_PDF_BUCKET = Deno.env.get("GENERATED_PDF_BUCKET") || "generated-pdfs";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { password, file_path } = await req.json();

    if (!file_path) {
      return new Response(JSON.stringify({ error: "Missing file_path" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (password !== GENERATED_PDF_PASSWORD) {
      return new Response(JSON.stringify({ error: "Invalid password" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase.storage
      .from(GENERATED_PDF_BUCKET)
      .download(file_path);

    if (error || !data) {
      console.error("Storage download error:", error);
      return new Response(JSON.stringify({ error: "File not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const arrayBuffer = await data.arrayBuffer();

    return new Response(arrayBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${file_path}"`,
      },
    });
  } catch (err) {
    console.error("serve-pdf error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

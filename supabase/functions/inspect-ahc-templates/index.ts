import "jsr:@supabase/functions-js@2.4.1/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { PDFDocument } from "npm:pdf-lib@1.17.1";
import {
  FRANCE_CHECK_CATEGORIES,
  FRANCE_CROSSOUT_CATEGORIES,
  REQUIRED_CANONICAL_KEYS,
  buildCheckCategoryMapping,
  buildFieldMapping,
  detectProfile,
  validateCanonicalCoverage,
  validateFieldOverrides,
  type FranceCrossoutCategory,
} from "../_shared/ahc-core.ts";

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowedOrigins.length === 0) {
    allowedOrigins.push(Deno.env.get("SUPABASE_URL") || "");
    allowedOrigins.push("http://localhost:5173", "http://localhost:3000");
  }
  const resolvedOrigin = allowedOrigins.includes(origin) ? origin : (allowedOrigins[0] || "");
  return {
    "Access-Control-Allow-Origin": resolvedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

function inferStoragePathFromTemplateUrl(templatePdfUrl: string | null | undefined): string | null {
  if (!templatePdfUrl) return null;
  try {
    const urlPath = decodeURIComponent(new URL(templatePdfUrl).pathname);
    const filename = urlPath.split("/").pop() || "";
    if (!filename) return null;
    const hasFillableSuffix = filename.toLowerCase().endsWith("-fillable.pdf");
    const resolved = hasFillableSuffix ? filename : filename.replace(/\.pdf$/i, "-fillable.pdf");
    return `templates/${resolved}`;
  } catch {
    return null;
  }
}

interface TemplateCandidate {
  source: "ahc_templates" | "document_templates";
  id: string;
  display_name: string;
  template_code: string;
  first_country: string;
  language_pair: string;
  storage_bucket: string;
  storage_path: string | null;
  mapping_json: any;
}

interface InspectionResult {
  source: string;
  id: string;
  display_name: string;
  template_code: string;
  first_country: string;
  language_pair: string;
  storage_bucket: string;
  storage_path: string | null;
  profile: string | null;
  check_count: number;
  strike_count: number;
  field_count: number;
  fields: string[];
  missing_required_canonical_keys: string[];
  unresolved_france_categories: string[];
  invalid_override_fields: { canonicalKey: string; pdfField: string; reason: string }[];
  mapped_canonical_key_count: number;
  effective_check_category_count: number;
  issues: string[];
}

function extractIndex1To20(fieldName: string): number | null {
  const match = fieldName.match(/(?:^|[^0-9])(20|1[0-9]|[1-9])(?![0-9])/);
  if (!match) return null;
  const idx = Number(match[1]);
  return idx >= 1 && idx <= 20 ? idx : null;
}

function normalizeCheckLikeName(fieldName: string): string | null {
  const strict = fieldName.match(/^Check\s*(\d+)$/i);
  if (strict) return `Check ${Number(strict[1])}`;
  const checkLike = /\b(check(?:\s*box)?|checkbox|tick(?:\s*box)?|wyboru|wybor)\b/i;
  if (!checkLike.test(fieldName)) return null;
  const idx = extractIndex1To20(fieldName);
  return idx ? `Check ${idx}` : null;
}

type SelectableKind = "checkbox" | "radio";

interface SelectableFieldRef {
  name: string;
  kind: SelectableKind;
  pageIdx: number;
  x: number;
  y: number;
}

function resolveSelectableField(form: any, fieldName: string): { kind: SelectableKind; field: any } | null {
  try {
    return { kind: "checkbox", field: form.getCheckBox(fieldName) };
  } catch {}
  try {
    return { kind: "radio", field: form.getRadioGroup(fieldName) };
  } catch {}
  return null;
}

function collectSelectableFieldRefs(form: any, pages: any[]): SelectableFieldRef[] {
  const allFields = form.getFields();
  const refs: SelectableFieldRef[] = [];
  for (const field of allFields) {
    const name = field.getName();
    const resolved = resolveSelectableField(form, name);
    if (!resolved) continue;

    let pageIdx = 0;
    let x = Number.POSITIVE_INFINITY;
    let y = Number.NEGATIVE_INFINITY;

    try {
      const widgets = resolved.field.acroField.getWidgets();
      if (widgets.length > 0) {
        const rect = widgets[0].getRectangle();
        x = rect.x;
        y = rect.y;
        const pageRef = widgets[0].P();
        if (pageRef) {
          for (let i = 0; i < pages.length; i++) {
            if (pages[i].ref === pageRef) {
              pageIdx = i;
              break;
            }
          }
        }
      }
    } catch {}

    refs.push({ name, kind: resolved.kind, pageIdx, x, y });
  }
  return refs;
}

function discoverCanonicalCheckNames(form: any, pages: any[]): string[] {
  const allFields = form.getFields();
  const discovered = new Map<string, string>();
  const selectableRefs = collectSelectableFieldRefs(form, pages);

  for (const field of allFields) {
    const name = field.getName();
    const canonical = normalizeCheckLikeName(name);
    if (canonical && !discovered.has(canonical)) discovered.set(canonical, name);
  }

  const assignedFieldNames = new Set(discovered.values());
  for (const ref of selectableRefs) {
    if (assignedFieldNames.has(ref.name)) continue;
    const idx = extractIndex1To20(ref.name);
    if (!idx) continue;
    const canonical = `Check ${idx}`;
    if (!discovered.has(canonical)) {
      discovered.set(canonical, ref.name);
      assignedFieldNames.add(ref.name);
    }
  }

  if (discovered.size < 20 && selectableRefs.length >= 20) {
    const ordered = [...selectableRefs].sort((a, b) =>
      a.pageIdx - b.pageIdx
      || b.y - a.y
      || a.x - b.x
      || a.name.localeCompare(b.name)
    );
    for (const ref of ordered) {
      if (assignedFieldNames.has(ref.name)) continue;
      const nextMissing = Array.from({ length: 20 }, (_, i) => i + 1)
        .find((n) => !discovered.has(`Check ${n}`));
      if (!nextMissing) break;
      discovered.set(`Check ${nextMissing}`, ref.name);
      assignedFieldNames.add(ref.name);
    }
  }

  return [...discovered.keys()];
}

function buildEffectiveCheckCategories(
  canonicalChecks: Iterable<string>,
  checkCategories: Record<string, FranceCrossoutCategory>,
): Record<string, FranceCrossoutCategory> {
  const effective: Record<string, FranceCrossoutCategory> = {};
  for (const [checkName, category] of Object.entries(checkCategories)) {
    const normalized = normalizeCheckLikeName(checkName);
    if (normalized) effective[normalized] = category;
  }
  for (const canonicalCheck of canonicalChecks) {
    if (effective[canonicalCheck]) continue;
    const category = FRANCE_CHECK_CATEGORIES[canonicalCheck];
    if (category) effective[canonicalCheck] = category;
  }
  return effective;
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callerUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !callerUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const includeDocumentTemplates = body?.include_document_templates !== false;
    const includeAhcTemplates = body?.include_ahc_templates !== false;
    const saveManifestToStorage = body?.save_manifest_to_storage === true;
    const strictComplianceReport = body?.strict_compliance_report === true;
    const outputBucket = body?.output_bucket || "generated-pdfs";
    const outputPath = body?.output_path || `manifests/ahc-template-manifest-${Date.now()}.json`;

    const candidates: TemplateCandidate[] = [];

    if (includeAhcTemplates) {
      const { data: ahcTemplates, error } = await supabase
        .from("ahc_templates")
        .select("id, template_code, first_country_entry, language_pair, storage_bucket, storage_path, ahc_template_mappings(mapping_json)");
      if (error) throw new Error(`ahc_templates query failed: ${error.message}`);

      for (const row of ahcTemplates || []) {
        const mappingJson = Array.isArray((row as any).ahc_template_mappings)
          ? (row as any).ahc_template_mappings?.[0]?.mapping_json
          : (row as any).ahc_template_mappings?.mapping_json;
        candidates.push({
          source: "ahc_templates",
          id: row.id,
          display_name: row.template_code,
          template_code: row.template_code,
          first_country: row.first_country_entry || "",
          language_pair: row.language_pair || "",
          storage_bucket: row.storage_bucket || "generated-pdfs",
          storage_path: row.storage_path || null,
          mapping_json: mappingJson || {},
        });
      }
    }

    if (includeDocumentTemplates) {
      const { data: documentTemplates, error } = await supabase
        .from("document_templates")
        .select("id, name, first_country_of_entry, second_language_code, storage_bucket, storage_path, template_pdf_url, mapping_schema_json");
      if (error) throw new Error(`document_templates query failed: ${error.message}`);

      for (const row of documentTemplates || []) {
        const path = row.storage_path || inferStoragePathFromTemplateUrl(row.template_pdf_url);
        candidates.push({
          source: "document_templates",
          id: row.id,
          display_name: row.name,
          template_code: row.name,
          first_country: row.first_country_of_entry || "",
          language_pair: row.second_language_code || "",
          storage_bucket: row.storage_bucket || "generated-pdfs",
          storage_path: path,
          mapping_json: (row.mapping_schema_json || {}) as any,
        });
      }
    }

    const byUniquePath = new Map<string, TemplateCandidate>();
    for (const candidate of candidates) {
      const key = `${candidate.source}:${candidate.storage_bucket}:${candidate.storage_path || "__missing__"}:${candidate.id}`;
      byUniquePath.set(key, candidate);
    }
    const uniqueCandidates = [...byUniquePath.values()];

    const results: InspectionResult[] = [];

    for (const candidate of uniqueCandidates) {
      const issues: string[] = [];
      if (!candidate.storage_path) {
        issues.push("missing_storage_path");
        results.push({
          source: candidate.source,
          id: candidate.id,
          display_name: candidate.display_name,
          template_code: candidate.template_code,
          first_country: candidate.first_country,
          language_pair: candidate.language_pair,
          storage_bucket: candidate.storage_bucket,
          storage_path: candidate.storage_path,
          profile: null,
          check_count: 0,
          strike_count: 0,
          field_count: 0,
          fields: [],
          missing_required_canonical_keys: [...REQUIRED_CANONICAL_KEYS],
          unresolved_france_categories: [...FRANCE_CROSSOUT_CATEGORIES],
          invalid_override_fields: [],
          mapped_canonical_key_count: 0,
          effective_check_category_count: 0,
          issues,
        });
        continue;
      }

      const { data: fileData, error: dlError } = await supabase.storage
        .from(candidate.storage_bucket)
        .download(candidate.storage_path);
      if (dlError || !fileData) {
        issues.push(`download_failed:${dlError?.message || "unknown"}`);
        results.push({
          source: candidate.source,
          id: candidate.id,
          display_name: candidate.display_name,
          template_code: candidate.template_code,
          first_country: candidate.first_country,
          language_pair: candidate.language_pair,
          storage_bucket: candidate.storage_bucket,
          storage_path: candidate.storage_path,
          profile: null,
          check_count: 0,
          strike_count: 0,
          field_count: 0,
          fields: [],
          missing_required_canonical_keys: [...REQUIRED_CANONICAL_KEYS],
          unresolved_france_categories: [...FRANCE_CROSSOUT_CATEGORIES],
          invalid_override_fields: [],
          mapped_canonical_key_count: 0,
          effective_check_category_count: 0,
          issues,
        });
        continue;
      }

      let fields: string[] = [];
      let profile: ReturnType<typeof detectProfile> | null = null;
      let missingRequiredCanonicalKeys: string[] = [];
      let unresolvedFranceCategories: string[] = [];
      let invalidOverrideFields: { canonicalKey: string; pdfField: string; reason: string }[] = [];
      let mappedCanonicalKeyCount = 0;
      let effectiveCheckCategoryCount = 0;

      try {
        const bytes = await fileData.arrayBuffer();
        const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const form = pdfDoc.getForm();
        fields = form.getFields().map((f) => f.getName()).sort();
        const fieldSet = new Set(fields);

        profile = detectProfile(fieldSet, {
          templateHint: [
            candidate.display_name,
            candidate.template_code,
            candidate.first_country,
            candidate.language_pair,
            candidate.storage_path || "",
          ].join(" "),
        });

        const mappingJson = candidate.mapping_json && typeof candidate.mapping_json === "object"
          ? candidate.mapping_json
          : {};
        const fieldOverrides = mappingJson.field_overrides && typeof mappingJson.field_overrides === "object"
          ? mappingJson.field_overrides as Record<string, string>
          : undefined;
        const checkCategoryOverrides = mappingJson.crossout_categories && typeof mappingJson.crossout_categories === "object"
          ? mappingJson.crossout_categories as Record<string, string>
          : undefined;

        const fieldMapping = buildFieldMapping(profile, fieldSet, fieldOverrides);
        mappedCanonicalKeyCount = Object.values(fieldMapping).filter(Boolean).length;
        missingRequiredCanonicalKeys = validateCanonicalCoverage(fieldMapping, REQUIRED_CANONICAL_KEYS);
        invalidOverrideFields = validateFieldOverrides(fieldOverrides, fieldSet).map((issue) => ({
          canonicalKey: issue.canonicalKey,
          pdfField: issue.pdfField,
          reason: issue.reason,
        }));

        const checkCategories = buildCheckCategoryMapping(fieldSet, checkCategoryOverrides);
        const discoveredChecks = discoverCanonicalCheckNames(form, pdfDoc.getPages());
        const effectiveCheckCategories = buildEffectiveCheckCategories(discoveredChecks, checkCategories);
        effectiveCheckCategoryCount = Object.keys(effectiveCheckCategories).length;
        const presentCategories = new Set(Object.values(effectiveCheckCategories));
        unresolvedFranceCategories = FRANCE_CROSSOUT_CATEGORIES.filter((cat) => !presentCategories.has(cat));
        if (strictComplianceReport && unresolvedFranceCategories.length > 0) {
          issues.push(`strict_crossout_noncompliant:${unresolvedFranceCategories.join(",")}`);
        }
      } catch (error) {
        issues.push(`inspection_failed:${String(error)}`);
      }

      results.push({
        source: candidate.source,
        id: candidate.id,
        display_name: candidate.display_name,
        template_code: candidate.template_code,
        first_country: candidate.first_country,
        language_pair: candidate.language_pair,
        storage_bucket: candidate.storage_bucket,
        storage_path: candidate.storage_path,
        profile: profile?.profile || null,
        check_count: profile?.checkCount || 0,
        strike_count: profile?.strikeCount || 0,
        field_count: fields.length,
        fields,
        missing_required_canonical_keys: missingRequiredCanonicalKeys,
        unresolved_france_categories: unresolvedFranceCategories,
        invalid_override_fields: invalidOverrideFields,
        mapped_canonical_key_count: mappedCanonicalKeyCount,
        effective_check_category_count: effectiveCheckCategoryCount,
        issues,
      });
    }

    results.sort((a, b) => a.template_code.localeCompare(b.template_code));

    const manifest = {
      generated_at: new Date().toISOString(),
      generated_by: callerUser.email || callerUser.id,
      total_templates: results.length,
      strict_compliance_report: strictComplianceReport,
      failing_templates: results.filter((r) =>
        r.issues.length > 0
        || r.missing_required_canonical_keys.length > 0
        || r.invalid_override_fields.length > 0
      ).length,
      templates: results,
    };

    if (saveManifestToStorage) {
      const encoded = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
      const { error: uploadError } = await supabase.storage
        .from(outputBucket)
        .upload(outputPath, encoded, {
          contentType: "application/json",
          upsert: true,
        });
      if (uploadError) {
        return new Response(JSON.stringify({ error: `Manifest upload failed: ${uploadError.message}`, manifest }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ...manifest, manifest_storage_bucket: outputBucket, manifest_storage_path: outputPath }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(manifest), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("inspect-ahc-templates error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

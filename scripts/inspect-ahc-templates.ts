import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import {
  FRANCE_CHECK_CATEGORIES,
  FRANCE_CROSSOUT_CATEGORIES,
  REQUIRED_CANONICAL_KEYS,
  buildCheckCategoryMapping,
  buildFieldMapping,
  detectProfile,
  validateCanonicalCoverage,
  validateFieldOverrides,
} from "../supabase/functions/_shared/ahc-core.ts";

type TemplateOverrideConfig = {
  field_overrides?: Record<string, string>;
  crossout_categories?: Record<string, string>;
};

type OverridesManifest = Record<string, TemplateOverrideConfig>;

const ROOT = process.cwd();
const TEMPLATE_DIR = path.resolve(ROOT, "public", "templates");
const OUTPUT_FILE = path.resolve(ROOT, "public", "templates", "ahc-template-manifest.json");
const OVERRIDES_FILE = path.resolve(ROOT, "scripts", "ahc-template-overrides.json");

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

function discoverCanonicalCheckNames(form: any): string[] {
  const allFields = form.getFields();
  const discovered = new Map<string, string>();
  const checkboxNames: string[] = [];

  for (const field of allFields) {
    const name = field.getName();
    const canonical = normalizeCheckLikeName(name);
    if (canonical && !discovered.has(canonical)) discovered.set(canonical, name);
    try {
      form.getCheckBox(name);
      checkboxNames.push(name);
    } catch {}
  }

  const assignedFieldNames = new Set(discovered.values());
  for (const checkboxName of checkboxNames) {
    if (assignedFieldNames.has(checkboxName)) continue;
    const idx = extractIndex1To20(checkboxName);
    if (!idx) continue;
    const canonical = `Check ${idx}`;
    if (!discovered.has(canonical)) {
      discovered.set(canonical, checkboxName);
      assignedFieldNames.add(checkboxName);
    }
  }

  if (discovered.size < 20 && checkboxNames.length >= 20 && checkboxNames.length <= 26) {
    for (const checkboxName of checkboxNames) {
      if (assignedFieldNames.has(checkboxName)) continue;
      const nextMissing = Array.from({ length: 20 }, (_, i) => i + 1)
        .find((n) => !discovered.has(`Check ${n}`));
      if (!nextMissing) break;
      discovered.set(`Check ${nextMissing}`, checkboxName);
      assignedFieldNames.add(checkboxName);
    }
  }

  return [...discovered.keys()];
}

function buildEffectiveCheckCategories(
  canonicalChecks: Iterable<string>,
  checkCategories: Record<string, string>,
): Record<string, string> {
  const effective: Record<string, string> = {};
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

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadOverrides(): Promise<OverridesManifest> {
  if (!await fileExists(OVERRIDES_FILE)) return {};
  const raw = await fs.readFile(OVERRIDES_FILE, "utf8");
  const parsed = JSON.parse(raw) as OverridesManifest;
  return parsed && typeof parsed === "object" ? parsed : {};
}

async function listTemplateFiles(): Promise<string[]> {
  const items = await fs.readdir(TEMPLATE_DIR, { withFileTypes: true });
  return items
    .filter((item) => item.isFile() && /^AHC\d+/i.test(item.name) && item.name.toLowerCase().endsWith(".pdf"))
    .map((item) => path.join(TEMPLATE_DIR, item.name))
    .sort((a, b) => a.localeCompare(b));
}

async function inspectTemplate(filePath: string, overrides: TemplateOverrideConfig) {
  const bytes = await fs.readFile(filePath);
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const first = String(args[0] || "");
    if (first.includes("Trying to parse invalid object") || first.includes("Invalid object ref")) return;
    originalWarn(...args);
  };
  let pdfDoc: PDFDocument;
  try {
    pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  } finally {
    console.warn = originalWarn;
  }
  const form = pdfDoc.getForm();
  const fields = form.getFields().map((field) => field.getName()).sort();
  const fieldSet = new Set(fields);

  const profile = detectProfile(fieldSet, { templateHint: path.basename(filePath) });
  const fieldMapping = buildFieldMapping(profile, fieldSet, overrides.field_overrides);
  const mappedCanonicalKeyCount = Object.values(fieldMapping).filter(Boolean).length;
  const missingRequiredCanonicalKeys = validateCanonicalCoverage(fieldMapping, REQUIRED_CANONICAL_KEYS);
  const invalidOverrideFields = validateFieldOverrides(overrides.field_overrides, fieldSet);

  const checkCategories = buildCheckCategoryMapping(fieldSet, overrides.crossout_categories);
  const discoveredChecks = discoverCanonicalCheckNames(form);
  const effectiveCheckCategories = buildEffectiveCheckCategories(discoveredChecks, checkCategories);
  const presentCategories = new Set(Object.values(effectiveCheckCategories));
  const unresolvedFranceCategories = FRANCE_CROSSOUT_CATEGORIES.filter((category) => !presentCategories.has(category));

  return {
    file: path.basename(filePath),
    absolute_path: filePath,
    profile: profile.profile,
    check_count: profile.checkCount,
    strike_count: profile.strikeCount,
    field_count: fields.length,
    fields,
    mapped_canonical_key_count: mappedCanonicalKeyCount,
    effective_check_category_count: Object.keys(effectiveCheckCategories).length,
    missing_required_canonical_keys: missingRequiredCanonicalKeys,
    unresolved_france_categories: unresolvedFranceCategories,
    invalid_override_fields: invalidOverrideFields,
  };
}

async function main() {
  const overridesManifest = await loadOverrides();
  const templateFiles = await listTemplateFiles();

  const templates = [];
  for (const filePath of templateFiles) {
    const filename = path.basename(filePath);
    const overrides = overridesManifest[filename] || {};
    const inspected = await inspectTemplate(filePath, overrides);
    templates.push(inspected);
  }

  const manifest = {
    generated_at: new Date().toISOString(),
    template_root: TEMPLATE_DIR,
    required_canonical_keys: REQUIRED_CANONICAL_KEYS,
    total_templates: templates.length,
    failing_templates: templates.filter((template) =>
      template.missing_required_canonical_keys.length > 0
      || template.invalid_override_fields.length > 0
    ).length,
    templates,
  };

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(manifest, null, 2));
  console.log(`Wrote manifest: ${OUTPUT_FILE}`);
  console.log(`Templates inspected: ${templates.length}`);
  console.log(`Templates with validation findings: ${manifest.failing_templates}`);
}

await main();

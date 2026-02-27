import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, PDFName, PDFNumber, PDFString, rgb } from "pdf-lib";
import { FRANCE_CHECK_CATEGORIES, detectProfile } from "../supabase/functions/_shared/ahc-core.ts";
import {
  FRANCE_CHECK_ANCHOR_BY_CHECK,
  FRANCE_STRIKE_GEOMETRY_BY_CHECK,
  FRANCE_STRIKE_GEOMETRY_PAGE_INDEX_BASE,
  type CheckAnchorRect,
  type StrikeGeometryRect,
} from "../supabase/functions/_shared/france-strike-geometry.ts";

type SelectableKind = "checkbox" | "radio";

interface SelectableFieldRef {
  name: string;
  kind: SelectableKind;
  pageIdx: number;
  x: number;
  y: number;
}

interface GeometryShift {
  pageDelta: number;
  dx: number;
  dy: number;
  anchors?: number;
}

interface GeometryOverlayWidget extends StrikeGeometryRect {
  canonicalCheck: string;
}

interface GeometryCheckAnchor {
  pageIdx: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface OverlayWidget {
  pageIdx: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface AhcTemplateRow {
  template_code: string;
  first_country_entry: string;
  language_pair: string;
  storage_bucket: string;
  storage_path: string;
  is_active: boolean;
}

function parseDotEnv(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx < 1) continue;
    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

async function getConfig() {
  const envPath = path.resolve(process.cwd(), ".env");
  let parsedEnv: Record<string, string> = {};
  try {
    const raw = await fs.readFile(envPath, "utf8");
    parsedEnv = parseDotEnv(raw);
  } catch {
    parsedEnv = {};
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || parsedEnv.VITE_SUPABASE_URL;
  const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || parsedEnv.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) {
    throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY");
  }

  return {
    supabaseUrl: supabaseUrl.replace(/\/+$/, ""),
    publishableKey,
    outputRoot: path.resolve("C:/Users/bratn/Downloads/AHC"),
  };
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

function resolveSelectableField(form: any, fieldName: string): { kind: SelectableKind; field: any } | null {
  try {
    return { kind: "checkbox", field: form.getCheckBox(fieldName) };
  } catch {}
  try {
    return { kind: "radio", field: form.getRadioGroup(fieldName) };
  } catch {}
  return null;
}

function getSelectableWidgets(form: any, fieldName: string): any[] {
  const resolved = resolveSelectableField(form, fieldName);
  if (!resolved) return [];
  try {
    return resolved.field.acroField.getWidgets() || [];
  } catch {
    return [];
  }
}

function setSelectableChecked(form: any, fieldName: string, checked: boolean): boolean {
  try {
    const cb = form.getCheckBox(fieldName);
    if (checked) cb.check();
    else cb.uncheck();
    return true;
  } catch {}

  try {
    const rg = form.getRadioGroup(fieldName);
    if (checked) {
      const options = rg.getOptions();
      if (!options || options.length === 0) return false;
      rg.select(options[0]);
    } else {
      rg.clear();
    }
    return true;
  } catch {}

  return false;
}

function collectSelectableFieldRefs(form: any, allFields: any[], pages: any[]): SelectableFieldRef[] {
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

function discoverCanonicalCheckFields(form: any, allFields: any[], pages: any[]): Map<string, string> {
  const checkActualByCanonical = new Map<string, string>();
  const selectableRefs = collectSelectableFieldRefs(form, allFields, pages);

  for (const field of allFields) {
    const name = field.getName();
    const canonicalCheck = normalizeCheckLikeName(name);
    if (canonicalCheck && !checkActualByCanonical.has(canonicalCheck)) {
      checkActualByCanonical.set(canonicalCheck, name);
    }
  }

  const assignedCheckFieldNames = new Set(checkActualByCanonical.values());
  for (const ref of selectableRefs) {
    if (assignedCheckFieldNames.has(ref.name)) continue;
    const idx = extractIndex1To20(ref.name);
    if (!idx) continue;
    const canonical = `Check ${idx}`;
    if (!checkActualByCanonical.has(canonical)) {
      checkActualByCanonical.set(canonical, ref.name);
      assignedCheckFieldNames.add(ref.name);
    }
  }

  if (checkActualByCanonical.size < 20 && selectableRefs.length >= 20) {
    const ordered = [...selectableRefs].sort((a, b) =>
      a.pageIdx - b.pageIdx ||
      b.y - a.y ||
      a.x - b.x ||
      a.name.localeCompare(b.name)
    );
    for (const ref of ordered) {
      if (assignedCheckFieldNames.has(ref.name)) continue;
      const nextMissing = Array.from({ length: 20 }, (_, i) => i + 1).find((n) => !checkActualByCanonical.has(`Check ${n}`));
      if (!nextMissing) break;
      checkActualByCanonical.set(`Check ${nextMissing}`, ref.name);
      assignedCheckFieldNames.add(ref.name);
    }
  }

  return checkActualByCanonical;
}

function resolveFranceGeometryPageIndex(rawIdx: number, pageCount: number): number | null {
  const primaryIdx = FRANCE_STRIKE_GEOMETRY_PAGE_INDEX_BASE === 1 ? rawIdx - 1 : rawIdx;
  if (primaryIdx >= 0 && primaryIdx < pageCount) return primaryIdx;

  const legacyIdx = FRANCE_STRIKE_GEOMETRY_PAGE_INDEX_BASE === 1 ? rawIdx : rawIdx - 1;
  if (legacyIdx >= 0 && legacyIdx < pageCount) return legacyIdx;

  return null;
}

function resolveWidgetPageIndex(widget: any, pages: any[]): number {
  const pageRef = widget.P();
  if (pageRef) {
    for (let i = 0; i < pages.length; i++) {
      if (pages[i].ref === pageRef) return i;
    }
  }
  return 0;
}

function computeFranceGeometryShift(
  form: any,
  pages: any[],
  checkActualByCanonical: Map<string, string>,
): GeometryShift | null {
  const deltas: { pageDelta: number; dx: number; dy: number }[] = [];

  for (const [canonicalCheck, actualCheckName] of checkActualByCanonical.entries()) {
    const idx = extractIndex1To20(canonicalCheck);
    if (!idx) continue;
    const franceAnchor: CheckAnchorRect | undefined = FRANCE_CHECK_ANCHOR_BY_CHECK[String(idx)];
    if (!franceAnchor) continue;

    const widgets = getSelectableWidgets(form, actualCheckName);
    if (widgets.length === 0) continue;

    try {
      const rect = widgets[0].getRectangle();
      const pageIdx = resolveWidgetPageIndex(widgets[0], pages);
      deltas.push({
        pageDelta: pageIdx - franceAnchor.pageIdx,
        dx: rect.x - franceAnchor.x,
        dy: rect.y - franceAnchor.y,
      });
    } catch {}
  }

  if (deltas.length === 0) return null;

  const avgPageDelta = deltas.reduce((sum, d) => sum + d.pageDelta, 0) / deltas.length;
  const avgDx = deltas.reduce((sum, d) => sum + d.dx, 0) / deltas.length;
  const avgDy = deltas.reduce((sum, d) => sum + d.dy, 0) / deltas.length;

  return {
    pageDelta: Math.round(avgPageDelta),
    dx: avgDx,
    dy: avgDy,
    anchors: deltas.length,
  };
}

function buildFranceGeometryOverlayWidgets(
  checkCanonicalNames: Iterable<string>,
  pageCount: number,
  shift: GeometryShift | null = null,
): GeometryOverlayWidget[] {
  const widgets: GeometryOverlayWidget[] = [];
  for (const canonical of checkCanonicalNames) {
    const idx = extractIndex1To20(canonical);
    if (!idx) continue;
    const segments = FRANCE_STRIKE_GEOMETRY_BY_CHECK[String(idx)] || [];
    for (const seg of segments) {
      const shiftedRawPageIdx = seg.pageIdx + (shift?.pageDelta ?? 0);
      const pageIdx = resolveFranceGeometryPageIndex(shiftedRawPageIdx, pageCount);
      if (pageIdx === null) continue;
      widgets.push({
        ...seg,
        canonicalCheck: canonical,
        pageIdx,
        x: seg.x + (shift?.dx ?? 0),
        y: seg.y + (shift?.dy ?? 0),
      });
    }
  }
  return widgets;
}

function buildFranceGeometryAnchors(
  checkCanonicalNames: Iterable<string>,
  pageCount: number,
  shift: GeometryShift | null,
  form: any,
  pages: any[],
  checkActualByCanonical: Map<string, string>,
): Map<string, GeometryCheckAnchor> {
  const anchors = new Map<string, GeometryCheckAnchor>();

  for (const canonicalCheck of checkCanonicalNames) {
    const actualCheckName = checkActualByCanonical.get(canonicalCheck);
    if (actualCheckName) {
      const widgets = getSelectableWidgets(form, actualCheckName);
      if (widgets.length > 0) {
        try {
          const rect = widgets[0].getRectangle();
          const pageIdx = resolveWidgetPageIndex(widgets[0], pages);
          anchors.set(canonicalCheck, {
            pageIdx,
            x: rect.x,
            y: rect.y,
            w: rect.width,
            h: rect.height,
          });
          continue;
        } catch {}
      }
    }

    const idx = extractIndex1To20(canonicalCheck);
    if (!idx) continue;
    const franceAnchor: CheckAnchorRect | undefined = FRANCE_CHECK_ANCHOR_BY_CHECK[String(idx)];
    if (!franceAnchor) continue;

    const shiftedRawPageIdx = franceAnchor.pageIdx + (shift?.pageDelta ?? 0);
    const pageIdx = resolveFranceGeometryPageIndex(shiftedRawPageIdx, pageCount);
    if (pageIdx === null) continue;

    anchors.set(canonicalCheck, {
      pageIdx,
      x: franceAnchor.x + (shift?.dx ?? 0),
      y: franceAnchor.y + (shift?.dy ?? 0),
      w: franceAnchor.w,
      h: franceAnchor.h,
    });
  }

  return anchors;
}

function buildReducedGeometryRowsByCheck(
  checkCanonicalNames: Iterable<string>,
  geometryOverlayWidgets: GeometryOverlayWidget[],
  anchorsByCheck: Map<string, GeometryCheckAnchor>,
): Map<string, OverlayWidget[]> {
  const anchorsByPage = new Map<number, { canonicalCheck: string; centerY: number }[]>();
  for (const [canonicalCheck, anchor] of anchorsByCheck.entries()) {
    const centerY = anchor.y + (anchor.h / 2);
    const items = anchorsByPage.get(anchor.pageIdx) ?? [];
    items.push({ canonicalCheck, centerY });
    anchorsByPage.set(anchor.pageIdx, items);
  }
  for (const items of anchorsByPage.values()) {
    items.sort((a, b) => b.centerY - a.centerY);
  }

  const segmentsByCheck = new Map<string, GeometryOverlayWidget[]>();
  for (const seg of geometryOverlayWidgets) {
    const items = segmentsByCheck.get(seg.canonicalCheck) ?? [];
    items.push(seg);
    segmentsByCheck.set(seg.canonicalCheck, items);
  }

  const rowsByCheck = new Map<string, OverlayWidget[]>();

  for (const canonicalCheck of checkCanonicalNames) {
    const segments = segmentsByCheck.get(canonicalCheck) ?? [];
    const anchor = anchorsByCheck.get(canonicalCheck);
    let filtered = segments;

    if (anchor) {
      const anchorCenterY = anchor.y + (anchor.h / 2);
      const anchorPage = anchor.pageIdx;
      const pageAnchors = anchorsByPage.get(anchorPage) ?? [];
      const nextLower = pageAnchors.find((candidate) => (anchorCenterY - candidate.centerY) > 20);
      const lowerBoundY = nextLower ? (nextLower.centerY + 8) : Number.NEGATIVE_INFINITY;
      const checkIdx = extractIndex1To20(canonicalCheck);
      const declarationUpperPad = checkIdx && checkIdx >= 16 ? 40 : 2;
      const upperBoundY = anchorCenterY + declarationUpperPad;

      filtered = segments.filter((seg) => {
        if (seg.pageIdx !== anchorPage) return false;
        const lineY = seg.y + (seg.h / 2);
        return lineY >= lowerBoundY && lineY <= upperBoundY;
      });

      if (filtered.length === 0) {
        filtered = segments.filter((seg) => seg.pageIdx === anchorPage);
      }
    }

    filtered.sort((a, b) => {
      if (a.pageIdx !== b.pageIdx) return a.pageIdx - b.pageIdx;
      return (b.y + (b.h / 2)) - (a.y + (a.h / 2));
    });

    const mergedRows: OverlayWidget[] = [];
    const tolerance = 1.2;
    for (const seg of filtered) {
      const segY = seg.y + (seg.h / 2);
      const segEndX = seg.x + seg.w;
      const existing = mergedRows.find((row) =>
        row.pageIdx === seg.pageIdx && Math.abs((row.y + (row.h / 2)) - segY) <= tolerance
      );
      if (existing) {
        const existingEndX = existing.x + existing.w;
        const mergedX = Math.min(existing.x, seg.x);
        const mergedEndX = Math.max(existingEndX, segEndX);
        existing.x = mergedX;
        existing.w = Math.max(0, mergedEndX - mergedX);
      } else {
        mergedRows.push({
          pageIdx: seg.pageIdx,
          x: seg.x,
          y: seg.y,
          w: seg.w,
          h: seg.h,
        });
      }
    }

    if (mergedRows.length > 0) rowsByCheck.set(canonicalCheck, mergedRows);
  }

  return rowsByCheck;
}

function setWidgetsVisible(widgets: any[], visible: boolean) {
  for (const widget of widgets) {
    const fObj = widget.dict.get(PDFName.of("F"));
    const flags = fObj instanceof PDFNumber ? fObj.asNumber() : 0;
    const nextFlags = visible ? ((flags & ~1 & ~2 & ~32) | 4) : ((flags | 1 | 2 | 32) & ~4);
    widget.dict.set(PDFName.of("F"), PDFNumber.of(nextFlags));
    if (!visible) widget.dict.set(PDFName.of("AS"), PDFName.of("Off"));
  }
}

function setSelectableWidgetsVisible(form: any, fieldName: string, visible: boolean) {
  const widgets = getSelectableWidgets(form, fieldName);
  if (widgets.length === 0) return;
  setWidgetsVisible(widgets, visible);
}

function attachStrikeToggleAction(pdfDoc: any, checkField: any, strikeFieldName: string) {
  const js =
    `var nHide = event.target.isBoxChecked(0)?display.visible:display.hidden; \r\n` +
    `this.getField("${strikeFieldName}").display = nHide; \r\n`;
  const action = pdfDoc.context.obj({
    S: PDFName.of("JavaScript"),
    JS: PDFString.of(js),
  });

  const widgets = checkField?.acroField?.getWidgets?.() || [];
  if (widgets.length === 0) {
    checkField?.acroField?.dict?.set?.(PDFName.of("A"), action);
    return;
  }
  for (const widget of widgets) {
    widget.dict.set(PDFName.of("A"), action);
  }
}

function ensureReducedFranceStyleTemplateControls(pdfDoc: any): { createdChecks: number; createdStrikes: number; renderedRows: number } {
  const form = pdfDoc.getForm();
  const allFields = form.getFields();
  const pages = pdfDoc.getPages();

  const canonicalChecks = Object.keys(FRANCE_CHECK_CATEGORIES);
  const geometryShift: GeometryShift = { pageDelta: 0, dx: 0, dy: 0, anchors: 0 };
  const anchorsByCheck = buildFranceGeometryAnchors(
    canonicalChecks,
    pages.length,
    geometryShift,
    form,
    pages,
    new Map<string, string>(),
  );
  const geometryWidgets = buildFranceGeometryOverlayWidgets(canonicalChecks, pages.length, geometryShift);
  if (anchorsByCheck.size === 0 || geometryWidgets.length === 0) {
    throw new Error("No geometry anchors or widgets resolved");
  }

  const rowsByCheck = buildReducedGeometryRowsByCheck(canonicalChecks, geometryWidgets, anchorsByCheck);
  if (rowsByCheck.size === 0) {
    throw new Error("No geometry rows resolved for reduced template");
  }

  for (const field of allFields) {
    const name = field.getName();
    const canonical = normalizeCheckLikeName(name);
    if (!canonical) continue;
    if (name === canonical) continue;
    setSelectableWidgetsVisible(form, name, false);
  }

  let createdChecks = 0;
  let createdStrikes = 0;
  let renderedRows = 0;

  for (const canonicalCheck of canonicalChecks) {
    const idx = extractIndex1To20(canonicalCheck);
    if (!idx) continue;
    const strikeName = `Strike${idx}`;
    const anchor = anchorsByCheck.get(canonicalCheck);
    const rows = rowsByCheck.get(canonicalCheck) ?? [];

    let checkField: any = null;
    try {
      checkField = form.getCheckBox(canonicalCheck);
    } catch {
      checkField = null;
    }

    if (!checkField) {
      let pageIdx = anchor?.pageIdx ?? -1;
      let boxW = anchor?.w ?? 9;
      let boxH = anchor?.h ?? 8;
      let boxX = anchor?.x ?? 0;
      let boxY = anchor?.y ?? 0;

      if (rows.length > 0) {
        const topRow = [...rows].sort((a, b) =>
          a.pageIdx - b.pageIdx || (b.y + b.h / 2) - (a.y + a.h / 2)
        )[0];
        pageIdx = topRow.pageIdx;
        boxX = Math.max(24, topRow.x - boxW - 2);
        boxY = topRow.y + (topRow.h / 2) - (boxH / 2);
      }

      if (pageIdx < 0 || pageIdx >= pages.length) continue;

      checkField = form.createCheckBox(canonicalCheck);
      checkField.addToPage(pages[pageIdx], {
        x: boxX,
        y: boxY,
        width: boxW,
        height: boxH,
        borderColor: rgb(0.20, 0.24, 0.95),
        borderWidth: 1,
      });
      createdChecks++;
    }

    let strikeField: any = null;
    try {
      strikeField = form.getTextField(strikeName);
    } catch {
      strikeField = null;
    }

    if (!strikeField) {
      strikeField = form.createTextField(strikeName);
      strikeField.setText("");
      strikeField.enableReadOnly();

      for (const row of rows) {
        if (row.pageIdx < 0 || row.pageIdx >= pages.length) continue;
        const page = pages[row.pageIdx];
        const pageWidth = page.getSize().width;
        const lineEndX = Math.min(row.x + row.w, pageWidth - 24);
        if (lineEndX <= row.x + 2) continue;
        const lineHeight = 0.6;
        const lineY = row.y + (row.h / 2);
        strikeField.addToPage(page, {
          x: row.x,
          y: lineY - (lineHeight / 2),
          width: lineEndX - row.x,
          height: lineHeight,
          borderColor: rgb(0, 0, 0),
          borderWidth: 0,
          backgroundColor: rgb(0, 0, 0),
          textColor: rgb(0, 0, 0),
        });
        renderedRows++;
      }

      createdStrikes++;
    }

    if (checkField) {
      setSelectableChecked(form, canonicalCheck, false);
      attachStrikeToggleAction(pdfDoc, checkField, strikeName);
    }

    if (strikeField) {
      const widgets = strikeField.acroField.getWidgets() || [];
      setWidgetsVisible(widgets, false);
    }
  }

  return { createdChecks, createdStrikes, renderedRows };
}

function encodeStoragePath(storagePath: string): string {
  return storagePath.split("/").map((part) => encodeURIComponent(part)).join("/");
}

async function fetchActiveAhcTemplates(supabaseUrl: string, publishableKey: string): Promise<AhcTemplateRow[]> {
  const query =
    "ahc_templates?select=template_code,first_country_entry,language_pair,storage_bucket,storage_path,is_active" +
    "&is_active=eq.true&order=template_code.asc";
  const url = `${supabaseUrl}/rest/v1/${query}`;
  const res = await fetch(url, {
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${publishableKey}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Template query failed (${res.status}): ${await res.text()}`);
  }
  const rows = await res.json();
  if (!Array.isArray(rows)) return [];
  return rows as AhcTemplateRow[];
}

async function downloadTemplatePdf(
  supabaseUrl: string,
  row: AhcTemplateRow,
): Promise<Uint8Array> {
  const encodedPath = encodeStoragePath(row.storage_path);
  const objectUrl = `${supabaseUrl}/storage/v1/object/public/${row.storage_bucket}/${encodedPath}`;
  const res = await fetch(objectUrl);
  if (!res.ok) {
    throw new Error(`Download failed (${res.status}) for ${row.storage_path}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function main() {
  const cfg = await getConfig();
  const originalsDir = path.join(cfg.outputRoot, "originals");
  const convertedDir = path.join(cfg.outputRoot, "converted");
  await ensureDir(cfg.outputRoot);
  await ensureDir(originalsDir);
  await ensureDir(convertedDir);

  const rows = await fetchActiveAhcTemplates(cfg.supabaseUrl, cfg.publishableKey);
  const uniqueByPath = new Map<string, AhcTemplateRow>();
  for (const row of rows) {
    if (!row.storage_path || !row.storage_bucket) continue;
    const key = `${row.storage_bucket}:${row.storage_path}`;
    if (!uniqueByPath.has(key)) uniqueByPath.set(key, row);
  }
  const uniqueRows = [...uniqueByPath.values()];

  const summary: any[] = [];
  for (const row of uniqueRows) {
    const sourceBase = path.basename(row.storage_path);
    const sourceOutPath = path.join(originalsDir, sourceBase);
    const convertedOutPath = path.join(
      convertedDir,
      sourceBase.replace(/-fillable\.pdf$/i, "-france-fields-linked-v8.pdf"),
    );
    let convertedOutActual = convertedOutPath;

    let status = "skipped";
    let profile = "unknown";
    let createdChecks = 0;
    let createdStrikes = 0;
    let renderedRows = 0;
    let message = "";

    try {
      const pdfBytes = await downloadTemplatePdf(cfg.supabaseUrl, row);
      await fs.writeFile(sourceOutPath, pdfBytes);

      const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      const form = pdfDoc.getForm();
      const allFieldNames = new Set(form.getFields().map((f) => f.getName()));
      const profileInfo = detectProfile(allFieldNames, { templateHint: `${row.template_code} ${row.storage_path}` });
      profile = profileInfo.profile;

      if (profileInfo.profile === "textn_reduced_no_strikes") {
        const result = ensureReducedFranceStyleTemplateControls(pdfDoc);
        createdChecks = result.createdChecks;
        createdStrikes = result.createdStrikes;
        renderedRows = result.renderedRows;
        const convertedBytes = await pdfDoc.save();
        try {
          await fs.writeFile(convertedOutPath, convertedBytes);
        } catch (writeErr) {
          const msg = String(writeErr);
          if (msg.includes("EBUSY")) {
            convertedOutActual = convertedOutPath.replace(/\.pdf$/i, `-${Date.now()}.pdf`);
            await fs.writeFile(convertedOutActual, convertedBytes);
          } else {
            throw writeErr;
          }
        }
        status = "converted";
        message = `created checks=${createdChecks}, strikes=${createdStrikes}, rows=${renderedRows}`;
      } else {
        status = "skipped_non_poland_like";
        message = `profile=${profileInfo.profile}`;
      }
    } catch (error) {
      status = "error";
      message = String(error);
    }

    summary.push({
      template_code: row.template_code,
      first_country_entry: row.first_country_entry,
      language_pair: row.language_pair,
      storage_bucket: row.storage_bucket,
      storage_path: row.storage_path,
      source_out: sourceOutPath,
      converted_out: convertedOutPath,
      converted_out_actual: convertedOutActual,
      profile,
      status,
      created_checks: createdChecks,
      created_strikes: createdStrikes,
      rendered_rows: renderedRows,
      message,
    });

    console.log(`${row.template_code} -> ${status} (${message})`);
  }

  const manifestPath = path.join(cfg.outputRoot, "conversion-manifest.json");
  await fs.writeFile(
    manifestPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        output_root: cfg.outputRoot,
        total_templates: uniqueRows.length,
        converted_templates: summary.filter((s) => s.status === "converted").length,
        skipped_templates: summary.filter((s) => s.status.startsWith("skipped")).length,
        error_templates: summary.filter((s) => s.status === "error").length,
        templates: summary,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`\nSaved manifest: ${manifestPath}`);
  console.log(`Converted files folder: ${convertedDir}`);
}

await main();

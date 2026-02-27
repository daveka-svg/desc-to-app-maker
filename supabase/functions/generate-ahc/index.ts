import "jsr:@supabase/functions-js@2.4.1/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, PDFName, PDFNumber, PDFString, rgb } from "npm:pdf-lib@1.17.1";
import {
  FRANCE_CHECK_CATEGORIES,
  FRANCE_CROSSOUT_CATEGORIES,
  REQUIRED_CANONICAL_KEYS,
  buildCheckCategoryMapping,
  buildFieldMapping,
  computeCategoriesToCross,
  detectProfile,
  validateCanonicalCoverage,
  type FranceCrossoutCategory,
  type ProfileInfo,
} from "../_shared/ahc-core.ts";
import {
  FRANCE_CHECK_ANCHOR_BY_CHECK,
  FRANCE_STRIKE_GEOMETRY_BY_CHECK,
  FRANCE_STRIKE_GEOMETRY_PAGE_INDEX_BASE,
  type CheckAnchorRect,
  type StrikeGeometryRect,
} from "../_shared/france-strike-geometry.ts";

const GENERATED_PDF_BUCKET = Deno.env.get("GENERATED_PDF_BUCKET") || "generated-pdfs";
const GENERATED_PDF_PASSWORD = Deno.env.get("GENERATED_PDF_PASSWORD") || "ETV2026";

const GENERATED_PDF_PERMISSIONS = {
  printing: "highResolution" as const,
  modifying: true,
  copying: true,
  annotating: true,
  fillingForms: true,
  contentAccessibility: true,
  documentAssembly: true,
};

async function applyGeneratedPdfSecurity(pdfDoc: any) {
  if (!GENERATED_PDF_PASSWORD) return;
  if (typeof pdfDoc.encrypt !== "function") return;
  try {
    await pdfDoc.encrypt({
      userPassword: GENERATED_PDF_PASSWORD,
      ownerPassword: GENERATED_PDF_PASSWORD,
      permissions: GENERATED_PDF_PERMISSIONS,
      pdfVersion: "1.7",
    });
  } catch (err) {
    console.warn("PDF encryption failed; continuing without password protection:", err);
  }
}

// Cross-out and stamp rendering are runtime concerns; canonical logic lives in _shared/ahc-core.ts.
interface CrossoutRendererInput {
  pdfDoc: any;
  form: any;
  allFields: any[];
  profileInfo: ProfileInfo;
  categoriesToCross: Set<FranceCrossoutCategory>;
  checkCategories: Record<string, FranceCrossoutCategory>;
  templateHint?: string;
}

type SelectableKind = "checkbox" | "radio";

interface SelectableFieldRef {
  name: string;
  kind: SelectableKind;
  pageIdx: number;
  x: number;
  y: number;
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

function normalizeStrikeLikeName(fieldName: string): string | null {
  const strict = fieldName.match(/^Strike\s*(\d+)$/i);
  if (strict) return `Strike ${Number(strict[1])}`;
  const strikeLike = /\b(strike|cross\s*out|crossout|line\s*out|lineout|skre(?:\u015b|s)?l)\b/i;
  if (!strikeLike.test(fieldName)) return null;
  const idx = extractIndex1To20(fieldName);
  return idx ? `Strike ${idx}` : null;
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

  // Last resort: assign by on-page reading order for selectable widgets.
  if (checkActualByCanonical.size < 20 && selectableRefs.length >= 20) {
    const ordered = [...selectableRefs].sort((a, b) =>
      a.pageIdx - b.pageIdx
      || b.y - a.y
      || a.x - b.x
      || a.name.localeCompare(b.name)
    );
    for (const ref of ordered) {
      if (assignedCheckFieldNames.has(ref.name)) continue;
      const nextMissing = Array.from({ length: 20 }, (_, i) => i + 1)
        .find((n) => !checkActualByCanonical.has(`Check ${n}`));
      if (!nextMissing) break;
      checkActualByCanonical.set(`Check ${nextMissing}`, ref.name);
      assignedCheckFieldNames.add(ref.name);
    }
  }

  return checkActualByCanonical;
}

function buildEffectiveCheckCategories(
  discoveredChecks: Iterable<string>,
  checkCategories: Record<string, FranceCrossoutCategory>,
): { categories: Record<string, FranceCrossoutCategory>; inferredCount: number } {
  const discoveredList = Array.from(discoveredChecks);
  const categories: Record<string, FranceCrossoutCategory> = {};
  for (const [checkName, category] of Object.entries(checkCategories)) {
    const canonicalCheck = normalizeCheckLikeName(checkName);
    if (canonicalCheck) categories[canonicalCheck] = category;
  }

  let inferredCount = 0;
  for (const canonicalCheck of discoveredList) {
    if (categories[canonicalCheck]) continue;
    const category = FRANCE_CHECK_CATEGORIES[canonicalCheck];
    if (!category) continue;
    categories[canonicalCheck] = category;
    inferredCount++;
  }

  // If the template does not expose enough selectable checks, fall back to
  // canonical France check ordering so cross-outs still render universally.
  if (discoveredList.length < 20) {
    for (const [canonicalCheck, category] of Object.entries(FRANCE_CHECK_CATEGORIES)) {
      if (categories[canonicalCheck]) continue;
      categories[canonicalCheck] = category;
      inferredCount++;
    }
  }

  return { categories, inferredCount };
}

function unresolvedFranceCategories(checkCategories: Record<string, FranceCrossoutCategory>): FranceCrossoutCategory[] {
  const presentCategories = new Set(Object.values(checkCategories));
  return FRANCE_CROSSOUT_CATEGORIES.filter((category) => !presentCategories.has(category));
}

interface GeometryShift {
  pageDelta: number;
  dx: number;
  dy: number;
  anchors: number;
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

function resolveFranceGeometryPageIndex(rawIdx: number, pageCount: number): number | null {
  const primaryIdx = FRANCE_STRIKE_GEOMETRY_PAGE_INDEX_BASE === 1 ? rawIdx - 1 : rawIdx;
  if (primaryIdx >= 0 && primaryIdx < pageCount) return primaryIdx;

  // Defensive fallback for legacy data if index base metadata and values diverge.
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

function computeFranceGeometryShift(form: any, pages: any[], checkActualByCanonical: Map<string, string>): GeometryShift | null {
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
    const franceAnchor = FRANCE_CHECK_ANCHOR_BY_CHECK[String(idx)];
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

function setWidgetsVisible(widgets: any[], visible: boolean) {
  for (const widget of widgets) {
    const fObj = widget.dict.get(PDFName.of("F"));
    const flags = fObj instanceof PDFNumber ? fObj.asNumber() : 0;
    const nextFlags = visible
      ? ((flags & ~1 & ~2 & ~32) | 4)
      : ((flags | 1 | 2 | 32) & ~4);
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
  const js = `var nHide = event.target.isBoxChecked(0)?display.visible:display.hidden; \r\nthis.getField("${strikeFieldName}").display = nHide; \r\n`;
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
        row.pageIdx === seg.pageIdx &&
        Math.abs((row.y + (row.h / 2)) - segY) <= tolerance
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

interface ReducedFranceCrossoutInput {
  pdfDoc: any;
  form: any;
  allFields: any[];
  categoriesToCross: Set<FranceCrossoutCategory>;
  checkCategories: Record<string, FranceCrossoutCategory>;
  templateHint?: string;
}

function renderReducedFranceStyleCrossouts(input: ReducedFranceCrossoutInput): number | null {
  const { pdfDoc, form, allFields, categoriesToCross, checkCategories, templateHint } = input;
  const pages = pdfDoc.getPages();

  const canonicalChecks = Object.keys(FRANCE_CHECK_CATEGORIES);
  const geometryShift: GeometryShift = { pageDelta: 0, dx: 0, dy: 0, anchors: 0 };
  console.log(
    `Reduced France-style controls using canonical reduced-template geometry (template hint: ${templateHint || "n/a"})`,
  );

  const anchorsByCheck = buildFranceGeometryAnchors(
    canonicalChecks,
    pages.length,
    geometryShift,
    form,
    pages,
    new Map<string, string>(),
  );
  const geometryWidgets = buildFranceGeometryOverlayWidgets(
    canonicalChecks,
    pages.length,
    geometryShift,
  );

  if (anchorsByCheck.size === 0 || geometryWidgets.length === 0) {
    return null;
  }

  const rowsByCheck = buildReducedGeometryRowsByCheck(
    canonicalChecks,
    geometryWidgets,
    anchorsByCheck,
  );
  if (rowsByCheck.size === 0) {
    return null;
  }

  // Hide legacy reduced-template checkbox widgets (e.g. Check1) to avoid duplicates.
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
  let crossedCount = 0;

  for (const canonicalCheck of canonicalChecks) {
    const idx = extractIndex1To20(canonicalCheck);
    if (!idx) continue;
    const strikeName = `Strike${idx}`;
    const category = checkCategories[canonicalCheck] ?? FRANCE_CHECK_CATEGORIES[canonicalCheck];
    const shouldCross = categoriesToCross.has(category);
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
      setSelectableChecked(form, canonicalCheck, shouldCross);
      attachStrikeToggleAction(pdfDoc, checkField, strikeName);
    }

    if (strikeField) {
      const widgets = strikeField.acroField.getWidgets() || [];
      setWidgetsVisible(widgets, shouldCross);
    }

    if (shouldCross) crossedCount++;
  }

  if (createdChecks > 0 || createdStrikes > 0) {
    console.log(
      `Reduced France-style controls created: checks=${createdChecks}, strikes=${createdStrikes}, rows=${renderedRows}`,
    );
  }
  console.log(`Applied ${crossedCount} reduced France-style category cross-outs`);
  return crossedCount;
}

function renderCrossouts(input: CrossoutRendererInput): number {
  const { pdfDoc, form, allFields, profileInfo, categoriesToCross, checkCategories, templateHint } = input;
  const templateHintLower = (templateHint || "").toLowerCase();
  const isPolandTemplate = templateHintLower.includes("poland") || templateHintLower.includes("ahc16-en-pl");

  const isReducedTemplateFamily = profileInfo.profile === "textn_reduced_no_strikes";
  if (isReducedTemplateFamily) {
    const reducedCrossed = renderReducedFranceStyleCrossouts({
      pdfDoc,
      form,
      allFields,
      categoriesToCross,
      checkCategories,
      templateHint,
    });
    if (reducedCrossed !== null) return reducedCrossed;
    throw new Error("Reduced-template France-style crossout rendering failed: no geometry anchors or rows resolved");
  }

  const pages = pdfDoc.getPages();
  const checkActualByCanonical = discoverCanonicalCheckFields(form, allFields, pages);
  const strikeActualByCanonical = new Map<string, string>();
  const strikeLikeNames = new Set<string>();

  for (const field of allFields) {
    const name = field.getName();
    const canonicalStrike = normalizeStrikeLikeName(name);
    if (canonicalStrike && !strikeActualByCanonical.has(canonicalStrike)) {
      strikeActualByCanonical.set(canonicalStrike, name);
    }

    if (/strike|cross.?out|line.?out|skre(?:\u015b|s)?l/i.test(name)) strikeLikeNames.add(name);
  }

  const assignedStrikeFieldNames = new Set(strikeActualByCanonical.values());
  for (const strikeName of strikeLikeNames) {
    if (assignedStrikeFieldNames.has(strikeName)) continue;
    const idx = extractIndex1To20(strikeName);
    if (!idx) continue;
    const canonical = `Strike ${idx}`;
    if (!strikeActualByCanonical.has(canonical)) {
      strikeActualByCanonical.set(canonical, strikeName);
      assignedStrikeFieldNames.add(strikeName);
    }
  }

  // Hide every strike-like field first, then selectively re-enable needed ones.
  let preHiddenCount = 0;
  for (const strikeName of strikeLikeNames) {
    try {
      const strikeField = form.getField(strikeName);
      const widgets = strikeField.acroField.getWidgets();
      for (const widget of widgets) {
        const fObj = widget.dict.get(PDFName.of("F"));
        const flags = fObj instanceof PDFNumber ? fObj.asNumber() : 0;
        widget.dict.set(PDFName.of("F"), PDFNumber.of((flags | 1 | 2 | 32) & ~4));
        widget.dict.set(PDFName.of("AS"), PDFName.of("Off"));
      }
      preHiddenCount++;
    } catch {}
  }

  const checksToCrossCanonical = new Set<string>();
  const { categories: effectiveCheckCategories, inferredCount } = buildEffectiveCheckCategories(
    checkActualByCanonical.keys(),
    checkCategories,
  );
  if (inferredCount > 0) {
    console.log(`Cross-out map fallback enabled: inferred ${inferredCount} missing check categories from checkbox fields`);
  }

  for (const [checkName, category] of Object.entries(effectiveCheckCategories)) {
    const canonicalCheck = normalizeCheckLikeName(checkName);
    if (!canonicalCheck) continue;
    if (categoriesToCross.has(category)) checksToCrossCanonical.add(canonicalCheck);
  }

  console.log(
    `Profile: ${profileInfo.profile} | checks=${checkActualByCanonical.size} strikes=${strikeActualByCanonical.size} strikeLike=${strikeLikeNames.size} preHidden=${preHiddenCount}`,
  );
  console.log(`Categories to cross: [${[...categoriesToCross].join(", ")}]`);
  console.log(`Checks to cross: [${[...checksToCrossCanonical].join(", ")}]`);

  const shouldUseWidgetStrikes = profileInfo.capabilities.supportsFullCheckStrikePairing && !profileInfo.capabilities.reducedCrossoutRendering;
  const checksNeedingOverlay = new Set<string>();
  let crossedCount = 0;

  for (const [canonicalCheckName, actualCheckName] of checkActualByCanonical.entries()) {
    const shouldCross = checksToCrossCanonical.has(canonicalCheckName);
    const toggled = setSelectableChecked(form, actualCheckName, shouldCross);
    if (!toggled) {
      console.log(`Selectable toggle failed for ${actualCheckName}`);
    } else if (shouldCross) {
      crossedCount++;
    }

    if (!shouldCross) continue;

    const strikeCanonical = canonicalCheckName.replace("Check", "Strike");
    const strikeActual = strikeActualByCanonical.get(strikeCanonical);

    if (shouldUseWidgetStrikes && strikeActual) {
      try {
        const strikeField = form.getField(strikeActual);
        const widgets = strikeField.acroField.getWidgets();
        for (const widget of widgets) {
          const fObj = widget.dict.get(PDFName.of("F"));
          const flags = fObj instanceof PDFNumber ? fObj.asNumber() : 0;
          widget.dict.set(PDFName.of("F"), PDFNumber.of((flags & ~1 & ~2 & ~32) | 4));
        }
      } catch (error) {
        console.log(`Strike show failed for ${strikeActual}: ${error}`);
        checksNeedingOverlay.add(actualCheckName);
      }
    } else {
      checksNeedingOverlay.add(actualCheckName);
    }
  }

  const missingCanonicalChecks = Array.from(checksToCrossCanonical)
    .filter((canonical) => !checkActualByCanonical.has(canonical));

  if (checksNeedingOverlay.size > 0 || missingCanonicalChecks.length > 0) {
    const overlayWidgets: OverlayWidget[] = [];
    const geometryOverlayWidgets: GeometryOverlayWidget[] = [];
    let geometryShift: GeometryShift | null = null;

    for (const checkFieldName of checksNeedingOverlay) {
      const widgets = getSelectableWidgets(form, checkFieldName);
      if (widgets.length === 0) {
        console.log(`Overlay locate failed for ${checkFieldName}: no selectable widgets`);
        continue;
      }
      for (const widget of widgets) {
        try {
          const rect = widget.getRectangle();
          const pageIdx = resolveWidgetPageIndex(widget, pages);
          overlayWidgets.push({ pageIdx, x: rect.x, y: rect.y, w: rect.width, h: rect.height });
        } catch (error) {
          console.log(`Overlay locate failed for ${checkFieldName}: ${error}`);
        }
      }
    }

    // For reduced templates, derive geometry checks from ALL categories to cross
    // (not just discovered checks, which may be empty on templates with few checkboxes).
    const geometryCheckCanonicalNames = profileInfo.capabilities.reducedCrossoutRendering
      ? Object.entries(FRANCE_CHECK_CATEGORIES)
          .filter(([_, category]) => categoriesToCross.has(category))
          .map(([checkName]) => checkName)
      : missingCanonicalChecks;

    if (geometryCheckCanonicalNames.length > 0) {
      geometryShift = computeFranceGeometryShift(form, pages, checkActualByCanonical);
      if (isPolandTemplate && !geometryShift) {
        // Poland AHC16 template family aligns with France geometry at page -1.
        geometryShift = { pageDelta: -1, dx: 0, dy: 0, anchors: 0 };
      }
      if (geometryShift && geometryShift.anchors < 3) {
        // Single-anchor templates (e.g. only Check1 present) are unreliable for XY shift.
        // Keep page alignment, but preserve canonical France coordinates.
        geometryShift = { ...geometryShift, dx: 0, dy: 0 };
        console.log(
          `France geometry alignment using page-only shift: pageDelta=${geometryShift.pageDelta}, anchors=${geometryShift.anchors}`,
        );
      } else if (geometryShift) {
        console.log(
          `France geometry alignment shift: pageDelta=${geometryShift.pageDelta}, dx=${geometryShift.dx.toFixed(2)}, dy=${geometryShift.dy.toFixed(2)}, anchors=${geometryShift.anchors}`,
        );
      } else {
        console.log("France geometry alignment shift unavailable: no check anchors discovered in template");
      }
      const franceGeometryWidgets = buildFranceGeometryOverlayWidgets(
        geometryCheckCanonicalNames,
        pages.length,
        geometryShift,
      );
      geometryOverlayWidgets.push(...franceGeometryWidgets);
      overlayWidgets.push(...franceGeometryWidgets);
      if (franceGeometryWidgets.length > 0) {
        console.log(
          `France geometry fallback overlay used for ${geometryCheckCanonicalNames.length} checks (${franceGeometryWidgets.length} segments)`,
        );
      }
    }

    if (overlayWidgets.length === 0) {
      console.log("No overlay widgets available after fallback resolution");
      return crossedCount;
    }

    const reducedStyle = profileInfo.capabilities.reducedCrossoutRendering;
    if (reducedStyle) {
      const drawHorizontalOverlayRows = (widgets: OverlayWidget[], thickness: number, logLabel: string) => {
        let rendered = 0;
        for (const item of widgets) {
          if (item.pageIdx < 0 || item.pageIdx >= pages.length) continue;
          const page = pages[item.pageIdx];
          const pageWidth = page.getSize().width;
          const lineY = item.y + (item.h / 2);
          const desiredEndX = item.w > 2 ? (item.x + item.w) : (item.x + 420);
          const lineEndX = Math.min(desiredEndX, pageWidth - 24);
          if (lineEndX <= item.x + 2) continue;
          page.drawLine({
            start: { x: item.x, y: lineY },
            end: { x: lineEndX, y: lineY },
            thickness,
            color: rgb(0, 0, 0),
          });
          rendered++;
        }
        if (rendered > 0) console.log(`${logLabel} using ${rendered} segments`);
      };

      if (geometryOverlayWidgets.length > 0) {
        // Reduced templates (e.g. AHC16 family):
        // keep rows thin, dedupe overlapping baselines, and constrain each check
        // to its own paragraph band on the same page.
        const anchorsByCheck = buildFranceGeometryAnchors(
          geometryCheckCanonicalNames,
          pages.length,
          geometryShift,
          form,
          pages,
          checkActualByCanonical,
        );

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

        let renderedSegments = 0;
        for (const [canonicalCheck, segments] of segmentsByCheck.entries()) {
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
              // Keep same-page geometry if no rows survived bounds filtering.
              filtered = segments.filter((seg) => seg.pageIdx === anchorPage);
            }
          }

          filtered.sort((a, b) => {
            if (a.pageIdx !== b.pageIdx) return a.pageIdx - b.pageIdx;
            return (b.y + (b.h / 2)) - (a.y + (a.h / 2));
          });

          const mergedRows: OverlayWidget[] = [];
          const tolerance = 0.35;
          for (const seg of filtered) {
            const segY = seg.y + (seg.h / 2);
            const segEndX = seg.x + seg.w;
            const existing = mergedRows.find((row) =>
              row.pageIdx === seg.pageIdx &&
              Math.abs((row.y + (row.h / 2)) - segY) <= tolerance
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

          for (const item of mergedRows) {
            if (item.pageIdx < 0 || item.pageIdx >= pages.length) continue;
            const page = pages[item.pageIdx];
            const pageWidth = page.getSize().width;
            const lineY = item.y + (item.h / 2);
            const lineEndX = Math.min(item.x + item.w, pageWidth - 24);
            if (lineEndX <= item.x + 2) continue;
            page.drawLine({
              start: { x: item.x, y: lineY },
              end: { x: lineEndX, y: lineY },
              thickness: 0.45,
              color: rgb(0, 0, 0),
            });
            renderedSegments++;
          }
        }
        if (renderedSegments > 0) {
          console.log(`Rendered reduced geometry overlay cross-outs using ${renderedSegments} segments`);
        }
      } else {
        drawHorizontalOverlayRows(overlayWidgets, 0.45, "Rendered reduced adaptive overlay cross-outs");
      }
    } else {
      // Partial-strike templates: draw per-row fallback where pairing is missing.
      for (const item of overlayWidgets) {
        if (item.pageIdx < 0 || item.pageIdx >= pages.length) continue;
        const page = pages[item.pageIdx];
        const pageWidth = page.getSize().width;
        const lineY = item.y + (item.h / 2);
        page.drawLine({
          start: { x: item.x, y: lineY },
          end: { x: Math.min(item.x + 420, pageWidth - 24), y: lineY },
          thickness: 0.8,
          color: rgb(0, 0, 0),
        });
      }
      console.log(`Rendered fallback overlay cross-outs using ${overlayWidgets.length} segments`);
    }
  }

  console.log(`Applied ${crossedCount} cross-outs across ${checkActualByCanonical.size} discovered checks`);
  return crossedCount;
}
const OV_STAMP_GUIDE_CONFIG = {
  enabled: true,
  pageGuideEnabled: true,
  crossoutGuidesEnabled: true,
  excludeOwnerDeclarationDeletionGuides: true,
  diameterPt: 96,
  strokeWidth: 1.5,
  opacity: 0.30,
};

const OWNER_DECL_CATEGORIES = new Set<FranceCrossoutCategory>([
  "declaration_owner", "declaration_owner_alt",
  "declaration_authorised_person", "declaration_authorised_person_alt",
  "declaration_carrier",
]);

function renderStampGuides(
  pdfDoc: any,
  form: any,
  categoriesToCross: Set<FranceCrossoutCategory>,
  checkCategories: Record<string, FranceCrossoutCategory>,
) {
  const cfg = OV_STAMP_GUIDE_CONFIG;
  const pages = pdfDoc.getPages();
  const diam = cfg.diameterPt;
  const r = diam / 2;
  let guideCount = 0;

  function drawCircle(page: any, cx: number, cy: number) {
    page.drawEllipse({
      x: cx, y: cy, xScale: r, yScale: r,
      borderColor: rgb(0.65, 0.65, 0.65),
      borderWidth: cfg.strokeWidth,
      borderOpacity: cfg.opacity,
    });
  }

  // Page guides
  if (cfg.pageGuideEnabled) {
    for (const page of pages) {
      const { width } = page.getSize();
      drawCircle(page, width - r - 20, r + 30);
      guideCount++;
    }
  }

  // Cross-out guides
  if (cfg.crossoutGuidesEnabled) {
    const checkActualByCanonical = discoverCanonicalCheckFields(form, form.getFields(), pages);

    const ovRelevantChecks = new Set<string>();
    for (const [checkName, category] of Object.entries(checkCategories)) {
      if (categoriesToCross.has(category)) {
        if (cfg.excludeOwnerDeclarationDeletionGuides && OWNER_DECL_CATEGORIES.has(category)) continue;
        const normalized = normalizeCheckLikeName(checkName);
        if (!normalized) continue;
        const actualCheck = checkActualByCanonical.get(normalized);
        if (actualCheck) ovRelevantChecks.add(actualCheck);
      }
    }

    const checkPositions: { pageIdx: number; x: number; y: number }[] = [];
    for (const checkName of ovRelevantChecks) {
      const widgets = getSelectableWidgets(form, checkName);
      if (widgets.length === 0) continue;
      try {
        const rect = widgets[0].getRectangle();
        const pageRef = widgets[0].P();
        let pageIdx = 0;
        if (pageRef) {
          for (let pi = 0; pi < pages.length; pi++) {
            if (pages[pi].ref === pageRef) { pageIdx = pi; break; }
          }
        }
        checkPositions.push({ pageIdx, x: rect.x, y: rect.y });
      } catch {}
    }

    // Cluster within 60pt Y on same page
    const clusters: { pageIdx: number; x: number; y: number }[] = [];
    const sorted = checkPositions.sort((a, b) => a.pageIdx - b.pageIdx || b.y - a.y);
    for (const pos of sorted) {
      const existing = clusters.find(c => c.pageIdx === pos.pageIdx && Math.abs(c.y - pos.y) < 60);
      if (existing) {
        existing.y = (existing.y + pos.y) / 2;
      } else {
        clusters.push({ ...pos });
      }
    }

    for (const cluster of clusters) {
      const page = pages[cluster.pageIdx];
      const { width } = page.getSize();
      const cx = Math.min(cluster.x + 440 + r, width - r - 10);
      drawCircle(page, cx, cluster.y + 6);
      guideCount++;
    }
  }

  console.log(`Drew ${guideCount} OV stamp guide circles on filled PDF`);
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  MODULE 8: DATA NORMALIZER                                         ║
// ║  Builds the canonical data map from submission + issuer data.      ║
// ╚══════════════════════════════════════════════════════════════════════╝

function fmtDate(val: string | undefined | null): string {
  if (!val) return "";
  const s = String(val).trim();
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const [, y, m, d] = iso;
    if (+m < 1 || +m > 12 || +d < 1 || +d > 31) return s;
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
  }
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy) {
    const [, d, m, y] = dmy;
    if (+m < 1 || +m > 12 || +d < 1 || +d > 31) return s;
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
  }
  return s;
}

function buildNormalizedData(submission: any, practice: any, vet: any, firstCountry: string): Record<string, string> {
  const d = submission.data_json || {};
  const ownerFullName = `${d.owner?.firstName || ""} ${d.owner?.lastName || ""}`.trim();
  const ownerAddress = [d.owner?.houseNameNumber, d.owner?.street, d.owner?.townCity, d.owner?.postalCode, d.owner?.country].filter(Boolean).join(", ");
  const practiceAddress = practice
    ? [practice.address_line_1, practice.address_line_2, practice.city, practice.postcode, practice.country].filter(Boolean).join(", ")
    : "";
  const issueDate = submission.issue_datetime ? fmtDate(submission.issue_datetime) : "";
  const certRef = submission.certificate_number || "";

  // Transport
  const rawTransportBy = d.transport?.transportedBy || d.petTransport?.transportedBy || "owner";
  const authorisedValues = ["authorised", "authorised_person", "authorisedPerson"];
  const transportBy = authorisedValues.includes(rawTransportBy) ? "authorised_person" : rawTransportBy;

  // Destination
  const destinationCountry = d.travel?.finalCountry || d.travel?.firstCountry || firstCountry || "";
  const destinationPhone = d.owner?.phone || "";

  // Pet helpers
  const petData = d.pet ? [d.pet] : (Array.isArray(d.pets) ? d.pets : []);
  const primarySpecies = (petData[0]?.species || "").toLowerCase();
  const speciesScientific = (s: string) => {
    const sl = s.toLowerCase();
    if (sl === "dog") return "CANIS LUPUS FAMILIARIS";
    if (sl === "cat") return "FELIS SILVESTRIS CATUS";
    if (sl === "ferret") return "MUSTELA PUTORIUS FURO";
    return s.toUpperCase();
  };
  const sexLetter = (s: string) => {
    const sl = (s || "").toLowerCase();
    if (sl === "male" || sl === "m") return "M";
    if (sl === "female" || sl === "f") return "F";
    return s;
  };
  const goodsDesc = primarySpecies === "dog" ? "PET DOG" : primarySpecies === "cat" ? "PET CAT" : primarySpecies === "ferret" ? "PET FERRET" : "PET";
  const numPetsVal = petData.length || 1;

  const normalized: Record<string, string> = {
    "owner.fullName": ownerFullName,
    "owner.address": ownerAddress,
    "owner.phone": d.owner?.phone || "",
    "owner.telephone": d.owner?.phone || "",
    "destination.fullName": ownerFullName,
    "destination.name": ownerFullName,
    "destination.address": destinationCountry,
    "destination.telephone": destinationPhone,
    "destination.tel": destinationPhone,
    "destination.postcode": "",
    "consignee.name": ownerFullName,
    "consignee.address": destinationCountry,
    "consignee.tel": destinationPhone,
    "consignee.postcode": "",
    "ov.name": vet?.full_name || "",
    "ov.address": practiceAddress,
    "ov.qualification": vet?.role_title || "",
    "ov.telephone": practice?.phone || vet?.phone || "",
    "certificate.issueDate": issueDate,
    "certificate.issue_date": issueDate,
    "certificate.reference": certRef,
    "certificate.number": certRef,
    "animalHealthCertificate.number": certRef,
    "ahc.number": certRef,
    "ahcNumber": certRef,
    "declaration.placeDate": [submission.issue_place, issueDate].filter(Boolean).join(", "),
    "transport.transporter": (() => {
      if (transportBy === "owner") return ownerFullName;
      if (transportBy === "authorised_person") {
        const ap = d.authorisedPerson || {};
        return `${ap.firstName || ""} ${ap.lastName || ""}`.trim() || ownerFullName;
      }
      if (transportBy === "carrier") return d.transport?.carrierName || "";
      return ownerFullName;
    })(),
    "transport.meansOfTransport": (() => {
      const raw = d.travel?.meansOfTravel || "";
      if (raw === "car_ferry") return "Car / Ferry";
      if (raw === "car") return "Car";
      if (raw === "ferry") return "Ferry";
      if (raw === "air") return "Air";
      return raw;
    })(),
    "goods.description": goodsDesc,
    "goods.quantity": String(numPetsVal),
    "localCompetentAuthority": "",
    "issuer.name": vet?.full_name || "",
    "issuer.issueDate": issueDate,
    "issuer.certificateNumber": certRef,
  };

  // Per-pet data
  for (let i = 0; i < 5; i++) {
    const p = petData[i] || {};
    const r = i === 0 ? (d.rabies || p.rabies || {}) : (p.rabies || {});
    const tw = p.tapeworm || {};
    const prefix = `pets[${i}]`;
    const hasPet = !!(p.microchipNumber || p.microchip || p.name || p.species);
    const vaccineName = r.vaccineName || r.vaccine || "";
    const manufacturer = r.manufacturer || "";
    const vaccineCombo = [vaccineName, manufacturer].filter(Boolean).join(" / ");
    const breed = p.breed === "Other" ? (p.breedOther || "") : (p.breed || "");
    const sciSpecies = speciesScientific(p.species || primarySpecies);
    const sLetter = sexLetter(p.sex || "");
    const microchip = p.microchipNumber || p.microchip || "";

    normalized[`${prefix}.species`] = p.species || "";
    normalized[`${prefix}.species_scientific`] = sciSpecies;
    normalized[`${prefix}.sex_letter`] = sLetter;
    normalized[`${prefix}.breed`] = breed;
    normalized[`${prefix}.name`] = p.name || "";
    normalized[`${prefix}.dob`] = fmtDate(p.dateOfBirth);
    normalized[`${prefix}.sex`] = p.sex || "";
    normalized[`${prefix}.colour`] = p.colour || "";
    normalized[`${prefix}.microchip`] = microchip;
    normalized[`${prefix}.microchipNumber`] = microchip;
    normalized[`${prefix}.microchipDate`] = fmtDate(p.microchipDate);
    normalized[`${prefix}.identification_line`] = [sciSpecies, sLetter, (p.colour || "").toUpperCase(), breed.toUpperCase(), microchip, "TRANSPONDER", fmtDate(p.dateOfBirth)].filter(Boolean).join("  ");
    normalized[`${prefix}.rabies.date`] = fmtDate(r.vaccinationDate || r.date);
    normalized[`${prefix}.rabies.vaccine`] = vaccineCombo;
    normalized[`${prefix}.rabies.vaccineName`] = vaccineCombo;
    normalized[`${prefix}.rabies.manufacturer`] = "";
    normalized[`${prefix}.rabies.batch`] = r.batchNumber || r.batch || "";
    normalized[`${prefix}.rabies.batchNumber`] = r.batchNumber || r.batch || "";
    normalized[`${prefix}.rabies.validFrom`] = fmtDate(r.validFrom);
    normalized[`${prefix}.rabies.validTo`] = fmtDate(r.validTo || r.validUntil);
    normalized[`${prefix}.rabies.validUntil`] = fmtDate(r.validTo || r.validUntil);
    normalized[`${prefix}.rabies.bloodSamplingDate`] = fmtDate(r.titerTestDate || r.bloodSamplingDate || "");
    const hasTapewormData = tw.product || tw.dateTime || tw.date;
    normalized[`${prefix}.tapeworm.transponder`] = hasTapewormData ? microchip : "";
    normalized[`${prefix}.tapeworm.product`] = hasTapewormData ? (tw.product || "") : "";
    normalized[`${prefix}.tapeworm.dateTime`] = hasTapewormData ? fmtDate(tw.dateTime || tw.date) : "";
    normalized[`${prefix}.tapeworm.adminVet`] = hasTapewormData ? (tw.vetStamp || tw.adminVet || "") : "";
    normalized[`${prefix}.tapeworm.vetStamp`] = hasTapewormData ? (tw.vetStamp || "") : "";

    if (hasPet && microchip) {
      normalized[`declaration.rows[${i}].transponder`] = microchip;
      normalized[`declaration.rows[${i}].ahcNumber`] = certRef;
      normalized[`declaration.rows[${i}].animalHealthCertificateNumber`] = certRef;
      normalized[`pets[${i}].ahcNumber`] = certRef;
      normalized[`pets[${i}].animalHealthCertificateNumber`] = certRef;
    } else {
      normalized[`declaration.rows[${i}].transponder`] = "";
      normalized[`declaration.rows[${i}].ahcNumber`] = "";
      normalized[`declaration.rows[${i}].animalHealthCertificateNumber`] = "";
      normalized[`pets[${i}].ahcNumber`] = "";
      normalized[`pets[${i}].animalHealthCertificateNumber`] = "";
    }
  }

  return normalized;
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  MODULE 9: FIELD FILLER                                            ║
// ║  Fills PDF form fields using mapping + normalized data.            ║
// ╚══════════════════════════════════════════════════════════════════════╝

function fillFields(
  form: any,
  font: any,
  fieldNames: Set<string>,
  mapping: Record<string, string | null>,
  normalized: Record<string, string>,
): { filled: number; missing: number } {
  const skipFields = ["owner.signature", "owner.signatureDate", "declaration.signature", "declaration.date"];

  // Keys that need smaller font
  const smallFontKeys = new Set<string>();
  for (let i = 0; i < 5; i++) {
    for (const suffix of ["rabies.date", "rabies.vaccine", "rabies.manufacturer", "rabies.batch", "rabies.batchNumber", "rabies.validFrom", "rabies.validTo", "rabies.bloodSamplingDate", "microchip", "microchipDate", "tapeworm.transponder", "tapeworm.product", "tapeworm.dateTime", "tapeworm.adminVet", "tapeworm.vetStamp"]) {
      smallFontKeys.add(`pets[${i}].${suffix}`);
    }
    smallFontKeys.add(`pets[${i}].identification_line`);
    smallFontKeys.add(`declaration.rows[${i}].transponder`);
    smallFontKeys.add(`declaration.rows[${i}].ahcNumber`);
  }

  let filled = 0;
  let missing = 0;

  for (const [canonicalKey, fieldName] of Object.entries(mapping)) {
    if (!fieldName) { missing++; continue; }
    if (skipFields.includes(canonicalKey)) continue;
    if (canonicalKey === "crossout_categories") continue;

    const value = normalized[canonicalKey] ?? "";
    try {
      const tf = form.getTextField(fieldName);
      tf.setText(value);
      tf.setFontSize(smallFontKeys.has(canonicalKey) ? 7 : 9);
      if (value) filled++; else missing++;
    } catch {
      missing++;
    }
  }

  return { filled, missing };
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  MODULE 10: AUTO-FIT + POST-PROCESSING                            ║
// ╚══════════════════════════════════════════════════════════════════════╝

function postProcessFields(
  form: any,
  font: any,
  fieldNames: Set<string>,
  mapping: Record<string, string | null>,
  normalized: Record<string, string>,
  petData: any[],
) {
  const actualPetCount = petData.filter((p: any) => !!(p.microchipNumber || p.microchip || p.name)).length;

  type FitOptions = {
    minFont?: number;
    maxFont?: number;
    widthPadding?: number;
    heightPadding?: number;
    respectMaxLen?: boolean;
  };

  function getFieldMaxLen(tf: any): number | null {
    try {
      const maxObj = tf.acroField.dict.get(PDFName.of("MaxLen"));
      return maxObj instanceof PDFNumber ? maxObj.asNumber() : null;
    } catch {
      return null;
    }
  }

  // Helper: auto-shrink text while respecting existing field constraints.
  function setTextFit(fieldName: string, value: string, options: FitOptions = {}) {
    if (!value || !fieldNames.has(fieldName)) return;
    try {
      const tf = form.getTextField(fieldName);
      const maxLen = options.respectMaxLen ? getFieldMaxLen(tf) : null;
      const finalValue = (maxLen && value.length > maxLen) ? value.slice(0, maxLen) : value;
      const widgets = tf.acroField.getWidgets();
      let minRectWidth = 200;
      let minRectHeight = 12;
      if (widgets.length > 0) {
        const widths = widgets.map((w: any) => w.getRectangle().width).filter((v: number) => v > 0);
        const heights = widgets.map((w: any) => w.getRectangle().height).filter((v: number) => v > 0);
        if (widths.length > 0) minRectWidth = Math.min(...widths);
        if (heights.length > 0) minRectHeight = Math.min(...heights);
      }
      const minFont = options.minFont ?? 6;
      const maxFont = options.maxFont ?? 9;
      const widthPadding = options.widthPadding ?? 2;
      const heightPadding = options.heightPadding ?? 2;
      let fontSize = Math.min(maxFont, Math.max(minFont, minRectHeight - heightPadding));
      while (fontSize > minFont && font.widthOfTextAtSize(finalValue, fontSize) > (minRectWidth - widthPadding)) {
        fontSize -= 0.5;
      }
      tf.setText(String(finalValue).trim());
      tf.setFontSize(fontSize);
    } catch (e) { console.log(`setTextFit failed for ${fieldName}: ${e}`); }
  }

  // Certificate reference auto-fit using resolved canonical mapping first.
  const certRef = normalized["certificate.reference"] || "";
  const certRefField = mapping["certificate.reference"];
  if (certRef && certRefField) {
    setTextFit(certRefField, certRef, {
      minFont: 6,
      maxFont: 8,
      widthPadding: 8,
      heightPadding: 4,
      respectMaxLen: true,
    });
  } else if (certRef) {
    // Backward-compatible fallback in case mapping could not resolve.
    for (const fn of ["Certificate reference No", "Certificate Reference No", "Certificate reference NO", "II.a. Certificate reference No", "II.a. Certificate Reference No", "Text1"]) {
      if (fieldNames.has(fn)) {
        setTextFit(fn, certRef, {
          minFont: 6,
          maxFont: 8,
          widthPadding: 8,
          heightPadding: 4,
          respectMaxLen: true,
        });
      }
    }
  }

  // Declaration table auto-fit + clear unused rows using canonical mapping.
  for (let rowIdx = 0; rowIdx < 5; rowIdx++) {
    const transponderField = mapping[`declaration.rows[${rowIdx}].transponder`];
    const ahcField = mapping[`declaration.rows[${rowIdx}].ahcNumber`];
    const transpVal = rowIdx < actualPetCount ? (normalized[`declaration.rows[${rowIdx}].transponder`] || "") : "";
    const ahcVal = rowIdx < actualPetCount ? (normalized[`declaration.rows[${rowIdx}].ahcNumber`] || "") : "";

    if (transponderField) {
      if (transpVal) setTextFit(transponderField, transpVal, { respectMaxLen: true });
      else { try { form.getTextField(transponderField).setText(""); } catch {} }
    }

    if (ahcField) {
      if (ahcVal) setTextFit(ahcField, ahcVal, {
        minFont: 6,
        maxFont: 7.5,
        widthPadding: 6,
        heightPadding: 3,
        respectMaxLen: true,
      });
      else { try { form.getTextField(ahcField).setText(""); } catch {} }
    }
  }

  // Force-clear declaration AHC number fields for empty pet rows
  const allFields = form.getFields();
  const declAhcFieldPatterns = ["AHC number", "Animal health certificate number"];
  for (const field of allFields) {
    const fname = field.getName();
    for (const pattern of declAhcFieldPatterns) {
      if (fname === pattern || fname.startsWith(pattern)) {
        const suffix = fname.replace(pattern, "");
        const rowIdx = suffix === "" ? 0 : parseInt(suffix, 10);
        if (!isNaN(rowIdx) && rowIdx >= actualPetCount) {
          try { form.getTextField(fname).setText(""); } catch {}
        }
      }
    }
  }
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  MAIN HANDLER: ORCHESTRATOR                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // ── Verify caller is authenticated ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callerUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !callerUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const submissionId = body.submission_id || body.submissionId;
    const showOvGuides = body.show_ov_guides !== false;
    const strictComplianceEnabled = (Deno.env.get("AHC_STRICT_TEMPLATE_COMPLIANCE") || "false").toLowerCase() === "true";
    const strictTemplateCompliance = strictComplianceEnabled && body.strict_template_compliance !== false;

    if (!submissionId || typeof submissionId !== "string") {
      return new Response(JSON.stringify({ error: "Missing or invalid submission_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("generate-ahc called by:", callerUser.email, "submission_id:", submissionId);

    // ── Fetch submission ──
    const { data: submission, error: subError } = await supabase
      .from("submissions").select("*").eq("id", submissionId).single();
    if (subError || !submission) {
      console.error("Submission lookup failed:", subError);
      return new Response(JSON.stringify({ error: "Submission not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Determine first country of entry ──
    const firstCountry = submission.first_country_of_entry ||
      submission.data_json?.travel?.firstCountry || "";
    if (!firstCountry) {
      return new Response(JSON.stringify({ error: "No first country of entry set" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("First country:", firstCountry);

    // ── Resolve template ──
    const selectedTemplateId = submission.selected_template_id || null;
    let template: any = null;
    let storageBucket = "generated-pdfs";
    let storagePath = "";

    if (selectedTemplateId) {
      const { data, error } = await supabase.from("ahc_templates")
        .select("*, ahc_template_mappings(*)").eq("id", selectedTemplateId).single();
      if (!error && data) {
        template = data;
        storageBucket = data.storage_bucket || "generated-pdfs";
        storagePath = data.storage_path;
      }
      console.log("Using manually selected template:", template?.template_code);
    }

    if (!template) {
      const { data: docTemplates } = await supabase.from("document_templates")
        .select("*").eq("active", true);
      const countryLower = firstCountry.toLowerCase().trim();
      if (docTemplates?.length) {
        const matchDoc = (list: any[]) =>
          list.find(t => t.first_country_of_entry.toLowerCase() === countryLower)
          || list.find(t => t.first_country_of_entry.toLowerCase().startsWith(countryLower))
          || list.find(t => countryLower.startsWith(t.first_country_of_entry.toLowerCase()))
          || list.find(t => t.first_country_of_entry.toLowerCase().includes(countryLower) || countryLower.includes(t.first_country_of_entry.toLowerCase()));
        const matched = matchDoc(docTemplates);
        if (matched) {
          storagePath = matched.storage_path || "";
          storageBucket = matched.storage_bucket || "generated-pdfs";
          if (!storagePath && matched.template_pdf_url) {
            try {
              const urlPath = decodeURIComponent(new URL(matched.template_pdf_url).pathname);
              const filename = urlPath.split("/").pop() || "";
              storagePath = `templates/${filename.replace(".pdf", "-fillable.pdf")}`;
            } catch {}
          }
          template = { ...matched, storage_path: storagePath, storage_bucket: storageBucket };
          console.log("Matched from document_templates:", matched.name, "storage:", storagePath);
        }
      }

      if (!template) {
        const { data: allTemplates } = await supabase.from("ahc_templates")
          .select("*, ahc_template_mappings(*)").eq("is_active", true);
        if (!allTemplates?.length) {
          return new Response(JSON.stringify({ error: "No templates available" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        template = allTemplates.find(t => t.first_country_entry.toLowerCase() === countryLower)
          || allTemplates.find(t => t.first_country_entry.toLowerCase().startsWith(countryLower))
          || allTemplates.find(t => countryLower.startsWith(t.first_country_entry.toLowerCase()))
          || allTemplates.find(t => t.first_country_entry.toLowerCase().includes(countryLower) || countryLower.includes(t.first_country_entry.toLowerCase()));
        if (!template) {
          const available = allTemplates.map(t => t.first_country_entry).join(", ");
          return new Response(JSON.stringify({ error: `No template for: ${firstCountry}. Available: ${available}` }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        storageBucket = template.storage_bucket || "generated-pdfs";
        storagePath = template.storage_path;
        console.log("Fallback ahc_templates:", template.template_code);
      }
    }

    console.log("Template:", template.name || template.template_code, "storage:", storagePath);

    // ── Download template PDF ──
    const { data: fileData, error: dlError } = await supabase.storage
      .from(storageBucket).download(storagePath);
    if (dlError || !fileData) {
      console.error("Template download failed:", dlError);
      return new Response(JSON.stringify({ error: `Failed to download template: ${dlError?.message}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const templateBytes = await fileData.arrayBuffer();
    const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const form = pdfDoc.getForm();

    // ── STEP 1: Clear all fields ──
    const allFields = form.getFields();
    let clearedCount = 0;
    for (const field of allFields) {
      const name = field.getName();
      try { form.getTextField(name).setText(""); clearedCount++; continue; } catch {}
      try { form.getCheckBox(name).uncheck(); clearedCount++; continue; } catch {}
      try { form.getDropdown(name).clear(); clearedCount++; continue; } catch {}
      try { form.getOptionList(name).clear(); clearedCount++; continue; } catch {}
      try { form.getRadioGroup(name).clear(); clearedCount++; continue; } catch {}
    }
    console.log(`Cleared ${clearedCount}/${allFields.length} fields`);

    // ── STEP 2: Detect profile ──
    const allFieldNames = new Set(allFields.map(f => f.getName()));
    const profileHint = [
      template?.template_code,
      template?.name,
      template?.first_country_entry,
      template?.first_country_of_entry,
      template?.second_language_code,
      storagePath,
    ].filter(Boolean).join(" ");
    const profileInfo = detectProfile(allFieldNames, { templateHint: profileHint });
    console.log("Detected profile:", profileInfo.profile, `(${profileInfo.checkCount} checks, ${profileInfo.strikeCount} strikes)`);
    console.log("All PDF field names:", JSON.stringify([...allFieldNames].sort()));

    // ── STEP 3: Load issuer data ──
    let practice: any = null;
    let vet: any = null;
    if (submission.issuing_practice_id) {
      const { data } = await supabase.from("vet_practices").select("*").eq("id", submission.issuing_practice_id).single();
      practice = data;
    }
    if (submission.issuing_vet_id) {
      const { data } = await supabase.from("vets").select("*").eq("id", submission.issuing_vet_id).single();
      vet = data;
    }

    // ── STEP 4: Normalize data ──
    const normalized = buildNormalizedData(submission, practice, vet, firstCountry);
    console.log("Normalized data keys:", Object.keys(normalized).length);

    // ── STEP 5: Build field mapping via profile adapter ──
    // Load per-template overrides from DB if available
    const mappingData = template.ahc_template_mappings
      ? (Array.isArray(template.ahc_template_mappings)
          ? template.ahc_template_mappings?.[0]?.mapping_json
          : template.ahc_template_mappings?.mapping_json)
      : (template.mapping_schema_json || {});
    const dbOverrides = (typeof mappingData === "object" && mappingData !== null && (mappingData as any).field_overrides)
      ? (mappingData as any).field_overrides
      : undefined;

    const fieldMapping = buildFieldMapping(profileInfo, allFieldNames, dbOverrides);
    console.log("Field mapping entries:", Object.keys(fieldMapping).filter(k => fieldMapping[k]).length);
    const missingRequiredCanonicalKeys = validateCanonicalCoverage(fieldMapping, REQUIRED_CANONICAL_KEYS);
    if (strictTemplateCompliance && missingRequiredCanonicalKeys.length > 0) {
      return new Response(JSON.stringify({
        error: "Template compliance failed: required canonical fields are missing for this template",
        template_code: template?.template_code || template?.name || null,
        first_country_entry: template?.first_country_entry || template?.first_country_of_entry || null,
        missing_required_canonical_keys: missingRequiredCanonicalKeys,
      }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── STEP 6: Fill fields ──
    const { filled: filledCount, missing: missingCount } = fillFields(form, font, allFieldNames, fieldMapping, normalized);
    console.log(`Filled ${filledCount} fields, ${missingCount} missing/skipped`);

    // ── STEP 7: Post-process (auto-fit cert ref, declaration table) ──
    const d = submission.data_json || {};
    const petData = d.pet ? [d.pet] : (Array.isArray(d.pets) ? d.pets : []);
    postProcessFields(form, font, allFieldNames, fieldMapping, normalized, petData);

    // ── STEP 7b: Update field appearances BEFORE cross-outs ──
    // Must happen after text fields are filled/sized so overlay cross-outs and
    // strike visibility changes are applied against final field appearances.
    form.updateFieldAppearances(font);

    // ── STEP 8: Cross-out engine ──
    const rawTransportBy = d.transport?.transportedBy || d.petTransport?.transportedBy || "owner";
    const authorisedValues = ["authorised", "authorised_person", "authorisedPerson"];
    const transportBy = authorisedValues.includes(rawTransportBy) ? "authorised_person" : rawTransportBy;
    const petSpecies = (d.pet?.species || d.pets?.[0]?.species || "").toLowerCase();
    const firstCountryLower = (d.travel?.firstCountry || firstCountry || "").toLowerCase();
    const tapewormRequiredByClient = d.travel?.tapewormRequired === "yes" || d.travel?.tapewormRequired === true;
    const isTapewormCountry = tapewormRequiredByClient || ["northern ireland", "ireland", "republic of ireland", "finland", "malta", "norway"]
      .some(c => firstCountryLower.includes(c));

    const categoriesToCross = computeCategoriesToCross({
      transportBy,
      numPets: petData.length || 1,
      petSpecies,
      rabiesVaxDate: d.rabies?.vaccinationDate || d.pet?.rabies?.vaccinationDate || "",
      euEntryDate: d.travel?.dateOfEntry || d.travel?.entryDate || "",
      petDob: d.pet?.dateOfBirth || d.pets?.[0]?.dateOfBirth || "",
      isTapewormCountry,
    });

    // Resolve check->category map using France categories, with optional per-template overrides.
    const checkCategoryOverrides = (typeof mappingData === "object" && mappingData !== null && (mappingData as any).crossout_categories)
      ? (mappingData as any).crossout_categories as Record<string, string>
      : undefined;
    const checkCategories = buildCheckCategoryMapping(allFieldNames, checkCategoryOverrides);
    const discoveredChecks = discoverCanonicalCheckFields(form, allFields, pdfDoc.getPages());
    const { categories: effectiveCheckCategories, inferredCount } = buildEffectiveCheckCategories(
      discoveredChecks.keys(),
      checkCategories,
    );
    if (inferredCount > 0) {
      console.log(`Template check mapping completed with ${inferredCount} inferred France-category entries`);
    }
    const unresolvedCategories = unresolvedFranceCategories(effectiveCheckCategories);
    if (strictTemplateCompliance && unresolvedCategories.length > 0) {
      return new Response(JSON.stringify({
        error: "Template compliance failed: unable to resolve all France cross-out categories",
        template_code: template?.template_code || template?.name || null,
        first_country_entry: template?.first_country_entry || template?.first_country_of_entry || null,
        unresolved_france_categories: unresolvedCategories,
      }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    renderCrossouts({
      pdfDoc,
      form,
      allFields,
      profileInfo,
      categoriesToCross,
      checkCategories: effectiveCheckCategories,
      templateHint: profileHint,
    });

    // ── STEP 9: Stamp guides (LAST step, on top of filled PDF) ──
    if (OV_STAMP_GUIDE_CONFIG.enabled && showOvGuides) {
      console.log("Applying OV stamp guides on filled PDF...");
      renderStampGuides(pdfDoc, form, categoriesToCross, effectiveCheckCategories);
    } else {
      console.log("OV stamp guides disabled for this export");
    }

    // ── STEP 10: Save (editable, not flattened) ──
    await applyGeneratedPdfSecurity(pdfDoc);
    const pdfBytes = await pdfDoc.save();

    const fileName = `ahc-${submission.id}-${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from(GENERATED_PDF_BUCKET).upload(fileName, pdfBytes, { contentType: "application/pdf", upsert: true });
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    const { data: { publicUrl } } = supabase.storage.from(GENERATED_PDF_BUCKET).getPublicUrl(fileName);

    await supabase.from("submissions").update({
      status: "Generated",
      final_ahc_pdf_url: publicUrl,
      final_ahc_pdf_path: fileName,
    }).eq("id", submission.id);

    await supabase.from("audit_log").insert({
      submission_id: submission.id,
      action: "generated",
      details_json: {
        pdf_url: publicUrl,
        filled: filledCount,
        missing: missingCount,
        profile: profileInfo.profile,
        strict_template_compliance: strictTemplateCompliance,
        unresolved_france_categories: unresolvedCategories,
        missing_required_canonical_keys: missingRequiredCanonicalKeys,
        bucket: GENERATED_PDF_BUCKET,
        password_protected: Boolean(GENERATED_PDF_PASSWORD),
      },
    });

    return new Response(JSON.stringify({
      success: true,
      pdf_url: publicUrl,
      filled: filledCount,
      missing: missingCount,
      profile: profileInfo.profile,
      strict_template_compliance: strictTemplateCompliance,
      unresolved_france_categories: unresolvedCategories,
      missing_required_canonical_keys: missingRequiredCanonicalKeys,
      bucket: GENERATED_PDF_BUCKET,
      pdf_password: GENERATED_PDF_PASSWORD,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("generate-ahc error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});



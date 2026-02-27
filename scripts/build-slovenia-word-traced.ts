import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, PDFName, PDFNumber, PDFString, rgb } from "pdf-lib";

type Segment = {
  pageIdx: number;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  lineIndex: number;
};

type Layout = Record<string, Segment[]>;

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

function getSelectableWidgets(form: any, fieldName: string): any[] {
  try {
    return form.getCheckBox(fieldName).acroField.getWidgets() || [];
  } catch {
    return [];
  }
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
  for (const widget of widgets) widget.dict.set(PDFName.of("A"), action);
}

async function main() {
  const root = process.cwd();
  const layoutPath = path.resolve(root, "scripts", "slovenia-word-traced-layout-v4.json");
  const sourcePdfPath = path.resolve("C:/Users/bratn/Downloads/AHC/originals/AHC20-English-Slovenian-fillable.pdf");
  const outPdfPath = path.resolve("C:/Users/bratn/Downloads/AHC/slovenia-word-traced-v2.pdf");
  const checkBoxWidth = 9.3;
  const checkBoxHeight = 8.2;
  const checkLeftGap = 2.0;
  const strikeHeight = 0.45;
  const rowMergeTolerance = 1.3;

  const layout = JSON.parse(await fs.readFile(layoutPath, "utf8")) as Layout;
  const srcBytes = await fs.readFile(sourcePdfPath);
  const pdfDoc = await PDFDocument.load(srcBytes, { ignoreEncryption: true });
  const form = pdfDoc.getForm();
  const pages = pdfDoc.getPages();

  // Hide legacy reduced-template check widgets like `Check1`.
  for (const field of form.getFields()) {
    const name = field.getName();
    const canonical = normalizeCheckLikeName(name);
    if (!canonical) continue;
    if (name === canonical) continue;
    const widgets = getSelectableWidgets(form, name);
    setWidgetsVisible(widgets, false);
  }

  // Build traced check+strike controls for Slovenia paragraphs.
  for (let checkIdx = 1; checkIdx <= 20; checkIdx++) {
    const checkName = `Check ${checkIdx}`;
    const strikeName = `Strike${checkIdx}`;
    const rawSegments = layout[String(checkIdx)] || [];
    const segments = [...rawSegments]
      .sort((a, b) => a.pageIdx - b.pageIdx || a.y - b.y || a.x - b.x)
      .reduce<Segment[]>((acc, seg) => {
        const prev = acc[acc.length - 1];
        if (!prev) {
          acc.push({ ...seg });
          return acc;
        }
        // Merge near-duplicate rows only when they are on the same baseline
        // and horizontally touching/overlapping.
        const prevEnd = prev.x + prev.w;
        if (
          prev.pageIdx === seg.pageIdx
          && Math.abs(prev.y - seg.y) <= rowMergeTolerance
          && seg.x <= (prevEnd + 4)
        ) {
          const segEnd = seg.x + seg.w;
          prev.x = Math.min(prev.x, seg.x);
          prev.w = Math.max(prevEnd, segEnd) - prev.x;
          return acc;
        }
        acc.push({ ...seg });
        return acc;
      }, []);
    if (segments.length === 0) continue;
    const paragraphX = Math.min(...segments.map((s) => s.x));
    const minLineStart = checkIdx >= 16 ? 70 : 132;
    const lineStartX = Math.max(minLineStart, paragraphX);

    let checkField: any;
    try {
      checkField = form.getCheckBox(checkName);
    } catch {
      checkField = form.createCheckBox(checkName);
      const first = segments[0];
      const pageIdx = first.pageIdx;
      if (pageIdx >= 0 && pageIdx < pages.length) {
        const pageForBox = pages[pageIdx];
        const pageHeight = pageForBox.getSize().height;
        const centerYFromBottom = pageHeight - first.y;
        const boxX = Math.max(24, lineStartX - checkBoxWidth - checkLeftGap);
        const boxY = centerYFromBottom - checkBoxHeight / 2;
        checkField.addToPage(pageForBox, {
          x: boxX,
          y: boxY,
          width: checkBoxWidth,
          height: checkBoxHeight,
          borderColor: rgb(0.20, 0.24, 0.95),
          borderWidth: 1,
        });
      }
    }

    let strikeField: any;
    try {
      strikeField = form.getTextField(strikeName);
      // Recreate for deterministic traced rows
      // If field exists, leave it but hide all widgets; new rows are appended.
      setWidgetsVisible(strikeField.acroField.getWidgets() || [], false);
    } catch {
      strikeField = form.createTextField(strikeName);
      strikeField.setText("");
      strikeField.enableReadOnly();
    }

    for (const seg of segments) {
      if (seg.pageIdx < 0 || seg.pageIdx >= pages.length) continue;
      const page = pages[seg.pageIdx];
      const { width: pageWidth, height: pageHeight } = page.getSize();
      const lineEndX = Math.min(seg.x + seg.w, pageWidth - 24);
      if (lineEndX <= lineStartX + 2) continue;
      const centerYFromBottom = pageHeight - seg.y;
      strikeField.addToPage(page, {
        x: lineStartX,
        y: centerYFromBottom - (strikeHeight / 2),
        width: lineEndX - lineStartX,
        height: strikeHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0,
        backgroundColor: rgb(0, 0, 0),
        textColor: rgb(0, 0, 0),
      });
    }

    checkField.uncheck();
    const strikeWidgets = strikeField.acroField.getWidgets() || [];
    setWidgetsVisible(strikeWidgets, false);
    attachStrikeToggleAction(pdfDoc, checkField, strikeName);
  }

  const outBytes = await pdfDoc.save();
  await fs.writeFile(outPdfPath, outBytes);
  console.log(`Wrote ${outPdfPath}`);
}

await main();

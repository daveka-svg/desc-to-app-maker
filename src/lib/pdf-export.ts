/**
 * PDF Export for Client Instructions
 *
 * Uses the browser's built-in print API with a styled hidden iframe.
 * No external PDF library needed — generates a clean, branded PDF.
 */

import type { ClientInstructions } from '@/stores/useSessionStore';

interface PDFExportOptions {
  patientName: string;
  consultType: string;
  date: string;
  instructions: ClientInstructions;
}

export function exportClientInstructionsPDF(options: PDFExportOptions) {
  const { patientName, consultType, date, instructions } = options;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Discharge Instructions — ${patientName || 'Patient'}</title>
  <style>
    @page { margin: 20mm 18mm; size: A4; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #2C2A25;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #3C6E47;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .logo-text {
      font-size: 18pt;
      font-weight: 700;
      color: #3C6E47;
      letter-spacing: -0.5px;
    }
    .logo-text span { color: #2C2A25; }
    .header-right {
      text-align: right;
      font-size: 9pt;
      color: #8C8578;
    }
    .title {
      font-size: 16pt;
      font-weight: 700;
      color: #2C2A25;
      margin-bottom: 4px;
    }
    .subtitle {
      font-size: 9pt;
      color: #8C8578;
      margin-bottom: 16px;
    }
    .patient-bar {
      display: flex;
      gap: 24px;
      background: #F5F0E8;
      padding: 8px 14px;
      border-radius: 6px;
      margin-bottom: 20px;
      font-size: 10pt;
    }
    .patient-bar .label {
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #8C8578;
      margin-bottom: 1px;
    }
    .patient-bar .value { font-weight: 600; color: #2C2A25; }
    .section {
      margin-bottom: 16px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 11pt;
      font-weight: 700;
      color: #2C2A25;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .section-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      display: inline-block;
    }
    .dot-green { background: #3C6E47; }
    .dot-red { background: #C53030; }
    .dot-yellow { background: #D69E2E; }
    .section-content {
      font-size: 10.5pt;
      color: #4A4640;
      line-height: 1.7;
      padding-left: 12px;
    }
    .emergency-box {
      border: 1px solid #E2DDD5;
      border-radius: 6px;
      padding: 12px 14px;
      margin-top: 20px;
      background: #FEFCF8;
      font-size: 9.5pt;
      color: #4A4640;
    }
    .emergency-box strong { color: #2C2A25; }
    .footer {
      margin-top: 24px;
      padding-top: 10px;
      border-top: 1px solid #E2DDD5;
      text-align: center;
      font-size: 8pt;
      color: #B0A99F;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <div class="logo-text">Every<span>Tail</span>Vets</div>
    </div>
    <div class="header-right">
      Every Tail Vets<br>
      London, United Kingdom<br>
      hello@everytailvets.com
    </div>
  </div>

  <div class="title">Discharge Instructions</div>
  <div class="subtitle">Generated from ${consultType} consultation on ${date}</div>

  <div class="patient-bar">
    <div>
      <div class="label">Patient</div>
      <div class="value">${patientName || 'N/A'}</div>
    </div>
    <div>
      <div class="label">Date</div>
      <div class="value">${date}</div>
    </div>
    <div>
      <div class="label">Consultation</div>
      <div class="value">${consultType}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title"><span class="section-dot dot-green"></span> Things to do</div>
    <div class="section-content">${formatContent(instructions.thingsToDo)}</div>
  </div>

  <div class="section">
    <div class="section-title"><span class="section-dot dot-red"></span> Things to avoid</div>
    <div class="section-content">${formatContent(instructions.thingsToAvoid)}</div>
  </div>

  <div class="section">
    <div class="section-title"><span class="section-dot dot-green"></span> Medication</div>
    <div class="section-content">${formatContent(instructions.medication)}</div>
  </div>

  <div class="section">
    <div class="section-title"><span class="section-dot dot-yellow"></span> When to contact us immediately</div>
    <div class="section-content">${formatContent(instructions.whenToContact)}</div>
  </div>

  <div class="section">
    <div class="section-title">📅 Follow-up appointment</div>
    <div class="section-content">${formatContent(instructions.followUp)}</div>
  </div>

  <div class="emergency-box">
    In the event of an emergency outside of our regular operating hours, please contact
    <strong>Veteris Home Emergency Services</strong> at <strong>020 3808 0100</strong>.
    Veteris provides 24/7 mobile veterinary care across Greater London.
  </div>

  <div class="footer">
    Generated by ETV Scribe — Every Tail Vets AI Clinical Assistant<br>
    This document is for informational purposes and should be reviewed by a veterinary professional.
  </div>
</body>
</html>`;

  // Open print dialog with styled content
  const printWindow = window.open('', '_blank', 'width=800,height=1100');
  if (!printWindow) {
    // Fallback: use iframe
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }
    setTimeout(() => document.body.removeChild(iframe), 5000);
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  // Wait for content to load then trigger print
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };

  // Also trigger after a small delay as fallback
  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 500);
}

function formatContent(text: string): string {
  if (!text) return '';
  // Convert line breaks to <br>, escape HTML
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

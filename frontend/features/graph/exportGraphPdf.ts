'use client';

export async function exportGraphToPdf(element: HTMLElement | null, title: string) {
  if (!element || typeof window === 'undefined' || typeof document === 'undefined') return;

  // No 'noopener' here: with it window.open() returns null and nothing could be written.
  const printWindow = window.open('', '_blank', 'width=1400,height=900');
  if (!printWindow) return;
  printWindow.opener = null;

  const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((node) => node.outerHTML)
    .join('\n');

  const printStyles = `
    <style>
      @page { size: A4 landscape; margin: 10mm; }
      html, body { margin: 0; padding: 0; background: #fff; color: #111; }
      body { font-family: Arial, sans-serif; }
      .print-shell { padding: 12px; }
      .print-title { font-size: 18px; font-weight: 700; margin: 0 0 12px; }
      .react-flow__controls,
      .react-flow__minimap,
      button:not(.react-flow__node button),
      input,
      select { display: none !important; }
      .print-shell .react-flow,
      .print-shell .react-flow__renderer,
      .print-shell .react-flow__viewport {
        min-height: 780px !important;
      }
    </style>
  `;

  printWindow.document.open();
  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        ${stylesheets}
        ${printStyles}
      </head>
      <body>
        <div class="print-shell">
          <h1 class="print-title">${title}</h1>
          ${element.outerHTML}
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();

  await new Promise((resolve) => window.setTimeout(resolve, 500));
  printWindow.focus();
  printWindow.print();
}

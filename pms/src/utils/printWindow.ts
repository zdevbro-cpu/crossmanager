const escapeHtml = (value: string) => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export const openPrintWindow = (targetUrl: string, title?: string) => {
  if (!targetUrl) return false
  const printWindow = window.open('', '_blank')
  if (!printWindow) return false
  const safeTitle = escapeHtml(title || '문서 프린트 미리보기')
  const safeSrc = targetUrl.replace(/"/g, '&quot;')
  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${safeTitle}</title>
        <style>
          html, body {
            margin: 0;
            height: 100%;
            background: #fff;
          }
          iframe {
            width: 100%;
            height: 100%;
            border: none;
          }
        </style>
      </head>
      <body>
        <iframe id="pdfFrame" src="${safeSrc}" title="${safeTitle}"></iframe>
        <script>
          const frame = document.getElementById('pdfFrame');
          const doPrint = () => {
            try {
              frame.contentWindow?.focus();
              frame.contentWindow?.print();
            } catch (err) {
              console.error('Auto-print failed', err);
            }
          };
          frame.addEventListener('load', () => {
            setTimeout(doPrint, 500);
          });
          setTimeout(doPrint, 2000);
        </script>
      </body>
    </html>
  `

  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
  return true
}

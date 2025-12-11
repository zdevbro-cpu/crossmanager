// Utility to open a print window for a PDF/Document URL
// Mimics the behavior of Contracts.tsx
export const openPrintWindow = (targetUrl: string, title?: string) => {
  if (!targetUrl) return false

  const win = window.open('', '_blank')
  if (!win) return false

  const html = `
    <html>
      <head>
        <title>${title || 'Print'}</title>
      </head>
      <body style="margin:0; overflow:hidden;">
        <iframe 
            id="pdfFrame" 
            src="${targetUrl}" 
            frameborder="0" 
            style="border:0; width:100%; height:100%;" 
            allowfullscreen
        ></iframe>
        <script>
          const frame = document.getElementById('pdfFrame');
          
          const doClose = () => {
             // Close the main window (popup)
             setTimeout(() => {
                window.close(); 
             }, 100);
          };

          frame.onload = function() {
            setTimeout(function() {
              try {
                const win = frame.contentWindow;
                win.focus();
                
                // Strategy 1: Standard 'afterprint' event
                win.addEventListener('afterprint', doClose);

                // Strategy 2: Focus Monitoring (Reliable for popups)
                // When print dialog opens, window loses focus. When it closes, window regains focus.
                // We check on the MAIN window (popup window), not just iframe.
                let isPrinting = false;
                
                // We assume print() steals focus immediately. 
                // We wait a tiny bit to set flag, then listen for focus return.
                setTimeout(()=> { isPrinting = true; }, 500);

                window.addEventListener('focus', () => {
                    if (isPrinting) doClose();
                });
                
                // Also listen to mouse movement as a fallback interaction? No, focus is better.

                // Strategy 3: MatchMedia (Safari backup)
                if (win.matchMedia) {
                     const mediaQueryList = win.matchMedia('print');
                     mediaQueryList.addListener(function(mql) {
                         if (!mql.matches) {
                             doClose();
                         }
                     });
                }

                win.print();
              } catch(e) { console.error('Auto-print error:', e); }
            }, 500);
          };
        </script>
      </body>
    </html>
  `
  win.document.open()
  win.document.write(html)
  win.document.close()
  return true
}

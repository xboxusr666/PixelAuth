/**
 * PixelAuth - On-Page QR Scanner Overlay Content Script
 * Open-Source MFA Wallet by JTS Software (GPL-3.0)
 *
 * Provides an interactive marquee selection or single-click
 * element picker on any active webpage to capture and decode QR codes.
 */

(() => {
  // Prevent duplicate injection
  const existing = document.getElementById('pixelauth-scanner-overlay');
  if (existing) {
    existing.remove();
  }

  const overlay = document.createElement('div');
  overlay.id = 'pixelauth-scanner-overlay';

  const banner = document.createElement('div');
  banner.id = 'pixelauth-scanner-banner';
  banner.innerHTML = `
    <span>[PixelAuth] Drag around QR code or click on QR image</span>
    <button id="pixelauth-cancel-btn">Cancel (ESC)</button>
  `;

  const box = document.createElement('div');
  box.id = 'pixelauth-scanner-box';

  overlay.appendChild(banner);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  let isDragging = false;
  let startX = 0;
  let startY = 0;

  function cleanup() {
    window.removeEventListener('keydown', onKeyDown);
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      cleanup();
    }
  }
  window.addEventListener('keydown', onKeyDown);

  const cancelBtn = banner.querySelector('#pixelauth-cancel-btn');
  cancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    cleanup();
  });

  overlay.addEventListener('mousedown', (e) => {
    if (e.target === cancelBtn) return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    box.style.left = `${startX}px`;
    box.style.top = `${startY}px`;
    box.style.width = '0px';
    box.style.height = '0px';
    box.style.display = 'block';
  });

  overlay.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const currentX = e.clientX;
    const currentY = e.clientY;

    const x = Math.min(startX, currentX);
    const y = Math.min(startY, currentY);
    const w = Math.abs(currentX - startX);
    const h = Math.abs(currentY - startY);

    box.style.left = `${x}px`;
    box.style.top = `${y}px`;
    box.style.width = `${w}px`;
    box.style.height = `${h}px`;
  });

  overlay.addEventListener('mouseup', async (e) => {
    if (!isDragging) return;
    isDragging = false;

    const currentX = e.clientX;
    const currentY = e.clientY;
    const rectX = Math.min(startX, currentX);
    const rectY = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    // If user merely clicked (tiny delta), check for clicked element underneath
    if (width < 15 || height < 15) {
      overlay.style.display = 'none';
      const targetEl = document.elementFromPoint(startX, startY);
      overlay.style.display = 'block';

      if (targetEl && targetEl.tagName === 'IMG' && targetEl.src) {
        cleanup();
        chrome.runtime.sendMessage({
          action: 'PIXELAUTH_PROCESS_IMAGE_URL',
          imageUrl: targetEl.src
        });
        return;
      }
      if (targetEl && targetEl.tagName === 'CANVAS') {
        try {
          const dataUrl = targetEl.toDataURL('image/png');
          cleanup();
          chrome.runtime.sendMessage({
            action: 'PIXELAUTH_PROCESS_IMAGE_DATA_URL',
            dataUrl
          });
          return;
        } catch {
          // Canvas tainted fallback
        }
      }
    }

    // Hide banner and box before taking screenshot
    box.style.display = 'none';
    banner.style.display = 'none';
    overlay.style.background = 'transparent';

    // Allow browser one frame to render overlay hidden
    await new Promise(r => requestAnimationFrame(r));

    const dpr = window.devicePixelRatio || 1;
    const crop = {
      x: Math.round(rectX * dpr),
      y: Math.round(rectY * dpr),
      width: Math.round(Math.max(width, 20) * dpr),
      height: Math.round(Math.max(height, 20) * dpr)
    };

    cleanup();

    chrome.runtime.sendMessage({
      action: 'PIXELAUTH_PROCESS_SNIP_SELECTION',
      crop
    });
  });
})();

// Extract product data from Amazon pages and send to background worker

const LOG = (...args) => console.log('[SD content]', ...args);

function scrapeAndSend() {
  LOG('scrapeAndSend called, pathname:', window.location.pathname);
  const asinMatch = window.location.pathname.match(/(?:dp|gp\/product)\/([A-Z0-9]{10})(?=[/?#]|$)/i);
  if (!asinMatch) {
    LOG('no ASIN found in URL');
    return;
  }

  const asin = asinMatch[1];
  const name = document.querySelector('#productTitle')?.textContent?.trim() || '';
  const thumbnail =
    document.querySelector('#landingImage')?.src ||
    document.querySelector('#imgTagWrapperId img')?.src ||
    '';
  const description = document.querySelector('#feature-bullets li span')?.textContent?.trim() || '';
  const brandRow = [...(document.querySelectorAll('#poExpander tr') || [])].find(tr => tr.textContent.includes('Brand Name'));
  const brand = brandRow?.querySelector('td:last-child span')?.textContent?.trim() || '';

  const data = { asin, productName: name, thumbnailUrl: thumbnail, productUrl: window.location.href, description, brand };
  LOG('sending product data:', JSON.stringify(data, null, 2));

  chrome.runtime.sendMessage({ type: 'PRODUCT_DATA', data });
}

// Run on initial load
LOG('content script loaded, url:', location.href);
scrapeAndSend();

// Re-run when Amazon does client-side navigation between products
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    LOG('URL changed:', lastUrl, '->', location.href);
    lastUrl = location.href;
    // DOM lags behind URL change — poll until #productTitle updates
    waitForNewProduct().then(scrapeAndSend);
  }
}).observe(document, { subtree: true, childList: true });

function waitForNewProduct() {
  const asinMatch = location.pathname.match(/(?:dp|gp\/product)\/([A-Z0-9]{10})(?=[/?#]|$)/i);
  const expectedAsin = asinMatch?.[1];
  LOG('waiting for new product, expected ASIN:', expectedAsin);
  return new Promise(resolve => {
    let attempts = 0;
    const check = () => {
      const title = document.querySelector('#productTitle')?.textContent?.trim();
      const pageAsin = document.querySelector('input#ASIN')?.value;
      LOG(`poll #${attempts}: pageAsin=${pageAsin}, hasTitle=${!!title}`);
      if (title && (!expectedAsin || pageAsin === expectedAsin)) return resolve();
      if (++attempts > 30) {
        LOG('gave up waiting after 3s');
        return resolve();
      }
      setTimeout(check, 100);
    };
    check();
  });
}

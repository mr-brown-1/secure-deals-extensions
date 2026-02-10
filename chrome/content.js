// Extract product data from Amazon pages and send to background worker

const LOG = (...args) => console.log('[SD content]', ...args);

function scrapeBuyPrice() {
  const selectors = [
    '#corePrice_feature_div .a-offscreen',
    '#corePriceDisplay_desktop_feature_div .a-offscreen',
    '#priceblock_ourprice',
    '#price_inside_buybox',
    '.a-price .a-offscreen',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      const raw = el.textContent.trim().replace(/[^\d.,]/g, '');
      const parsed = parseEuroPrice(raw);
      if (parsed !== null) { LOG('buyPrice from', sel, '=', parsed); return parsed; }
    }
  }
  // Fallback: whole + fraction
  const whole = document.querySelector('.a-price-whole')?.textContent?.trim().replace(/[^\d]/g, '');
  const fraction = document.querySelector('.a-price-fraction')?.textContent?.trim().replace(/[^\d]/g, '');
  if (whole) {
    const parsed = parseFloat(`${whole}.${fraction || '0'}`);
    if (!isNaN(parsed)) { LOG('buyPrice from whole+fraction =', parsed); return parsed; }
  }
  LOG('buyPrice not found');
  return null;
}

function parseEuroPrice(str) {
  if (!str) return null;
  // European: 1.234,56 → 1234.56  or  19,99 → 19.99
  if (str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  }
  const n = parseFloat(str);
  return isNaN(n) ? null : n;
}

function scrapeSellPrice() {
  const el = document.querySelector('.basisPrice .a-price .a-offscreen');
  if (el) {
    const raw = el.textContent.trim().replace(/[^\d.,]/g, '');
    const parsed = parseEuroPrice(raw);
    if (parsed !== null) { LOG('sellPrice from basisPrice =', parsed); return parsed; }
  }
  LOG('sellPrice not found');
  return null;
}

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
  const buyPrice = scrapeBuyPrice();
  const sellPrice = scrapeSellPrice();

  const data = { asin, productName: name, thumbnailUrl: thumbnail, productUrl: window.location.href, description, brand, buyPrice, sellPrice };
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

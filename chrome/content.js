// Extract product data from Amazon pages and send to background worker

const asinMatch = window.location.pathname.match(/(?:dp|gp\/product)\/([A-Z0-9]{10})/);
if (asinMatch) {
  const asin = asinMatch[1];
  const name = document.querySelector('#productTitle')?.textContent?.trim() || '';
  const thumbnail =
    document.querySelector('#landingImage')?.src ||
    document.querySelector('#imgTagWrapperId img')?.src ||
    '';

  chrome.runtime.sendMessage({
    type: 'PRODUCT_DATA',
    data: { asin, productName: name, thumbnailUrl: thumbnail, productUrl: window.location.href },
  });
}

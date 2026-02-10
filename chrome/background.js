// Listen for storage changes and update rules dynamically
console.log('background.js loaded');

// --- Product data API ---
const API_URL = 'https://qpiistkm37k2oowb3q77vd3koa0inrrl.lambda-url.eu-north-1.on.aws/';
const API_KEY = 'samsams123!';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'PRODUCT_DATA') {
    chrome.storage.session.set({ product: message.data });
    console.log('Product stored:', message.data.asin);
    sendResponse({ stored: true });
    return false;
  }

  if (message.type === 'GET_PRODUCT') {
    chrome.storage.session.get('product', (d) => sendResponse({ product: d.product || null }));
    return true;
  }

  if (message.type === 'SEND_PRODUCT') {
    chrome.storage.session.get('product', (d) => {
      const product = d.product;
      if (!product) {
        sendResponse({ error: 'No product data available' });
        return;
      }
      const body = JSON.stringify(product);
      console.log('Product API request:', API_URL, body);

      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body,
      })
        .then(async (r) => {
          const text = await r.text();
          console.log('Product API response:', r.status, r.statusText, text);
          sendResponse({ status: r.status, body: text });
        })
        .catch((e) => {
          console.error('Product API error:', e.message, e.stack);
          sendResponse({ error: e.message });
        });
    });

    return true; // keep channel open for async response
  }

  if (message.type === 'SEND_DISCORD') {
    chrome.storage.session.get('product', async (d) => {
      const product = d.product;
      if (!product) { sendResponse({ error: 'No product data' }); return; }

      const sellPrice = parseFloat(message.sellPrice);
      if (isNaN(sellPrice)) { sendResponse({ error: 'Invalid sell price' }); return; }

      const buyPrice = parseFloat(message.buyPrice);
      if (isNaN(buyPrice) || buyPrice <= 0) { sendResponse({ error: 'Invalid buy price' }); return; }

      const sellCountry = message.sellCountry;
      if (!sellCountry) { sendResponse({ error: 'No sell country selected' }); return; }

      try {
        const { discordWebhookUrl: webhookUrl } = await chrome.storage.sync.get('discordWebhookUrl');
        if (!webhookUrl) { sendResponse({ error: 'No Discord webhook URL configured' }); return; }

        const countryFlagMap = { de: '\u{1F1E9}\u{1F1EA}', fr: '\u{1F1EB}\u{1F1F7}', it: '\u{1F1EE}\u{1F1F9}', es: '\u{1F1EA}\u{1F1F8}' };
        const domainMap = { 'amazon.de': 'de', 'amazon.fr': 'fr', 'amazon.it': 'it', 'amazon.es': 'es' };
        const matched = Object.entries(domainMap).find(([d]) => product.productUrl.includes(d));
        const buyFlag = matched ? countryFlagMap[matched[1]] : '\u{1F30D}';
        const sellFlag = countryFlagMap[sellCountry] || '\u{1F30D}';
        const countryId = matched ? matched[1] : null;

        // Build tagged product URL
        const { countryTags = {} } = await chrome.storage.sync.get('countryTags');
        const tag = countryId ? countryTags[countryId] : null;
        let taggedUrl = product.productUrl;
        if (tag && product.asin && matched) {
          taggedUrl = `https://www.${matched[0]}/dp/${product.asin}/ref=nosim?tag=${tag}`;
        }

        const profit = sellPrice - buyPrice;
        const margin = (profit / buyPrice) * 100;

        const embed = {
          title: (product.productName || product.asin).slice(0, 256),
          url: taggedUrl,
          color: 15380232,
          thumbnail: product.thumbnailUrl ? { url: product.thumbnailUrl } : undefined,
          fields: [
            { name: 'ASIN', value: product.asin, inline: true },
            { name: `${buyFlag} Buy`, value: `[${buyPrice.toFixed(2)}\u20AC](${taggedUrl})`, inline: true },
            { name: `${sellFlag} Sell`, value: `${sellPrice.toFixed(2)}\u20AC`, inline: true },
            { name: '\u{1F4B0} Margin', value: `${margin.toFixed(1)}% | ${profit >= 0 ? '+' : ''}${profit.toFixed(2)}\u20AC/unit`, inline: true },
          ],
          footer: { text: `Profit: ${profit >= 0 ? '+' : ''}${profit.toFixed(2)}\u20AC (${margin.toFixed(1)}%)` },
          timestamp: new Date().toISOString(),
        };

        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ embeds: [embed] }),
        });
        if (res.ok) {
          sendResponse({ success: true });
        } else {
          const text = await res.text();
          sendResponse({ error: `Discord ${res.status}: ${text}` });
        }
      } catch (e) {
        sendResponse({ error: e.message });
      }
    });
    return true;
  }

  return false;
});
// --- End product data API ---

let config = null;

// Load config on startup
async function loadConfig() {
  const response = await fetch(chrome.runtime.getURL('config.json'));
  config = await response.json();
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.countryTags) {
    updateDynamicRules();
  }
});

// Initial setup on extension load
chrome.runtime.onInstalled.addListener(() => {
  loadConfig().then(() => {
    updateDynamicRules();
  });
});

// Also run on service worker startup (for when browser restarts)
chrome.runtime.onStartup.addListener(() => {
  loadConfig().then(() => {
    updateDynamicRules();
  });
});

async function updateDynamicRules() {
  // Ensure declarativeNetRequest API is available
  if (!chrome.declarativeNetRequest) {
    console.error('declarativeNetRequest API not available');
    return;
  }

  if (!config) {
    await loadConfig();
  }

  const { countryTags = {} } = await chrome.storage.sync.get('countryTags');

  // Remove previous dynamic rules
  const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
  const oldRuleIds = oldRules.map(rule => rule.id);
  
  if (oldRuleIds.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: oldRuleIds });
  }

  // Create rules for each country that has a tag configured
  const newRules = [];
  let ruleId = 1;

  for (const option of config.options) {
    const tag = countryTags[option.id]?.trim();
    
    if (!tag) {
      // No tag for this country, skip
      continue;
    }

    // Create a regex that matches Amazon product URLs and captures the product ID
    // This regex will match various Amazon URL formats and extract the product ID (ASIN)
    // Examples:
    // - /dp/B0CTHXMYL8/...
    // - /gp/product/B0CTHXMYL8/...
    // - /...../dp/B0CTHXMYL8/...
    const domainPattern = option.domain.replace(/\./g, '\\.');
    const regexFilter = `^(https?)://([^/]+\\.)?${domainPattern}/(.*/)?(dp|gp/product)/([A-Z0-9]{10}).*$`;

    newRules.push({
      id: ruleId++,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: {
          regexSubstitution: `\\1://www.${option.domain}/dp/\\5/ref=nosim?tag=${tag}`
        }
      },
      condition: {
        regexFilter: regexFilter,
        resourceTypes: ['main_frame', 'sub_frame']
      }
    });

    console.log(`Created rule for ${option.domain} with tag: ${tag}`);
  }

  if (newRules.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: newRules
    });
    console.log(`Added ${newRules.length} redirect rules`);
  } else {
    console.log('No tags configured, no rules added');
  }
}

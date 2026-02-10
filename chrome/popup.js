// Country flag emoji mapping
const countryFlags = {
  de: '🇩🇪',
  es: '🇪🇸',
  fr: '🇫🇷',
  it: '🇮🇹'
};

let config = null;

// Load config and initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Fetch config.json
  const response = await fetch(chrome.runtime.getURL('config.json'));
  config = await response.json();

  // Load saved tags + webhook URL
  const { countryTags = {}, discordWebhookUrl = '' } = await chrome.storage.sync.get(['countryTags', 'discordWebhookUrl']);
  document.getElementById('webhookUrl').value = discordWebhookUrl;

  // Load product preview
  chrome.runtime.sendMessage({ type: 'GET_PRODUCT' }, (res) => {
    const preview = document.getElementById('productPreview');
    const btn = document.getElementById('sendProduct');
    if (res?.product) {
      const p = res.product;
      preview.innerHTML = `
        ${p.thumbnailUrl ? `<img src="${p.thumbnailUrl}" alt="">` : ''}
        <span class="product-name">${p.productName || p.asin}</span>
      `;
      btn.disabled = false;

      // Discord: pre-fill prices from scraper
      if (p.buyPrice) document.getElementById('buyPrice').value = p.buyPrice.toFixed(2);
      if (p.sellPrice) document.getElementById('sellPrice').value = p.sellPrice.toFixed(2);
      if (p.buyPrice && p.sellPrice) updateProfitPreview();
    }
  });

  // Build UI for each country
  const container = document.getElementById('countryTags');

  config.options.forEach((option, index) => {
    const item = document.createElement('div');
    item.className = 'country-item';
    item.style.animationDelay = `${index * 0.08}s`;

    const flag = countryFlags[option.id] || '🌐';
    const savedTag = countryTags[option.id] || '';

    item.innerHTML = `
      <span class="country-flag">${flag}</span>
      <div class="country-input-wrapper">
        <label class="country-label" for="tag-${option.id}">${option.label}</label>
        <input
          type="text"
          id="tag-${option.id}"
          data-country="${option.id}"
          placeholder="e.g., mytag-${option.id}"
          class="input-field"
          value="${savedTag}"
        >
      </div>
    `;

    container.appendChild(item);
  });
});

// Save all tags
document.getElementById('save').addEventListener('click', async () => {
  const status = document.getElementById('status');
  const countryTags = {};

  // Collect all tag values
  config.options.forEach(option => {
    const input = document.getElementById(`tag-${option.id}`);
    const tag = input.value.trim();
    if (tag) {
      countryTags[option.id] = tag;
    }
  });

  // Save to storage
  await chrome.storage.sync.set({ countryTags });

  // Show success message
  status.textContent = '✓ All affiliate tags saved successfully!';
  status.classList.remove('hidden');

  // Animate the save button briefly
  const button = document.getElementById('save');
  button.classList.add('pulse-soft');

  setTimeout(() => {
    status.classList.add('hidden');
    button.classList.remove('pulse-soft');
  }, 3000);
});

// Live profit preview
function updateProfitPreview() {
  const buyPrice = parseFloat(document.getElementById('buyPrice').value);
  const sellPrice = parseFloat(document.getElementById('sellPrice').value);
  const preview = document.getElementById('profitPreview');
  const btn = document.getElementById('sendDiscord');

  if (!isNaN(buyPrice) && buyPrice > 0 && !isNaN(sellPrice) && sellPrice > 0) {
    const profit = sellPrice - buyPrice;
    const margin = (profit / buyPrice) * 100;
    preview.textContent = `${profit >= 0 ? '+' : ''}${profit.toFixed(2)}\u20AC (${margin.toFixed(1)}%)`;
    preview.className = 'profit-preview ' + (profit >= 0 ? 'profit-positive' : 'profit-negative');
    preview.classList.remove('hidden');
    btn.disabled = false;
  } else {
    preview.classList.add('hidden');
    btn.disabled = true;
  }
}
document.getElementById('buyPrice').addEventListener('input', updateProfitPreview);
document.getElementById('sellPrice').addEventListener('input', updateProfitPreview);

// Save webhook URL on change
document.getElementById('webhookUrl').addEventListener('change', async () => {
  await chrome.storage.sync.set({ discordWebhookUrl: document.getElementById('webhookUrl').value.trim() });
});

// Send to Discord
document.getElementById('sendDiscord').addEventListener('click', () => {
  const sellPrice = parseFloat(document.getElementById('sellPrice').value);
  if (isNaN(sellPrice) || sellPrice <= 0) return;

  const btn = document.getElementById('sendDiscord');
  const status = document.getElementById('discordStatus');
  btn.disabled = true;
  btn.textContent = 'Sending\u2026';

  const buyPrice = parseFloat(document.getElementById('buyPrice').value);
  if (isNaN(buyPrice) || buyPrice <= 0) return;

  chrome.runtime.sendMessage({ type: 'SEND_DISCORD', sellPrice, buyPrice }, (res) => {
    status.classList.remove('hidden', 'status-error');
    if (res?.error) {
      status.textContent = res.error;
      status.classList.add('status-error');
    } else {
      status.textContent = '\u2713 Sent to Discord';
    }
    btn.innerHTML = `<svg class="icon" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z"/></svg> Send to Discord`;
    btn.disabled = false;
    setTimeout(() => status.classList.add('hidden'), 3000);
  });
});

// Send product to API
document.getElementById('sendProduct').addEventListener('click', () => {
  const btn = document.getElementById('sendProduct');
  const sendStatus = document.getElementById('sendStatus');
  btn.disabled = true;
  btn.textContent = 'Sending…';

  chrome.runtime.sendMessage({ type: 'SEND_PRODUCT' }, (res) => {
    sendStatus.classList.remove('hidden', 'status-error');

    if (res?.error) {
      sendStatus.textContent = res.error;
      sendStatus.classList.add('status-error');
    } else {
      sendStatus.textContent = `✓ Sent (${res?.status || 'ok'})`;
    }

    btn.textContent = 'Send to API';
    btn.disabled = false;

    setTimeout(() => sendStatus.classList.add('hidden'), 3000);
  });
});

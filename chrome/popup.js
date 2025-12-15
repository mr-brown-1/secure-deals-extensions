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

  // Load saved tags
  const { countryTags = {} } = await chrome.storage.sync.get('countryTags');

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

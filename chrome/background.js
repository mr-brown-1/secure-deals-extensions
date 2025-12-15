// Listen for storage changes and update rules dynamically
console.log('background.js loaded');

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

    // Create a regex that matches the specific Amazon domain
    // Escape dots in domain for regex
    const domainPattern = option.domain.replace(/\./g, '\\.');
    const regexFilter = `^https?://([^/]+\\.)?${domainPattern}/`;

    newRules.push({
      id: ruleId++,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: {
          transform: {
            queryTransform: {
              removeParams: ['tag'],
              addOrReplaceParams: [{ key: 'tag', value: tag }]
            }
          }
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

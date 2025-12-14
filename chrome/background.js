// Listen for storage changes and update rules dynamically
console.log('background.js loaded');

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.affiliateTag) {
      updateDynamicRules();
    }
  });
  
  // Initial setup on extension load
  updateDynamicRules();
  
  async function updateDynamicRules() {
    const { affiliateTag } = await chrome.storage.sync.get('affiliateTag');
    const tag = affiliateTag?.trim();

    // Remove previous dynamic rules
    const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
    const oldRuleIds = oldRules.map(rule => rule.id);
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: oldRuleIds });
  
    if (!tag) {
      // No tag configured → no rules
      return;
    }
  
    // Add new rule to redirect and replace/add the tag parameter
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: [{
        id: 1,
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
          regexFilter: '^https?://([^/]+\\.)?amazon\\.[^/]+/',
          resourceTypes: ['main_frame', 'sub_frame']
        }
      }]
    });
  }
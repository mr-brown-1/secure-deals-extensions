document.getElementById('save').addEventListener('click', () => {
    const tag = document.getElementById('tagInput').value.trim();
    const status = document.getElementById('status');

    chrome.storage.sync.set({ affiliateTag: tag }, () => {
      status.textContent = '✓ Affiliate tag saved successfully!';
      status.classList.remove('hidden');

      // Animate the save button briefly
      const button = document.getElementById('save');
      button.classList.add('animate-pulse-soft');

      setTimeout(() => {
        status.classList.add('hidden');
        button.classList.remove('animate-pulse-soft');
      }, 3000);
    });
  });

// Load saved tag on open with fade-in animation
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get('affiliateTag', (data) => {
    const input = document.getElementById('tagInput');
    if (data.affiliateTag) {
      input.value = data.affiliateTag;
    }
    // Add fade-in animation to input after loading
    input.style.animation = 'slide-in-right 0.5s ease-out';
  });
});
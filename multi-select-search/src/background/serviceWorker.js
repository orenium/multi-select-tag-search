// Background service worker. Two small jobs, both cosmetic:
//
// 1. Light up the toolbar icon on sites we actually support. This uses
//    chrome.declarativeContent: Chrome matches the rules internally and only
//    tells us "a rule fired" — this path hands the worker no tab URL, and
//    no host permissions are needed. The domain list is derived from the
//    single source of truth (src/adapters/siteCatalog.js, verified entries).
//
// 2. Mirror the live selection count onto the icon badge, so the count is
//    visible while the popup is closed. The content script pushes the number
//    via runtime.sendMessage; sender.tab supplies the tab id, so this needs
//    no "tabs" permission either.
//
// Nothing here reads, stores, or transmits browsing data.

importScripts('/src/adapters/siteCatalog.js');

const BADGE_BG = '#6D5AE6';
const ICON_SIZES = [16, 32];

async function activeIconImageData() {
  const imageData = {};
  for (const size of ICON_SIZES) {
    const res = await fetch(chrome.runtime.getURL(`icons/icon-active-${size}.png`));
    const bitmap = await createImageBitmap(await res.blob());
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, size, size);
    imageData[size] = ctx.getImageData(0, 0, size, size);
  }
  return imageData;
}

async function installIconRules() {
  if (!chrome.declarativeContent) return; // icon simply stays in its muted state
  const domains = (self.MSQ && self.MSQ.verifiedDomains) ? self.MSQ.verifiedDomains() : [];
  if (domains.length === 0) return;

  const imageData = await activeIconImageData();
  const conditions = [];
  for (const domain of domains) {
    // hostEquals + '.'-prefixed hostSuffix so "notimdb.com" cannot match.
    conditions.push(new chrome.declarativeContent.PageStateMatcher({
      pageUrl: { hostEquals: domain, schemes: ['https'] }
    }));
    conditions.push(new chrome.declarativeContent.PageStateMatcher({
      pageUrl: { hostSuffix: '.' + domain, schemes: ['https'] }
    }));
  }

  const rule = {
    conditions,
    actions: [new chrome.declarativeContent.SetIcon({ imageData })]
  };

  await new Promise((resolve) => {
    chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
      chrome.declarativeContent.onPageChanged.addRules([rule], resolve);
    });
  });
}

function refreshRules() {
  installIconRules().catch((err) => console.warn('[MultiSelect] icon rules failed:', err));
}

chrome.runtime.onInstalled.addListener(refreshRules);
chrome.runtime.onStartup.addListener(refreshRules);

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || msg.type !== 'msq-count' || !sender.tab) return;
  const tabId = sender.tab.id;
  const count = Number(msg.count) || 0;
  chrome.action.setBadgeText({ tabId, text: count > 0 ? String(count) : '' }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_BG }).catch(() => {});
  if (chrome.action.setBadgeTextColor) {
    chrome.action.setBadgeTextColor({ tabId, color: '#FFFFFF' }).catch(() => {});
  }
});

// Toolbar popup controller.
//
// The popup is the global view of the selection: on list-style pages a user
// can tick tags belonging to several different items (e.g. tags from three
// different Stack Overflow questions), and the in-page bar sits next to only
// one of them. This panel always shows the whole basket plus the CTA.
//
// It talks to the page exclusively through chrome.scripting.executeScript:
// inject the (idempotent) content files, then call MSQ.command(...). Opening
// the popup is a user invocation, which is what grants `activeTab`.

// Where feedback and new-site requests go. Change this one line to redirect
// them (a mailto: keeps the extension backend-free: nothing is transmitted
// until the user presses send in their own mail client).
const FEEDBACK_EMAIL = 'oren.broshi@gmail.com';

const CONTENT_FILES = [
  'src/core/debug.js',
  'src/core/registry.js',
  'src/core/siteAdapterEngine.js',
  'src/ui/styles.js',
  'src/ui/actionBar.js',
  'src/adapters/imdb/imdbQueryBuilder.js',
  'src/adapters/imdb/imdbSelectors.js',
  'src/adapters/imdb/imdbAdapter.js',
  'src/adapters/siteCatalog.js',
  'src/content/main.js'
];

const el = {
  requestSite: document.getElementById('request-site'),
  feedback: document.getElementById('feedback'),
  suggest: document.getElementById('suggest'),
  site: document.getElementById('site'),
  cta: document.getElementById('cta'),
  message: document.getElementById('message'),
  selection: document.getElementById('selection'),
  count: document.getElementById('count'),
  items: document.getElementById('items'),
  hint: document.getElementById('hint'),
  clear: document.getElementById('clear'),
  exit: document.getElementById('exit'),
  enable: document.getElementById('enable')
};

let tabId = null;
let model = null;

async function activeTabId() {
  // `id` is available without the "tabs" permission; `url` is not, which is
  // why the page state (host, site) comes back from the injected command.
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ? tab.id : null;
}

async function ensureInjected() {
  await chrome.scripting.executeScript({ target: { tabId }, files: CONTENT_FILES });
}

// Runs inside the page. Must stay self-contained (it is serialized).
function pageCommand(name, arg) {
  return (window.MSQ && window.MSQ.command) ? window.MSQ.command(name, arg) : null;
}

async function command(name, arg = null) {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    func: pageCommand,
    args: [name, arg]
  });
  return injection ? injection.result : null;
}

function render() {
  // Site badge
  const showBadge = model.mode === 'active' || model.mode === 'inactive';
  el.site.hidden = !showBadge;
  el.site.textContent = showBadge ? model.heading : '';

  // Message line
  el.message.hidden = !model.message;
  el.message.textContent = model.message || '';

  // Selection list
  el.selection.hidden = model.mode !== 'active';
  if (model.mode === 'active') {
    el.count.textContent = model.count + ' selected';
    el.clear.hidden = !model.showClear;
    el.items.replaceChildren();
    if (model.items.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'Nothing selected yet.';
      el.items.appendChild(li);
    } else {
      for (const item of model.items) {
        const li = document.createElement('li');
        const label = document.createElement('span');
        label.className = 'label';
        label.textContent = item.label;
        label.title = item.label;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'remove';
        remove.textContent = '✕';
        remove.setAttribute('aria-label', 'Remove ' + item.label);
        remove.addEventListener('click', () => run('deselect', item.id));
        li.append(label, remove);
        el.items.appendChild(li);
      }
    }
    el.hint.textContent = model.ctaHint || '';
  }

  // The full list of supported sites lives on the store listing, not in here.
  el.requestSite.hidden = !model.showRequestSite;

  // Footer. The CTA only makes sense while tags are selectable, so it is
  // hidden (not just disabled) on unsupported/blocked/off pages.
  el.cta.hidden = !model.showCta;
  el.cta.textContent = model.ctaLabel;
  el.cta.disabled = !model.canSearch;
  el.exit.hidden = !model.showExit;
  el.enable.hidden = model.mode !== 'inactive';
}

function applyState(state) {
  model = MSQ.buildPopupModel(state);
  render();
}

async function run(name, arg) {
  try {
    applyState(await command(name, arg));
  } catch (_) {
    applyState(null);
  }
}

// Opens the user's own mail client with a draft. Nothing is sent by the
// extension; the site name is only included when the user asked for exactly
// that ("add this site"), and they can edit or discard the draft.
function openMail(subject, body) {
  const url = 'mailto:' + FEEDBACK_EMAIL +
    '?subject=' + encodeURIComponent(subject) +
    '&body=' + encodeURIComponent(body);
  chrome.tabs.create({ url }).catch(() => {});
  window.close();
}

el.feedback.addEventListener('click', () => {
  openMail('Multi-Select Tag Search — feedback', [
    'What happened:',
    '',
    'What I expected:',
    '',
    '(Site and steps help a lot. Nothing is attached automatically.)'
  ].join('\n'));
});

function suggestSite() {
  const host = (model && model.host) ? model.host : '';
  openMail(
    'Multi-Select Tag Search — please add ' + (host || 'a site'),
    [
      'Site: ' + (host || '(which site?)'),
      '',
      'Which tags should be selectable (e.g. the genre chips on a product page):',
      '',
      'A search URL on that site that filters by two tags at once, if you know one:',
      ''
    ].join('\n')
  );
}

el.suggest.addEventListener('click', suggestSite);
el.requestSite.addEventListener('click', suggestSite);

el.cta.addEventListener('click', async () => {
  if (!model || !model.searchUrl) return;
  // Opened from the popup (not the page) so no popup-blocker heuristics and
  // the source tab stays exactly where it is.
  await chrome.tabs.create({ url: model.searchUrl, active: true });
  window.close();
});
el.clear.addEventListener('click', () => run('clear'));
el.exit.addEventListener('click', () => run('exit'));
el.enable.addEventListener('click', () => run('activate'));

(async function init() {
  try {
    tabId = await activeTabId();
    if (tabId === null) throw new Error('no active tab');
    await ensureInjected();
    let state = await command('state');
    // Opening the popup on a supported page turns the mode on, so the icon
    // keeps its original "click to start selecting" feel.
    if (state && state.supported && !state.active) state = await command('activate');
    applyState(state);
  } catch (_) {
    applyState(null); // restricted page, or the tab went away
  }
})();

// Contextual action bar — platform-agnostic. The controller supplies
// callbacks; this module only builds DOM and updates the count/CTA state.

window.MSQ = window.MSQ || {};

MSQ.ui = MSQ.ui || {};

MSQ.ui.createActionBar = MSQ.ui.createActionBar || function ({ onClear, onFind, onExit }) {
  const bar = document.createElement('div');
  bar.className = 'msq-bar';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Multi-select tag search');

  const hint = document.createElement('span');
  hint.className = 'msq-bar__hint';
  hint.textContent = 'Select multiple';

  const count = document.createElement('span');
  count.className = 'msq-bar__count';
  count.setAttribute('aria-live', 'polite');
  count.textContent = '0 selected';

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'msq-btn-clear';
  clearBtn.textContent = 'Clear';
  clearBtn.setAttribute('aria-label', 'Clear selection');
  clearBtn.addEventListener('click', onClear);

  const findBtn = document.createElement('button');
  findBtn.type = 'button';
  findBtn.className = 'msq-btn-find';
  findBtn.textContent = 'Find matches';
  findBtn.disabled = true;
  findBtn.setAttribute('aria-label', 'Find titles matching all selected tags');
  findBtn.title = 'Select at least 2 tags';
  findBtn.addEventListener('click', onFind);

  const exitBtn = document.createElement('button');
  exitBtn.type = 'button';
  exitBtn.className = 'msq-btn-exit';
  exitBtn.textContent = '✕';
  exitBtn.setAttribute('aria-label', 'Exit multi-select mode');
  exitBtn.title = 'Exit multi-select';
  exitBtn.addEventListener('click', onExit);

  bar.append(hint, count, clearBtn, findBtn, exitBtn);

  return {
    el: bar,
    // n selected; CTA enabled only at 2+ (1 tag = native IMDb click already
    // covers it, so a single selection adds nothing).
    setCount(n) {
      count.textContent = n + ' selected';
      findBtn.disabled = n < 2;
      findBtn.title = n < 2 ? 'Select at least 2 tags' : '';
    },
    remove() {
      bar.remove();
    }
  };
};

// Transient, self-removing status message (also used for "unsupported page").
MSQ.ui.toast = MSQ.ui.toast || function (message, ms = 3500) {
  document.querySelectorAll('.msq-toast').forEach((t) => t.remove());
  const el = document.createElement('div');
  el.className = 'msq-toast';
  el.setAttribute('role', 'status');
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
  return el;
};

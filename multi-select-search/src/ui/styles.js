// Extension CSS, injected as a single <style id="msq-styles"> element so
// cleanup is one node removal. Every class is msq- prefixed. Colors lean on
// IMDb's own dark palette + gold accent so the mode feels native, not bolted on.

window.MSQ = window.MSQ || {};

MSQ.STYLE_ID = MSQ.STYLE_ID || 'msq-styles';

MSQ.CSS = MSQ.CSS || `
/* ── selectable chips ─────────────────────────────────────────────── */
a.msq-selectable {
  cursor: copy !important;
  position: relative;
}
a.msq-selectable:focus-visible {
  outline: 2px solid #f5c518 !important;
  outline-offset: 2px;
}
a.msq-selectable.msq-selected {
  background: rgba(245, 197, 24, 0.22) !important;
  box-shadow: inset 0 0 0 1.5px #f5c518;
}

/* small check indicator prepended inside each chip */
.msq-checkbox {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  margin-right: 6px;
  border: 1.5px solid currentColor;
  border-radius: 3px;
  font-size: 11px;
  line-height: 1;
  vertical-align: -2px;
  opacity: 0.75;
}
.msq-selected .msq-checkbox {
  background: #f5c518;
  border-color: #f5c518;
  color: #121212;
  opacity: 1;
}

/* ── contextual action bar ────────────────────────────────────────── */
.msq-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin: 8px 0;
  padding: 6px 12px;
  border: 1px solid rgba(245, 197, 24, 0.45);
  border-radius: 8px;
  background: rgba(18, 18, 18, 0.92);
  color: #e8e8e8;
  font-family: Roboto, Helvetica, Arial, sans-serif;
  font-size: 13px;
  max-width: fit-content;
}
.msq-bar__hint {
  color: #b3b3b3;
}
.msq-bar__count {
  font-weight: 600;
  min-width: 74px;
}
.msq-bar button {
  font: inherit;
  border-radius: 6px;
  padding: 5px 12px;
  cursor: pointer;
  border: 1px solid transparent;
}
.msq-bar button:focus-visible {
  outline: 2px solid #f5c518;
  outline-offset: 1px;
}
.msq-btn-clear {
  background: transparent;
  color: #e8e8e8;
  border-color: rgba(255, 255, 255, 0.35) !important;
}
.msq-btn-clear:hover { background: rgba(255, 255, 255, 0.1); }
.msq-btn-find {
  background: #f5c518;
  color: #121212;
  font-weight: 600;
}
.msq-btn-find:hover:not(:disabled) { background: #e0b010; }
.msq-btn-find:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.msq-btn-exit {
  background: transparent;
  color: #b3b3b3;
  padding: 5px 8px;
  font-size: 15px;
  line-height: 1;
}
.msq-btn-exit:hover { color: #ffffff; }

/* ── transient status toast ───────────────────────────────────────── */
.msq-toast {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2147483647;
  padding: 10px 16px;
  border-radius: 8px;
  background: rgba(18, 18, 18, 0.95);
  color: #e8e8e8;
  border: 1px solid rgba(245, 197, 24, 0.5);
  font-family: Roboto, Helvetica, Arial, sans-serif;
  font-size: 13px;
  max-width: 80vw;
}
`;

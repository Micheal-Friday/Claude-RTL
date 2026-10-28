/**
 * Claude & ChatGPT RTL — sets an explicit dir on text containers so that
 * Persian/Arabic paragraphs render right-to-left, per element.
 *
 * Instead of relying on dir="auto" (which decides direction from the FIRST
 * strong character — so a Persian line that happens to start with an English
 * word wrongly turns LTR and breaks), we look at the whole block: if it
 * contains any Persian/Arabic letters we set dir="rtl", otherwise dir="ltr".
 * English words embedded in an RTL line still render correctly via the
 * browser's native bidi algorithm.
 *
 * Can be toggled on/off from the toolbar popup; the state lives in
 * storage.local under "enabled" (default on). When turned off, every change
 * the extension made is reverted and the page is left untouched.
 */
(() => {
  "use strict";

  const api = typeof browser !== "undefined" ? browser : chrome;

  // Rendered text, ChatGPT user bubbles, and both sites' composers.
  const TEXT_SELECTOR = [
    "p",
    "li",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "blockquote",
    "td", "th",
    'td :is(div, p, li, blockquote, [dir], [style])',
    'th :is(div, p, li, blockquote, [dir], [style])',
    '[contenteditable="true"]',
    'textarea#prompt-textarea',
    '[data-message-author-role="user"]',
    '[data-message-author-role="user"] .whitespace-pre-wrap',
  ].join(", ");

  // Never touch code — it must stay LTR.
  const SKIP_SELECTOR = "pre, code, kbd, samp";

  // Math must render as a self-contained LTR island, otherwise an equation
  // like "p = mg" gets reordered to "mg = p" when it sits inside an RTL
  // (Persian/Arabic) line. KaTeX is what claude.ai uses; <math> is MathML.
  const MATH_SELECTOR = ".katex, .katex-display, .katex-mathml, math";

  // Persian/Arabic (and related) letters. If a block contains any of these we
  // treat the whole block as RTL, regardless of which word comes first.
  const RTL_CHARS =
    /[֐-׿؀-ۿݐ-ݿࢠ-ࣿיִ-﷿ﹰ-﻿]/;

  // Attribute used to remember the element's original `dir` so we can restore
  // it exactly when the extension is turned off.
  const PREV_ATTR = "data-crtl-prev";
  const tableStyles = new Map();

  function applyTableStyles(el, direction) {
    if (direction === "auto" || !el.closest("td, th")) return;
    // Inline !important declarations also beat a cell wrapper's inline styles.
    // Remember individual properties so disabling preserves unrelated updates.
    const values = {
      direction,
      "text-align": direction === "rtl" ? "right" : "left",
      "unicode-bidi": "isolate",
    };
    if (!tableStyles.has(el)) {
      tableStyles.set(el, {
        hadStyle: el.hasAttribute("style"),
        properties: Object.keys(values).map(name => [
          name, el.style.getPropertyValue(name), el.style.getPropertyPriority(name),
        ]),
      });
    }
    for (const [name, value] of Object.entries(values)) {
      if (el.style.getPropertyValue(name) !== value ||
          el.style.getPropertyPriority(name) !== "important") {
        el.style.setProperty(name, value, "important");
      }
    }
  }

  function remember(el) {
    if (!el.hasAttribute(PREV_ATTR)) {
      el.setAttribute(PREV_ATTR, el.getAttribute("dir") ?? "");
    }
  }

  function applyDir(el) {
    if (el.closest(SKIP_SELECTOR + ", " + MATH_SELECTOR)) return;
    // The composer follows what you type, so leave the native auto detection
    // there; explicit rtl/ltr is only for rendered message blocks.
    const want = el.isContentEditable || el.matches("textarea")
      ? "auto"
      : RTL_CHARS.test(el.textContent || "")
        ? "rtl"
        : "ltr";
    applyTableStyles(el, want);
    if (el.getAttribute("dir") === want) return;
    remember(el);
    el.setAttribute("dir", want);
  }

  // Force an explicit LTR direction on math so it is never reordered by the
  // surrounding RTL bidi context. The CSS adds `unicode-bidi: isolate`.
  function isolateMath(el) {
    if (el.getAttribute("dir") === "ltr") return;
    remember(el);
    el.setAttribute("dir", "ltr");
  }

  function process(root) {
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    // Streaming tokens may arrive inside spans or replace existing text.
    // Revisit enclosing blocks so their direction follows the update.
    for (let el = root; el; el = el.parentElement) {
      if (el.matches(TEXT_SELECTOR)) applyDir(el);
    }
    for (const el of root.querySelectorAll(TEXT_SELECTOR)) applyDir(el);
    if (root.matches(MATH_SELECTOR)) isolateMath(root);
    for (const el of root.querySelectorAll(MATH_SELECTOR)) isolateMath(el);
  }

  // Restore every element we touched back to its original state.
  function revertAll() {
    for (const [el, previous] of tableStyles) {
      for (const [name, value, priority] of previous.properties) {
        if (value) el.style.setProperty(name, value, priority);
        else el.style.removeProperty(name);
      }
      if (!previous.hadStyle && !el.getAttribute("style")) el.removeAttribute("style");
    }
    tableStyles.clear();
    for (const el of document.querySelectorAll("[" + PREV_ATTR + "]")) {
      const prev = el.getAttribute(PREV_ATTR);
      if (prev) el.setAttribute("dir", prev);
      else el.removeAttribute("dir");
      el.removeAttribute(PREV_ATTR);
    }
  }

  // Batch mutations into one pass per animation frame (Claude streams
  // responses token by token, so mutations arrive in bursts).
  const pending = new Set();
  let scheduled = false;

  function schedule(node) {
    pending.add(node);
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      const batch = [...pending];
      pending.clear();
      if (!running) return;
      for (const n of batch) {
        if (n.isConnected) process(n);
      }
    });
  }

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "childList") {
        schedule(m.target);
        for (const n of m.addedNodes) {
          if (n.nodeType === Node.ELEMENT_NODE) schedule(n);
          else if (n.parentElement) schedule(n.parentElement);
        }
      } else if (m.type === "characterData" && m.target.parentElement) {
        schedule(m.target.parentElement);
      } else if (m.type === "attributes") {
        schedule(m.target);
      }
    }
  });

  let running = false;

  function enable() {
    if (running) return;
    running = true;
    // The stylesheet only applies while this flag is on <html>, so disabling
    // also neutralises the CSS, not just the dir attributes.
    document.documentElement.setAttribute("data-claude-rtl", "on");
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["dir", "style"],
    });
    process(document.body || document.documentElement);
  }

  function disable() {
    if (!running) return;
    running = false;
    observer.disconnect();
    pending.clear();
    scheduled = false;
    revertAll();
    document.documentElement.removeAttribute("data-claude-rtl");
  }

  function setEnabled(value) {
    if (value === false) disable();
    else enable();
  }

  // Initial state (default on), then keep in sync with the popup toggle.
  Promise.resolve(api.storage.local.get("enabled"))
    .then((res) => setEnabled(res ? res.enabled : true))
    .catch(() => enable());

  api.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.enabled) return;
    setEnabled(changes.enabled.newValue);
  });
})();

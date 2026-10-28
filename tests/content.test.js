const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { JSDOM } = require("jsdom");

async function load(build, enabled = true) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>
    <p id="claude" dir="auto">API برای شما</p>
    <div data-message-author-role="user" id="user">
      <div class="whitespace-pre-wrap" id="bubble">GPT مرحبا بالعالم</div>
    </div>
    <div data-message-author-role="assistant">
      <p id="english">Hello world</p>
      <p id="stream"><span>Hello</span></p>
      <p id="mixed">سلام <code id="inline">x = 1</code>
        <span class="katex" id="math"><span>p = mg</span></span></p>
      <pre id="code"><code><span>const text = "سلام";</span></code></pre>
    </div>
    <div id="composer" contenteditable="true"><p>سلام</p></div>
    <textarea id="prompt-textarea">مرحبا</textarea>
  </body></html>`, { runScripts: "outside-only", url: "https://chatgpt.com/" });
  const { window } = dom;
  // jsdom does not implement the browser's inherited editing state.
  Object.defineProperty(window.HTMLElement.prototype, "isContentEditable", {
    get() { return !!this.closest('[contenteditable="true"]'); },
  });
  let onChanged;
  const frames = [];
  window.requestAnimationFrame = callback => frames.push(callback);
  window.chrome = { storage: {
    local: { get: async () => ({ enabled }) },
    onChanged: { addListener: callback => { onChanged = callback; } },
  } };
  const style = window.document.createElement("style");
  style.textContent = readFileSync(`${build}/styles.css`, "utf8");
  window.document.head.append(style);
  window.eval(readFileSync(`${build}/content.js`, "utf8"));
  await new Promise(resolve => setImmediate(resolve));
  async function flush() {
    await Promise.resolve();
    while (frames.length) frames.shift()();
  }
  return {
    window, document: window.document, flush,
    toggle(value) { onChanged({ enabled: { newValue: value } }, "local"); },
    close() { window.close(); },
  };
}

for (const build of ["chrome", "firefox"]) {
  test(`${build}: Claude and ChatGPT messages, composers, code, and math`, async t => {
    const page = await load(build);
    t.after(() => page.close());
    const { document, window } = page;
    for (const id of ["claude", "user", "bubble", "mixed"]) {
      assert.equal(document.getElementById(id).dir, "rtl", id);
    }
    assert.equal(document.getElementById("english").dir, "ltr");
    assert.equal(document.getElementById("composer").dir, "auto");
    assert.equal(document.querySelector("#composer p").dir, "auto");
    assert.equal(document.getElementById("prompt-textarea").dir, "auto");
    for (const id of ["inline", "code", "math"]) {
      assert.equal(window.getComputedStyle(document.getElementById(id)).direction, "ltr", id);
    }
    assert.equal(document.getElementById("inline").hasAttribute("dir"), false);
    assert.equal(document.getElementById("math").dir, "ltr");
    assert.equal(window.getComputedStyle(document.getElementById("bubble")).textAlign, "start");
  });

  test(`${build}: streaming inside nested spans and deleting RTL text`, async t => {
    const page = await load(build);
    t.after(() => page.close());
    const paragraph = page.document.getElementById("stream");
    const span = paragraph.firstElementChild;
    span.firstChild.data += " سلام";
    await page.flush();
    assert.equal(paragraph.dir, "rtl");
    span.firstChild.data = "Hello";
    await page.flush();
    assert.equal(paragraph.dir, "ltr");
    const rtl = page.document.createElement("span");
    rtl.textContent = " مرحبا";
    span.append(rtl);
    await page.flush();
    assert.equal(paragraph.dir, "rtl");
    rtl.remove();
    await page.flush();
    assert.equal(paragraph.dir, "ltr");
  });

  test(`${build}: new messages and disabling restore original directions`, async t => {
    const page = await load(build);
    t.after(() => page.close());
    const message = page.document.createElement("div");
    message.dataset.messageAuthorRole = "user";
    message.textContent = "GPT سلام";
    page.document.body.append(message);
    await page.flush();
    assert.equal(message.dir, "rtl");
    message.textContent += " دنیا";
    await Promise.resolve();
    page.toggle(false);
    await page.flush();
    assert.equal(page.document.getElementById("claude").dir, "auto");
    assert.equal(page.document.querySelectorAll("[data-crtl-prev]").length, 0);
    assert.equal(message.hasAttribute("dir"), false);
    assert.equal(page.document.documentElement.hasAttribute("data-claude-rtl"), false);
    page.toggle(true);
    assert.equal(message.dir, "rtl");
  });

  test(`${build}: saved disabled state leaves page untouched`, async t => {
    const page = await load(build, false);
    t.after(() => page.close());
    assert.equal(page.document.getElementById("claude").dir, "auto");
    assert.equal(page.document.querySelectorAll("[data-crtl-prev]").length, 0);
    page.toggle(true);
    assert.equal(page.document.getElementById("bubble").dir, "rtl");
  });

  test(`${build}: table text overrides site direction and keeps code and math LTR`, async t => {
    const page = await load(build);
    t.after(() => page.close());
    const { document, window } = page;
    const table = document.createElement("table");
    table.innerHTML = `<thead><tr><th dir="auto">API توضیحات</th><th>English</th></tr></thead>
      <tbody><tr><td dir="auto"><p>GPT سلام <code dir="rtl">x = 1</code>
        <span class="katex"><span>p = mg</span></span></p></td>
      <td><span>Hello</span></td></tr></tbody>`;
    document.body.append(table);
    await page.flush();
    const [rtlHeader, englishHeader] = table.querySelectorAll("th");
    const [rtlCell, englishCell] = table.querySelectorAll("td");
    const paragraph = rtlCell.querySelector("p");
    for (const element of [rtlHeader, rtlCell, paragraph]) {
      assert.equal(element.dir, "rtl");
      const style = window.getComputedStyle(element);
      assert.equal(style.direction, "rtl");
      assert.equal(style.textAlign, "right");
      assert.equal(style.unicodeBidi, "isolate");
      // jsdom does not model !important overriding inline styles. Verify the
      // declarations' priority directly as well as their computed values.
      const rule = [...document.styleSheets[0].cssRules].find(rule =>
        rule.selectorText?.includes(":is(td, th)") &&
        element.matches(rule.selectorText));
      for (const property of ["direction", "text-align", "unicode-bidi"]) {
        assert.equal(rule.style.getPropertyPriority(property), "important");
      }
    }
    for (const element of [englishHeader, englishCell, ...table.querySelectorAll("code, .katex")]) {
      assert.equal(window.getComputedStyle(element).direction, "ltr");
    }
    englishCell.querySelector("span").firstChild.data += " مرحبا";
    await page.flush();
    assert.equal(window.getComputedStyle(englishCell).direction, "rtl");
    page.toggle(false);
    assert.equal(rtlHeader.dir, "auto");
    assert.equal(rtlCell.dir, "auto");
    assert.equal(englishCell.hasAttribute("dir"), false);
    assert.equal(window.getComputedStyle(rtlCell).textAlign, "");
  });

  test(`${build}: inline table styles, nested wrappers, and site rerenders`, async t => {
    const page = await load(build);
    t.after(() => page.close());
    const { document, window } = page;
    const table = document.createElement("table");
    table.innerHTML = `<tbody><tr><td dir="ltr" style="direction:ltr!important;text-align:left!important;color:red">
      <div dir="ltr" style="direction:ltr!important;text-align:left!important">API سلام دنیا
        <code style="direction:ltr">x = 1</code>
        <span class="katex">p = mg</span>
      </div></td><td>English</td></tr></tbody>`;
    const cell = table.querySelector("td");
    const wrapper = table.querySelector("div");
    document.body.append(table);
    await page.flush();
    for (const el of [cell, wrapper]) {
      assert.equal(window.getComputedStyle(el).direction, "rtl");
      assert.equal(window.getComputedStyle(el).textAlign, "right");
    }
    // React or a site script can replace attributes after the initial pass.
    wrapper.dir = "ltr";
    wrapper.style.setProperty("text-align", "left", "important");
    await page.flush();
    assert.equal(wrapper.dir, "rtl");
    assert.equal(window.getComputedStyle(wrapper).textAlign, "right");
    cell.style.setProperty("background-color", "blue");
    for (const el of table.querySelectorAll("code, .katex")) {
      assert.equal(window.getComputedStyle(el).direction, "ltr");
    }
    page.toggle(false);
    for (const el of [cell, wrapper]) {
      assert.equal(el.dir, "ltr");
      assert.equal(el.style.direction, "ltr");
      assert.equal(el.style.textAlign, "left");
      assert.equal(el.style.getPropertyPriority("direction"), "important");
    }
    assert.equal(cell.style.color, "red");
    assert.equal(cell.style.backgroundColor, "blue");
    assert.equal(table.querySelectorAll("td")[1].hasAttribute("style"), false);
  });
}

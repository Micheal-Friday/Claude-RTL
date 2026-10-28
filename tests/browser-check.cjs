const { readFileSync, writeFileSync, mkdtempSync, mkdirSync } = require("node:fs");
const { createServer } = require("node:http");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { pathToFileURL } = require("node:url");
const { spawnSync, spawn } = require("node:child_process");
const assert = require("node:assert/strict");

// Run with: node tests/browser-check.cjs "path/to/chrome-or-edge"
const executable = process.argv[2] || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const directory = mkdtempSync(join(tmpdir(), "rtl-browser-check-"));
async function main() {
for (const build of ["chrome", "firefox"]) {
  const fixture = join(directory, `${build}.html`);
  writeFileSync(fixture, `<!doctype html><meta charset="utf-8">
    <style>${readFileSync(`${build}/styles.css`, "utf8")}</style>
    <table><tr><td dir="ltr" style="direction:ltr!important;text-align:left!important">
      <div dir="ltr" style="direction:ltr!important;text-align:left!important">API سلام دنیا
        <code>x = 1</code><span class="katex">p = mg</span>
      </div></td><td>English</td></tr></table>
    <output id="result">PENDING</output>
    <script>
    let toggle;
    window.chrome = { storage: {
      local: { get: async () => ({ enabled: true }) },
      onChanged: { addListener: callback => { toggle = callback; } }
    } };
    // Headless tabs can throttle animation frames; keep batching deterministic.
    window.requestAnimationFrame = callback => setTimeout(callback, 0);
    ${readFileSync(`${build}/content.js`, "utf8")}
    const check = (condition, message) => { if (!condition) throw Error(message); };
    const wait = () => new Promise(resolve => setTimeout(resolve, 100));
    (async () => {
      await wait();
      const cell = document.querySelector('td');
      const wrapper = cell.querySelector('div');
      for (const el of [cell, wrapper]) {
        check(getComputedStyle(el).direction === 'rtl', 'initial direction');
        check(getComputedStyle(el).textAlign === 'right', 'initial alignment');
      }
      wrapper.dir = 'ltr';
      wrapper.style.setProperty('direction', 'ltr', 'important');
      wrapper.style.setProperty('text-align', 'left', 'important');
      await wait();
      check(wrapper.dir === 'rtl', 'rerender dir');
      check(getComputedStyle(wrapper).direction === 'rtl', 'rerender direction');
      check(getComputedStyle(wrapper).textAlign === 'right', 'rerender alignment');
      for (const el of cell.querySelectorAll('code, .katex')) {
        check(getComputedStyle(el).direction === 'ltr', 'LTR islands');
      }
      check(getComputedStyle(document.querySelectorAll('td')[1]).direction === 'ltr', 'English cell');
      toggle({ enabled: { newValue: false } }, 'local');
      check(cell.dir === 'ltr', 'restored dir');
      check(getComputedStyle(cell).textAlign === 'left', 'restored alignment');
      document.querySelector('#result').textContent = 'PASS';
    })().catch(error => { document.querySelector('#result').textContent = 'FAIL: ' + error.message; })
      .then(() => { if (location.protocol === 'http:') fetch('/result?status=' + encodeURIComponent(document.querySelector('#result').textContent)); });
    </script>`);
  if (/firefox/i.test(executable)) {
    let complete;
    const finished = new Promise(resolve => { complete = resolve; });
    const server = createServer((request, response) => {
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname === '/result') {
        response.end('OK');
        complete(url.searchParams.get('status'));
      } else {
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.end(readFileSync(fixture));
      }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const profile = join(directory, `profile-${build}`);
    mkdirSync(profile);
    const child = spawn(executable, ['-headless', '-no-remote', '-profile', profile,
      `http://127.0.0.1:${server.address().port}/fixture`], { windowsHide: true, stdio: 'ignore' });
    let timer;
    try {
      const status = await Promise.race([finished, new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error('Firefox rendering check timed out')), 20000);
        child.once('error', reject);
      })]);
      assert.equal(status, 'PASS', `${build}: ${status}`);
      console.log(`${build}: Firefox rendering, inline overrides, rerenders, LTR islands, and restore passed.`);
    } finally {
      clearTimeout(timer);
      child.kill();
      server.closeAllConnections();
      server.close();
    }
    continue;
  }
  const result = spawnSync(executable, [
    "--headless", "--disable-gpu", "--no-first-run", "--disable-extensions",
    `--user-data-dir=${join(directory, `profile-${build}`)}`,
    "--virtual-time-budget=3000", "--dump-dom", pathToFileURL(fixture).href,
  ], { encoding: "utf8", timeout: 30000, windowsHide: true });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr);
  const status = result.stdout.match(/<output id="result">([^<]+)<\/output>/)?.[1];
  assert.equal(status, "PASS", `${build}: ${status || result.stderr}`);
  console.log(`${build}: Chrome rendering, inline overrides, rerenders, LTR islands, and restore passed.`);
}
}
main().catch(error => { console.error(error); process.exitCode = 1; });

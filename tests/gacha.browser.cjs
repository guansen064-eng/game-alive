// Run: node tests/gacha.browser.cjs [screenshot-directory]
// Uses installed Edge/Chrome via CDP; no npm dependencies or account server needed.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const root = path.resolve(__dirname, "..");

(async () => {
  const executable = [process.env.ALIVE_BROWSER, "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find((file) => file && fs.existsSync(file));
  if (!executable) throw new Error("Set ALIVE_BROWSER to an installed Chromium/Edge executable.");
  const server = http.createServer((req, res) => {
    const name = new URL(req.url, "http://localhost").pathname.slice(1) || "index.html";
    if (name.startsWith("alive/api/")) {
      res.setHeader("Content-Type", "application/json");
      return res.end('{"authenticated":false}');
    }
    if (!/^[a-z-]+\.(html|js|css)$/.test(name) || !fs.existsSync(path.join(root, name))) {
      res.writeHead(404); return res.end();
    }
    res.setHeader("Content-Type", name.endsWith(".js") ? "text/javascript" : name.endsWith(".css") ? "text/css" : "text/html");
    res.end(fs.readFileSync(path.join(root, name)));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "alive-gacha-test-"));
  const browser = spawn(executable, ["--headless=new", "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
  let ws;
  try {
    const portFile = path.join(profile, "DevToolsActivePort");
    for (let i = 0; !fs.existsSync(portFile) && i < 100; i++) await delay(100);
    const port = fs.readFileSync(portFile, "utf8").split("\n")[0];
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    ws = new WebSocket(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
    await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }));
    let id = 0;
    const pending = new Map();
    const errors = [];
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails);
      if (!message.id) return;
      const request = pending.get(message.id);
      if (!request) return;
      clearTimeout(request.timeout);
      pending.delete(message.id);
      message.error ? request.reject(message.error) : request.resolve(message.result);
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const requestId = ++id;
      const timeout = setTimeout(() => { pending.delete(requestId); reject(new Error(`CDP timed out: ${method}`)); }, 15000);
      pending.set(requestId, { resolve, reject, timeout });
      ws.send(JSON.stringify({ id: requestId, method, params }));
    });
    const evaluate = async (expression) => {
      const response = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
      if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
      return response.result.value;
    };
    const click = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    const phase = () => evaluate('document.querySelector("#supply-opening").dataset.phase');
    const ids = () => evaluate('[...document.querySelectorAll(".supply-reward")].map(card => card.dataset.weaponId)');
    const screenshot = async (name) => {
      if (!process.argv[2]) return;
      fs.mkdirSync(process.argv[2], { recursive: true });
      const result = await send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(path.join(process.argv[2], name + ".png"), Buffer.from(result.data, "base64"));
    };
    await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: `http://127.0.0.1:${server.address().port}/` });
    await delay(600);
    await click("#guest-button");
    await click("#open-gacha");
    const initial = await evaluate('JSON.stringify({ crystals: document.querySelector("#gacha-crystal").textContent, loadout: window.ALIVE_LOADOUT, saved: localStorage.getItem("alive-ui-loadout") })');
    await click('[data-draw="10"]');
    assert.equal(await phase(), "landing");
    const original = await ids();
    assert.equal(original.length, 10);
    await click('[data-draw="10"]'); // Synthetic duplicate bypasses native modal inertness.
    assert.deepEqual(await ids(), original);
    await delay(1050);
    assert.equal(await phase(), "charging");
    await screenshot("supply-charging");
    await delay(1100);
    assert.equal(await phase(), "opening");
    await delay(650);
    assert.equal(await phase(), "revealing");
    await delay(1500);
    assert.equal(await phase(), "results");
    assert.deepEqual(await ids(), original);
    await screenshot("supply-results-desktop");
    await click("#supply-again");
    assert.equal(await phase(), "landing");
    const replay = await ids();
    await click("#supply-skip");
    assert.equal(await phase(), "results");
    assert.deepEqual(await ids(), replay);
    await click("#supply-done");
    await delay(50);
    assert.equal(await evaluate('document.activeElement.dataset.draw'), "10");
    await click('[data-draw="1"]');
    assert.equal((await ids()).length, 1);
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    assert.equal(await phase(), "results");
    await screenshot("supply-result-single");
    await click("#supply-done");
    await click("#skip-supply-animation");
    await click('[data-draw="10"]');
    assert.equal(await phase(), "results");
    assert.equal(await evaluate('localStorage.getItem("alive-gacha-skip")'), "true");
    await click("#supply-done");
    assert.equal(await evaluate('JSON.stringify({ crystals: document.querySelector("#gacha-crystal").textContent, loadout: window.ALIVE_LOADOUT, saved: localStorage.getItem("alive-ui-loadout") })'), initial);
    await send("Page.reload"); await delay(500);
    assert.equal(await evaluate('document.querySelector("#skip-supply-animation").checked'), true);
    await click("#open-gacha");
    await click("#skip-supply-animation");
    await click('[data-draw="1"]');
    await click("#supply-close");
    await delay(4200);
    assert.equal(await phase(), "idle");
    assert.equal(await evaluate('document.querySelector("#supply-opening").open'), false);
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await click('[data-draw="10"]');
    assert.equal(await phase(), "results");
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await delay(150);
    assert.ok(await evaluate('document.querySelector("#supply-opening").scrollWidth <= 390'));
    await screenshot("supply-results-mobile");
    await evaluate('document.querySelector("#supply-done").scrollIntoView({block:"end"})');
    assert.ok(await evaluate('document.querySelector("#supply-done").getBoundingClientRect().bottom <= innerHeight + 1'));
    await screenshot("supply-results-mobile-footer");
    await click("#supply-done");
    assert.deepEqual(errors, []);
    console.log("PASS: full animation, 1/10 results, duplicate guard, skip preserves results, replay, Escape, close cleanup, focus, saved preference, reduced motion, mobile scrolling, unchanged inventory and wallet.");
    await send("Browser.close");
  } finally { ws?.close(); browser.kill(); server.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });

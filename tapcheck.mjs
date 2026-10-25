const width = Number(process.argv[2]);
const res = await fetch('http://127.0.0.1:9222/json/new?' + encodeURIComponent('http://localhost:8090/'), { method: 'PUT' });
const t = await res.json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
const send = (m, p = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } };
await new Promise((r) => (ws.onopen = r));
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: true });
await send('Page.navigate', { url: 'http://localhost:8090/' });
await new Promise((r) => setTimeout(r, 2400));
await send('Runtime.evaluate', { expression: `document.getElementById('nav-toggle').click()` });
await new Promise(r => setTimeout(r, 400));
const o = await send('Runtime.evaluate', { returnByValue: true, expression: `(() => {
  const nav = document.getElementById('site-nav');
  const links = [...nav.querySelectorAll('a')];
  return {
    links: links.map(a => { const r = a.getBoundingClientRect(); const s = getComputedStyle(a);
      return { text: a.textContent.trim(), h: Math.round(r.height), w: Math.round(r.width), fs: s.fontSize, color: s.color }; }),
    cardW: (() => { const c = document.querySelector('.post-card'); return c ? Math.round(c.getBoundingClientRect().width) : null; })(),
  };
})()` });
console.log(width + ':\n' + JSON.stringify(o.result.value, null, 1));
ws.close();
await fetch('http://127.0.0.1:9222/json/close/' + t.id);

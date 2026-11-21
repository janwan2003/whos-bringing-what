// Renders public/og.png (1200x630) from tools/og.html and PNG icons from public/icon.svg.
import { chromium } from 'playwright-core';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import url from 'node:url';
const root = path.join(os.homedir(), '.cache/ms-playwright');
const dir = fs.readdirSync(root).filter((d) => d.startsWith('chromium-')).sort().reverse()[0];
const b = await chromium.launch({ executablePath: path.join(root, dir, 'chrome-linux64/chrome') });
const here = path.dirname(url.fileURLToPath(import.meta.url));
const pub = path.join(here, '../public');
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.goto('file://' + path.join(here, 'og.html'));
await p.screenshot({ path: path.join(pub, 'og.png') });
for (const s of [180, 512]) {
  const q = await b.newPage({ viewport: { width: s, height: s } });
  const svg = fs.readFileSync(path.join(pub, 'icon.svg'), 'utf8').replace('<svg ', `<svg width="${s}" height="${s}" `);
  await q.setContent(`<body style="margin:0">${svg}</body>`);
  await q.screenshot({ path: path.join(pub, `icon-${s}.png`), omitBackground: true });
}
await b.close();

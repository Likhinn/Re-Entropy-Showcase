// Visual check: node tools/shoot.mjs <outDir> [ids...]   (dev server must be running)
import puppeteer from 'puppeteer-core';
const [out, ...ids] = process.argv.slice(2);
const W = +(process.env.W || 1440), H = +(process.env.H || 720);
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--enable-gpu', '--use-angle=d3d11'] });
const p = await b.newPage();
await p.setViewport({ width: W, height: H });
p.on('console', (m) => ['error', 'warn'].includes(m.type()) && console.log(m.type(), m.text()));
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(process.env.URL || 'http://localhost:5199/');
await p.waitForSelector('body:not([data-view=loading])', { timeout: 60000 });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await wait(2500);
await p.screenshot({ path: `${out}/hero.png` });
await p.click('#launch');
await wait(3500);
await p.screenshot({ path: `${out}/view.png` });
for (const id of ids) {
  await p.evaluate((x) => document.querySelector(`[aria-controls=b-${x}]`).click(), id);
  await wait(3200);
  await p.screenshot({ path: `${out}/${id}.png` });
}
if (process.env.EXPLODE) {
  await p.keyboard.press('Escape');
  await wait(2500);
  await p.click('#explode');
  await wait(1100);
  await p.screenshot({ path: `${out}/explode-mid.png` });
  await wait(2500);
  await p.screenshot({ path: `${out}/explode.png` });
  await p.evaluate((x) => document.querySelector(`[aria-controls=b-${x}]`).click(), process.env.EXPLODE);
  await wait(3200);
  await p.screenshot({ path: `${out}/explode-focus.png` });
}
await b.close();

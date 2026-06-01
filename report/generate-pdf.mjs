import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, 'pintae-stakeholders.html');
const pdfPath = path.join(__dirname, 'Pintae-Relatorio-Stakeholders-2026.pdf');

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });

// Aguarda fontes carregarem
await page.waitForTimeout(2000);

await page.pdf({
  path: pdfPath,
  format: 'A4',
  printBackground: true,
  margin: { top: '0', right: '0', bottom: '0', left: '0' },
  displayHeaderFooter: false,
});

await browser.close();

console.log(`✅ PDF gerado: ${pdfPath}`);

// scripts/generate-qrcodes.js
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';

// ========== CONFIG ===========
// Direct link to the customer ordering page
// use QR_BASE_URL env var if present, otherwise production URL
const baseUrl = process.env.QR_BASE_URL || 'https://restaurent-system-jfmfvey00-dyevkks-projects.vercel.app/order?table=';


const outputDir = path.join(process.cwd(), 'public', 'qrcodes');

const tables = [
  { number: 1, id: '30c51fdc-901d-4bb5-be5c-69b3ee51ce2e' },
  { number: 2, id: '8fcac40c-865f-4e26-89ea-cbc5eb764513' },
  { number: 3, id: '52e311a7-c9d4-49d8-b95c-c080b2c2b840' }
];
// =============================

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function generate() {
  await ensureDir(outputDir);

  for (const t of tables) {
    const url = `${baseUrl}${t.id}`;
    const fileName = `table-${t.number}.png`;
    const outPath = path.join(outputDir, fileName);

    await QRCode.toFile(outPath, url, {
      width: 512,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    console.log('Created', outPath, '=>', url);
  }
}

generate();

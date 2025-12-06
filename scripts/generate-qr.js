// scripts/generate-qr.js
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';

// Add your table UUIDs here from Supabase
const tables = [
  // Example (replace with your real IDs)
  { number: 1, id: '30c51fdc-901d-4bb5-be5c-69b3ee51ce2e' },
  { number: 2, id: '8fcac40c-865f-4e26-89ea-cbc5eb764513' },
  { number: 3, id: '52e311a7-c9d4-49d8-b95c-c080b2c2b840' }
];

// Localhost URL for development
const BASE_URL = 'http://localhost:3000/order?table=';

async function generate() {
  const outDir = path.join(process.cwd(), 'qrcodes');

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  for (const table of tables) {
    const url = BASE_URL + table.id;
    const filePath = path.join(outDir, `table-${table.number}.png`);

    await QRCode.toFile(filePath, url, {
      color: { dark: '#000000', light: '#ffffff' },
      width: 500
    });

    console.log(`Generated QR for Table ${table.number}: ${filePath}`);
  }
}

generate();

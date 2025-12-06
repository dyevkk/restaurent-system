// pages/index.js
import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ padding: 40, fontFamily: 'Inter, system-ui, Arial, sans-serif' }}>
      <h1 style={{ fontSize: 28 }}>QR Table Billing — Dev Preview</h1>
      <p style={{ color:'#6b7280' }}>Use the links below to test.</p>

      <ul style={{ marginTop:20 }}>
        <li><Link href="/auth/login">Admin login</Link></li>
        <li><Link href="/order?table=TEST_TABLE_UUID">Sample Order page (replace TEST_TABLE_UUID)</Link></li>
        <li><Link href="/admin">Admin dashboard</Link></li>
      </ul>
    </main>
  );
}

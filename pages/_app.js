// pages/_app.js
import '../styles/globals.css';
import Head from 'next/head';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>Your Restaurant — Luxury</title>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        {/* DO NOT add external stylesheet links here; they belong in _document.js */}
      </Head>
      <div className="admin-bg min-h-screen">
        <Component {...pageProps} />
      </div>
    </>
  );
}

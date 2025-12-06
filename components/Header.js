// components/Header.js
export default function Header({ title, subtitle, right }) {
  return (
    <header className="site-header container">
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <div style={{width:64,height:64, borderRadius:12, overflow:'hidden', background:'#071017', display:'flex',alignItems:'center',justifyContent:'center', boxShadow:'0 6px 20px rgba(2,6,23,0.5)'}}>
          <img src="/logo.png" alt="logo" style={{maxWidth:'100%', maxHeight:'100%'}} onError={e=>e.currentTarget.style.display='none'} />
        </div>
        <div>
          <div style={{fontFamily: 'Playfair Display, serif', fontSize:20, fontWeight:600, color:'var(--lux-gold)'}}>{title}</div>
          {subtitle && <div className="muted-dark" style={{fontSize:13}}>{subtitle}</div>}
        </div>
      </div>

      <div>
        {right ? right : (
          <div style={{display:'flex', gap:10, alignItems:'center'}}>
            <button className="btn-outline-gold">Staff</button>
          </div>
        )}
      </div>
    </header>
  );
}

export function RazorShieldIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="shieldGradIcon" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="50%" stopColor="#1D4ED8" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>
        <linearGradient id="coreGradIcon" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#60A5FA" />
        </linearGradient>
      </defs>
      
      {/* Outer Shield Frame */}
      <path d="M32 4 L54 12 C54 36 44 52 32 60 C20 52 10 36 10 12 Z" fill="url(#shieldGradIcon)" />
      
      {/* Inner Guard Lines */}
      <path d="M32 10 L48 16 C48 34 40 46 32 53 C24 46 16 34 16 16 Z" fill="#0F172A" opacity="0.35" />
      
      {/* AI Lightning Core */}
      <path d="M34 16 L22 32 L31 32 L28 48 L42 30 L33 30 Z" fill="url(#coreGradIcon)" />
      
      {/* Pulse Dot */}
      <circle cx="32" cy="11" r="2.5" fill="#34D399" />
    </svg>
  );
}

export function RazorShieldLogo({ variant = 'full', size = 36 }: { variant?: 'full' | 'compact' | 'icon'; size?: number }) {
  if (variant === 'icon') {
    return <RazorShieldIcon size={size} />;
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <RazorShieldIcon size={size} />
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', lineHeight: 1.1 }}>
          <span style={{ fontWeight: 800, fontSize: size > 32 ? '17px' : '15px', color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
            RazorShield
          </span>
          <span style={{
            fontSize: '10px', fontWeight: 800, color: '#fff',
            background: 'linear-gradient(135deg, #2563EB, #0284C7)',
            padding: '1px 5px', borderRadius: '4px', letterSpacing: '0.04em',
          }}>
            AI
          </span>
        </div>
        {variant === 'full' && (
          <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginTop: '2px' }}>
            Merchant Risk Operations
          </div>
        )}
      </div>
    </div>
  );
}

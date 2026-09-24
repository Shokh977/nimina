import { ImageResponse } from 'next/og';

export const alt = 'Promo Studio — turn app screenshots into promo videos';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(150deg, #1B1E26, #08090C)',
          color: '#E8EAF0',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 88,
            height: 88,
            borderRadius: 22,
            background: '#3346FF',
            marginBottom: 36,
          }}
        >
          <div style={{ width: 34, height: 34, borderRadius: 8, background: '#FFD23F' }} />
        </div>
        <div style={{ display: 'flex', fontSize: 64, fontWeight: 800, letterSpacing: -1.5 }}>Promo Studio</div>
        <div style={{ display: 'flex', marginTop: 18, fontSize: 28, color: '#9CA3B2' }}>Turn app screenshots into promo videos</div>
      </div>
    ),
    { ...size },
  );
}

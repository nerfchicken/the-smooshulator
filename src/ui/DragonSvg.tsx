import type { ReactElement } from 'react';

export type DragonMood = 'idle' | 'think' | 'wow' | 'ew' | 'sleepy';

const INK = '#10102a';
const BODY = '#8a5cff';
const BODY_DARK = '#5e36c9';
const BELLY = '#9dff3a';
const SPIKE = '#28f2ff';
const HORN = '#ffd93b';
const CHEEK = '#ff4fd8';
const stroke = { stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

/** Smoosh the Dragon — chunky cartoon mascot, 120x120 viewBox. Eyes/mouth change with `mood`. */
export function DragonSvg({ mood }: { mood: DragonMood }): ReactElement {
  const wow = mood === 'wow';
  const pupilDy = mood === 'think' ? -4 : 0;
  const pupilDx = mood === 'think' ? -2 : 0;
  const eyeR = wow ? 11 : 8.5;
  const pupilR = wow ? 5.5 : 3.8;

  return (
    <svg viewBox="0 0 120 120" width="120" height="120" role="img" aria-label={`Smoosh the dragon, feeling ${mood}`}>
      {/* wings (behind) */}
      <path d="M22 70 L4 48 L20 54 L14 36 L34 56 Z" fill={BODY_DARK} {...stroke} />
      <path d="M98 70 L116 48 L100 54 L106 36 L86 56 Z" fill={BODY_DARK} {...stroke} />
      {/* tail */}
      <path d="M90 96 C106 98 112 86 104 80 C100 90 92 88 92 86" fill={BODY} {...stroke} />
      <path d="M103 79 L112 72 L110 84 Z" fill={SPIKE} {...stroke} />
      {/* body */}
      <ellipse cx="60" cy="92" rx="34" ry="22" fill={BODY} {...stroke} />
      <ellipse cx="60" cy="96" rx="20" ry="13" fill={BELLY} stroke={INK} strokeWidth="2.5" />
      <path d="M48 96 H72 M50 102 H70" stroke="#5bb800" strokeWidth="2.5" strokeLinecap="round" />
      {/* feet */}
      <ellipse cx="38" cy="110" rx="10" ry="6" fill={BODY} {...stroke} />
      <ellipse cx="82" cy="110" rx="10" ry="6" fill={BODY} {...stroke} />
      {/* back spikes */}
      <path d="M30 46 L24 32 L40 40 Z M44 36 L44 20 L56 34 Z M64 34 L72 20 L76 36 Z M80 40 L94 32 L88 46 Z" fill={SPIKE} {...stroke} />
      {/* horns */}
      <path d="M34 42 L26 22 L44 36 Z" fill={HORN} {...stroke} />
      <path d="M86 42 L94 22 L76 36 Z" fill={HORN} {...stroke} />
      {/* head */}
      <rect x="22" y="30" width="76" height="56" rx="26" fill={BODY} {...stroke} />
      {/* snout */}
      <rect x="40" y="56" width="40" height="24" rx="12" fill="#a98bff" stroke={INK} strokeWidth="2.5" />
      <circle cx="52" cy="64" r="2.4" fill={INK} />
      <circle cx="68" cy="64" r="2.4" fill={INK} />
      {/* cheeks */}
      <circle cx="30" cy="62" r="5" fill={CHEEK} opacity="0.85" />
      <circle cx="90" cy="62" r="5" fill={CHEEK} opacity="0.85" />

      {/* eyes */}
      {mood === 'sleepy' ? (
        <>
          <path d="M36 50 Q44 56 52 50" fill="none" {...stroke} />
          <path d="M68 50 Q76 56 84 50" fill="none" {...stroke} />
          <text x="96" y="30" fontFamily="Nunito, system-ui, sans-serif" fontWeight="900" fontSize="14" fill={SPIKE} stroke={INK} strokeWidth="0.8">z</text>
          <text x="104" y="18" fontFamily="Nunito, system-ui, sans-serif" fontWeight="900" fontSize="18" fill={SPIKE} stroke={INK} strokeWidth="0.8">Z</text>
        </>
      ) : mood === 'ew' ? (
        <>
          <path d="M34 48 L50 52 M34 56 L50 52" fill="none" {...stroke} />
          <path d="M86 48 L70 52 M86 56 L70 52" fill="none" {...stroke} />
        </>
      ) : (
        <>
          <circle cx="44" cy="50" r={eyeR} fill="#ffffff" {...stroke} />
          <circle cx="76" cy="50" r={eyeR} fill="#ffffff" {...stroke} />
          <circle cx={44 + pupilDx} cy={50 + pupilDy} r={pupilR} fill={INK} />
          <circle cx={76 + pupilDx} cy={50 + pupilDy} r={pupilR} fill={INK} />
          <circle cx={46 + pupilDx} cy={48 + pupilDy} r="1.6" fill="#ffffff" />
          <circle cx={78 + pupilDx} cy={48 + pupilDy} r="1.6" fill="#ffffff" />
          {mood === 'idle' && (
            <>
              <rect className="blink" x={44 - eyeR - 1} y={50 - eyeR - 1} width={eyeR * 2 + 2} height={eyeR * 2 + 2} rx={eyeR} fill={BODY} />
              <rect className="blink" x={76 - eyeR - 1} y={50 - eyeR - 1} width={eyeR * 2 + 2} height={eyeR * 2 + 2} rx={eyeR} fill={BODY} />
            </>
          )}
        </>
      )}

      {/* mouth */}
      {mood === 'idle' && <path d="M50 73 Q60 80 70 73" fill="none" {...stroke} />}
      {mood === 'sleepy' && <path d="M54 75 Q60 78 66 75" fill="none" {...stroke} />}
      {mood === 'think' && <path d="M48 75 Q52 71 56 75 Q60 79 64 75 Q68 71 72 75" fill="none" {...stroke} />}
      {mood === 'ew' && (
        <>
          <path d="M50 76 Q60 70 70 76" fill="none" {...stroke} />
          <rect x="55" y="73" width="10" height="14" rx="5" fill={CHEEK} stroke={INK} strokeWidth="2.5" />
        </>
      )}
      {mood === 'wow' && (
        <>
          <ellipse cx="60" cy="75" rx="9" ry="7" fill={INK} />
          <ellipse cx="60" cy="79" rx="5" ry="3" fill={CHEEK} />
          <path d="M60 86 C54 92 56 100 60 104 C64 100 66 92 60 86 Z" fill="#ff8a3d" stroke={INK} strokeWidth="2" />
          <path d="M60 92 C58 95 59 99 60 101 C61 99 62 95 60 92 Z" fill={HORN} />
        </>
      )}
      {/* teeth */}
      {mood !== 'wow' && mood !== 'ew' && <path d="M54 73 L56 77 L58 73 M62 73 L64 77 L66 73" fill="#fff" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />}
    </svg>
  );
}

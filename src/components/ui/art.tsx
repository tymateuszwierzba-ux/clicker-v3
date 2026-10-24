import type { GlyphId, World, WorldPattern } from "@/lib/content";
import { AVATAR_GRADIENTS } from "@/lib/content";

export function Glyph({ glyph, tint, size = 56 }: { glyph: GlyphId; tint: string; size?: number }) {
  const soft = `${tint}22`;
  const common = { stroke: tint, strokeWidth: 1.6, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const shapes: Record<GlyphId, React.ReactNode> = {
    spark: <path d="M32 10 36 26 52 32 36 38 32 54 28 38 12 32 28 26Z" fill={tint} opacity={0.92} />,
    leaf: (
      <>
        <path d="M20 46C18 28 30 14 48 14c2 18-10 32-28 32Z" fill={tint} opacity={0.85} />
        <path d="M22 44c8-8 14-14 20-20" {...common} />
      </>
    ),
    wave: (
      <>
        <circle cx="32" cy="32" r="18" fill={soft} stroke={tint} strokeWidth={1.4} />
        <path d="M12 36c6-8 12-8 18 0s12 8 18 0" {...common} />
        <path d="M12 26c6-8 12-8 18 0s12 8 18 0" {...common} opacity={0.55} />
      </>
    ),
    shard: (
      <>
        <path d="M32 8 46 26 38 54 24 38Z" fill={tint} opacity={0.28} />
        <path d="M32 8 46 26 38 54 24 38Z" {...common} />
        <path d="M24 38 32 8" {...common} opacity={0.7} />
      </>
    ),
    crown: (
      <>
        <path d="M12 42 16 18 26 30 32 14 38 30 48 18 52 42Z" fill={soft} stroke={tint} strokeWidth={1.6} strokeLinejoin="round" />
        <circle cx="32" cy="35" r="3" fill={tint} />
      </>
    ),
    fang: (
      <>
        <path d="M18 18 32 52 46 18" {...common} strokeWidth={2} />
        <path d="M18 18 46 18" {...common} opacity={0.55} />
        <circle cx="32" cy="30" r="3" fill={tint} />
      </>
    ),
    wing: (
      <>
        <path d="M14 44C20 22 36 12 52 12c-2 18-14 30-38 32Z" fill={soft} stroke={tint} strokeWidth={1.6} />
        <path d="M20 40 48 16M24 42 46 26" {...common} opacity={0.6} />
      </>
    ),
    eye: (
      <>
        <ellipse cx="32" cy="32" rx="22" ry="14" fill={soft} stroke={tint} strokeWidth={1.5} />
        <circle cx="32" cy="32" r="6" fill={tint} />
        <circle cx="32" cy="32" r="10" {...common} opacity={0.5} />
      </>
    ),
    orb: (
      <>
        <circle cx="32" cy="32" r="17" fill={soft} stroke={tint} strokeWidth={1.5} />
        <circle cx="26" cy="26" r="5" fill={tint} opacity={0.7} />
        <path d="M14 40c8 6 28 6 36 0" {...common} opacity={0.45} />
      </>
    ),
    spire: (
      <>
        <path d="M32 6 42 46 32 58 22 46Z" fill={soft} stroke={tint} strokeWidth={1.6} />
        <path d="M32 6v40M22 46h20" {...common} opacity={0.65} />
      </>
    ),
    anvil: (
      <>
        <path d="M12 24h34c4 0 6 3 6 6 0 5-5 8-12 8H26l-4 12H14l4-14 2-6-8-2Z" fill={soft} stroke={tint} strokeWidth={1.5} />
        <path d="M18 50h22" {...common} />
      </>
    ),
    serpent: (
      <>
        <path d="M16 48c0-10 10-10 16-14s6-14-4-14c-6 0-8 4-8 4" {...common} strokeWidth={2} />
        <circle cx="20" cy="22" r="3" fill={tint} />
        <path d="M34 48h16" {...common} opacity={0.5} />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className="sigil-art" aria-hidden="true">
      {shapes[glyph] ?? shapes.orb}
    </svg>
  );
}

export function WorldPatternArt({ pattern, accent }: { pattern: WorldPattern; accent: string }) {
  const stroke = accent;
  const patterns: Record<WorldPattern, React.ReactNode> = {
    rays: (
      <g stroke={stroke} strokeWidth="0.7" opacity="0.5">
        {Array.from({ length: 22 }).map((_, i) => (
          <line key={i} x1="400" y1="360" x2={400 + Math.cos((i / 22) * Math.PI * 2) * 720} y2={360 + Math.sin((i / 22) * Math.PI * 2) * 720} />
        ))}
        <circle cx="400" cy="360" r="130" fill="none" />
        <circle cx="400" cy="360" r="220" fill="none" opacity="0.6" />
      </g>
    ),
    waves: (
      <g stroke={stroke} strokeWidth="1" fill="none" opacity="0.45">
        {Array.from({ length: 9 }).map((_, i) => (
          <path key={i} d={`M-50 ${60 + i * 46} C 120 ${10 + i * 46}, 260 ${120 + i * 46}, 420 ${60 + i * 46} S 700 ${10 + i * 46}, 860 ${70 + i * 46}`} />
        ))}
      </g>
    ),
    grid: (
      <g stroke={stroke} strokeWidth="0.8" opacity="0.4">
        {Array.from({ length: 16 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 56} y1="0" x2={i * 56} y2="400" />
        ))}
        {Array.from({ length: 8 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 54} x2="880" y2={i * 54} />
        ))}
        <circle cx="450" cy="200" r="150" fill={stroke} fillOpacity="0.05" />
      </g>
    ),
    shards: (
      <g stroke={stroke} strokeWidth="1" fill={stroke} fillOpacity="0.05" opacity="0.5">
        {Array.from({ length: 12 }).map((_, i) => (
          <polygon key={i} points={`${40 + i * 72},${90 + (i % 4) * 60} ${90 + i * 72},${40 + (i % 3) * 70} ${110 + i * 72},${120 + (i % 5) * 40}`} />
        ))}
      </g>
    ),
    frost: (
      <g stroke={stroke} strokeWidth="0.9" opacity="0.45">
        {Array.from({ length: 14 }).map((_, i) => {
          const x = 40 + i * 62;
          const y = 60 + (i % 3) * 110;
          return (
            <g key={i}>
              <line x1={x} y1={y - 34} x2={x} y2={y + 34} />
              <line x1={x - 30} y1={y - 18} x2={x + 30} y2={y + 18} />
              <line x1={x - 30} y1={y + 18} x2={x + 30} y2={y - 18} />
            </g>
          );
        })}
      </g>
    ),
    lava: (
      <g stroke={stroke} strokeWidth="1.4" fill="none" opacity="0.5">
        {Array.from({ length: 7 }).map((_, i) => (
          <path key={i} d={`M-20 ${40 + i * 56} Q 180 ${i % 2 ? 120 : -10} 380 ${70 + i * 50} T 900 ${40 + i * 52}`} />
        ))}
        <ellipse cx="450" cy="220" rx="210" ry="90" fill={stroke} fillOpacity="0.06" stroke="none" />
      </g>
    ),
    bolts: (
      <g stroke={stroke} strokeWidth="1.1" fill="none" opacity="0.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <path key={i} d={`M${60 + i * 110} 0 L${100 + i * 110} 110 L${60 + i * 110} 140 L${120 + i * 110} 300`} />
        ))}
      </g>
    ),
    bazaar: (
      <g stroke={stroke} strokeWidth="0.9" opacity="0.45">
        {Array.from({ length: 18 }).map((_, i) => (
          <circle key={i} cx={40 + (i % 9) * 100} cy={60 + Math.floor(i / 9) * 150} r={26 + (i % 4) * 10} fill="none" />
        ))}
        {Array.from({ length: 18 }).map((_, i) => (
          <circle key={`d${i}`} cx={40 + (i % 9) * 100} cy={60 + Math.floor(i / 9) * 150} r="3" fill={stroke} stroke="none" />
        ))}
      </g>
    ),
    rings: (
      <g stroke={stroke} strokeWidth="0.9" fill="none" opacity="0.4">
        {Array.from({ length: 12 }).map((_, i) => (
          <ellipse key={i} cx="450" cy="220" rx={70 + i * 34} ry={26 + i * 14} />
        ))}
      </g>
    ),
    mandala: (
      <g stroke={stroke} strokeWidth="0.9" fill="none" opacity="0.45">
        <circle cx="450" cy="210" r="90" />
        <circle cx="450" cy="210" r="140" />
        <circle cx="450" cy="210" r="192" />
        {Array.from({ length: 24 }).map((_, i) => (
          <line key={i} x1="450" y1="210" x2={450 + Math.cos((i / 24) * Math.PI * 2) * 210} y2={210 + Math.sin((i / 24) * Math.PI * 2) * 210} />
        ))}
      </g>
    ),
  };
  return (
    <svg className="world-pattern" viewBox="0 0 900 420" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {patterns[pattern]}
    </svg>
  );
}

export function WorldStage({ world, children, compact = false }: { world: World; children: React.ReactNode; compact?: boolean }) {
  return (
    <div
      className="world-stage rounded-[18px] border border-[var(--line)] overflow-hidden"
      style={
        {
          "--world-accent": world.accent,
          "--world-soft": world.accentSoft,
          "--world-bg-from": world.bgFrom,
          "--world-bg-to": world.bgTo,
        } as React.CSSProperties
      }
    >
      <WorldPatternArt pattern={world.pattern} accent={world.accent} />
      <div className={compact ? "relative p-4" : "relative p-5 sm:p-7"}>{children}</div>
    </div>
  );
}

export function Avatar({ color, name, size = 38 }: { color: string; name: string; size?: number }) {
  const gradient = AVATAR_GRADIENTS[color] ?? AVATAR_GRADIENTS.ember;
  return (
    <div
      className="avatar"
      aria-hidden="true"
      style={{ width: size, height: size, background: gradient, fontSize: Math.round(size * 0.42) }}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

export function SparkMark({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M12 2 14.6 9.2 22 12l-7.4 2.8L12 22l-2.6-7.2L2 12l7.4-2.8Z" fill={color} />
    </svg>
  );
}

export function PrismMark({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M12 2 21 9 12 22 3 9Z" fill={color} opacity="0.9" />
      <path d="M12 2 17 9 12 22 7 9Z" fill="#ffffff" opacity="0.28" />
    </svg>
  );
}

export function EmberMark({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M12 2c3 5 6 7 6 11a6 6 0 0 1-12 0c0-2 1-4 3-6 0 3 1 4 3 5 0-4-2-6 0-10Z" fill={color} />
    </svg>
  );
}

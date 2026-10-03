/**
 * MoleculeSVG — Inline SVG molecule cluster
 *
 * Renders a ball-and-stick molecule using radial-gradient "glass" spheres
 * and thin line bonds.  All CSS so Framer Motion can animate the group.
 */

const TEAL = '#2dd4bf'
const TEAL_DARK = '#0d4a42'
const TEAL_GLOW = '#5eead4'
const BOND_COLOR = '#3a7a72'

/**
 * Predefined molecule layouts.
 * Each atom: [cx, cy, r]
 * Each bond: [atomIdx1, atomIdx2]
 */
const LAYOUTS = {
  // Main hero molecule — 1 central + 5 radiating
  main: {
    atoms: [
      [120, 120, 22],  // center
      [50, 50, 14],    // top-left
      [190, 40, 12],   // top-right
      [200, 160, 15],  // right
      [140, 210, 13],  // bottom
      [40, 180, 11],   // bottom-left
    ],
    bonds: [[0,1],[0,2],[0,3],[0,4],[0,5]],
  },
  // Small cluster A — 4 atoms
  clusterA: {
    atoms: [
      [40, 40, 10],
      [80, 25, 7],
      [75, 70, 8],
      [25, 75, 6],
    ],
    bonds: [[0,1],[0,2],[0,3]],
  },
  // Small cluster B — 3 atoms
  clusterB: {
    atoms: [
      [30, 30, 9],
      [65, 20, 6],
      [50, 60, 7],
    ],
    bonds: [[0,1],[0,2],[1,2]],
  },
  // Small cluster C — 5 atoms
  clusterC: {
    atoms: [
      [50, 50, 11],
      [20, 20, 7],
      [90, 30, 8],
      [80, 80, 6],
      [30, 85, 7],
    ],
    bonds: [[0,1],[0,2],[0,3],[0,4]],
  },
}

function GlassSphere({ cx, cy, r }) {
  const id = `sphere-${cx}-${cy}-${r}`
  return (
    <g>
      <defs>
        <radialGradient id={id} cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#b0fff0" stopOpacity="0.9" />
          <stop offset="35%" stopColor={TEAL_GLOW} stopOpacity="0.7" />
          <stop offset="70%" stopColor={TEAL} stopOpacity="0.5" />
          <stop offset="100%" stopColor={TEAL_DARK} stopOpacity="0.8" />
        </radialGradient>
      </defs>
      {/* Glow behind */}
      <circle cx={cx} cy={cy} r={r * 1.6} fill={TEAL} opacity="0.08" />
      {/* Main sphere */}
      <circle cx={cx} cy={cy} r={r} fill={`url(#${id})`} />
      {/* Fresnel rim highlight */}
      <circle
        cx={cx - r * 0.25}
        cy={cy - r * 0.25}
        r={r * 0.35}
        fill="white"
        opacity="0.35"
      />
    </g>
  )
}

function Bond({ x1, y1, x2, y2 }) {
  return (
    <line
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={BOND_COLOR}
      strokeWidth="2.5"
      strokeLinecap="round"
      opacity="0.7"
    />
  )
}

export default function MoleculeSVG({ layout = 'main', className = '', style = {} }) {
  const mol = LAYOUTS[layout] || LAYOUTS.main
  // Determine viewBox from layout
  const viewSize = layout === 'main' ? 240 : 100

  return (
    <svg
      viewBox={`0 0 ${viewSize} ${viewSize}`}
      className={className}
      style={{ overflow: 'visible', ...style }}
      fill="none"
    >
      {/* Bonds first (behind atoms) */}
      {mol.bonds.map(([a, b], i) => (
        <Bond
          key={`bond-${i}`}
          x1={mol.atoms[a][0]} y1={mol.atoms[a][1]}
          x2={mol.atoms[b][0]} y2={mol.atoms[b][1]}
        />
      ))}
      {/* Atoms */}
      {mol.atoms.map(([cx, cy, r], i) => (
        <GlassSphere key={`atom-${i}`} cx={cx} cy={cy} r={r} />
      ))}
    </svg>
  )
}

/**
 * ROGVEDA Logo Component
 *
 * Uses the actual high-res logo image from the branding assets.
 * Supports multiple sizes for login page vs navbar usage.
 */

export default function Logo({ size = 'large', className = '' }) {
  const sizes = {
    small: { width: 140, height: 'auto' },
    medium: { width: '100%', maxWidth: 220, height: 'auto' },
    large: { width: '100%', maxWidth: 320, height: 'auto' },
  }

  const s = sizes[size] || sizes.large


  return (
    <div className={className}>
      <img
        src="/rogveda_logo.png"
        alt="ROGVEDA — Molecular Research Reimagined"
        style={{
          width: typeof s.width === 'number' ? `${s.width}px` : s.width,
          maxWidth: s.maxWidth ? `${s.maxWidth}px` : 'none',
          height: s.height,
          objectFit: 'contain',
          filter: 'drop-shadow(0 0 20px rgba(0, 212, 170, 0.15))',
        }}
        draggable={false}
      />
    </div>
  )
}

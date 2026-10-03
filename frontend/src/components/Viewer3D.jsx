import { useEffect, useRef } from 'react'

/**
 * Viewer3D — renders an SDF/MOL block as a 3D ball-and-stick model
 * using the self-hosted 3Dmol.js library.
 *
 * Props:
 *   sdfBlock  – string containing the SDF/MOL block with 3D coords
 *   height    – CSS height for the viewer container (default "450px")
 */
export default function Viewer3D({ sdfBlock, height = '450px', bgColor = '0x1a1a2e' }) {
  const containerRef = useRef(null)
  const viewerRef = useRef(null)

  useEffect(() => {
    if (viewerRef.current && bgColor) {
      viewerRef.current.setBackgroundColor(bgColor)
      viewerRef.current.render()
    }
  }, [bgColor])

  useEffect(() => {
    if (!sdfBlock || !containerRef.current || !window.$3Dmol) return

    // Clean up previous viewer
    if (viewerRef.current) {
      viewerRef.current.clear()
    }

    const viewer = window.$3Dmol.createViewer(containerRef.current, {
      backgroundColor: bgColor,  // match dark theme
    })
    viewerRef.current = viewer

    // Expose a global helper so AnalysisTab can capture the 3D view as PNG
    window.__viewer3d_pngURI = () => {
      if (viewerRef.current) {
        // Force a render to ensure the buffer has the latest frame
        viewerRef.current.render()
        return viewerRef.current.pngURI()
      }
      return null
    }

    // Add the SDF model
    viewer.addModel(sdfBlock, 'sdf')

    // Style: ball and stick
    viewer.setStyle({}, {
      stick: { radius: 0.12, colorscheme: 'Jmol' },
      sphere: { scale: 0.25, colorscheme: 'Jmol' },
    })

    // Fit the camera and render
    viewer.zoomTo()
    viewer.render()

    // Enable spin animation for visual appeal
    viewer.spin('y', 0.5)

    // Listen for fit-to-screen events
    const handleFit = () => {
      if (viewerRef.current) {
        viewerRef.current.zoomTo()
        viewerRef.current.render()
      }
    }
    window.addEventListener('viewer3d-fit', handleFit)

    return () => {
      window.removeEventListener('viewer3d-fit', handleFit)
      delete window.__viewer3d_pngURI
      if (viewerRef.current) {
        viewerRef.current.clear()
        viewerRef.current = null
      }
    }
  }, [sdfBlock])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height,
        position: 'relative',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    />
  )
}

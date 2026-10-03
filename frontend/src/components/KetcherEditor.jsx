import { forwardRef, useImperativeHandle, useRef, useState, useEffect } from 'react'

const KetcherEditor = forwardRef(({ theme = 'light', onLoad }, ref) => {
  const iframeRef = useRef(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const styleRef = useRef(null)

  const getThemeCSS = (t) => {
    if (t === 'light') {
      return `
        /* Light theme — keep Ketcher mostly default, just clean up fullscreen */
        button[title*="Full Screen"],
        button[title*="fullscreen"],
        div[class*="Fullscreen"] { display: none !important; }
      `
    }
    return `
      /* ── ROGVEDA Dark Theme Override for Ketcher ── */
      body, #root, div[class*="App-module"], div[class*="Editor-module"] {
        background: #0d1a1c !important;
      }
      div[class*="canvas-wrapper"], div[class*="Canvas-module"] {
        background: #0d1a1c !important;
      }
      /* Invert the drawing itself so black lines become white, but keep original hues for colored atoms */
      svg { filter: none !important; }
      div[class*="canvas" i] svg, 
      div[class*="Canvas" i] svg,
      .ketcher-canvas svg,
      div[class*="wrapper" i] > svg,
      svg:not(button svg):not(div[class*="Toolbar" i] svg):not(div[class*="toolbar" i] svg) { 
        background: transparent !important; 
        filter: invert(0.85) hue-rotate(180deg) brightness(1.2) !important;
      }
      div[class*="LeftToolbar"], aside[class*="LeftToolbar"] {
        background: #050b0d !important;
        border-right: 1px solid rgba(45,212,212,0.15) !important;
      }
      div[class*="RightToolbar"], aside[class*="RightToolbar"] {
        background: #050b0d !important;
        border-left: 1px solid rgba(45,212,212,0.15) !important;
      }
      header, div[class*="TopToolbar"], div[class*="top-toolbar"], .ketcher-top-toolbar {
        background: #050b0d !important;
        border-bottom: 1px solid rgba(45,212,212,0.15) !important;
      }
      div[class*="BottomToolbar"], footer {
        background: #050b0d !important;
        border-top: 1px solid rgba(45,212,212,0.15) !important;
      }
      button { color: #94a3b8 !important; }
      button:hover { background: rgba(45,212,212,0.1) !important; color: #2dd4d4 !important; }
      button[class*="active"], button[class*="selected"], button[aria-pressed="true"] {
        background: rgba(45,212,212,0.15) !important; color: #2dd4d4 !important;
      }
      button svg path, button svg line, button svg circle, button svg rect,
      button svg polyline, button svg polygon, button svg ellipse { stroke: currentColor !important; }
      button svg [fill]:not([fill="none"]) { fill: currentColor !important; }
      select, div[class*="dropdown"] {
        background: #0d1a1c !important; color: #94a3b8 !important; border-color: rgba(45,212,212,0.15) !important;
      }
      span, label { color: #94a3b8 !important; }
      div[class*="separator"], div[class*="divider"], hr {
        background: rgba(45,212,212,0.1) !important; border-color: rgba(45,212,212,0.1) !important;
      }
      ::-webkit-scrollbar { width: 6px; }
      ::-webkit-scrollbar-track { background: #050b0d; }
      ::-webkit-scrollbar-thumb { background: rgba(45,212,212,0.2); border-radius: 3px; }
      button[title*="Full Screen"], button[title*="fullscreen"], div[class*="Fullscreen"] { display: none !important; }
      div[class*="zoom"] { color: #94a3b8 !important; }
      div[class*="Modal"], div[class*="modal"], div[class*="Dialog"], div[class*="dialog"] {
        background: #0d1a1c !important; border: 1px solid rgba(45,212,212,0.2) !important; color: #e2e8f0 !important;
      }
      input, textarea {
        background: #081214 !important; color: #e2e8f0 !important; border-color: rgba(45,212,212,0.15) !important;
      }
      input:focus, textarea:focus { border-color: #2dd4d4 !important; }
    `
  }

  const applyTheme = (t) => {
    try {
      const doc = iframeRef.current?.contentDocument
      if (doc && doc.head) {
        let style = doc.getElementById('rogveda-theme')
        if (!style) {
          style = doc.createElement('style')
          style.id = 'rogveda-theme'
          doc.head.appendChild(style)
        }
        style.textContent = getThemeCSS(t)
        styleRef.current = style
      }
    } catch(e) {
      console.warn("Could not inject Ketcher CSS theme:", e)
    }
  }

  const handleLoad = () => {
    setIsLoaded(true)
    applyTheme(theme)
    if (onLoad) onLoad()
  }

  // Update theme dynamically when prop changes
  useEffect(() => {
    if (!isLoaded || !iframeRef.current) return
    applyTheme(theme)
  }, [theme, isLoaded])

  const getKetcher = () => {
    if (!isLoaded || !iframeRef.current) return null
    return iframeRef.current.contentWindow.ketcher || null
  }

  useImperativeHandle(ref, () => ({
    getMolfile: async () => {
      const ketcher = getKetcher()
      if (!ketcher) throw new Error("Ketcher editor is not fully loaded yet.")
      return await ketcher.getMolfile()
    },
    setMolecule: async (struct) => {
      const ketcher = getKetcher()
      if (ketcher) await ketcher.setMolecule(struct)
    },
    getKetcherInstance: () => getKetcher(),
    forceResize: () => {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.dispatchEvent(new Event('resize'))
      }
    },
  }))

  return (
    <div className="w-full h-full overflow-hidden relative" style={{ background: theme === 'dark' ? '#0d1a1c' : '#ffffff' }}>
      {!isLoaded && (
        <div className="w-full h-full flex items-center justify-center" style={{ color: '#2dd4d4' }}>
          Loading Ketcher Editor...
        </div>
      )}
      <iframe
        ref={iframeRef}
        src="/ketcher/index.html"
        title="Ketcher Editor"
        className="w-full h-full border-none"
        onLoad={handleLoad}
        style={{ display: isLoaded ? 'block' : 'none' }}
        allow=""
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      />
    </div>
  )
})

KetcherEditor.displayName = 'KetcherEditor'
export default KetcherEditor

import React, { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, PerspectiveCamera, BakeShadows } from '@react-three/drei'
import * as THREE from 'three'
import Molecule from './Molecule.jsx'
import ParticleDust from './ParticleDust.jsx'

// A complex dummy molecule structure
const DUMMY_MOLECULE = {
  atoms: [
    { position: [0, 0, 0], radius: 0.3 },
    { position: [1.2, 0.8, 0.5], radius: 0.2 },
    { position: [-1.0, 1.0, -0.3], radius: 0.2 },
    { position: [0, -1.2, 0.6], radius: 0.2 },
    { position: [0.5, -0.8, -1.0], radius: 0.2 },
    { position: [2.0, 1.2, 0.8], radius: 0.15 },
    { position: [-1.8, 1.5, -0.8], radius: 0.15 },
    { position: [0.8, -2.0, 1.2], radius: 0.15 },
    { position: [-0.8, -1.8, 0.2], radius: 0.15 },
    { position: [1.5, -1.5, -1.2], radius: 0.15 },
  ],
  bonds: [
    { start: 0, end: 1 },
    { start: 0, end: 2 },
    { start: 0, end: 3 },
    { start: 0, end: 4 },
    { start: 1, end: 5 },
    { start: 2, end: 6 },
    { start: 3, end: 7 },
    { start: 3, end: 8 },
    { start: 4, end: 9 },
  ]
}

function SceneContents({ mouseRef }) {
  const foregroundRef = useRef()
  
  // Apply parallax to the main foreground molecule based on mouse movement
  useFrame((state, delta) => {
    if (foregroundRef.current && mouseRef?.current) {
      // Smooth interpolation for parallax using delta time for consistent speed
      const targetX = -4 + (mouseRef.current.x * 0.5) // Base position X is -4 (left side)
      const targetY = (mouseRef.current.y * 0.5)
      
      // MathUtils.lerp needs delta adjustment for true frame independence, but simple lerp works for this dampening
      foregroundRef.current.position.x = THREE.MathUtils.lerp(foregroundRef.current.position.x, targetX, delta * 3)
      foregroundRef.current.position.y = THREE.MathUtils.lerp(foregroundRef.current.position.y, targetY, delta * 3)
    }
  })

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 10]} fov={45} />
      
      {/* Lighting */}
      <ambientLight intensity={0.2} />
      <directionalLight position={[10, 10, 5]} intensity={1.5} color="#00e5ff" />
      <directionalLight position={[-10, -10, -5]} intensity={0.5} color="#00d4aa" />
      <pointLight position={[0, 0, 0]} intensity={0.8} color="#0ff1ce" distance={10} />
      
      {/* Environment for glossy reflections */}
      <Environment preset="city" />
      
      {/* Bokeh particle dust */}
      <ParticleDust count={300} />

      {/* Background Molecules (Depth of Field effect through positioning/scaling) */}
      <Molecule 
        atoms={DUMMY_MOLECULE.atoms} 
        bonds={DUMMY_MOLECULE.bonds} 
        position={[-8, 4, -8]} 
        scale={0.5} 
        color="#0a3c3f"
        floatIntensity={3}
      />
      <Molecule 
        atoms={DUMMY_MOLECULE.atoms} 
        bonds={DUMMY_MOLECULE.bonds} 
        position={[2, -6, -15]} 
        scale={0.8} 
        color="#0d6666"
        floatSpeed={1}
      />
      <Molecule 
        atoms={DUMMY_MOLECULE.atoms} 
        bonds={DUMMY_MOLECULE.bonds} 
        position={[-10, -5, -12]} 
        scale={0.6} 
        color="#0a3c3f"
        rotationSpeed={0.01}
      />
      <Molecule 
        atoms={DUMMY_MOLECULE.atoms} 
        bonds={DUMMY_MOLECULE.bonds} 
        position={[0, 8, -10]} 
        scale={0.4} 
        color="#0a3c3f"
      />

      {/* Main Foreground Molecule Cluster on the left side */}
      <group ref={foregroundRef} position={[-4, 0, 0]}>
        <Molecule 
          atoms={DUMMY_MOLECULE.atoms} 
          bonds={DUMMY_MOLECULE.bonds} 
          position={[0, 0, 0]} 
          scale={2.2} 
          color="#13e0cb"
          floatIntensity={1}
          rotationSpeed={0.003}
        />
      </group>

      <BakeShadows />
    </>
  )
}

export default function MoleculeScene({ mouseRef }) {
  return (
    <div className="absolute inset-0 z-0 bg-[#050B0E]">
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, alpha: false }}>
        <fog attach="fog" args={['#050B0E', 5, 25]} />
        <SceneContents mouseRef={mouseRef} />
      </Canvas>
    </div>
  )
}

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function ParticleDust({ count = 300 }) {
  const mesh = useRef()

  const dummy = useMemo(() => new THREE.Object3D(), [])

  // Generate random positions, speeds, and colors
  const particles = useMemo(() => {
    const temp = []
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 40
      const y = (Math.random() - 0.5) * 40
      const z = (Math.random() - 0.5) * 40
      // Speeds and phases for animation
      const factor = 0.5 + Math.random() * 1.5
      const speed = 0.05 + Math.random() * 0.1
      const xFactor = -0.5 + Math.random()
      const yFactor = -0.5 + Math.random()
      const zFactor = -0.5 + Math.random()
      
      // Randomly assign teal, gold, or white
      const colorType = Math.random()
      let color = new THREE.Color()
      if (colorType > 0.8) {
        color.set('#c8a032') // Gold
      } else if (colorType > 0.4) {
        color.set('#00d4aa') // Teal
      } else {
        color.set('#e8f0f0') // White
      }

      temp.push({ t: Math.random() * 100, factor, speed, xFactor, yFactor, zFactor, x, y, z, color })
    }
    return temp
  }, [count])

  // Create color array for the instanced mesh
  const colorArray = useMemo(() => {
    const arr = new Float32Array(count * 3)
    particles.forEach((p, i) => {
      p.color.toArray(arr, i * 3)
    })
    return arr
  }, [particles, count])

  useFrame((state, delta) => {
    particles.forEach((particle, i) => {
      let { t, factor, speed, xFactor, yFactor, zFactor, x, y, z } = particle
      // Update time using delta for consistent speed regardless of framerate
      t = particle.t += speed * delta * 30
      // Calculate smooth floating motion using sin/cos
      const a = Math.cos(t) + Math.sin(t * 1) / 10
      const b = Math.sin(t) + Math.cos(t * 2) / 10
      const s = Math.cos(t)

      dummy.position.set(
        x + a * xFactor,
        y + b * yFactor,
        z + s * zFactor
      )
      
      dummy.scale.set(factor, factor, factor)
      dummy.updateMatrix()
      
      mesh.current.setMatrixAt(i, dummy.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[null, null, count]}>
      <sphereGeometry args={[0.02, 8, 8]}>
        <instancedBufferAttribute attach="attributes-color" args={[colorArray, 3]} />
      </sphereGeometry>
      <meshBasicMaterial vertexColors toneMapped={false} transparent opacity={0.6} />
    </instancedMesh>
  )
}

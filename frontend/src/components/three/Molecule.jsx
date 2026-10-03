import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sphere, Cylinder, Float, MeshTransmissionMaterial } from '@react-three/drei'
import * as THREE from 'three'

export default function Molecule({ 
  atoms = [], 
  bonds = [], 
  scale = 1, 
  position = [0, 0, 0], 
  rotationSpeed = 0.005,
  floatIntensity = 2,
  floatSpeed = 1.5,
  color = '#00e5ff' 
}) {
  const group = useRef()

  // Slowly rotate the entire molecule
  useFrame(() => {
    if (group.current) {
      group.current.rotation.y += rotationSpeed
      group.current.rotation.x += rotationSpeed * 0.5
    }
  })

  // Material for the glassy/metallic atoms - optimized
  const atomMaterial = (
    <meshStandardMaterial 
      color={color} 
      metalness={0.8} 
      roughness={0.1} 
      envMapIntensity={1.0}
    />
  )

  // Material for the metallic bonds
  const bondMaterial = (
    <meshStandardMaterial 
      color={color} 
      metalness={0.8} 
      roughness={0.2} 
      envMapIntensity={1.0}
    />
  )

  return (
    <Float 
      speed={floatSpeed} 
      rotationIntensity={floatIntensity} 
      floatIntensity={floatIntensity * 2}
    >
      <group ref={group} position={position} scale={scale}>
        {/* Render Atoms */}
        {atoms.map((atom, index) => (
          <Sphere key={`atom-${index}`} args={[atom.radius, 24, 24]} position={atom.position}>
            {atomMaterial}
          </Sphere>
        ))}

        {/* Render Bonds */}
        {bonds.map((bond, index) => {
          const start = new THREE.Vector3(...atoms[bond.start].position)
          const end = new THREE.Vector3(...atoms[bond.end].position)
          
          const distance = start.distanceTo(end)
          // Position is halfway between start and end
          const position = start.clone().lerp(end, 0.5)
          
          // Calculate rotation to point from start to end
          const orientation = new THREE.Matrix4()
          orientation.lookAt(start, end, new THREE.Object3D().up)
          const euler = new THREE.Euler().setFromRotationMatrix(orientation)
          // Cylinder is oriented along Y by default, so we rotate X by PI/2
          euler.x += Math.PI / 2

          return (
            <mesh key={`bond-${index}`} position={position} rotation={euler}>
              <cylinderGeometry args={[0.1, 0.1, distance, 12]} />
              {bondMaterial}
            </mesh>
          )
        })}
      </group>
    </Float>
  )
}

export function computeProperties(rdkit, smiles) {
  if (!rdkit || !smiles) return null
  let mol = null
  try {
    mol = rdkit.get_mol(smiles)
    if (!mol || !mol.is_valid()) return null

    const descStr = mol.get_descriptors()
    if (!descStr) return null
    const desc = JSON.parse(descStr)
    let formula = desc.MolFormula || desc.Formula || null
    if (!formula) {
      try {
        // Add explicit hydrogens so we can count them
        const molBlockWithHs = mol.add_hs()
        const molBlock = molBlockWithHs || mol.get_molblock()
        
        const lines = molBlock.split('\n')
        const countLine = lines[3]
        const parts = countLine.trim().split(/\s+/)
        const numAtoms = parseInt(parts[0])
        const atomMap = {}
        for (let i = 0; i < numAtoms; i++) {
          const atomLine = lines[4 + i]
          if (atomLine) {
            const atomParts = atomLine.trim().split(/\s+/)
            const symbol = atomParts[3]
            if (symbol) atomMap[symbol] = (atomMap[symbol] || 0) + 1
          }
        }
        if (Object.keys(atomMap).length > 0) {
          const sortedKeys = Object.keys(atomMap).sort((a, b) => {
            if (a === 'C') return -1; if (b === 'C') return 1
            if (a === 'H') return -1; if (b === 'H') return 1
            return a.localeCompare(b)
          })
          formula = sortedKeys.map(k => k + (atomMap[k] > 1 ? atomMap[k] : '')).join('')
        }
      } catch (e) {
        console.error("Error computing formula fallback:", e)
      }
    }

    const mw = desc.amw ?? desc.exactmw ?? desc.MolWt ?? null
    const exactMass = desc.exactmw ?? desc.exactMass ?? null
    const logP = desc.CrippenClogP ?? desc.clogp ?? desc.MolLogP ?? null
    const tpsa = desc.tpsa ?? desc.TPSA ?? desc.LabuteASA ?? null
    const hbd = desc.NumHBD ?? desc.lipinskiHBD ?? desc.NumHDonors ?? null
    const hba = desc.NumHBA ?? desc.lipinskiHBA ?? desc.NumHAcceptors ?? null
    const rotBonds = desc.NumRotatableBonds ?? desc.numRotatableBonds ?? null
    const aromaticRings = desc.NumAromaticRings ?? desc.numAromaticRings ?? null
    const heavyAtoms = desc.NumHeavyAtoms ?? desc.numHeavyAtoms ?? null
    const fractionCsp3 = desc.FractionCSP3 ?? desc.fractionCsp3 ?? null
    const totalRings = desc.NumRings ?? desc.numRings ?? null
    const heteroAtoms = desc.NumHeteroatoms ?? desc.numHeteroatoms ?? null
    const molarRefractivity = desc.CrippenMR ?? desc.molarRefractivity ?? null
    const chiralCenters = desc.NumAtomStereoCenters ?? desc.numAtomStereoCenters ?? null
    const amideBonds = desc.NumAmideBonds ?? desc.numAmideBonds ?? null
    const saturatedRings = desc.NumSaturatedRings ?? desc.numSaturatedRings ?? null

    return {
      formula: formula || '-',
      mw: mw !== null ? mw.toFixed(2) : '-',
      exactMass: exactMass !== null ? exactMass.toFixed(4) : '-',
      logP: logP !== null ? logP.toFixed(2) : '-',
      tpsa: tpsa !== null ? tpsa.toFixed(2) : '-',
      hbd: hbd !== null ? String(hbd) : '-',
      hba: hba !== null ? String(hba) : '-',
      rotBonds: rotBonds !== null ? String(rotBonds) : '-',
      aromaticRings: aromaticRings !== null ? String(aromaticRings) : '-',
      heavyAtoms: heavyAtoms !== null ? String(heavyAtoms) : '-',
      fractionCsp3: fractionCsp3 !== null ? fractionCsp3.toFixed(2) : '-',
      totalRings: totalRings !== null ? String(totalRings) : '-',
      heteroAtoms: heteroAtoms !== null ? String(heteroAtoms) : '-',
      molarRefractivity: molarRefractivity !== null ? molarRefractivity.toFixed(2) : '-',
      chiralCenters: chiralCenters !== null ? String(chiralCenters) : '-',
      amideBonds: amideBonds !== null ? String(amideBonds) : '-',
      saturatedRings: saturatedRings !== null ? String(saturatedRings) : '-',
    }
  } catch (e) {
    return null
  } finally {
    if (mol) mol.delete()
  }
}

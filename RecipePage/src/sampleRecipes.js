// Sample container payload, kept for manual testing only.
//
// Reproduces exactly what TIA delivers to CreateCards: a numbered-key object
// rather than an array, ids and plant ids as strings, is_active as "0"/"1", and
// timestamps as [seconds, nanoseconds] tuples. Useful precisely because every
// one of those differs from the shape templateRecipes uses, so rendering this
// exercises the whole normalization path.
//
// Trimmed to 12 rows; the real payload runs to several hundred and the extras
// prove nothing the first dozen do not.
export const sampleRecipePayload = {
  "0": { code: 'RC-1001', created_at: [1775052408, 760000000], description: 'Self-Compacting Concrete production mix recipe', id: '1', is_active: '0', name: 'Self-Compacting Concrete', plant_id: '6', updated_at: [1777426908, 760000000] },
  "1": { code: 'RC-1002', created_at: [1743689208, 760000000], description: 'Standard Concrete production mix recipe', id: '2', is_active: '0', name: 'Standard Concrete', plant_id: '10', updated_at: [1744428708, 760000000] },
  "2": { code: 'RC-1003', created_at: [1773842808, 760000000], description: 'Waterproof Concrete production mix recipe', id: '3', is_active: '0', name: 'Waterproof Concrete', plant_id: '5', updated_at: [1775313828, 760000000] },
  "3": { code: 'RC-1004', created_at: [1732111608, 760000000], description: 'Pump Concrete production mix recipe', id: '4', is_active: '1', name: 'Pump Concrete', plant_id: '9', updated_at: [1734401328, 760000000] },
  "4": { code: 'RC-1005', created_at: [1729001208, 760000000], description: 'Pump Concrete production mix recipe', id: '5', is_active: '1', name: 'Pump Concrete', plant_id: '2', updated_at: [1730118468, 760000000] },
  "5": { code: 'RC-1006', created_at: [1783692408, 760000000], description: 'Waterproof Concrete production mix recipe', id: '6', is_active: '0', name: 'Waterproof Concrete', plant_id: '10', updated_at: [1785621108, 760000000] },
  "6": { code: 'RC-1007', created_at: [1755785208, 760000000], description: 'Waterproof Concrete production mix recipe', id: '7', is_active: '1', name: 'Waterproof Concrete', plant_id: '1', updated_at: [1758178308, 760000000] },
  "7": { code: 'RC-1008', created_at: [1733148408, 760000000], description: 'High Strength Concrete production mix recipe', id: '8', is_active: '0', name: 'High Strength Concrete', plant_id: '6', updated_at: [1734276048, 760000000] },
  "8": { code: 'RC-1009', created_at: [1749910008, 760000000], description: 'Lean Concrete production mix recipe', id: '9', is_active: '1', name: 'Lean Concrete', plant_id: '2', updated_at: [1751545488, 760000000] },
  "9": { code: 'RC-1010', created_at: [1771682808, 760000000], description: 'Standard Concrete production mix recipe', id: '10', is_active: '0', name: 'Standard Concrete', plant_id: '7', updated_at: [1772391768, 760000000] },
  "10": { code: 'RC-1011', created_at: [1774361208, 760000000], description: 'Waterproof Concrete production mix recipe', id: '11', is_active: '0', name: 'Waterproof Concrete', plant_id: '10', updated_at: [1776286128, 760000000] },
  "11": { code: 'RC-1012', created_at: [1772546808, 760000000], description: 'Fiber Reinforced Concrete production mix recipe', id: '12', is_active: '1', name: 'Fiber Reinforced Concrete', plant_id: '10', updated_at: [1772628528, 760000000] },
}


/**
 * Push the sample payload through the real CreateCards entry point.
 *
 * Deliberately routed through the bridge rather than handed straight to React,
 * so the numbered-key conversion and validation are exercised the same way a
 * container call would exercise them. Call it from the devtools console:
 *
 *   injectSampleRecipes()
 */
export function injectSampleRecipes(payload = sampleRecipePayload) {
  const bridge = window.RecipeBridge
  if (!bridge || typeof bridge.createCards !== 'function') {
    console.warn('[RecipePage] bridge not ready; cannot inject sample data')
    return false
  }
  // Reports acceptance, so a rejected payload is visible in the console rather
  // than looking like a no-op.
  return bridge.createCards(payload)
}

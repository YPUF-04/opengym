// "My equipment" for the Daily screen: the catalogue's equipment values under plain names, in a
// few groups, saved as one equipment profile (S.equipProfiles, id MY_ID) that is switched on as
// the active filter. So once you tick what you own, the suggestions, the exercise library, the
// picker and a starter plan fitted to it (sheets.jsx loadStarterPlan) all follow it.
//
// One tile can stand for several catalogue values ("Barbell" is barbell and olympic barbell):
// it reads as ticked when all of them are in the profile, and ticking it adds them all.
import { ACC_V, profileEquipment } from './equipment.js'

export const MY_ID = 'gearly-mine'

export const GEAR = [
  { group: 'Basics', items: [
    { key: 'dumbbell', label: 'Dumbbells', icon: 'dumbbell', eq: ['dumbbell'] },
    { key: 'bench', label: 'Bench', icon: 'layout', eq: ['bench'] },
    { key: 'pullup', label: 'Pull-up bar', icon: 'pullup', eq: ['pull-up bar'] },
    { key: 'band', label: 'Resistance bands', icon: 'repeat', eq: ['band', 'resistance band'] },
    { key: 'kettlebell', label: 'Kettlebell', icon: 'kettlebell', eq: ['kettlebell'] },
    { key: 'weighted', label: 'Weight vest or belt', icon: 'shield', eq: ['weighted'] },
  ] },
  { group: 'Bars and plates', items: [
    { key: 'barbell', label: 'Barbell', icon: 'barbell', eq: ['barbell', 'olympic barbell'] },
    { key: 'plate', label: 'Weight plates', icon: 'plate', eq: ['weight plate'] },
    { key: 'ez', label: 'EZ curl bar', icon: 'barbell', eq: ['ez barbell'] },
    { key: 'trap', label: 'Trap bar', icon: 'barbell', eq: ['trap bar'] },
    { key: 'landmine', label: 'Landmine', icon: 'barbell', eq: ['landmine'] },
  ] },
  { group: 'Gym machines', items: [
    { key: 'cable', label: 'Cable station', icon: 'machine', eq: ['cable', 'rope'] },
    { key: 'machine', label: 'Weight machines', icon: 'machine', eq: ['leverage machine'] },
    { key: 'smith', label: 'Smith machine', icon: 'machine', eq: ['smith machine'] },
    { key: 'sled', label: 'Leg press or sled', icon: 'machine', eq: ['sled machine'] },
    { key: 'assisted', label: 'Assisted pull-up machine', icon: 'machine', eq: ['assisted'] },
    { key: 'cardio', label: 'Cardio machines', icon: 'bike', eq: ['stationary bike', 'elliptical machine', 'stepmill machine', 'skierg machine', 'upper body ergometer'] },
  ] },
  { group: 'Other', items: [
    { key: 'trx', label: 'Suspension trainer (TRX)', icon: 'link', eq: ['suspension trainer'] },
    { key: 'ball', label: 'Exercise ball', icon: 'dot', eq: ['stability ball'] },
    { key: 'medball', label: 'Medicine ball', icon: 'dot', eq: ['medicine ball'] },
    { key: 'roller', label: 'Foam roller', icon: 'stretch', eq: ['roller', 'massage ball'] },
    { key: 'wheel', label: 'Ab wheel', icon: 'abs', eq: ['wheel roller'] },
    { key: 'bosu', label: 'Bosu ball', icon: 'dot', eq: ['bosu ball'] },
    { key: 'sandbag', label: 'Sandbag', icon: 'dot', eq: ['sandbag'] },
  ] },
]
export const GEAR_ITEMS = GEAR.flatMap(g => g.items)

// Starting points; a tap on a tile changes it from there.
export const PRESETS = [
  { key: 'none', label: 'Nothing, body weight only', items: [] },
  { key: 'home', label: 'Home: dumbbells and a bench', items: ['dumbbell', 'bench', 'pullup', 'band'] },
  { key: 'homebar', label: 'Home gym: barbell, rack and bench', items: ['dumbbell', 'bench', 'pullup', 'band', 'barbell', 'plate', 'ez'] },
  { key: 'gym', label: 'Full gym', items: GEAR_ITEMS.map(i => i.key) },
]

export const myProfile = S => (Array.isArray(S?.equipProfiles) ? S.equipProfiles.find(p => p && p.id === MY_ID) : null) || null

/** Whether a tile is ticked in the profile. */
export function gearOn(profile, item) {
  if (!profile) return false
  const have = profileEquipment(profile)
  return item.eq.every(e => have.includes(e))
}

/** The profile's equipment list with `item` switched on or off. */
export function withItem(equipment, item, on) {
  const have = new Set(Array.isArray(equipment) ? equipment : [])
  for (const e of item.eq) on ? have.add(e) : have.delete(e)
  return [...have]
}

/** The equipment list a preset stands for. */
export function presetEquipment(preset) {
  return [...new Set(preset.items.flatMap(k => GEAR_ITEMS.find(i => i.key === k)?.eq || []))]
}

/**
 * Applies `equipment` to the state copy `s` in place: writes (or creates) the Gearly profile and
 * makes it the active filter, so everything that filters by equipment follows it.
 */
export function saveMyEquipment(s, equipment, name) {
  const list = Array.isArray(s.equipProfiles) ? [...s.equipProfiles] : []
  const i = list.findIndex(p => p && p.id === MY_ID)
  const prof = { ...(i >= 0 ? list[i] : { id: MY_ID, name }), equipment: [...equipment], accV: ACC_V }
  if (i >= 0) list[i] = prof; else list.push(prof)
  s.equipProfiles = list
  s.activeEquipId = MY_ID
  s.equipFilterOn = true
  return s
}

/** How many tiles are ticked. */
export const gearCount = profile => GEAR_ITEMS.filter(i => gearOn(profile, i)).length

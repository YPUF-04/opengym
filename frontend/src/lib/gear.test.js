import { describe, it, expect } from 'vitest'
import { GEAR_ITEMS, PRESETS, MY_ID, myProfile, gearOn, withItem, presetEquipment, saveMyEquipment, gearCount } from './gear.js'
import { ALL_EQUIPMENT, ACC_V, exAvailable } from './equipment.js'

const item = k => GEAR_ITEMS.find(i => i.key === k)

describe('my equipment', () => {
  it('every tile names real equipment values', () => {
    for (const i of GEAR_ITEMS) for (const e of i.eq) expect(ALL_EQUIPMENT, i.key + ' ' + e).toContain(e)
  })
  it('a tile with several values is ticked only when all are there, and adds them all', () => {
    const eq = withItem([], item('barbell'), true)
    expect(eq.sort()).toEqual(['barbell', 'olympic barbell'])
    expect(gearOn({ equipment: ['barbell'], accV: ACC_V }, item('barbell'))).toBe(false)
    expect(gearOn({ equipment: eq, accV: ACC_V }, item('barbell'))).toBe(true)
    expect(withItem(eq, item('barbell'), false)).toEqual([])
  })
  it('presets expand to equipment', () => {
    const home = presetEquipment(PRESETS.find(p => p.key === 'home'))
    expect(home).toContain('bench')
    expect(home).toContain('pull-up bar')
    expect(presetEquipment(PRESETS[0])).toEqual([])
  })
  it('saving creates the profile once, updates it after, and turns the filter on', () => {
    const s = { equipProfiles: [{ id: 'x', name: 'Gym', equipment: ['cable'] }] }
    saveMyEquipment(s, ['dumbbell'], 'My equipment')
    saveMyEquipment(s, ['dumbbell', 'bench'], 'ignored')
    expect(s.equipProfiles.length).toBe(2)
    expect(myProfile(s)).toEqual({ id: MY_ID, name: 'My equipment', equipment: ['dumbbell', 'bench'], accV: ACC_V })
    expect(s.activeEquipId).toBe(MY_ID)
    expect(s.equipFilterOn).toBe(true)
    expect(gearCount(myProfile(s))).toBe(2)
  })
  it('the library follows it: a bench press needs the bench', () => {
    const s = {}
    saveMyEquipment(s, ['dumbbell'], 'Mine')
    const press = { n: 'dumbbell bench press', eq: 'dumbbell' }
    expect(exAvailable(s, press)).toBe(false)
    saveMyEquipment(s, ['dumbbell', 'bench'], 'Mine')
    expect(exAvailable(s, press)).toBe(true)
  })
})

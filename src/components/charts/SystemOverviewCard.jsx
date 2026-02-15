/**
 * Maintenance utilities for System Overview.
 *
 * NOTE: the UI component `SystemOverviewCard` was removed because it was unused
 * in the project. The maintenance-schedule helper `computeMaintenanceSchedule`
 * remains exported for other modules that depend on it.
 */

/**
 * Compute maintenance items from bins array.
 * Mirrors the logic from the previous SystemOverviewCard implementation.
 */
export function computeMaintenanceSchedule(bins = []) {
  const items = []

  const future = (days) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    return `${d.toLocaleDateString()} 10:00 AM`
  }

  bins.forEach(bin => {
    const name = bin.name || bin.binName || bin.id || 'Unknown Bin'
    const wc = bin.waste_composition || {}
    const recyclable = Number(wc.recyclable) || 0
    const biodegradable = Number(wc.biodegradable) || 0
    const nonBio = Number(wc.non_biodegradable || wc.nonBio) || 0
    const general = Number(bin.general_waste) || 0

    const streams = [
      { type: 'Recyclable', value: recyclable },
      { type: 'Biodegradable', value: biodegradable },
      { type: 'Non-Biodegradable', value: nonBio },
      { type: 'General', value: general }
    ]

    const avgFill = Math.round((recyclable + biodegradable + nonBio + general) / 4)

    if (avgFill >= 80) {
      items.push({ binName: name, task: 'Emptying', priority: 1, time: 'Today, ASAP', color: 'red' })
      return
    }

    streams.forEach(s => {
      if (s.value >= 80) {
        items.push({ binName: name, task: `Cleaning - ${s.type}`, priority: 2, time: future(1), color: 'purple' })
      }
    })
  })

  return items.slice(0, 4)
}

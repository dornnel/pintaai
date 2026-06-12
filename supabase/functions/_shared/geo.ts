// Utilitários de geolocalização para distribuição automática de leads.

export interface NeighborhoodRow {
  id: string
  name: string
  latitude: number | null
  longitude: number | null
}

export interface PainterRow {
  id: string
  neighborhoods_ids: string[] | null
  service_radius_km: number | null
  availability_status: string
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Encontra pintores cujo raio de atendimento alcança o bairro do lead.
export function findNearbyPainters(
  leadNeighborhoodName: string | undefined,
  painters: PainterRow[],
  neighborhoods: NeighborhoodRow[],
  defaultRadiusKm = 10,
): PainterRow[] {
  if (!leadNeighborhoodName) return []

  const leadHood = neighborhoods.find(n => n.name.toLowerCase() === leadNeighborhoodName.toLowerCase())
    ?? neighborhoods.find(n => leadNeighborhoodName.toLowerCase().includes(n.name.toLowerCase()))

  if (!leadHood?.latitude || !leadHood?.longitude) return []

  return painters.filter(p => {
    if (p.availability_status !== 'available') return false
    const radius = p.service_radius_km ?? defaultRadiusKm
    const painterHoods = neighborhoods.filter(n =>
      p.neighborhoods_ids?.includes(n.id) && n.latitude != null && n.longitude != null
    )
    if (painterHoods.length === 0) return false

    const minDist = Math.min(...painterHoods.map(n =>
      haversineKm(leadHood.latitude!, leadHood.longitude!, n.latitude!, n.longitude!)
    ))
    return minDist <= radius
  })
}

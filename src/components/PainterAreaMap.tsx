import { Fragment, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Circle, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Neighborhood } from '../lib/types'

// Fix Leaflet default marker icon broken by Vite asset hashing
;(L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl = undefined
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const BRAND_ORANGE = '#FF5200'
const FLORIAN_CENTER: [number, number] = [-27.5954, -48.5480]

interface PainterAreaMapProps {
  neighborhoods: Neighborhood[]
  painterNeighborhoodIds: string[]
  radiusKm?: number
  height?: number
}

export function PainterAreaMap({
  neighborhoods,
  painterNeighborhoodIds,
  radiusKm = 10,
  height = 280,
}: PainterAreaMapProps) {
  const covered = useMemo(() =>
    neighborhoods.filter(n =>
      painterNeighborhoodIds.includes(n.id) &&
      n.latitude != null && n.longitude != null
    ),
    [neighborhoods, painterNeighborhoodIds]
  )

  const center = useMemo((): [number, number] => {
    if (covered.length === 0) return FLORIAN_CENTER
    return [
      covered.reduce((s, n) => s + n.latitude!, 0) / covered.length,
      covered.reduce((s, n) => s + n.longitude!, 0) / covered.length,
    ]
  }, [covered])

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height }}>
      <MapContainer
        center={center}
        zoom={covered.length > 0 ? 12 : 11}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {covered.map(n => (
          <Fragment key={n.id}>
            <Circle
              center={[n.latitude!, n.longitude!]}
              radius={radiusKm * 1000}
              pathOptions={{
                color: BRAND_ORANGE,
                fillColor: BRAND_ORANGE,
                fillOpacity: 0.12,
                weight: 1.5,
              }}
            />
            <Marker position={[n.latitude!, n.longitude!]}>
              <Popup>
                <strong>{n.name}</strong>
                <br />
                <span style={{ fontSize: 11, color: '#888' }}>Raio: {radiusKm} km</span>
              </Popup>
            </Marker>
          </Fragment>
        ))}
      </MapContainer>
    </div>
  )
}

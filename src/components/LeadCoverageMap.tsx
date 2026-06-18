import { Fragment, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Circle, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Neighborhood } from '../lib/types'

;(L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl = undefined
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const FLORIAN_CENTER: [number, number] = [-27.5954, -48.548]

const STATUS_COLOR: Record<string, string> = {
  notified: '#F59E0B',
  interested: '#3B82F6',
  proposal_sent: '#10B981',
  accepted: '#059669',
  declined: '#D1D5DB',
}

export interface PainterCoverage {
  painter_id: string
  name: string
  status: string
  neighborhoods_ids: string[]
  service_radius_km: number
  is_live?: boolean
}

interface Props {
  leadNeighborhoodName: string | null
  neighborhoods: Neighborhood[]
  painters: PainterCoverage[]
  height?: number
}

export function LeadCoverageMap({ leadNeighborhoodName, neighborhoods, painters, height = 280 }: Props) {
  const leadNbhd = useMemo(
    () => neighborhoods.find(n => n.name.toLowerCase() === (leadNeighborhoodName ?? '').toLowerCase()),
    [neighborhoods, leadNeighborhoodName],
  )

  const center = useMemo((): [number, number] =>
    leadNbhd?.latitude != null && leadNbhd?.longitude != null
      ? [leadNbhd.latitude, leadNbhd.longitude]
      : FLORIAN_CENTER,
    [leadNbhd],
  )

  const painterCoverage = useMemo(() =>
    painters.flatMap(p =>
      (p.neighborhoods_ids ?? [])
        .map(nId => ({ n: neighborhoods.find(x => x.id === nId), p }))
        .filter(({ n }) => n?.latitude != null && n?.longitude != null)
    ),
    [painters, neighborhoods],
  )

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height }}>
      <MapContainer center={center} zoom={12}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false} attributionControl={false}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {/* Lead neighbourhood — bold orange */}
        {leadNbhd?.latitude != null && leadNbhd?.longitude != null && (
          <Fragment>
            <Circle
              center={[leadNbhd.latitude, leadNbhd.longitude]}
              radius={1200}
              pathOptions={{ color: '#E35A1A', fillColor: '#E35A1A', fillOpacity: 0.30, weight: 2.5 }}
            />
            <Marker position={[leadNbhd.latitude, leadNbhd.longitude]}>
              <Popup><strong>📍 {leadNbhd.name}</strong><br /><small>Localização do cliente</small></Popup>
            </Marker>
          </Fragment>
        )}

        {/* Painter coverage areas */}
        {painterCoverage.map(({ n, p }, i) => {
          const color = STATUS_COLOR[p.status] ?? '#9CA3AF'
          return (
            <Fragment key={i}>
              <Circle
                center={[n!.latitude!, n!.longitude!]}
                radius={(p.service_radius_km || 5) * 1000}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: p.is_live ? 0.18 : 0.07,
                  weight: p.is_live ? 2 : 1,
                  dashArray: p.is_live ? undefined : '5 4',
                }}
              >
                <Popup>
                  <strong>{p.name}</strong>
                  {p.is_live && <><br /><span style={{ color: '#10B981', fontSize: 11 }}>● Vendo agora</span></>}
                  <br /><small>Raio: {p.service_radius_km || 5} km · {p.status}</small>
                </Popup>
              </Circle>
            </Fragment>
          )
        })}
      </MapContainer>
    </div>
  )
}

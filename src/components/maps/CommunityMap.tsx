import { CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet'
import { useMemo, useState } from 'react'
import { COMMUNITIES } from '@/data/catalog'
import type { Report } from '@/data/types'
import { countByCommunity } from '@/utils/stats'

export function CommunityMap({ reports }: { reports: Report[] }) {
  const [tilesFailed, setTilesFailed] = useState(false)
  const points = useMemo(() => {
    const counts = countByCommunity(reports)
    return COMMUNITIES.map((community) => ({
      ...community,
      count: counts.find((item) => item.communityId === community.id)?.count ?? 0,
    }))
  }, [reports])

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <MapContainer
        center={[13.45, -16.0]}
        zoom={8}
        scrollWheelZoom
        className="h-[420px] w-full"
        attributionControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{ tileerror: () => setTilesFailed(true) }}
        />
        {points.map((point) => (
          <CircleMarker
            key={point.id}
            center={[point.lat, point.lng]}
            radius={10 + Math.min(point.count, 12)}
            pathOptions={{ color: '#14635D', fillColor: '#1f8a80', fillOpacity: 0.55 }}
          >
            <Tooltip>
              {point.name}: {point.count} report{point.count === 1 ? '' : 's'} (approximate locality, not an exact address)
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
      <p className="px-4 py-2 text-xs text-muted">
        Circles are aggregated by locality. Exact citizen addresses are not plotted.
        {tilesFailed ? ' Map tiles could not be loaded; locality lists below remain usable.' : ''}
      </p>
    </div>
  )
}

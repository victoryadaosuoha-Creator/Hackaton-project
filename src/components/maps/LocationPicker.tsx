import { CircleMarker, MapContainer, TileLayer, useMapEvents } from 'react-leaflet'

function ClickCapture({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng)
    },
  })
  return null
}

export function LocationPicker({
  lat,
  lng,
  onPick,
}: {
  lat: number | null
  lng: number | null
  onPick: (lat: number, lng: number) => void
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line">
      <MapContainer center={[lat ?? 13.45, lng ?? -16.57]} zoom={11} className="h-56 w-full" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickCapture onPick={onPick} />
        {lat != null && lng != null ? (
          <CircleMarker center={[lat, lng]} radius={12} pathOptions={{ color: '#0b3d3a', fillColor: '#e8b84a' }} />
        ) : null}
      </MapContainer>
      <p className="px-3 py-2 text-xs text-muted">
        Optional: tap the map to refine an approximate point. The locality name is enough if tiles do not load.
      </p>
    </div>
  )
}

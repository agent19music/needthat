import { useId } from 'react'

const BITES = 5
const BITE_RADIUS = 0.062

function biteCenters() {
  const centers: Array<{ cx: number; cy: number }> = []
  for (let index = 0; index < BITES; index += 1) {
    const t = (index + 0.5) / BITES
    centers.push(
      { cx: t, cy: 0 },
      { cx: t, cy: 1 },
      { cx: 0, cy: t },
      { cx: 1, cy: t },
    )
  }
  return centers
}

const centers = biteCenters()

export function Stamp({
  src,
  size = 76,
  tilt = 'none',
  flat = false,
}: {
  src?: string
  size?: number
  tilt?: 'left' | 'right' | 'none'
  flat?: boolean
}) {
  const maskId = `stamp${useId().replace(/[^a-zA-Z0-9]/g, '')}`

  return (
    <span
      className="stamp"
      data-tilt={tilt === 'none' ? undefined : tilt}
      data-flat={flat || undefined}
      style={{ width: size, height: size }}
    >
      <svg className="stamp-defs" aria-hidden="true">
        <mask
          id={maskId}
          maskUnits="objectBoundingBox"
          maskContentUnits="objectBoundingBox"
        >
          <rect width="1" height="1" fill="white" />
          {centers.map((center) => (
            <circle
              key={`${center.cx}-${center.cy}`}
              cx={center.cx}
              cy={center.cy}
              r={BITE_RADIUS}
              fill="black"
            />
          ))}
        </mask>
      </svg>
      <span
        className="stamp-paper"
        style={{
          mask: `url(#${maskId})`,
          WebkitMask: `url(#${maskId})`,
        }}
      >
        {src ? (
          <img src={src} alt="" draggable={false} referrerPolicy="no-referrer" />
        ) : null}
      </span>
    </span>
  )
}

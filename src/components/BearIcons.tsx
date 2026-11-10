/**
 * Bộ icon "gấu" riêng cho cửa sổ PiP dạy học.
 * Phong cách duotone: nét bo tròn 2px + mảng nền mờ theo currentColor, nhiều icon có tai gấu.
 */
type IconProps = { size?: number; className?: string }

const base = (size: number, className?: string) => ({
  className,
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  'aria-hidden': true as const,
})

const S = {
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}
const SOFT = { fill: 'currentColor', fillOpacity: 0.22 }

function Slash() {
  return <path d="M3.5 3.5l17 17" {...S} strokeWidth={2.4} />
}

export function BearMic({ size = 22, className, off = false }: IconProps & { off?: boolean }) {
  return (
    <svg {...base(size, className)}>
      <circle cx="8.6" cy="3.6" r="1.9" fill="currentColor" />
      <circle cx="15.4" cy="3.6" r="1.9" fill="currentColor" />
      <rect x="8" y="3" width="8" height="12" rx="4" {...SOFT} {...S} />
      <path d="M5 11.5a7 7 0 0 0 14 0M12 18.5V21M9 21h6" {...S} />
      {off && <Slash />}
    </svg>
  )
}

export function BearCam({ size = 22, className, off = false }: IconProps & { off?: boolean }) {
  return (
    <svg {...base(size, className)}>
      <circle cx="5.6" cy="6.4" r="2" fill="currentColor" />
      <circle cx="13.4" cy="6.4" r="2" fill="currentColor" />
      <rect x="2.5" y="7.5" width="14" height="11" rx="3.5" {...SOFT} {...S} />
      <path d="M16.5 11.2l4.2-2.4a.8.8 0 0 1 1.2.7v6a.8.8 0 0 1-1.2.7l-4.2-2.4" {...S} />
      <circle cx="9.5" cy="13" r="2.2" {...S} strokeWidth={1.8} />
      {off && <Slash />}
    </svg>
  )
}

export function BearStopShare({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <circle cx="6" cy="4.4" r="1.9" fill="currentColor" />
      <circle cx="18" cy="4.4" r="1.9" fill="currentColor" />
      <rect x="2.5" y="5" width="19" height="13" rx="3.5" {...SOFT} {...S} />
      <path d="M9 21.5h6M12 18v3.5" {...S} />
      <rect x="9.2" y="8.7" width="5.6" height="5.6" rx="1.4" fill="currentColor" />
    </svg>
  )
}

export function BearChat({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <circle cx="6.2" cy="4.6" r="2" fill="currentColor" />
      <circle cx="17.8" cy="4.6" r="2" fill="currentColor" />
      <path
        d="M4 9.5A4.5 4.5 0 0 1 8.5 5h7A4.5 4.5 0 0 1 20 9.5v3a4.5 4.5 0 0 1-4.5 4.5H11l-4.2 3.4c-.5.4-1.3 0-1.3-.6V16.6A4.5 4.5 0 0 1 4 13z"
        {...SOFT}
        {...S}
      />
      <path d="M9 11.2h.01M12 11.2h.01M15 11.2h.01" {...S} strokeWidth={2.6} />
    </svg>
  )
}

export function BearStar({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path
        d="M12 2.8l2.6 5.3 5.8.8c.8.1 1.1 1.1.5 1.6l-4.2 4.1 1 5.8c.1.8-.7 1.4-1.4 1L12 18.7l-5.3 2.7c-.7.4-1.5-.2-1.4-1l1-5.8-4.2-4.1c-.6-.5-.3-1.5.5-1.6l5.8-.8 2.6-5.3c.4-.7 1.4-.7 1.8 0z"
        fill="currentColor"
      />
    </svg>
  )
}

export function BearPaw({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <g fill="currentColor">
        <path d="M12 11.5c3.2 0 6 3 6 5.6 0 2-1.6 3.2-3.4 3.2-1 0-1.7-.5-2.6-.5s-1.6.5-2.6.5C7.6 20.3 6 19.1 6 17.1c0-2.6 2.8-5.6 6-5.6z" />
        <ellipse cx="5" cy="10" rx="2.1" ry="2.6" transform="rotate(-20 5 10)" />
        <ellipse cx="9.2" cy="5.8" rx="2.1" ry="2.7" transform="rotate(-8 9.2 5.8)" />
        <ellipse cx="14.8" cy="5.8" rx="2.1" ry="2.7" transform="rotate(8 14.8 5.8)" />
        <ellipse cx="19" cy="10" rx="2.1" ry="2.6" transform="rotate(20 19 10)" />
      </g>
    </svg>
  )
}

export function BearPlus({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 5v14M5 12h14" {...S} strokeWidth={3} />
    </svg>
  )
}

export function BearMinus({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M5 12h14" {...S} strokeWidth={3} />
    </svg>
  )
}

export function BearPin({ size = 12, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M9 3h6l-1 6 3.5 3.5v1.5h-11v-1.5L10 9z" fill="currentColor" />
      <path d="M12 14v7" {...S} strokeWidth={2.4} />
    </svg>
  )
}

export function BearScreen({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <circle cx="6" cy="4.4" r="1.9" fill="currentColor" />
      <circle cx="18" cy="4.4" r="1.9" fill="currentColor" />
      <rect x="2.5" y="5" width="19" height="13" rx="3.5" {...SOFT} {...S} />
      <path d="M9 21.5h6M12 18v3.5" {...S} />
      <path d="M12 14.5V9M9.6 11.2 12 8.8l2.4 2.4" {...S} />
    </svg>
  )
}

export function BearLeave({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M11 3.5h6.5A2.5 2.5 0 0 1 20 6v12a2.5 2.5 0 0 1-2.5 2.5H11" {...SOFT} {...S} />
      <circle cx="16.4" cy="12" r="1" fill="currentColor" />
      <path d="M13 12H3.5m0 0 3.2-3.2M3.5 12l3.2 3.2" {...S} />
    </svg>
  )
}

export function BearCopy({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M15.5 7.5V6A2.5 2.5 0 0 0 13 3.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h1.5" {...S} />
      <circle cx="10" cy="7.6" r="1.8" fill="currentColor" />
      <circle cx="18" cy="7.6" r="1.8" fill="currentColor" />
      <rect x="8" y="8.5" width="12.5" height="12" rx="3" {...SOFT} {...S} />
    </svg>
  )
}

export function BearSend({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M20.6 3.4 3.8 10.1c-.8.3-.8 1.4 0 1.7l6 2.4 2.4 6c.3.8 1.4.8 1.7 0z" {...SOFT} {...S} />
      <path d="M20.6 3.4 9.8 14.2" {...S} />
    </svg>
  )
}

export function BearRecord({ size = 22, className, active = false }: IconProps & { active?: boolean }) {
  return (
    <svg {...base(size, className)}>
      <circle cx="6.2" cy="5.6" r="2.4" fill="currentColor" />
      <circle cx="17.8" cy="5.6" r="2.4" fill="currentColor" />
      <circle cx="12" cy="13" r="8" {...(active ? { fill: 'currentColor' } : SOFT)} {...S} />
      {active ? (
        <rect x="9.5" y="10.5" width="5" height="5" rx="1.2" fill="#fff" />
      ) : (
        <circle cx="12" cy="13" r="3.4" fill="currentColor" />
      )}
    </svg>
  )
}

export function BearBeauty({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 20 14.5 9.5" {...S} strokeWidth={2.4} />
      <path
        d="M16 2.8l1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={1}
        strokeLinejoin="round"
      />
      <path d="M8.2 3.5l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5zM19.5 13l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z" fill="currentColor" />
      <path d="M11 13.5l-1.8-.2M13.6 16.2l-.2-1.8" {...S} strokeWidth={1.6} opacity={0.6} />
    </svg>
  )
}

export function BearReact({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <circle cx="5.4" cy="6" r="2.6" fill="currentColor" />
      <circle cx="18.6" cy="6" r="2.6" fill="currentColor" />
      <ellipse cx="12" cy="13.2" rx="8.5" ry="7.8" {...SOFT} {...S} />
      <path d="M9 11.6h.01M15 11.6h.01" {...S} strokeWidth={2.8} />
      <ellipse cx="12" cy="15.4" rx="3" ry="2.2" fill="currentColor" fillOpacity={0.35} />
      <path d="M10.8 14.6h2.4" {...S} strokeWidth={1.8} />
    </svg>
  )
}

export function BearPlayful({ size = 22, className }: IconProps) {
  return <BearPaw size={size} className={className} />
}

export function BearMegaphone({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M3.5 10.5v3a2 2 0 0 0 2 2H7l7.5 4V4.5L7 8.5H5.5a2 2 0 0 0-2 2z" {...SOFT} {...S} />
      <path d="M7.5 15.5l.9 3.6a1.5 1.5 0 0 0 2.9-.8l-.5-1.8" {...S} />
      <path d="M18 9.2a4 4 0 0 1 0 5.6M20.3 7a7 7 0 0 1 0 10" {...S} />
    </svg>
  )
}

export function BearPeople({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <circle cx="13.6" cy="5.2" r="1.7" fill="currentColor" />
      <circle cx="20.4" cy="5.2" r="1.7" fill="currentColor" />
      <circle cx="17" cy="9" r="4" {...SOFT} {...S} strokeWidth={1.8} />
      <path d="M13.5 20.5c.4-2.3 1.8-3.6 3.5-3.6s3.1 1.3 3.5 3.6" {...S} strokeWidth={1.8} />
      <circle cx="3.6" cy="5.4" r="2" fill="currentColor" />
      <circle cx="11" cy="5.4" r="2" fill="currentColor" />
      <circle cx="7.3" cy="9.6" r="4.6" fill="currentColor" fillOpacity={0.3} {...S} />
      <path d="M2.5 21c.5-3 2.3-4.6 4.8-4.6S11.6 18 12 21" {...S} />
    </svg>
  )
}

export function BearSticker({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path
        d="M12 20.5C6 16.6 3 13.4 3 9.6 3 6.8 5.1 4.5 7.8 4.5c1.7 0 3.2.9 4.2 2.3 1-1.4 2.5-2.3 4.2-2.3C18.9 4.5 21 6.8 21 9.6c0 .8-.1 1.5-.4 2.2"
        {...SOFT}
        {...S}
      />
      <path d="M20.6 11.8 14.5 18l-.2-4 .1-.1 4.1.2z" fill="currentColor" {...S} strokeWidth={1.6} />
    </svg>
  )
}

export function BearEraser({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M14.6 4.2a2 2 0 0 1 2.8 0l2.4 2.4a2 2 0 0 1 0 2.8L11 18.2H7.2l-3-3a2 2 0 0 1 0-2.8z" {...SOFT} {...S} />
      <path d="M9.4 9.4l5.2 5.2M7 20.5h13" {...S} />
    </svg>
  )
}

export function BearMoon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" {...SOFT} {...S} />
      <path d="M17 3.5v3M15.5 5h3" {...S} strokeWidth={1.6} />
    </svg>
  )
}

export function BearFlower({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <g fill="currentColor" fillOpacity={0.35} stroke="currentColor" strokeWidth={1.6}>
        <circle cx="12" cy="6.5" r="3.5" />
        <circle cx="17.2" cy="10.3" r="3.5" />
        <circle cx="15.2" cy="16.4" r="3.5" />
        <circle cx="8.8" cy="16.4" r="3.5" />
        <circle cx="6.8" cy="10.3" r="3.5" />
      </g>
      <circle cx="12" cy="12" r="2.6" fill="currentColor" />
    </svg>
  )
}

export function BearEnter({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M13 3.5h4.5A2.5 2.5 0 0 1 20 6v12a2.5 2.5 0 0 1-2.5 2.5H13" {...SOFT} {...S} />
      <path d="M3.5 12H14m0 0-3.4-3.4M14 12l-3.4 3.4" {...S} />
    </svg>
  )
}

export function BearKey({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <circle cx="5.4" cy="6.2" r="1.8" fill="currentColor" />
      <circle cx="12.6" cy="6.2" r="1.8" fill="currentColor" />
      <circle cx="9" cy="11" r="5" {...SOFT} {...S} />
      <path d="M12.6 14.6 20 22M17 19l2-2M15 17l1.5-1.5" {...S} />
    </svg>
  )
}

export function BearTrash({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 6.5h16M9.5 6.5V4.5h5v2" {...S} />
      <path d="M6 6.5l1 12.5a2 2 0 0 0 2 1.5h6a2 2 0 0 0 2-1.5l1-12.5" {...SOFT} {...S} />
      <path d="M10 10.5v6M14 10.5v6" {...S} strokeWidth={1.6} />
    </svg>
  )
}

export function BearHouse({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <circle cx="6.5" cy="5.5" r="2" fill="currentColor" />
      <circle cx="17.5" cy="5.5" r="2" fill="currentColor" />
      <path d="M3.5 11 12 4.5l8.5 6.5V18a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 18z" {...SOFT} {...S} />
      <path d="M10 20.5v-5a2 2 0 0 1 4 0v5" {...S} />
    </svg>
  )
}

export function BearCrown({ size = 12, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path
        d="M3.5 8.5l4.2 3.3L12 5l4.3 6.8 4.2-3.3-1.7 9.5H5.2z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <path d="M5.5 20.5h13" {...S} />
    </svg>
  )
}

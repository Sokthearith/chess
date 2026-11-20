export function Crosshair({ className = '' }: { className?: string }) {
  return (
    <svg className={`xhair ${className}`} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="1">
        <path d="M8 0v5.5M8 10.5V16M0 8h5.5M10.5 8H16" />
        <circle cx="8" cy="8" r="4.5" />
      </g>
    </svg>
  )
}

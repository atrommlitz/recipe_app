/**
 * The app mark — the lemonade glass from the home-screen icon, redrawn as
 * vector so it stays crisp at any tile size.
 *
 * Outlines use `currentColor` rather than black so the mark reads on the dark
 * ground too; the juice and straw keep their literal colors, which is what
 * makes it recognisably the icon.
 */
export function Mark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={className}
      role="presentation"
    >
      <defs>
        <clipPath id="mark-glass">
          <path d="M14.5 16.5h19.5l-2.7 25H17.2z" />
        </clipPath>
      </defs>

      {/* Lemon wheel, tucked behind the rim */}
      <circle cx="12.5" cy="14.5" r="6.4" fill="#F5C518" />
      <circle
        cx="12.5"
        cy="14.5"
        r="6.4"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M12.5 8.1v12.8M6.1 14.5h12.8M7.9 9.9l9.2 9.2M17.1 9.9l-9.2 9.2"
        stroke="currentColor"
        strokeWidth="0.9"
        opacity="0.75"
      />

      {/* Glass: juice below the fill line, empty above it */}
      <g clipPath="url(#mark-glass)">
        <rect x="12" y="16" width="25" height="8" fill="currentColor" opacity="0.08" />
        <rect x="12" y="24" width="25" height="20" fill="#F5C518" />
        <path d="M12 23.4h25" stroke="currentColor" strokeWidth="1.5" />
      </g>
      <path
        d="M14.5 16.5h19.5l-2.7 25H17.2z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Straw */}
      <path
        d="M25 21.5 38.5 8.5"
        stroke="currentColor"
        strokeWidth="4.6"
        strokeLinecap="round"
      />
      <path
        d="M25 21.5 38.5 8.5"
        stroke="#E4572E"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

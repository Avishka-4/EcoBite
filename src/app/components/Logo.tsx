export function Logo({ className = "w-12 h-12" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Bowl */}
      <ellipse
        cx="50"
        cy="65"
        rx="35"
        ry="8"
        fill="url(#bowlShadow)"
        opacity="0.3"
      />
      <path
        d="M20 45 Q20 75, 50 85 Q80 75, 80 45 L20 45"
        fill="url(#bowlGradient)"
        stroke="#059669"
        strokeWidth="2.5"
      />
      <ellipse
        cx="50"
        cy="45"
        rx="30"
        ry="6"
        fill="#dcfce7"
        stroke="#059669"
        strokeWidth="2.5"
      />

      {/* Food ingredients in bowl */}
      {/* Tomato */}
      <circle
        cx="35"
        cy="50"
        r="7"
        fill="#ef4444"
        stroke="#dc2626"
        strokeWidth="1.5"
      />
      <path
        d="M35 45 L35 48"
        stroke="#22c55e"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Lettuce/Leaf */}
      <ellipse
        cx="55"
        cy="48"
        rx="8"
        ry="6"
        fill="#86efac"
        stroke="#22c55e"
        strokeWidth="1.5"
        transform="rotate(-15 55 48)"
      />
      <path
        d="M55 45 Q55 50, 55 52"
        stroke="#16a34a"
        strokeWidth="1.2"
        strokeLinecap="round"
      />

      {/* Carrot piece */}
      <rect
        x="43"
        y="52"
        width="6"
        height="8"
        rx="2"
        fill="#fb923c"
        stroke="#f97316"
        strokeWidth="1.5"
        transform="rotate(20 46 56)"
      />

      {/* Small garnish dots */}
      <circle cx="28" cy="55" r="2" fill="#84cc16" />
      <circle cx="62" cy="54" r="2" fill="#84cc16" />
      <circle cx="48" cy="58" r="1.5" fill="#22c55e" />

      {/* Fork and Spoon behind bowl */}
      {/* Fork */}
      <g opacity="0.6">
        <path
          d="M15 25 L15 42"
          stroke="#059669"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M12 15 L12 28 M15 15 L15 32 M18 15 L18 28"
          stroke="#059669"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>

      {/* Spoon */}
      <g opacity="0.6">
        <path
          d="M85 25 L85 42"
          stroke="#059669"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <ellipse
          cx="85"
          cy="18"
          rx="5"
          ry="7"
          fill="#10b981"
          stroke="#059669"
          strokeWidth="2"
        />
      </g>

      <defs>
        <linearGradient id="bowlGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#d1fae5" />
          <stop offset="50%" stopColor="#a7f3d0" />
          <stop offset="100%" stopColor="#6ee7b7" />
        </linearGradient>
        <radialGradient id="bowlShadow">
          <stop offset="0%" stopColor="#000" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

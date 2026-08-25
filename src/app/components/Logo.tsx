export function Logo({ className = "w-12 h-12" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Background Gradient */}
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="50%" stopColor="#059669" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>

        {/* Bowl Glow / Gradient */}
        <linearGradient id="bowlGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </linearGradient>

        {/* Leaf Gradients */}
        <linearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a3e635" />
          <stop offset="100%" stopColor="#16a34a" />
        </linearGradient>

        <linearGradient id="leafGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#86efac" />
          <stop offset="100%" stopColor="#22c55e" />
        </linearGradient>

        {/* Tomato Gradient */}
        <linearGradient id="tomatoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fb7185" />
          <stop offset="50%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#b91c1c" />
        </linearGradient>

        {/* Carrot / Spice Gradient */}
        <linearGradient id="carrotGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="60%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>

        {/* Gold Star Sparkle */}
        <linearGradient id="goldSparkle" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="100%" stopColor="#eab308" />
        </linearGradient>

        {/* Soft Ambient Shadow */}
        <filter id="dropShadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodOpacity="0.25" />
        </filter>
        <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Outer rounded container with soft shadow */}
      <rect
        x="6"
        y="6"
        width="108"
        height="108"
        rx="28"
        fill="url(#bgGrad)"
        filter="url(#dropShadow)"
      />

      {/* Decorative inner light ring */}
      <rect
        x="8"
        y="8"
        width="104"
        height="104"
        rx="26"
        stroke="#ffffff"
        strokeWidth="1.5"
        strokeOpacity="0.25"
      />

      {/* Cutlery Behind Bowl */}
      {/* Fork */}
      <g opacity="0.85">
        <path
          d="M32 26 V48"
          stroke="#ffffff"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M26 22 V34 C26 38 38 38 38 34 V22"
          stroke="#ffffff"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M32 22 V34"
          stroke="#ffffff"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </g>

      {/* Spoon */}
      <g opacity="0.85">
        <path
          d="M88 26 V48"
          stroke="#ffffff"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <ellipse
          cx="88"
          cy="26"
          rx="7"
          ry="11"
          fill="#ffffff"
        />
      </g>

      {/* Bowl Cast Shadow */}
      <ellipse
        cx="60"
        cy="92"
        rx="36"
        ry="7"
        fill="#000000"
        opacity="0.28"
      />

      {/* Bowl Body (Modern porcelain curve) */}
      <path
        d="M22 56 C22 88 40 92 60 92 C80 92 98 88 98 56 Z"
        fill="url(#bowlGrad)"
        filter="url(#dropShadow)"
      />

      {/* Bowl Rim Highlight */}
      <ellipse
        cx="60"
        cy="56"
        rx="38"
        ry="8"
        fill="#ffffff"
      />
      <ellipse
        cx="60"
        cy="57"
        rx="34"
        ry="6"
        fill="#f1f5f9"
      />

      {/* Fresh Ingredients Emerging from Bowl */}
      {/* 1. Ripe Cherry Tomato */}
      <g filter="url(#dropShadow)">
        <circle
          cx="42"
          cy="52"
          r="14"
          fill="url(#tomatoGrad)"
        />
        {/* Tomato highlight gloss */}
        <ellipse
          cx="38"
          cy="47"
          rx="4.5"
          ry="2.5"
          fill="#ffffff"
          opacity="0.6"
          transform="rotate(-25 38 47)"
        />
        {/* Calyx / Stem */}
        <path
          d="M42 38 C42 42 45 40 47 38 C44 42 46 44 42 42 C38 44 40 42 37 38 C39 40 42 42 42 38 Z"
          fill="#22c55e"
        />
      </g>

      {/* 2. Carrot Slice / Vibrant Orange Ring */}
      <g filter="url(#dropShadow)">
        <ellipse
          cx="58"
          cy="56"
          rx="12"
          ry="7"
          fill="url(#carrotGrad)"
          transform="rotate(18 58 56)"
        />
        <ellipse
          cx="58"
          cy="56"
          rx="6"
          ry="3.5"
          fill="#fed7aa"
          transform="rotate(18 58 56)"
        />
      </g>

      {/* 3. Main Iconic Eco Sprout / Leaf (Center right rising high) */}
      <g filter="url(#dropShadow)">
        <path
          d="M60 52 C60 30 78 22 84 22 C84 38 72 54 60 52 Z"
          fill="url(#leafGrad)"
        />
        <path
          d="M60 52 C65 42 74 32 84 22"
          stroke="#ffffff"
          strokeWidth="1.5"
          strokeOpacity="0.6"
          strokeLinecap="round"
        />
        {/* Small companion leaf */}
        <path
          d="M60 46 C56 36 64 30 70 28 C70 38 64 45 60 46 Z"
          fill="url(#leafGrad2)"
        />
      </g>

      {/* Decorative Culinary Sparkles ✦ */}
      <path
        d="M24 24 Q27 24 27 20 Q27 24 30 24 Q27 24 27 28 Q27 24 24 24 Z"
        fill="url(#goldSparkle)"
        filter="url(#softGlow)"
      />
      <path
        d="M96 68 Q98 68 98 65 Q98 68 100 68 Q98 68 98 71 Q98 68 96 68 Z"
        fill="url(#goldSparkle)"
        filter="url(#softGlow)"
      />
      <circle cx="94" cy="20" r="2.5" fill="#fef08a" opacity="0.9" />
    </svg>
  );
}

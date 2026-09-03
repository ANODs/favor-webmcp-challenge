// Premium gold/amber capacity expand icon
export function LimitsIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="limitsGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
      </defs>
      {/* Dynamic interlocking shield/capacity nodes */}
      <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="url(#limitsGrad)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 3" />
      <path d="M12 17C14.7614 17 17 14.7614 17 12C17 9.23858 14.7614 7 12 7C9.23858 7 7 9.23858 7 12C7 14.7614 9.23858 17 12 17Z" fill="url(#limitsGrad)" fillOpacity="0.15" stroke="url(#limitsGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 9V15M9 12H15" stroke="url(#limitsGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Premium deep neon blue/indigo radar scouting icon
export function ScoutingIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="scoutGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#4F46E5" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="9" stroke="url(#scoutGrad)" strokeWidth="1.5" />
      <path d="M12 3V21M3 12H21" stroke="url(#scoutGrad)" strokeWidth="1" strokeOpacity="0.3" />
      <path d="M12 12L16.5 7.5" stroke="url(#scoutGrad)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="2.5" fill="url(#scoutGrad)" />
      <path d="M18 12C18 8.68629 15.3137 6 12 6" stroke="url(#scoutGrad)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// Premium emerald/teal contact unlock eye icon
export function FreeRevealsIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="revealsGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>
      <path d="M2 12C2 12 5 5 12 5C19 5 22 12 22 12C22 12 19 19 12 19C5 19 2 12 2 12Z" stroke="url(#revealsGrad)" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3.5" fill="url(#revealsGrad)" fillOpacity="0.2" stroke="url(#revealsGrad)" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="1.5" fill="url(#revealsGrad)" />
      <path d="M15 8.5C14.1 7.6 13.1 7 12 7" stroke="url(#revealsGrad)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// Premium pink/rose priority lightning icon
export function PriorityFeedIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="priorityGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#EC4899" />
          <stop offset="100%" stopColor="#E11D48" />
        </linearGradient>
      </defs>
      <path d="M13 10H20L11 22V14H4L13 2V10Z" fill="url(#priorityGrad)" fillOpacity="0.15" stroke="url(#priorityGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 7L7 12H11V17L15 12H11V7Z" fill="url(#priorityGrad)" />
    </svg>
  );
}

// Premium violet/purple OG share card icon
export function OGPreviewsIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ogGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      <rect x="3" y="4" width="18" height="16" rx="3" stroke="url(#ogGrad)" strokeWidth="2" />
      <path d="M3 16L8.5 11.5C9.3 10.8 10.7 10.8 11.5 11.5L16 15" stroke="url(#ogGrad)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 14L16.5 12C17.3 11.3 18.7 11.3 19.5 12L21 13.5" stroke="url(#ogGrad)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8.5" cy="8.5" r="1.5" fill="url(#ogGrad)" />
    </svg>
  );
}

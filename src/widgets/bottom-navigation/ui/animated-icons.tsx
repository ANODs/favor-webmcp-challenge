import { useState, useEffect, useCallback } from "react";

type IconProps = { className?: string; isActive?: boolean };

// Common bouncy transition for consistent, premium feel
const springTransition = "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)";

function useIconAnimation(isActive?: boolean) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isActive) {
      const frame = requestAnimationFrame(() => setIsAnimating(true));
      const timer = setTimeout(() => setIsAnimating(false), 500);
      return () => {
        cancelAnimationFrame(frame);
        clearTimeout(timer);
      };
    }
  }, [isActive]);

  const handlePointerDown = useCallback(() => {
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 500);
  }, []);

  return { isAnimating, handlePointerDown };
}

export const AnimatedTextSearch = ({ className, isActive }: IconProps) => {
  const { isAnimating, handlePointerDown } = useIconAnimation(isActive);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      onPointerDown={handlePointerDown}
    >
      <path d="M21 5H3" />
      <path d="M10 12H3" />
      <path d="M10 19H3" />
      <g
        style={{
          transform: isAnimating ? "translateX(-6px) translateY(-4px) rotate(-15deg) scale(1.7)" : "none",
          transformOrigin: "17px 15px",
          transition: springTransition,
        }}
      >
        <circle cx="17" cy="15" r="3" />
        <path d="m21 19-1.9-1.9" />
      </g>
    </svg>
  );
};

export const AnimatedBriefcaseBusiness = ({ className, isActive }: IconProps) => {
  const { isAnimating, handlePointerDown } = useIconAnimation(isActive);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      onPointerDown={handlePointerDown}
    >
      <rect width="20" height="14" x="2" y="6" rx="2" />
      <path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      <g
        style={{
          transform: isAnimating ? "scaleY(-1)" : "none",
          transformOrigin: "center 13px",
          transition: springTransition,
        }}
      >
        <path d="M22 13a18.15 18.15 0 0 1-20 0" />
      </g>
      <g
        style={{
          transform: isAnimating ? "translateY(-4px)" : "none",
          transition: springTransition,
        }}
      >
        <path d="M12 12h.01" />
      </g>
    </svg>
  );
};

export const AnimatedPlusSquare = ({ className, isActive }: IconProps) => {
  const { isAnimating, handlePointerDown } = useIconAnimation(isActive);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      onPointerDown={handlePointerDown}
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <g
        style={{
          transform: isAnimating ? "rotate(90deg)" : "none",
          transformOrigin: "12px 12px",
          transition: springTransition,
        }}
      >
        <path d="M8 12h8" />
        <path d="M12 8v8" />
      </g>
    </svg>
  );
};

export const AnimatedCircleUserRound = ({ className, isActive }: IconProps) => {
  const { isAnimating, handlePointerDown } = useIconAnimation(isActive);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      onPointerDown={handlePointerDown}
    >
      <g
        style={{
          transform: isAnimating ? "translateY(-2px)" : "none",
          transition: springTransition,
        }}
      >
        <path d="M17.925 20.056a6 6 0 0 0-11.851.001" />
      </g>
      <g
        style={{
          transform: isAnimating ? "translateY(-3px)" : "none",
          transition: springTransition,
        }}
      >
        <circle cx="12" cy="11" r="4" />
      </g>
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
};

export const AnimatedSettings = ({ className, isActive }: IconProps) => {
  const { isAnimating, handlePointerDown } = useIconAnimation(isActive);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      onPointerDown={handlePointerDown}
    >
      <g
        style={{
          transform: isAnimating ? "rotate(90deg)" : "none",
          transformOrigin: "center",
          transition: "transform 0.5s ease",
        }}
      >
        <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
        <circle cx="12" cy="12" r="3" />
      </g>
    </svg>
  );
};

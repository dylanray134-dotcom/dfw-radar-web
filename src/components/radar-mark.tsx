export function RadarMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="32" cy="32" r="30" fill="#071018" />
      <circle cx="32" cy="32" r="26" fill="none" stroke="#1ee0cf" strokeOpacity="0.35" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="18" fill="none" stroke="#1ee0cf" strokeOpacity="0.55" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="10" fill="none" stroke="#7dff6b" strokeOpacity="0.8" strokeWidth="1.5" />
      <path d="M32 32 L58 18 A28 28 0 0 0 46 6 Z" fill="#ff4fd8" fillOpacity="0.9" />
      <path d="M32 32 L46 6 A28 28 0 0 0 22 5 Z" fill="#ffb020" fillOpacity="0.95" />
      <path d="M32 32 L22 5 A28 28 0 0 0 8 22 Z" fill="#3dff7a" fillOpacity="0.85" />
      <circle cx="32" cy="32" r="2.5" fill="#e8fffb" />
    </svg>
  );
}

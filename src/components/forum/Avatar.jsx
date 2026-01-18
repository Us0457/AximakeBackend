import React from 'react';

// Simple deterministic color palette for avatar backgrounds
const COLORS = [
  'bg-sky-200 text-sky-800',
  'bg-emerald-200 text-emerald-800',
  'bg-amber-200 text-amber-800',
  'bg-pink-200 text-pink-800',
  'bg-purple-200 text-purple-800',
  'bg-rose-200 text-rose-800',
  'bg-indigo-200 text-indigo-800'
];

function hashToIndex(str) {
  if (!str) return 0;
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
  return Math.abs(h) % COLORS.length;
}

const Avatar = ({ name, src, size = 10, className = '' }) => {
  const initials = name ? name.trim().charAt(0).toUpperCase() : '?';
  const palette = COLORS[hashToIndex(name || initials)];

  if (src) {
    return (
      <img src={src} alt={name || 'avatar'} className={`rounded-full object-cover ${className}`} style={{ width: `${size}px`, height: `${size}px` }} />
    );
  }

  return (
    <div className={`rounded-full flex items-center justify-center font-semibold ${palette} ${className}`} style={{ width: `${size}px`, height: `${size}px` }}>
      {initials}
    </div>
  );
};

export default Avatar;

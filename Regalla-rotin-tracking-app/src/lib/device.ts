// ─── Device sensor matrix · viewport, orientation, touch telemetry ──────────
import { useSyncExternalStore } from 'react';

export type DeviceProfile = 'desktop' | 'tablet' | 'mobile' | 'reader';

interface DeviceSnapshot {
  w: number;
  h: number;
  touch: boolean;
  portrait: boolean;
}

const compute = (): DeviceSnapshot => {
  if (typeof window === 'undefined') return { w: 1440, h: 900, touch: false, portrait: false };
  return {
    w: window.innerWidth,
    h: window.innerHeight,
    touch: window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window,
    portrait: window.innerHeight > window.innerWidth,
  };
};

let cache = compute();
const listeners = new Set<() => void>();

function onChange() {
  const next = compute();
  if (
    next.w !== cache.w ||
    next.h !== cache.h ||
    next.touch !== cache.touch ||
    next.portrait !== cache.portrait
  ) {
    cache = next;
    listeners.forEach((l) => l());
  }
}

let wired = false;
function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!wired && typeof window !== 'undefined') {
    wired = true;
    window.addEventListener('resize', onChange);
    window.addEventListener('orientationchange', onChange);
  }
  return () => {
    listeners.delete(cb);
  };
}

const getSnapshot = () => cache;
const getServerSnapshot = () => cache;

/** Live device profile. `voiceAssist` forces the accessibility reader profile. */
export function useDevice(voiceAssist: boolean): DeviceSnapshot & { profile: DeviceProfile } {
  const s = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const profile: DeviceProfile = voiceAssist ? 'reader' : s.w >= 1200 ? 'desktop' : s.w >= 768 ? 'tablet' : 'mobile';
  return { ...s, profile };
}

export const PROFILE_LABEL: Record<DeviceProfile, string> = {
  desktop: 'DESKTOP MATRIX',
  tablet: 'TABLET MATRIX',
  mobile: 'MOBILE MATRIX',
  reader: 'READER MATRIX',
};

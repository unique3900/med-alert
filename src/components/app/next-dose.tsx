'use client';

import { useEffect, useState } from 'react';
import { humanizeMinutes, relativeMinutes } from '@/lib/time/format';

export function Countdown({ dueAt }: { dueAt: string }) {
  const target = new Date(dueAt);
  const [minutes, setMinutes] = useState(() => relativeMinutes(target));

  useEffect(() => {
    const tick = () => setMinutes(relativeMinutes(new Date(dueAt)));
    tick();
    const timer = window.setInterval(tick, 20_000);
    return () => window.clearInterval(timer);
  }, [dueAt]);

  if (minutes <= 0) return <span>due now</span>;
  return <span>in {humanizeMinutes(minutes)}</span>;
}

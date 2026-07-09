import React, { useEffect } from 'react';
import { motion, useInView, useSpring, useTransform } from 'framer-motion';

export function AnimatedCounter({ 
  value, 
  suffix = '', 
  duration = 2000 
}: { 
  value: number; 
  suffix?: string;
  duration?: number;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-10% 0px" });

  const spring = useSpring(0, { duration, bounce: 0 });
  const display = useTransform(spring, (current) => Math.floor(current).toLocaleString() + suffix);

  useEffect(() => {
    if (isInView) {
      spring.set(value);
    }
  }, [isInView, spring, value]);

  return <motion.span ref={ref}>{display}</motion.span>;
}
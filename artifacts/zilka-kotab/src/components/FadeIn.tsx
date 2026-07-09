import React from 'react';
import { motion, useInView } from 'framer-motion';

export function FadeIn({ 
  children, 
  delay = 0, 
  direction = 'up',
  className = '',
  once = true
}: { 
  children: React.ReactNode; 
  delay?: number; 
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  className?: string;
  once?: boolean;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, margin: "-10% 0px" });

  const getDirectionOffset = () => {
    switch (direction) {
      case 'up': return { y: 40, x: 0 };
      case 'down': return { y: -40, x: 0 };
      case 'left': return { x: 40, y: 0 };
      case 'right': return { x: -40, y: 0 };
      case 'none': return { x: 0, y: 0 };
      default: return { y: 40, x: 0 };
    }
  };

  const offset = getDirectionOffset();

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, ...offset }}
      animate={isInView ? { opacity: 1, x: 0, y: 0 } : { opacity: 0, ...offset }}
      transition={{ duration: 0.7, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
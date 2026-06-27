import React, { useRef, useEffect, useState } from 'react';

/**
 * AnimatedNumber — counts up from 0 to `value` when scrolled into view.
 * Supports integer and decimal targets with optional prefix/suffix text.
 * 
 * Usage: <AnimatedNumber value={40} suffix="mm" duration={1800} />
 *        <AnimatedNumber value={0.08} prefix="< " suffix="%" decimals={2} />
 */
export default function AnimatedNumber({ 
  value, 
  prefix = '', 
  suffix = '', 
  decimals = 0, 
  duration = 2000,
  className = '' 
}) {
  const ref = useRef(null);
  const [displayValue, setDisplayValue] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          observer.unobserve(entry.target);

          const startTime = performance.now();
          const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Ease-out cubic for a decelerating feel
            const eased = 1 - Math.pow(1 - progress, 3);
            
            const current = eased * value;
            setDisplayValue(current);

            if (progress < 1) {
              requestAnimationFrame(animate);
            } else {
              setDisplayValue(value);
            }
          };

          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3, rootMargin: '0px 0px -40px 0px' }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [value, duration, hasAnimated]);

  const formatted = decimals > 0 
    ? displayValue.toFixed(decimals) 
    : Math.round(displayValue);

  return (
    <span ref={ref} className={`animated-number ${className}`}>
      {prefix}{formatted}{suffix}
    </span>
  );
}

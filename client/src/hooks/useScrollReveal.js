import { useEffect } from 'react';

/**
 * useScrollReveal Hook
 *
 * Content-aware, future-proof scroll animation observer for ELVO pages.
 * - Detects all elements with `.hp-reveal` and attaches `.is-revealed` when intersecting.
 * - Automatically computes staggered delay offsets for `.hp-stagger-group` or `[data-stagger]` containers.
 * - Unobserves revealed elements to prevent annoying re-triggering during minor scrolls.
 * - Fully respects system `prefers-reduced-motion` settings.
 */
export const useScrollReveal = (options = {}) => {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check system accessibility preference
    const prefersReducedMotion =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      document.querySelectorAll('.hp-reveal').forEach((el) => {
        el.classList.add('is-revealed');
      });
      return;
    }

    // Auto-stagger direct children of dynamic content containers
    const staggerGroups = document.querySelectorAll('[data-stagger], .hp-stagger-group');
    staggerGroups.forEach((group) => {
      const stepDelay = parseInt(group.getAttribute('data-stagger-step') || '90', 10);
      const baseOffset = parseInt(group.getAttribute('data-stagger-base') || '0', 10);
      const children = Array.from(group.children);

      children.forEach((child, index) => {
        if (!child.classList.contains('hp-reveal')) {
          child.classList.add('hp-reveal', 'hp-reveal-up');
        }
        if (!child.className.includes('hp-delay-')) {
          child.style.transitionDelay = `${baseOffset + index * stepDelay}ms`;
        }
      });
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: options.threshold !== undefined ? options.threshold : 0.12,
        rootMargin: options.rootMargin || '0px 0px -40px 0px',
      }
    );

    const elements = document.querySelectorAll('.hp-reveal:not(.is-revealed)');
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [options.threshold, options.rootMargin]);
};

export default useScrollReveal;


/**
 * Skip Links Component
 * CBP-P1-003: Keyboard Navigation & Focus Management
 */

import '@/styles/focus.css';

interface SkipLink {
  href: string;
  label: string;
}

interface SkipLinksProps {
  links?: SkipLink[];
}

const defaultLinks: SkipLink[] = [
  { href: '#main-content', label: 'Skip to main content' },
  { href: '#main-navigation', label: 'Skip to navigation' },
];

export function SkipLinks({ links = defaultLinks }: SkipLinksProps) {
  const handleSkipClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();

    const targetId = href.replace('#', '');
    const targetElement = document.getElementById(targetId);

    if (targetElement) {
      // Smooth scroll to target
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // Set focus to target with tabindex if needed
      if (!targetElement.hasAttribute('tabindex')) {
        targetElement.setAttribute('tabindex', '-1');
      }
      targetElement.focus();

      // Remove temporary tabindex after focus
      setTimeout(() => {
        if (targetElement.getAttribute('tabindex') === '-1') {
          targetElement.removeAttribute('tabindex');
        }
      }, 1000);
    }
  };

  return (
    <nav aria-label="Skip links">
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          className="skip-link"
          onClick={(e) => handleSkipClick(e, link.href)}
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
}

export default SkipLinks;

import { useCallback } from 'react';
import styles from './Footer.module.css';

const navLinks = [
  { label: 'Platform', href: '#platform' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Capabilities', href: '#capabilities' },
  { label: 'Applications', href: '#applications' },
  { label: 'Technology', href: '#technology' },
];

export function Footer() {
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      e.preventDefault();
      const el = document.querySelector(href);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    },
    []
  );

  return (
    <footer className={styles.footer} role="contentinfo">
      <div className={`${styles.inner} container`}>
        <div className={styles.grid}>
          {/* Brand */}
          <div className={styles.brand}>
            <div className={styles.logo}>
              <svg width="24" height="24" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                <rect x="2" y="2" width="24" height="24" rx="6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                <path d="M8 18L14 8L20 18" stroke="var(--color-solar)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10 15H18" stroke="var(--color-solar)" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
                <circle cx="14" cy="6" r="1.5" fill="var(--color-solar)"/>
              </svg>
              <span className={styles.logoText}>
                SolarRoof <span className={styles.logoAccent}>Intelligence</span>
              </span>
            </div>
            <p className={styles.brandDesc}>
              AI and geospatial intelligence for rooftop solar assessment and decision support.
            </p>
          </div>

          {/* Navigation */}
          <div className={styles.column}>
            <h3 className={styles.columnTitle}>Navigation</h3>
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={styles.link}
                onClick={(e) => handleClick(e, link.href)}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Legal */}
          <div className={styles.column}>
            <h3 className={styles.columnTitle}>Legal</h3>
            <a href="#" className={styles.link} onClick={(e) => e.preventDefault()}>
              Privacy Policy
            </a>
            <a href="#" className={styles.link} onClick={(e) => e.preventDefault()}>
              Terms of Service
            </a>
            <a href="#" className={styles.link} onClick={(e) => e.preventDefault()}>
              Disclaimer
            </a>
          </div>
        </div>

        {/* Disclaimer */}
        <div className={styles.disclaimer}>
          <p>
            SolarRoof Intelligence provides preliminary remote analysis and decision support.
            Final system design, structural verification, electrical assessment, and approvals
            require qualified professionals and relevant authorities.
          </p>
        </div>

        {/* Bottom */}
        <div className={styles.bottom}>
          <p className={styles.copyright}>
            © {new Date().getFullYear()} SolarRoof Intelligence. Decision support platform.
          </p>
        </div>
      </div>
    </footer>
  );
}

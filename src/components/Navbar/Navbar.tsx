import { useState, useEffect, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScrollDirection } from '../../hooks/useScrollDirection';
import { ThemeToggle } from '../ThemeToggle/ThemeToggle';
import { ThemeContext } from '../../App';
import styles from './Navbar.module.css';

const navLinks = [
  { label: 'Platform', href: '#platform' },
  { label: 'Workflow', href: '#workflow' },
  { label: 'Bill Optimization', href: '#bill-optimization' },
  { label: 'Capabilities', href: '#capabilities' },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAtTop } = useScrollDirection();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useContext(ThemeContext);

  const handleNavClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      e.preventDefault();
      setMobileOpen(false);
      const el = document.querySelector(href);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    },
    []
  );

  const handleAssess = useCallback(() => {
    setMobileOpen(false);
    navigate('/assessment');
  }, [navigate]);

  // Close mobile menu on escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, []);

  // Lock body scroll when mobile menu open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const isDay = theme === 'day';

  return (
    <header
      className={`${styles.navbar} ${isAtTop ? styles.transparent : styles.solid} ${isDay ? styles.dayMode : ''}`}
      role="banner"
    >
      <nav className={`${styles.inner} container`} aria-label="Main navigation">
        {/* Logo */}
        <a href="#" className={styles.logo} onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
          <svg className={styles.logoIcon} width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <rect x="2" y="2" width="24" height="24" rx="6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            <path d="M8 18L14 8L20 18" stroke="var(--color-solar)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10 15H18" stroke="var(--color-solar)" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
            <circle cx="14" cy="6" r="1.5" fill="var(--color-solar)"/>
          </svg>
          <span className={styles.logoText}>
            SolarRoof <span className={styles.logoAccent}>Intelligence</span>
          </span>
        </a>

        {/* Desktop Nav */}
        <div className={styles.desktopLinks}>
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={styles.navLink}
              onClick={(e) => handleNavClick(e, link.href)}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop Actions */}
        <div className={styles.desktopActions}>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <a
            href="#platform"
            className={styles.exploreLink}
            onClick={(e) => handleNavClick(e, '#platform')}
          >
            Explore Platform
          </a>
          <button className={styles.ctaButton} onClick={handleAssess}>
            Assess a Rooftop
          </button>
        </div>

        {/* Mobile Toggle */}
        <button
          className={`${styles.mobileToggle} ${mobileOpen ? styles.mobileToggleOpen : ''}`}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileOpen}
        >
          <span className={styles.hamburgerLine} />
          <span className={styles.hamburgerLine} />
          <span className={styles.hamburgerLine} />
        </button>
      </nav>

      {/* Mobile Menu */}
      <div
        className={`${styles.mobileMenu} ${mobileOpen ? styles.mobileMenuOpen : ''}`}
        aria-hidden={!mobileOpen}
      >
        <div className={styles.mobileMenuInner}>
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={styles.mobileLink}
              onClick={(e) => handleNavClick(e, link.href)}
              tabIndex={mobileOpen ? 0 : -1}
            >
              {link.label}
            </a>
          ))}
          <div className={styles.mobileThemeRow}>
            <span className={styles.mobileThemeLabel}>Theme</span>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
          <div className={styles.mobileActions}>
            <button
              className={styles.ctaButton}
              onClick={handleAssess}
              tabIndex={mobileOpen ? 0 : -1}
            >
              Assess a Rooftop
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className={styles.overlay}
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
    </header>
  );
}

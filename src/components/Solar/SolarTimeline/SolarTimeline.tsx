import { useSolar } from '@/context/SolarContext';
import styles from './SolarTimeline.module.css';

function formatMinutesToTime(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const ampm = hrs >= 12 ? 'PM' : 'AM';
  const displayHrs = hrs % 12 === 0 ? 12 : hrs % 12;
  return `${String(displayHrs).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${ampm}`;
}

export function SolarTimeline() {
  const { state, dispatch, currentSunPosition } = useSolar();
  const { timeline } = state;

  return (
    <div className={styles.timelineBar} role="region" aria-label="Solar Timeline and Sun Position Control">
      <div className={styles.topRow}>
        {/* Date Selector */}
        <div className={styles.periodGroup}>
          <div className={styles.dateInputWrapper}>
            <input
              type="date"
              className={styles.dateInput}
              value={timeline.date}
              onChange={(e) => dispatch({ type: 'SET_DATE', payload: e.target.value })}
              title="Analysis Date"
              aria-label="Analysis Date"
            />
          </div>
        </div>

        {/* Live Sun Position HUD */}
        <div className={styles.sunHud}>
          <div className={styles.hudItem}>
            <span className={styles.hudLabel}>Azimuth</span>
            <strong className={styles.hudValue}>{currentSunPosition.azimuth}°</strong>
          </div>
          <div className={styles.hudItem}>
            <span className={styles.hudLabel}>Elevation</span>
            <strong className={`${styles.hudValue} ${currentSunPosition.elevation > 0 ? styles.hudHighlight : ''}`}>
              {currentSunPosition.elevation}°
            </strong>
          </div>
          <div className={styles.hudItem}>
            <span className={styles.hudLabel}>Daylight</span>
            <strong className={styles.hudValue}>
              {currentSunPosition.sunrise} – {currentSunPosition.sunset}
            </strong>
          </div>
        </div>
      </div>

      {/* Time Scrubber Slider & Playback Animation Row */}
      <div className={styles.sliderRow}>
        <button
          className={`${styles.playBtn} ${timeline.isPlaying ? styles.playBtnActive : ''}`}
          onClick={() => dispatch({ type: 'TOGGLE_PLAYBACK' })}
          title={timeline.isPlaying ? 'Pause Sun Path Animation' : 'Play Full Day Sun Path'}
          aria-label={timeline.isPlaying ? 'Pause' : 'Play'}
        >
          {timeline.isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
          <span>{timeline.isPlaying ? 'Pause' : 'Play Sun Path'}</span>
        </button>

        {/* Speed multiplier */}
        <div className={styles.speedToggle}>
          {[1, 2, 4].map((spd) => (
            <button
              key={spd}
              className={`${styles.speedBtn} ${timeline.playbackSpeed === spd ? styles.speedActive : ''}`}
              onClick={() => dispatch({ type: 'SET_PLAYBACK_SPEED', payload: spd })}
            >
              {spd}x
            </button>
          ))}
        </div>

        {/* Time Scrubber Slider */}
        <div className={styles.sliderWrapper}>
          <span className={styles.timeBound}>06:00 AM</span>
          <input
            type="range"
            min="360"
            max="1080"
            step="5"
            value={timeline.timeMinutes}
            className={styles.timeSlider}
            onChange={(e) => dispatch({ type: 'SET_TIME', payload: parseInt(e.target.value, 10) })}
            aria-label="Solar Time Scrubber"
          />
          <span className={styles.timeBound}>06:00 PM</span>
        </div>

        {/* Active Time Badge */}
        <div className={styles.currentTimeBadge}>
          <span className={styles.timeClockIcon}>🕒</span>
          <strong>{formatMinutesToTime(timeline.timeMinutes)}</strong>
        </div>
      </div>
    </div>
  );
}

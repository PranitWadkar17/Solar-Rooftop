import { useState, useCallback, useRef, useEffect } from 'react';
import type { GeocodingResult } from '@/types/index.js';
import { searchLocation, autocompleteSuggestions } from '@/services/geocodingService';
import styles from './LocationSearch.module.css';

interface LocationSearchProps {
  onSelectResult: (result: GeocodingResult) => void;
  onUseMyLocation: () => void;
  isLocating: boolean;
}

export function LocationSearch({ onSelectResult, onUseMyLocation, isLocating }: LocationSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [suggestions, setSuggestions] = useState<GeocodingResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced autocomplete on typing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Don't fetch suggestions if we just completed a search
    if (hasSearched) return;

    debounceRef.current = setTimeout(async () => {
      try {
        const data = await autocompleteSuggestions(trimmed);
        setSuggestions(data);
        setShowSuggestions(data.length > 0);
      } catch {
        // Silently fail for autocomplete
        setSuggestions([]);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, hasSearched]);

  // Close suggestions dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setHasSearched(true);
    setSuggestions([]);
    setShowSuggestions(false);

    try {
      const data = await searchLocation(trimmed);
      setResults(data);
      if (data.length === 0) {
        setError('No locations found. Try a different search term or use a broader address.');
      }
    } catch {
      setError('Search failed. Please check your connection and try again.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        setShowSuggestions(false);
        handleSearch();
      }
      if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    },
    [handleSearch]
  );

  const handleSelect = useCallback(
    (result: GeocodingResult) => {
      setQuery(result.displayName.split(',').slice(0, 2).join(','));
      setResults([]);
      setSuggestions([]);
      setShowSuggestions(false);
      setHasSearched(false);
      onSelectResult(result);
    },
    [onSelectResult]
  );

  const handleClear = useCallback(() => {
    setQuery('');
    setResults([]);
    setSuggestions([]);
    setShowSuggestions(false);
    setError(null);
    setHasSearched(false);
    inputRef.current?.focus();
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setHasSearched(false);
    setError(null);
    setResults([]);
  }, []);

  return (
    <div className={styles.searchContainer} ref={containerRef}>
      <div className={styles.searchHeader}>
        <h2 className={styles.searchTitle}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-solar)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          Select Location
        </h2>
        <p className={styles.searchSubtitle}>
          Search for an address or click on the map to select a rooftop location.
        </p>
      </div>

      <div className={styles.inputGroup}>
        <div className={styles.inputWrapper}>
          <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className={styles.searchInput}
            placeholder="Search address, city, or coordinates…"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (suggestions.length > 0 && !hasSearched) setShowSuggestions(true);
            }}
            aria-label="Search location"
            id="location-search-input"
            autoComplete="off"
          />
          {query && (
            <button className={styles.clearBtn} onClick={handleClear} aria-label="Clear search" title="Clear">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}

          {/* Autocomplete Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className={styles.suggestionsDropdown} role="listbox" aria-label="Location suggestions">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  className={styles.suggestionItem}
                  onClick={() => handleSelect(suggestion)}
                  role="option"
                >
                  <svg className={styles.suggestionIcon} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <div className={styles.suggestionContent}>
                    <span className={styles.suggestionName}>
                      {suggestion.addressParts.name || suggestion.displayName.split(',')[0]}
                    </span>
                    <span className={styles.suggestionDetail}>
                      {[
                        suggestion.addressParts.city,
                        suggestion.addressParts.state,
                        suggestion.addressParts.country,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          className={styles.searchBtn}
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          aria-label="Search"
        >
          {loading ? (
            <span className={styles.spinner} />
          ) : (
            <>Search</>
          )}
        </button>
      </div>

      <button
        className={styles.locateBtn}
        onClick={onUseMyLocation}
        disabled={isLocating}
      >
        {isLocating ? (
          <span className={styles.spinner} />
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
            <circle cx="12" cy="12" r="4" />
          </svg>
        )}
        {isLocating ? 'Locating…' : 'Use My Location'}
      </button>

      {/* Full Search Results */}
      {results.length > 0 && (
        <div className={styles.results} role="listbox" aria-label="Search results">
          {results.map((result) => (
            <button
              key={result.id}
              className={styles.resultItem}
              onClick={() => handleSelect(result)}
              role="option"
            >
              <svg className={styles.resultIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <div className={styles.resultContent}>
                <span className={styles.resultName}>
                  {result.addressParts.name || result.displayName.split(',')[0]}
                </span>
                <span className={styles.resultDetail}>
                  {[
                    result.addressParts.city,
                    result.addressParts.state,
                    result.addressParts.country,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              </div>
              <span className={styles.resultCoords}>
                {result.latitude.toFixed(4)}, {result.longitude.toFixed(4)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Error */}
      {error && hasSearched && (
        <div className={styles.errorMsg}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          {error}
        </div>
      )}

      {/* Empty after search */}
      {hasSearched && !loading && !error && results.length === 0 && (
        <div className={styles.emptyMsg}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          No locations found
        </div>
      )}
    </div>
  );
}

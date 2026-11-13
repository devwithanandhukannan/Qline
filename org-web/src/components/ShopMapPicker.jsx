'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Pin } from '@/components/icons';
import { Button, useToast } from '@/components/ui';

const OPENFREEMAP_DARK = 'https://tiles.openfreemap.org/styles/dark';
const DEFAULT_CENTER = [76.3267, 9.9816]; // Kerala / default center [lng, lat]

let maplibrePromise = null;
function loadMapLibre() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Window unavailable'));
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (maplibrePromise) return maplibrePromise;

  maplibrePromise = new Promise((resolve, reject) => {
    if (!document.getElementById('maplibre-gl-css')) {
      const link = document.createElement('link');
      link.id = 'maplibre-gl-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
      document.head.appendChild(link);
    }

    if (window.maplibregl) return resolve(window.maplibregl);

    const existing = document.getElementById('maplibre-gl-js');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.maplibregl));
      existing.addEventListener('error', reject);
      return;
    }

    const script = document.createElement('script');
    script.id = 'maplibre-gl-js';
    script.src = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';
    script.async = true;
    script.onload = () => resolve(window.maplibregl);
    script.onerror = () => reject(new Error('Failed to load map library'));
    document.head.appendChild(script);
  });
  return maplibrePromise;
}

function createPinElement() {
  const el = document.createElement('div');
  el.className = 'qline-map-pin';
  el.style.cursor = 'grab';
  el.innerHTML = `
    <div style="filter: drop-shadow(0 4px 10px rgba(0,0,0,0.8)); transform: translate3d(0,0,0);">
      <svg width="32" height="40" viewBox="0 0 24 30" fill="none">
        <path d="M12 0C5.37 0 0 5.37 0 12C0 21 12 30 12 30C12 30 24 21 24 12C24 5.37 18.63 0 12 0Z" fill="#ffffff" />
        <circle cx="12" cy="11" r="5" fill="#111111" />
      </svg>
    </div>
  `;
  return el;
}

export default function ShopMapPicker({ lat, lng, onChange, onAddressFound }) {
  const toast = useToast();
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  const [loadingMap, setLoadingMap] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const searchTimeoutRef = useRef(null);
  const searchBoxRef = useRef(null);

  const hasCoords = lat !== '' && lng !== '' && lat != null && lng != null;
  const currentLat = hasCoords ? Number(lat) : null;
  const currentLng = hasCoords ? Number(lng) : null;

  // Initialize Map
  useEffect(() => {
    let isCancelled = false;

    loadMapLibre()
      .then((maplibregl) => {
        if (isCancelled || !mapContainerRef.current) return;

        const initialCenter = hasCoords ? [currentLng, currentLat] : DEFAULT_CENTER;
        const initialZoom = hasCoords ? 15 : 12;

        const map = new maplibregl.Map({
          container: mapContainerRef.current,
          style: OPENFREEMAP_DARK,
          center: initialCenter,
          zoom: initialZoom,
          attributionControl: false,
        });

        // Add minimalist navigation controls (zoom in/out)
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

        map.on('load', () => {
          if (isCancelled) return;
          setLoadingMap(false);

          // Create Pin Marker
          const pinEl = createPinElement();
          const marker = new maplibregl.Marker({
            element: pinEl,
            draggable: true,
            anchor: 'bottom',
          })
            .setLngLat(initialCenter)
            .addTo(map);

          marker.on('dragend', () => {
            const p = marker.getLngLat();
            onChange(Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6)));
          });

          // Move pin on map click
          map.on('click', (e) => {
            marker.setLngLat(e.lngLat);
            onChange(Number(e.lngLat.lat.toFixed(6)), Number(e.lngLat.lng.toFixed(6)));
          });

          mapInstanceRef.current = map;
          markerRef.current = marker;
        });
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error(err);
          setLoadingMap(false);
        }
      });

    return () => {
      isCancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  // Sync external lat/lng changes with marker & map
  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current) return;
    if (hasCoords) {
      const pos = markerRef.current.getLngLat();
      if (Math.abs(pos.lat - currentLat) > 0.00001 || Math.abs(pos.lng - currentLng) > 0.00001) {
        markerRef.current.setLngLat([currentLng, currentLat]);
      }
    }
  }, [currentLat, currentLng, hasCoords]);

  // Click outside to close search results
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search places via Nominatim / Photon
  const handleSearchChange = (e) => {
    const q = e.target.value;
    setSearchQuery(q);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!q.trim() || q.trim().length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            q
          )}&limit=5&addressdetails=1`,
          { headers: { 'Accept-Language': 'en' } }
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data);
          setShowResults(true);
        }
      } catch (err) {
        console.error('Search failed', err);
      } finally {
        setSearching(false);
      }
    }, 380);
  };

  const selectPlace = (place) => {
    const targetLat = Number(Number(place.lat).toFixed(6));
    const targetLng = Number(Number(place.lon).toFixed(6));

    if (mapInstanceRef.current && markerRef.current) {
      mapInstanceRef.current.flyTo({ center: [targetLng, targetLat], zoom: 16, essential: true });
      markerRef.current.setLngLat([targetLng, targetLat]);
    }

    onChange(targetLat, targetLng);
    setShowResults(false);
    setSearchQuery(place.display_name.split(',')[0]);

    // Optional helper to populate area or city if empty
    if (onAddressFound && place.address) {
      const city = place.address.city || place.address.town || place.address.village || place.address.county || '';
      const area = place.address.suburb || place.address.neighbourhood || place.address.quarter || '';
      onAddressFound({ city, area, address: place.display_name.split(',').slice(0, 3).join(', ') });
    }
  };

  const locateMe = () => {
    if (!navigator.geolocation) return toast.error('Geolocation is not supported by your browser');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const targetLat = Number(pos.coords.latitude.toFixed(6));
        const targetLng = Number(pos.coords.longitude.toFixed(6));

        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.flyTo({ center: [targetLng, targetLat], zoom: 16, essential: true });
          markerRef.current.setLngLat([targetLng, targetLat]);
        }

        onChange(targetLat, targetLng);
        toast.show('Location detected');
      },
      () => toast.error('Location permission was denied or timed out'),
      { timeout: 9000, enableHighAccuracy: true }
    );
  };

  return (
    <div className="stack-sm">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>Shop Location</label>
        {hasCoords && (
          <span className="small muted font-mono">
            {currentLat}, {currentLng}
          </span>
        )}
      </div>

      {/* Map Card Container */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 340,
          borderRadius: 'var(--r)',
          overflow: 'hidden',
          background: '#0d0d0d',
          border: '1px solid var(--line)',
          boxShadow: 'var(--shadow)',
        }}
      >
        {/* Search Bar overlay on map */}
        <div
          ref={searchBoxRef}
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            right: 12,
            zIndex: 10,
          }}
        >
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(20, 20, 20, 0.92)',
              backdropFilter: 'blur(12px)',
              borderRadius: 'var(--r-sm)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
            }}
          >
            <input
              type="text"
              placeholder="Search area, landmark or town..."
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => results.length > 0 && setShowResults(true)}
              style={{
                width: '100%',
                background: 'transparent',
                border: 0,
                color: '#fff',
                padding: '10px 14px',
                fontSize: 13,
                outline: 'none',
              }}
            />
            {searching && (
              <span style={{ fontSize: 11, color: 'var(--fg-3)', paddingRight: 12 }}>
                Searching...
              </span>
            )}
            {searchQuery && !searching && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setResults([]);
                  setShowResults(false);
                }}
                style={{
                  background: 'transparent',
                  border: 0,
                  color: 'rgba(255, 255, 255, 0.6)',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {showResults && results.length > 0 && (
            <div
              style={{
                marginTop: 6,
                background: 'rgba(18, 18, 18, 0.98)',
                backdropFilter: 'blur(14px)',
                borderRadius: 'var(--r-sm)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                boxShadow: '0 12px 32px rgba(0, 0, 0, 0.65)',
                maxHeight: 220,
                overflowY: 'auto',
              }}
            >
              {results.map((r, i) => {
                const parts = r.display_name.split(',');
                const title = parts[0];
                const subtitle = parts.slice(1, 4).join(',').trim();
                return (
                  <button
                    key={r.place_id || i}
                    type="button"
                    onClick={() => selectPlace(r)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      background: 'transparent',
                      border: 0,
                      borderBottom:
                        i < results.length - 1 ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#f4f4f4' }}>{title}</span>
                    {subtitle && (
                      <span style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{subtitle}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Map Container Target */}
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

        {/* Loading Overlay */}
        {loadingMap && (
          <div
            className="skeleton"
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--fg-3)',
              fontSize: 12,
              letterSpacing: '0.02em',
            }}
          >
            Loading map…
          </div>
        )}
      </div>

      {/* Action and Hint row */}
      <div className="row between wrap" style={{ gap: 8, alignItems: 'center' }}>
        <div className="row wrap" style={{ gap: 8, alignItems: 'center' }}>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={locateMe}
            style={{ alignSelf: 'flex-start' }}
          >
            <Pin width="15" height="15" /> Use my location
          </Button>
          {hasCoords && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${currentLat},${currentLng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn ghost sm"
              style={{
                fontSize: 12,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                textDecoration: 'none',
              }}
            >
              <span>Open in Google Maps</span>
              <span style={{ fontSize: 13 }}>↗</span>
            </a>
          )}
        </div>
        <span className="small muted">
          Drag the pin or click on the map to mark the exact shop location.
        </span>
      </div>
    </div>
  );
}


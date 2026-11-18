import React, { useEffect, useState } from 'react';
import {
  APILoadingStatus,
  APIProvider,
  AdvancedMarker,
  Map as GoogleMap,
  InfoWindow,
  Pin,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
} from '@vis.gl/react-google-maps';
import { formatZmw, parseZoneCoordinates } from '../lib/onegovRules';
import type { RevenueZoneItem } from '../types/onegov';

const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();

export function hasGoogleMapsApiKey(): boolean {
  return Boolean(GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY !== 'MY_GOOGLE_MAPS_API_KEY');
}

interface ZoneMarkerProps {
  zone: RevenueZoneItem;
  isSelected: boolean;
  onSelect: (zone: RevenueZoneItem) => void;
}

const ZoneAdvancedMarker: React.FC<ZoneMarkerProps> = ({ zone, isSelected, onSelect }) => {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [infoOpen, setInfoOpen] = useState(false);

  const coords = parseZoneCoordinates(zone.latitude, zone.longitude);
  if (!coords) return null;

  const pinColor =
    zone.metrics.status === 'critical'
      ? '#dc2626'
      : zone.metrics.status === 'attention'
        ? '#d97706'
        : '#059669';

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={coords}
        title={`${zone.name} (${zone.metrics.performancePct}%)`}
        onClick={() => {
          onSelect(zone);
          setInfoOpen(true);
        }}
      >
        <Pin
          background={pinColor}
          borderColor={isSelected ? '#0B192C' : '#ffffff'}
          glyphColor="#ffffff"
          scale={isSelected ? 1.25 : 1}
        />
      </AdvancedMarker>
      {infoOpen && isSelected && marker && (
        <InfoWindow anchor={marker} maxWidth={240} onCloseClick={() => setInfoOpen(false)}>
          <div className="text-xs text-slate-800 space-y-1 p-0.5">
            <div className="font-bold text-[#0B192C]">{zone.name}</div>
            <div className="text-slate-500">
              {zone.councilName} · {zone.zoneCode}
            </div>
            <div className="font-mono font-semibold">
              {formatZmw(zone.actualRevenueZmw)} / {formatZmw(zone.expectedRevenueZmw)} (
              {zone.metrics.performancePct}%)
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

const MapStatusObserver: React.FC<{ onAuthOrLoadFailure: () => void }> = ({
  onAuthOrLoadFailure,
}) => {
  const status = useApiLoadingStatus();
  useEffect(() => {
    if (status === APILoadingStatus.AUTH_FAILURE) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      onAuthOrLoadFailure();
    } else if (status === APILoadingStatus.FAILED) {
      onAuthOrLoadFailure();
    }
  }, [status, onAuthOrLoadFailure]);
  return null;
};

interface CivicGoogleMapProps {
  zones: RevenueZoneItem[];
  selectedZone: RevenueZoneItem | null;
  onSelectZone: (zone: RevenueZoneItem) => void;
  onFallbackToSchematic?: () => void;
}

export const CivicGoogleMap: React.FC<CivicGoogleMapProps> = ({
  zones,
  selectedZone,
  onSelectZone,
  onFallbackToSchematic,
}) => {
  const [mapFailed, setMapFailed] = useState(false);

  const selectedCoords = selectedZone
    ? parseZoneCoordinates(selectedZone.latitude, selectedZone.longitude)
    : null;
  const defaultCenter = selectedCoords || { lat: -15.4167, lng: 28.2833 };

  if (!hasGoogleMapsApiKey() || mapFailed) {
    return (
      <div className="h-[380px] w-full rounded-lg border border-slate-200 bg-slate-50 flex flex-col items-center justify-center p-6 text-center space-y-3">
        <div className="text-sm font-bold text-[#0B192C]">
          Interactive Google Map Ready for Browser Key
        </div>
        <p className="text-xs text-slate-600 max-w-md leading-relaxed">
          {mapFailed
            ? 'Google Maps JavaScript API could not load in this browser context. Use the Zambia Ward Schematic view for spatial revenue diagnostics.'
            : 'Configure VITE_GOOGLE_MAPS_API_KEY in environment secrets to render live Google Maps tiles & Advanced Markers, or use the Zambia Ward Schematic view.'}
        </p>
        {onFallbackToSchematic && (
          <button
            type="button"
            onClick={onFallbackToSchematic}
            className="px-3.5 py-2 bg-[#0B192C] text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            Switch to Ward Schematic View
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="h-[380px] w-full rounded-lg border border-slate-200 overflow-hidden bg-slate-100"
      data-testid="google-maps-container"
    >
      <APIProvider
        apiKey={GOOGLE_MAPS_API_KEY}
        language="en"
        region="ZM"
        libraries={['marker']}
      >
        <MapStatusObserver onAuthOrLoadFailure={() => setMapFailed(true)} />
        <GoogleMap
          mapId="DEMO_MAP_ID"
          defaultCenter={defaultCenter}
          defaultZoom={6}
          gestureHandling="greedy"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
        >
          {zones.map((zone) => (
            <ZoneAdvancedMarker
              key={zone.id}
              zone={zone}
              isSelected={selectedZone?.id === zone.id}
              onSelect={onSelectZone}
            />
          ))}
        </GoogleMap>
      </APIProvider>
    </div>
  );
};

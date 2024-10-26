import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const MapComponent = () => {
  const mapContainer = useRef(null); // Map container reference
  const map = useRef(null); // Store map instance

  useEffect(() => {
    // Initialize the map once
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://tiles.openfreemap.org/styles/liberty', // OpenFreeMap tiles
      center: [-114.0719, 51.0447], // Calgary coordinates
      zoom: 12,
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right'); // Zoom controls

    // Get the user's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userCoords = [position.coords.longitude, position.coords.latitude];
          new maplibregl.Marker({ color: 'red' }).setLngLat(userCoords).addTo(map.current);
          map.current.flyTo({ center: userCoords, zoom: 15 });
        },
        (error) => alert('Unable to retrieve your location: ' + error.message)
      );
    } else {
      alert('Geolocation not supported.');
    }

    const fetchAndDisplayData = async () => {
      try {
        const [parkingLotsData, parkingZonesData] = await Promise.all([
          fetch('https://data.calgary.ca/resource/ggxk-g2u3.json').then((res) => res.json()),
          fetch('https://data.calgary.ca/resource/rhkg-vwwp.json').then((res) => res.json()),
        ]);
    
        // Process and add parking lot polygons
        parkingLotsData.forEach((lot) => {
          if (lot.multipolygon && Array.isArray(lot.multipolygon.coordinates) && lot.multipolygon.coordinates.length) {
            const coordinates = lot.multipolygon.coordinates[0][0].map(coord => [coord[0], coord[1]]); // Convert to [lng, lat]
    
            const sourceId = lot.globalid; // Generate a unique ID
    
            map.current.addSource(sourceId, {
              type: 'geojson',
              data: {
                type: 'Feature',
                geometry: { type: 'Polygon', coordinates: [coordinates] },
                properties: {
                  lotName: lot.lot_name,
                  address: lot.address_desc,
                  homePage: lot.home_page?.url || '',
                },
              },
            });
    
            map.current.addLayer({
              id: sourceId,
              type: 'fill',
              source: sourceId,
              paint: { 'fill-color': '#088', 'fill-opacity': 0.5 },
            });
    
            map.current.addLayer({
              id: `${sourceId}-outline`,
              type: 'line',
              source: sourceId,
              paint: { 'line-color': '#fff', 'line-width': 2 },
            });
          }
        });
    
        // Process and add parking zone lines
        parkingZonesData.forEach((zone) => {
          if (zone.line && Array.isArray(zone.line.coordinates)) {
            const coordinates = zone.line.coordinates.map(coord => [coord[0], coord[1]]); // Convert to [lng, lat]
    
            const sourceId = `zone-${zone.parking_zone}-${Math.random().toString(36).substr(2, 9)}`; // Generate a unique ID
    
            map.current.addSource(sourceId, {
              type: 'geojson',
              data: {
                type: 'Feature',
                geometry: { 
                  type: 'MultiLineString', 
                  coordinates: coordinates // Use coordinates directly
                },
                properties: {
                  address: zone.address_desc,
                  type: zone.zone_type,
                  enforceableTime: zone.enforceable_time,
                },
              },
            });
    
            map.current.addLayer({
              id: sourceId,
              type: 'line',
              source: sourceId,
              paint: { 'line-color': '#FF8527', 'line-width': 6 },
            });
          }
        });
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    

    fetchAndDisplayData();

    // Clean up the map instance on unmount
    return () => map.current && map.current.remove();
  }, []);

  return <div ref={mapContainer} style={{ width: '100%', height: '500px' }} />;
};


export default MapComponent;

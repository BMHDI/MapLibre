import React, { useEffect, useRef } from 'react';
import L from 'leaflet'; // Import Leaflet
import 'leaflet/dist/leaflet.css'; // Leaflet CSS

// Fix for Leaflet marker icon not displaying correctly
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIconShadow from 'leaflet/dist/images/marker-shadow.png';

const MapComponent = () => {
  const mapContainer = useRef(null); // Reference for map container
  const map = useRef(null); // Store map instance

  useEffect(() => {
    // Initialize map only once
    map.current = L.map(mapContainer.current).setView([51.0447, -114.0719], 12); // Calgary coordinates

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map.current);

    // Adjust Leaflet marker icon paths
    const DefaultIcon = L.icon({
      iconUrl: markerIcon,
      shadowUrl: markerIconShadow,
    });
    L.Marker.prototype.options.icon = DefaultIcon;

    // Get user location and fly to it
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userCoords = [position.coords.latitude, position.coords.longitude];
          L.marker(userCoords).addTo(map.current); // Add marker for user location
          map.current.flyTo(userCoords, 15); // Zoom to user location
        },
        (error) => alert('Unable to retrieve your location: ' + error.message)
      );
    } else {
      alert('Geolocation not supported by your browser.');
    }

    const fetchAndDisplayData = async () => {
      try {
        const [parkingLotsData, parkingZonesData] = await Promise.all([
          fetch('https://data.calgary.ca/resource/ggxk-g2u3.json').then((res) => res.json()),
          fetch('https://data.calgary.ca/resource/rhkg-vwwp.json').then((res) => res.json()),
        ]);

        // Add parking lot polygons
        parkingLotsData.forEach((lot) => {
          if (lot.multipolygon && Array.isArray(lot.multipolygon.coordinates)) {
            const coordinates = lot.multipolygon.coordinates[0][0].map(
              (coord) => [coord[1], coord[0]] // Switch [lng, lat] to [lat, lng]
            );

            L.polygon(coordinates, { color: '#088', fillOpacity: 0.5 }).addTo(map.current)
              .bindPopup(`<strong>${lot.lot_name}</strong><br>${lot.address_desc}`);
          }
        });

        // Add parking zone lines
        parkingZonesData.forEach((zone) => {
          if (zone.line && Array.isArray(zone.line.coordinates)) {
            const coordinates = zone.line.coordinates.map(
              (coord) => [coord[1], coord[0]] // Switch [lng, lat] to [lat, lng]
            );

            L.polyline(coordinates, { color: '#FF8527', weight: 6 }).addTo(map.current)
              .bindPopup(`<strong>Zone Type:</strong> ${zone.zone_type}<br>${zone.address_desc}`);
          }
        });
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchAndDisplayData();

    // Cleanup map instance on unmount
    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, []);

  return <div ref={mapContainer} style={{ width: '100%', height: '500px' }} />;
};

export default MapComponent;

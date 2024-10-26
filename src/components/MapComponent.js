import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet'; // Import Leaflet
import 'leaflet/dist/leaflet.css'; // Leaflet CSS

// Fix for Leaflet marker icon not displaying correctly
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIconShadow from 'leaflet/dist/images/marker-shadow.png';

const MapComponent = () => {
  const mapContainer = useRef(null); // Reference for map container
  const map = useRef(null); // Store map instance
  const [searchTerm, setSearchTerm] = useState(''); // State to store search input
  const markers = useRef([]); // Store markers

  useEffect(() => {
    // Initialize the map
    map.current = L.map(mapContainer.current).setView([51.0447, -114.0719], 12); // Calgary coordinates

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map.current);

    // Set custom marker icon
    const DefaultIcon = L.icon({
      iconUrl: markerIcon,
      shadowUrl: markerIconShadow,
    });
    L.Marker.prototype.options.icon = DefaultIcon;

    // Get user's current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userCoords = [position.coords.latitude, position.coords.longitude];
          const userMarker = L.marker(userCoords).addTo(map.current); // Add marker for user location
          markers.current.push(userMarker); // Store marker reference
          map.current.flyTo(userCoords, 15); // Zoom to user location
        },
        (error) => alert('Unable to retrieve your location: ' + error.message)
      );
    } else {
      alert('Geolocation not supported by your browser.');
    }

    // Fetch and display parking lots and zones
    const fetchAndDisplayData = async () => {
      try {
        const [parkingLotsData, parkingZonesData] = await Promise.all([
          fetch('https://data.calgary.ca/resource/ggxk-g2u3.json').then((res) => res.json()),
          fetch('https://data.calgary.ca/resource/45az-7kh9.json').then((res) => res.json()),
        ]);

        // Add parking lot polygons and markers
        parkingLotsData.forEach((lot) => {
          if (lot.multipolygon && Array.isArray(lot.multipolygon.coordinates)) {
            const coordinates = lot.multipolygon.coordinates[0][0].map(
              (coord) => [coord[1], coord[0]] // Switch [lng, lat] to [lat, lng]
            );

            L.polygon(coordinates, { color: '#088', fillOpacity: 0.5 }).addTo(map.current)
              .bindPopup(`<strong>${lot.lot_name}</strong><br>${lot.address_desc}`);

            // Add marker at the lot's approximate center
            const marker = L.marker(coordinates[0]).bindPopup(
              `<strong>${lot.lot_name}</strong><br>${lot.address_desc}`
            ).addTo(map.current);
            markers.current.push(marker); // Store marker reference
          }
        });

       // Add parking zone lines
parkingZonesData.forEach((zone) => {
  if (
    zone.the_geom && 
    zone.the_geom.type === "MultiLineString" && 
    Array.isArray(zone.the_geom.coordinates)
  ) {
    // Extract each line and swap [lng, lat] to [lat, lng]
    const allCoordinates = zone.the_geom.coordinates.map((line) =>
      line.map((coord) => [coord[1], coord[0]])
    );

    // Create a polyline for each coordinate array
    allCoordinates.forEach((coordinates) => {
      L.polyline(coordinates, { color: '#FF8527', weight: 6 })
        .addTo(map.current)
        .bindPopup(`
          <strong>Zone Type:</strong> ${zone.zone_type}<br>
          <strong>Address:</strong> ${zone.address_desc}<br>
          <strong>Status:</strong> ${zone.status}<br>
          <strong>Max Time:</strong> ${zone.max_time} mins<br>
          <strong>Price Zone:</strong> ${zone.price_zone}<br>
          <strong>Rate:</strong> ${zone.html_zone_rate}
        `);
    });
  }
});
        
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchAndDisplayData();

    // Cleanup map instance on unmount
    return () => {
      if (map.current) map.current.remove();
    };
  }, []);

  // Handle search and zoom to the corresponding marker
  const handleSearch = () => {
    const marker = markers.current.find((marker) =>
      marker.getPopup().getContent().toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (marker) {
      map.current.flyTo(marker.getLatLng(), 15); // Zoom to marker
      marker.openPopup(); // Open popup
    } else {
      alert('Location not found!');
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '10px' }}>
        <input
          type="text"
          placeholder="Search for a location..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ padding: '5px', width: '300px' }}
        />
        <button onClick={handleSearch} style={{ padding: '5px 10px', marginLeft: '5px' }}>
          Search
        </button>
      </div>
      <div ref={mapContainer} style={{ width: '100%', height: '500px' }} />
    </div>
  );
};

export default MapComponent;

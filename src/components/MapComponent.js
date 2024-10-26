import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for Leaflet marker icon not displaying correctly
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIconShadow from 'leaflet/dist/images/marker-shadow.png';

const MapComponent = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredResults, setFilteredResults] = useState([]); // Store dropdown results
  const [parkingLots, setParkingLots] = useState([]);
  const [parkingZones, setParkingZones] = useState([]);

  useEffect(() => {
    map.current = L.map(mapContainer.current).setView([51.0447, -114.0719], 12);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map.current);

    const DefaultIcon = L.icon({
      iconUrl: markerIcon,
      shadowUrl: markerIconShadow,
    });
    L.Marker.prototype.options.icon = DefaultIcon;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userCoords = [position.coords.latitude, position.coords.longitude];
          L.marker(userCoords).addTo(map.current).bindPopup('Your Location').openPopup();
          map.current.flyTo(userCoords, 15);
        },
        (error) => alert('Unable to retrieve your location: ' + error.message)
      );
    } else {
      alert('Geolocation not supported by your browser.');
    }

    const fetchAndDisplayData = async () => {
      try {
        const [lotsData, zonesData] = await Promise.all([
          fetch('https://data.calgary.ca/resource/ggxk-g2u3.json').then((res) => res.json()),
          fetch('https://data.calgary.ca/resource/45az-7kh9.json').then((res) => res.json()),
        ]);

        setParkingLots(lotsData);
        setParkingZones(zonesData);

        lotsData.forEach((lot) => {
          if (lot.multipolygon && Array.isArray(lot.multipolygon.coordinates)) {
            const coordinates = lot.multipolygon.coordinates[0][0].map((coord) => [
              coord[1],
              coord[0],
            ]);
            L.polygon(coordinates, { color: '#088', fillOpacity: 0.5 })
              .addTo(map.current)
              .bindPopup(`<strong>${lot.lot_name}</strong><br>${lot.address_desc}`);
          }
        });

        zonesData.forEach((zone) => {
          if (
            zone.the_geom &&
            zone.the_geom.type === 'MultiLineString' &&
            Array.isArray(zone.the_geom.coordinates)
          ) {
            zone.the_geom.coordinates.forEach((line) => {
              const coordinates = line.map((coord) => [coord[1], coord[0]]);
              L.polyline(coordinates, { color: '#FF8527', weight: 6 })
                .addTo(map.current)
                .bindPopup(`
                  <strong>Zone Type:</strong> ${zone.zone_type}<br>
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

    return () => {
      if (map.current) map.current.remove();
    };
  }, []);

  
// Haversine formula to calculate the distance between two coordinates
const getDistance = (coord1, coord2) => {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = ((coord2[0] - coord1[0]) * Math.PI) / 180;
  const dLon = ((coord2[1] - coord1[1]) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((coord1[0] * Math.PI) / 180) *
      Math.cos((coord2[0] * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
};

// Handle user input and filter matching results
const handleInputChange = (e) => {
  const value = e.target.value;
  setSearchTerm(value);

  if (value) {
    const filteredLots = parkingLots.filter((lot) =>
      lot.lot_name?.toLowerCase().includes(value.toLowerCase()) ||
      lot.address_desc?.toLowerCase().includes(value.toLowerCase())
    );

    const filteredZones = parkingZones.filter((zone) =>
      zone.zone_type?.toLowerCase().includes(value.toLowerCase()) ||
      zone.status?.toLowerCase().includes(value.toLowerCase())
    );

    // Combine results
    let results = [...filteredLots, ...filteredZones];

    // Get user's current location from the browser
    navigator.geolocation.getCurrentPosition((position) => {
      const userLocation = [position.coords.latitude, position.coords.longitude];

      // Sort results by proximity to user's location
      results.sort((a, b) => {
        const aCoord = a.multipolygon
          ? [a.multipolygon.coordinates[0][0][0][1], a.multipolygon.coordinates[0][0][0][0]]
          : [a.the_geom.coordinates[0][0][1], a.the_geom.coordinates[0][0][0]];

        const bCoord = b.multipolygon
          ? [b.multipolygon.coordinates[0][0][0][1], b.multipolygon.coordinates[0][0][0][0]]
          : [b.the_geom.coordinates[0][0][1], b.the_geom.coordinates[0][0][0]];

        return getDistance(userLocation, aCoord) - getDistance(userLocation, bCoord);
      });

      // Update state with sorted results
      setFilteredResults(results);
    });
  } else {
    setFilteredResults([]);
  }
};

// Handle selection from dropdown
const handleSelect = (item) => {
  setSearchTerm(''); // Clear search input
  setFilteredResults([]); // Clear dropdown

  let coordinates;

  if (item.multipolygon) {
    coordinates = item.multipolygon.coordinates[0][0].map((coord) => [coord[1], coord[0]]);
    map.current.flyTo(coordinates[0], 15);
    L.popup()
      .setLatLng(coordinates[0])
      .setContent(`<strong>${item.lot_name}</strong><br>${item.address_desc}`)
      .openOn(map.current);
  } else if (item.the_geom) {
    coordinates = item.the_geom.coordinates[0].map((coord) => [coord[1], coord[0]]);
    map.current.flyTo(coordinates[0], 15);
    L.popup()
      .setLatLng(coordinates[0])
      .setContent(`
        <strong>Zone Type:</strong> ${item.zone_type}<br>
        <strong>Status:</strong> ${item.status}<br>
        <strong>Rate:</strong> ${item.html_zone_rate}
      `)
      .openOn(map.current);
  }
};

  return (
    <div>
      <div style={{ marginBottom: '10px', position: 'relative' }}>
        <input
          type="text"
          placeholder="Search for a location, price, or availability..."
          value={searchTerm}
          onChange={handleInputChange}
          style={{ padding: '5px', width: '300px' }}
        />
        {filteredResults.length > 0 && (
          <ul
            style={{
              position: 'absolute',
              top: '35px',
              width: '300px',
              backgroundColor: 'white',
              border: '1px solid #ccc',
              listStyle: 'none',
              padding: '0',
              margin: '0',
              zIndex: 1000,
              maxHeight: '150px',
              overflowY: 'auto',
            }}
          >
            {filteredResults.map((item, index) => (
              <li
                key={index}
                onClick={() => handleSelect(item)}
                style={{ padding: '10px', cursor: 'pointer' }}
              >
                {item.lot_name || item.zone_type}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div ref={mapContainer} style={{ width: '100%', height: '80vh' }} />
    </div>
  );
};

export default MapComponent;

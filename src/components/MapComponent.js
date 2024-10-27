import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIconShadow from 'leaflet/dist/images/marker-shadow.png';

const MapComponent = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredResults, setFilteredResults] = useState([]);
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
              .bindPopup(`<strong>${lot.lot_name}</strong><br>${lot.address_desc}<br><a href="${lot.home_page.url}">More Info</a>`);
          }
        });

        zonesData.forEach((zone) => {
          if (zone.the_geom?.type === 'MultiLineString' && Array.isArray(zone.the_geom.coordinates)) {
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

      setFilteredResults([...filteredLots, ...filteredZones]);
    } else {
      setFilteredResults([]);
    }
  };

  const handleSelect = (item) => {
    setSearchTerm('');
    setFilteredResults([]);

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
      <div style={{ marginBottom: '0px', position: 'relative' }}>
        <input
          type="text"
          placeholder="Search for a location, price, or availability..."
          value={searchTerm}
          onChange={handleInputChange}
          style={{ padding: '5px', width: '240px', marginRight: '10px',width: '70%' }}
        />
        {filteredResults.length > 0 && (
          <ul style={{ position: 'absolute', backgroundColor: 'white', zIndex: 1000 }}>
            {filteredResults.map((item, index) => (
              <li key={index} onClick={() => handleSelect(item)}>{item.lot_name || item.zone_type}</li>
            ))}
          </ul>
        )}
      </div>
      <div ref={mapContainer} style={{ height: '500px' }} />
    </div>
  );
};

export default MapComponent;

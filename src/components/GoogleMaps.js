import React, { useEffect, useRef, useState } from 'react';

const MapComponent = () => {
  const mapContainer = useRef(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredResults, setFilteredResults] = useState([]); // Store dropdown results
  const [parkingLots, setParkingLots] = useState([]);
  const [parkingZones, setParkingZones] = useState([]);
  const [map, setMap] = useState(null);
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    // Initialize Google Map
    const initMap = () => {
      const googleMap = new window.google.maps.Map(mapContainer.current, {
        center: { lat: 51.0447, lng: -114.0719 },
        zoom: 12,
      });
      setMap(googleMap);
    };

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
            const coordinates = lot.multipolygon.coordinates[0][0].map((coord) => ({
              lat: coord[1],
              lng: coord[0],
            }));
            const polygon = new window.google.maps.Polygon({
              paths: coordinates,
              strokeColor: '#088',
              strokeOpacity: 0.8,
              strokeWeight: 2,
              fillColor: '#088',
              fillOpacity: 0.5,
            });
            polygon.setMap(googleMap);
            polygon.addListener('click', () => {
              new window.google.maps.InfoWindow({
                content: `<strong>${lot.lot_name}</strong><br>${lot.address_desc}<br>${lot.home_page.url}`,
              }).open(googleMap, polygon.getPath().getAt(0));
            });
          }
        });

        zonesData.forEach((zone) => {
          if (
            zone.the_geom &&
            zone.the_geom.type === 'MultiLineString' &&
            Array.isArray(zone.the_geom.coordinates)
          ) {
            zone.the_geom.coordinates.forEach((line) => {
              const coordinates = line.map((coord) => ({
                lat: coord[1],
                lng: coord[0],
              }));
              const polyline = new window.google.maps.Polyline({
                path: coordinates,
                geodesic: true,
                strokeColor: '#FF8527',
                strokeOpacity: 1.0,
                strokeWeight: 6,
              });
              polyline.setMap(googleMap);
              polyline.addListener('click', () => {
                new window.google.maps.InfoWindow({
                  content: `
                    <strong>Zone Type:</strong> ${zone.zone_type}<br>
                    <strong>Status:</strong> ${zone.status}<br>
                    <strong>Max Time:</strong> ${zone.max_time} mins<br>
                    <strong>Price Zone:</strong> ${zone.price_zone}<br>
                    <strong>Rate:</strong> ${zone.html_zone_rate}
                  `,
                }).open(googleMap, polyline.getPath().getAt(0));
              });
            });
          }
        });
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    const getUserLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const userCoords = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };
            setUserLocation(userCoords);
            new window.google.maps.Marker({
              position: userCoords,
              map: map,
              title: 'Your Location',
            });
            map.setCenter(userCoords);
          },
          (error) => alert('Unable to retrieve your location: ' + error.message)
        );
      } else {
        alert('Geolocation not supported by your browser.');
      }
    };

    initMap();
    getUserLocation();
    fetchAndDisplayData();

    return () => {
      setMap(null);
    };
  }, []);

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
      const results = [...filteredLots, ...filteredZones];

      // Sort results by proximity to user's location
      if (userLocation) {
        results.sort((a, b) => {
          const aCoord = a.multipolygon
            ? { lat: a.multipolygon.coordinates[0][0][0][1], lng: a.multipolygon.coordinates[0][0][0][0] }
            : { lat: a.the_geom.coordinates[0][0][1], lng: a.the_geom.coordinates[0][0][0] };

          const bCoord = b.multipolygon
            ? { lat: b.multipolygon.coordinates[0][0][0][1], lng: b.multipolygon.coordinates[0][0][0][0] }
            : { lat: b.the_geom.coordinates[0][0][1], lng: b.the_geom.coordinates[0][0][0] };

          return getDistance(userLocation, aCoord) - getDistance(userLocation, bCoord);
        });
      }

      // Update state with sorted results
      setFilteredResults(results);
    } else {
      setFilteredResults([]);
    }
  };

  // Haversine formula to calculate the distance between two coordinates
  const getDistance = (coord1, coord2) => {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = ((coord2.lat - coord1.lat) * Math.PI) / 180;
    const dLon = ((coord2.lng - coord1.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((coord1.lat * Math.PI) / 180) *
        Math.cos((coord2.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in kilometers
  };

  // Handle selection from dropdown
  const handleSelect = (item) => {
    setSearchTerm(''); // Clear search input
    setFilteredResults([]); // Clear dropdown

    let coordinates;

    if (item.multipolygon) {
      coordinates = item.multipolygon.coordinates[0][0].map((coord) => ({
        lat: coord[1],
        lng: coord[0],
      }));
      map.setCenter(coordinates[0]);
      new window.google.maps.InfoWindow({
        content: `<strong>${item.lot_name}</strong><br>${item.address_desc}`,
      }).open(map, new window.google.maps.Marker({ position: coordinates[0], map: map }));
    } else if (item.the_geom) {
      coordinates = item.the_geom.coordinates[0].map((coord) => ({
        lat: coord[1],
        lng: coord[0],
      }));
      map.setCenter(coordinates[0]);
      new window.google.maps.InfoWindow({
        content: `
          <strong>Zone Type:</strong> ${item.zone_type}<br>
          <strong>Status:</strong> ${item.status}<br>
          <strong>Rate:</strong> ${item.html_zone_rate}
        `,
      }).open(map, new window.google.maps.Marker({ position: coordinates[0], map: map }));
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
              <li key={index} onClick={() => handleSelect(item)} style={{ padding: '5px', cursor: 'pointer' }}>
                {item.lot_name || item.zone_type}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div
        ref={mapContainer}
        style={{ width: '100%', height: '500px' }}
      ></div>
    </div>
  );
};

export default MapComponent;

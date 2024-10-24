import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const MapComponent = () => {
  const mapContainer = useRef(null); // Reference to the map container div

  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapContainer.current, // DOM element to display the map
      style: 'https://tiles.openfreemap.org/styles/liberty', // OpenFreeMap tiles
      center: [-114.0719, 51.0447], // Example: Calgary coordinates
      zoom: 12, // Zoom level
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right'); // Zoom controls

    const popup = new maplibregl.Popup({ closeOnClick: false });

    // Add click event to the layer
    map.on('click', (e) => {
      const features = map.queryRenderedFeatures(e.point);
      if (features.length) {
        const feature = features[0];
        popup
          .setLngLat(e.lngLat)
          .setHTML(`<h3>${feature.properties.lotName}</h3><p>${feature.properties.address}</p><a href="${feature.properties.homePage}" target="_blank">More Info</a>`)
          .addTo(map);
      }
    });

    // Fetch parking lot data
    fetch('https://data.calgary.ca/resource/ggxk-g2u3.json')
      .then((response) => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
      })
      .then((data) => {
        data.forEach((item) => {
          // Extract the coordinates for the polygon
          const coordinates = item.multipolygon.coordinates[0][0].map(coord => {
            return [coord[0], coord[1]]; // Map to [lng, lat] format
          });

          // Create a polygon layer
          map.addSource(item.globalid, {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: [coordinates], // Polygon coordinates
              },
              properties: {
                lotName: item.lot_name, // Add more properties if needed
                address: item.address_desc,
                homePage: item.home_page.url,
              },
            },
          });

          // Add a layer to visualize the polygon
          map.addLayer({
            id: item.globalid, // Unique ID for the layer
            type: 'fill',
            source: item.globalid,
            layout: {},
            paint: {
              'fill-color': '#088', // Color of the polygon
              'fill-opacity': 0.5,  // Transparency
            },
          });

          // Optional: Add a border around the polygon
          map.addLayer({
            id: `${item.globalid}-outline`, // Unique ID for the outline layer
            type: 'line',
            source: item.globalid,
            layout: {},
            paint: {
              'line-color': '#fff', // Color of the border
              'line-width': 2,      // Width of the border
            },
          });
        });
      })
      .catch((error) => {
        console.error('Error fetching data:', error);
      });

    return () => map.remove(); // Clean up map instance on unmount
  }, []);

  return <div ref={mapContainer} style={{ width: '100%', height: '500px' }} />;
};

export default MapComponent;

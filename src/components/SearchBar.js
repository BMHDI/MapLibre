// SearchBar.js
import React, { useState } from 'react';

const SearchBar = ({ onSearch, filteredResults, onSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    // Call onSearch to handle filtering as the user types
    onSearch(value);
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        placeholder="Search for a location, price, or availability..."
        value={searchTerm}
        onChange={handleInputChange}
        style={{ padding: '5px', width: '70%', marginRight: '10px' }}
      />
      <button onClick={() => onSearch(searchTerm)} style={{ padding: '5px' }}>
        Search
      </button>
      {filteredResults.length > 0 && (
        <ul style={{ position: 'absolute', backgroundColor: 'white', zIndex: 1000 }}>
          {filteredResults.map((item, index) => (
            <li key={index} onClick={() => onSelect(item)}>{item.lot_name || item.zone_type}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SearchBar;

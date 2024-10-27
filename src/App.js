import React from 'react';
import MapComponent from './components/MapComponent';
import NavigationBar from './components/NavigationBar'; 

const App = () => {
  return (
    <>
    <NavigationBar />

      <div className="App">
       
        <MapComponent />
      </div>
    </>
  );
};

export default App;

import logo from './logo.svg';
import './App.scss';
import React, { useState, useEffect } from "react";
import { ReactPlaylister } from "./components/ReactPlaylister";

function App() {

  const [urls, setUrls] = useState([
    'https://www.youtube.com/watch?v=ysz5S6PUM-U',
    'https://www.youtube.com/watch?v=K5LU8K7ZK34',
    'https://soundcloud.com/i_d_magazine/premiere-sonnymoon-grains-of-friends',
    'https://www.kiki.com',
    'https://www.youtube.com/watch?v=NwMOpaxroTg',
    'https://www.caca.com'
  ]);

  const handleTogglePrevious = (bool) => {
    console.log("APP / CAN PREVIOUS ?",bool);
  }

  const handleToggleNext = (bool) => {
    console.log("APP / CAN NEXT ?",bool);
  }

  const handleIndex = (index) => {
    console.log("APP / INDEX",index);
  }

  return (
    <div className="App">
      <div id="inputPlaylist">
        <textarea>
        {JSON.stringify(urls,null,2) }
        </textarea>
      </div>
      <ReactPlaylister
      urls={urls}
      loop={false}
      autoskip={true}
      onTogglePrevious={handleTogglePrevious}
      onToggleNext={handleToggleNext}
      onIndex={handleIndex}
      />
    </div>
  );
}

export default App;

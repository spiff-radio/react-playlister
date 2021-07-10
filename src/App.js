import logo from './logo.svg';
import './App.scss';
import React, { useState, useEffect, useRef } from "react";
import { ReactPlaylister } from "./components/ReactPlaylister";

function App() {

  const playlistRef = useRef();
  const inputRef = useRef();

  const [urls, setUrls] = useState([
    'https://www.youtube.com/watch?v=ysz5S6PUM-U',
    'https://www.youtube.com/watch?v=K5LU8K7ZK34',
    'https://soundcloud.com/i_d_magazine/premiere-sonnymoon-grains-of-friends',
    'https://www.kiki.com',
    'https://www.youtube.com/watch?v=NwMOpaxroTg',
    'https://www.caca.com'
  ]);

  const [loop, setLoop] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [autoskip, setAutoskip] = useState(true);

  const [index, setIndex] = useState(0);//current url index
  const [url, setUrl] = useState();//current url
  const [ignoredUrls,setIgnoredUrls] = useState(); //non-playable URLs
  const [ignoredUrlKeys,setIgnoredUrlKeys] = useState(); //non-playable URLs
  const [hasPrevious,setHasPrevious] = useState();
  const [hasNext,setHasNext] = useState();

  const handleTogglePrevious = (bool) => {
    setHasPrevious(bool);
  }

  const handleToggleNext = (bool) => {
    setHasNext(bool);
  }

  const handleIndex = (index) => {
    console.log("handleIndex",index);
    const url = urls[index];
    setIndex(index);
    setUrl(url);
  }

  const handleGetReactPlayer = (e) => {
    e.preventDefault();
    const player = playlistRef.current.getReactPlayer();
    console.log(player);
  }

  const handleUpdateUrls = (e) => {
    e.preventDefault();
    let arr = JSON.parse(inputRef.current.value);
    arr = arr.filter(item => item);//remove empty values
    setUrls(arr);
  }

  const handleIgnoredUrls = (obj) => {
    const keys = Object.keys(obj);
    setIgnoredUrlKeys(keys);

    let urls = Object.values(obj);
    urls = [...new Set(urls)];//make unique
    setIgnoredUrls(urls);
  }

  return (
    <div className="App">
      <div id="inputPlaylist">
        <textarea
        ref={inputRef}
        >
        {JSON.stringify(urls,null,2) }
        </textarea>
        <p>
          <button
          onClick={handleUpdateUrls}
          >update</button>
        </p>

      </div>
      <ReactPlaylister
      ref={playlistRef}
      index={2}
      urls={urls}
      playing={playing}
      loop={loop}
      autoskip={autoskip}
      onTogglePrevious={handleTogglePrevious}
      onToggleNext={handleToggleNext}
      onIndex={handleIndex}
      onIgnoredUrls={handleIgnoredUrls}
      />
      {
        playlistRef.current &&
          <div id="controls">

            <p>
              <strong>current source url</strong>
              <span>{url}</span>
            </p>

            <p>
              <strong>current source key</strong>
              <span>#{index}</span>
            </p>

            <p>
              <strong>ignored URLs</strong>
              <span>{ignoredUrls.join(", ")}</span>
            </p>

            <p>
              <strong>ignored URL keys</strong>
              <span>{ignoredUrlKeys.join(", ")}</span>
            </p>

            <p>
              <strong>loop</strong>
              <span>{loop ? 'true' : 'false'}</span>
              <button
              onClick={(e) => setLoop(!loop)}
              >toggle</button>
            </p>

            <p>
              <strong>playing</strong>
              <span>{playing ? 'true' : 'false'}</span>
              <button
              onClick={(e) => setPlaying(!playing)}
              >toggle</button>
            </p>

            <p>
              <button
              onClick={(e) => playlistRef.current.previous()}
              disabled={!hasPrevious}
              >Previous</button>
            </p>

            <p>
              <button
              onClick={(e) => playlistRef.current.next()}
              disabled={!hasNext}
              >Next</button>
            </p>

            <p>
              <button
              onClick={handleGetReactPlayer}
              >Get ReactPlayer instance (see console)</button>
            </p>

          </div>
      }
    </div>
  );
}

export default App;

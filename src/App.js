import logo from './logo.svg';
import './App.scss';
import React, { useState, useEffect, useRef } from "react";
import { ReactPlaylister } from "./components/ReactPlaylister";

const ReactPlaylistUrl = props => {
  return(
    <>
    {props.url}
    </>
  );
}

const ReactPlaylistTrack = props => {

  if (Array.isArray(props.track)){
    return (
        <ul>
        {
          props.track.map((url,urlKey) => {
            return(
              <li key={urlKey}>
                <ReactPlaylistUrl
                url={url}
                />
              </li>
            )
          })
        }
        </ul>
    );
  }else{
    return(
      <ReactPlaylistUrl
      url={props.track}
      />
    )
  }

}

function App() {

  const playlistRef = useRef();
  const inputRef = useRef();

  const [playlist, setUrls] = useState([
    'https://www.youtube.com/watch?v=E11DAkrjlP8',
    [
      'https://www.youtube.com/watch?v=K5LU8K7ZK34',
      'https://soundcloud.com/i_d_magazine/premiere-sonnymoon-grains-of-friends'
    ],
    [
      'https://soundcloud.com/santigold/who-be-lovin-me-feat-ilovemakonnen',
      'https://www.youtube.com/watch?v=i0PD1nVz0kA',
      'https://www.youtube.com/watch?v=v3RTs0LCc-8'
    ],
    'https://www.notplayable.com',
    'https://www.notplayable.com',
    'https://www.notplayableeither.com',
    'https://www.youtube.com/watch?v=Q4zJrX5u0Bw',

  ]);

  const [loop, setLoop] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [autoskip, setAutoskip] = useState(true);

  const [trackIndexGUI, setTrackIndexGUI] = useState(0);//current url index
  const [url, setUrl] = useState();//current url
  const [ignoredUrls,setIgnoredUrls] = useState([]); //non-playable URLs
  const [ignoredUrlKeys,setIgnoredUrlKeys] = useState([]); //non-playable URLs
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
    const url = playlistRef.current.getCurrentUrl();

    setTrackIndexGUI(index);
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

  const handleIgnoredUrls = (ignoredUrls) => {
    setIgnoredUrls(ignoredUrls);
  }

  const handleIgnoredKeys = (ignoredKeys) => {
    const output = ignoredKeys.map(function(arr) {
      return '['+arr.join(",")+']';
    });
    setIgnoredUrlKeys(output);
  }

  return (
    <div className="App">
      <div id="feedback">
      <div id="input">
      <textarea
      ref={inputRef}
      >
      {JSON.stringify(playlist,null,2) }
      </textarea>
      </div>
        <div id="output">
          <ul>
          {

            playlist.map((track,trackKey) => {
              return (
                <li key={trackKey}>
                  <ReactPlaylistTrack
                  track={track}
                  />
                </li>
              );
            })
          }
          </ul>
        </div>
      </div>
      <p>
        <button
        onClick={handleUpdateUrls}
        >update</button>
      </p>
      <ReactPlaylister
      ref={playlistRef}
      index={0}
      playlist={playlist}
      playing={playing}
      loop={loop}
      autoskip={autoskip}
      onTogglePrevious={handleTogglePrevious}
      onToggleNext={handleToggleNext}
      onIndex={handleIndex}
      onIgnoredUrls={handleIgnoredUrls}
      onIgnoredKeys={handleIgnoredKeys}
      />
      {
        playlistRef.current &&
          <div id="controls">

            <p>
              <strong>current track key</strong>
              <span>{trackIndexGUI}</span>
            </p>

            <p>
              <strong>current source url</strong>
              <span>{url}</span>
            </p>

            <p>
              <strong>ignored URLs</strong>
              <span>{ignoredUrls.join(", ")}</span>
            </p>

            <p>
              <strong>ignored URL keys</strong>
              <span>{
                //URGENT
                ignoredUrlKeys.join(", ")
              }</span>
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
              onClick={(e) => playlistRef.current.previousTrack()}
              disabled={!hasPrevious}
              >Previous</button>
            </p>

            <p>
              <button
              onClick={(e) => playlistRef.current.nextTrack()}
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

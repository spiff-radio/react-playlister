import logo from './logo.svg';
import './App.scss';
import React, { useState, useEffect, useRef } from "react";
import { ReactPlaylister } from "./components/ReactPlaylister";
import classNames from "classnames";

const printIndex = (index) =>{
  if (Array.isArray(index)){
    index = index.join(',');
    index = '['+index+']';
  }
  return index;
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
      'https://www.notplayable.com',
      'https://www.youtube.com/watch?v=v3RTs0LCc-8',
    ],
    'https://www.notplayable.com',
    'https://www.notplayable.com',
    'https://www.notplayableeither.com',
    'https://www.youtube.com/watch?v=Q4zJrX5u0Bw',

  ]);

  const [loop, setLoop] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [autoskip, setAutoskip] = useState(true);


  const [url, setUrl] = useState();//current url
  const [ignoredUrls,setIgnoredUrls] = useState([]); //non-playable URLs
  const [ignoredUrlKeys,setIgnoredUrlKeys] = useState([]); //non-playable keys
  const [hasPreviousTrack,setHasPreviousTrack] = useState();
  const [hasNextTrack,setHasNextTrack] = useState();

  const [trackIndexGUI, setTrackIndexGUI] = useState(0);//current url index
  const [ignoredUrlKeysGUI,setIgnoredUrlKeysGUI] = useState(); //non-playable keys - as a string

  const ReactPlaylistUrl = props => {

    //TOUFIX URGENT uses references SO does not work for now
    const playable = !ignoredUrlKeys.includes(props.index);

    console.log("CHECK PLAYABLE",props.index,ignoredUrlKeys);

    return(
      <span
      className={
        classNames({
          url:true,
          playable:playable
        })
      }
      >
      {props.url} - {printIndex(props.index)}
      </span>
    );
  }

  const ReactPlaylistTrack = props => {

    let inner;

    if (Array.isArray(props.track)){
      inner = (
          <ul>
          {
            props.track.map((url,urlKey) => {
              return(
                <li key={urlKey}>
                  <ReactPlaylistUrl
                  url={url}
                  index={[props.index,urlKey]}
                  />
                </li>
              )
            })
          }
          </ul>
      );
    }else{
      inner = (
        <ReactPlaylistUrl
        url={props.track}
        index={props.index}
        playlistRef={props.playlistRef}
        />
      )
    }

    const playable = !ignoredUrlKeys.includes(props.index);

    return (
      <span
      className={
        classNames({
          track:true,
          playable:playable
        })
      }
      >
        {inner}
      </span>

    );

  }

  const handleTogglePreviousTrack = (bool) => {
    setHasPreviousTrack(bool);
  }

  const handleToggleNextTrack = (bool) => {
    setHasNextTrack(bool);
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

  const handleIgnoredKeys = (keys) => {

    setIgnoredUrlKeys(keys);

    let str = keys.map(function(arr) {
      return printIndex(arr);
    });
    str = str.join(", ");
    setIgnoredUrlKeysGUI(str);

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
            playlistRef.current &&
              playlist.map((track,trackKey) => {
                return (
                  <li
                  key={trackKey}
                  >
                    <ReactPlaylistTrack
                    index={trackKey}
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
      onTogglePreviousTrack={handleTogglePreviousTrack}
      onToggleNextTrack={handleToggleNextTrack}
      onIndex={handleIndex}
      onIgnoredKeys={handleIgnoredKeys}
      onIgnoredUrls={handleIgnoredUrls}
      />
      {
        playlistRef.current &&
          <div id="controls">

            <p>
              <strong>index</strong>
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
              <span>{ignoredUrlKeysGUI}</span>
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
              <strong>track</strong>
              <button
              onClick={(e) => playlistRef.current.previousTrack()}
              disabled={!hasPreviousTrack}
              >Previous</button>
              <button
              onClick={(e) => playlistRef.current.nextTrack()}
              disabled={!hasNextTrack}
              >Next</button>
            </p>

            <p>
              <strong>track URLs</strong>
              <button
              onClick={(e) => playlistRef.current.previousTrack()}
              disabled={!hasPreviousTrack}
              >Previous</button>
              <button
              onClick={(e) => playlistRef.current.nextTrack()}
              disabled={!hasNextTrack}
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

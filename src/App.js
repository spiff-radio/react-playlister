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

  const playlisterRef = useRef();
  const inputRef = useRef();

  const [urls, setUrls] = useState([
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

  const [playerPlaylist, setPlayerPlaylist] = useState([]);

  const [loop, setLoop] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [autoskip, setAutoskip] = useState(true);


  const [hasPreviousTrack,setHasPreviousTrack] = useState();
  const [hasNextTrack,setHasNextTrack] = useState();

  const [trackIndexGUI, setTrackIndexGUI] = useState(0);//current url index

  const ReactPlaylistFeedBack = props => {

    const ReactPlaylistSource = props => {

      return(
        <span
        className={
          classNames({
            source:true,
            playable:props.playable,
            current:props.current
          })
        }
        >
        {props.url}
        </span>
      );
    }

    const ReactPlaylistTrack = props => {

      return(
        <ul>
        {
          props.sources.map((source,sourceKey) => {
            const current = props.current && (props.source_index === sourceKey);
            return(
              <li key={sourceKey}>
                <ReactPlaylistSource
                url={source.url}
                playable={source.playable}
                current={current}
                />
              </li>
            )
          })
        }
        </ul>
      );

    }

    return(
      <ul>
      {
        playerPlaylist.tracks &&
          playerPlaylist.tracks.map((track,trackKey) => {
            return (
              <li
              key={trackKey}
              >
                <ReactPlaylistTrack
                sources={track.sources}
                playable={track.playable}
                current={playerPlaylist.track_index === trackKey}
                source_index={track.source_index}
                />
              </li>
            );
          })
      }
      </ul>
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
    const url = playlisterRef.current.getCurrentUrl();

    setTrackIndexGUI(index);
  }

  const handleUpdated = playlist => {
    console.log("APP/PLAYER PLAYLIST",playlist);
    setPlayerPlaylist(playlist);
  }

  const handleGetReactPlayer = (e) => {
    e.preventDefault();
    const player = playlisterRef.current.getReactPlayer();
    console.log(player);
  }

  const handleUpdateUrls = (e) => {
    e.preventDefault();
    let arr = JSON.parse(inputRef.current.value);
    arr = arr.filter(item => item);//remove empty values
    setUrls(arr);
  }

  const trackIndex = playerPlaylist.track_index;
  const track = playerPlaylist.tracks ? playerPlaylist.tracks[trackIndex] : undefined;
  const sourceIndex = track ? track.source_index : undefined;

  return (
    <div className="App">
      <div id="feedback">
      <div id="input">
      <textarea
      ref={inputRef}
      >
      {JSON.stringify(urls,null,2) }
      </textarea>
      </div>
        <div id="output">
          <ReactPlaylistFeedBack
          playlist={playerPlaylist}
          />
        </div>
      </div>
      <p>
        <button
        onClick={handleUpdateUrls}
        >update</button>
      </p>
      {
        playerPlaylist &&
          <div id="controls">

            <p>
              <strong>track #{trackIndex}</strong>
              <button
              onClick={(e) => playlisterRef.current.previousTrack()}
              disabled={!hasPreviousTrack}
              >Previous</button>
              <button
              onClick={(e) => playlisterRef.current.nextTrack()}
              disabled={!hasNextTrack}
              >Next</button>
            </p>

            <p>
              <strong>source #{sourceIndex}</strong>
              <button
              onClick={(e) => playlisterRef.current.previousTrack()}
              disabled={!hasPreviousTrack}
              >Previous</button>
              <button
              onClick={(e) => playlisterRef.current.nextTrack()}
              disabled={!hasNextTrack}
              >Next</button>
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
              <strong>autoskip</strong>
              <span>{autoskip ? 'true' : 'false'}</span>
              <button
              onClick={(e) => setAutoskip(!autoskip)}
              >toggle</button>
            </p>

            <p>
              <button
              onClick={handleGetReactPlayer}
              >Get ReactPlayer instance (see console)</button>
            </p>

          </div>
      }
      <ReactPlaylister
      ref={playlisterRef}
      index={0}
      urls={urls}
      playing={playing}
      loop={loop}
      autoskip={autoskip}
      onTogglePreviousTrack={handleTogglePreviousTrack}
      onToggleNextTrack={handleToggleNextTrack}
      onIndex={handleIndex}
      onUpdated={handleUpdated}
      />
    </div>
  );
}

export default App;

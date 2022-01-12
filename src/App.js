import logo from './logo.svg';
import './App.scss';
import 'semantic-ui-css/semantic.min.css';
import React, { useState, useEffect,useRef } from "react";
import { ReactPlaylister } from "./components/ReactPlaylister";
import { AppFeedback } from "./components/AppFeedback";
import { AppControls } from "./components/AppControls";

function App() {

  const playlisterRef = useRef();
  const inputRef = useRef();

  const [urls, setUrls] = useState([
    'https://www.youtube.com/watch?v=E11DAkrjlP8',
    [
      'https://www.youtube.com/watch?v=K5LU8K7ZK34',
      'https://www.youtube.com/watch?v=K5LU8K7ZK34',
      'https://soundcloud.com/i_d_magazine/premiere-sonnymoon-grains-of-friends',
      'https://soundcloud.com/this-one-will/fire-an-error-when-loaded'
    ],
    [],
    [
      'https://soundcloud.com/santigold/who-be-lovin-me-feat-ilovemakonnen',
      'https://www.youtube.com/watch?v=i0PD1nVz0kA',
      'https://www.notplayable.com',
      'https://www.youtube.com/watch?v=v3RTs0LCc-8',
      'https://soundcloud.com/this-one-will/fire-an-error-when-loaded'
    ],
    'https://www.notplayable.com',
    'https://www.notplayable.com',
    'https://www.notplayableeither.com',
    'https://www.youtube.com/watch?v=Q4zJrX5u0Bw',

  ]);

  const [index,setIndex] = useState([3,1]);
  const [playlisterPlaylist, setPlaylisterPlaylist] = useState();
  const [playlisterControls, setPlaylisterControls] = useState();

  const [loop, setLoop] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [playRequest, setPlayRequest] = useState(false);
  const [autoskip, setAutoskip] = useState(true);

  //sync the playRequest state with the media playing state:
  //(eg. because we've used the Youtube controls to play the media instead of our play button)
  useEffect(() => {
    if (!playlisterControls) return;
    setPlayRequest(playlisterControls.playing);
  }, [playlisterControls]);

  const handlePlaylistUpdated = (playlist) => {
    console.log("APP / PLAYLIST UPDATED",playlist);
    setPlaylisterPlaylist(playlist);
  }

  const handleControlsUpdated = (controls) => {
    console.log("APP / CONTROLS UPDATED",controls);
    setPlaylisterControls(controls);
  }

  const handlePlaylistEnded = () => {
    console.log("PLAYLIST ENDED");
  }

  const handleSourceSelect = (index) => {
    console.log("APP / SOURCE SELECT",index);
    setIndex(index);
  }

  const handleUpdateUrls = (e) => {
    e.preventDefault();
    let arr = JSON.parse(inputRef.current.value);
    arr = arr.filter(item => item);//remove empty values
    setUrls(arr);
  }


  console.log("APP RELOAD");

  return (
    <div className="App">
      <div id="intro">
        <p>
          <a href="https://github.com/gordielachance/react-playlister" target="_blank" rel="noreferrer">ReactPlaylister</a> is a React component wrapper to build a playlist on top of the <a href="https://github.com/cookpete/react-player/" target="_blank" rel="noreferrer">React Player</a> component.
        </p>
        <p>
          Input should be an array of "tracks".  A track can be a single URL or an array of URLs; which can be useful if one or more link is not playable.
        </p>
      </div>
      <div id="feedback">
        <div id="input">
          <h3>Input</h3>
          <textarea
          ref={inputRef}
          defaultValue={JSON.stringify(urls,null,2) }
          />
          <p>
            <button
            onClick={handleUpdateUrls}
            >Load</button>
          </p>
        </div>
        <div id="output">
          <h3>Feedback</h3>
          <AppFeedback
          urls={urls}
          playlist={playlisterPlaylist}
          controls={playlisterControls}
          onSelect={handleSourceSelect}
          />
        </div>
      </div>
      <AppControls
      playlister={playlisterRef}
      playlist={playlisterPlaylist}
      controls={playlisterControls}
      loop={loop}
      shuffle={shuffle}
      autoskip={autoskip}
      onTogglePlay={(bool) => setPlayRequest(bool)}
      onToggleLoop={(bool) => setLoop(bool)}
      onToggleShuffle={(bool) => setShuffle(bool)}
      onToggleAutoskip={(bool) => setAutoskip(bool)}
      />
      <ReactPlaylister
      ref={playlisterRef}

      /*
      props
      */

      //URLs input array.
      //It can be single-level array (each item is a source);
      //or two-levels (each item is a track; which means an array of sources)
      urls={urls}
      //force select an item.
      //if your input is single-level; set the source index
      //if your input is two-levels; either the track index OR the [track index, source index]
      index={index}
      loop={loop}
      shuffle={shuffle}
      autoskip={autoskip}
      //disabledProviders={['soundcloud']}

      /*
      ReactPlayer props
      */

      playing={playRequest}
      controls={true}
      /*
      light={}
      volume={}
      muted={}
      playbackRate={}
      width={}
      height={}
      style={}
      progressInterval={}
      playsinline={}
      pip={}
      stopOnUnmount={}
      fallback={}
      wrapper={}
      playIcon={}
      previewTabIndex={}
      config={}
      */

      /*
      Callback props
      */
      onControlsUpdated={handleControlsUpdated}
      onPlaylistUpdated={handlePlaylistUpdated}
      onPlaylistEnded={handlePlaylistEnded}
      /*
      ReactPlayer callback props
      onPlay={}
      onPause={}
      onReady={}
      onStart={}
      onProgress={}
      onDuration={}
      onBuffer={}
      onBufferEnd={}
      onSeek={}
      onEnded={}
      onError={}
      onClickPreview={}
      onEnablePIP={}
      onDisablePIP={}
      */
      />
    </div>
  );
}

export default App;

import logo from './logo.svg';
import './App.scss';
import 'semantic-ui-css/semantic.min.css';
import React, { useState, useRef } from "react";
import { ReactPlaylister } from "./components/ReactPlaylister";
import { AppFeedback } from "./components/AppFeedback";


function App() {

  const playlisterRef = useRef();
  const inputRef = useRef();

  const [urls, setUrls] = useState([
    'https://www.youtube.com/watch?v=E11DAkrjlP8',
    [
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
    ],
    'https://www.notplayable.com',
    'https://www.notplayable.com',
    'https://www.notplayableeither.com',
    'https://www.youtube.com/watch?v=Q4zJrX5u0Bw',

  ]);

  const [index,setIndex] = useState([3,1]);
  const [playlisterPlaylist, setPlaylisterPlaylist] = useState();
  const [playlisterControls, setPlaylisterControls] = useState({});

  const [loop, setLoop] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [playRequest, setPlayRequest] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [autoskip, setAutoskip] = useState(true);

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

  const handleSkipping = (bool) => {
    console.log((bool===true) ? '**START SKIP**' : '**STOP SKIP**');
  }

  const handlePlay = () =>{
    setPlayRequest(true);
    setPlaying(true);
  }

  const handlePause = () =>{
    setPlayRequest(false);
    setPlaying(false);
  }

  const handleGetReactPlayer = (e) => {
    e.preventDefault();
    const player = playlisterRef.current.getReactPlayer();
    console.log(player);
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

  const track = playlisterControls.track;
  const trackIndex = track ? track.index : undefined;
  const hasPreviousTrack = playlisterControls?.has_previous_track;
  const hasNextTrack = playlisterControls?.has_next_track;

  const source = playlisterControls.source;
  const sourceIndex = source ? source.index : undefined;
  const hasPreviousSource = playlisterControls?.has_previous_source;
  const hasNextSource = playlisterControls?.has_next_source;

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
          >
          {JSON.stringify(urls,null,2) }
          </textarea>
          <p>
            <button
            onClick={handleUpdateUrls}
            >Load</button>
          </p>
        </div>
        <div id="output">
          <h3>Feedback</h3>
          <AppFeedback
          playlist={playlisterPlaylist}
          controls={playlisterControls}
          onSelect={handleSourceSelect}
          />
        </div>
      </div>
      {
        playlisterPlaylist &&
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
              onClick={(e) => playlisterRef.current.previousSource()}
              disabled={!hasPreviousSource}
              >Previous</button>
              <button
              onClick={(e) => playlisterRef.current.nextSource()}
              disabled={!hasNextSource}
              >Next</button>
            </p>

            <p>
              <strong>playing</strong>
              <span>{playing ? 'true' : 'false'}</span>&nbsp;
              <button
              onClick={(e) => setPlayRequest(!playing)}
              >toggle</button>
            </p>

            <p>
              <strong>loop</strong>
              <span>{loop ? 'true' : 'false'}</span>&nbsp;
              <button
              onClick={(e) => setLoop(!loop)}
              >toggle</button>
            </p>

            <p>
              <strong>shuffle</strong>
              <span>{shuffle ? 'true' : 'false'}</span>&nbsp;
              <button
              onClick={(e) => setShuffle(!shuffle)}
              >toggle</button>
            </p>

            <p>
              <strong>autoskip</strong>
              <span>{autoskip ? 'true' : 'false'}</span>&nbsp;
              <button
              onClick={(e) => setAutoskip(!autoskip)}
              >toggle</button><br/>
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
      autoskip={autoskip}
      disabledProviders={['soundcloud']}

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
      onPlaylistUpdated={handlePlaylistUpdated}
      onControlsUpdated={handleControlsUpdated}
      onPlaylistEnded={handlePlaylistEnded}
      onSkipping={handleSkipping}
      /*
      ReactPlayer callback props
      */
      onPlay={handlePlay}
      onPause={handlePause}
      /*
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

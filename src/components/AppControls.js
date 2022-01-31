import React from "react";
import { getCurrentTrack,getCurrentSource } from "./ReactPlaylister/utils.js";

export const AppControls = props => {

  const playlist = props.playlist;
  const controls = props.controls;
  const playlisterRef = props.playlister;

  const currentTrack = getCurrentTrack(playlist);
  const currentSource = getCurrentSource(playlist);

  const trackIndex = currentTrack?.index;
  const sourceIndex = currentSource?.index;

  const hasPreviousTrack = controls?.has_previous_track;
  const hasNextTrack = controls?.has_next_track;
  const hasPreviousSource = controls?.has_previous_source;
  const hasNextSource = controls?.has_next_source;

  const handleLoop = (bool) => {
    if (typeof props.onToggleLoop === 'function') {
      props.onToggleLoop(bool);
    }
  }

  const handlePlay = (bool) => {
    if (typeof props.onTogglePlay === 'function') {
      props.onTogglePlay(bool);
    }
  }

  const handleShuffle = (bool) => {
    if (typeof props.onToggleShuffle === 'function') {
      props.onToggleShuffle(bool);
    }
  }

  const handleGetReactPlayer = (e) => {
    e.preventDefault();
    const player = playlisterRef.current.getReactPlayer();
    console.log(player);
  }


  return(
    <div id="controls">
      <>
      {
        controls &&
        <>
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
            {
              controls.loading ?
              <span>...</span>
              :
              <span>{controls.playing ? 'true' : 'false'}</span>
            }

            &nbsp;
            <button
            onClick={(e) => handlePlay(!controls.playing)}
            >toggle</button>
          </p>

          <p>
            <strong>loop</strong>
            <span>{props.loop ? 'true' : 'false'}</span>&nbsp;
            <button
            onClick={(e) => handleLoop(!props.loop)}
            >toggle</button>
          </p>

          <p>
            <strong>shuffle</strong>
            <span>{props.shuffle ? 'true' : 'false'}</span>&nbsp;
            <button
            onClick={(e) => handleShuffle(!props.shuffle)}
            >toggle</button>
          </p>

          <p>
            <button
            onClick={handleGetReactPlayer}
            >Get ReactPlayer instance (see console)</button>
          </p>
        </>
      }
      </>
    </div>
  );

}

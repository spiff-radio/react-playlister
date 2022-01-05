import React from "react";
import classNames from "classnames";
import { Label } from 'semantic-ui-react';

export const AppControls = props => {

  const playlisterControls = props.controls;
  const playlisterRef = props.playlister;
  const playlisterPair = props.current;


  const trackIndex = playlisterPair[0] ?? undefined;
  const sourceIndex = playlisterPair[1] ?? undefined;

  const hasPreviousTrack = playlisterControls?.has_previous_track;
  const hasNextTrack = playlisterControls?.has_next_track;
  const hasPreviousSource = playlisterControls?.has_previous_source;
  const hasNextSource = playlisterControls?.has_next_source;

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
    if (typeof props.onToggleSHuffle === 'function') {
      props.onToggleSHuffle(bool);
    }
  }

  const handleAutoskip = (bool) => {
    if (typeof props.onToggleAutoskip === 'function') {
      props.onToggleAutoskip(bool);
    }
  }

  const handleGetReactPlayer = (e) => {
    e.preventDefault();
    const player = playlisterRef.current.getReactPlayer();
    console.log(player);
  }


  return(
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
        {
          (playlisterControls.playLoading || playlisterControls.mediaLoading) ?
          <span>...</span>
          :
          <span>{playlisterControls.playing ? 'true' : 'false'}</span>
        }

        &nbsp;
        <button
        onClick={(e) => handlePlay(!playlisterControls.playing)}
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
        <strong>autoskip</strong>
        <span>{props.autoskip ? 'true' : 'false'}</span>&nbsp;
        <button
        onClick={(e) => handleAutoskip(!props.autoskip)}
        >toggle</button><br/>
      </p>

      <p>
        <button
        onClick={handleGetReactPlayer}
        >Get ReactPlayer instance (see console)</button>
      </p>

    </div>
  );

}

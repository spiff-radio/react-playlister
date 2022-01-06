import React from "react";

export const AppControls = props => {

  const playlisterData = props.playlisterData;
  const playlisterRef = props.playlister;

  //get current track & source
  const track = playlisterData?.playlist.find(function(track) {
    return track.current;
  });

  const source = track?.sources.find(function(source) {
    return source.current;
  });

  const trackIndex = track?.index;
  const sourceIndex = source?.index;

  const hasPreviousTrack = playlisterData?.has_previous_track;
  const hasNextTrack = playlisterData?.has_next_track;
  const hasPreviousSource = playlisterData?.has_previous_source;
  const hasNextSource = playlisterData?.has_next_source;

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
      <>
      {
        playlisterData &&
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
              (playlisterData.playLoading || playlisterData.mediaLoading) ?
              <span>...</span>
              :
              <span>{playlisterData.playing ? 'true' : 'false'}</span>
            }

            &nbsp;
            <button
            onClick={(e) => handlePlay(!playlisterData.playing)}
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
        </>
      }
      </>
    </div>
  );

}

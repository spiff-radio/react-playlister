import React from "react";
import classNames from "classnames";

export const AppFeedback = props => {

  const SourceFeedback = props => {

    const handleSourceSelect = (e) => {
      if (typeof props.onSelect === 'function') {
        props.onSelect([props.track_index,props.source_index]);
      }
    }

    return(
      <span
      onClick={handleSourceSelect}
      >
      {props.url}
      </span>
    );
  }

  const TrackFeedback = props => {

    let content;

    const handleTrackSelect = (e) => {
      if (typeof props.onSelect === 'function') {
        props.onSelect([props.track_index]);
      }
    }

    if (!props.sources.length){

      content =
      <em
      onClick={handleTrackSelect}
      >No sources
      </em>;
    }else{
      content =
      <ul>
        {
          props.sources.map((source,sourceKey) => {
            const isActive = (props.source_index === sourceKey);
            const isCurrent = props.current && isActive;

            return(
              <li
              key={sourceKey}

              className={
                classNames({
                  source:true,
                  playable:source.playable,
                  current:isCurrent,
                  active:isActive
                })
              }
              >
                <SourceFeedback
                url={source.url}
                track_index={props.track_index}
                source_index={sourceKey}
                onSelect={props.onSelect}
                />
              </li>
            )
          })
        }
      </ul>
    }

    return(
content
    );

  }

  return(
    <ul>
    {
      props.playlist.map((track,trackKey) => {
        const isCurrent = (props.controls.track_index === trackKey);
        const source_index = track.current_source;
        return (
          <li
          key={trackKey}
          className={
            classNames({
              track:true,
              playable:track.playable,
              current:isCurrent
            })
          }
          >
            <TrackFeedback
            sources={track.sources}
            current={isCurrent}
            track_index={trackKey}
            source_index={source_index}
            onSelect={props.onSelect}
            />
          </li>
        );
      })
    }
    </ul>
  );

}

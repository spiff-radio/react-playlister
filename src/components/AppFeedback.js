import React from "react";
import classNames from "classnames";

export const AppFeedback = props => {

  const SourceFeedback = props => {

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

  const TrackFeedback = props => {

    return(
      <ul>
      {
        props.sources.map((source,sourceKey) => {
          const current = props.current && (props.source_index === sourceKey);
          return(
            <li key={sourceKey}>
              <SourceFeedback
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
      props.playlist.map((track,trackKey) => {
        const isCurrent = (props.controls.track_index === trackKey);
        const source_index = isCurrent ? props.controls.source_index : undefined;
        return (
          <li
          key={trackKey}
          >
            <TrackFeedback
            sources={track.sources}
            playable={track.playable}
            current={isCurrent}
            source_index={source_index}
            />
          </li>
        );
      })
    }
    </ul>
  );

}

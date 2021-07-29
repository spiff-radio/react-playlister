import React from "react";
import classNames from "classnames";

export const AppFeedback = props => {

  const SourceFeedback = props => {

    return(
      <span>
      {props.url}
      </span>
    );
  }

  const TrackFeedback = props => {

    let content;

    if (!props.sources.length){
      content = <em>No sources</em>;
    }else{
      content =
      <ul>
        {
          props.sources.map((source,sourceKey) => {
            const isCurrent = props.current && (props.source_index === sourceKey);
            return(
              <li
              key={sourceKey}
              className={
                classNames({
                  source:true,
                  playable:source.playable,
                  current:isCurrent
                })
              }
              >
                <SourceFeedback
                url={source.url}
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
        const source_index = isCurrent ? props.controls.source_index : undefined;
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
            source_index={source_index}
            />
          </li>
        );
      })
    }
    </ul>
  );

}

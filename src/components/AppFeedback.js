import React from "react";
import classNames from "classnames";
import { Label } from 'semantic-ui-react';

export const AppFeedback = props => {

  const playlist = props.playlist;
  const indices = props.indices;

  const SourceFeedback = props => {

    const source = props.data;


    const handleSourceSelect = (e) => {
      if (typeof props.onSelect === 'function') {
        props.onSelect([props.trackIndex,props.sourceIndex]);
      }
    }

    return(
      <span
      onClick={handleSourceSelect}
      >
        <Label>
        #{source.index}
        </Label>

        <span>{source.url}</span>
        {
          source.provider &&
          <Label color="teal">{source.provider.name}</Label>
        }
        {
          source.disabled &&
          <Label color="orange">disabled</Label>
        }
        {
          !source.playable &&
          <Label color="red" title={source.error}>error</Label>
        }
        {
          props.selected &&
          <Label color="black">selected</Label>
        }
      </span>
    );
  }

  const TrackFeedback = props => {

    let content;
    const currentSourceIndex = props.sourceIndex;

    const handleTrackSelect = (e) => {
      if (typeof props.onSelect === 'function') {
        props.onSelect([props.trackIndex]);
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
          props.sources.map((source,index) => {
            const isSelected = source.current;
            const isCurrent = props.current && isSelected;

            return(
              <li
              key={index}

              className={
                classNames({
                  source:true,
                  current:isCurrent
                })
              }
              >
                <SourceFeedback
                sourceIndex={source.index}
                trackIndex={source.trackIndex}
                onSelect={props.onSelect}
                selected={isSelected}
                data={source}
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
    <>
      {
        playlist &&
        <ul>
        {
          playlist.map((track,index) => {

            const isCurrent = track.current;

            return (
              <li
              key={index}
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
                trackIndex={index}
                onSelect={props.onSelect}
                />
              </li>
            );
          })
        }
        </ul>
      }
    </>
  );

}

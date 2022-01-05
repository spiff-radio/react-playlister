import React from "react";
import classNames from "classnames";
import { Label } from 'semantic-ui-react';

export const AppFeedback = props => {

  const playlist = props.playlist || [];

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
        <Label>
        #{props.index}
        </Label>

        <span>{props.url}</span>
        {
          props.provider &&
          <Label color="teal">{props.provider.name}</Label>
        }
        {
          !props.autoplay &&
          <Label color="orange">no autoplay</Label>
        }
        {
          !props.playable &&
          <Label color="red">not playable</Label>
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
            const isSelected = (source.current === true);
            const isCurrent = props.current && isSelected;

            return(
              <li
              key={sourceKey}

              className={
                classNames({
                  source:true,
                  current:isCurrent
                })
              }
              >
                <SourceFeedback
                url={source.url}
                index={source.index}
                autoplay={source.autoplay}
                track_index={props.track_index}
                source_index={sourceKey}
                provider={source.provider}
                selected={isSelected}
                playable={source.playable}
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
      playlist.map((track,trackKey) => {
        const playlisterTrack = props.playlister.current.getTrackByIndex(trackKey);
        const isCurrent = playlisterTrack.current;


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
            onSelect={props.onSelect}
            />
          </li>
        );
      })
    }
    </ul>
  );

}

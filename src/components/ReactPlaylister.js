import React, { useState, useEffect } from "react";
import ReactPlayer from 'react-player';

export const ReactPlaylister = (props) => {

  const [unplayableUrls,setUnplayableUrls] = useState([]);//list of unplayable URLs

  const [index, setIndex] = useState(0);//current url index
  const [url, setUrl] = useState();//current url
  const [hasPrevious,setHasPrevious] = useState(true);//can we play the previous track ?
  const [hasNext,setHasNext] = useState(true);//can we play the next track ?
  const [reverse,setReverse] = useState(false);//do we iterate URLs backwards ?

  const getNextPlayableIndex = (index,loop,reverse) => {

    const getNextIndex = (index,loop,reverse) => {

      if (index === undefined) return;

      let newIndex;
      let endIndex = props.urls.length-1;

      if (!reverse){
        newIndex = index+1;

        if (index === endIndex){
          if (props.loop){
            return 0;
          }else{
            return;
          }
        }

        return newIndex;
      }else{
        newIndex = index-1;

        if (index === 0){
          if (props.loop){
            return endIndex;
          }else{
            return;
          }
        }

        return newIndex;
      }
    }

    if (index === undefined) return;

    const initialIndex = index;
    let newIndex;
    while ( newIndex===undefined )  {

      index = getNextIndex(index,loop,reverse);

      if (index === undefined) break; //no next index found
      if (index === initialIndex) break; //avoid infinite loop !

      //ignore non-playable URLs (keep iterating)
      const nextUrl = props.urls[index];
      const nextPlayable = !unplayableUrls.includes(nextUrl);
      if (!nextPlayable) continue;

      newIndex = index;

    }

    return newIndex;

  }

  const appendUnplayableUrl = (url) => {
    let urls = [...unplayableUrls];
    urls.push(url);
    urls = [...new Set(urls)];//make unique
    setUnplayableUrls(urls);
  }

  const handlePrevious = () => {
    setReverse(true);
    const newIndex = getNextPlayableIndex(index,props.loop,true);
    if (newIndex !== undefined){
      setIndex(newIndex);
    }
  }

  const handleNext = () => {
    setReverse(false);
    const newIndex = getNextPlayableIndex(index,props.loop,false);
    if (newIndex !== undefined){
      setIndex(newIndex);
    }
  }

  const handleReady = () => {
    setReverse(false);//if we were skipping backwards, resets it.
    if (typeof props.onReady === 'function') {
      props.onReady();
    }
  }

  const handleError = (e) => {
    alert("ERROR");
    appendUnplayableUrl(url);
    if (typeof props.onError === 'function') {
      props.onError(e);
    }

    //skip automatically if the player is playing
    if (props.playing && props.autoskip){
      const newIndex = getNextPlayableIndex(index,props.loop,reverse);
      if (newIndex !== undefined){
        setIndex(newIndex);
      }
    }

  }

  //sort non-playable URLs when urls prop is updated
  useEffect(() => {

    let playable = props.urls.filter(ReactPlayer.canPlay);
    let unplayable = props.urls.filter(x => !playable.includes(x));

    unplayable = unplayableUrls.concat(unplayable); //let's keep the old unplayable items; it could be useful!
    unplayable = [...new Set(unplayable)];//make unique
    setUnplayableUrls(unplayable);

  }, [props.urls]);


  //update index when prop changes
  useEffect(() => {
    if (props.index === undefined) return;
    setIndex(parseInt(props.index));
  }, [props.index]);


  useEffect(() => {
    //update URL when index changes
    const url = props.urls[index];
    if (url){
        setUrl(url);
    }
    //tell parent index has changed
    if (typeof props.onIndex === 'function') {
      props.onIndex(index);
    }
  }, [index]);

  //update previous/next controls
  useEffect(() => {
    setHasPrevious( (getNextPlayableIndex(index,props.loop,true) !== undefined) );
    setHasNext( (getNextPlayableIndex(index,props.loop,false) !== undefined) );
  }, [index,unplayableUrls]);

  //let know parent if we can go backward
  useEffect(() => {
    if (typeof props.onTogglePrevious === 'function') {
      props.onTogglePrevious(hasPrevious);
    }
  }, [hasPrevious]);

  //let know parent if we can go forward
  useEffect(() => {
    if (typeof props.onToggleNext === 'function') {
      props.onToggleNext(hasNext);
    }
  }, [hasNext]);


  //when non-playable URLs are updated
  useEffect(() => {
    console.log("NOT PLAYABLE URLS",unplayableUrls);
  }, [unplayableUrls]);

  return (
    <div className="react-playlister">
      <div id="controls">
        <p><strong>index</strong><span>{index}</span></p>
        <p><strong>url</strong><span>{url}</span></p>
        <p><strong>non playable</strong><span>{JSON.stringify(unplayableUrls,null,2)}</span></p>
        <p><strong>loop</strong><span>{props.loop ? 'true' : 'false'}</span></p>

        <p>
          <button
          onClick={handlePrevious}
          disabled={!hasPrevious}
          >Previous</button>
        </p>

        <p>
          <button
          onClick={handleNext}
          disabled={!hasNext}
          >Next</button>
        </p>

      </div>
      <ReactPlayer
      url={url}
      onError={handleError}
      onReady={handleReady}
      />
    </div>
  );
}

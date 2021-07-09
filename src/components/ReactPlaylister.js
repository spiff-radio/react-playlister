import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle  } from "react";
import ReactPlayer from 'react-player';

export const ReactPlaylister = forwardRef((props, ref) => {

  const reactPlayerRef = useRef();

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

  //if any, update current index when urls prop is updated (url could have moved within array)
  useEffect(() => {
    if (index===undefined) return;

    let newIndex = props.urls.indexOf(url);
    newIndex = (newIndex !== -1) ? newIndex : 0;
    setIndex(newIndex);

  }, [props.urls]);

  //update index when prop changes
  useEffect(() => {
    if (props.index === undefined) return;
    setIndex(parseInt(props.index));
  }, [props.index]);

  useEffect(() => {
    //update URL when index changes
    const url = props.urls[index];
    setUrl(url);

    //tell parent index has changed
    if (typeof props.onIndex === 'function') {
      props.onIndex(index);
    }
  }, [index,props.urls]);

  //sort non-playable URLs when urls prop is updated
  useEffect(() => {

    let playable = props.urls.filter(ReactPlayer.canPlay);
    let unplayable = props.urls.filter(x => !playable.includes(x));

    unplayable = [...new Set(unplayable)];//make unique
    setUnplayableUrls(unplayable);

  }, [props.urls]);

  //update previous/next controls
  useEffect(() => {
    setHasPrevious( (getNextPlayableIndex(index,props.loop,true) !== undefined) );
    setHasNext( (getNextPlayableIndex(index,props.loop,false) !== undefined) );
  }, [index,unplayableUrls,props.loop]);

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

  //when non-playable URLs are updated; return an object of ignored keys=>urls to the parent
  useEffect(() => {

    const getIgnoredUrlsObj = () => {
      let urlsObj = Object.assign({},props.urls);//array to object
      let output = {};

      for (const [key, url] of Object.entries(urlsObj)) {
        if ( unplayableUrls.includes(url) ){
          output[key] = url;
        }
      }
      return output;
    }

    if (typeof props.onIgnoredUrls === 'function') {
      const ignored = getIgnoredUrlsObj();
      props.onIgnoredUrls(ignored);
    }

  }, [unplayableUrls]);

  //methods parent can use
  //https://medium.com/@nugen/react-hooks-calling-child-component-function-from-parent-component-4ea249d00740
  useImperativeHandle(
      ref,
      () => ({
        previous() {
          setReverse(true);
          const newIndex = getNextPlayableIndex(index,props.loop,true);
          if (newIndex !== undefined){
            setIndex(newIndex);
          }
        },
        next() {
          setReverse(false);
          const newIndex = getNextPlayableIndex(index,props.loop,false);
          if (newIndex !== undefined){
            setIndex(newIndex);
          }
        },
        getReactPlayer(){
          return reactPlayerRef.current;
        }
       }),
   )

  return (
    <div className="react-playlister">
      <ReactPlayer
      ref={reactPlayerRef}
      playing={props.playing}
      url={url}
      onError={handleError}
      onReady={handleReady}
      />
    </div>
  );
})

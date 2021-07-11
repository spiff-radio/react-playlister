import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle  } from "react";
import ReactPlayer from 'react-player';

export const ReactPlaylister = forwardRef((props, ref) => {

  const reactPlayerRef = useRef();

  //const [flatUrls,setFlatUrls] = useState();//flattened array of urls
  //const [urlMap,setUrlMap] = useState();//"needles" for flatUrls
  const [playlist,setPlaylist] = useState([]);//all URLs as arrays
  const [track,setTrack] = useState([]);//current array of URLs
  const [url, setUrl] = useState();//current url

  const [ignoredUrls,setIgnoredUrls] = useState([]);//list of unplayable URLs
  const [ignoredKeys,setIgnoredKeys] = useState([]);//list of unplayable URLs; as a list of indices

  const [trackIndex, setTrackIndex] = useState(props.index);
  const [urlIndex, setUrlIndex] = useState(0);

  const [hasPrevious,setHasPrevious] = useState(true);//can we play the previous track ?
  const [hasNext,setHasNext] = useState(true);//can we play the next track ?
  const [backwards,setBackwards] = useState(false);//do we iterate URLs backwards ?
  const autoskip = (props.autoskip !== undefined) ? props.autoskip : true; //when a URL does not play, skip to next one ?

  const getNextPlayableIndex = (index,loop,backwards) => {

    const getNextPlayableIndexes = (index,loop,backwards) => {

      //build a queue of keys based on an array
      //If index is NOT defined, it will return the full array.
      const getQueueKeys = (array,index,loop,backwards) => {
        const allKeys =  [...array.keys()];//array of keys
        let previousKeys = [];
        let nextKeys = [];
        let keysQueue = [];

        if (index !== undefined){
          var nextIndex = index+1;

          if (nextIndex < allKeys.length){
            nextKeys = allKeys.slice(nextIndex);
          }

          if (index > 0){
            previousKeys = allKeys.slice(0,index);
          }

        }else{
          nextKeys = allKeys;
        }

        if (loop){
          nextKeys = previousKeys = nextKeys.concat(previousKeys);
        }

        if (backwards === true){
          keysQueue = previousKeys.reverse();
        }else{
          keysQueue = nextKeys;
        }

        return keysQueue;
      }

      const queueKeys = getQueueKeys(playlist,index,loop,backwards);
      const playableQueueKeys = queueKeys.filter(function (key) {

        const track = playlist[key];

        //check every url for this track
        const playableUrls = track.filter(function (url) {
          return !ignoredUrls.includes(url);
        });

        const canPlay = (playableUrls.length > 0);

        return (playableUrls.length > 0);
      });

      /*
      console.log("PLAYABLE QUEUE FOR #"+index,playableQueueKeys,{
        'playlist':playlist,
        'index':index,
        'loop':loop,
        'backwards':backwards
      });
      */

      return playableQueueKeys;
    }

    const queue = getNextPlayableIndexes(trackIndex,loop,backwards);

    return queue[0];
  }

  const appendUnplayableUrl = (url) => {
    let urls = [...ignoredUrls];
    urls.push(url);
    urls = [...new Set(urls)];//make unique
    setIgnoredUrls(urls);
  }

  const handleReady = () => {
    setBackwards(false);//if we were skipping backwards, resets it.
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
      const newIndex = getNextPlayableIndex(trackIndex,props.loop,backwards);
      if (newIndex !== undefined){
        setTrackIndex(newIndex);
      }
    }

  }

  //build playlist
  //forces every track to be an array
  useEffect(() => {

    const playlist = props.playlist.map(function(track) {
      return [].concat(track || []);//force array
    });
    setPlaylist(playlist);

  }, [props.playlist]);

  //sort non-playable URLs when playlist is updated
  useEffect(() => {

    const flatUrls = playlist.flat(Infinity);

    let playable = flatUrls.filter(ReactPlayer.canPlay);
    let unplayable = flatUrls.filter(x => !playable.includes(x));

    unplayable = [...new Set(unplayable)];//make unique
    setIgnoredUrls(unplayable);

  }, [playlist]);

  /*
  useEffect(() => {

    console.log("ALL URLS",playlist);

    let primaryUrls = [];
    let secondaryUrls = [];

    for (let i = 0; i < playlist.length; i++) {
      const item = playlist[i];
      let primaryUrl;
      let secondaryUrl;

      if (!item.length) continue;
      primaryUrl = item[0]; //first one
      secondaryUrl = item.slice(1); //all the others

      primaryUrls.push(primaryUrl);
      secondaryUrls.push(secondaryUrl);

    }

    console.log("PRIMARY",primaryUrls);
    console.log("SECONDARY",secondaryUrls);

  }, [playlist]);

  */


  /*
  useEffect(() => {

    const buildNeedles = (array) => {
      return array.flatMap(
        (v, i) => Array.isArray(v) ? buildNeedles(v).map(a => [i, ...a]) : [[i]]
      );
    }

    //flatten all the URLs
    const flatUrls = playlist.flat(Infinity);
    setFlatUrls(flatUrls);

    //build a one-level array of "needles" to retrieve the URLs in the nested array
    //based on their indexes (eg. [1,5])
    const urlMap = buildNeedles(playlist);
    setUrlMap(urlMap);

  }, [playlist]);


  useEffect(() => {
    console.log("FLAT",flatUrls);
  }, [flatUrls]);

  /*
  useEffect(() => {
    if (!urlMap || !flatUrls) return;
    console.log("MAP",urlMap);

    //get value in array using a needle, which is an array of indexes
    const getValueWithNeedle = (array,indexes) => {
      const children = array[indexes[0]];

      if(indexes.length > 1){
        return getValueWithNeedle(children,indexes.slice(1));
      }else{
        return children;
      }
    }

    const needle = urlMap[4];
    console.log("CHECK YO",needle,getValueWithNeedle(playlist,needle));

  }, [urlMap]);
  */

  //if any, update current index when urls prop is updated (url could have moved within array)
  /*
  useEffect(() => {
    if (trackIndex===undefined) return;

    const firstIndex = getNextPlayableIndex(undefined);
    let newIndex = playlist.indexOf(url);
    newIndex = (newIndex !== -1) ? newIndex : firstIndex;
    setTrackIndex(newIndex);

  }, [playlist]);
  */

  //update index when prop changes
  useEffect(() => {
    if (props.index !== undefined){
      setTrackIndex(props.index);
    }
  }, [props.index]);

  //if index is not defined; use first entry
  /*
  useEffect(() => {
    if ( !playlist[trackIndex] ){
      const firstIndex = getNextPlayableIndex(undefined);
      setTrackIndex(firstIndex);
    }
  }, [trackIndex]);
  */

  //tell parent index has changed
  useEffect(() => {
    if (typeof props.onIndex === 'function') {
      props.onIndex(trackIndex);
    }
  }, [trackIndex]);

  //update track when playlist trackIndex changes
  useEffect(() => {
    if (!playlist.length) return;
    if (trackIndex === undefined) return;

    console.log("NEW INDEX",trackIndex);
    console.log(playlist);

    setTrack(playlist[trackIndex]);

  }, [trackIndex,playlist]);

  useEffect(() => {
    if (track === undefined) return;

    console.log("SET TRACK",track);

    const url = track[0]; //TOUFIX URGENT

    setUrl(url);

  }, [track]);

  //update previous/next controls
  useEffect(() => {
    setHasPrevious( (getNextPlayableIndex(trackIndex,props.loop,true) !== undefined) );
    setHasNext( (getNextPlayableIndex(trackIndex,props.loop,false) !== undefined) );
  }, [trackIndex,ignoredUrls,props.loop]);

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

  //build a list of ignored URLs, as an array of indices
  useEffect(() => {

    //Copy of the playlist array; where playable URLs = false
    const blacklisted = [...playlist].map(function(track) {
      return track.map(function(url) {
        return ignoredUrls.includes(url) ? url : false;
      });
    });

    //build a one-level array of "needles" to retrieve the URLs in the nested array
    //based on their indexes (eg. [1,5])
    const buildNeedles = (array) => {
      return array.flatMap(
        (v, i) => Array.isArray(v) ? buildNeedles(v).map(a => [i, ...a]) : [[i]]
      );
    }
    let blacklistedKeys = buildNeedles(blacklisted);

    //get value in array using a needle, which is an array of indexes
    const getValueWithNeedle = (array,indexes) => {
      const children = array[indexes[0]];

      if(indexes.length > 1){
        return getValueWithNeedle(children,indexes.slice(1));
      }else{
        return children;
      }
    }

    //remove items that are playable (their is FALSE)
    blacklistedKeys = blacklistedKeys.filter(function (indices) {
      const value = getValueWithNeedle(blacklisted,indices);
      return (value !== false);
    });

    setIgnoredKeys(blacklistedKeys);

  }, [ignoredUrls]);

  //when non-playable indices are updated; warn parent
  useEffect(() => {

    if (typeof props.onIgnoredKeys === 'function') {
      props.onIgnoredKeys(ignoredKeys);
    }

  }, [ignoredKeys]);

  //when non-playable URLs are updated; return an object of ignored keys=>urls to the parent
  useEffect(() => {

    if (typeof props.onIgnoredUrls === 'function') {
      props.onIgnoredUrls(ignoredUrls);
    }

  }, [ignoredUrls]);

  //methods parent can use
  //https://medium.com/@nugen/react-hooks-calling-child-component-function-from-parent-component-4ea249d00740
  useImperativeHandle(
      ref,
      () => ({
        previousTrack() {
          setBackwards(true);
          const newIndex = getNextPlayableIndex(trackIndex,props.loop,true);
          if (newIndex !== undefined){
            setTrackIndex(newIndex);
          }
        },
        nextTrack() {
          setBackwards(false);
          const newIndex = getNextPlayableIndex(trackIndex,props.loop,false);

          console.log("NEXT INDEX",newIndex);

          if (newIndex !== undefined){
            setTrackIndex(newIndex);
          }
        },
        getCurrentUrl(){
          return url;
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

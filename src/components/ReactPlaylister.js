import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle  } from "react";
import ReactPlayer from 'react-player';

export const ReactPlaylister = forwardRef((props, ref) => {

  const reactPlayerRef = useRef();

  const [flatUrls,setFlatUrls] = useState();//flattened array of urls
  const [urlMap,setUrlMap] = useState();//relationship between props.urls and flatUrls
  const [unplayableUrls,setUnplayableUrls] = useState([]);//list of unplayable URLs

  const [index, setIndex] = useState(props.index);//current url index


  const [url, setUrl] = useState();//current url
  const [hasPrevious,setHasPrevious] = useState(true);//can we play the previous track ?
  const [hasNext,setHasNext] = useState(true);//can we play the next track ?
  const [backwards,setBackwards] = useState(false);//do we iterate URLs backwards ?
  const autoskip = (props.autoskip !== undefined) ? props.autoskip : true; //when a URL does not play, skip to next one ?

  const getNextPlayableUrlIndex = (index,loop,backwards) => {

    const getNextPlayableUrlIndexes = (index,loop,backwards) => {

      //build a queue of keys based on an array
      //If index is NOT defined, it will return the full array.
      const getQueueKeys = (array,index,loop,backwards) => {
        const allKeys =  [...array.keys()];//array of keys
        let previousKeys = [];
        let nextKeys = [];
        let keysQueue = [];

        if (index){
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

        /*
        console.log(
          !backwards ? 'GET NEXT INDEXES' : 'GET PREVIOUS INDEXES',
          keysQueue
        )
        */

        return keysQueue;
      }

      const queue = getQueueKeys(props.urls,index,loop,backwards);

      const playableQueue = queue.filter(function (key) {
        const url = props.urls[key];
        return !unplayableUrls.includes(url);
      });

      return playableQueue;
    }

    const queue = getNextPlayableUrlIndexes(index,loop,backwards);
    return queue[0];
  }

  const appendUnplayableUrl = (url) => {
    let urls = [...unplayableUrls];
    urls.push(url);
    urls = [...new Set(urls)];//make unique
    setUnplayableUrls(urls);
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
      const newIndex = getNextPlayableUrlIndex(index,props.loop,backwards);
      if (newIndex !== undefined){
        setIndex(newIndex);
      }
    }

  }

  useEffect(() => {

    const buildNeedles = (array) => {
      return array.flatMap(
        (v, i) => Array.isArray(v) ? buildNeedles(v).map(a => [i, ...a]) : [[i]]
      );
    }

    //flatten all the URLs
    const flatUrls = props.urls.flat(Infinity);
    setFlatUrls(flatUrls);

    //build a one-level array of "needles" to retrieve the URLs in the nested array
    //based on their indexes (eg. [1,5])
    const urlMap = buildNeedles(props.urls);
    setUrlMap(urlMap);

  }, [props.urls]);

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
    console.log("CHECK YO",needle,getValueWithNeedle(props.urls,needle));

  }, [urlMap]);
  */

  //if any, update current index when urls prop is updated (url could have moved within array)
  useEffect(() => {
    if (index===undefined) return;

    const firstIndex = getNextPlayableUrlIndex(undefined);
    let newIndex = props.urls.indexOf(url);
    newIndex = (newIndex !== -1) ? newIndex : firstIndex;
    setIndex(newIndex);

  }, [props.urls]);

  //update index when prop changes
  useEffect(() => {
    if (props.index !== undefined){
      setIndex(props.index);
    }
  }, [props.index]);

  //if index is not defined; use first entry
  useEffect(() => {
    if ( !props.urls[index] ){
      const firstIndex = getNextPlayableUrlIndex(undefined);
      setIndex(firstIndex);
    }
  }, [index]);

  //tell parent index has changed
  useEffect(() => {
    if (typeof props.onIndex === 'function') {
      props.onIndex(index);
    }
  }, [index]);

  //update URL when index changes
  useEffect(() => {
    if (index === undefined) return;
    const url = props.urls[index];
    setUrl(url);

  }, [index]);

  //sort non-playable URLs when urls prop is updated
  useEffect(() => {

    let playable = props.urls.filter(ReactPlayer.canPlay);
    let unplayable = props.urls.filter(x => !playable.includes(x));

    unplayable = [...new Set(unplayable)];//make unique
    setUnplayableUrls(unplayable);

  }, [props.urls]);

  //update previous/next controls
  useEffect(() => {
    setHasPrevious( (getNextPlayableUrlIndex(index,props.loop,true) !== undefined) );
    setHasNext( (getNextPlayableUrlIndex(index,props.loop,false) !== undefined) );
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
          setBackwards(true);
          const newIndex = getNextPlayableUrlIndex(index,props.loop,true);
          if (newIndex !== undefined){
            setIndex(newIndex);
          }
        },
        next() {
          setBackwards(false);
          const newIndex = getNextPlayableUrlIndex(index,props.loop,false);
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

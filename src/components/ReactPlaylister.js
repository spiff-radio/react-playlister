import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle  } from "react";
import ReactPlayer from 'react-player';

//get value in array using a needle
const getValueWithNeedle = (array,indices) => {
  indices = !Array.isArray(indices) ? [indices] : indices;

  const children = array[indices[0]];
  if (children === undefined) return;

  if(indices.length > 1){
    return getValueWithNeedle(children,indices.slice(1));
  }else{
    return children;
  }
}

//build a one-level array of "needles" based on an multidimensional input array
const buildNeedles = (array) => {

  const buildIterableNeedles = (array) => {
    return array.flatMap(
      (v, i) => Array.isArray(v) ? buildIterableNeedles(v).map(a => [i, ...a]) : [[i]]
    );
  }

  const iterableNeedles = buildIterableNeedles(array);

  //replace the needles depending of the original value being (or not) an array;
  return iterableNeedles.map(function(indices) {
    const firstKey = indices[0];
    const initialValue = array[firstKey];
    return Array.isArray(initialValue) ? indices : firstKey;
  });

}

export const ReactPlaylister = forwardRef((props, ref) => {

  const reactPlayerRef = useRef();

  //const [flatUrls,setFlatUrls] = useState();//flattened array of urls
  //const [urlMap,setUrlMap] = useState();//"needles" for flatUrls
  const [playlist,setPlaylist] = useState({
    tracks:[],
    track_index:undefined,
    next_tracks:[],
    previous_tracks:[]
  });//our (transformed) datas
  const [track,setTrack] = useState([]);//current array of URLs
  const [url, setUrl] = useState();//current url

  const [urlIndex, setUrlIndex] = useState(0);

  const [hasPreviousTrack,setHasPreviousTrack] = useState(true);//can we play the previous track ?
  const [hasNextTrack,setHasNextTrack] = useState(true);//can we play the next track ?
  const [backwards,setBackwards] = useState(false);//do we iterate URLs backwards ?
  const autoskip = (props.autoskip !== undefined) ? props.autoskip : true; //when a URL does not play, skip to next one ?

  //build a queue of keys based on an array
  //If index is NOT defined, it will return the full array.
  const getArrayQueue = (array,index,loop,backwards) => {
    let previousQueue = [];
    let nextQueue = [];
    let queue = [];

    if (index !== undefined){
      var nextIndex = index+1;

      if (nextIndex < array.length){
        nextQueue = array.slice(nextIndex);
      }

      if (index > 0){
        previousQueue = array.slice(0,index);
      }

    }else{
      nextQueue = array;
    }

    if (loop){
      nextQueue = previousQueue = nextQueue.concat(previousQueue);
    }

    if (backwards === true){
      queue = previousQueue.reverse();
    }else{
      queue = nextQueue;
    }

    return queue;
  }

  //return an array of keys based on a queue
  const getArrayQueueKeys = (array,queue) => {
    return queue.map(function(item) {
      const index = array.indexOf(item);
      return (index !== -1) ? index : undefined;
    })
  }

  const getPlayableTracksQueue = (playlist,index,loop,backwards) => {

    let playableQueue = [];

    if (playlist.tracks){
      const queue = getArrayQueue(playlist.tracks,index,loop,backwards);

      playableQueue = queue.filter(function (track) {
        return hasPlayableSources(track);
      });
    }

    return playableQueue;
  }

  const getPlayableSourcesQueue = (track,index,loop,backwards) => {

    let playableQueue = [];

    if (track.sources){
      const queue = getArrayQueue(track.sources,index,loop,backwards);

      playableQueue = queue.filter(function (source) {
        return source.playable;
      });
    }

    return playableQueue;
  }

  const getNextPlayableTrackIndex = (playlist,index,loop,backwards) => {

    if (playlist.tracks){
      const queue = getPlayableTracksQueue(playlist,index,loop,backwards);
      const queueKeys = getArrayQueueKeys(playlist.tracks,queue);
      return queueKeys[0];
    }

  }

  const getNextPlayableSourceIndex = (track,index,loop,backwards) => {

    if (track.sources){
      const queue = getPlayableSourcesQueue(track,index,loop,backwards);
      const queueKeys = getArrayQueueKeys(track.sources,queue);
      return queueKeys[0];
    }

  }

  const hasPlayableSources = track => {
      let playableItems = track.sources.filter(source => source.playable);
      return (playableItems.length > 0);
  }

  const handleReady = () => {
    setBackwards(false);//if we were skipping backwards, resets it.
    if (typeof props.onReady === 'function') {
      props.onReady();
    }
  }

  const handleError = (e) => {
    alert("ERROR");
    //URGENT FIX SET PLAYABLE = FALSE
    if (typeof props.onError === 'function') {
      props.onError(e);
    }

    //skip automatically if the player is playing
    if (props.playing && props.autoskip){
      const newIndex = getNextPlayableTrackIndex(playlist,playlist.track_index,props.loop,backwards);
      if (newIndex !== undefined){
        setPlaylist({
          ...playlist,
          track_index:newIndex
        })
      }
    }

  }

  const updateTrackControls = (track) => {
    console.log("UPDATE TRACK CONTROLS",track);
    const previousQueue = (track.sources.length) ? getPlayableSourcesQueue(track,track.source_index,false,true) : [];
    const nextQueue = (track.sources.length) ? getPlayableSourcesQueue(track,track.source_index,false,false) : [];
    const previousQueueKeys = getArrayQueueKeys(track.sources,previousQueue);
    const nextQueueKeys = getArrayQueueKeys(track.sources,nextQueue);

    return {
      ...track,
      previous_sources:previousQueueKeys,
      next_sources:nextQueueKeys
    }
  }

  const updateTrack = (index,track) => {

    //update only our track.
    //https://stackoverflow.com/questions/35628774/how-to-update-single-value-inside-specific-array-item-in-redux
    var newQueue = playlist.tracks.map(
      function(oldTrack, i) {

        if (i!==index) return oldTrack;

        //update controls
        if (track.source_index !== oldTrack.source_index){
          track = updateTrackControls(track);
        }

        return track;


      }
    )

    console.log("UPDATE TRACK #"+index,track);

    setPlaylist({
      ...playlist,
      tracks:newQueue
    })

  }

  //build our initial data
  useEffect(() => {

    const makeTrack = (urls,track_index) => {

      urls = [].concat(urls || []);//force array (it might be a single URL string)
      urls = urls.flat(Infinity);//flatten

      const sources = urls.map(function(url) {
        return {
          url:url,
          playable:ReactPlayer.canPlay(url)
        }
      });

      let track = {
        sources:sources
      }

      const allQueue = getArrayQueue(track.sources,undefined,true,false);
      const allQueueKeys = getArrayQueueKeys(track.sources,allQueue);
      const initialIndex = getNextPlayableSourceIndex(track,undefined);

      track = {
        ...track,
        playable: hasPlayableSources(track),
        source_index:initialIndex
      }

      track = updateTrackControls(track);

      return track;

    }

    const tracks = props.urls.map(
      (v, i) => {
        return makeTrack(v,i)
      }
    );

    const newPlaylist = {
      ...playlist,
      tracks:tracks
    }

    console.log("SET PLAYLIST",newPlaylist);

    setPlaylist(newPlaylist);

  }, [props.urls]);

  //update index when prop changes
  useEffect(() => {

    const indexes = [].concat(props.index || []);//force array (we might have passed the track index only)

    console.log("INDEXES",indexes);return;

    const trackIndex = indexes[0];
    const sourceIndex = indexes[1];

    if (trackIndex === undefined) return;

    setPlaylist({
      ...playlist,
      track_index:trackIndex
    })

    if (sourceIndex !== undefined){
      const track = playlist.tracks[trackIndex];
      updateTrack(playlist.track_index,{
        ...track,
        source_index:sourceIndex
      })
    }


  }, [props.index]);

  //if track index is not defined; use first entry
  useEffect(() => {
    if ( !playlist.tracks.length) return;
    if ( playlist.track_index !== undefined ) return;

    const firstIndex = getNextPlayableTrackIndex(playlist,undefined);

    if (firstIndex !== undefined){
      setPlaylist({
        ...playlist,
        track_index:firstIndex
      })
    }

  }, [playlist]);


  //update previous/next track controls
  useEffect(() => {
    if (playlist.track_index === undefined) return;

    const previousQueue = getPlayableTracksQueue(playlist,playlist.track_index,props.loop,true);
    const nextQueue = getPlayableTracksQueue(playlist,playlist.track_index,props.loop,false);

    setPlaylist({
      ...playlist,
      previous_tracks:  getArrayQueueKeys(playlist.tracks,previousQueue),
      next_tracks:      getArrayQueueKeys(playlist.tracks,nextQueue),
    })

  }, [playlist.track_index,props.loop]);

  //select source
  useEffect(() => {
    if (playlist.track_index === undefined) return;

    const trackIndex = playlist.track_index;
    const track = playlist.tracks[trackIndex];

    const sourceIndex = track.source_index;
    const source = track.sources[sourceIndex];

    const newUrl = source.url;

    if (newUrl === url) return; //unchanged

    setUrl(newUrl);

  }, [playlist]);

  //warn parent that data has been updated
  useEffect(() => {

    console.log("NEW PLAYLIST",playlist);

    if (typeof props.onUpdated === 'function') {
      props.onUpdated(playlist);
    }

  }, [playlist]);


  //methods parent can use
  //https://medium.com/@nugen/react-hooks-calling-child-component-function-from-parent-component-4ea249d00740
  useImperativeHandle(
      ref,
      () => ({
        previousTrack() {
          setBackwards(true);
          const newIndex = getNextPlayableTrackIndex(playlist,playlist.track_index,props.loop,true);
          if (newIndex !== undefined){
            setPlaylist({
              ...playlist,
              track_index:newIndex
            })
          }
        },
        nextTrack() {
          setBackwards(false);
          const newIndex = getNextPlayableTrackIndex(playlist,playlist.track_index,props.loop,false);

          console.log("NEXT INDEX",newIndex);

          if (newIndex !== undefined){
            setPlaylist({
              ...playlist,
              track_index:newIndex
            })
          }
        },
        previousSource() {
          setBackwards(true);//TOUFIX TOUCHECK
          const track = playlist.tracks[playlist.track_index];
          const newIndex = getNextPlayableSourceIndex(track,track.source_index,props.loop,true);
          if (newIndex !== undefined){

            updateTrack(playlist.track_index,{
              ...track,
              source_index:newIndex
            })

          }
        },
        nextSource() {
          setBackwards(false);//TOUFIX TOUCHECK
          const track = playlist.tracks[playlist.track_index];
          const newIndex = getNextPlayableSourceIndex(track,track.source_index,props.loop,false);

          console.log("NEXT INDEX",newIndex);

          if (newIndex !== undefined){

            updateTrack(playlist.track_index,{
              ...track,
              source_index:newIndex
            })

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

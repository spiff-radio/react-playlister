import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle  } from "react";
import ReactPlayer from 'react-player';

export const ReactPlaylister = forwardRef((props, ref) => {

  const reactPlayerRef = useRef();
  const autoskip = (props.autoskip !== undefined) ? props.autoskip : true; //when a URL does not play, skip to next one ?
  const shuffle = (props.shuffle !== undefined) ? props.shuffle : false;
  const [backwards,setBackwards] = useState(false);//do we iterate URLs backwards ?

  const [playlist,setPlaylist] = useState([]);//our (transformed) datas
  const [controls,setControls] = useState({
    track_index:undefined,
    source_index:undefined,
    next_tracks:[],
    previous_tracks:[],
    next_sources:[],
    previous_sources:[]
  });

  const [url, setUrl] = useState();//current url

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

    if (playlist){
      const queue = getArrayQueue(playlist,index,loop,backwards);

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

    if (playlist){
      const queue = getPlayableTracksQueue(playlist,index,loop,backwards);
      const queueKeys = getArrayQueueKeys(playlist,queue);
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

  const handleReady = (player) => {
    setBackwards(false);//if we were skipping backwards, resets it.

    //pass React Player prop to parent
    if (typeof props.onReady === 'function') {
      props.onReady(player);
    }
  }

  const handleError = (e) => {
    //URGENT FIX SET PLAYABLE = FALSE

    //pass React Player prop to parent
    if (typeof props.onError === 'function') {
      props.onError(e);
    }

    //skip automatically if the player is playing
    if (props.playing && autoskip){
      const newIndex = getNextPlayableTrackIndex(playlist,controls.track_index,props.loop,backwards);
      if (newIndex !== undefined){
        setControls({
          ...controls,
          track_index:newIndex,
          source_index:undefined,
        })
      }
    }

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

      track = {
        ...track,
        playable: hasPlayableSources(track)
      }

      return track;

    }

    const tracks = props.urls.map(
      (v, i) => {
        return makeTrack(v,i)
      }
    );

    setPlaylist(tracks);

  }, [props.urls]);

  //update index when prop changes
  //TOUFIX URGENT BROKEN; makes infinite loop.
  /*
  useEffect(() => {

    const indexes = [].concat(props.index || []);//force array (we might have passed the track index only)

    console.log("INDEXES",indexes);

    const trackIndex = indexes[0];
    const sourceIndex = indexes[1];

    if (trackIndex === undefined) return;

    setControls({
      ...controls,
      track_index:trackIndex,
      source_index:sourceIndex
    })


  }, [props.index]);
  */

  //if track index is not defined; use first entry
  useEffect(() => {
    if ( !playlist.length) return;
    if ( controls.track_index !== undefined ) return;

    const firstIndex = getNextPlayableTrackIndex(playlist,undefined);

    if (firstIndex !== undefined){
      setControls({
        ...controls,
        track_index:firstIndex,
        source_index:undefined,
      })
    }

  }, [playlist,controls]);

  //if source index is not defined; use first entry
  useEffect(() => {
    if ( !playlist.length) return;
    if ( controls.track_index === undefined ) return;
    if ( controls.source_index !== undefined ) return;

    const track = playlist[controls.track_index];
    const firstIndex = getNextPlayableSourceIndex(track,undefined);

    if (firstIndex !== undefined){
      setControls({
        ...controls,
        source_index:firstIndex
      })
    }

  }, [playlist,controls]);

  //update previous/next controls
  useEffect(() => {
    if (controls.track_index === undefined) return;

    let newControls = {...controls};

    //TRACK
    const previousTracksQueue = (playlist.length) ? getPlayableTracksQueue(playlist,controls.track_index,props.loop,true) : [];
    const nextTracksQueue = (playlist.length) ? getPlayableTracksQueue(playlist,controls.track_index,props.loop,false) : [];
    const previousTracksQueueKeys = getArrayQueueKeys(playlist,previousTracksQueue);
    const nextTracksQueueKeys = getArrayQueueKeys(playlist,nextTracksQueue);

    newControls = {
      ...newControls,
      previous_tracks:  previousTracksQueueKeys,
      next_tracks:      nextTracksQueueKeys
    }

    //SOURCE
    const track = playlist[controls.track_index];
    if (track !== undefined){
      const previousSourcesQueue = (track.sources.length) ? getPlayableSourcesQueue(track,controls.source_index,false,true) : [];
      const nextSourcesQueue = (track.sources.length) ? getPlayableSourcesQueue(track,controls.source_index,false,false) : [];
      const previousSourcesQueueKeys = getArrayQueueKeys(track.sources,previousSourcesQueue);
      const nextSourcesQueueKeys = getArrayQueueKeys(track.sources,nextSourcesQueue);

      newControls = {
        ...newControls,
        previous_sources:previousSourcesQueueKeys,
        next_sources:nextSourcesQueueKeys
      }

    }

    setControls(newControls)

  }, [controls.track_index,controls.source_index,props.loop]);

  //select source
  useEffect(() => {
    if (controls.track_index === undefined) return;
    if (controls.source_index === undefined) return;

    const trackIndex = controls.track_index;
    const track = playlist[trackIndex];
    if (track === undefined) return;

    const sourceIndex = controls.source_index;
    const source = track.sources[sourceIndex];
    if (source === undefined) return;

    const newUrl = source.url;
    setUrl(newUrl);

  }, [controls]);

  //warn parent that data has been updated
  useEffect(() => {

    console.log("NEW PLAYLIST",playlist);

    if (typeof props.onUpdated === 'function') {
      props.onUpdated(playlist,controls);
    }

  }, [playlist,controls]);


  //methods parent can use
  //https://medium.com/@nugen/react-hooks-calling-child-component-function-from-parent-component-4ea249d00740
  useImperativeHandle(
      ref,
      () => ({
        previousTrack() {
          setBackwards(true);
          const newIndex = getNextPlayableTrackIndex(playlist,controls.track_index,props.loop,true);
          if (newIndex !== undefined){
            setControls({
              ...controls,
              track_index:newIndex,
              source_index:undefined
            })
          }
        },
        nextTrack() {
          setBackwards(false);
          const newIndex = getNextPlayableTrackIndex(playlist,controls.track_index,props.loop,false);

          if (newIndex !== undefined){
            console.log("NEXT INDEX",newIndex);
            setControls({
              ...controls,
              track_index:newIndex,
              source_index:undefined
            })
          }
        },
        previousSource() {
          setBackwards(true);//TOUFIX TOUCHECK
          const track = playlist[controls.track_index];
          const newIndex = getNextPlayableSourceIndex(track,controls.source_index,props.loop,true);
          if (newIndex !== undefined){
            console.log("PREVIOUS INDEX",newIndex);
            setControls({
              ...controls,
              source_index:newIndex
            })

          }
        },
        nextSource() {
          setBackwards(false);//TOUFIX TOUCHECK
          const track = playlist[controls.track_index];
          const newIndex = getNextPlayableSourceIndex(track,controls.source_index,props.loop,false);

          console.log("NEXT INDEX",newIndex);

          if (newIndex !== undefined){

            setControls({
              ...controls,
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

      onReady={handleReady}
      onError={handleError}

      onStart={props.onStart}
      onPlay={props.onPlay}
      onPause={props.onPause}
      onBuffer={props.onBuffer}
      onBufferEnd={props.onBufferEnd}
      onEnded={props.onEnded}
      onDuration={props.onDuration}
      onSeek={props.onSeek}
      onProgress={props.onProgress}
      onClickPreview={props.onClickPreview}
      onEnablePIP={props.onEnablePIP}
      onDisablePIP={props.onDisablePIP}
      />
    </div>
  );
})

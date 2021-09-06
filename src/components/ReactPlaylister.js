import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle  } from "react";
import ReactPlayer from 'react-player';
import classNames from "classnames";

const DEBUG = (process.env.NODE_ENV !== 'production');

export const ReactPlaylister = forwardRef((props, ref) => {

  DEBUG && console.log("REACTPLAYLISTER COMPONENT LOADED");

  const reactPlayerRef = useRef();
  const loop = (props.loop !== undefined) ? props.loop : false;
  const [playRequest,setPlayRequest] = useState(props.playing);
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

  const [source, setSource] = useState();
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

  const getTracksQueue = (playlist,index,loop,backwards) => {
    return getArrayQueue(playlist,index,loop,backwards);
  }

  const checkPlayableTrack = (track) => {
    let bool = track.playable;

    //here's a chance to filter the playable tracks if you have a very specific need for it.
    if (typeof props.filterPlayableTrack === 'function') {
      const trackIndex = playlist.indexOf(track);
      bool = props.filterPlayableTrack(track,trackIndex,bool);
    }

    return bool;
  }

  const getPlayableTracksQueue = (playlist,index,loop,backwards) => {
    let queue = getTracksQueue(playlist,index,loop,backwards);
    queue = queue.filter(checkPlayableTrack);

    return queue;
  }

  const getNextTrackIndex = (playlist,index,loop,backwards) => {
    const queue = getTracksQueue(playlist,index,loop,backwards);
    const queueKeys = getArrayQueueKeys(playlist,queue);
    return queueKeys[0];
  }

  const getNextPlayableTrackIndex = (playlist,index,loop,backwards) => {

    const queue = getPlayableTracksQueue(playlist,index,loop,backwards);
    const queueKeys = getArrayQueueKeys(playlist,queue);
    return queueKeys[0];

  }

  const getSourcesQueue = (track,index,loop,backwards) => {
    return getArrayQueue(track?.sources,index,loop,backwards);
  }

  const getPlayableSourcesQueue = (track,index,loop,backwards) => {

    let queue = getSourcesQueue(track,index,loop,backwards);
    queue = queue.filter(function (source) {
      return source.playable;
    });

    return queue;
  }

  const getNextSourceIndex = (track,index,loop,backwards) => {

    const queue = getSourcesQueue(track,index,loop,backwards);
    const queueKeys = getArrayQueueKeys(track?.sources,queue);
    return queueKeys[0];

  }

  const getNextPlayableSourceIndex = (track,index,loop,backwards) => {

    const queue = getPlayableSourcesQueue(track,index,loop,backwards);
    const queueKeys = getArrayQueueKeys(track?.sources,queue);
    return queueKeys[0];

  }

  const hasPlayableSources = track => {
      let playableItems = track.sources.filter(source => source.playable);
      return (playableItems.length > 0);
  }

  const handleReady = (player) => {
    setBackwards(false);//if we were skipping backwards, resets it.

    //inherit React Player prop
    if (typeof props.onReady === 'function') {
      props.onReady(player);
    }

  }

  const handleError = (e) => {

    //inherit React Player prop
    if (typeof props.onError === 'function') {
      props.onError(e);
    }

    const trackIndex = controls.track_index;
    const sourceIndex = controls.source_index;
    const track = playlist[trackIndex];

    DEBUG && console.log("NOT PLAYABLE: TRACK #"+trackIndex+" SOURCE #"+sourceIndex+" WITH URL:"+url);

    //skip automatically if the player is playing
    if (playRequest && autoskip){
      skipSource();
    }

  }

  const handleEnded = () => {

    //inherit React Player prop
    if (typeof props.onEnded === 'function') {
      props.onEnded();
    }

    const trackIndex = controls.track_index;
    const queue = getPlayableTracksQueue(playlist,undefined,false,false);
    const queueKeys = getArrayQueueKeys(playlist,queue);
    const lastTrackIndex = queueKeys[queueKeys.length - 1];

    if ( (trackIndex === lastTrackIndex) && (typeof props.onPlaylistEnded === 'function') ) { //tell parent the last played track has ended
      props.onPlaylistEnded();
    }else if(autoskip){//skip to next track
      nextTrack();
    }

  }

  //inherit prop
  useEffect(() => {
    setPlayRequest(props.playing);
  }, [props.playing]);

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
        sources:sources,
        current_source:sources.length ? 0 : undefined
      }

      track = {
        ...track,
        playable: hasPlayableSources(track)
      }

      return track;

    }

    const urls = [].concat(props.urls || []);//force array

    const newPlaylist = urls.map(
      (v, i) => {
        return makeTrack(v,i)
      }
    );


    //try to restore previous values of current_source
    /*TOUFIX TO IMPROVE ? URGENT
    if (playlist.length){//we have an old playlist record


      //current_source
      newPlaylist.forEach(function(track,i){

        const oldTrack = playlist[i];

        if (oldTrack){
          const oldSourceIndex = oldTrack.current_source;

          if (oldSourceIndex){
              const oldSource = oldTrack.sources[oldSourceIndex];
              const oldSourceUrl = oldSource.url;

              const newSource = track.sources.find(source => {
                return source.url === oldSourceUrl
              })

              const newSourceIndex = track.sources.indexOf(newSource);

              if (newSourceIndex !== -1){
                  newPlaylist[i].current_source = newSourceIndex;
              }

          }
        }


      })
    }
    */


    setPlaylist(newPlaylist);

  }, [props.urls]);

  //set default indices when component initializes
  useEffect(() => {

    if ( !playlist.length) return;
    if (props.index === undefined) return;

    const indexes = Array.isArray(props.index) ? props.index : [props.index];//force array

    const trackIndex = indexes[0];
    const sourceIndex = indexes[1];

    if ( (trackIndex === controls.track_index) && (sourceIndex === controls.source_index) ) return; //no changes

    DEBUG && console.log("SET INDEXES FROM PROP AT INIT",indexes);

    setControls(prevState => {
      return{
        ...prevState,
        track_index:trackIndex,
        source_index:sourceIndex
      }
    })

  }, [playlist,props.index]);

  //if track/source index is not defined
  useEffect(() => {
    if ( !playlist.length) return;

    let trackIndex = controls.track_index;
    let sourceIndex = controls.source_index;

    //track
    if ( trackIndex === undefined ){
      trackIndex = autoskip ? getNextPlayableTrackIndex(playlist,undefined) : getNextTrackIndex(playlist,undefined);
      if (trackIndex === undefined) return;
      DEBUG && console.log("SET DEFAULT TRACK INDEX",trackIndex);
    }

    //source
    if ( sourceIndex === undefined ){
      const track = playlist[trackIndex];

      //use the previously selected source (if any)...
      sourceIndex = (track.current_source !== undefined) ? track.current_source : undefined;
      //...except if autoskip is enabled and that the source is not playable
      const source = track.sources[sourceIndex];
      sourceIndex = ( (source !== undefined) && autoskip && !source.playable ) ? undefined : sourceIndex;

      if (sourceIndex !== undefined){
        DEBUG && console.log("CHOOSED PREVIOUSLY SELECTED SOURCE FOR TRACK #"+trackIndex,sourceIndex);
      }else{
        sourceIndex = autoskip ? getNextPlayableSourceIndex(track,sourceIndex) : getNextSourceIndex(track,sourceIndex);
        if (sourceIndex === undefined) return;
        DEBUG && console.log("SET DEFAULT SOURCE INDEX FOR TRACK #"+trackIndex,sourceIndex);
      }

    }

    setControls(prevState => {
      return{
        ...prevState,
        track_index:trackIndex,
        source_index:sourceIndex
      }
    })

  }, [playlist,controls.track_index,controls.source_index]);

  //update previous/next controls
  useEffect(() => {

    const trackIndex = controls.track_index;
    const track = playlist[trackIndex];
    if (track === undefined) return;

    const sourceIndex = controls.source_index;
    if ( (sourceIndex === undefined) && track.sources.length ) return; //this track HAS sources so a source index should be passed to update controls.  If the track has NO sources (thus a source index cannot be set) do continue

    let appendControls = {};

    //TRACK
    const previousTracksQueue = (playlist.length) ? autoskip ? getPlayableTracksQueue(playlist,trackIndex,props.loop,true) : getTracksQueue(playlist,trackIndex,props.loop,true) : [];
    const nextTracksQueue = (playlist.length) ? autoskip ? getPlayableTracksQueue(playlist,trackIndex,props.loop,false) : getTracksQueue(playlist,trackIndex,props.loop,false) : [];
    const previousTracksQueueKeys = getArrayQueueKeys(playlist,previousTracksQueue);
    const nextTracksQueueKeys = getArrayQueueKeys(playlist,nextTracksQueue);

    appendControls = {
      ...appendControls,
      previous_tracks:  previousTracksQueueKeys,
      next_tracks:      nextTracksQueueKeys
    }

    //SOURCE
    const previousSourcesQueue = (track.sources.length) ? autoskip ? getPlayableSourcesQueue(track,sourceIndex,false,true) : getSourcesQueue(track,sourceIndex,false,true) : [];
    const nextSourcesQueue = (track.sources.length) ? autoskip ? getPlayableSourcesQueue(track,sourceIndex,false,false) : getSourcesQueue(track,sourceIndex,false,false) : [];
    const previousSourcesQueueKeys = getArrayQueueKeys(track.sources,previousSourcesQueue);
    const nextSourcesQueueKeys = getArrayQueueKeys(track.sources,nextSourcesQueue);

    appendControls = {
      ...appendControls,
      previous_sources:previousSourcesQueueKeys,
      next_sources:nextSourcesQueueKeys
    }

    setControls(prevState => {
      return{
        ...prevState,
        ...appendControls
      }
    })


  }, [controls.track_index,controls.source_index,props.loop]);

  //set current_source property of the track object.
  //It will be used as fallback if no source is specified when selecting a track.
  useEffect(() => {

    const trackIndex = controls.track_index;
    const sourceIndex = controls.source_index;

    if (trackIndex === undefined) return;
    if (sourceIndex === undefined) return;

    const track = playlist[trackIndex];
    if (track === undefined) return;

    //update playlist track; and use prevState to ensure value is not overriden; because we set this state asynchronously
    //https://github.com/facebook/react/issues/16858#issuecomment-534257343
    setPlaylist(prevState => {

      const newState =
        prevState.map(
          (track, i) => {
            if (i === trackIndex){
              return {
                ...track,
                current_source:sourceIndex
              };
            }else{
              return track;
            }
          }
        )

        return newState;
    });


  }, [controls.source_index]);

  //select source
  useEffect(() => {

    let newSource = undefined;
    const trackIndex = controls.track_index;
    const sourceIndex = controls.source_index;

    if (trackIndex !== undefined){
      const track = playlist[trackIndex];
      if (track !== undefined){
        if (track.sources.length){
          if (sourceIndex !== undefined){
            newSource = track.sources[sourceIndex];
          }
        }else if (playRequest && autoskip){
          DEBUG && console.log("NO SOURCES FOR PLAYING TRACK #"+trackIndex+", SKIP IT");
          skipTrack();
          return;
        }
      }

    }

    setSource(newSource);

  }, [controls]);

  //set player URL.
  //We set it ONLY if the source is defined;
  //because if we pass an undefined value; a player that is in a background tab will freeze between two tracks.
  //https://github.com/cookpete/react-player/issues/1177#issuecomment-781929517
  //https://bugs.chromium.org/p/chromium/issues/detail?id=1244074
  useEffect(() => {
    DEBUG && console.log("SET SOURCE",source);
    if (source){
      if (url !== source.url){
          setUrl(source.url);
      }else{
        //if that source has already played, resets it.
        const played = reactPlayerRef.current.getCurrentTime();
        if (played){
          DEBUG && console.log("RESET SOURCE",source);
          reactPlayerRef.current.seekTo(0);
        }
      }
    }
  }, [source]);

  //warn parent that data has been updated
  useEffect(() => {
    if (typeof props.onPlaylistUpdated === 'function') {
      props.onPlaylistUpdated(playlist);
    }
  }, [playlist]);

  //warn parent that data has been updated
  useEffect(() => {
    if (typeof props.onControlsUpdated === 'function') {
      props.onControlsUpdated(controls);
    }
  }, [controls]);

  const previousTrack = () => {
    const backwards = true;
    setBackwards(backwards);
    const newIndex = autoskip ? getNextPlayableTrackIndex(playlist,controls.track_index,props.loop,backwards) : getNextTrackIndex(playlist,controls.track_index,props.loop,backwards);

    if (newIndex !== undefined){
      setControls(prevState => {
        return{
          ...prevState,
          track_index:newIndex,
          source_index:undefined
        }
      })
    }
  }

  const nextTrack = () => {
    const backwards = false;
    setBackwards(backwards);
    const newIndex = autoskip ? getNextPlayableTrackIndex(playlist,controls.track_index,props.loop,backwards) : getNextTrackIndex(playlist,controls.track_index,props.loop,backwards);

    if (newIndex !== undefined){
      setControls(prevState => {
        return{
          ...prevState,
          track_index:newIndex,
          source_index:undefined
        }
      })
    }
  }

  const skipTrack = () => {
    const newIndex = autoskip ? getNextPlayableTrackIndex(playlist,controls.track_index,props.loop,backwards) : getNextTrackIndex(playlist,controls.track_index,props.loop,backwards);

    if (newIndex !== undefined){
      setControls(prevState => {
        return{
          ...prevState,
          track_index:newIndex,
          source_index:undefined
        }
      })
    }
  }

  const skipSource = () => {

    const trackIndex = controls.track_index;
    const sourceIndex = controls.source_index;
    const track = playlist[trackIndex];

    const newSourceIndex = getNextPlayableSourceIndex(track,sourceIndex);//try to find another playable source for this track
    const newTrackIndex = (newSourceIndex === undefined) ? getNextPlayableTrackIndex(playlist,trackIndex,props.loop,backwards) : trackIndex;

    if (newTrackIndex !== undefined){
      DEBUG && console.log("FROM TRACK #"+trackIndex+"; SKIP TO TRACK #"+newTrackIndex+" SOURCE #"+newSourceIndex);

      setControls(prevState => {
        return{
          ...prevState,
          track_index:newTrackIndex,
          source_index:newSourceIndex
        }
      })
    }

    //update playlist track; and use prevState to ensure value is not overriden; because we set this state asynchronously
    //https://github.com/facebook/react/issues/16858#issuecomment-534257343
    setPlaylist(prevState => {

      const newState =
        prevState.map(
          (track, i) => {
            if (i === trackIndex){
              const newSources = track.sources.map(
                (source, i) => i === sourceIndex ? {...source,playable:false} : source
              )
              return {
                ...track,
                sources:newSources
              };
            }else{
              return track;
            }
          }
        )

        return newState;
    });
  }

  const previousSource = () => {
    setBackwards(true);//TOUFIX TOUCHECK
    const track = playlist[controls.track_index];
    const newIndex = autoskip ? getNextPlayableSourceIndex(track,controls.source_index,props.loop,true) : getNextSourceIndex(track,controls.source_index,props.loop,true)

    if (newIndex !== undefined){
      setControls(prevState => {
        return{
          ...prevState,
          source_index:newIndex
        }
      })
    }
  }

  const nextSource = () => {
    setBackwards(false);//TOUFIX TOUCHECK
    const track = playlist[controls.track_index];
    const newIndex = autoskip ? getNextPlayableSourceIndex(track,controls.source_index,props.loop,false) : getNextSourceIndex(track,controls.source_index,props.loop,false);

    if (newIndex !== undefined){
      setControls(prevState => {
        return{
          ...prevState,
          source_index:newIndex
        }
      })
    }
  }

  //methods parent can use
  //https://medium.com/@nugen/react-hooks-calling-child-component-function-from-parent-component-4ea249d00740
  useImperativeHandle(
      ref,
      () => ({
        previousTrack() {
          previousTrack();
        },
        nextTrack() {
          nextTrack();

        },
        skipTrack() {
          skipTrack();
        },
        previousSource() {
          previousSource();
        },
        nextSource() {
          nextSource();
        },
        getReactPlayer(){
          return reactPlayerRef.current;
        }
       }),
   )

  return (
    <div
    className={classNames({
      'react-playlister':  true,
      'no-source':       (!source)
    })}
    >
      <ReactPlayer

      //props handled by ReactPlaylister
      url={url}
      loop={false}
      ref={reactPlayerRef}

      //inherit props
      playing={playRequest}
      controls={props.controls}
      light={props.light}
      volume={props.volume}
      muted={props.muted}
      playbackRate={props.playbackRate}
      width={props.width}
      height={props.height}
      style={props.style}
      progressInterval={props.progressInterval}
      playsinline={props.playsinline}
      pip={props.pip}
      stopOnUnmount={props.stopOnUnmount}
      fallback={props.fallback}
      wrapper={props.wrapper}
      playIcon={props.playIcon}
      previewTabIndex={props.previewTabIndex}
      config={props.config}

      //Callback props handled by ReactPlaylister
      onReady={handleReady}
      onError={handleError}
      onEnded={handleEnded}

      //inherit methods
      onPlay={props.onPlay}
      onPause={props.onPause}
      onStart={props.onStart}
      onBuffer={props.onBuffer}
      onBufferEnd={props.onBufferEnd}
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

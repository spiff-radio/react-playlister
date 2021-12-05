import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle  } from "react";
import ReactPlayer from 'react-player';
import { default as reactplayerProviders } from 'react-player/lib/players/index.js';
import classNames from "classnames";

const DEBUG = (process.env.NODE_ENV !== 'production');
const REACTPLAYER_PROVIDERS = reactplayerProviders;
const REACTPLAYER_PROVIDER_KEYS = Object.values(reactplayerProviders).map(provider => {return provider.key});

export const ReactPlaylister = forwardRef((props, ref) => {

  const reactPlayerRef = useRef();

  const playRequest = props.playing ?? false;

  const loop = props.loop ?? false;
  const shuffle = props.shuffle ?? false;

  const getProvidersOrder = (keys) => {
    keys = keys || [];
    const frontKeys = keys.filter(x => REACTPLAYER_PROVIDER_KEYS.includes(x));//the keys we want to put in front (remove the ones that does not exists in the original array)
    const backKeys = REACTPLAYER_PROVIDER_KEYS.filter(x => !frontKeys.includes(x));
    return frontKeys.concat(backKeys);
  }

  const getDisabledProviders = (keys) => {
    keys = keys || [];
    return keys.filter(x => REACTPLAYER_PROVIDER_KEYS.includes(x));//the keys we want to disable (remove the ones that does not exists in the original array)
  }

  const sortProviders = getProvidersOrder(props.sortProviders);
  const disabledProviders = getDisabledProviders(props.disabledProviders);

  console.log("SORT PROVIDERS",sortProviders);
  console.log("DISABLED PROVIDERS",disabledProviders);

  const ignoreUnplayable = props.autoskip ?? true;

  //should we skip if an error is fired ?
  const skipError = props.skipError ?? true;

  //should we skip if the track ends ?
  const skipEnded = props.skipEnded ?? true;

  //should we skip if track has no sources ?
  const skipNoSources = props.skipNoSources ?? true;

  //are we currently skipping ?
  const [skipping,setSkipping] = useState(false);

  //do we iterate URLs backwards ?
  const [backwards,setBackwards] = useState(false);


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

  const filterTrack = (track) => {

    const isPlayableTrack = (track) => {
      let bool = track.playable;

      //here's a chance to filter the playable tracks if you have a very specific need for it.
      if (typeof props.filterPlayableTrack === 'function') {
        const trackIndex = playlist.indexOf(track);
        bool = props.filterPlayableTrack(track,trackIndex,bool);
      }

      return bool;
    }

    if (ignoreUnplayable){
      return isPlayableTrack(track);
    }

    return true;
  }

  const isPlayableSource = (source) => {
    return source.playable;
  }

  const getTracksQueue = (playlist,index,loop,backwards) => {
    let queue = getArrayQueue(playlist,index,loop,backwards);

    if (ignoreUnplayable){
      //filter only playable tracks
      queue = queue.filter(filterTrack);
    }

    return queue;
  }

  const getNextTrackIndex = (playlist,index,loop,backwards) => {
    const queue = getTracksQueue(playlist,index,loop,backwards);
    const queueKeys = getArrayQueueKeys(playlist,queue);
    return queueKeys[0];
  }

  const filterSource = (source) => {

    const playable = isPlayableSource(source);
    const autoplay = source.autoplay;

    if (ignoreUnplayable && !playable){
      return false;
    }

    if (skipping && !autoplay){
      return false;
    }

    return true;
  }

  const getSourcesQueue = (track,index,loop,backwards) => {
    let queue = getArrayQueue(track?.sources,index,loop,backwards);
    queue = queue.filter(filterSource);
    return queue;
  }

  const getNextSourceIndex = (track,index,loop,backwards) => {

    const queue = getSourcesQueue(track,index,loop,backwards);
    const queueKeys = getArrayQueueKeys(track?.sources,queue);
    return queueKeys[0];

  }


  const hasPlayableSources = track => {
    return (track.sources.filter(isPlayableSource).length > 0);
  }

  const handleSourceReady = (player) => {
    setSkipping(false);//if we were skipping
    setBackwards(false);//if we were skipping backwards, resets it.

    const trackIndex = controls.track_index;
    const sourceIndex = controls.source_index;
    const track = playlist[trackIndex];
    const source = track.sources[sourceIndex];

    console.log("REACTPLAYLISTER / SOURCE #"+sourceIndex+" READY",source);
    console.log("REACTPLAYLISTER / FOR TRACK #"+trackIndex,track);

    //inherit React Player prop
    if (typeof props.onReady === 'function') {
      props.onReady(player);
    }

  }

  const handleSourceError = (e) => {

    const trackIndex = controls.track_index;
    const sourceIndex = controls.source_index;
    const track = playlist[trackIndex];
    const source = track.sources[sourceIndex];

    setSourceNotPlayable(source);

    //inherit React Player prop
    if (typeof props.onError === 'function') {
      props.onError(e);
    }


    //skip automatically if the player is playing
    if (playRequest && skipError){
      skipSource();
    }

  }

  const handleSourceEnded = () => {

    //inherit React Player prop
    if (typeof props.onEnded === 'function') {
      props.onEnded();
    }

    const trackIndex = controls.track_index;
    const queue = getTracksQueue(playlist,undefined,false,false);
    const queueKeys = getArrayQueueKeys(playlist,queue);
    const lastTrackIndex = queueKeys[queueKeys.length - 1];

    if ( (trackIndex === lastTrackIndex) ) { //tell parent the last played track has ended
      handlePlaylistEnded();
    }else if(skipEnded){//skip to next track
      nextTrack();
    }

  }

  const handlePlaylistEnded = () => {
    DEBUG && console.log("REACTPLAYLISTER / PLAYLIST ENDED");
    if(typeof props.onPlaylistEnded === 'function'){
      props.onPlaylistEnded();
    }
  }

  const skipTrack = (newBackwards) => {

    setSkipping(true);

    //also set the backwards state if defined
    let doBackwards = backwards; //default value
    let backwardsMsg = '';
    if (newBackwards !== undefined){
      setBackwards(newBackwards);
      doBackwards = newBackwards;
      backwardsMsg = doBackwards ? ' TO PREVIOUS' : ' TO NEXT';
    }

    const newIndex = getNextTrackIndex(playlist,controls.track_index,props.loop,doBackwards);

    DEBUG && console.log("REACTPLAYLISTER / SKIP"+backwardsMsg+" FROM TRACK #"+controls.track_index+" -> TRACK #"+newIndex);

    if (newIndex !== undefined){
      setControls(prevState => {
        return{
          ...prevState,
          track_index:newIndex,
          source_index:undefined
        }
      })
    }else{ //no playable tracks
      DEBUG && console.log("REACTPLAYLISTER / NO PLAYABLE TRACKS");
      handlePlaylistEnded();
    }
  }

  const previousTrack = () => {
    skipTrack(true);
  }

  const nextTrack = () => {
    skipTrack(false);
  }

  const skipSource = () => {

    DEBUG && console.log("REACTPLAYLISTER / SKIP SOURCE");

    setSkipping(true);

    const trackIndex = controls.track_index;
    const sourceIndex = controls.source_index;
    const track = playlist[trackIndex];

    const newSourceIndex = getNextSourceIndex(track,sourceIndex,true);//try to find another playable source for this track

    if (newSourceIndex === undefined){

      const newTrackIndex = getNextTrackIndex(playlist,trackIndex,props.loop,backwards);

      DEBUG && console.log("REACTPLAYLISTER / FROM TRACK #"+trackIndex+"; SKIP TO TRACK #"+newTrackIndex+" SOURCE #"+newSourceIndex);

      setControls(prevState => {
        return{
          ...prevState,
          track_index:newTrackIndex,
          source_index:newSourceIndex
        }
      })
    }

  }

  const getSourceTrack = (source) => {
    return playlist.find(function(track) {
      return ( track.sources.includes(source) );
    });
  }

  const setSourceNotPlayable = (source) => {

    const track = getSourceTrack(source);
    console.log("SET SOURCE NOT PLAYABLE",source);

    //update playlist track; and use prevState to ensure value is not overriden; because we set this state asynchronously
    //https://github.com/facebook/react/issues/16858#issuecomment-534257343
    setPlaylist(prevState => {

      const newState =
        prevState.map(
          (playlistTrack) => {
            if (playlistTrack === track){
              const newSources = playlistTrack.sources.map(
                (trackSource) => {
                  if (trackSource === source){
                    return {
                      ...trackSource,
                      playable:false
                    }
                  }else{
                    return trackSource;
                  }
                }
              )
              return {
                ...playlistTrack,
                sources:newSources
              };
            }else{
              return playlistTrack;
            }
          }
        )

        return newState;
    });
  }



  const previousSource = () => {
    setBackwards(true);//TOUFIX TOUCHECK
    const track = playlist[controls.track_index];
    const newIndex = getNextSourceIndex(track,controls.source_index,props.loop,true);

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
    const newIndex = getNextSourceIndex(track,controls.source_index,props.loop,false);

    if (newIndex !== undefined){
      setControls(prevState => {
        return{
          ...prevState,
          source_index:newIndex
        }
      })
    }
  }

  //build our initial data
  useEffect(() => {

    const makeTrack = (urls,track_index) => {

      urls = [].concat(urls || []);//force array (it might be a single URL string)
      urls = urls.flat(Infinity);//flatten

      const sources = urls.map(function(url,i) {

        const isSourceProvider = (provider) => {
          return provider.canPlay(url);
        }

        const provider = reactplayerProviders.find(isSourceProvider);

        return {
          url:url,
          index:i,
          playable:ReactPlayer.canPlay(url),
          autoplay:provider ? !disabledProviders.includes(provider.key) : undefined,
          provider:provider ? {name:provider.name,key:provider.key} : undefined
        }
      });

      let track = {
        sources:sources
      }

      track = {
        ...track,
        playable: hasPlayableSources(track),
        current_source: getNextSourceIndex(track)//default source index
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

    DEBUG && console.log("REACTPLAYLISTER / SET INDEXES FROM PROP AT INIT",indexes);

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
      trackIndex = getNextTrackIndex(playlist,undefined);
      if (trackIndex === undefined) return;
      DEBUG && console.log("REACTPLAYLISTER / SET DEFAULT TRACK INDEX",trackIndex);
    }

    //source
    if ( sourceIndex === undefined ){
      const track = playlist[trackIndex];

      //use current source if any
      if (track.current_source){
        const source = track.sources[track.current_source];
        //be sure it can be loaded
        if ( source && filterSource(source) ){
          sourceIndex = track.current_source;
        }
      }

      if (sourceIndex !== undefined){
        DEBUG && console.log("REACTPLAYLISTER / USE LAST SELECTED SOURCE FOR TRACK #"+trackIndex,sourceIndex);
      }else{
        sourceIndex = getNextSourceIndex(track,sourceIndex);
        DEBUG && console.log("REACTPLAYLISTER / SET SOURCE INDEX FOR TRACK #"+trackIndex,sourceIndex);
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
    const previousTracksQueue = getTracksQueue(playlist,trackIndex,props.loop,true);
    const nextTracksQueue = getTracksQueue(playlist,trackIndex,props.loop,false);
    const previousTracksQueueKeys = getArrayQueueKeys(playlist,previousTracksQueue);
    const nextTracksQueueKeys = getArrayQueueKeys(playlist,nextTracksQueue);

    appendControls = {
      ...appendControls,
      previous_tracks:  previousTracksQueueKeys,
      next_tracks:      nextTracksQueueKeys
    }

    //SOURCE
    const previousSourcesQueue = getSourcesQueue(track,sourceIndex,false,true);
    const nextSourcesQueue = getSourcesQueue(track,sourceIndex,false,false);
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
        }else if (playRequest && skipNoSources){
          DEBUG && console.log("REACTPLAYLISTER / NO SOURCES FOR PLAYING TRACK #"+trackIndex+", SKIP IT");
          skipTrack();
          return;
        }
      }

    }

    setSource(newSource);

  }, [controls]);

  //set player URL.
  useEffect(() => {
    DEBUG && console.log("REACTPLAYLISTER / SET SOURCE",source);
    if (source){
      if (url !== source.url){
          setUrl(source.url);
      }else{
        //if that source has already played, resets it.
        const played = reactPlayerRef.current.getCurrentTime();
        if (played){
          DEBUG && console.log("REACTPLAYLISTER / RESET SOURCE",source);
          reactPlayerRef.current.seekTo(0);
        }
      }
    }else{
      setUrl();
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

  //warn parent that we're skipping
  useEffect(()=> {
    if (typeof props.onSkipping === 'function') {
      props.onSkipping(skipping);
    }
  }, [skipping]);

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
    <div className='react-playlister'>
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
      onReady={handleSourceReady}
      onError={handleSourceError}
      onEnded={handleSourceEnded}

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

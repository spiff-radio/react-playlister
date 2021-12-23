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
  const autoskip = props.autoskip ?? true;

  const getProvidersOrder = (keys) => {
    keys = keys || ['file'];
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



  //should we skip if an error is fired ?
  const skipError = props.skipError ?? true;

  //should we skip if the track ends ?
  const skipEnded = props.skipEnded ?? true;

  //should we skip if track has no sources ?
  const skipNoSources = props.skipNoSources ?? true;

  //do we iterate URLs backwards ?
  //when a source fails, we need to know if we have to go backwards or not.
  const [backwards,setBackwards] = useState(false);

  //are we currently skipping ?
  const [skipping,setSkipping] = useState(true); //true on init, we've got to find the first track!

  const [indices,setIndices] = useState();
  const [playlist,setPlaylist] = useState();//our (transformed) datas
  const [controls,setControls] = useState({
    track:undefined,
    source:undefined,
    has_previous_track:false,
    has_next_track:false,
    has_previous_sources:false,
    has_next_source:false
  });

  const [source, setSource] = useState();
  const [url, setUrl] = useState();//current url

  //build a queue of keys based on an array
  //If item is NOT defined, it will return the full array.
  //If item IS defined (and exists); it will return the items following the current one.
  const getArrayQueue = (array,startItem,loop,backwards) => {

    //since we do not always pass a reference to startItem, we need to use a custom fn to check if it is our match.
    const isStartItem = (item,index,array) => {
      return ( JSON.stringify(item) === JSON.stringify(startItem) );
    }

    let index = array.findIndex(isStartItem);
    index = (index === -1) ? undefined : index;

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

    if (autoskip){
      return isPlayableTrack(track);
    }

    return true;
  }

  const getTracksQueue = (playlist,track,loop,backwards) => {
    let queue = getArrayQueue(playlist,track,loop,backwards);

    if (autoskip){
      //filter only playable tracks
      queue = queue.filter(filterTrack);
    }
    return queue;
  }

  const getNextTrack = (playlist,track,loop,backwards) => {
    const queue = getTracksQueue(playlist,track,loop,backwards);
    return queue[0];
  }

  const filterSource = (source) => {

    if (autoskip){

      if (!source.playable){
        return false;
      }

      if (!source.autoplay){
        return false;
      }
    }

    return true;
  }

  const getSourcesQueue = (track,source,loop,backwards) => {
    let queue = getArrayQueue(track?.sources,source,loop,backwards);
    return queue.filter(filterSource);
  }

  const getNextSource = (track,source,loop,backwards) => {
    const queue = getSourcesQueue(track,source,loop,backwards);
    return queue[0];
  }

  const handleSourceReady = (player) => {

    setBackwards(false);
    setSkipping(false);//if we were skipping

    const track = controls.track;
    const source = controls.source;

    console.log("REACTPLAYLISTER / SOURCE READY FOR TRACK",source,track);

    //inherit React Player prop
    if (typeof props.onReady === 'function') {
      props.onReady(player);
    }

  }

  const handleSourceError = (e) => {

    setSourceNotPlayable(controls.source);

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

    const track = controls.track;
    const queue = getTracksQueue(playlist,undefined,false,false);
    const lastTrack = queue[queue.length - 1];

    if ( (track === lastTrack) ) { //tell parent the last played track has ended
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

  const skipTrack = (goBackwards) => {

    setSkipping(true);

    //update the backwards state if it changes
    goBackwards = (goBackwards !== undefined) ? goBackwards : backwards;
    setBackwards(goBackwards);

    const backwardsMsg = goBackwards ? ' TO PREVIOUS' : ' TO NEXT';

    const newTrack = getNextTrack(playlist,controls.track,loop,goBackwards);

    DEBUG && console.log("REACTPLAYLISTER / SKIP"+backwardsMsg,controls.track,newTrack);

    if (newTrack !== undefined){
      setControls(prevState => {
        return{
          ...prevState,
          track:newTrack,
          source:undefined
        }
      })
    }else{ //no playable tracks
      DEBUG && console.log("REACTPLAYLISTER / NO PLAYABLE TRACKS");
      handlePlaylistEnded();
    }
  }

  const skipSource = (goBackwards) => {

    setSkipping(true);

    const track = controls.track;
    const source = controls.source;

    //update the backwards state if it changes
    goBackwards = (goBackwards !== undefined) ? goBackwards : backwards;
    setBackwards(goBackwards);

    const backwardsMsg = goBackwards ? ' TO PREVIOUS' : ' TO NEXT';

    //try to find another playable source for this track
    const newSource = getNextSource(track,source,true,goBackwards);

    //no source found, skip track
    if (newSource === undefined){
      skipTrack(goBackwards);
      return;
    }

    DEBUG && console.log("REACTPLAYLISTER / SKIP"+backwardsMsg+" FROM SOURCE -> SOURCE",source,newSource);

    setControls(prevState => {
      return{
        ...prevState,
        source:newSource
      }
    })

  }

  const previousTrack = () => {
    skipTrack(true);
  }

  const nextTrack = () => {
    skipTrack(false);
  }

  const previousSource = () => {
    skipSource(true);
  }

  const nextSource = () => {
    skipSource(false);
  }

  //get a track based on a source item
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

  //build our initial data
  useEffect(() => {

    //returns true if the track has at least one playable source
    const hasPlayableSources = track => {
      return ( track.sources.find(source => source.playable) !== undefined );
    }

    const sortSourcesByProvider = (a,b) => {

      if (!sortProviders.length) return 0;

      let aProviderKey = sortProviders.indexOf(a.provider?.key);
      aProviderKey = (aProviderKey !== -1) ? aProviderKey : sortProviders.length; //if key not found, consider at the end

      let bProviderKey = sortProviders.indexOf(b.provider?.key);
      bProviderKey = (bProviderKey !== -1) ? bProviderKey : sortProviders.length; //if key not found, consider at the end

      return aProviderKey - bProviderKey;

    }

    const sortSourcesByAutoplay = (a,b) =>{
      return b.autoplay - a.autoplay;
    }

    const sortSourcesByPlayable = (a,b) =>{
      return b.playable - a.playable;
    }

    const makeTrack = (urls,track_index) => {

      urls = [].concat(urls || []);//force array (it might be a single URL string)
      urls = urls.flat(Infinity);//flatten

      let sources = urls.map(function(url,i) {

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

      //sort sources
      /*
      sources = sources.sort(sortSourcesByPlayable);
      sources = sources.sort(sortSourcesByAutoplay);
      if (sortProviders){
        sources = sources.sort(sortSourcesByProvider);
      }
      */

      let track = {
        sources:sources
      }

      track = {
        ...track,
        index:track_index,
        playable: hasPlayableSources(track),
        current_source: getNextSource(track)//default source index
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
    if (playlist){//we have an old playlist record


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

  //set default indices from props (if any)
  useEffect(() => {

    const indexes = Array.isArray(props.index) ? props.index : [props.index];//force array
    if (indexes[0] === undefined) return;

    //compare against previous state
    if (indices){
      if( JSON.stringify(indexes)==JSON.stringify(indices) ) return;
    }

    DEBUG && console.log("REACTPLAYLISTER / SET INDEXES FROM PROP AT INIT",indexes);

    setIndices(indices);

  }, [props.index]);

  //load source & track from indices
  useEffect(() => {

    if (indices === undefined) return;

    const trackIndex = indices[0] ?? undefined;
    const sourceIndex = indices[1] ?? undefined;

    const track = playlist[trackIndex];
    const source = track.sources[sourceIndex];

    setControls(prevState => {
      return{
        ...prevState,
        track:track,
        source:source
      }
    })

  }, [indices]);

  //if track/source is not defined
  useEffect(() => {
    if ( !playlist ) return;

    let track = controls.track;
    let source = controls.source;

    //track
    if ( track === undefined ){
      track = getNextTrack(playlist);
      if (track === undefined) return;
      DEBUG && console.log("REACTPLAYLISTER / SET DEFAULT TRACK",track);
    }

    //source
    if ( source === undefined ){

      //use current source if any
      //TOUFIX TOUIMPROVE URGENT
      if (track.current_source){
        const checkSource = track.sources[track.current_source];
        //be sure it can be loaded
        if ( checkSource && filterSource(checkSource) ){
          source = checkSource;
        }
      }

      if (source !== undefined){
        DEBUG && console.log("REACTPLAYLISTER / USE LAST SELECTED SOURCE FOR TRACK #"+track,source);
      }else{
        source = getNextSource(track);
        DEBUG && console.log("REACTPLAYLISTER / SET SOURCE INDEX FOR TRACK #"+track,source);
      }

    }

    setControls(prevState => {
      return{
        ...prevState,
        track:track,
        source:source
      }
    })

  }, [playlist,controls.track,controls.source]);

  //update previous/next controls
  useEffect(() => {

    if (!playlist) return;

    const track = controls.track;
    if (track === undefined) return;

    const source = controls.source;
    if ( (source === undefined) && track.sources.length ) return; //this track HAS sources so a source index should be passed to update controls.  If the track has NO sources (thus a source index cannot be set) do continue

    let appendControls = {};

    //TRACK
    const previousTracksQueue = getTracksQueue(playlist,track,loop,true);
    const nextTracksQueue = getTracksQueue(playlist,track,loop,false);

    appendControls = {
      ...appendControls,
      has_previous_track:  (previousTracksQueue?.length !== 0),
      has_next_track:      (nextTracksQueue?.length !== 0)
    }

    //SOURCE
    const previousSourcesQueue = getSourcesQueue(track,source,false,true);
    const nextSourcesQueue = getSourcesQueue(track,source,false,false);

    appendControls = {
      ...appendControls,
      has_previous_sources: (previousSourcesQueue?.length !== 0),
      has_next_source:      (nextSourcesQueue?.length !== 0)
    }

    setControls(prevState => {
      return{
        ...prevState,
        ...appendControls
      }
    })


  }, [controls.track,controls.source,loop,autoskip]);

  //set current_source property of the track object.
  //It will be used as fallback if no source is specified when selecting a track.

    useEffect(() => {

    const track = controls.track;
    const source = controls.source;

    if (track === undefined) return;
    if (source === undefined) return;

    //update playlist track; and use prevState to ensure value is not overriden; because we set this state asynchronously
    //https://github.com/facebook/react/issues/16858#issuecomment-534257343
    setPlaylist(prevState => {

      const newState =
        prevState.map(
          (playlistItem) => {
            if (playlistItem === track){
              return {
                ...track,
                current_source:source
              };
            }else{
              return playlistItem;
            }
          }
        )

        return newState;
    });


  }, [controls.track,controls.source]);


  //select source
  useEffect(() => {

    let newSource = undefined;
    const track = controls.track;
    const source = controls.source;

    if (track !== undefined){
      if (track.sources.length){
        if (source){
          setSource(newSource);
        }
      }else if (playRequest && skipNoSources){
        DEBUG && console.log("REACTPLAYLISTER / NO SOURCES FOR PLAYING TRACK, SKIP IT",track);
        skipTrack();
        return;
      }

    }



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

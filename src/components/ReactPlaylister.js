import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle  } from "react";
import ReactPlayer from 'react-player';
import { default as reactplayerProviders } from 'react-player/lib/players/index.js';

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

  const [playlist,setPlaylist] = useState();//our (transformed) datas

  //object containing each playlist URL (as properties);
  //with its playable / error status
  //this way, even if an URL is used multiple times, those properties will be shared.
  const [urlCollection,setUrlCollection] = useState([]);

  const [hasInitPlaylist,setHasInitPlaylist] = useState(false);
  const [trackHistory,setTrackHistory] = useState([]);

  const [controls,setControls] = useState({
    has_previous_track:false,
    has_next_track:false,
    has_previous_source:false,
    has_next_source:false,
    playing:false,
    playLoading:false,//when play is requested but that media is not playing yet.
    mediaLoading:false,
  });

  const [pair,setPair] = useState({
    track:undefined,
    source:undefined
  });

  const [url, setUrl] = useState();//url for ReactPlayer

  //build a queue of keys based on an array
  //If needle is NOT defined, it will return the full array.
  //If needle IS defined (and exists); it will return the items following the needle.
  const getArrayQueue = (array,needle,loop,backwards) => {

    let needleIndex = undefined;
    let previousQueue = [];
    let nextQueue = [];
    let queue = [];

    const isStartItem = (item,index,array) => {
      return ( item.index === needle.index );
    }

    //find the array index of the needle
    if (needle){
      needleIndex = array.findIndex(isStartItem);
      needleIndex = (needleIndex === -1) ? undefined : needleIndex;
    }

    if (needleIndex !== undefined){
      var nextIndex = needleIndex+1;

      if (nextIndex < array.length){
        nextQueue = array.slice(nextIndex);
      }

      if (needleIndex > 0){
        previousQueue = array.slice(0,needleIndex);
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
      //(for instance, you might want to resolve a promise in a parent component)
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

  const getTracksQueue = (track,loop,backwards) => {
    let queue = getArrayQueue(playlist,track,loop,backwards);

    if (autoskip){
      //filter only playable tracks
      queue = queue.filter(filterTrack);
    }

    if (shuffle){

      //https://stackoverflow.com/a/2450976/782013
      const shuffleArray = (array) => {
        let currentIndex = array.length,  randomIndex;

        // While there remain elements to shuffle...
        while (currentIndex != 0) {

          // Pick a remaining element...
          randomIndex = Math.floor(Math.random() * currentIndex);
          currentIndex--;

          // And swap it with the current element.
          [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
        }
        return array;
      }
      queue = shuffleArray(queue);
    }

    return queue;
  }

  const getNextTrack = (track,loop,backwards) => {
    const queue = getTracksQueue(track,loop,backwards);
    return queue[0];
  }

  const filterSource = (source) => {

    if (source === undefined) return false;

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

    setControls(prevState => {
      return{
        ...prevState,
        mediaLoading:false
      }
    })

    const track = pair.track;
    const source = pair.source;

    console.log("REACTPLAYLISTER / TRACK #"+track.index+" SOURCE #"+source.index+" LOADED",source.url);

    //inherit React Player prop
    if (typeof props.onReady === 'function') {
      props.onReady(player);
    }

    //TOUFIX
    //allow to filter track & source using a fn prop ?

  }

  const handleSourceError = (e) => {

    const sourceUrl = pair.source.url;

    console.log("REACTPLAYLISTER / ERROR PLAYING MEDIA",pair.source.url);

    setUrlCollection({
      ...urlCollection,
      [sourceUrl]:{
        ...urlCollection[sourceUrl],
        error:'Error while playing media',
        playable:false
      }
    })

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

    if (typeof props.onSourceEnded === 'function') {
      props.onSourceEnded(pair.source);
    }

    const track = pair.track;
    const queue = getTracksQueue(undefined,false,false);
    const lastTrack = queue[queue.length - 1];

    if ( (track === lastTrack) ) { //tell parent the last played track has ended
      handlePlaylistEnded();
    }else if(skipEnded){//skip to next track
      nextTrack();
    }

  }

  const handleSourcePlay = () => {
    //inherit React Player prop
    if (typeof props.onPlay === 'function') {
      props.onPlay();
    }

    setControls(prevState => {
      return{
        ...prevState,
        playing:true,
        playLoading:false
      }
    })

  }

  const handleSourcePause = () => {
    //inherit React Player prop
    if (typeof props.onPause === 'function') {
      props.onPause();
    }

    setControls(prevState => {
      return{
        ...prevState,
        playing:false
      }
    })

  }

  const handleSourceDuration = duration => {

    //inherit React Player prop
    if (typeof props.onDuration === 'function') {
      props.onDuration(duration);
    }

    const source = pair.source;
    source.duration = duration * 1000; //in ms

    //TOUFIX TOUCHECK should we update the track duration too ?

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

    const newTrack = getNextTrack(pair.track,loop,goBackwards);

    if (newTrack){

      DEBUG && console.log("REACTPLAYLISTER / SKIP FROM TRACK #"+pair.track.index+backwardsMsg,newTrack.index);

      setPair({
        track:newTrack,
        source:undefined
      })
    }else{ //no more playable tracks
      handlePlaylistEnded();
    }
  }

  const skipSource = (goBackwards) => {

    setSkipping(true);

    const track = pair.track;
    const source = pair.source;

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

    setPair(prevState => {
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

  //build our playlist based on the prop URLs
  useEffect(() => {
    console.log("REACTPLAYLISTER / INIT PLAYLIST FROM URLS");

    setHasInitPlaylist(false);

    /*
    Build Playlist
    */

    //build a clean playlist based on an array of URLs
    const buildPlaylist = (urls) => {

      const buildTrack = (urls,track_index) => {

        //defaults
        let track = {
          index:track_index,
          current:undefined,
          playable:undefined,
          sources:[]
        }

        const buildTrackSources = (index,urls) => {

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

          urls = [].concat(urls || []);//force array (it might be a single URL string)
          urls = urls.flat(Infinity);//flatten

          let sources = urls.map(function(url,i) {

            const isSourceProvider = (provider) => {
              return provider.canPlay(url);
            }

            const provider = reactplayerProviders.find(isSourceProvider);

            return {
              index:i,
              trackIndex:index,
              current:false,
              playable:true,//default
              url:url,
              error:undefined,
              autoplay:provider ? !disabledProviders.includes(provider.key) : undefined,
              provider:provider ? {name:provider.name,key:provider.key} : undefined,
              duration:undefined
            }
          });

          //sort sources

          sources = sources.sort(sortSourcesByPlayable);
          sources = sources.sort(sortSourcesByAutoplay);
          if (sortProviders){
            sources = sources.sort(sortSourcesByProvider);
          }

          return sources
        }

        track.sources = buildTrackSources(track_index,urls);

        //set default source
        const currentSource = getNextSource(track);
        track.sources = track.sources.map(
          (item) => {
            return {
              ...item,
              current:(item === currentSource)
            }
          }
        )

        return track;

      }

      urls = [].concat(urls || []);//force array

      return urls.map(
        (v, i) => {
          return buildTrack(v,i)
        }
      );
    }

    const newPlaylist = buildPlaylist(props.urls);

    setPlaylist(newPlaylist);

  }, [props.urls]);

  //initialize a list of unplayable URLs
  useEffect(() => {

    if (!playlist) return;
    if (hasInitPlaylist) return;//avoid infinite loop

    let collection = {};

    playlist.forEach(function(track){
      track.sources.forEach(function(source){

        const url = source.url;
        const supported = ReactPlayer.canPlay(source.url);

        collection[url] = {
          playable:supported,
          error:supported ? undefined : 'Not supported by ReactPlayer'
        }

      });
    });

    console.log("COUCOU REACTPLAYLISTER / INIT URLS COLLECTION",collection);

    setUrlCollection(collection);

  }, [playlist]);

  //determine when the playlist has been initialized;
  //this will help us avoid infinite loops on some hooks.
  useEffect(() => {
    if (!playlist) return;
    if (hasInitPlaylist) return;

    console.log("REACTPLAYLISTER / PLAYLIST HAS INIT",playlist);

    setHasInitPlaylist(true);

  }, [playlist]);

  //load default indices from props (if any)
  useEffect(() => {

    if (!playlist) return;
    if (!hasInitPlaylist) return;

    const propIndices = Array.isArray(props.index) ? props.index : [props.index];//force array

    if (propIndices[0] === undefined) return;

    const trackIndex = propIndices[0] ?? undefined;
    const sourceIndex = propIndices[1] ?? undefined;

    const track = playlist[trackIndex] ?? undefined;
    const source = track?.sources[sourceIndex] ?? undefined;

    DEBUG && console.log("REACTPLAYLISTER / INIT TRACK & SOURCE FROM PROP INDICES",[trackIndex,sourceIndex]);

    setPair({
      track:track,
      source:source
    })

  }, [hasInitPlaylist,props.index]);

  //if track is not defined, use the first one available.
  useEffect(() => {
    if ( !hasInitPlaylist ) return;
    if ( pair.track ) return;//run this hook only if we don't have a track yet

    const firstTrack = getNextTrack();
    if (!firstTrack) return;//abord

    DEBUG && console.log("REACTPLAYLISTER / SET DEFAULT TRACK",firstTrack);

    setPair({
      track:firstTrack,
      source:undefined
    })

  }, [playlist,pair.track]);

  //if source is not defined, use either the 'selected' one, or get the first playable one.
  useEffect(() => {
    if ( !hasInitPlaylist ) return;
    if ( !pair.track ) return;
    if ( pair.source ) return;//run this hook only if we don't have a source yet

    //last selected source
    let currentSource = pair.track.sources.find(function(source) {
      return ( source.current === true );
    });

    currentSource = filterSource(currentSource) ? currentSource : undefined;//ensure it can be played

    //first available source
    const firstSource = getNextSource(pair.track);

    if (!currentSource && !firstSource) return; //abord

    //so source selected is...
    let source = currentSource ? currentSource : firstSource;

    if (source === currentSource){
      DEBUG && console.log("REACTPLAYLISTER / USE LAST SELECTED SOURCE FOR TRACK #"+pair.track.index,currentSource.index);
    }else if (source === firstSource){
      DEBUG && console.log("REACTPLAYLISTER / SET SOURCE INDEX FOR TRACK #"+pair.track.index,firstSource.index);
    }

    setPair({
      ...pair,
      source:source
    })

  }, [playlist,pair]);

  //update the 'playable' properties for tracks and sources
  useEffect(() => {

    if (!playlist) return;
    if (!hasInitPlaylist) return;

    DEBUG && console.log("REACTPLAYLISTER / SET 'PLAYABLE' PROPERTIES BASED ON URL COLLECTION",urlCollection);

    setPlaylist(prevState => {
      return revState.map(
      (trackItem) => {

        const getUpdatedSources = (track) => {
          return track.sources.map(
            (sourceItem) => {

              const url = sourceItem.url;
              const urlCollectionItem = urlCollection[url];

              if (!urlCollectionItem) return sourceItem;

              const urlPlayable = urlCollectionItem.playable;
              const urlError = urlCollectionItem.error;

              return {
                ...sourceItem,
                playable:urlPlayable,
                error:urlError
              }
            }
          )
        }

        const updatedSources = getUpdatedSources(trackItem);

        const playableSources = updatedSources.filter(function(source) {
          return source.playable;
        });
        const hasPlayableSources = (playableSources.length > 0);

        return {
          ...trackItem,
          playable:hasPlayableSources,
          sources:updatedSources
        }
      }
    );
    });

  }, [urlCollection]);

  //update the 'current' properties for tracks and sources
  useEffect(() => {

    const track = pair.track;
    const source = pair.source;

    if (!track) return;

    DEBUG && console.log("REACTPLAYLISTER / SET 'CURRENT' PROPERTY FOR PAIR",pair);

    setPlaylist(prevState => {
      return prevState.map(
      (trackItem) => {

        const isCurrentTrack = (trackItem.index === track.index);

        //for the selected track only
        //update the 'current' property of its sources

        const getUpdatedSources = (track) => {
          return track.sources.map(
            (sourceItem) => {
              return {
                ...sourceItem,
                current:(sourceItem.index === source?.index)
              }
            }
          )
        }

        return {
          ...trackItem,
          current:isCurrentTrack,
          sources:isCurrentTrack ? getUpdatedSources(trackItem) : trackItem.sources
        }
      }
    );
    }
  );

  }, [pair]);

  //update tracks history
  //TOUFIX TOUCHECK
  useEffect(() => {

    const track = pair.track;
    const source = pair.source;
    if (!track || !source) return;

    const trackIndex = track.index;

    const lastItem = trackHistory[trackHistory.length - 1];
    if (lastItem === trackIndex) return;

    const newHistory = [...trackHistory, trackIndex];

    console.log("REACTPLAYLISTER / UPDATE TRACKS HISTORY",newHistory);

    setTrackHistory(newHistory)

  }, [pair]);

  //set source URL (or skip track)
  useEffect(() => {

    const track = pair.track;
    if (!track) return;

    //this track has no sources
    if (!track.sources.length){
      DEBUG && console.log("REACTPLAYLISTER / TRACK #"+track.index+" HAS NO SOURCES...");
      if (playRequest && skipNoSources){
        DEBUG && console.log("REACTPLAYLISTER / ...THUS SKIP IT");
        skipTrack();
      }
    }

    /*
    Set URL from source
    */

    const source = pair.source;
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



  }, [pair]);

  //update the controls
  useEffect(() => {

    if (!playlist) return;

    const track = pair.track;
    if (track === undefined) return;

    const source = pair.source;
    if ( (source === undefined) && track.sources.length ) return; //this track HAS sources so a source index should be passed to update controls.  If the track has NO sources (thus a source index cannot be set) do continue

    let appendControls = {};

    //TRACK
    const previousTracksQueue = getTracksQueue(track,loop,true);
    const nextTracksQueue = getTracksQueue(track,loop,false);

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
      has_previous_source: (previousSourcesQueue?.length !== 0),
      has_next_source:      (nextSourcesQueue?.length !== 0)
    }

    setControls(prevState => {
      return{
        ...prevState,
        ...appendControls
      }
    })


  }, [pair,loop,autoskip]);

  //warn parent that the playlist has been updated
  useEffect(() => {
    if (!hasInitPlaylist) return;
    if (typeof props.onPlaylistUpdated === 'function') {
      props.onPlaylistUpdated(playlist);
    }
  }, [playlist]);

  //warn parent that controls have been updated
  useEffect(() => {
    if (!hasInitPlaylist) return;
    if (!controls) return;
    if (typeof props.onControlsUpdated === 'function') {
      props.onControlsUpdated(controls);
    }
  }, [controls]);

  //when play is requested, set loading until media is playing
  useEffect(() => {
    setControls(prevState => {
      return{
        ...prevState,
        playLoading:prevState.playLoading ? prevState.playing : (playRequest && !prevState.playing)
      }
    })
  }, [playRequest]);

  //when media URL is loaded, set loading until media is ready
  useEffect(() => {
    setControls(prevState => {
      return{
        ...prevState,
        mediaLoading:(url !== undefined)
      }
    })
  }, [url]);

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
      onPlay={handleSourcePlay}
      onPause={handleSourcePause}
      onDuration={handleSourceDuration}

      //inherit methods
      onStart={props.onStart}
      onBuffer={props.onBuffer}
      onBufferEnd={props.onBufferEnd}
      onSeek={props.onSeek}
      onProgress={props.onProgress}
      onClickPreview={props.onClickPreview}
      onEnablePIP={props.onEnablePIP}
      onDisablePIP={props.onDisablePIP}
      />
    </div>
  );
})

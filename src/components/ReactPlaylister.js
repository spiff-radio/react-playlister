import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle  } from "react";
import ReactPlayer from 'react-player';
import { default as reactplayerProviders } from 'react-player/lib/players/index.js';
import './ReactPlaylister.scss';

const DEBUG = (process.env.NODE_ENV !== 'production');
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

  //do we iterate URLs backwards ?
  //when a source fails, we need to know if we have to go backwards or not.
  const [backwards,setBackwards] = useState(false);

  //are we currently skipping ?
  const [skipping,setSkipping] = useState(false);

  const [playlist,setPlaylist] = useState();//our (transformed) datas

  //object containing each playlist URL (as properties);
  //with its playable / error status
  //this way, even if an URL is used multiple times, those properties will be shared.
  const [urlCollection,setUrlCollection] = useState([]);

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

  const [url, setUrl] = useState();//url for ReactPlayer

  const [didFirstInit,setDidFirstInit] = useState(false);

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
      return track.playable;
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

    if (shuffle){

      //https://stackoverflow.com/a/2450976/782013
      const shuffleArray = (array) => {
        let currentIndex = array.length,  randomIndex;

        // While there remain elements to shuffle...
        while (currentIndex !== 0) {

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

  const getNextTrack = (playlist,track,loop,backwards) => {
    const queue = getTracksQueue(playlist,track,loop,backwards);
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

  export const getCurrentTrack = (playlist) => {
    return playlist?.find(function(track) {
      return track.current;
    });
  }

  export const getCurrentSource = (playlist) => {
    const track = getCurrentTrack(playlist);
    return track?.sources.find(function(source) {
      return source.current;
    });
  }

  export const getCurrentIndices = (playlist) => {
    const track = getCurrentTrack(playlist);
    const source = getCurrentSource(playlist);
    return [track?.index,source.index];
  }

  const handleSourceReady = (player) => {

    const track = getCurrentTrack(playlist);
    const source = getCurrentSource(playlist);
    if (!track || !source) return;

    //inherit React Player prop
    if (typeof props.onReady === 'function') {
      props.onReady(player);
    }

    setBackwards(false);

    if(playRequest){
      setSkipping(false);
    }

    //if we are not requesting a play, consider that the media as finished loading when the player is ready.
    if (!playRequest){
      setControls(prevState => {
        return{
          ...prevState,
          mediaLoading:false
        }
      })

      console.log("REACTPLAYLISTER / TRACK #"+track.index+" SOURCE #"+source.index+" READY",source.url);
    }

  }

  const handleSourceStart = (e) => {

    const track = getCurrentTrack(playlist);
    const source = getCurrentSource(playlist);
    if (!track || !source) return;

    //inherit React Player prop
    if (typeof props.onStart === 'function') {
      props.onStart(e);
    }

    //if we are requesting a play, consider that the media as finished loading once it has started.
    if (playRequest){
      setControls(prevState => {
        return{
          ...prevState,
          mediaLoading:false
        }
      })

      console.log("REACTPLAYLISTER / TRACK #"+track.index+" SOURCE #"+source.index+" READY",source.url);
    }
  }

  const handleSourceError = (e) => {

    const source = getCurrentSource(playlist);
    const sourceUrl = source.url;

    console.log("REACTPLAYLISTER / ERROR PLAYING MEDIA",sourceUrl);

    //urls collection
    const newUrlCollection = {
      ...urlCollection,
      [sourceUrl]:{
        ...urlCollection[sourceUrl],
        error:'Error while playing media',
        playable:false
      }
    }

    setUrlCollection(newUrlCollection);

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

    const track = getCurrentTrack(playlist);
    const source = getCurrentSource(playlist);

    //inherit React Player prop
    if (typeof props.onEnded === 'function') {
      props.onEnded();
    }

    if (typeof props.onSourceEnded === 'function') {
      props.onSourceEnded(source);
    }

    const queue = getTracksQueue(playlist,undefined,false,false);
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

    const source = getCurrentSource(playlist);
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

    //update the backwards state if it changes
    goBackwards = (goBackwards !== undefined) ? goBackwards : backwards;
    setBackwards(goBackwards);

    const backwardsMsg = goBackwards ? ' TO PREVIOUS' : ' TO NEXT';

    const currentTrack = getCurrentTrack(playlist);
    const newTrack = getNextTrack(playlist,currentTrack,loop,goBackwards);
    const newTrackIndex = newTrack ? newTrack.index : undefined;

    if (newTrack){

      DEBUG && console.log("REACTPLAYLISTER / SKIP FROM TRACK #"+currentTrack.index+backwardsMsg,newTrackIndex);

      setPlaylist( updatePlaylistCurrent(playlist,newTrackIndex) )

    }else{ //no more playable tracks
      handlePlaylistEnded();
    }
  }

  const skipSource = (goBackwards) => {

    const track = getCurrentTrack(playlist);
    const source = getCurrentSource(playlist);

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

    setPlaylist( updatePlaylistCurrent(playlist,[track.index,newSource.index]) )

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

  const sanitizeIndices = (indices,playlist) => {

    if (!playlist) throw new Error("sanitizeIndices() requires a playlist to be defined.");

    let trackIndex = undefined;
    let sourceIndex = undefined;
    const propIndices = Array.isArray(indices) ? indices : [indices];//force array

    if (propIndices[0] !== undefined){
      trackIndex = propIndices[0] ?? undefined;
      sourceIndex = propIndices[1] ?? undefined;

      const track = playlist[trackIndex] ?? undefined;
      const source = track?.sources[sourceIndex] ?? undefined;

      trackIndex = track ? trackIndex : undefined;
      sourceIndex = source ? sourceIndex : undefined;

    }

    return [trackIndex,sourceIndex];

  }

  const validateIndices = (indices,playlist)=>{

    if (!playlist) throw new Error("validateIndices() requires a playlist to be defined.");

    indices = sanitizeIndices(indices,playlist);

    let trackIndex = indices[0];
    let sourceIndex = indices[1];

    let track = playlist[trackIndex];
    let source = playlist[sourceIndex];

    if (!track){
      track = getNextTrack(playlist);//default track
    }

    if (!source && track){

      //last selected source
      let currentSource = track.sources.find(function(source) {
        return ( source.current === true );
      });

      //ensure it can be played
      currentSource = filterSource(currentSource) ? currentSource : undefined;

      //first available source
      const firstSource = getNextSource(track);

      if (currentSource || firstSource){
        source = currentSource ? currentSource : firstSource;
      }
    }

    trackIndex = track ? track.index : undefined;
    sourceIndex = source ? source.index : undefined;

    return [trackIndex,sourceIndex];

  }

  const updatePlaylistPlayable = (playlist,urlCollection) => {
    playlist = playlist.map((trackItem) => {

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

      trackItem.sources = getUpdatedSources(trackItem);

      const playableSources = trackItem.sources.filter(function(source) {
        return source.playable;
      });

      trackItem.playable = (playableSources.length > 0);

      if (typeof props.filterPlayableTrack === 'function') {
        trackItem.playable = props.filterPlayableTrack(trackItem.playable,trackItem);
      }

      return trackItem;
    });
    DEBUG && console.log("REACTPLAYLISTER / SET 'PLAYABLE' PROPERTIES BASED ON URL COLLECTION",playlist);
    return playlist;
  }

  const updatePlaylistCurrent = (playlist,indices) => {

    if (!playlist) return;

    indices = validateIndices(indices,playlist);

    const trackIndex = indices[0];
    const sourceIndex = indices[1];

    if (trackIndex !== undefined){
      playlist = playlist.map((trackItem) => {

        const isCurrentTrack = (trackItem.index === trackIndex);

        //for the selected track only
        //update the 'current' property of its sources

        const getUpdatedSources = (track) => {
          return track.sources.map(
            (sourceItem) => {
              return {
                ...sourceItem,
                current:(sourceItem.index === sourceIndex)
              }
            }
          )
        }

        return {
          ...trackItem,
          current:isCurrentTrack,
          sources:isCurrentTrack ? getUpdatedSources(trackItem) : trackItem.sources
        }
      });
    }

    DEBUG && console.log("REACTPLAYLISTER / SET 'CURRENT' PROPERTY FOR TRACK#"+indices[0]+" SOURCE#"+indices[1],playlist);

    return playlist;

  }

  const buildUrlCollection = (urls) => {
    let collection = {};

    urls.forEach(function(url){

      const supported = ReactPlayer.canPlay(url);

      collection[url] = {
        playable:supported,
        error:supported ? undefined : 'Not supported by ReactPlayer'
      }

    });

    return collection;

  }

  //build our playlist based on the prop URLs
  useEffect(() => {

    if (!props.urls) return;

    /*
    Build Playlist
    */

    //urls collection
    let newUrlCollection = buildUrlCollection(props.urls);
    newUrlCollection = {...newUrlCollection,...urlCollection};
    setUrlCollection(newUrlCollection);

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
    let newPlaylist = buildPlaylist(props.urls);

    //set playable props
    newPlaylist = updatePlaylistPlayable(newPlaylist,urlCollection);

    //set current prop
    if (!didFirstInit){
      newPlaylist = updatePlaylistCurrent(newPlaylist,props.index);
    }else{
      const indices = getCurrentIndices(playlist);
      newPlaylist = updatePlaylistCurrent(newPlaylist,indices);
    }

    DEBUG && console.log("REACTPLAYLISTER / PLAYLIST IS INITIALIZING WITH "+newPlaylist.length+" TRACKS.",newPlaylist);

    setPlaylist(newPlaylist);

  }, [props.urls]);

  //update playable
  useEffect(() => {
    if (!didFirstInit) return;

    setPlaylist(prevState => {
      return updatePlaylistPlayable(prevState,urlCollection);
    })

  }, [urlCollection]);

  //update indices from prop.
  useEffect(() => {
    if (!didFirstInit) return;

    setPlaylist(prevState => {
      return updatePlaylistCurrent(prevState,props.index);
    })

  }, [props.index]);

  //after first render
  useEffect(() => {
    setDidFirstInit(true);
  }, []);

  //update tracks history
  //TOUFIX TOUCHECK
  useEffect(() => {

    const track = getCurrentTrack(playlist);
    const source = getCurrentSource(playlist);
    if (!track || !source) return;

    const trackIndex = track.index;

    const lastItem = trackHistory[trackHistory.length - 1];
    if (lastItem === trackIndex) return;

    const newHistory = [...trackHistory, trackIndex];

    console.log("REACTPLAYLISTER / UPDATE TRACKS HISTORY",newHistory);

    setTrackHistory(newHistory)

  }, [playlist]);

  //set source URL (or skip track)
  useEffect(() => {

    const track = getCurrentTrack(playlist);
    if (!track) return;

    setSkipping(playRequest);

    if (playRequest){
      let doSkip = false;
      if (!track.playable){
        DEBUG && console.log("REACTPLAYLISTER / TRACK #"+track.index+" IS NOT PLAYABLE.");
        doSkip = true;
      }else if (!track.sources.length){
        //this track has probably been set to 'playable' using the filterPlayableTrack method.
        //Now, allow to filter the skip value. See Readme.
        DEBUG && console.log("REACTPLAYLISTER / TRACK #"+track.index+" IS SET AS PLAYABLE, BUT HAS NO SOURCES.",track.index);
        doSkip = true;
        if (typeof props.filterSkipUnsourcedTrack === 'function') {
          doSkip = props.filterSkipUnsourcedTrack(doSkip,track);
        }
      }

      if (doSkip){
        skipTrack();
        return;
      }
    }

    /*
    Set URL from source
    */

    const source = getCurrentSource(playlist);
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
      //we would like to use
      //setUrl();
      //here, but it seems that it makes some browser (eg. iOS Firefox) stop when skipping to the next track.
      //so just hide our player using the 'skipping' state for now.
      //we should check again for this in a few months.
    }

  }, [playlist]);

  //update the controls
  useEffect(() => {

    if (!playlist) return;

    const track = getCurrentTrack(playlist);
    if (!track) return;

    const source = getCurrentSource(playlist);
    if ( !source && track.sources.length ) return; //this track HAS sources so a source index should be passed to update controls.  If the track has NO sources (thus a source index cannot be set) do continue

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
      has_previous_source: (previousSourcesQueue?.length !== 0),
      has_next_source:      (nextSourcesQueue?.length !== 0)
    }

    setControls(prevState => {
      return{
        ...prevState,
        ...appendControls
      }
    })


  }, [playlist,loop,autoskip]);

  //warn parent that the playlist has been updated
  useEffect(() => {
    if (!playlist) return;
    if (typeof props.onPlaylistUpdated === 'function') {
      props.onPlaylistUpdated(playlist);
    }
  }, [playlist]);

  //warn parent that controls have been updated
  useEffect(() => {
    if (!controls) return;
    if (typeof props.onControlsUpdated === 'function') {
      props.onControlsUpdated(controls);
    }
  }, [controls]);

  //when play is requested, set loading until media is playing
  useEffect(() => {
    setControls({
      ...controls,
      playLoading:(playRequest && !controls.playing)
    })
  }, [playRequest,controls.playing]);

  //when media URL is loaded, set loading until media is ready
  useEffect(() => {
    setControls({
      ...controls,
      mediaLoading:(url !== undefined)
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
      playing={(playRequest && !skipping)}
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
      onStart={handleSourceStart}
      onError={handleSourceError}
      onEnded={handleSourceEnded}
      onPlay={handleSourcePlay}
      onPause={handleSourcePause}
      onDuration={handleSourceDuration}

      //inherit methods

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

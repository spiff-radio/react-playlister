import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle  } from "react";
import ReactPlayer from 'react-player';
import { default as reactplayerProviders } from 'react-player/lib/players/index.js';
import './ReactPlaylister.scss';

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
  return [track?.index,source?.index];
}

const DEBUG = (process.env.NODE_ENV !== 'production');
const REACTPLAYER_PROVIDER_KEYS = Object.values(reactplayerProviders).map(provider => {return provider.key});

export const ReactPlaylister = forwardRef((props, ref) => {

  const reactPlayerRef = useRef();

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

  //should we skip if an error is fired ?
  const skipError = props.skipError ?? true;

  //should we skip if the track ends ?
  const skipEnded = props.skipEnded ?? true;

  //do we iterate URLs backwards ?
  //when a source fails, we need to know if we have to go backwards or not.
  const [backwards,setBackwards] = useState(false);

  const [playRequest,setPlayRequest] = useState(false);
  const [loading,setLoading] = useState(false);
  const [skipping,setSkipping] = useState(false);

  const [playlist,setPlaylist] = useState();//our (transformed) datas

  //object containing each playlist URL (as properties);
  //with its playable / error status
  //this way, even if an URL is used multiple times, those properties will be shared.
  const [mediaErrors,setMediaErrors] = useState([]);

  const [trackHistory,setTrackHistory] = useState([]);

  const [controls,setControls] = useState({
    has_previous_track:false,
    has_next_track:false,
    has_previous_source:false,
    has_next_source:false,
    playing:false,
    loading:false,
  });

  const [url, setUrl] = useState();//url for ReactPlayer

  const [didFirstInit,setDidFirstInit] = useState(false);
  const [indices,setIndices] = useState(false);

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

  const getTracksQueue = (playlist,track,loop,backwards) => {
    let queue = getArrayQueue(playlist,track,loop,backwards);

    if (autoskip){
      //filter only playable tracks
      queue = queue.filter(track => {
        return track.playable;
      });
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

    const track = getCurrentTrack(playlist);
    const source = getCurrentSource(playlist);
    if (!track || !source) return;

    //inherit React Player prop
    if (typeof props.onReady === 'function') {
      props.onReady(player);
    }

    setBackwards(false);

    //if we are not requesting a play,
    //consider that 'loading' has finished when the player is ready.
    if (!playRequest){
      setLoading(false);
    }

    console.log("REACTPLAYLISTER / TRACK #"+track.index+" SOURCE #"+source.index+" READY",source.url);

  }

  const handleSourceStart = (e) => {

    const track = getCurrentTrack(playlist);
    const source = getCurrentSource(playlist);
    if (!track || !source) return;

    //inherit React Player prop
    if (typeof props.onStart === 'function') {
      props.onStart(e);
    }



    console.log("REACTPLAYLISTER / TRACK #"+track.index+" SOURCE #"+source.index+" STARTED",source.url);
  }

  const handleSourceError = (e) => {

    const source = getCurrentSource(playlist);
    const sourceUrl = source.url;

    console.log("REACTPLAYLISTER / ERROR PLAYING MEDIA",sourceUrl);

    //urls collection
    const newMediaErrors = {
      ...mediaErrors,
      [sourceUrl]:'Error while playing media'
    }

    setMediaErrors(newMediaErrors);

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

    setPlayRequest(true);
    setLoading(false);


    setControls(prevState => {
      return{
        ...prevState,
        playing:true
      }
    })

  }

  const handleSourcePause = () => {
    //inherit React Player prop
    if (typeof props.onPause === 'function') {
      props.onPause();
    }

    setPlayRequest(false);
    setLoading(false);

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

  const handleSourceBuffer = () => {

    //inherit React Player prop
    if (typeof props.onBuffer === 'function') {
      props.onBuffer();
    }

    setLoading(true);

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
    setSkipping(true);

    const backwardsMsg = goBackwards ? ' TO PREVIOUS' : ' TO NEXT';

    const currentTrack = getCurrentTrack(playlist);
    const newTrack = getNextTrack(playlist,currentTrack,loop,goBackwards);
    const newTrackIndex = newTrack ? newTrack.index : undefined;

    if (newTrack){

      DEBUG && console.log("REACTPLAYLISTER / SKIP FROM TRACK #"+currentTrack.index+backwardsMsg,newTrackIndex);

      setIndices(newTrackIndex);

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

    setSkipping(true);

    const backwardsMsg = goBackwards ? ' TO PREVIOUS' : ' TO NEXT';

    //try to find another playable source for this track
    const newSource = getNextSource(track,source,true,goBackwards);

    //no source found, skip track
    if (newSource === undefined){
      skipTrack(goBackwards);
      return;
    }

    DEBUG && console.log("REACTPLAYLISTER / SKIP"+backwardsMsg+" FROM SOURCE -> SOURCE",source,newSource);

    setIndices([track.index,newSource.index]);

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

  const validateIndices = (indices,playlist)=>{

    if (!playlist) throw new Error("validateIndices() requires a playlist to be defined.");

    indices = Array.isArray(indices) ? indices : [indices];//force array

    let trackIndex = indices[0];
    let sourceIndex = indices[1];

    let track = playlist.find(function(track) {
      return ( track.index === trackIndex );
    });

    let source = track?.sources.find(function(source) {
      return ( source.index === sourceIndex );
    });

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

  const updatePlaylistPlayable = (playlist,mediaErrors,filters) => {

    if (!playlist.length) return playlist;
    mediaErrors = mediaErrors || [];
    filters =  (typeof filters === 'undefined') ? true : filters;

    playlist = [...playlist].map((trackItem) => {

      const getUpdatedSources = (track) => {
        return track.sources.map(
          (sourceItem) => {

            const url = sourceItem.url;
            const mediaError = mediaErrors[url];

            return {
              ...sourceItem,
              playable:(sourceItem.supported && !mediaError),
              error:mediaError
            }
          }
        )
      }

      trackItem.sources = getUpdatedSources(trackItem);

      const playableSources = trackItem.sources.filter(function(source) {
        return source.playable;
      });

      //is the track playable ?
      trackItem.playable = (playableSources.length > 0);
      //allow to filter the playable value (only if it has been already set; so it does not run on first init).
      if ( filters && (typeof props.filterPlayableTrack === 'function') ) {
        trackItem.playable = props.filterPlayableTrack(trackItem.playable,trackItem);
      }

      return trackItem;
    });
    DEBUG && console.log("REACTPLAYLISTER / SET 'PLAYABLE' PROPERTIES",playlist);
    return playlist;
  }

  const updatePlaylistCurrent = (playlist,indices) => {

    if (!playlist.length) return playlist;

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

  //update the "playing" state from props
  useEffect(()=>{
    if(typeof props.playing === 'undefined') return;
    setPlayRequest(props.playing);
  },[props.playing])

  useEffect(()=>{
    console.log("***SET PLAY REQUEST",playRequest);
  },[playRequest])

  useEffect(()=>{
    console.log("***SET LOADING",loading);
  },[loading])

  useEffect(()=>{
    console.log("***SET SKIPPING",skipping);
  },[skipping])

  //build our playlist based on the prop URLs
  useEffect(() => {

    if (!props.urls) return;

    /*
    Build Playlist
    */

    //build a clean playlist based on an array of URLs
    const buildPlaylist = (urls,indices) => {

      const sortProviders = getProvidersOrder(props.sortProviders);
      const disabledProviders = getDisabledProviders(props.disabledProviders);

      const buildTrack = (urls,url_index) => {

        //defaults
        let track = {
          index:url_index,
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

          urls = [].concat(urls || []);//force array (it might be a single URL string)
          urls = urls.flat(Infinity);//flatten

          let sources = urls.map(function(url,i) {

            const provider = reactplayerProviders.find(provider => {
              return provider.canPlay(url);
            });

            return {
              index:i,
              trackIndex:index,
              current:false,
              supported:ReactPlayer.canPlay(url),
              playable:undefined,
              url:url,
              error:undefined,
              disabled:provider ? disabledProviders.includes(provider.key) : undefined,
              provider:provider ? {name:provider.name,key:provider.key} : undefined,
              duration:undefined
            }
          });

          //remove unsupported sources
          sources = sources.filter(source => {
            return source.supported;
          });

          //remove disabled providers sources
          sources = sources.filter(source => {
            return !source.disabled;
          });

          //sort sources
          if (sortProviders){
            sources = sources.sort(sortSourcesByProvider);
          }

          return sources
        }

        track.sources = buildTrackSources(url_index,urls);

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

      let playlist = urls.map(
        (v, i) => {
          return buildTrack(v,i)
        }
      );

      //remove unplayable tracks
      playlist = updatePlaylistPlayable(playlist,undefined);
      playlist = playlist.filter(track => {
        return track.playable;
      });

      playlist = updatePlaylistCurrent(playlist,indices);

      DEBUG && console.log("PLAYLIST BUILT WITH "+playlist.length+"/"+urls.length+" PLAYABLE TRACKS.",[...playlist],urls);

      return playlist;


    }
    const indices = !didFirstInit ? props.index : getCurrentIndices(playlist);

    let newPlaylist = buildPlaylist(props.urls,indices);

    setPlaylist(newPlaylist);

  }, [props.urls]);

  //update indices from prop.
  useEffect(() => {
    if (!didFirstInit) return;
    setIndices(props.index);
  }, [props.index]);

  //after first render
  useEffect(() => {
    setDidFirstInit(true);
  }, []);

  //update 'current' & 'playable' properties
  useEffect(() => {
    setPlaylist(prevState => {
      let playlist = prevState;
      playlist = updatePlaylistPlayable(prevState,mediaErrors);
      playlist = updatePlaylistCurrent(prevState,indices);
      return playlist;
    })
  },[indices,mediaErrors])

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
      setSkipping(false);
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
      //so just do things using our 'loading' state for now.
      //we should check again for this in a few months.
    }

  }, [playlist]);

  //update the previous/next controls
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

  //update 'loading' property of the controls
  useEffect(() => {

    if (loading){
      DEBUG &&console.log("STARTED LOADING WITH INDICES",indices);
    }else{
      DEBUG &&console.log("FINISHED LOADING WITH INDICES",indices);
    }

    setControls(prevState => {
      return{
        ...prevState,
        loading:loading
      }
    })
  }, [loading]);

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
      muted={props.muted} //avoid bugs when loading
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

      onBuffer={handleSourceBuffer}
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

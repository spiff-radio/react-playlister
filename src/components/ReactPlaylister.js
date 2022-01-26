import React, { useState, useCallback,useEffect, useRef, forwardRef, useImperativeHandle  } from "react";
import ReactPlayer from 'react-player';
import './ReactPlaylister.scss';
import {
  buildPlaylist,
  getCurrentTrack,
  getCurrentSource,
  getTracksQueue,
  getNextTrack,
  getSourcesQueue,
  getNextSource,
  setPlayableItems,
  setCurrentItems,
  getUnsupportedUrls,
  validateIndices,
  useSanitizedIndices
} from './utils.js';



const DEBUG = (process.env.NODE_ENV !== 'production');

export const ReactPlaylister = forwardRef((props, ref) => {

  const loop = props.loop ?? false;
  const shuffle = props.shuffle ?? false;
  const autoskip = props.autoskip ?? true;//ignore unplayable or disabled track & sources when skipping
  const sourceNotStartingTimeOutMs = 7000;

  const reactPlayerRef = useRef();
  const trackHistory = useRef([]);
  const sourceStartTimeout = useRef(undefined);

  //do we iterate URLs backwards ?
  //when a source fails, we need to know if we have to go backwards or not.
  const [backwards,setBackwards] = useState(false);
  const [playRequest,setPlayRequest] = useState(false);

  const [mediaLoaded,setMediaLoaded] = useState(false);
  const [mediaStarted,setMediaStarted] = useState(false);

  //loaders
  const [skipping,setSkipping] = useState(false);
  const [sourceLoading,setSourceLoading] = useState(false);
  const [playLoading,setPlayLoading] = useState(false);
  const [startLoading,setStartLoading] = useState(false);
  const [loading,setLoading] = useState(false);


  const [playlistHasInit,setPlaylistHasInit] = useState(false);
  const [playlist, setPlaylist] = useState(undefined);

  //object containing each playlist URL (as properties);
  //with its playable / error status
  //this way, even if an URL is used multiple times, those properties will be shared.
  const [mediaErrors, setMediaErrors] = useState(undefined);

  const [url, setUrl] = useState();//url for ReactPlayer

  const [controls,setControls] = useState({
    has_previous_track:false,
    has_next_track:false,
    has_previous_source:false,
    has_next_source:false,
    playing:false,
    loading:false,
  });

  // https://stackoverflow.com/a/70862465/782013
  // useCallback memoizes the function so that it's not recreated on every
  // render. This also prevents the custom hook from looping infinintely
  const sanitizeIndicesFn = useCallback((rawIndices) => {
    if (!playlist) return;
    // Whatever you actually do to sanitize the index goes in here,
    // but I'll just use the makeEven function for this example
    return validateIndices(rawIndices,playlist);
    // If you use other variables in this function which are defined in this
    // component (e.g. you mentioned an array state of some kind), you'll need
    // to include them in the dependency array below:
  }, [playlist]);

  // Now simply use the sanitized index where you need it,
  // and the setter will sanitize for you when setting it (like in the
  // click handler in the button below)
  const [indices, setSanitizedIndices] = useSanitizedIndices(sanitizeIndicesFn,undefined);



  const clearStartSourceTimeout = () => {
    if (!sourceStartTimeout.current) return;

    var now = new Date();
    var time = now.getHours() + ":" + now.getMinutes() + ":" + now.getSeconds();
    console.log("REACTPLAYLISTER / CLEARED START TIMEOUT AT "+time);
    clearTimeout(sourceStartTimeout.current);
    sourceStartTimeout.current = undefined;
  }

  //Players DO fire a 'ready' event even if the media is unavailable (geoblocking,wrong URL...)
  //without having an error fired.
  //So let's hack this with a timeout.
  const setStartSourceTimeout = source => {

    if (!source) throw new Error("Missing source.");
    if (sourceStartTimeout.current) return;//a timeout has already been registered and has not been cleared yet; abord.

    const msSkipTime = Date.now() + sourceNotStartingTimeOutMs;
    const skipTime = new Date(msSkipTime);
    const humanSkipTime = skipTime.getHours() + ":" + skipTime.getMinutes() + ":" + skipTime.getSeconds();
    console.log("REACTPLAYLISTER / INITIALIZE A START TIMEOUT FOR TRACK #"+source.trackIndex+" SOURCE #"+source.index+" : IF IT HAS NOT STARTED AT "+humanSkipTime+", IT WILL BE SKIPPED.");

    const timer = setTimeout(() => {
      const time = new Date();
      const humanTime = time.getHours() + ":" + time.getMinutes() + ":" + time.getSeconds();
      console.log("REACTPLAYLISTER / TIMEOUT ENDED FOR TRACK #"+source.trackIndex+" SOURCE #"+source.index+" AND SOURCE HAS NOT STARTED PLAYING.  IT IS NOW "+humanTime+", SKIP SOURCE!");
      setSourceError(source,'Media failed to play after '+sourceNotStartingTimeOutMs+' ms');
      skipSource();
    }, sourceNotStartingTimeOutMs);
    sourceStartTimeout.current = timer;

  }

  const handleSourceReady = (player) => {

    const track = getCurrentTrack(playlist);
    const source = getCurrentSource(playlist);
    if (!track || !source) return;

    //inherit React Player prop
    if (typeof props.onReady === 'function') {
      props.onReady(player);
    }

    DEBUG && console.log("REACTPLAYLISTER / TRACK #"+source.trackIndex+" SOURCE #"+source.index+" READY",source.url);

    setMediaLoaded(true);

  }

  const handleSourceStart = (e) => {

    const track = getCurrentTrack(playlist);
    const source = getCurrentSource(playlist);
    if (!track || !source) return;

    //inherit React Player prop
    if (typeof props.onStart === 'function') {
      props.onStart(e);
    }

    DEBUG && console.log("REACTPLAYLISTER / TRACK #"+source.trackIndex+" SOURCE #"+source.index+" STARTED",source.url);

    setMediaStarted(true);

  }

  const setSourceError = (source,error) => {

    console.log("REACTPLAYLISTER / POPULATE TRACK #"+source.trackIndex+" SOURCE #"+source.index+" ERROR",error);

    //urls collection
    const newMediaErrors = {
      ...mediaErrors,
      [source.url]:error
    }

    setMediaErrors(newMediaErrors);
  }

  const handleSourceError = (e) => {

    const source = getCurrentSource(playlist);

    setSourceError(source,'Error while playing media');

    //inherit React Player prop
    if (typeof props.onError === 'function') {
      props.onError(e);
    }

    //skip automatically if the player is playing
    if (playRequest){
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

    const queue = getTracksQueue(playlist,undefined,true,false,false);

    const lastTrack = queue[queue.length - 1];

    if ( (track === lastTrack) ) { //tell parent the last played track has ended
      handlePlaylistEnded();
    }else if (autoskip){//skip to next track
      nextTrack();
    }

  }

  const handleSourcePlay = () => {

    //inherit React Player prop
    if (typeof props.onPlay === 'function') {
      props.onPlay();
    }

    setPlayRequest(true);//align our state
    setPlayLoading(false);

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

    //<--TOUFIX TOUCHECK USEFUL ?
    //!skipping : bugfix:  Sometimes, ReactPlayer fire this event after the media is ready.
    //playLoading; when buffering
    if (!skipping && !playLoading){
      setPlayRequest(false);//align our state
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

    //TOUFIX TOUCHECK : sometimes source is not ready ?
    if (!source){
      console.log("error while trying to set source duration : no source");
      return;
    }

    source.duration = duration * 1000; //in ms

    //TOUFIX TOUCHECK should we update the track duration too ?

  }

  const handleSourceBuffer = () => {

    //inherit React Player prop
    if (typeof props.onBuffer === 'function') {
      props.onBuffer();
    }

    setPlayLoading(true);

  }

  const handlePlaylistEnded = () => {
    DEBUG && console.log("REACTPLAYLISTER / PLAYLIST ENDED");
    setPlayRequest(false);
    if(typeof props.onPlaylistEnded === 'function'){
      props.onPlaylistEnded();
    }
  }

  const skipTrack = (goBackwards) => {

    setSkipping(true);

    //update the backwards state if it changes
    goBackwards = (goBackwards !== undefined) ? goBackwards : backwards;
    setBackwards(goBackwards);

    const backwardsMsg = goBackwards ? 'TO PREVIOUS' : 'TO NEXT';

    const currentTrack = getCurrentTrack(playlist);
    const newTrack = getNextTrack(playlist,currentTrack,autoskip,loop,goBackwards);
    const newTrackIndex = newTrack ? newTrack.index : undefined;

    if (newTrack){

      DEBUG && console.log("REACTPLAYLISTER / SKIP FROM TRACK #"+currentTrack.index+" "+backwardsMsg+" TRACK #"+newTrackIndex);

      setSanitizedIndices(newTrackIndex);

    }else{ //no more playable tracks
      handlePlaylistEnded();
    }
  }

  const skipSource = (goBackwards) => {

    setSkipping(true);

    const track = getCurrentTrack(playlist);
    const source = getCurrentSource(playlist);

    //update the backwards state if it changes
    goBackwards = (goBackwards !== undefined) ? goBackwards : backwards;
    setBackwards(goBackwards);

    const backwardsMsg = goBackwards ? ' TO PREVIOUS' : ' TO NEXT';

    //try to find another playable source for this track
    const newSource = getNextSource(track,source,autoskip,true,goBackwards);

    //no source found, skip track
    if (newSource === undefined){
      skipTrack(goBackwards);
      return;
    }

    DEBUG && console.log("REACTPLAYLISTER / SKIP"+backwardsMsg+" FROM TRACK #"+source.trackIndex+" SOURCE #"+source.index+" TO TRACK #"+newSource.trackIndex+" SOURCE #"+newSource.index);

    setSanitizedIndices([track.index,newSource.index]);

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


    //build playlist from URLs prop
    useEffect(()=>{

      setPlaylistHasInit(false);
      setPlaylist(undefined);

      const updatedPlaylist = buildPlaylist(props.urls,props.sortedProviders,props.disabledProviders,props.ignoreUnsupportedUrls,props.ignoreDisabledUrls,props.ignoreEmptyUrls);


      //initialize media errors (unsupported or disabled sources)
      //TOUFIX disabled
      const getInitialPlaylistErrors = playlist => {
        let errors = {}
        const unSupportedUrls = getUnsupportedUrls(playlist);
        unSupportedUrls.forEach(function(url){
          errors[url] = 'URL not supported';
        });

        return errors;
      }

      const newMediaErrors = getInitialPlaylistErrors(updatedPlaylist);
      const updatedMediaErrors = {...mediaErrors,...newMediaErrors};

      //update global media errors so they are not lost when component updates
      setMediaErrors(updatedMediaErrors);

      //reset indices if they were defined

      if (indices !== undefined){
        console.log("INDICES YO",indices);
        setSanitizedIndices([...indices]);//use spread operator to force state update
      }

      setPlaylist(updatedPlaylist);

    },[props.urls])

    //set 'playable' playlist items when media errors are updated
    useEffect(()=>{
      if (!playlist) return;
      setPlaylist(prevState => {
        let newPlaylist = prevState.map(a => {return {...a}});//deep clone data; we can't mutate the state
        return setPlayableItems(newPlaylist,mediaErrors,props.filterPlayableTrack);
      })
      setPlaylistHasInit(true);
    },[mediaErrors])

    //set indices playlist at init & when prop changes
    useEffect(()=>{
      if (!playlistHasInit) return;
      setSanitizedIndices(props.index || 0);
    },[playlistHasInit,props.index])

    //reset
    useEffect(()=>{
      clearStartSourceTimeout();
      setSkipping(false);
      setStartLoading(false);
      setPlayLoading(false);
      setMediaLoaded(false);
      setMediaStarted(false);
    },[indices])

    //set 'current' items in playlist when indices are updated
    useEffect(()=>{

      if (!playlistHasInit) return;
      if (!indices) return;

      setPlaylist(prevState => {
        let newPlaylist = prevState.map(a => {return {...a}});//deep clone data; we can't mutate the state
        return setCurrentItems(newPlaylist,indices);//set 'current'
      })

    },[indices])

  ////States relationships

  //update the "playing" state from props
  useEffect(()=>{
    if(typeof props.playing === 'undefined') return;
    setPlayRequest(props.playing);
    setPlayLoading(props.playing);
  },[props.playing])

  //Media is loaded and requested - await that it starts !
  useEffect(()=>{
    if (mediaLoaded && playRequest){
      setStartLoading(true);
    }
  },[mediaLoaded])

  //Media has started
  useEffect(()=>{
    if (mediaStarted){
      setStartLoading(false);
    }
  },[mediaStarted])

  //has the skipping ended ?
  //either the media is loaded and there is no play request
  //either the media has started.
  useEffect(()=>{
    const stopSkip = ( (mediaLoaded && !playRequest) || mediaStarted );
    if (stopSkip){
      setSkipping(false);
    }
  },[mediaLoaded,mediaStarted])

  //if the skipping has ended, then reset the backwards state.
  useEffect(()=>{
    if (!skipping){
      setBackwards(false);
    }
  },[skipping])

  //sourceLoading - TRUE if the media is not loaded yet while we request it to play.
  useEffect(()=>{
    const bool = (playRequest && !mediaLoaded);
    setSourceLoading(bool);
  },[playRequest,mediaLoaded])

  //Set a start timeout if we're requesting a media to play; and it has not started yet
  useEffect(()=>{

    const source = getCurrentSource(playlist);
    if (!source) return;

    const bool = (playRequest && !sourceLoading && !mediaStarted);
    if (!bool) return;

    setStartSourceTimeout(source);
  },[playRequest,sourceLoading,url])

  //clear START timeout once the media has started.
  useEffect(()=>{
    if (mediaStarted){
      clearStartSourceTimeout();
    }
  },[mediaStarted])

  //set main loader
  useEffect(()=>{
    const bool = (skipping || sourceLoading || startLoading || playLoading);
    setLoading(bool);
  },[skipping,sourceLoading,startLoading,playLoading])

  ////States feedback

  useEffect(()=>{
    if (!playlistHasInit) return;
    DEBUG && console.log("***REACTPLAYLISTER / STATE PLAY REQUEST",playRequest);
  },[playRequest])

  useEffect(()=>{
    if (!playlistHasInit) return;
    DEBUG && console.log("REACTPLAYLISTER / STATE LOADING",loading,{
      skipping:skipping,
      sourceLoading:sourceLoading,
      startLoading:startLoading,
      playLoading:playLoading
    });
  },[loading])

  //update tracks history
  //TOUFIX TOUCHECK
  useEffect(() => {

    const source = getCurrentSource(playlist);
    if (!source) return;

    const trackIndex = source.trackIndex;

    const history = trackHistory.current;
    const lastHistoryIndex = history.length - 1;

    const lastItem = history[lastHistoryIndex];
    if (lastItem === trackIndex) return;

    trackHistory.current = [...history, trackIndex];

    console.log("REACTPLAYLISTER / UPDATE TRACKS HISTORY",trackHistory.current);

  }, [playlist]);

  //set source URL (or skip track)
  useEffect(() => {

    const track = getCurrentTrack(playlist);
    if (!track) return;

    if (playRequest){
      let doSkip = false;

      const playableSources = track.sources.filter(track => {
        return track.playable;
      });

      if (!track.playable){
        DEBUG && console.log("REACTPLAYLISTER / TRACK #"+track.index+" IS NOT PLAYABLE.");
        doSkip = true;
      }else if (!playableSources){
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

    //Set URL from source

    const source = getCurrentSource(playlist);

    if (source && source.playable){
      setUrl(source.url);
    }else{
      //we would like to use
      //setUrl();
      //here, but it seems that it makes some browser (eg. iOS Firefox) stop when skipping to the next track.
      //so just do things using our 'loading' state for now.
      //we should check again for this in a few months.
    }

  }, [playlist,playRequest]);

  //update the previous/next controls
  useEffect(() => {

    if (!playlist) return;

    const track = getCurrentTrack(playlist);
    if (!track) return;

    const source = getCurrentSource(playlist);
    if ( !source && track.sources.length ) return; //this track HAS sources so a source index should be passed to update controls.  If the track has NO sources (thus a source index cannot be set) do continue

    let appendControls = {};

    //TRACK
    const previousTracksQueue = getTracksQueue(playlist,track,true,loop,true);
    const nextTracksQueue = getTracksQueue(playlist,track,true,loop,false);
    //SOURCE
    const previousSourcesQueue = getSourcesQueue(track,source,true,false,true);
    const nextSourcesQueue = getSourcesQueue(track,source,true,false,false);

    appendControls = {
      ...appendControls,
      has_previous_track:  (previousTracksQueue?.length !== 0),
      has_next_track:      (nextTracksQueue?.length !== 0),
      has_previous_source: (previousSourcesQueue?.length !== 0),
      has_next_source:      (nextSourcesQueue?.length !== 0)
    }

    setControls(prevState => {
      return{
        ...prevState,
        ...appendControls
      }
    })


  }, [playlist,loop,autoskip,shuffle]);

  //update 'loading' property of the controls
  useEffect(() => {
    if (!playlistHasInit) return;

    const source = getCurrentSource(playlist);

    if (loading){
      DEBUG &&console.log("STARTED LOADING TRACK#"+source.trackIndex+" SOURCE#"+source.index);
    }else{
      DEBUG &&console.log("FINISHED LOADING TRACK#"+source.trackIndex+" SOURCE#"+source.index);
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
    if (!playlistHasInit) return;
    if (typeof props.onPlaylistUpdated === 'function') {
      props.onPlaylistUpdated(playlist);
    }
  }, [playlist]);

  //warn parent that controls have been updated
  useEffect(() => {
    if (!playlistHasInit) return;
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

   /*
   //TOUFIX TOUCHECK USEFUL ? KEEP IT HERE FOR NOW.
   const rewindMedia = () => {
     //if that source has already played, resets it.
     const played = reactPlayerRef.current.getCurrentTime();

     if (played){
       DEBUG && console.log("REACTPLAYLISTER / REWIND MEDIA");
       reactPlayerRef.current.seekTo(0);
     }
   }
   */

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
      volume={loading ? 0 : props.volume}
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

import React, { useState, useCallback,useEffect, useRef, forwardRef, useImperativeHandle  } from "react";
import ReactPlayer from 'react-player';
import './ReactPlaylister.scss';
import {
  getCurrentTrack,
  getCurrentSource,
  buildPlaylist,
  getTracksQueue,
  getSourcesQueue,
  setPlayableItems,
  setCurrentItems,
  getNotSupportedMediaErrors,
  getSkipTrackIndices,
  getSkipSourceIndices
} from './utils.js';

const DEBUG = (process.env.NODE_ENV !== 'production');

const ReactPlaylister = forwardRef((props, ref) => {

  const loop = props.loop ?? false;
  const shuffle = props.shuffle ?? false;
  const mediaTimeOutMs = 5000;

  const reactPlayerRef = useRef();
  const trackHistory = useRef([]);
  const mediaTimeOut = useRef(undefined);

  //do we iterate URLs reverse ?
  //when a source fails, we need to know if we have to go reverse or not.
  const [reverse,setReverse] = useState(false);
  const [playRequest,setPlayRequest] = useState(false);

  const [mediaLoaded,setMediaLoaded] = useState(false);
  const [mediaStarted,setMediaStarted] = useState(false);
  const [mediaRequested,setMediaRequested] = useState(false);

  //loaders
  const [skipping,setSkipping] = useState(false);
  const [sourceLoading,setSourceLoading] = useState(false);

  const [startLoading,setStartLoading] = useState(false);
  const [loading,setLoading] = useState(false);

  const [indices, setIndices] = useState(props.index);

  //object containing url (as key) - error message (as value)
  //this way, errors can be shared by sources having the same URL.
  const [mediaErrors, setMediaErrors] = useState(getNotSupportedMediaErrors(props.urls?.flat(Infinity)));

  const buildPlaylistFn = useCallback((urls) => {
    return buildPlaylist(urls,props.sortedProviders,props.disabledProviders,props.ignoreUnsupportedUrls,props.ignoreDisabledUrls,props.ignoreEmptyUrls);
  },[props.sortedProviders,props.disabledProviders,props.ignoreUnsupportedUrls,props.ignoreDisabledUrls,props.ignoreEmptyUrls])

  const [playlist,setPlaylist] = useState(buildPlaylistFn(props.urls));

  const [currentTrack, setCurrentTrack] = useState();
  const [currentSource, setCurrentSource] = useState();

  const [mediaUrl, setMediaUrl] = useState();//url for ReactPlayer

  const [controls,setControls] = useState({
    has_previous_track:false,
    has_next_track:false,
    has_previous_source:false,
    has_next_source:false,
    playing:false,
    loading:false,
  });

  const skipTrack = useCallback((goReverse) => {

    setSkipping(true);

    //update the reverse state if it changes
    goReverse = (goReverse !== undefined) ? goReverse : reverse;
    setReverse(goReverse);

    const skipIndices = getSkipTrackIndices(playlist,currentTrack,loop,goReverse);

    if (skipIndices === undefined){//no indices found
      handlePlaylistEnded();
      return;
    }

    const reverseMsg = goReverse ? 'TO PREVIOUS' : 'TO NEXT';
    DEBUG && console.log("REACTPLAYLISTER / SKIP FROM TRACK #"+currentTrack?.index+" "+reverseMsg+" TRACK #"+skipIndices[0]+" SOURCE #"+skipIndices[1]);

    setIndices(skipIndices);

  },[currentTrack,reverse,playlist,loop])

  const skipSource = useCallback((goReverse) => {

    setSkipping(true);

    //update the reverse state if it changes
    goReverse = (goReverse !== undefined) ? goReverse : reverse;
    setReverse(goReverse);

    const reverseMsg = goReverse ? ' TO PREVIOUS' : ' TO NEXT';

    const skipIndices = getSkipSourceIndices(currentTrack,currentSource,goReverse);

    if (indices === undefined){//no source found, skip track
      skipTrack(goReverse);
      return;
    }

    DEBUG && console.log("REACTPLAYLISTER / SKIP"+reverseMsg+" FROM TRACK #"+currentSource.trackIndex+" SOURCE #"+currentSource.index+" TO TRACK #"+skipIndices[0]+" SOURCE #"+skipIndices[1]);

    setIndices(skipIndices);

  },[reverse,currentTrack,currentSource])

  //Players DO fire a 'ready' event even if the media is unavailable (geoblocking,wrong URL...)
  //without having an error fired.
  //So let's hack this with a timeout.
  const setMediaTimeout = url => {

    if (!url) throw new Error("Missing media URL.");
    if (mediaTimeOut.current) return;//a timeout has already been registered and has not been cleared yet; abord.

    const msSkipTime = Date.now() + mediaTimeOutMs;
    const skipTime = new Date(msSkipTime);
    const humanSkipTime = skipTime.getHours() + ":" + skipTime.getMinutes() + ":" + skipTime.getSeconds();
    console.log("REACTPLAYLISTER / INITIALIZE A TIMEOUT FOR MEDIA: IF IT HAS NOT STARTED AT "+humanSkipTime+", IT WILL BE SKIPPED.",url);

    const timer = setTimeout(() => {
      const time = new Date();
      const humanTime = time.getHours() + ":" + time.getMinutes() + ":" + time.getSeconds();
      console.log("REACTPLAYLISTER / TIMEOUT ENDED FOR MEDIA: IT HAS NOT STARTED PLAYING.  IT IS NOW "+humanTime+", SKIP CURRENT SOURCE!",url);
      setSingleMediaError(url,'Media failed to play after '+mediaTimeOutMs+' ms');
      skipSource();
    }, mediaTimeOutMs);
    mediaTimeOut.current = timer;

  }

  const clearMediaTimeout = () => {
    if (!mediaTimeOut.current) return;

    var now = new Date();
    var time = now.getHours() + ":" + now.getMinutes() + ":" + now.getSeconds();
    console.log("REACTPLAYLISTER / CLEARED START TIMEOUT AT "+time);
    clearTimeout(mediaTimeOut.current);
    mediaTimeOut.current = undefined;
  }

  const setSingleMediaError = (url,error) => {

    console.log("REACTPLAYLISTER / MEDIA "+url+" ERROR",error);

    //urls collection
    const newMediaErrors = {
      ...mediaErrors,
      [url]:error
    }

    setMediaErrors(newMediaErrors);
  }

  const handleMediaReady = (player) => {

    //inherit React Player prop
    if (typeof props.onReady === 'function') {
      props.onReady(player);
    }

    DEBUG && console.log("REACTPLAYLISTER / MEDIA READY",mediaUrl);

    setMediaLoaded(true);

  }

  const handleMediaStart = (e) => {

    //inherit React Player prop
    if (typeof props.onStart === 'function') {
      props.onStart(e);
    }

    DEBUG && console.log("REACTPLAYLISTER / MEDIA STARTED",mediaUrl);

    setMediaStarted(true);

  }

  const handleMediaError = (e) => {

    setSingleMediaError(mediaUrl,'Error while playing media');

    //inherit React Player prop
    if (typeof props.onError === 'function') {
      props.onError(e);
    }

    //skip automatically if the player is playing
    if (playRequest){
      skipSource();
    }

  }

  const handleMediaEnded = () => {

    //inherit React Player prop
    if (typeof props.onEnded === 'function') {
      props.onEnded();
    }

    if (typeof props.onSourceEnded === 'function') {
      props.onSourceEnded(currentSource);
    }

    const queue = getTracksQueue(playlist,undefined,true,false,false);

    const lastTrack = queue[queue.length - 1];

    if ( (currentTrack === lastTrack) ) { //tell parent the last played track has ended
      handlePlaylistEnded();
    }else{//skip to next track
      nextTrack();
    }

  }

  const handleMediaPlay = () => {

    //inherit React Player prop
    if (typeof props.onPlay === 'function') {
      props.onPlay();
    }

    setPlayRequest(true);//align our state
    setMediaRequested(false);

    setControls(prevState => {
      return{
        ...prevState,
        playing:true
      }
    })

  }

  const handleMediaPause = () => {
    //inherit React Player prop
    if (typeof props.onPause === 'function') {
      props.onPause();
    }

    //<--TOUFIX TOUCHECK USEFUL ?
    //!skipping : bugfix:  Sometimes, ReactPlayer fire this event after the media is ready.
    //mediaRequested; when buffering
    if (!skipping && !mediaRequested){
      setPlayRequest(false);//align our state
    }


    setControls(prevState => {
      return{
        ...prevState,
        playing:false
      }
    })

  }

  const handleMediaDuration = duration => {

    //inherit React Player prop
    if (typeof props.onDuration === 'function') {
      props.onDuration(duration);
    }

    //TOUFIX TOUCHECK : sometimes source is not ready ?
    if (!currentSource){
      console.log("error while trying to set source duration : no source");
      return;
    }

    //TOUFIX URGENT we should rather update the playlist state here ?
    currentSource.duration = duration * 1000; //in ms

    //TOUFIX TOUCHECK should we update the track duration too ?

  }

  const handleSourceBuffer = () => {

    //inherit React Player prop
    if (typeof props.onBuffer === 'function') {
      props.onBuffer();
    }

    setMediaRequested(true);

  }

  const handlePlaylistEnded = () => {
    DEBUG && console.log("REACTPLAYLISTER / PLAYLIST ENDED");
    doReset();
    if(typeof props.onPlaylistEnded === 'function'){
      props.onPlaylistEnded();
    }
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

  const doReset = () => {
    DEBUG && console.log("REACTPLAYLISTER / RESET");
    setSkipping(false);
    setSourceLoading(false);
    setStartLoading(false);
    setMediaRequested(false);
    setMediaLoaded(false);
    setMediaStarted(false);
  }

  //update the "playing" state from props
  useEffect(()=>{
    if(props.playing === undefined) return;
    setPlayRequest(props.playing);
  },[props.playing])

  //indices from prop
  useEffect(()=>{
    setIndices(props.index);
  },[props.index])

  //update playlist & media errors when URLs do change
  useEffect(()=>{
    const urlMediaErrors = getNotSupportedMediaErrors(props.urls?.flat(Infinity));
    setPlaylist(buildPlaylistFn(props.urls));
    setMediaErrors({...mediaErrors,...urlMediaErrors});
  },[props.urls])

  //when URLS, media errors or indices are updated,
  //do update playlist.
  useEffect(()=>{
    if (playlist === undefined) return;
    setPlaylist(prevState => {
      let updated = prevState;
      updated = setPlayableItems(updated,mediaErrors,props.filterPlayableTrack,props.filterAutoplayableTrack);
      updated = setCurrentItems(updated,indices);
      return updated;
    })

  },[props.urls,mediaErrors,indices])

  //when playlist has been updated, populate current track & source.
  useEffect(()=>{
    const track = getCurrentTrack(playlist);
    const source = getCurrentSource(playlist);
    setCurrentTrack(track);
    setCurrentSource(source);
  },[playlist])

  //reset
  useEffect(()=>{
    doReset();
  },[currentTrack,currentSource])

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

  //if the skipping has ended, then reset the reverse state.
  useEffect(()=>{
    if (!skipping){
      setReverse(false);
    }
  },[skipping])

  //sourceLoading - TRUE if the media is not loaded yet while we request it to play.
  useEffect(()=>{
    const bool = (playRequest && !mediaLoaded && currentSource?.playable);
    setSourceLoading(bool);
  },[playRequest,mediaLoaded])

  //set main loader
  useEffect(()=>{
    const bool = (skipping || sourceLoading || startLoading || mediaRequested);
    setLoading(bool);
  },[skipping,sourceLoading,startLoading,mediaRequested])

  //update 'loading' property of the controls
  useEffect(() => {

    if (currentSource){
      if (loading){
        DEBUG &&console.log("STARTED LOADING TRACK#"+currentSource.trackIndex+" SOURCE#"+currentSource.index);
      }else{
        DEBUG &&console.log("FINISHED LOADING TRACK#"+currentSource.trackIndex+" SOURCE#"+currentSource.index);
      }
    }

    setControls(prevState => {
      return{
        ...prevState,
        loading:loading
      }
    })
  }, [loading]);

  ////States feedback

  useEffect(()=>{
    DEBUG && console.log("REACTPLAYLISTER / STATE PLAY REQUEST",playRequest);
  },[playRequest])

  useEffect(()=>{
    DEBUG && console.log("REACTPLAYLISTER / STATE LOADING",loading,{
      skipping:skipping,
      sourceLoading:sourceLoading,
      startLoading:startLoading,
      mediaRequested:mediaRequested
    });
  },[loading])

  //skip to something if some indices are undefined
  useEffect(() => {

    if (!playRequest) return;

    let doSkip = false;

    const playableSources = currentTrack?.sources.filter(source => {
      return !skipping ? source.playable : source.autoplayable;
    });

    const canPlayTrack = !skipping ? currentTrack.playable : currentTrack.autoplayable;

    const debugPlayString = skipping ? 'AUTOPLAYABLE' : "PLAYABLE";

    if (!canPlayTrack){
      DEBUG && console.log("REACTPLAYLISTER / TRACK #"+currentTrack.index+" IS NOT "+debugPlayString);
      doSkip = true;
    }else if (!playableSources){
      //this track has probably been set to 'playable' using the filterPlayableTrack method.
      //Now, allow to filter the skip value. See Readme.
      DEBUG && console.log("REACTPLAYLISTER / TRACK #"+currentTrack.index+" IS SET AS "+debugPlayString+", BUT HAS NO SOURCES.",currentTrack.index);
      doSkip = true;
      if (typeof props.filterSkipUnsourcedTrack === 'function') {
        doSkip = props.filterSkipUnsourcedTrack(doSkip,currentTrack);
      }
    }

    if (!doSkip) return;
    skipTrack();

  }, [playRequest,currentTrack,currentSource]);

  //update tracks history
  //TOUFIX TOUCHECK
  useEffect(() => {

    if (!currentTrack) return;

    const trackIndex = currentTrack.index;

    const history = trackHistory.current;
    const lastHistoryIndex = history.length - 1;

    const lastItem = history[lastHistoryIndex];
    if (lastItem === trackIndex) return;

    trackHistory.current = [...history, trackIndex];

    console.log("REACTPLAYLISTER / UPDATE TRACKS HISTORY",trackHistory.current);

  }, [currentTrack]);

  //set source URL
  useEffect(() => {

    if (!currentSource) return;
    //Set URL from source

    if (currentSource && currentSource.playable){
      setMediaUrl(currentSource.url);
    }else{
      //we would like to use
      //setMediaUrl();
      //here, but it seems that it makes some browser (eg. iOS Firefox) stop when skipping to the next track.
      //so just do things using our 'loading' state for now.
      //we should check again for this in a few months.
    }

  }, [currentSource,playRequest]);

  useEffect(()=>{
    if (playRequest){
      setMediaRequested(true);
    }
  },[mediaUrl])

  //set a timeout for the requested media
  useEffect(()=>{
    if (mediaRequested){
      setMediaTimeout(mediaUrl);
    }else{
      clearMediaTimeout();
    }
  },[mediaRequested])

  //clear START timeout once the media has started.
  useEffect(()=>{
    if (mediaStarted){
      clearMediaTimeout();
    }
  },[mediaStarted])

  //update the previous/next controls
  useEffect(() => {

    if (!playlist) return;
    if (!currentTrack) return;
    if ( !currentSource && currentTrack.sources.length ) return; //this track HAS sources so a source index should be passed to update controls.  If the track has NO sources (thus a source index cannot be set) do continue

    let appendControls = {};

    //TRACK
    const previousTracksQueue = getTracksQueue(playlist,currentTrack,true,loop,true);
    const nextTracksQueue = getTracksQueue(playlist,currentTrack,true,loop,false);

    //SOURCE
    const previousSourcesQueue = getSourcesQueue(currentTrack,currentSource,true,false,true);
    const nextSourcesQueue = getSourcesQueue(currentTrack,currentSource,true,false,false);

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


  }, [currentTrack,currentSource,loop,shuffle]);

  //warn parent that the playlist has been updated
  useEffect(() => {
    if (typeof props.onPlaylistUpdated === 'function') {
      props.onPlaylistUpdated(playlist);
    }
  }, [playlist]);

  //warn parent that the playlist has been updated
  useEffect(() => {
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
      url={mediaUrl}
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
      onReady={handleMediaReady}
      onStart={handleMediaStart}
      onError={handleMediaError}
      onEnded={handleMediaEnded}
      onPlay={handleMediaPlay}
      onPause={handleMediaPause}
      onDuration={handleMediaDuration}

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

export default ReactPlaylister;

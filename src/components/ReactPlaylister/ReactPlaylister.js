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
  getSkipSourceIndices,
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

  const [mediaBuffering,setMediaBuffering] = useState(false);

  //loaders
  const [skipping,setSkipping] = useState(false);

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

  const skipCurrentTrack = useCallback((goReverse) => {

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

  const skipCurrentSource = useCallback((goReverse) => {

    setSkipping(true);

    //update the reverse state if it changes
    goReverse = (goReverse !== undefined) ? goReverse : reverse;
    setReverse(goReverse);

    const reverseMsg = goReverse ? ' TO PREVIOUS' : ' TO NEXT';

    const skipIndices = getSkipSourceIndices(currentTrack,currentSource,goReverse);

    if (skipIndices === undefined){//no sources found, skip track

      let doSkip = true;

      //before skipping this track, make sure parent components allow it:
      //we might wait for a playlist update; eg. get track sources
      if (typeof props.filterSkipUnplayableTrack === 'function') {
        doSkip = props.filterSkipUnplayableTrack(doSkip,currentTrack);
      }

      if (doSkip){
        skipCurrentTrack(goReverse);
      }

      return;
    }

    DEBUG && console.log("REACTPLAYLISTER / SKIP"+reverseMsg+" FROM TRACK #"+currentSource.trackIndex+" SOURCE #"+currentSource.index+" TO TRACK #"+skipIndices[0]+" SOURCE #"+skipIndices[1]);

    setIndices(skipIndices);

  },[reverse,currentTrack,currentSource])

  //Players DO fire a 'ready' event even if the media is unavailable (geoblocking,wrong URL...)
  //without having an error fired.
  //So let's hack this with a timeout.
  const setMediaPlayTimeout = url => {

    if (!url) throw new Error("Missing media URL.");

    //there is already a timeout registered, clear it first
    //TOUFIX since we will replace the timeout, should it be cleared ?
    if (mediaTimeOut.current){
      clearTimeout(mediaTimeOut.current);
    }
    const msSkipTime = Date.now() + mediaTimeOutMs;
    const skipTime = new Date(msSkipTime);
    const humanSkipTime = skipTime.getHours() + ":" + skipTime.getMinutes() + ":" + skipTime.getSeconds();
    console.log("REACTPLAYLISTER / INITIALIZE A TIMEOUT FOR MEDIA: IF IT HAS NOT STARTED AT "+humanSkipTime+", IT WILL BE SKIPPED.",url);

    const timer = setTimeout(() => {
      const time = new Date();
      const humanTime = time.getHours() + ":" + time.getMinutes() + ":" + time.getSeconds();
      console.log("REACTPLAYLISTER / TIMEOUT ENDED FOR MEDIA: IT HAS NOT STARTED PLAYING.  IT IS NOW "+humanTime+", SKIP CURRENT SOURCE!",url);
      appendMediaError(url,'Media failed to play after '+mediaTimeOutMs+' ms');
      skipCurrentSource();
    }, mediaTimeOutMs);
    mediaTimeOut.current = timer;

  }

  const clearMediaPlayTimeout = () => {
    if (!mediaTimeOut.current) return;

    var now = new Date();
    var time = now.getHours() + ":" + now.getMinutes() + ":" + now.getSeconds();
    console.log("REACTPLAYLISTER / CLEARED START TIMEOUT AT "+time);
    clearTimeout(mediaTimeOut.current);
    mediaTimeOut.current = undefined;
  }

  const appendMediaError = (url,error) => {

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

    //we can consider that skipping is finished since the media is ready and there is no play request
    if (!playRequest){
      setSkipping(false);
    }else{
      //TOUFIX
      //disabled for now - see https://github.com/cookpete/react-player/issues/1382
      //setMediaPlayTimeout(mediaUrl);
    }

    DEBUG && console.log("REACTPLAYLISTER / MEDIA READY",mediaUrl);

  }

  const handleMediaStart = (e) => {

    //inherit React Player prop
    if (typeof props.onStart === 'function') {
      props.onStart(e);
    }

    DEBUG && console.log("REACTPLAYLISTER / MEDIA STARTED",mediaUrl);

    //TOUFIX
    //disabled for now - see https://github.com/cookpete/react-player/issues/1382
    //clearMediaPlayTimeout();

    setSkipping(false);
  }

  const handleMediaError = (e) => {

    appendMediaError(mediaUrl,'Error while playing media');

    //inherit React Player prop
    if (typeof props.onError === 'function') {
      props.onError(e);
    }

    //skip automatically if the player is playing
    if (playRequest){
      skipCurrentSource();
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
    setMediaBuffering(false);

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

    if (!skipping){
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

    setMediaBuffering(true);

  }

  const handlePlaylistEnded = () => {
    DEBUG && console.log("REACTPLAYLISTER / PLAYLIST ENDED");
    if(typeof props.onPlaylistEnded === 'function'){
      props.onPlaylistEnded();
    }
  }

  const previousTrack = () => {
    skipCurrentTrack(true);
  }

  const nextTrack = () => {
    skipCurrentTrack(false);
  }

  const previousSource = () => {
    skipCurrentSource(true);
  }

  const nextSource = () => {
    skipCurrentSource(false);
  }

  const rewindMedia = () => {
    //if that source has already played, resets it.
    const played = reactPlayerRef.current.getCurrentTime();

    if (played){
      DEBUG && console.log("REACTPLAYLISTER / REWIND MEDIA");
      reactPlayerRef.current.seekTo(0);
    }
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

      //clone current playlist so we don't mutate the state
      let updated = prevState.map(e=>{return {...e}});

      updated = setPlayableItems(updated,mediaErrors,props.filterPlayableTrack,props.filterAutoplayableTrack);
      updated = setCurrentItems(updated,indices);

      const track = getCurrentTrack(updated);
      const source = getCurrentSource(updated);
      setCurrentTrack(track);
      setCurrentSource(source);

      return updated;
    })

  },[props.urls,mediaErrors,indices])

  //if the skipping has ended, then reset the reverse state.
  useEffect(()=>{
    if (!skipping){
      setReverse(false);
    }
  },[skipping])

  //set main loader
  useEffect(()=>{
    const bool = (skipping || mediaBuffering);

    DEBUG && console.log("!!!REACTPLAYLISTER / SET STATE LOADING",bool,{
      skipping:skipping,
      mediaBuffering:mediaBuffering
    });

    setLoading(bool);

  },[skipping,mediaBuffering])

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

  //if playRequest = true, should we skip this item ?
  useEffect(() => {

    if (!playRequest) return;
    if (!currentTrack) return;

    if (!currentTrack.playable){
      DEBUG && console.log("REACTPLAYLISTER / TRACK #"+currentTrack.index+" IS NOT PLAYABLE, SKIP IT",currentTrack);
      skipCurrentTrack();
      return;
    }

    if (!currentSource){
      //this track has been set to 'playable' using the filterPlayableTrack method, but has no sources.
      DEBUG && console.log("REACTPLAYLISTER / TRACK #"+currentTrack.index+" - NO SOURCE SELECTED BUT TRACK IS SET AS PLAYABLE, AWAIT PLAYLIST REFRESH");
      return;
    }

    if (!currentSource.playable){
      DEBUG && console.log("REACTPLAYLISTER / TRACK #"+currentSource.trackIndex+" SOURCE #"+currentSource.index+" IS NOT PLAYABLE, SKIP IT",currentSource);
      skipCurrentSource();
      return;
    }

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
    if (currentSource?.playable){

      const url = currentSource.url;

      //bugfix : this URL is already loaded; consider skipping is done.
      if (url === mediaUrl){
        setSkipping(false);
      }else{
        setMediaUrl(url);
      }

    }else{
      //we would like to use
      //setMediaUrl();
      //here, but it seems that it makes some browser (eg. iOS Firefox) stop when skipping to the next track.
      //so just do things using our 'loading' state for now.
      //we should check again for this in a few months.
    }
  }, [currentSource]);

  useEffect(()=>{
    if (controls.playing){
      setMediaBuffering(false);
    }
  },[controls.playing])

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
          skipCurrentTrack();
        },
        previousSource() {
          previousSource();
        },
        nextSource() {
          nextSource();
        },
        getReactPlayer(){
          return reactPlayerRef.current;
        },
        rewindMedia(){
          rewindMedia();
        }
       }),
   )

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

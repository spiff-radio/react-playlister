import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle  } from "react";
import ReactPlayer from 'react-player';

//get value in array using a needle
const getValueWithNeedle = (array,indices) => {
  indices = !Array.isArray(indices) ? [indices] : indices;

  const children = array[indices[0]];
  if (children === undefined) return;

  if(indices.length > 1){
    return getValueWithNeedle(children,indices.slice(1));
  }else{
    return children;
  }
}

//build a one-level array of "needles" based on an multidimensional input array
const buildNeedles = (array) => {

  const buildIterableNeedles = (array) => {
    return array.flatMap(
      (v, i) => Array.isArray(v) ? buildIterableNeedles(v).map(a => [i, ...a]) : [[i]]
    );
  }

  const iterableNeedles = buildIterableNeedles(array);

  //replace the needles depending of the original value being (or not) an array;
  return iterableNeedles.map(function(indices) {
    const firstKey = indices[0];
    const initialValue = array[firstKey];
    return Array.isArray(initialValue) ? indices : firstKey;
  });

}

export const ReactPlaylister = forwardRef((props, ref) => {

  const reactPlayerRef = useRef();

  //const [flatUrls,setFlatUrls] = useState();//flattened array of urls
  //const [urlMap,setUrlMap] = useState();//"needles" for flatUrls
  const [playlist,setPlaylist] = useState({
    tracks:[],
    track_index:undefined,
    next_tracks:[],
    previous_tracks:[]
  });//our (transformed) datas
  const [track,setTrack] = useState([]);//current array of URLs
  const [url, setUrl] = useState();//current url

  const [trackIndex, setTrackIndex] = useState(props.index);
  const [urlIndex, setUrlIndex] = useState(0);

  const [hasPreviousTrack,setHasPreviousTrack] = useState(true);//can we play the previous track ?
  const [hasNextTrack,setHasNextTrack] = useState(true);//can we play the next track ?
  const [backwards,setBackwards] = useState(false);//do we iterate URLs backwards ?
  const autoskip = (props.autoskip !== undefined) ? props.autoskip : true; //when a URL does not play, skip to next one ?

  const getPlayableQueueIndexes = (index,loop,backwards) => {

    let playableTracksQueue = [];

    //build a queue of keys based on an array
    //If index is NOT defined, it will return the full array.
    const getTracksQueue = (tracks,index,loop,backwards) => {
      let previousTracks = [];
      let nextTracks = [];
      let tracksQueue = [];

      if (index !== undefined){
        var nextIndex = index+1;

        if (nextIndex < tracks.length){
          nextTracks = tracks.slice(nextIndex);
        }

        if (index > 0){
          previousTracks = tracks.slice(0,index);
        }

      }else{
        nextTracks = tracks;
      }

      if (loop){
        nextTracks = previousTracks = nextTracks.concat(previousTracks);
      }

      if (backwards === true){
        tracksQueue = previousTracks.reverse();
      }else{
        tracksQueue = nextTracks;
      }

      return tracksQueue;
    }

    if (playlist.tracks){
      const tracksQueue = getTracksQueue(playlist.tracks,index,loop,backwards);

      playableTracksQueue = tracksQueue.filter(function (track) {
        return hasPlayableSources(track);
      });

      /*
      console.log("PLAYABLE QUEUE FOR #"+index,playableTracksQueue,{
        'playlist':playlist,
        'index':index,
        'loop':loop,
        'backwards':backwards
      });
      */
    }

    return playableTracksQueue;
  }

  const getNextPlayableIndex = (index,loop,backwards) => {

    if (playlist.tracks){
      const queue = getPlayableQueueIndexes(trackIndex,loop,backwards);
      const firstTrack = queue[0];
      const newIndex = playlist.tracks.indexOf(firstTrack);

      return (newIndex !== -1) ? newIndex : undefined;
    }


  }

  const hasPlayableSources = track => {
      let playableItems = track.sources.filter(source => source.playable);
      return (playableItems.length > 0);
  }

  const handleReady = () => {
    setBackwards(false);//if we were skipping backwards, resets it.
    if (typeof props.onReady === 'function') {
      props.onReady();
    }
  }

  const handleError = (e) => {
    alert("ERROR");
    //URGENT FIX SET PLAYABLE = FALSE
    if (typeof props.onError === 'function') {
      props.onError(e);
    }

    //skip automatically if the player is playing
    if (props.playing && props.autoskip){
      const newIndex = getNextPlayableIndex(trackIndex,props.loop,backwards);
      if (newIndex !== undefined){
        setTrackIndex(newIndex);
      }
    }

  }

  //build our initial data
  useEffect(() => {

    const makeTrack = urls => {

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
        source_index:0
      }

      track.playable = hasPlayableSources(track);

      return track;

    }

    const tracks = props.urls.map(
      (v, i) => {
        return makeTrack(v)
      }
    );

    const newPlaylist = {
      ...playlist,
      track_index:0,
      tracks:tracks
    }

    setPlaylist(newPlaylist);

  }, [props.urls]);

  //warn parent that data has been updated
  useEffect(() => {

    if (typeof props.onUpdated === 'function') {
      props.onUpdated(playlist);
    }

  }, [playlist]);

  //update index when prop changes
  useEffect(() => {
    if (props.index !== undefined){
      setTrackIndex(props.index);
    }
  }, [props.index]);

  //if index is not defined; use first entry
  /*
  useEffect(() => {
    if ( !playlist[trackIndex] ){
      const firstIndex = getNextPlayableIndex(undefined);
      setTrackIndex(firstIndex);
    }
  }, [trackIndex]);
  */

  //tell parent index has changed
  useEffect(() => {
    if (typeof props.onIndex === 'function') {
      props.onIndex(trackIndex);
    }
  }, [trackIndex]);

  //updata data depending of the current track index
  useEffect(() => {

    if (!playlist.tracks.length) return;
    if (trackIndex === undefined) return;

    setPlaylist({
      ...playlist,
      track_index:trackIndex
    })

  }, [trackIndex]);

  useEffect(() => {
    if (playlist.track_index === undefined) return;

    const track = playlist.tracks[playlist.track_index];
    const sourceIndex = track.source_index;
    const source = track.sources[sourceIndex];

    console.log("SET TRACK",track,source);

    setUrl(source.url);

  }, [playlist.track_index]);

  //update previous/next controls
  //TOUFIX URGENT NOT WORKING

  useEffect(() => {
    /*
    setPlaylist({
      ...playlist,
      next_tracks:      getPlayableQueueIndexes(playlist.track_index,props.loop,true),
      previous_tracks:  getPlayableQueueIndexes(playlist.track_index,props.loop,false)
    })
    */

  }, [playlist.track_index,props.loop]);


  //methods parent can use
  //https://medium.com/@nugen/react-hooks-calling-child-component-function-from-parent-component-4ea249d00740
  useImperativeHandle(
      ref,
      () => ({
        previousTrack() {
          setBackwards(true);
          const newIndex = getNextPlayableIndex(trackIndex,props.loop,true);
          if (newIndex !== undefined){
            setTrackIndex(newIndex);
          }
        },
        nextTrack() {
          setBackwards(false);
          const newIndex = getNextPlayableIndex(trackIndex,props.loop,false);

          console.log("NEXT INDEX",newIndex);

          if (newIndex !== undefined){
            setTrackIndex(newIndex);
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
      onError={handleError}
      onReady={handleReady}
      />
    </div>
  );
})

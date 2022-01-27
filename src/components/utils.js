import { useState, useCallback,useEffect  } from "react";
import ReactPlayer from 'react-player';
import { default as reactplayerProviders } from 'react-player/lib/players/index.js';
const REACTPLAYER_PROVIDER_KEYS = Object.values(reactplayerProviders).map(provider => {return provider.key});
const DEBUG = (process.env.NODE_ENV !== 'production');
/*
Build Playlist
*/
//build a clean playlist based on an array of URLs
export const buildPlaylist = (trackUrls,sortedProviders,disabledProviders,ignoreUnsupportedUrls,ignoreDisabledUrls,ignoreEmptyUrls) => {

  trackUrls = [].concat(trackUrls || []);//force array

  sortedProviders = getProvidersOrder(sortedProviders);
  disabledProviders = getDisabledProviders(disabledProviders);
  ignoreUnsupportedUrls = ignoreUnsupportedUrls ?? true;//remove sources that are not supported by React Player
  ignoreDisabledUrls = ignoreDisabledUrls ?? true;//remove sources that have their providers disabled
  ignoreEmptyUrls = ignoreEmptyUrls ?? true; //remove tracks that have no sources

  const buildTrack = (urls,url_index) => {

    //defaults
    let track = {
      index:url_index,
      current:undefined,
      playable:undefined,
      autoplayable:undefined,
      sources:[]
    }

    const buildTrackSources = (index,urls) => {

      const sortSourcesByProvider = (a,b) => {

        if (!sortedProviders.length) return 0;

        let aProviderKey = sortedProviders.indexOf(a.provider?.key);
        aProviderKey = (aProviderKey !== -1) ? aProviderKey : sortedProviders.length; //if key not found, consider at the end

        let bProviderKey = sortedProviders.indexOf(b.provider?.key);
        bProviderKey = (bProviderKey !== -1) ? bProviderKey : sortedProviders.length; //if key not found, consider at the end

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
          autoplayable:undefined,
          url:url,
          error:undefined,
          disabled:provider ? disabledProviders.includes(provider.key) : false,
          provider:provider ? {name:provider.name,key:provider.key} : undefined,
          duration:undefined
        }
      });

      //remove unsupported sources
      if (ignoreUnsupportedUrls){
        sources = sources.filter(source => {
          return source.supported;
        });
      }

      //remove disabled providers sources
      if (ignoreDisabledUrls){
        sources = sources.filter(source => {
          return !source.disabled;
        });
      }

      //sort sources
      if (sortedProviders){
        sources = sources.sort(sortSourcesByProvider);
      }

      return sources
    }

    track.sources = buildTrackSources(url_index,urls);

    //set default source
    const currentSource = getNextSource(track,undefined,true);
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

  let playlist = trackUrls.map(
    (v, i) => {
      return buildTrack(v,i)
    }
  );

  if (ignoreEmptyUrls){
    playlist = playlist.filter(track => {
      return (track.sources.length > 0);
    });
  }

  return playlist;


}

//build media errors based on URLs not supported
export const getUrlNotSupportedErrorsFn = urls => {
  let errors = {};
  const unSupportedUrls = urls.filter(url=>!ReactPlayer.canPlay(url))
  unSupportedUrls.forEach(function(url){
    errors[url] = 'URL not supported';
  });
  return errors;
}

export const getUnsupportedUrls = playlist => {

  const getUnsupportedSources = playlist => {
    const allSources = playlist.map(track => track.sources).flat(Infinity);
    return allSources.filter(source => !source.supported);
  }

  const sources = getUnsupportedSources(playlist);
  return sources.map(source=>source.url)
}


const getProvidersOrder = (keys) => {
  if (!keys) return;
  const frontKeys = keys.filter(x => REACTPLAYER_PROVIDER_KEYS.includes(x));//the keys we want to put in front (remove the ones that does not exists in the original array)
  const backKeys = REACTPLAYER_PROVIDER_KEYS.filter(x => !frontKeys.includes(x));
  return frontKeys.concat(backKeys);
}

const getDisabledProviders = (keys) => {
  keys = keys || [];
  return keys.filter(x => REACTPLAYER_PROVIDER_KEYS.includes(x));//the keys we want to disable (remove the ones that does not exists in the original array)
}

//build a queue of keys based on an array
//If needle is NOT defined, it will return the full array.
//If needle IS defined (and exists); it will return the items following the needle.
const getArrayQueue = (array,needle,loop,reverse) => {

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

  if (reverse === true){
    queue = previousQueue.reverse();
  }else{
    queue = nextQueue;
  }

  return queue;
}

export const getTracksQueue = (playlist,track,skipping,loop,reverse) => {
  let queue = getArrayQueue(playlist,track,loop,reverse);

  if (skipping){
    queue = queue.filter(track => {
      return track.autoplayable;
    });
  }

  /*
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
  */

  return queue;
}

export const getNextTrack = (playlist,track,skipping,loop,reverse) => {
  let queue = getTracksQueue(playlist,track,skipping,loop,reverse);
  return queue[0];
}

export const getSourcesQueue = (track,source,skipping,loop,reverse) => {
  let queue = getArrayQueue(track?.sources,source,loop,reverse);
  if (skipping){
    queue = queue.filter(source => {
      return source.autoplayable;
    });
  }
  return queue;
}

export const getNextSource = (track,source,skipping,loop,reverse) => {
  const queue = getSourcesQueue(track,source,skipping,loop,reverse);
  return queue[0];
}

export const setPlayableItems = (playlist,mediaErrors,filterPlayableFn,filterAutoPlayableFn) => {

  if (!playlist.length) return playlist;
  if (mediaErrors === undefined) throw new Error("setPlayableItems() requires mediaErrors to be defined.");

  let sourceCount = 0;
  let playableSourceCount = 0;
  let trackCount = 0;
  let playableTrackCount = 0;

  playlist = playlist.map((trackItem) => {

    const getUpdatedSources = (track) => {
      return track.sources.map(
        (sourceItem) => {

          const url = sourceItem.url;
          const mediaError = mediaErrors[url];
          const playable = (sourceItem.supported && !mediaError);
          const autoplayable = (playable && !sourceItem.disabled);

          return {
            ...sourceItem,
            playable:playable,
            autoplayable:autoplayable,
            error:mediaError
          }
        }
      )
    }

    trackItem.sources = getUpdatedSources(trackItem);

    const playableSources = trackItem.sources.filter(function(source) {
      return source.playable;
    });

    const autoPlayableSources = trackItem.sources.filter(function(source) {
      return source.autoplayable;
    });

    //is the track playable ?
    trackItem.playable = (playableSources.length > 0);
    trackItem.autoplayable = (autoPlayableSources.length > 0);

    //allow to filter the playable value
    if ( typeof filterPlayableFn === 'function' ) {
      trackItem.playable = filterPlayableFn(trackItem.playable,trackItem);
    }

    //allow to filter the autoplayable value
    if ( typeof filterAutoPlayableFn === 'function' ) {
      trackItem.autoplayable = filterAutoPlayableFn(trackItem.autoplayable,trackItem);
    }

    //for debug
    sourceCount = sourceCount + trackItem.sources.length;
    playableSourceCount = playableSourceCount + playableSources.length;
    trackCount = trackCount + 1;
    playableTrackCount = trackItem.playable ? playableTrackCount + 1 : playableTrackCount;

    return trackItem;
  });
  DEBUG && console.log("REACTPLAYLISTER / SET 'PLAYABLE': "+playableSourceCount+"/"+sourceCount+" SOURCES, "+playableTrackCount+"/"+trackCount+" TRACKS");
  return playlist;
}

//santize indices; and select a default source if it is not set.
export const validateIndices = (input,playlist,skipping)=>{

  if (!playlist) throw new Error("validateIndices() requires a playlist to be defined.");

  const indices = Array.isArray(input) ? input : [input];//force array
  let newIndices = [...indices];

  let trackIndex = newIndices[0];
  let sourceIndex = newIndices[1];

  let track = undefined;
  let source = undefined;

  //get index track
  if (trackIndex !== undefined){
    track = playlist.find(function(track) {
      return ( track.index === trackIndex );
    });
    sourceIndex = !track ? undefined : sourceIndex;
  }else{
    track = getNextTrack(playlist,undefined,skipping);
  }

  if (track){
    //get index source
      if (trackIndex !== undefined){
      source = track.sources.find(function(source) {
        return ( source.index === sourceIndex );
      });
    }

    //get current source
    if (!source){
      source = track?.sources.find(function(source) {
        return source.current;
      });
    }
    //get default source
    if (!source){
      source = getNextSource(track,undefined,skipping);
    }
  }

  trackIndex = track ? track.index : undefined;
  sourceIndex = source ? source.index : undefined;

  newIndices = [trackIndex,sourceIndex].filter(function(x) {
    return x !== undefined;
  });

  if (!newIndices.length){
    //DEBUG && console.log("REACTPLAYLISTER / INVALID INDICES, ABORD");
    return;
  }

  if ( Array.isArray(input) && ( JSON.stringify(newIndices) === JSON.stringify(input) ) ){
    console.log("INDICES NOT UPDATED");
    return input;
  }

  if (indices !== newIndices){
    DEBUG && console.log("REACTPLAYLISTER / INDICES FIXED FROM "+JSON.stringify(input)+" TO "+JSON.stringify(newIndices));
  }

  return newIndices;

}

export function useSanitizedIndices(sanitizeIndicesFn, unsanitizedIndex) {
  const [index, setIndex] = useState(sanitizeIndicesFn(unsanitizedIndex));

  // Like setIndex, but also sanitizes
  const setSanitizedIndices = useCallback(
    (unsanitizedIndex) => setIndex(sanitizeIndicesFn(unsanitizedIndex)),
    [sanitizeIndicesFn, setIndex],
  );

  // Update state if arguments change
  useEffect(
    () => setSanitizedIndices(unsanitizedIndex),
    [setSanitizedIndices, unsanitizedIndex],
  );

  return [index, setSanitizedIndices];
}

export function useBuiltPlaylist(buildPlaylistFn, urls) {
  const [playlist, setPlaylist] = useState(buildPlaylistFn(urls));

  // Like set state, but also generates playlist
  const setBuiltPlaylist = useCallback(
    (urls) => setPlaylist(buildPlaylistFn(urls)),
    [buildPlaylistFn, setPlaylist],
  );

  // Update state if arguments change
  useEffect(
    () => setBuiltPlaylist(urls),
    [JSON.stringify(setBuiltPlaylist), urls],
  );

  return [playlist, setBuiltPlaylist];
}

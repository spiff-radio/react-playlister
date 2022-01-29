import ReactPlayer from 'react-player';
import { default as reactplayerProviders } from 'react-player/lib/players/index.js';
const REACTPLAYER_PROVIDER_KEYS = Object.values(reactplayerProviders).map(provider => {return provider.key});
const DEBUG = (process.env.NODE_ENV !== 'production');

export function getCurrentTrack(playlist){
  return playlist?.find(function(track) {
    return track.current;
  });
}

export function getCurrentTrackSource(track){
  return track?.sources.find(function(source) {
    return source.current;
  });
}

export function getCurrentSource(playlist){
  const track = getCurrentTrack(playlist);
  return getCurrentTrackSource(track);
}

export function getCurrentIndices(playlist){
  const track = getCurrentTrack(playlist);
  const source = getCurrentSource(playlist);
  return [track?.index,source?.index];
}


/*
Build Playlist
*/
//build a clean playlist based on an array of URLs
export function buildPlaylist(trackUrls,sortedProviders,disabledProviders,ignoreUnsupportedUrls,ignoreDisabledUrls,ignoreEmptyUrls){

  trackUrls = [].concat(trackUrls || []);//force array

  sortedProviders = getProvidersOrder(sortedProviders);
  disabledProviders = getDisabledProviders(disabledProviders);
  ignoreUnsupportedUrls = ignoreUnsupportedUrls ?? true;//remove sources that are not supported by React Player
  ignoreDisabledUrls = ignoreDisabledUrls ?? true;//remove sources that have their providers disabled
  ignoreEmptyUrls = ignoreEmptyUrls ?? true; //remove tracks that have no sources

  function buildTrack(urls,url_index){

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
export function getNotSupportedMediaErrors(urls){
  let errors = {};
  const unSupportedUrls = urls.filter(url=>!ReactPlayer.canPlay(url))
  unSupportedUrls.forEach(function(url){
    errors[url] = 'URL not supported';
  });
  return errors;
}

function getProvidersOrder(keys){
  if (!keys) return;
  const frontKeys = keys.filter(x => REACTPLAYER_PROVIDER_KEYS.includes(x));//the keys we want to put in front (remove the ones that does not exists in the original array)
  const backKeys = REACTPLAYER_PROVIDER_KEYS.filter(x => !frontKeys.includes(x));
  return frontKeys.concat(backKeys);
}

function getDisabledProviders(keys){
  keys = keys || [];
  return keys.filter(x => REACTPLAYER_PROVIDER_KEYS.includes(x));//the keys we want to disable (remove the ones that does not exists in the original array)
}

//build a queue of keys based on an array
//If needle is NOT defined, it will return the full array.
//If needle IS defined (and exists); it will return the items following the needle.
function getArrayQueue(array,needle,loop,reverse){

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

export function getTracksQueue(playlist,track,skipping,loop,reverse){
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

function getNextTrack(playlist,track,skipping,loop,reverse){
  let queue = getTracksQueue(playlist,track,skipping,loop,reverse);
  return queue[0];
}

export function getSourcesQueue(track,source,skipping,loop,reverse){
  let queue = getArrayQueue(track?.sources,source,loop,reverse);

  if (skipping){
    queue = queue.filter(source => {
      return source.autoplayable;
    });
  }
  return queue;
}

function getNextSource(track,source,skipping,loop,reverse){
  const queue = getSourcesQueue(track,source,skipping,loop,reverse);
  return queue[0];
}

//Get new indices based on the old track to skip
export function getSkipTrackIndices(playlist,oldTrack,loop,reverse){

  if (!playlist) throw new Error("getSkipTrackIndices() requires playlist to be defined.");

  const track = getNextTrack(playlist,oldTrack,true,loop,reverse);
  const trackIndex = track ? track.index : undefined;
  if (!track) return;

  let newSource = getCurrentTrackSource(track);//get current source if any

  if (!newSource){
    newSource = getNextSource(track,undefined,true);//get first available source
  }

  const newSourceIndex = newSource ? newSource.index : undefined;

  return [trackIndex,newSourceIndex];
}

export function getSkipSourceIndices(track,oldSource,reverse){
  if (!track) throw new Error("getSkipSourceIndices() requires 'track' to be defined.");
  const source = getNextSource(track,oldSource,true,true,reverse);
  return [track.index,source?.index];
}

export function setPlayableItems(playlist,mediaErrors,filterPlayableFn,filterAutoPlayableFn){

  if (!playlist.length) return playlist;
  if (mediaErrors === undefined) throw new Error("setPlayableItems() requires mediaErrors to be defined.");

  let sourceCount = 0;
  let playableSourceCount = 0;
  let trackCount = 0;
  let playableTrackCount = 0;

  let newPlaylist = playlist.map((trackItem) => {

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

  //make sure the playlist has been updated.
  //If not, return current playlist so reference is not updated.
  const playlistUpdated = (JSON.stringify(newPlaylist) !== JSON.stringify(playlist));
  if (!playlistUpdated) return playlist;

  DEBUG && console.log("REACTPLAYLISTER / SET 'PLAYABLE': "+playableSourceCount+"/"+sourceCount+" SOURCES, "+playableTrackCount+"/"+trackCount+" TRACKS");

  return newPlaylist;
}

//Set which are the current track/source.
//We set it directly in the playlist (and we don't just use some indices state) because we want to keep the last selected source as fallback if no source index is defined.
export function setCurrentItems(playlist,indices){

  if (playlist === undefined) throw new Error("setCurrentItems() requires 'playlist' to be defined.");
  if (!playlist.length) return playlist;

  indices = validateIndices(indices,playlist);
  if (indices === undefined) throw new Error("setCurrentItems() requires 'indices' to be defined.");

  let newPlaylist = undefined;
  const trackIndex = indices[0];
  const sourceIndex = indices[1];

  if (trackIndex !== undefined){
    newPlaylist = playlist.map((trackItem) => {

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

  //make sure the playlist has been updated.
  //If not, return current playlist so reference is not updated.
  const playlistUpdated = (JSON.stringify(newPlaylist) !== JSON.stringify(playlist));
  if (!playlistUpdated) return playlist;

  DEBUG && console.log("REACTPLAYLISTER / SET 'CURRENT' PROPERTY TO TRACK#"+indices[0]+" SOURCE#"+indices[1]);

  return newPlaylist;

}

export function getDefaultIndices(playlist,trackIndex){

  if (!playlist) throw new Error("getDefaultIndices() requires 'playlist' to be defined.");

  let indices;

  //validate track index
  const track = playlist.find(function(track) {
    return ( track.index === trackIndex );
  });
  trackIndex = track ? track.index : undefined;

  //fallbacks
  if (trackIndex === undefined){
    indices = getSkipTrackIndices(playlist);
    DEBUG && console.log("INDICES ARE UNDEFINED, SET INDICES TO",indices);
  }else if(track){
    indices = getSkipSourceIndices(track);

    if (indices[1]){
        DEBUG && console.log("SOURCE INDEX IS UNDEFINED, SET INDICES TO",indices);
    }

  }

  return indices;

}

//format indices the right way + ensure that they exists in the playlist
function validateIndices(input,playlist){

  if (!playlist) throw new Error("validateIndices() requires 'playlist' to be defined.");

  const indices = Array.isArray(input) ? input : [input];//force array
  let newIndices = [...indices];

  let trackIndex = newIndices[0];
  let sourceIndex = newIndices[1];

  let track = undefined;
  let source = undefined;

  if (trackIndex !== undefined){
    track = playlist.find(function(track) {
      return ( track.index === trackIndex );
    });
  }

  if (track){
    //get index source
      if (sourceIndex !== undefined){
      source = track.sources.find(function(source) {
        return ( source.index === sourceIndex );
      });
    }
  }

  trackIndex = track ? track.index : undefined;
  sourceIndex = source ? source.index : undefined;

  if ( (trackIndex !== undefined) && (sourceIndex !== undefined) ){
    newIndices = [trackIndex,sourceIndex];
  }else{
    newIndices = getDefaultIndices(playlist,trackIndex);
  }

  if ( JSON.stringify(newIndices) !== JSON.stringify(input) ){
    DEBUG && console.log("REACTPLAYLISTER / INDICES FIXED FROM "+JSON.stringify(input)+" TO "+JSON.stringify(newIndices));
  }

  return newIndices;

}

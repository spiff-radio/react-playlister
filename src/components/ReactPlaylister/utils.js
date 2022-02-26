import ReactPlayer from 'react-player';
import { default as reactplayerProviders } from 'react-player/lib/players/index.js';
const REACTPLAYER_PROVIDER_KEYS = Object.values(reactplayerProviders).map(provider => {return provider.key});
const DEBUG = (process.env.NODE_ENV !== 'production');

export function filterPlayableSource(source){
  return source.playable;
}

export function filterAutoPlayableSource(source){
  return (source.playable && !source.disabled);
}

function filterPlayableTrack(track){
  return (track.sources.filter(filterPlayableSource).length > 0);
}

export function filterAutoPlayableTrack(track){
  //return (track.sources.filter(filterAutoPlayableSource).length > 0);
  return track.autoplayable;
}

//build media errors based on URLs not supported
export function getNotSupportedMediaErrors(urls){
  if (urls === undefined) return;
  let errors = {};
  const unSupportedUrls = urls.filter(url=>!ReactPlayer.canPlay(url))
  unSupportedUrls.forEach(function(url){
    errors[url] = 'URL not supported';
  });
  return errors;
}

export function getProvidersOrder(keys){
  if (!keys) return;
  const frontKeys = keys.filter(x => REACTPLAYER_PROVIDER_KEYS.includes(x));//the keys we want to put in front (remove the ones that does not exists in the original array)
  const backKeys = REACTPLAYER_PROVIDER_KEYS.filter(x => !frontKeys.includes(x));
  return frontKeys.concat(backKeys);
}

export function getDisabledProviders(keys){
  keys = keys || [];
  return keys.filter(x => REACTPLAYER_PROVIDER_KEYS.includes(x));//the keys we want to disable (remove the ones that does not exists in the original array)
}

//build a queue of keys based on an array
//If needle is NOT defined, it will return the full array.
//If needle IS defined (and exists); it will return the items following the needle.
export function getArrayQueue(array,needle,loop,reverse){

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


//make sure indices is an array of two items
export function sanitizeIndices(indices){
  indices = Array.isArray(indices) ? indices : [indices];//force array
  return indices;
}

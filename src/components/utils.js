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
          url:url,
          error:undefined,
          disabled:provider ? disabledProviders.includes(provider.key) : undefined,
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

//converts an indices string into an array
export const indicesFromString = (indicesString) => {
  let arr =  (indicesString !== undefined) ? indicesString.split(":") : [];
  arr = arr.filter(e =>  e); //remove empty values
  arr = arr.map(e =>  parseInt(e)); //convert to integers
  return arr;
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

const autoskipTrackFilter = track =>{
  return track.playable;
}

export const getTracksQueue = (playlist,track,autoskip,loop,backwards) => {
  let queue = getArrayQueue(playlist,track,loop,backwards);

  if (autoskip){
    queue = queue.filter(autoskipTrackFilter);
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

export const getNextTrack = (playlist,track,autoskip,loop,backwards) => {
  let queue = getTracksQueue(playlist,track,autoskip,loop,backwards);
  return queue[0];
}

export const autoskipSourceFilter = source =>{
  return (source.playable && !source.disabled);
}

export const getSourcesQueue = (track,source,autoskip,loop,backwards) => {
  let queue = getArrayQueue(track?.sources,source,loop,backwards);
  if (autoskip){
    queue = queue.filter(autoskipSourceFilter);
  }
  return queue;
}

export const getNextSource = (track,source,autoskip,loop,backwards) => {
  const queue = getSourcesQueue(track,source,autoskip,loop,backwards);
  return queue[0];
}

export const updatePlaylistPlayable = (playlist,mediaErrors,filterPlayableFn) => {

  if (!playlist.length) return playlist;
  if (mediaErrors === undefined) throw new Error("updatePlaylistPlayable() requires mediaErrors to be defined.");

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
    //allow to filter the playable value
    if ( typeof filterPlayableFn === 'function' ) {
      trackItem.playable = filterPlayableFn(trackItem.playable,trackItem);
    }

    return trackItem;
  });
  DEBUG && console.log("REACTPLAYLISTER / SET 'PLAYABLE' PROPERTIES",playlist);
  return playlist;
}

export const updatePlaylistCurrent = (playlist,indices) => {

  if (!playlist.length) return playlist;
  if (indices === undefined) throw new Error("updatePlaylistCurrent() requires indices to be defined.");

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

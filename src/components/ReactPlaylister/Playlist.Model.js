import Track from './Track.Model';
import {DEBUG} from "./Constants";

import {
  getArrayQueue,
  filterAutoPlayableTrack,
  filterPlayableSource,
  filterAutoPlayableSource,
  sanitizeIndices
} from './utils.js';

export default class Playlist{
  constructor(urls){
    this.tracks = this.buildTracks(urls);
  }

  buildTracks(urls){

    urls = [].concat(urls || []);//force array

    return urls.map(
      (v, i) => {
        const track = new Track(i,v);
        track.index = i;
        return track;
      }
    );

  }

  //get current track
  get track(){
    return (this.tracks || []).find(function(track) {
      return track.current;
    });
  }

  //Set which are the current track/source.
  //We set it directly in the playlist (and we don't just use some indices state) because we want to keep the last selected source as fallback if no source index is defined.
  set trackIndices(indices){

    indices = this.validateIndices(indices);
    if (indices === undefined) return;

    const trackIndex = indices[0];
    const sourceIndex = indices[1];

    if (trackIndex !== undefined){
      this.tracks.forEach(function(track){
        track.current = (track.index === trackIndex);
        if (track.current){
          track.sourceIndex = sourceIndex;
        }
      });
    }
    DEBUG && console.log("REACTPLAYLISTER / SET 'CURRENT' PROPERTY TO TRACK#"+indices[0]+" SOURCE#"+indices[1]);
  }

  getTracksQueue(track,loop,reverse){
    let queue = getArrayQueue(this.tracks,track,loop,reverse);

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

  getAutoplayableTracksQueue(track,loop,reverse){
    let queue = this.getTracksQueue(track,loop,reverse);
    return queue.filter(filterAutoPlayableTrack);
  }


  //Get new indices based on the old track to skip
  getSkipTrackIndices(oldTrack,loop,reverse){

    //get next autoplayable track
    const track = this.getAutoplayableTracksQueue(oldTrack,loop,reverse)[0];
    const trackIndex = track ? track.index : undefined;
    if (!track) return;

    let newSource = track.source;

    if (!newSource){
      newSource = track.getNextSource(undefined,true);//get first available source
    }

    const newSourceIndex = newSource ? newSource.index : undefined;

    return [trackIndex,newSourceIndex];
  }


  updatePlayableTracks(mediaErrors,filterPlayableFn,filterAutoPlayableFn){
    const playlist = this;
    let sourceCount = 0;
    let playableSourceCount = 0;
    let trackCount = 0;
    let playableTrackCount = 0;

    playlist.tracks.forEach(function(track){

      track.updatePlayableSources(mediaErrors);

      const playableSources = track.sources.filter(filterPlayableSource);

      const autoPlayableSources = track.sources.filter(filterAutoPlayableSource);

      //is the track playable ?
      track.playable = (playableSources.length > 0);
      if ( typeof filterPlayableFn === 'function' ) {//allow to filter the playable value
        track.playable = filterPlayableFn(track.playable,track);
      }

      //is the track autoplayable ?
      track.autoplayable = (autoPlayableSources.length > 0);
      if ( typeof filterAutoPlayableFn === 'function' ) {//allow to filter the autoplayable value
        track.autoplayable = filterAutoPlayableFn(track.autoplayable,track);
      }

      //for debug
      sourceCount = sourceCount + track.sources.length;
      playableSourceCount = playableSourceCount + playableSources.length;
      trackCount = trackCount + 1;
      playableTrackCount = track.playable ? playableTrackCount + 1 : playableTrackCount;

    })

    DEBUG && console.log("REACTPLAYLISTER / SET 'PLAYABLE': "+playableSourceCount+"/"+sourceCount+" SOURCES, "+playableTrackCount+"/"+trackCount+" TRACKS");

  }

  //format indices the right way + ensure that they exists in the playlist
  validateIndices(indices){

    let newIndices = sanitizeIndices(indices);

    let trackIndex = newIndices[0];
    let sourceIndex = newIndices[1];

    let track = undefined;
    let source = undefined;

    if (trackIndex !== undefined){
      track = this.tracks?.find(function(track) {
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

    if ( ( trackIndex === undefined ) || ( sourceIndex === undefined ) ){
      newIndices = this.getDefaultIndices(trackIndex,sourceIndex);
    }

    if ( JSON.stringify(newIndices) === JSON.stringify(indices) ){
      return indices;
    }

    DEBUG && console.log("REACTPLAYLISTER / INDICES VALIDATED FROM "+JSON.stringify(indices)+" TO "+JSON.stringify(newIndices));

    return newIndices;

  }


  getDefaultIndices(trackIndex,sourceIndex){

    let indices;
    let track;
    let source;

    //make sure track exists
    if (trackIndex !== undefined){
      track = this.tracks.find(function(track) {
        return ( track.index === trackIndex );
      });
    }
    trackIndex = track ? track.index : undefined;

    //make sure source exists
    if ( track && (sourceIndex !== undefined) ){
      source = track.sources.find(function(source) {
        return ( source.index === trackIndex );
      });
    }
    sourceIndex = source ? source.index : undefined;

    if (trackIndex === undefined){//indices are undefined
      indices = this.getSkipTrackIndices();
      DEBUG && console.log("INDICES ARE UNDEFINED; SET INDICES TO",indices);
    }else if ( sourceIndex === undefined ){//source indice is undefined
      indices = track.getSkipSourceIndices();
      if (indices === undefined){//no source was found; there is nothing playable here; but still, the user did specify this track.
        source = track.getNextSource();
        indices = [trackIndex,source?.index];
      }
    }

    return indices;

  }

}

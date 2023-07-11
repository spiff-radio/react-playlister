import Source from './Source.Model';
import {DEBUG} from "./Constants";

import {
  getArrayQueue,
  filterAutoPlayableSource
} from './utils.js';


export default class Track{
  constructor(index,urls){
    this.index = index;
    this.current = undefined;
    this.playable = undefined;
    this.sources = undefined;
    this.sortedProviders = undefined;
    this.disabledProviders = undefined;
    this.sources = this.buildSources(urls);
    this.sourceIndex = this.getNextSource(undefined,true)?.index; //set default source
  }

  buildSources(urls){

    const track = this;

    urls = [].concat(urls || []);//force array (it might be a single URL string)
    urls = urls.flat(Infinity);//flatten

    return urls.map(function(url,i) {
      return new Source(track.index,i,url);
    });

  }

  getNextSource(source,skipping,loop,reverse){
    const queue = this.getSourcesQueue(source,skipping,loop,reverse);
    return queue[0];
  }

  getSourcesQueue(source,skipping,loop,reverse){
    let queue = getArrayQueue(this.sources,source,loop,reverse);

    if (skipping){
      queue = queue.filter(filterAutoPlayableSource);
    }

    return queue;
  }

  getSkipSourceIndices(oldSource,reverse){
    const source = this.getNextSource(oldSource,true,true,reverse);
    if (!source) return;
    return [this.index,source.index];
  }

  updatePlayableSources(mediaErrors){

    this.sources.forEach(function(source){
      const url = source.url;
      source.error = mediaErrors[url];
    })

  }

  //update the 'current' property of the track sources
  set sourceIndex(index){
    if (index === undefined) return;
    this.sources.forEach(function(source){
      source.current = (source.index === index);
    })
  }

  //get current source
  get source(){
    return this.sources.find(function(source) {
      return source.current;
    });
  }


}

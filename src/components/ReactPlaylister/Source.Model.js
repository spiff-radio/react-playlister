import ReactPlayer from 'react-player';
import { default as reactplayerProviders } from 'react-player/lib/players/index.js';
import {DEBUG} from "./Constants";

export default class Source{
  constructor(trackindex,index,url){

    this.index=         index;
    this.trackIndex=    trackindex;
    this.url=           url;
    this.provider=      this.getProvider(url);
    this.current=       false;
    this.supported=     ReactPlayer.canPlay(url);
    this.playable=      undefined;
    this.autoplayable=  undefined;
    this.error=         undefined;
    this.disabled=      false;
    this.duration=      undefined;
  }

  getProvider(url){
    const provider = reactplayerProviders.find(provider => {
      return provider.canPlay(url);
    });
    if (!provider) return;
    return {name:provider.name,key:provider.key}
  }
}

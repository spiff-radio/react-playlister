**ReactPlaylister** is a React component wrapper to build a playlist on top of the [React Player](https://github.com/cookpete/react-player) component.

### Demo

A demo is available [here](http://spiff-radio.org/react-playlister).

### Props

Prop | Description | Default
---- | ----------- | -------
`urls` | An array of tracks. A track can be a single URL or an array of URLs, which could be useful if you want to offer streams to differents services; or if some URLs are not playable (geoblocked, ...).
`index` | Load a specific item when component is initialized.<br/>&nbsp; ◦ &nbsp;Track: index of the selected track (starting at 0), eg. `1` (or `[1]`)<br/>&nbsp; ◦ &nbsp;Source: array of track index + source index (starting at 0) eg. `[0,2]`
`loop` | Set to `true` or `false` to loop the playlist. | `false`
`autoskip` | Ignore unplayable items when traversing the playlist; and automatically skip to the next item if it fires an error while trying to play it. | `true`
`shuffle` | Set to `true` or `false` to enable shuffle mode. **(not yet implemented)** | `false`
`disabledProviders` | URLs from those providers won't play unless they are specifically requested.  It should be an array of [providers keys](//https://github.com/cookpete/react-player/blob/master/src/players/index.js
). | `[]`
`sortProviders` | Sort the URLs based on an array of [providers keys](//https://github.com/cookpete/react-player/blob/master/src/players/index.js
). | `['file']`


You can also set [the props for ReactPlayer](https://github.com/cookpete/react-player/blob/master/README.md#props).

#### Callback props

Callback props take a function that gets fired on various events:

Prop | Description
---- | -----------
`onPlaylistUpdated` | Called when the playlist data has been updated.
`onControlsUpdated` | Called when the playlist controls have been updated.
`filterPlayableTrack` | *You probably don't need this; use it only if you're sure of what you're doing!*<br/> Allows you to filter the *playable* property of a track.

##### Example of a function used with *filterPlayableTrack*

```js
const handleFilterPlayableTrack = (track,trackIndex,playable) => {
  //alter the playable value here if needed
  return playable;
}
```

You can also set [the callback props for ReactPlayer](https://github.com/cookpete/react-player/blob/master/README.md#callback-props).

### Methods

#### Instance Methods
Use [`ref`](https://facebook.github.io/react/docs/refs-and-the-dom.html) to call instance methods on the player. See the demo app for an example of this.

Method | Description
------ | -----------
`previousTrack()` | Go to the previous track (*playable track* if `autoskip` is set to `true`).
`nextTrack()` | Go to the next track / (*playable track* if `autoskip` is set to `true`).
`skipTrack()` | Go to the previous or next track (*playable track* if `autoskip` is set to `true`); depending on the current playing direction.
`previousSource()` | Go to the previous track source - or previous playable track source if `autoskip` is set to `true`.
`nextSource()` | Go to the next track source - or next playable track source if `autoskip` is set to `true`.
`getReactPlayer()` | Returns the `ReactPlayer` component instance.

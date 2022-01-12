**ReactPlaylister** is a React component wrapper to build a playlist on top of the [React Player](https://github.com/cookpete/react-player) component.

### Demo

A demo is available [here](https://spiff-radio.org/react-playlister).

### Props

Prop | Description | Default
---- | ----------- | -------
`urls` | An array of tracks. A track can be a single URL or an array of URLs, which could be useful if you want to offer streams to differents services; or if some URLs are not playable (geoblocked, ...). | `undefined`
`index` | Load a specific item when component is initialized.<br/>&nbsp; ◦ &nbsp;Track: index of the selected track (starting at 0), eg. `1` (or `[1]`)<br/>&nbsp; ◦ &nbsp;Source: array of track index + source index (starting at 0) eg. `[0,2]` | `undefined`
`loop` | Set to `true` or `false` to loop the playlist. | `false`
`shuffle` | Set to `true` or `false` to enable shuffle mode. **(not yet implemented)** | `false`
`autoskip` | Ignore unplayable items when traversing the playlist; and automatically skip to the next item if it fires an error while trying to play it. | `true`
`skipError` | should we skip when a media error is fired ? | `true`
`skipEnded` | should we skip when a media ends ? | `true`
`disabledProviders` | URLs from those providers won't play unless they are specifically requested.  It should be an array of [providers keys](https://github.com/cookpete/react-player/blob/master/src/players/index.js | `undefined`
`sortProviders` | Sort the URLs based on an array of [providers keys](https://github.com/cookpete/react-player/blob/master/src/players/index.js | `['file']`

You can also set [the props for ReactPlayer](https://github.com/cookpete/react-player/blob/master/README.md#props).

#### Callback props

Callback props take a function that gets fired on various events:

Prop | Description
---- | -----------
`onSourceEnded` | Called a source has finished playing.
`onPlaylistEnded` | Called when the last track of the playlist has finished playing.
`onPlaylistUpdated` | Called when the playlist data has been updated.
`onControlsUpdated` | Called when the playlist controls have been updated.
`filterPlayableTrack` | Allows you to filter the default *playable* property of a track.  See explanations below.
`filterSkipUnsourcedTrack` | Allows you to filter the *skip* value when a requested track does not have sources.  See explanations below.

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

#### About *filterPlayableTrack* and *filterSkipUnsourcedTrack* methods

The *filterPlayableTrack* and *filterSkipUnsourcedTrack* methods are useful in a very specific case:

Let's say you have a track without sources (URLs), and that you're able (eg. using an API call) to query its sources **when** that track is selected.

1/ Consider that your track *is* playable even if it has no sources yet using the *filterPlayableTrack* method :

```js
const handleFilterPlayableTrack = (playable,track) => {
  const didSourcesQuery = ...
  return didSourcesQuery ? playable : true;
}

filterPlayableTrack={handleFilterPlayableTrack}
```

2/ Block skipping using the *filterSkipUnsourcedTrack* method.  You'll then need your own mechanism to update the ReactPlaylister urls prop.

```js
const handleFilterSkipUnsourcedTrack = (skip,track) => {
  const didSourcesQuery = ...
  return didSourcesQuery ? skip : false;
}

filterSkipUnsourcedTrack={handleFilterSkipUnsourcedTrack}
```

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
`disabledProviders` | URLs from those providers won't play unless they are specifically requested.  It should be an array of [providers keys](https://github.com/cookpete/react-player/blob/master/src/players/index.js | `undefined`
`sortedProviders` | Sort the URLs based on an array of [providers keys](https://github.com/cookpete/react-player/blob/master/src/players/index.js | `['file']`
`ignoreUnsupportedUrls` | Remove URLs that are not supported by [React Player](https://github.com/cookpete/react-player) | `true`
`ignoreDisabledUrls` | Remove URLs that matches a disabled provider | `true`
`ignoreEmptyUrls` | Remove empty sets of URLs (some URLs be removed because `ignoreUnsupportedUrls` and/or `ignoreDisabledUrls` is set to `true`) | `true`



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
`filterSkipUnplayableTrack` | Allows you to filter the *skip* value when a requested track is going to be skipped.  See explanations below.

You can also set [the callback props for ReactPlayer](https://github.com/cookpete/react-player/blob/master/README.md#callback-props).

### Methods

#### Instance Methods
Use [`ref`](https://facebook.github.io/react/docs/refs-and-the-dom.html) to call instance methods on the player. See the demo app for an example of this.

Method | Description
------ | -----------
`previousTrack()` | Go to the previous playable track.
`nextTrack()` | Go to the next playable track.
`skipTrack()` | Go to the previous or next playable track; depending on the current playing direction.
`previousSource()` | Go to the previous playable track source.
`nextSource()` | Go to the next playable track source.
`getReactPlayer()` | Returns the `ReactPlayer` component instance.

#### About *filterPlayableTrack* and *filterSkipUnplayableTrack* methods

The *filterPlayableTrack* and *filterSkipUnplayableTrack* methods are useful in a very specific case:

Let's say you have a track that does not have playable sources (URLs); and that you're able (eg. using an API call) to query some **when** that track is selected.

1/ Consider that your track *is* playable even if it has no sources yet using the *filterPlayableTrack* method :

```js
const handleFilterPlayableTrack = (playable,track) => {
  const didSourcesQuery = ...
  return didSourcesQuery ? playable : true;
}

filterPlayableTrack={handleFilterPlayableTrack}
```

2/ Block track being skipped using the *filterSkipUnplayableTrack* method.  You'll then need your own mechanism to update the ReactPlaylister urls prop.

```js
const handleFilterSkipUnsourcedTrack = (skip,track) => {
  const didSourcesQuery = ...
  return didSourcesQuery ? skip : false;
}

filterSkipUnplayableTrack={handleFilterSkipUnsourcedTrack}
```

3/ Enable tracks that have no sources

```js
ignoreEmptyUrls={false}
```

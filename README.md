**ReactPlaylister** is a React component wrapper to build a playlist on top of the [React Player](https://github.com/cookpete/react-player) component.

### Demo

A demo [here](http://spiff-radio.org/react-playlister).

### Props

Prop | Description | Default
---- | ----------- | -------
`urls` | An array of tracks. A track can be a single URL or an array of URLs, which could be useful if you want to offer streams to differents services; or if some URLs are not playable (geoblocked, ...)
`index` | Load a specific track (and, optionally, source)<br/>&nbsp; ◦ &nbsp;Track: index of the selected track (starting at 0), eg. `1` (or `[1]`)<br/>&nbsp; ◦ &nbsp;Source: array of track index + source index (starting at 0) eg. `[0,2]`
`loop` | Set to `true` or `false` to loop the playlist | `false`
`autoskip` | Ignore unplayable tracks and sources when traversing the playlist; and automatically skip to the next item if it fires an error while trying to play it. | `true`
`shuffle` | Set to `true` or `false` to enable shuffle mode **not yet implemented** | `false`

You can also set [the props for ReactPlayer](https://github.com/cookpete/react-player/blob/master/README.md#props).

#### Callback props

Callback props take a function that gets fired on various events:

Prop | Description
---- | -----------
`onPlaylistUpdated` | Called when the playlist data has been updated
`onControlsUpdated` | Called when the playlist controls have been updated
`onPlaylistEnded` | Called when the last playable track of the playlist has ended.

You can also set [the callback props for ReactPlayer](https://github.com/cookpete/react-player/blob/master/README.md#callback-props).

### Methods

#### Instance Methods
Use [`ref`](https://facebook.github.io/react/docs/refs-and-the-dom.html) to call instance methods on the player. See the demo app for an example of this.

Method | Description
------ | -----------
`previousTrack()` | Go to the previous track - or previous playable track if `autoskip` is set to `true`
`nextTrack()` | Go to the next track - or next playable track if `autoskip` is set to `true`
`previousSource()` | Go to the previous track source - or previous playable track source if `autoskip` is set to `true`
`nextSource()` | Go to the next track source - or next playable track source if `autoskip` is set to `true`
`getCurrentUrl()` | Returns the current source URL
`getReactPlayer()` | Returns the `ReactPlayer` component instance

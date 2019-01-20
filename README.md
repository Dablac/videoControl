# videoControl
### Universal keyboard and mouse video element controller.
Designed for use in Google Chrome through a script manager such as TamperMonkey. Some features may not work correctly in other browsers or environments.

## Features

####Time Saving
Continuously stores current playback time for the URL under which the video is loaded. As long as a value is stored, if the current time is lower (such as if the page is reloaded and starts from 0) the video will automatically jump to the saved time. Importantly, it also interprets intentionally moving backward through the video and 
..* Relies on "GM" functions from a script manager to get around Cross-Origin Resource Sharing (CORS) and <iframe> sandboxing to allow values to be stored. Non-sandboxed videos may still sucessfully store progress without GM functions.

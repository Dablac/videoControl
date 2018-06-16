const aGetTarget = async (target, selector, r) => await new Promise((p,f)=>requestAnimationFrame(()=>(!r?f:p)(r))).catch(r=>aGetTarget(target, selector, target.querySelector(selector)));
const aGet = selector => aGetTarget(document, selector, document.querySelector(selector));

const profile = {
    default:{
        key:{
            'LMB': ['playpause', null],
            'RMB': ['skip', 'small'],
            'MMB': ['skip', 'big'],
            'WheelUp': ['skip', 'tiny'],
            'WheelDown': ['skip', 'tiny', true],
            'ArrowUp': ['skip', 'big', true],
            'ArrowRight': ['skip', 'small', true],
            'ArrowLeft': ['skip', 'small'],
            'ArrowDown': ['skip', 'big'],
            ' ': ['playpause', null]
        },
        ignore: '[class*="vjs"], button, [class*="jwplayer"]',
        getControl: video => new Promise(gotControl=>gotControl(video)),
    },
    'www.netflix.com':{
        key:{
            'LMB': ['playpause', null],
            'RMB': ['skip', 'small'],
            'MMB': ['skip', 'big'],
            'WheelUp': ['skip', 'tiny'],
            'WheelDown': ['skip', 'tiny', true],
            'ArrowUp': ['skip', 'big', true],
            'ArrowRight': null,
            'ArrowLeft': null,
            'ArrowDown': ['skip', 'big'],
            ' ': ['playpause', null]
        },
        ignore: '[class^="playerControls]',
        getControl: () => new Promise(gotPlayerInstance=>new Promise(gotVideoPlayer=>gotVideoPlayer(netflix.appContext.state.playerApp.getAPI().videoPlayer)).then(player=>gotPlayerInstance(player.getVideoPlayerBySessionId(player.getAllPlayerSessionIds()[0])))),
    }
};

function netflixControl(_controllerOptions){
    this.getcontrol = () => new Promise(gotPlayerInstance=>new Promise(gotVideoPlayer=>gotVideoPlayer(netflix.appContext.state.playerApp.getAPI().videoPlayer)).then(player=>gotPlayerInstance(player.getVideoPlayerBySessionId(player.getAllPlayerSessionIds()[0]))));
    this.time = {
        _unit: 'ms',
        units: {ms: 1000, s:1, m:(1/60)},
        sizes: {big:60, small:10, tiny:5},
    };
    Object.defineProperty(this.time, 'unit', {set: input =>{this.time._unit = input}});
    Object.keys(this.time.sizes).forEach(size=>Object.defineProperty(this.time, size, {get: () => this.time.units[this.time._unit]*this.time.sizes[size]}));
    this.skip = (offset, forward) => this.video.currentTime*this.time.units[this.time._unit]+((2*!!forward-1)*this.time[offset]);
    this.options = {
        event:{
            map: {mousedown: ['LMB', 'MMB', 'RMB'], wheel: ['WheelUp','WheelDown']},
            types: ['keydown', 'mousedown', 'wheel'],
            converter: {
                keydown: event=>event.key,
                mousedown: event=>this.options.event.map[event.type][event.button],
                wheel: event=>this.options.event.map[event.type][(1+Math.sign(event.deltaY))/2],
            },
        },
        action: {seek:null, play:null, pause:null, volume:null, muted:null, getCurrentTime:null},
        propAction: (target, propName) => value => {target[propName] = value},
        setAction: (video, control, actionName) => new Promise(gotTarget=>gotTarget([video, control].find(target=>actionName in target))).then(target=>{this.options.action[actionName] = typeof target[actionName] === 'function' ? target[actionName].bind(target) : this.options.propAction(target, actionName);}),
    };
    this.controllerHandler = event => new Promise(gotKey=>new Promise(gotPressed=>gotPressed(this.options.event.converter[event.type](event))).then(pressed=>gotKey([pressed, ...this.options.key[pressed]]))).then(([pressed, action, ...args])=>{if (this.options.valid.includes(pressed)) this.options.action[action](...args);});
    this.createController = (forwardedEvent, video, control, options) => {
        Object.keys(this.options.action).forEach(actionName=>this.options.setAction(video, control, actionName));
        this.options.action.skip = (...args) => this.options.action.seek(this.skip(...args));
        this.options.action.playpause = () => video.paused ? this.options.action.play() : this.options.action.pause();
        this.options.event.types.forEach(type=>document.addEventListener(type, this.controllerHandler, false));
    };
    this.run = event => aGet('video').then(video=>{
        Object.entries(profile.default).forEach(([option, value])=>{this.options[option] = (typeof profile[document.domain] === 'object' ? profile[document.domain][option] : value)});
        this.options.valid = Object.keys(this.options.key);
        this.video = video;
        this.options.getControl(this.video).then(control=>{
            this.control = control;
            this.createController(!event ? null : event, this.video, this.control);
        });
    });
    this.run();
};

console.info('new %O', new netflixControl());

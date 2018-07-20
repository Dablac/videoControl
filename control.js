const aGet = async (selector, target = document, r = target.querySelector(selector)) => await new Promise((p,f)=>requestAnimationFrame(()=>(!r?f:p)(r))).catch(r=>aGet(selector, target, target.querySelector(selector)));

const profile = {
    player:{
        'www.netflix.com': 'netflix',
        'www.rapidvideo.com': 'videojs',
        'streamango.com': 'videojs',
        'openload.co': 'videojs',
        'oload.download': 'videojs',
    },
    default:{
        unit:'s',
        key:{
            'LMB': ['playpause', null],
            'RMB': ['skip', 'small'],
            'MMB': ['skip', 'big'],
            'WheelUp': ['skip', 'tiny', true],
            'WheelDown': ['skip', 'tiny'],
            'ArrowUp': ['skip', 'big', true],
            'ArrowRight': ['skip', 'small', true],
            'ArrowLeft': ['skip', 'small'],
            'ArrowDown': ['skip', 'big'],
            ' ': ['playpause', null]
        },
        saveTime: true,
        ignore: 'button, [class*="jw-controls"]',
        getControl: video => new Promise(gotControl=>gotControl(video)),
        postAction:[{action: 'volume', args: [1.0]}, {action: 'muted', args: [false]}]
    },
    videojs:{
        key:{
            'ArrowRight': ['skip', 'tiny', true],
            'ArrowLeft': ['skip', 'tiny'],
            ' ': null,
            'LMB': null,
        },
        ignore: '.vjs-control',
    },
    netflix:{
        unit:'ms',
        key:{
            'ArrowRight': null,
            'ArrowLeft': null,
            ' ': null
        },
        saveTime: false,
        ignore: '.bottom-controls, top-left-controls',
        getControl: () => new Promise(gotPlayerInstance=>new Promise(gotVideoPlayer=>gotVideoPlayer(netflix.appContext.state.playerApp.getAPI().videoPlayer)).then(player=>gotPlayerInstance(player.getVideoPlayerBySessionId(player.getAllPlayerSessionIds()[0])))),
    }
};

function kbControl(_controllerOptions){
    this.time = {
        _unit: 'ms',
        units: {ms: 1000, s:1, m:(1/60)},
        sizes: {big:60, small:10, tiny:5},
    };
    Object.defineProperty(this.time, 'unit', {set: input =>{this.time._unit = input}});
    Object.keys(this.time.sizes).forEach(size=>Object.defineProperty(this.time, size, {get: () => this.time.units[this.time._unit]*this.time.sizes[size]}));
    this.skip = (offset, forward) => (!this.options.action.getCurrentTime.name ? this.video.currentTime*this.time.units[this.time._unit] : this.options.action.getCurrentTime())+((2*!!forward-1)*this.time[offset]);
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
        action: {seek:null, play:null, pause:null, volume:null, muted:null, getCurrentTime:null, currentTime:null},
        propAction: (target, propName) => value => target[propName] = value,
        setAction: (video, control, actionName) => new Promise(gotTarget=>gotTarget([video, control].find(target=>actionName in target))).then(target=>{this.options.action[actionName] = !!target && typeof target[actionName] === 'function' ? target[actionName].bind(target) : this.options.propAction(target, actionName);}),
    };
    this.setPseudo = (video, control) =>{
        this.options.action.set = (value) => (!this.options.action.seek.name ? this.options.action.currentTime : this.options.action.seek)(value*this.time.units[this.time._unit]);
        this.options.action.skip = (...args) => (!this.options.action.seek.name ? this.options.action.currentTime : this.options.action.seek)(this.skip(...args));
        this.options.action.playpause = () => video.paused ? this.options.action.play() : this.options.action.pause();
    };
    this.controllerHandler = event => {if (!document.contains(this.video)) this.run(event); else if (!['mousedown', 'wheel'].includes(event.type) || !event.path.some(el=>typeof el.matches === 'function' && el.matches(this.options.ignore))){
        new Promise(gotKey=>new Promise(gotPressed=>gotPressed(this.options.event.converter[event.type](event))).then(pressed=>gotKey([pressed, ...this.options.key[pressed]]))).then(([pressed, action, ...args])=>{
            if (this.options.valid.includes(pressed)) this.options.action[action](...args);
            console.info(pressed, action, args);
            this.options.postAction.forEach(post=>this.options.action[post.action](...post.args));
        });
    }};
    this.createController = (forwardedEvent, video, control) => {
        this.options.action = {seek:null, play:null, pause:null, volume:null, muted:null, getCurrentTime:null, currentTime:null};
        this.time.unit = this.options.unit;
        Object.keys(this.options.action).forEach(actionName=>this.options.setAction(video, control, actionName));
        this.setPseudo(video, control);
        this.options.event.types.forEach(type=>window.addEventListener(type, this.controllerHandler, false));
        if (!!forwardedEvent && !!forwardedEvent.target) forwardedEvent.target.dispatchEvent(forwardedEvent);
    };
    this.run = event => aGet('video:not(.hasController)').then(video=>{
        this.domain = document.domain;
        if (typeof profile[profile.player[this.domain]] === 'object'){ Object.entries(profile.default).forEach(([option, value])=>{
            this.options[option] = profile[profile.player[this.domain]][option] !== false && !profile[profile.player[this.domain]][option] ? value : typeof profile[profile.player[this.domain]][option] === 'object' ? Object.assign(value, profile[profile.player[this.domain]][option]) : profile[profile.player[this.domain]][option]
            console.info('option %o = %o, profile[option] = %o', option, this.options[option], profile[profile.player[this.domain]][option]);
        })} else Object.assign(this.options, profile.default);
        this.options.valid = Object.keys(this.options.key);
        this.video = video;
        this.video.classList.add('hasController');
        console.info(this.options);
        if (this.options.saveTime){
            this.video.addEventListener('timeupdate', event=>{
                let gv = +GM_getValue(location.href);
                if (!gv) GM_setValue(location.href, event.target.currentTime);
                if (!event.target.lastTime){
                    event.target.lastTime = 0;
                } else if (event.target.currentTime < gv){
                    if (event.target.currentTime < event.target.lastTime && event.target.lastTime > 2 && event.target.currentTime > 2) GM_setValue(location.href, event.target.currentTime); else this.options.action.set(gv);
                } else if (event.target.currentTime > gv){
                    GM_setValue(location.href, event.target.currentTime);
                }
                event.target.lastTime = event.target.currentTime;
            }, false);
        }
        this.options.getControl(this.video).then(control=>{
            this.control = control;
            this.createController(!event ? null : event, this.video, this.control);
        });
    });
    this.run();
};

console.info('new %O', new kbControl());

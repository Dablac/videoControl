const aGet = async (selector, target = document, r = target.querySelector(selector)) => await new Promise((p,f)=>requestAnimationFrame(()=>(!r?f:p)(r))).catch(r=>aGet(selector, target, target.querySelector(selector)));

const profile = {
    player:{
        'www.netflix.com': 'netflix',
        'www.rapidvideo.com': 'videojs',
        'streamango.com': 'videojs',
        'openload.co': 'videojs',
        'oload.download': 'videojs',
        'vidstreaming.io': 'videojs',
    },
    default:{
        unit:'s',
        mod:{
            active:{},//{'LMB': {standard: 'playpause', args: [void 0], used: false}}
            'LMB':{
                'RMB': ['playpause'],
                'MMB': ['speed', true],
                'WheelUp': ['speed', false, true],
                'WheelDown': ['speed', false],
            }
        },
        key:{
            'LMB': ['mod', 'playpause'],
            'RMB': ['skip', 'small'],
            'MMB': ['skip', 'big'],
            'WheelUp': ['skip', 'tiny', true],
            'WheelDown': ['skip', 'tiny'],
            'ArrowUp': ['skip', 'big', true],
            'ArrowRight': ['skip', 'small', true],
            'ArrowLeft': ['skip', 'small'],
            'ArrowDown': ['skip', 'big'],
            ' ': ['playpause']
        },
        saveTime: true,
        blockContextMenu: true,
        ignore: 'button, [class*="jw-controls"]',
        getControl: video => new Promise(gotControl=>gotControl(video)),
        postAction:[{action: 'volume', args: [1.0]}, {action: 'muted', args: [false]}]
    },
    videojs:{
        key:{
            'ArrowRight': ['skip', 'tiny', true],
            'ArrowLeft': ['skip', 'tiny'],
            //' ': null,
            //'LMB': null,
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
        saveTime: true,
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
    this.speed = (reset, increase) => (!reset ? this.video.playbackRate+(0.1*(2*!!increase-1)) : 1.0);
    this.options = {
        event:{
            map: {mousedown: ['LMB', 'MMB', 'RMB'], mouseup: ['LMB', 'MMB', 'RMB'], wheel: ['WheelUp','WheelDown']},
            types: ['keydown', 'keyup', 'mousedown', 'mouseup', 'wheel'],
            converter: {
                keydown: event=>event.key,
                keyup: event=>event.key,
                mousedown: event=>this.options.event.map[event.type][event.button],
                mouseup: event=>this.options.event.map[event.type][event.button],
                wheel: event=>this.options.event.map[event.type][(1+Math.sign(event.deltaY))/2],
            },
        },
        valid: {},
        action: {},
        propAction: (target, propName) => value => (target[propName] = value),
        setAction: (video, control, actionName) => new Promise(gotTarget=>gotTarget([video, control].find(target=>actionName in target))).then(target=>(this.options.action[actionName] = !!target && typeof target[actionName] === 'function' ? target[actionName].bind(target) : this.options.propAction(target, actionName))),
    };
    this.setPseudo = (video, control) =>{
        this.options.action.speed = (...args) => this.options.action.playbackRate(this.speed(...args));
        this.options.action.mod = (pressed, ...[standard, args]) => (this.options.mod.active[pressed] = {standard:standard, args:args, used:!standard});
        this.options.action.set = (value) => (!this.options.action.seek.name ? this.options.action.currentTime : this.options.action.seek)(value*this.time.units[this.time._unit]);
        this.options.action.skip = (...args) => (!this.options.action.seek.name ? this.options.action.currentTime : this.options.action.seek)(this.skip(...args));
        this.options.action.playpause = () => video.paused ? this.options.action.play() : this.options.action.pause();
    };
    this.handlers = {
        mod: (event, pressed, action, args, keyup = event.type.endsWith('up'), l = console.log(event, pressed, action, args, keyup)) =>{
            if (keyup){
                if (!this.options.mod.active[pressed].used)this.options.action[this.options.mod.active[pressed].standard](this.options.mod.active[pressed].args);
                delete this.options.mod.active[pressed];
            } else this.options.action[action](pressed, ...args);
        },
        down:(event, pressed, action, args, activeMod, state = activeMod ? ([this.options.mod.active[activeMod].used, action, ...args] = [true, ...this.options.mod[activeMod][pressed]]) : void 0, l = console.log(event, pressed, action, args, activeMod, state)) => this.options.action[action](...args),
    }
    this.controllerHandler = (event, activeMod = Object.keys(this.options.mod.active)[0]) => {
        if (!document.contains(this.video)) this.run(event); else if (!['mousedown', 'mouseup', 'wheel'].includes(event.type) || !event.path.some(el=>typeof el.matches === 'function' && el.matches(this.options.ignore))){
            new Promise(gotKey=>new Promise(gotPressed=>gotPressed(this.options.event.converter[event.type](event))).then(pressed=>gotKey([pressed, ...this.options.key[pressed]]))).then(([pressed, action, ...args])=>{
                if (this.options.valid[activeMod].includes(pressed)){
                    action === 'mod' ? this.handlers.mod(event, pressed, action, args) : (!event.type.endsWith('up') ? this.handlers.down(event, pressed, action, args, activeMod) : void 0);
                    this.options.postAction.forEach(post=>this.options.action[post.action](...post.args));
                }
            });
        }
    };
    this.createController = (forwardedEvent, video, control) => {
        this.options.action = {seek:null, play:null, pause:null, volume:null, muted:null, getCurrentTime:null, currentTime:null, playbackRate:null};
        this.time.unit = this.options.unit;
        Object.keys(this.options.action).forEach(actionName=>this.options.setAction(video, control, actionName));
        this.setPseudo(video, control);
        this.options.event.types.forEach(type=>window.addEventListener(type, this.controllerHandler, false));
        //if (this.options.fullScreen){}
        if (this.options.blockContextMenu) window.addEventListener('contextmenu', event=>/*event.path.includes(this.video) && */event.preventDefault(), false);
        if (!!forwardedEvent && !!forwardedEvent.target) forwardedEvent.target.dispatchEvent(forwardedEvent);
    };
    this.timeSaver = () => this.video.addEventListener('timeupdate', event=>{
        let gv = +GM_getValue(location.href);
        if (!gv) GM_setValue(location.href, event.target.currentTime);
        if (!event.target.lastTime){
            event.target.lastTime = 0;
        } else if (event.target.currentTime < gv){
            if (event.target.currentTime < event.target.lastTime && event.target.lastTime > 0) GM_setValue(location.href, event.target.currentTime); else this.options.action.set(gv);
        } else if (event.target.currentTime > gv){
            GM_setValue(location.href, event.target.currentTime);
        }
        event.target.lastTime = event.target.currentTime;
    }, false);
    this.run = event => aGet('video:not(.hasController)').then(video=>{
        this.domain = document.domain;
        if (typeof profile[profile.player[this.domain]] === 'object'){
            Object.entries(profile.default).forEach(([option, value])=>(this.options[option] = profile[profile.player[this.domain]][option] !== false && !profile[profile.player[this.domain]][option] ? value : typeof profile[profile.player[this.domain]][option] === 'object' ? Object.assign(value, profile[profile.player[this.domain]][option]) : profile[profile.player[this.domain]][option]))
        } else Object.assign(this.options, profile.default);
        this.options.valid[void 0] = Object.keys(this.options.key);
        Object.keys(this.options.mod).forEach(modkey => modkey !== 'active' ? (this.options.valid[modkey] = [modkey, ...Object.keys(this.options.mod[modkey])]) : void 0);
        this.video = video;
        this.video.classList.add('hasController');
        console.info(this.options);
        if (this.options.saveTime) this.timeSaver();
        this.options.getControl(this.video).then(control=>{
            this.control = control;
            this.createController(!event ? null : event, this.video, this.control);
        });
    });
    this.run();
};

console.info('new %O', new kbControl());

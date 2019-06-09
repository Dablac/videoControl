const aGet = async (selector, target = document, r = target.querySelector(selector)) => await new Promise((p,f)=>requestAnimationFrame(()=>(!r?f:p)(r))).catch(r=>aGet(selector, target, target.querySelector(selector)));

const simClick = targetNode => ["mouseover", "mousedown", "mouseup", "click"].forEach((type, i, a, evt = document.createEvent('MouseEvents'), _init = evt.initEvent(type, true, true))=>targetNode.dispatchEvent(evt));

function Layers(_storageKey){
    this.storageKey = !_storageKey ? location.pathname+location.search : _storageKey;
    this.bottom = false;
    this.top = window.location === window.parent.location;
    this.type = () => ['bottom', 'top', 'middle'][[this.bottom, this.top, !this.bottom && !this.top].indexOf(true)];
    this.pathDown = void 0;
    this.pathUp = void 0;
    this._setValue = value => localStorage.setItem(this.storageKey, value);
    this._getValue = () => localStorage.getItem(this.storageKey);
    window.addEventListener('message', event=> {
        let obj = JSON.parse(event.data);
        if (!!obj && obj.layerStream){
            //console.log('[%o]%O received message %o; stream = %O', this.type(), location.href, obj.data, obj)
            if (this.bottom || this.top){
                switch(true){
                    case obj.data === 'reset':
                        this.pathDown = void 0;
                        this.pathUp = void 0;
                        this.gvCallback = void 0;
                        this.child = void 0;
                        break;
                    case obj.data.startsWith('assignBottom:'):
                        this.targetBottom = obj.data.slice(13);
                        this.pathDown = obj.url.concat(location.href).reverse()
                        console.info('targetBottom & pathDown assigned: %o, this.path = %o', this.targetBottom, this.pathDown);
                        this.initStream(`pathToTop:${JSON.stringify(obj.url.concat(location.href))}`);
                        break;
                    case (obj.data.startsWith('pathToTop:')):
                        this.pathUp = JSON.parse(obj.data.slice(10));
                        console.info('pathUp assigned: %o', this.pathUp);
                        break;
                    case (obj.data.startsWith('setValue:')):
                        this._setValue(obj.data.slice(9));
                        break;
                    case (this.top && obj.data === 'getValue'):
                        this.initStream(`getValue:${!this._getValue() ? 0 : this._getValue()}`);
                        break;
                    case (obj.data.startsWith('getValue:')):
                        if (!!this.gvCallback) this.gvCallback(obj.data.slice(9));
                        break;
                    default:
                        throw new Error('no default case allowed; unknown error in layer switch-case statement');
                        break;
                }
            } else this.appendStream(event.data);
        }
    });
    this.sendToParent = (stream, path) => window.parent.postMessage(stream, !path ? document.location.ancestorOrigins.item(document.location.ancestorOrigins.length-1) : path[Math.sign(path.indexOf(location.href))+1]);
    this.sendToChild = (stream, path, url = new URL(path[Math.sign(path.indexOf(location.href))+1]), child = !this.child ? (this.child = document.querySelector(`iframe[src$="${url.pathname+url.search}"]`)) : this.child) => this.child.contentWindow.postMessage(stream, this.child.src);
    this.sendStream = (direction, streamString, path) => direction.constructor === Error ? console.error(direction) : (direction === 'Up' ? this.sendToParent : this.sendToChild)(streamString, path);
    this.appendStream = (_stream, stream = _stream.constructor === String ? JSON.parse(_stream) : stream) =>{
        stream.url.push(location.href);
        stream.last = location.href;
        this.sendStream(stream.direction, JSON.stringify(stream), stream.path);
    }
    this.initStream = (data, direction = this.bottom ? 'Up' : (this.top ? 'Down' : new Error('direction must be specified for streams originating in middle layers')), path = this[`path${direction}`]) => this.sendStream(direction, JSON.stringify({direction: direction, path: path, data: data, url: [location.href], initiator: location.href, layerStream: true}), !path ? void 0 : path);
    this.gvCallback = void 0;
    this.set = value => this.initStream(`setValue:${value}`);
    this.get = callback => {
        this.gvCallback = callback;
        this.initStream(`getValue`);
    }
    this.setBottom = () => (this.flat = (this.top ? true : void 0 !== this.initStream(`assignBottom:${location.href}`)));
    this.reset = () => this.initStream('reset');
}

const profile = {
    player:{
        'www.netflix.com': 'netflix',
        'www.rapidvideo.com': 'videojs',
        'streamango.com': 'videojs',
        'openload.co': 'videojs',
        'oload.download': 'videojs',
        'vidstreaming.io': 'videojs',
        'vidlox.me': 'clappr',
        'www.fembed.com': 'jwplayer',
    },
    default:{
        unit:'s',
        //Generally actions with bidirectional outcomes (i.e. forward/backward, slower/faster etc.) default to the negative/decreasing outcome (default input of false) while appending true will switch it to positive/increasing.
        mod:{
            active:{},//Example format when active: {'LMB': {standard: 'playpause', args: [void 0], used: false}}
            'LMB':{
                //'RMB': ['skip', 'big', true],
                'RMB': ['rotate'],
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
        fullScreen: true,
        saveTime: true,
        blockContextMenu: true,
        ignore: 'button, [class*="jw-controls"]',
        getControl: video => new Promise(gotControl=>gotControl(video)),
        postAction:[{action: 'volume', args: [1.0]}, {action: 'muted', args: [false]}]
    },
    clappr:{
        key:{
            'ArrowRight': ['skip', 'tiny', true],
            'ArrowLeft': ['skip', 'tiny'],
            ' ': null,
            'LMB': ['mod', null],
        },
        ignore: '.media-control *',
    },
    jwplayer:{
        key:{
            'ArrowRight': ['skip', 'tiny', true],
            'ArrowLeft': ['skip', 'tiny'],
            ' ': null,
            'LMB': ['mod', null],
        },
        ignore: '.jw-controls *',
        getControl: (video) =>new Promise(gotControl=>{
            video.addEventListener('play',event=>simClick(Array.prototype.find.call(document.querySelectorAll('.jw-settings-content-item'), button=>button.textContent.includes(['1080p', '720p', '480p', '360p'].find(q=>Array.prototype.find.call(document.querySelectorAll('.jw-settings-content-item'), button=>button.textContent.includes(q)))))), false);
            gotControl(video)
        })
    },
    videojs:{
        key:{
            'ArrowRight': ['skip', 'tiny', true],
            'ArrowLeft': ['skip', 'tiny'],
            ' ': null,
            'LMB': ['mod', null],
        },
        ignore: '.vjs-control',
    },
    xplayer:{
        key:{
            'ArrowRight': null,
            'ArrowLeft': null,
            ' ': null,
            'LMB': ['mod', null],
        },
        fullScreen: false,
        ignore: '.xplayer.no-user-action .control-bar, .xplayer.no-user-action .xp-progress-bar, .xplayer.no-user-action .xplayer-background-top, .xplayer.no-user-action .xplayer-background-bottom, .xplayer.no-user-action .settings-menu, .xplayer.no-user-action .xplayer-hover-menu, .xplayer.no-user-action .xplayer-ads-label, .xplayer.no-user-action .xp-subscribe',
    },
    netflix:{
        unit:'ms',
        key:{
            'ArrowRight': null,
            'ArrowLeft': null,
            ' ': null
        },
        saveTime: false,
        ignore: '.PlayerControlsNeo__core-controls *',
        getControl: () => new Promise(gotPlayerInstance=>new Promise(gotVideoPlayer=>gotVideoPlayer(netflix.appContext.state.playerApp.getAPI().videoPlayer)).then(player=>gotPlayerInstance(player.getVideoPlayerBySessionId(player.getAllPlayerSessionIds()[0])))),
    }
};

function videoControl(_controllerOptions){
    this.storageKey = location.pathname+location.search;
    this.layers = new Layers(this.storageKey);
    this.time = {
        _unit: 'ms',
        units: {ms: 1000, s:1, m:(1/60)},
        sizes: {big:60, small:10, tiny:5},
    };
    Object.defineProperty(this.time, 'unit', {set: input =>{this.time._unit = input}});
    Object.keys(this.time.sizes).forEach(size=>Object.defineProperty(this.time, size, {get: () => this.time.units[this.time._unit]*this.time.sizes[size]}));
    this.skip = (offset, forward) => (!this.options.action.getCurrentTime.name ? this.video.currentTime*this.time.units[this.time._unit] : this.options.action.getCurrentTime())+((2*!!forward-1)*(offset.constructor === Number ? offset*this.time.units[this.time._unit] : this.time[offset]));
    //this.speed = (reset, increase) => (!reset ? this.video.playbackRate*(0.5+increase+(0.5*increase)*(2*!!increase-1)) : 1.0);//(!reset ? this.video.playbackRate+(0.1*(2*!!increase-1)) : 1.0);
    this.speed = (reset, increase, _magnitude = 0.25, l = console.log(reset, increase, this.video.playbackRate, !reset ? this.video.playbackRate+(_magnitude*(2*!!increase-1)) : 1.0)) => (!reset ? this.video.playbackRate+(_magnitude*(2*!!increase-1)) : 1.0);
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
        this.options.action.rotate = (newDeg = !video.style.transform ? 90 : (parseInt(video.style.transform.substr(7, 3), 10)+90)%360, normal = !(newDeg%180/90)) => (video.style.transform = normal ? `rotate(${newDeg}deg)` : `rotate(${newDeg}deg) scale(${video.videoHeight/video.videoWidth})`);
    };
    this.handlers = {
        mod: (event, pressed, action, args, keyup = event.type.endsWith('up')) =>{
            if (keyup){
                if (!this.options.mod.active[pressed].used) this.options.action[this.options.mod.active[pressed].standard](this.options.mod.active[pressed].args); else {
                    event.preventDefault();
                    event.stopPropagation();
                }
                delete this.options.mod.active[pressed];
            } else this.options.action[action](pressed, ...args);
        },
        down:(event, pressed, action, args, activeMod, state = activeMod ? ([this.options.mod.active[activeMod].used, action, ...args] = [true, ...this.options.mod[activeMod][pressed]]) : void 0) => this.options.action[action](...args),
    }
    this.controllerHandler = (event, activeMod = Object.keys(this.options.mod.active)[0], hitVideo = event.constructor === KeyboardEvent || (this.options.fullScreen ? true : event.path.includes(this.video)), hitIgnore = (hitVideo && event.path.some(el=>typeof el.matches === 'function' && el.matches(this.options.ignore)))) => {
        if (hitVideo && event.constructor === WheelEvent) event.preventDefault();
        let iv = this.invalidate(this.video);
        console.log('invalid: %o [%o, %o, %o]', iv, !document.contains(this.video), !this.video.parentElement, !Number.isFinite(1/this.video.duration));
        if (iv){
            this.run(event);
        } else if (hitVideo && !hitIgnore){
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
        this.options.event.types.forEach(type=>window.addEventListener(type, this.controllerHandler, {passive: false}));
        if (this.options.blockContextMenu) video.addEventListener('contextmenu', event => event.preventDefault(), {passive: false});
        if (!!forwardedEvent && !!forwardedEvent.target) forwardedEvent.target.dispatchEvent(forwardedEvent);
    };
    this.flatTimeSaveHandler = (event, time = +localStorage[this.storageKey]) => {
        if (!time) localStorage.setItem(this.storageKey, event.target.currentTime);
        if (!event.target.lastTime) event.target.lastTime = 0;
        if (event.target.currentTime < time){
            if (event.target.currentTime < event.target.lastTime && event.target.lastTime > 0) localStorage.setItem(this.storageKey, event.target.currentTime); else this.options.action.set(time);
        } else if (event.target.currentTime > time){
            localStorage.setItem(this.storageKey, event.target.currentTime);
        }
        event.target.lastTime = event.target.currentTime;
    };
    this.layerTimeSaveHandler = event => this.layers.get((_time, time = +_time) => {
        if (!time) this.layers.set(event.target.currentTime);
        if (!event.target.lastTime){
            event.target.lastTime = 0;
        } else if (event.target.currentTime < time){
            if (event.target.currentTime < event.target.lastTime && event.target.lastTime > 0) this.layers.set(event.target.currentTime); else this.options.action.set(time);
        } else if (event.target.currentTime > time){
            this.layers.set(event.target.currentTime);
        }
        event.target.lastTime = event.target.currentTime;
    });
    this.live = document.getElementsByTagName('video');
    this.isPlaying = video => video.readyState > 2 && !video.paused && !video.ended && video.currentTime > Number.EPSILON;
    this.getVideo = (fromLive = Array.prototype.find.call(this.live, this.isPlaying)) => !fromLive ? aGet(':not(a) video:not(.hasVideoController):not(.invalidForVideoController)') : new Promise(gotFromLive=>gotFromLive(fromLive));
    this.invalidate = video => [document.contains(video), video.parentElement, Number.isFinite(1/video.duration), !video.closest('a[href]')].some(condition=>!condition);
    this.timeSaver = flat => this.video.addEventListener('timeupdate', flat ? this.flatTimeSaveHandler : this.layerTimeSaveHandler, false);
    this.run = event => this.getVideo().then((video, _domain = (this.domain = document.domain), _profile = (this.profile = profile[profile.player[this.domain]]))=>{
        if (!this.invalidate(video)){
            if (typeof this.profile === 'object'){
                Object.entries(profile.default).forEach(([option, value])=>(this.options[option] = !this.profile.hasOwnProperty(option) ? value :(typeof this.profile[option] === 'object' ? Object.assign(value, this.profile[option]) : this.profile[option])));
            } else Object.assign(this.options, profile.default);
            this.options.valid[void 0] = Object.keys(this.options.key);
            Object.keys(this.options.mod).forEach(modkey => modkey !== 'active' ? (this.options.valid[modkey] = [modkey, ...Object.keys(this.options.mod[modkey])]) : void 0);
            this.video = video;
            this.video.classList.add('hasVideoController');
            if (this.options.saveTime){
                this.layers.bottom = true;
                this.layers.reset();
                this.layers.setBottom();
                this.layerTimeSaveHandler({target: video}); //init with current video values
                this.timeSaver(this.layers.flat);
            }
            this.options.getControl(this.video).then(control=>{
                video.videoController = this;
                this.control = control;
                this.createController(!event ? null : event, this.video, this.control);
            });
        } else {
            video.classList.add('invalidForVideoController');
            this.run(event);
        }
    });
    this.run();
};

console.info('new %O at %o', new videoControl(), location.href);

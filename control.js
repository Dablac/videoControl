// ==UserScript==
// @name         videoControl Testing
// @author       You
// @include      *
// @grant        none
// ==/UserScript==

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
        fullScreen: true,
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

function Layers(){
    this.bottom = !document.getElementsByTagName('IFRAME').length;
    this.top = window.location === window.parent.location
    this.middle = !this.bottom && !this.top;
    this.type = ['bottom', 'top', 'middle'][[this.bottom, this.top, this.middle].indexOf(true)];
    this.pathDown = void 0;
    this.pathUp = void 0;
    this.storageKey = location.pathname+location.search;
    this._setValue = value => localStorage.setItem(this.storageKey, value);
    this._getValue = () => localStorage.getItem(this.storageKey);
    window.addEventListener('message', event=> {
        let obj = JSON.parse(event.data);
        if (!!obj && obj.layerStream){
            //console.log('[%o]%O received message %o; stream = %O', this.type, location.href, obj.data, obj)
            if (this.bottom || this.top){
                switch(true){
                    case obj.data === 'reset':
                        this.pathDown = void 0;
                        this.pathUp = void 0;
                        this.gvCallback = void 0;
                        this.child = void 0;
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
                        this.gvCallback(obj.data.slice(9));
                        break;
                    default:
                        throw new Error('no default allowed, error in layer switch statement');
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
    this.setBottom = () => this.initStream(`assignBottom:${location.href}`);
    this.reset = () => this.initStream('reset');
}

function videoControl(_controllerOptions){
    this.layers = new Layers();
    this.time = {
        _unit: 'ms',
        units: {ms: 1000, s:1, m:(1/60)},
        sizes: {big:60, small:10, tiny:5},
    };
    Object.defineProperty(this.time, 'unit', {set: input =>{this.time._unit = input}});
    Object.keys(this.time.sizes).forEach(size=>Object.defineProperty(this.time, size, {get: () => this.time.units[this.time._unit]*this.time.sizes[size]}));
    this.skip = (offset, forward) => (!this.options.action.getCurrentTime.name ? this.video.currentTime*this.time.units[this.time._unit] : this.options.action.getCurrentTime())+((2*!!forward-1)*(offset.constructor === Number ? offset*this.time.units[this.time._unit] : this.time[offset]));
    //this.speed = (reset, increase) => (!reset ? this.video.playbackRate*(0.5+increase+(0.5*increase)*(2*!!increase-1)) : 1.0);//(!reset ? this.video.playbackRate+(0.1*(2*!!increase-1)) : 1.0);
    this.speed = (reset, increase) => (!reset ? this.video.playbackRate+((1/3)*(2*!!increase-1)) : 1.0);
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
        this.options.action.rotate = () => (video.style.transform = `rotate(${(+video.style.transform.slice(7, -4)+90)%360}deg)`);
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
    this.controllerHandler = (event, activeMod = Object.keys(this.options.mod.active)[0]) => {
        if (!document.contains(this.video)) this.run(event); else if ((this.options.fullScreen ? true : event.path.includes(this.video)) && (!['mousedown', 'mouseup', 'wheel'].includes(event.type) || !event.path.some(el=>typeof el.matches === 'function' && el.matches(this.options.ignore)))){
            new Promise(gotKey=>new Promise(gotPressed=>gotPressed(this.options.event.converter[event.type](event))).then(pressed=>gotKey([pressed, ...this.options.key[pressed]]))).then(([pressed, action, ...args])=>{
                if (this.options.valid[activeMod].includes(pressed)){
                    action === 'mod' ? this.handlers.mod(event, pressed, action, args) : (!event.type.endsWith('up') ? this.handlers.down(event, pressed, action, args, activeMod) : void 0);
                    this.options.postAction.forEach(post=>this.options.action[post.action](...post.args));
                }
            });
        }
    };
    let startType = void 0;
    let pausesOnClick = void 0;
    this.testClickHandler = event =>{
        if (!startType){
            startType = event.type;
            this.video.click();
        } else if (pausesOnClick === void 0){
            if (!event.which){
                if (startType !== event.type){
                    pausesOnClick = true;
                    this.options.key.LMB[1] = void 0;
                    this.options.action[startType === 'play' ? 'play' : 'pause']();
                    ['play', 'pause'].forEach(type=>this.video.removeEventListener(type, this.testClickHandler, false));
                }
            } else {
                pausesOnClick = false;
                ['play', 'pause'].forEach(type=>this.video.removeEventListener(type, this.testClickHandler, false));
            }
        }
    }
    this.createController = (forwardedEvent, video, control) => {
        this.options.action = {seek:null, play:null, pause:null, volume:null, muted:null, getCurrentTime:null, currentTime:null, playbackRate:null};
        this.time.unit = this.options.unit;
        Object.keys(this.options.action).forEach(actionName=>this.options.setAction(video, control, actionName));
        this.setPseudo(video, control);
        this.options.event.types.forEach(type=>window.addEventListener(type, this.controllerHandler, false));
        //if (this.options.fullScreen){}
        ['play', 'pause'].forEach(type=>video.addEventListener(type, this.testClickHandler, false));
        if (this.options.blockContextMenu) window.addEventListener('contextmenu', event=>event.path.includes(this.video) && event.preventDefault(), false);
        if (!!forwardedEvent && !!forwardedEvent.target) forwardedEvent.target.dispatchEvent(forwardedEvent);
    };
    this.timeSaveHandler = event => this.layers.get(time => {
        if (!+time) this.layers.set(event.target.currentTime);
        if (!event.target.lastTime){
            event.target.lastTime = 0;
        } else if (event.target.currentTime < +time){
            if (event.target.currentTime < event.target.lastTime && event.target.lastTime > 0) this.layers.set(event.target.currentTime); else this.options.action.set(+time);
        } else if (event.target.currentTime > +time){
            this.layers.set(event.target.currentTime);
        }
        event.target.lastTime = event.target.currentTime;
    });
    this.timeSaver = () => this.video.addEventListener('timeupdate', this.timeSaveHandler, false);
    this.run = event => aGet(':not(a) video:not(.hasVideoController):not(.invalidForVideoController)').then((video, _domain = (this.domain = document.domain), _profile = (this.profile = profile[profile.player[this.domain]]))=>{
        if (!video.closest('a[href]')){
            if (typeof this.profile === 'object'){
                Object.entries(profile.default).forEach(([option, value])=>(this.options[option] = !this.profile.hasOwnProperty(option) ? value :(typeof this.profile[option] === 'object' ? Object.assign(value, this.profile[option]) : this.profile[option])));
            } else Object.assign(this.options, profile.default);
            this.options.valid[void 0] = Object.keys(this.options.key);
            Object.keys(this.options.mod).forEach(modkey => modkey !== 'active' ? (this.options.valid[modkey] = [modkey, ...Object.keys(this.options.mod[modkey])]) : void 0);
            this.video = video;
            this.video.classList.add('hasVideoController');
            if (this.options.saveTime){
                this.layers.reset();
                this.layers.setBottom();
                this.timeSaveHandler({target: video});
                this.timeSaver();
            }
            this.options.getControl(this.video).then(control=>{
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

console.info('new %O', new videoControl());

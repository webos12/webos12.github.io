//Vowels created with createPeriodicWave with all harmonics passing through bandpass filters of Q=10.

//Got these!!!
//1 ah cat
//5 uh trust
//6 eh bet
//8 er fur

//Holding the space bar turns the gain on
import { util, api as capi } from "util";
import { globals } from "config";
const{strnum, isarr, isstr, isnum, isobj, make, KC, kc, log, jlog, cwarn, cerr}=util;

let VOWELS=[//«
[270, 2290, 3010, "ee"],
[660, 1720, 2410, "ah"],
[570, 640, 2410, "aw"],
[390, 1990, 2550, "ih"],
[300, 870, 2240, "oo"],
[520, 1190, 2390, "uh"],
[530, 1840, 2480, "eh"],
[730, 1090, 2440, "aah"],
[490, 1350, 1690, "er"],
[440, 1020, 2240, "ou"]
]

//»

//7 aw bought/ say aaah/ hot  							--> They say "hot" /a/
//2 aw bought, but a guess could be a long O: joke 		--> They say "bought" /ow/


//0 ee free
//1 ah cat
//3 ih hit
//4 oo choose
//5 uh trust
//6 eh bet
//8 er fur
//9 ou could

const APPNAME="F";

export const app = function(Win) {

//Imports«
const {Main, Desk} = Win;

//const {Core, Main, NS}=arg;
//const{log,cwarn,cerr,api:capi, globals, Desk}=Core;

//Main.top.title=APPNAME;
//const{fs,util}=globals;
//const{make,mkdv,mk,mksp}=util;

//const Win = Main.top;

//»

//Var«

let f1, f2, f3;

let AMP_CURVE;
let AMP_CURVE_DECAY = 0.5;
let AMP_CURVE_ITERS = 10;
//let AMP_CURVE=[0.15,0.5,0.25,0.125,0.0625,0.1,0.05,0];
let CURVE_SECS=4;


//if (!globals.audio) Core.api.mkAudio();
//const {mixer, ctx}=globals.audio;
let ctx = globals.audioCtx || new AudioContext();
globals.audioCtx = ctx;
const OUT = ctx.createBiquadFilter();
OUT.frequency.value=1000;
const LINEOUT = ctx.createGain();
const OUTGAIN = LINEOUT.gain;
OUTGAIN.value=0;

//const PLUG = mixer.plug_in(OUT);
LINEOUT.connect(OUT);
//OUT.connect(LINEOUT);
OUT.connect(ctx.destination);

//»

//DOM«

Main._fs=64;
Main._dis="flex";
Main.style.alignItems="center";
Main.style.justifyContent="center";

Win.status_bar.innerHTML="0-9 to change vowels | Space to play";

//»

//Funcs«

const gn = (val)=>{//«
    let g = ctx.createGain();
    if (Number.isFinite(val)) g.gain.value = val;
    return g;
};//»

const con=(node1,node2)=>{node1.connect(node2);};
const cons=(arr)=>{let to=arr.length-1;for(let i=0;i<to;i++)arr[i].connect(arr[i+1]);};

const conp=(arg1,arg2)=>{//«
	let arr1;
	if (arg1.connect) arr1 = [arg1];
	else if (arg1.length) arr1 = arg1;
	else throw "Bad arg1";

	let arr2;
	if (arg2.connect) arr2 = [arg2];
	else if (arg2.length) arr2 = arg2;
	else throw "Bad arg2";

	for (let n1 of arr1){
		for (let n2 of arr2) n1.connect(n2);
	}
};//»

const getcurve=()=>{//«
	let NUM=100;
	let NUM_HALF=50;
	let USEMULT=-2.5;
//	let USEMULT=-2.5;
	let USECLIP=false;
	const CURVE=(x,opts={mult:1, clip:true})=>{
		let num_half_cycles = 1;
		let val = 1-(0.5*(1-Math.cos((num_half_cycles*x*Math.PI/NUM))));
		let flat = (x-NUM_HALF)/NUM_HALF;
		let got = 1+(2*-val);
		let diff = got-flat;
		let isneg = x < NUM_HALF;
		let mdf = opts.mult*diff-flat;
		if (opts.clip) {
			if (isneg) {
				if( mdf < 0) mdf = 0;
			}
			else {
				if (mdf > 0) mdf = 0;
			}
		}

		let rv = 0.5*(mdf)+0.5;
		if (rv > 1 && opts.clip) rv = 1;
		else if (rv < 0 && opts.clip) rv = 0;
		return rv;
	};
    let arr = new Float32Array(NUM+1);
    for (let i=0; i<=NUM; i++){
        let y = CURVE(i,{mult:USEMULT, clip: USECLIP});
        arr[i]=2*(0.5-y);
    };
    return arr;
//log(arr);
}//»
//Osc«

const osc = (type, freq)=>{//«
    let o = ctx.createOscillator();
    o.frequency.value = freq;
    o.type=type;
    o.start();
    return o;
};//»

const sin = freq=>{return   osc("sine", freq)};
const tri = (freq)=>{return osc("triangle", freq);};
const saw = (freq)=>{return osc("sawtooth", freq);};
const sqr = (freq)=>{return osc("square", freq);};

//»
const bqf = (freq, type) => {
    let f = ctx.createBiquadFilter();
    if (freq) f.frequency.value = freq;
    if (type) f.type = type;
	f.Q.value = 10.0000001;
    return f;
};
const now=(add)=>{
	if (!add) add=0;
	return ctx.currentTime + add;
};
const vol=val=>{//«
	if(OUTGAIN.value===val) return;
	OUTGAIN.value=val;
///	OUTGAIN.exponentialRampToValueAtTime(1, ctx.currentTime+0.5);
};//»

const init=()=>{//«
{
	AMP_CURVE=[0.15];
	let CURAMP=0.5;
	for (let i=0; i < AMP_CURVE_ITERS; i++){
		AMP_CURVE.push(CURAMP);
		CURAMP*=AMP_CURVE_DECAY;
	}
	AMP_CURVE.push(0);
}


let basefreq = 100;

let o = sin(basefreq);

//Even harmonics (higher ring)
//let real = new Float32Array([0,1,0.66,0,0.33,0,0.166]);
//let imag = new Float32Array([0,0,0,0,0,0,0]);

//Odd harmonics (a gong)

let reals=[0,1];
let imags=[0,0];
let if_even=false;
for (let i=2; i <= 100; i++){
//	if (if_even) reals[i]=i%2?0:1;
//	else reals[i]=i%2;
	reals[i]=1;
	imags[i]=0;
}
//log(reals);
//let real = new Float32Array([0,1,0,0.66,0,0.33,0,0.166]);
//let imag = new Float32Array([0,0,0,0,0,0,0,0]);
let real = new Float32Array(reals);
let imag = new Float32Array(imags);

let wave = ctx.createPeriodicWave(real, imag, {disableNormalization: false});

o.setPeriodicWave(wave);

//0-9



//7 aw bought/ say aaah

//2 aw bought, but a guess could be a long O: joke


//0 ee free
//1 ah cat
//3 ih hit
//4 oo choose
//5 uh trust
//6 eh bet
//8 er fur
//9 ou could


let which = 0;

let vow = VOWELS[which];
f1=bqf(vow[0],"bandpass");
f2=bqf(vow[1],"bandpass");
f3=bqf(vow[2],"bandpass");
Main.innerHTML = vow[3];
let g = gn(0.75);

conp(o,[f1,f2,f3]);
conp([f1,f2,f3],g);

con(g,LINEOUT);

}//»


//»

//OBJ/CB«
this.onappinit=init;

this.onloadfile=bytes=>{};

this.onkeydown = function(e,s) {//«
//	if (s==="SPACE_") vol(1);
	let marr;
	if (s==="SPACE_") {

//let now 

//		OUTGAIN.exponentialRampToValueAtTime(0.5, now(0));
//		OUTGAIN.linearRampToValueAtTime(0.25, now(0.25));
//		OUTGAIN.linearRampToValueAtTime(0, now(0.5));
//		OUTGAIN.linearRampToValueAtTime(0, now(2));
try{
		OUTGAIN.setValueCurveAtTime(AMP_CURVE, now(0), CURVE_SECS);
}catch(e){
	OUTGAIN.cancelScheduledValues(now(0));
	OUTGAIN.setValueCurveAtTime(AMP_CURVE, now(0), CURVE_SECS);
}

	}
	else if (marr = s.match(/^([0-9])_$/)){
let vow = VOWELS[parseInt(marr[1])];
//log(vow[3]);
Main.innerHTML = vow[3];
f1.frequency.value=vow[0];
f2.frequency.value=vow[1];
f3.frequency.value=vow[2];

	}
}//»
this.onkeyup=(e)=>{//«
//	if (e.code=="Space") vol(0);
};//»
this.onkeypress=e=>{//«
};//»
this.onkill = function() {//«
	OUT.disconnect();
//	PLUG.disconnect();
}//»
this.onresize = function() {//«
}//»
this.onfocus=()=>{//«
}//»

this.onblur=()=>{//«
}//»

//»

}


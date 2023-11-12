
//System Configuration«

//Window Namespace«

window.__OS_NS__="System";
window[__OS_NS__]={apps:{}, mods:{}, api:{}, coms:{}};

//»

//Query string«
const qObj={};
let srch = window.location.search;
if (srch) {
	let rep_qarr = [];
	let nogo = ["set_branch"];
//	let nogo = ["set_branch", "delete_fs"];
	let didrep = false;
	let qarr = srch.slice(1).split("&");
	for (let i=0; i < qarr.length; i++) {
		let qelm = qarr[i].split("=");
		let key = qelm.shift();
		key = key.replace(/-/g,"_")
		let val = qelm.join("=");
		qObj[key] = val;
		if (nogo.indexOf(key) > -1) {didrep = true}
		else rep_qarr.push(qarr[i]);
	}
	if (didrep) {//«
		let userep = "";
		let q = "?"; 
		if (rep_qarr.length) userep = rep_qarr.join("&");
		if (!userep) q = ""; 
		window.history.pushState({newstate: 1}, "System", window.location.origin + window.location.pathname + q + userep);
	}//»
}//»

//FS«
const PROJECT_ROOT_MOUNT_NAME = "this";
const DEF_BRANCH_NAME="def";
const FS_PREF=DEF_BRANCH_NAME;
const FS_TYPE= "fs";
const MOUNT_TYPE= "mnt";

if (!localStorage.nextNodeId) localStorage.nextNodeId="1";

//»

//User«

const USERNAME = "me";
const CURRENT_USER = USERNAME;
const HOME_PATH = `/home/${USERNAME}`;
const DESK_PATH = `${HOME_PATH}/Desktop`;

//»

//Values/Strings«

const MAX_TEXTAREA_BYTES = 10000;

const DEF_EDITOR_MOD_NAME = "util.vim";
const DEF_PAGER_MOD_NAME = "util.less";

//»

//Apps/Extensions«

const APPLICATIONS_MENU=[
	"Text\xa0Editor","TextEdit",
	"Unicode\xa0Symbols", "util.Unicoder",
	"Your\xa0App\xa0Here", "YourApp",
	"Any\xa0Other", 0,
	"Apps\xa0Can", 0,
	"Go\xa0Here", 0,
];

const ALL_EXTENSIONS=[];
const TEXT_EXTENSIONS=[ "txt","js","json","css","sh"];
const MEDIA_EXTENSIONS=["webm","mp4","m4a","ogg","mp3"];
const IMAGE_EXTENSIONS=["jpg","gif","png","webp"];

const TERMINAL_APP = "Terminal";
const IMAGE_APP = "util.ImageView";
//const MEDIA_APP = "MediaPlayer";
const MEDIA_APP = "dev.VideoCutter";
const DEF_BIN_APP = "BinView";
const HTML_APP = "dev.HTML";
const TEXT_EDITOR_APP = "TextEdit";

const FOLDER_APP = "Folder";
const LINK_APP = "Link";
const TEXT_APP = "util.TextView";
const WRITING_APPS = [
	TEXT_EDITOR_APP
];
const VIEWONLY_APPS=[];

//File extensions/Unicode icons«
//Extension points to the array position above
let TE = TEXT_EDITOR_APP;
let IA = IMAGE_APP;
let MA = MEDIA_APP;
let AA = "games.Arcade";
const EXT_TO_APP_MAP={//«
	app:"Application",
	txt:TE,
	js:TE,
	json:TE,
	css:TE,
	sh:TE,
	jpg:IA,
	png:IA,
	gif:IA,
	webp:IA,
	webm:MA,
	mp4:MA,
	m4a:MA,
	ogg:MA,
	mp3:MA,
	html:HTML_APP,
	nes: AA,
	gb: AA
};
//»
for (let k in EXT_TO_APP_MAP) ALL_EXTENSIONS.push(k);
const ALL_EXTENSIONS_RE= new RegExp("^(.+)\\.(" + ALL_EXTENSIONS.join("|") + ")$");

/* Interesting Icons
Large kitchen knife 1f52a
*/
const APPICONS={//«
	Launcher:"1f680",
	HTML:"1f310",
	Folder:"1f4c1",
	TextEdit:"1f4dd",
	BinView:"1f51f",
	Terminal:"1f5b3",
	Arcade:"1f579",
	Unzip:"1f5dc",
	MediaPlayer:"1f3a6",
	ImageView:"1f304",
	Launcher:"1f680",
	Noisecraft:"1f3b9",
	VideoCutter: "1f4fd",//Film Projector
	Loader:"1f303"//
}//»
//»

//»

const isMobile = (()=>{//«
	const toMatch = [
		/Android/i,
		/webOS/i,
		/iPhone/i,
		/iPad/i,
		/iPod/i,
		/BlackBerry/i,
		/Windows Phone/i
	];
	return toMatch.some((toMatchItem) => {
		return navigator.userAgent.match(toMatchItem);
	});
})();//»

//Prevent default«

/*«
LEFT_A Navigate back
RIGHT_A Navigate forward
f_C Find text
s_C Save page
c_CS Focus developer console
k_C Search google in omnibar
p_C Popup print dialog
j_C Open downloads
e_A Open chrome menu (3 dots)
"/_" Firefox search page for text
»*/

const ALWAYS_PREVENT = [
	"LEFT_A",
	"e_C",
	"s_C",
	"f_C",
	"p_C"
];

//»

export const globals = {//«
	workers:{
//		faust: new Worker("/wasm/faust.js"),
	},
	qObj,
	NS: window[__OS_NS__],
	isMobile,
	isFox: navigator.userAgent.match(/Firefox/),
	FS_PREF,
	FS_TYPE,
	MOUNT_TYPE,

	nextNodeId: parseInt(localStorage.nextNodeId),

	USERNAME,
	CURRENT_USER,
	HOME_PATH,
	DESK_PATH,

	PROJECT_ROOT_MOUNT_NAME,
	APPLICATIONS_MENU,

	LINK_APP,
	FOLDER_APP,
	TEXT_APP,
	TERMINAL_APP,
	MEDIA_APP,
	IMAGE_APP,
	APPICONS,
	TEXT_EDITOR_APP,
	DEF_BIN_APP,
	WRITING_APPS,
	VIEWONLY_APPS,

	DEF_EDITOR_MOD_NAME,
	DEF_PAGER_MOD_NAME,

	TEXT_EXTENSIONS,
	MEDIA_EXTENSIONS,
	IMAGE_EXTENSIONS,
	ALL_EXTENSIONS,
	ALL_EXTENSIONS_RE,
	EXT_TO_APP_MAP,

	MAX_TEXTAREA_BYTES,

	ALWAYS_PREVENT,
	shell_libs: {}

};//»

export const NS = window[__OS_NS__];

//»


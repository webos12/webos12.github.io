//Imports«

import { util, api as capi } from "util";
import { globals } from "config";
const{log,cwarn,cerr, make}=util;

const{NS, MAX_TEXTAREA_BYTES}=globals;
const wdg = NS.api.widgets;
const {poperr, popup} = wdg;
const fsapi=NS.api.fs;

//»

export const app = function(Win, Desk) {

//Imports«

//const {Core, Main, NS}=arg;

//const topwin = Main.top;

let main = Win.main;
let win = Win;
let topwin = win;

const statbar = topwin.status_bar;

//»

//Var«

let view_only = Win.viewOnly;
let nosave = true;
const EXTENSIONS=[
	'txt', 
	'js', 
	'json', 
	'app', 
	'html', 
	'css',
	'sh'
];

let USE_EXT = 0;

let thisobj = this;
let yes_cb, no_cb;
let popdiv;
let current_bytes;
let modified = false;
let focused = false;

//»

//DOM«

let area = make('textarea');
area.id = `textarea_${Win.id}`;
//area.style.caretShape="block";

win.area = area;

win._over="hidden";
main._over="hidden";
area._bgcol="#211";
area._tcol="#EEEEEE";
area._bor="1px solid #322";

area.style.resize = "none";
area._ff="monospace";
area._fs=20;
area._fw=600;
main._tcol="black";
area._w="100%";
area._h="100%";
area.win = win;
area.style.outline = "none";
main.area = area;
win.area = area;
main._add(area);
//»

const save_context_cb = async()=>{//«

if (view_only) return poperr("The file is in 'read only' mode");
if (globals.read_only) return poperr("Cannot save in 'read only' mode");

let rv;
if (topwin.icon){
	let rv = await topwin.icon.node.setValue(area.value);
	if (rv && !Number.isFinite(rv.size)) poperr("Could not save the file");
	else{
		statbar.innerText = `${rv.size} bytes written`;
	}
	return;
}
else if (topwin.fullpath){
cwarn("Got topwin.fullpath but not topwin.icon!!!");
	let rv = await fsapi.writeFile(topwin.fullpath, area.value, {noMakeIcon: true});
	if (!rv) return poperr("Could not write the file");
	statbar.innerText = `${rv.size} bytes written`;
	return;
}

let ext = EXTENSIONS[USE_EXT];

let {path, name} = await Desk.api.saveAs(topwin, ext);
if (!path) return;
name = name.trim();
if (!name.match(/^[-._a-zA-Z0-9 ]+$/)){
	return poperr("Invalid name");
}
let fullpath = `${path}/${name}.${ext}`;

if (! await fsapi.checkDirPerm(path)) return poperr(`${path}: permission denied`);
if (await fsapi.pathToNode(fullpath)) return poperr(`${fullpath}: Already exists`);

let node = await fsapi.writeFile(fullpath, area.value);
if (!node) return poperr("Could not write the file");

statbar.innerText = `${node.size} bytes written`;
Win.name = name;
Win.path = path;
Win.ext = ext;
Win.title = name;
Win.icon=undefined;
delete Win.icon;
Win.cur_save_folder = null;
node.lockFile();
Win.node = node;

}//»
const open_new_window=()=>{Desk.open_app(Win.appName, {force: true})};

//OBJ/CB«

this.overrides = {//«
	's_A': 1,
	'b_CAS': 1
};//»
this.onfocus = ()=>{//«
//	if (view_only) return;
	if (topwin.cur_save_folder){
		setTimeout(()=>{
			if(topwin.cur_save_folder) topwin.cur_save_folder.on();
		},10);
		return;
	}
	if (modified) return;
	focused = true;
	if (win.area) {
		win.area.focus();
	}
}//»
this.onblur = ()=>{//«
//	if (view_only) return;
	if (modified) return;
	focused = false;
	if (win.area) {
//		win.area.disabled = true;
		win.area.blur();
	}
}
//»
this.onloadfile=(bytes, opts={})=>{//«
	if (!bytes) return;
	if (bytes.length > MAX_TEXTAREA_BYTES){
		opts.viewOnly = true;
		popup(`View only (file size clamped to MAX_TEXTAREA_BYTES=${MAX_TEXTAREA_BYTES}).`);
		bytes = bytes.slice(0, MAX_TEXTAREA_BYTES);
setTimeout(()=>{
if (!(Win.icon && Win.icon.node)){
cwarn("NO Win.icon && Win.icon.node after 250ms setTimeout???");
return;
}
	Win.icon.node.unlockFile();
}, 250);
	}
    let text = capi.bytesToStr(bytes);
	area.value = text;
	if (view_only || opts.viewOnly) {
		view_only = true;
//		area.disabled = true;
	}
	area.setSelectionRange(0,0);
}
//»
this.onescape=()=>{//«
	if (area.selectionStart!==area.selectionEnd) {
		area.selectionEnd = area.selectionStart;
		return true;
	}
};//»
this.onkeydown=(e,k)=>{//«
	if (k=="s_C"){
		save_context_cb();
	}
	else if (k=="TAB_"){
		e.preventDefault();
		if (area.selectionStart===area.selectionEnd) area.setRangeText("\x09",area.selectionStart,area.selectionStart,'end');
	}
	else if (k=="w_A") open_new_window();
};//»
this.get_context = ()=>{//«
//	if (view_only) return [];
	area.blur();
	let as="";
	if (!topwin.fullpath) as = "\xa0as...";
//	let use_save = view_only ? undefined : save_context_cb;
	let arr = ["New::Alt+w", open_new_window, `Save${as}::Ctrl+s`, save_context_cb]
	if (!topwin.fullpath){
		arr.push("Set\xa0file\xa0extension");
		let ext_func_arr=[];
		for (let i=0; i < EXTENSIONS.length; i++){
			if (i===USE_EXT) continue;
			ext_func_arr.push(EXTENSIONS[i],()=>{USE_EXT = i;});
		}
		arr.push(ext_func_arr);
		arr.push(`Current\xa0Ext:\xa0${EXTENSIONS[USE_EXT]}`,null);
	}
	return arr;
};//»

//»

}




//@GDUJNBROPI: Instead of trying to create a theoretically beautiful shell.execute algorithm, I 
/*«wanted to instead provide explicit commentary on the one that should hopefully "just work"

Support for: 
- parsing long and short options
- single quote escaping via '$': echo $'1\n2\n3'
- escaping spaces: touch some\ file.txt
- environment variable setting and substitution
- redirects: '>', '>>'
- pipelines
- file globbing
- curly brace expansion: touch file{1..10}.txt
- backquote command substitution

Bottom line:
For anything that doesn't quite work, try to get it to work without creating too much confusion
in the code or breaking any functionality that is more worthy

»*/

/*Very dumbhack to implement cancellations of hanging commands, e.g. that might do fetching,«
so that no output from a cancelled command is sent to the terminal, although
whatever the command might be doing to keep it busy is still happening, so it
is up to the shell user to be aware of what is going on behind the scenes:

In shell.execute("command --line -is here"), the first local variable that is
set is started_time (@WIMNNUYDKL).

There is a global cancelled_time that is set when we do a Ctrl+c when the shell is busy.

Immediately after every 'await' in shell.execute(), we do the following check:

if (started_time < cancelled_time) return;

»*/

//Development mod deleting«

const DEL_MODS=[
//	"util.vim",
	"util.dev.nano",
//	"webmparser"
//	"pager"
];
const DEL_COMS=[
	"fs"
];
//»
let PARAGRAPH_SELECT_MODE = true; //Toggle with Ctrl+Alt+p«
/*
When using the text editor, we have to manually insert line breaks inside of paragraphs
at the end of every line:

-------------------------------------
These are a bunch of words that I'm   
writing, so I can seem very
literate, and this is a crazily-
hyphenated-word!

Here comes another paragraph...
-------------------------------------

With PARAGRAPH_SELECT_MODE turned on, the system clipboard will contain the following
text upon executing the do_copy_buffer command with Cltr+Alt+a (a_CA).

-------------------------------------
These are a bunch of words that I'm writing, so I can seem very literate, and this is a crazily-hyphenated-word!

Here comes another paragraph...
-------------------------------------

The actual line buffer in the editor is left unchanged. This is just a convenience function
to allow for seamless copying between the editor and web-like applications that handle their 
own formatting of paragraphs.

Toggling of PARAGRAPH_SELECT_MODE is now done with Ctrl+Alt+p (p_CA).

»*/

//Imports«

import { util, api as capi } from "util";
import { globals } from "config";
const{strnum, isarr, isstr, isnum, isobj, make, KC, kc, log, jlog, cwarn, cerr}=util;
const{NS, TEXT_EDITOR_APP, LINK_APP, FOLDER_APP,FS_TYPE,MOUNT_TYPE,fs, isMobile, shell_libs, dev_mode}=globals;
const fsapi = fs.api;
const widgets = NS.api.widgets;
const {normPath}=capi;
const {pathToNode}=fsapi;

const HISTORY_FOLDER = `${globals.HOME_PATH}/.history`;
const HISTORY_PATH = `${HISTORY_FOLDER}/shell.txt`;
const LEFT_KEYCODE = KC.LEFT;

//»

//Shell«

let cancelled_time=0;

let ALLOW_REDIRECT_CLOBBER = false;
//Var«

const FS_COMS=[//«
	"_purge",
	"_clearstorage",
	"_blobs",
	"wc",
	"grep",
	"dl",
	"less",
	"cat",
	"mkdir",
	"rmdir",
	"mv",
	"cp",
	"rm",
	"symln",
	"ln",
	"vim",
	"touch",
	"mount",
	"unmount",
];//»

const ALL_LIBS={fs: FS_COMS};

const ASSIGN_RE = /^([_a-zA-Z][_a-zA-Z0-9]*(\[[_a-zA-Z0-9]+\])?)=(.*)/;

const ALIASES={
	c: "clear",
	la: "ls -a"
//	ai: "appicon"
};

//Maximum length of a line entered into the terminal (including lines in scripts)
const MAX_LINE_LEN = 256;

//To allow writing of files even if there is an external lock on it, change this to true
//const allow_write_locked = false;

const NOOP=()=>{return TERM_ERR;};
const TERM_OK = 0;
const TERM_ERR = 1;

const DIRECTORY_TYPE = "d";
const LINK_TYPE = "l";
const BAD_LINK_TYPE = "b";

//»

//Helper funcs«

const NO_SET_ENV_VARS = ["USER"];

const get_options = (args, com, opts={}) => {//«
	const getlong = opt => {
		let re = new RegExp("^" + opt);
		let numhits = 0;
		let okkey;
		for (let k of lkeys) {
			if (re.exec(k)) {
				numhits++;
				okkey = k;
			}
		}
		if (!numhits) {
			err.push(`${com}: invalid option: '${opt}'`);
			return null;
		} else if (numhits == 1) return okkey;
		else {
			err.push(`${com}: option: '${opt}' has multiple hits`);
			return null;
		}
	};
	let err = [];
	let sopts = opts.SHORT || opts.s;
	let lopts = opts.LONG || opts.l;
	let getall = opts.ALL;
//	let getall = true;
	let obj = {};
	let arg_start = null;
	let arg_end = null;
	let arg1, arg2;
	let marr;
	let ch;
	let ret;
	if (!sopts) sopts = {};
	if (!lopts) lopts = {};
	let lkeys = Object.keys(lopts);
	for (let i = 0; i < args.length;) {
		if (isobj(args[i])) {
			i++;
			continue;
		}
		if (args[i].toString() == "--") {
			args.splice(i, 1);
			return [obj, err];
		}
		else if (marr = args[i].match(/^-([a-zA-Z][a-zA-Z]+)$/)) {
			let arr = marr[1].split("");
			for (let j = 0; j < arr.length; j++) {
				ch = arr[j];
//				if (sopts[ch] === 2 || sopts[ch] === 3) {
				if (!getall && (sopts[ch] === 2 || sopts[ch] === 3)) {
					if (i === 0) obj[ch] = arr.slice(1).join("");
					else err.push(`${com}: option: '${ch}' requires args`);
				}
				else if (getall || sopts[ch] === 1) obj[ch] = true;
				else if (!sopts[ch]) err.push(`${com}: invalid option: '${ch}'`);
				else err.push(`${com}: option: '${ch}' has an invalid option definition: ${sopts[ch]}`);
			}
			args.splice(i, 1);
		}
		else if (marr = args[i].match(/^-([a-zA-Z])$/)) {
			ch = marr[1];
			if (getall){
				if (!args[i + 1]) err.push(`${com}: option: '${ch}' requires an arg`);
				obj[ch] = args[i + 1];
				args.splice(i, 2);
			}
			else if (!sopts[ch]) {
				err.push(`${com}: invalid option: '${ch}'`);
				args.splice(i, 1);
			} else if (sopts[ch] === 1) {
				obj[ch] = true;
				args.splice(i, 1);
			} else if (sopts[ch] === 2) {
				err.push(`${com}: option: '${ch}' is an optional arg`);
				args.splice(i, 1);
			} else if (sopts[ch] === 3) {
				if (!args[i + 1]) err.push(`${com}: option: '${ch}' requires an arg`);
				obj[ch] = args[i + 1];
				args.splice(i, 2);
			} else {
				err.push(`${com}: option: '${ch}' has an invalid option definition: ${sopts[ch]}`);
				args.splice(i, 1);
			}
		} else if (marr = args[i].match(/^--([a-zA-Z][-a-zA-Z]+)=(.+)$/)) {
			if (getall || (ret = getlong(marr[1]))) {
				if (getall) ret = marr[1];
				obj[ret] = marr[2];
			}
			args.splice(i, 1);
		} else if (marr = args[i].match(/^--([a-zA-Z][-a-zA-Z]+)=$/)) {
			if (getall || (ret = getlong(marr[1]))) {
				if (getall) ret = marr[1];
				obj[ret] = args[i + 1];
				if (args[i + 1]) args.splice(i + 1, 2);
				else args.splice(i, 1);
			} else args.splice(i, 1);
		} else if (marr = args[i].match(/^--([a-zA-Z][-a-zA-Z]+)$/)) {
			if (getall || (ret = getlong(marr[1]))) {
				if (getall) ret = marr[1];
				if (getall || (lopts[marr[1]] === 1 || lopts[marr[1]] === 2)) obj[ret] = true;
				else if (lopts[marr[1]] === 3) err.push(`${com}: long option: '${marr[1]}' requires an arg"`);
				else if (lopts[marr[1]]) err.push(`${com}: long option: '${marr[1]}' has an invalid option definition: ${lopts[marr[1]]}`);
				else if (!lopts[marr[1]]) err.push(`${com}: invalid long option: '${marr[1]}`);
				args.splice(i, 1);
			} else args.splice(i, 1);
		} 
		else if (marr = args[i].match(/^(---+[a-zA-Z][-a-zA-Z]+)$/)) {
			err.push(`${com}: invalid option: '${marr[1]}'`);
			args.splice(i, 1);
		}
		else i++;
	}
	return [obj, err];
}//»
const add_to_env=(arr, env, opts)=>{//«
	let {term, if_export} = opts;
	let marr;
	let use;
	let err = [];
	use = arr[0];
	let assigns = {};
	while (use) {
		let which;
		const next=()=>{
			arr.shift();
			if (arr[0]===" ") arr.shift();
			use = arr[0];
		};
		marr = ASSIGN_RE.exec(use);
		if (!marr){
			if (!if_export) break;
			else{
				err.push(`sh: '${use}': not a valid identifier`);
				next();
				continue;
			}
		}
		which = marr[1];
		if (NO_SET_ENV_VARS.includes(which)){
			err.push(`${which}: cannot set the constant environment variable`);
			next();
			continue;
		}
		assigns[which]=marr[3];
//		env[which]=marr[3];
		next();
	}
if (!arr.length && !if_export){
env = term.ENV;
}
for (let k in assigns){
env[k]=assigns[k];
}

	return err;
};//»
const term_error=(term, arg)=>{//«
//	if (isstr(arg)) arg = term.fmt2(arg);
	term.response(arg);
};//»
const term_out=(term, arg)=>{//«
	if (isstr(arg)) arg = term.fmt(arg);
	term.response(arg);
};//»
const write_to_redir=async(term, str, redir, env)=>{//«
	let op = redir.shift();
	let fname = redir.shift();
	if (!fname) return {err:`Missing operand to the redirection operator`};
	let fullpath = normPath(fname, term.cur_dir);
	let node = await fsapi.pathToNode(fullpath);
	if (node && node.type == FS_TYPE && op===">" && !ALLOW_REDIRECT_CLOBBER) {
		if (env.CLOBBER_OK==="true"){}
		else return {err: `Not clobbering the file (ALLOW_REDIRECT_CLOBBER==${ALLOW_REDIRECT_CLOBBER})`};
	}
	if (node && node.write_locked()){
		return {err:`${fname}: the file is "write locked" (${node.write_locked()})`};
	}

	let patharr = fullpath.split("/");
	patharr.pop();
	let parpath = patharr.join("/");
	if (!parpath) return {err:`${fname}: Permission denied`};
	let parnode = await fsapi.pathToNode(parpath);
	let typ = parnode.type;
	if (!(parnode&&parnode.appName===FOLDER_APP&&(typ===FS_TYPE||typ=="dev"))) return {err:`${fname}: Invalid or unsupported path`};
	if (typ===FS_TYPE && !await fsapi.checkDirPerm(parnode)) {
		return {err:`${fname}: Permission denied`};
	}
	if (!await fsapi.writeFile(fullpath, str, {append: op===">>"})) return {err:`${fname}: Could not write to the file`};
	return {};
};//»
const curly_expansion = (word) => {//«
	let marr;
	let out = false;
	if (marr = (word.match(/(.*){(\d+)\.\.(\d+)}(.*)/) ||word.match(/(.*){([a-z])\.\.([a-z])}(.*)/)||word.match(/(.*){([A-Z])\.\.([A-Z])}(.*)/))){
		out = [];
		let is_num;
		let from, to;
		if (marr[2].match(/\d/)){
			is_num = true;
			from = parseInt(marr[2]);
			to = parseInt(marr[3]);
		}
		else {
			from = marr[2].charCodeAt();
			to = marr[3].charCodeAt();
		}
		let pre = marr[1];
		let post = marr[4];
		let inc;
		if (from > to)inc=-1;
		else inc = 1;
		if (from <= to) {
			for (let i = from; i <= to; i++){
				let ch;
				if (is_num) ch = i;
				else ch = String.fromCharCode(i);
				out.push(`${pre}${ch}${post}`);
			}
		}
		else{
			for (let i = from; i >= to; i--){
				let ch;
				if (is_num) ch = i;
				else ch = String.fromCharCode(i);
				out.push(`${pre}${ch}${post}`);
			}
		}

	}
	return out;
}//»
const all_expansions=async(arr, term)=>{//«
	let {ENV, cur_dir} = term;
	let err;
	for (let i=0; i < arr.length; i++){
		let word = arr[i].word;
		if (!word) continue;
		let marr;
		let rv;
		let use_cur_dir = cur_dir;
		let say_path = "";
		if (i>0 && arr[i-1].ds=="$") {
			let got = ENV[word];
			if (!got) arr.splice(i-1, 2);
			else{
				arr[i-1] = {t:"word",word: got};
				arr.splice(i, 1);
			}
		}
		else if (word.match(/[*?]/)||word.match(/\[[-0-9a-z]+\]/i)) {
			if (word.match(/\x2f/)){
				let path_arr = word.split("/");
				if (word.match(/^\x2f/)) {
					path_arr.shift();
					word = path_arr.pop();
					say_path = "/"+path_arr.join("/");
					use_cur_dir = say_path;
				}
				else if (path_arr.length && path_arr[0]) {
					word = path_arr.pop();
					use_cur_dir = normPath(path_arr.join("/"), cur_dir);
					say_path = path_arr.join("/");
				}
			}
			let fpat = word.replace(/\*/g, ".*").replace(/\?/g, ".");
			let re;
			try{ 
				re = new RegExp("^" + fpat + "$");
			}
			catch(e){
				err = e.message;
				continue;
			}
			let dir = await pathToNode(use_cur_dir);
			if (!dir) continue;
			if (!dir.done) await fsapi.popDir(dir);
			let kids = dir.kids;
			let keys = Object.keys(kids);
			let did_splice = false;
			for (let k of keys){
				if (k=="."||k=="..") continue;
				if (re.test(k)) {
					if (!did_splice) {
						arr.splice(i, 1);
						i--;
						did_splice = true;
					}
					if (say_path && !say_path.match(/\x2f$/)) say_path = `${say_path}/`;
					arr.splice(i, 0, {t:"word", word: `${say_path}${k}`});
					i++;
				}
			}
		}
		else if (rv = curly_expansion(word)){
			const do_exp=(arr, out)=>{
				for (let wrd of arr){
					let rv = curly_expansion(wrd);
					if (rv) do_exp(rv, out);
					else out.push({t:"word", word: wrd});
				}
				return out;
			};
			try{
				let all = do_exp(rv, []);
				arr.splice(i, 1, ...all);
				i+=all.length-1;
			}catch(e){
cerr(e);
				err = `${e.message} (${word})`;
			}
		}
	}
	return err;
}//»

const get_file_lines_from_args=async(args, term)=>{//«
	let err = [];
	let out = [];
	const fullterr=(arg)=>{
		err.push(`${fullpath}: ${arg}`);
		return TERM_ERR;
	};
	let fullpath;
	while (args.length) {
		fullpath = normPath(args.shift(), term.cur_dir);
		let node = await fsapi.pathToNode(fullpath);
		if (!node) {
			fullterr(`No such file or directory`);
			continue;
		}
		let typ = node.type;
		if (typ==FS_TYPE) {
			if (!node.blobId) {
				continue;
			}
		}
		else if (typ==MOUNT_TYPE){
		}
		else{
	cwarn(`Skipping: ${fullpath} (type=${typ})`);
			continue;
		}

		if (node.appName === FOLDER_APP) {
			fullterr(`Is a directory`);
			continue;
		}
		let val = await node.text;
		if (!isstr(val)) {
			fullterr("An unexpected value was returned");
			continue;
		}
		let arr = val.split("\n");
		for (let ln of arr) out.push(ln);
	}
	return {err, out};
};//»

//»

//Builtin commands«

//Command functions«

/*
const com_ = async(args, opts)=>{
};
*/

const com_test = async(args, opts)=>{//«
	const sleep = (ms)=>{
		if (!Number.isFinite(ms)) ms = 0;
		return new Promise((Y,N)=>{
			setTimeout(Y, ms);
		});
	};
	let ms = parseInt(args.shift());
	if (!Number.isFinite(ms)) ms = 0;
	const {term} = opts;
	term.response(`Sleeping for: ${ms}`);
	term.refresh();
	await sleep(ms);
};//»

const com_export = async(args, opts)=>{return {err: add_to_env(args, opts.term.ENV, {if_export: true})};};
const com_hist=(args, opts)=>{return {out: opts.term.get_history()};};
const com_clear=(args, opts)=>{opts.term.clear();};
const com_pwd=(args, opts)=>{return {out: opts.term.cur_dir};};
const com_echo = async (args, opts) => {return {out: args.join(" ").split("\n")};};
const com_import=async(args, opts)=>{//«
	let {term}=opts;
	let err = [];
	const terr=(arg)=>{err.push(arg);};
	for (let arg of args){
		if (NS.coms[arg]) {
			terr(`${arg}: Already loaded`);
			continue;
		}   
		try{
			let modpath = arg.replace(/\./g,"/");
			const coms = (await import(`/mods/coms/${modpath}.js`)).coms;
			NS.coms[arg] = coms;
			let iter=0;
			for (let com in coms){
				if (shell_commands[com]){
					terr(`${com}: already exists`);
					continue;
				}   
				shell_commands[com] = coms[com];
				iter++;
			}
			terr(`imported ${iter} commands from '${arg}'`);
			BUILTINS = shell_commands._keys;
		}catch(e){
			terr(`${arg}: Error importing the module`);
cerr(e);
		}
	}
	return {err};
};//»
const com_help = async(args, opts)=>{//«
	let help = globals.shell_help;
	if (!help){
		try{
			help = (await import("shell_help")).help_text;
		}catch(e){
			return {err: "Could not load the help module"};
		}
		globals.shell_help = help;
	}
	let out = [];
	let nargs = args.length;
	if (!args.length) args = ["help"];
	while (args.length){
		if (out.length) out.push("");
		let which = args.shift();
		if (nargs > 1) out.push(`${which}:`);
		let txt = help[which];
		if (!txt) out.push("not found");
		else out.push(...txt.split("\n"));
	}
	return {out, pretty: true};
};//»
const com_ls = async (args, o) => {//«
	const send_out=s=>{
		if (inpipe) out.push(s);
		else out.push(...term.fmt(s));
	};
	if (!args.length) args.push("./");
	let err = [];
	let out = [];
	let colors = [];
	let {inpipe, term, add_rows, opts={}} = o;
	let nargs = args.length;
	let dir_was_last = false;
	let all = opts.all||opts.a;
	let recur = opts.recursive || opts.R;
	const do_path = async(node_or_path)=>{
		let node;
		let wants_dir;
		let path;
		let regpath;
		if (isstr(node_or_path)){
			path = node_or_path;
			wants_dir = node_or_path.match(/\x2f$/);
			regpath = normPath(node_or_path, term.cur_dir);
			node = await fsapi.pathToNode(regpath, !wants_dir);
		}
		else {
			node = node_or_path;
			regpath = path = node.fullpath;
		}
		let recur_dirs;
		if (recur) recur_dirs = [];
		if (!node) {
			dir_was_last = false;
			err.push(`${regpath}: No such file or directory`);
			return;
		}
		if (node.appName !== FOLDER_APP) {
			if (wants_dir) {
				err.push(`${regpath}: Not a directory`);
				return;
			}
			if (dir_was_last) out.push("");
			dir_was_last = false;
			if (node.appName==LINK_APP){
				send_out(`${node.name} -> ${node.symLink}`);
				return;
			}
			let sz = "?";
			if (node.type === FS_TYPE) {
				let file = await node._file;
				if (file) sz = file.size;
			}
			else if (Number.isFinite(node.size)) sz = node.size;
			send_out(`${node.name} ${sz}`);
			return;
		}
		if (!node.done) await fsapi.popDir(node);
		dir_was_last = true;
		let kids = node.kids;
		let arr = kids._keys;
		let names=[];
		let lens = [];
		let types = [];
		if (out.length && nargs > 1 || recur) out.push("");
		if (nargs > 1 || recur) send_out(`${path}:`);
		let s = "";
		let dir_arr = [];
		for (let nm of arr){
			if (!all) {
				if (nm=="."||nm=="..") continue;
				if (nm.match(/^\./)) continue;
			}
			if (inpipe) out.push(nm);
			dir_arr.push(nm);
		}
		if (recur){
			for (let nm of dir_arr){
				let n = kids[nm];
				if (nm=="."||nm=="..") continue;
				if (n.appName === FOLDER_APP) recur_dirs.push(n);
			}
		}
		dir_arr = dir_arr.sort();
		if (inpipe) {
			out.push(...dir_arr);
		}
		else {//«
			for (let nm of dir_arr){
				let n = kids[nm];
				let add=0;
				if (nm.match(/\x20/)){
					nm=`'${nm}'`;
				}
				if (n.appName===FOLDER_APP) {
					nm=`${nm}`;
					types.push(DIRECTORY_TYPE);
				}
				else if (n.appName==="Link") {
					nm = `${nm}`;
					if (!await n.ref) types.push(BAD_LINK_TYPE);
					else types.push(LINK_TYPE);
				}
				else types.push(null);
			}
			let name_lens = [];
			for (let nm of dir_arr) name_lens.push(nm.length);
			let ret = [];
			term.fmt_ls(dir_arr, name_lens, ret, types, colors, out.length+err.length+add_rows);
			out.push(...ret);
		}//»
		if (recur) {
			for (let dir of recur_dirs) await do_path(dir);
		}
	};
	while (args.length) {
		await do_path(args.shift());
	}
	return {err, out, didFmt: true, colors};
};
//»
const com_cd = async (args, opts) => {//«
	const e=s=>{return {err: [s]}}
	let res;
	let got_dir, dir_str, dirobj;
	let {term}=opts;
	const cd_end = () => {
		if (!got_dir.match(/^\x2f/)) got_dir = `/${got_dir}`;
		term.cur_dir = got_dir;
	};
	if (!args.length) {
		got_dir = term.get_homedir();
		cd_end();
		return TERM_OK;
	}
	let saypath = args[0];
	let regpath = normPath(saypath, term.cur_dir);
	let ret = await fsapi.pathToNode(regpath);
	if (!ret) {
		return e(`${saypath}: No such file or directory`);
	}
	if (ret.appName != FOLDER_APP) {
		return e(`${saypath}: Not a directory`);
	}
	got_dir = regpath;
	cd_end();

};//»
const com_env = async (args, opts) => {//«
	if (args.length) return {err:"Arguments are not supported"};
	let {term}=opts; 
	let env = term.ENV;
	let keys = env._keys;
	let out = [];
	for (let key of keys){
		let val = env[key];
		out.push(`${key}=${val}`);
	}
	return {out};
};//»
const com_app = async (args, opts) => {//«
	let {term}=opts; 
	let err = [];
	const terr=(arg)=>{
		err.push(arg);
	};
	let list = await capi.getAppList();
	if (!args.length) return {out: list};
	for (let appname of args){
		if (!list.includes(appname)) {
			err.push(`${appname}: app not found`);
			continue;
		}
		term.Desk.api.openApp(appname);
	}
	return {err};
};//»
const com_appicon=async(args, opts)=>{//«
	if (!args.length) return {out: await capi.getAppList()};
	return {out: JSON.stringify({app: args.shift()})};
};//»
const com_open = async (args, opts) => {//«
	let {term}=opts; 
	let err = [];
	const terr=(arg)=>{err.push(arg);};
	if (!args.length) {
		terr(`open: missing operand`);
		return {err};
	}
	for (let path of args) {
		let fullpath = normPath(path, term.cur_dir);
		let node = await fsapi.pathToNode(fullpath);
		if (!node) {
			terr(`${path}: No such file or directory`);
			continue;
		}
		term.Desk.open_file_by_path(node.fullpath);
	}
	return {err};
};//»
const com_epoch=()=>{return {out:Math.round((new Date).getTime()/1000)+""};};
const com_nano= async (args,o)=>{//«
	let {term, opts, stdin} = o;
	let rv;
	let iter=0;
	let modname = "util.dev.nano";
	let node;
	let fullpath;
	let path = args.shift();
	do{
		let val = "";
		if (path) {
			fullpath = normPath(path, term.cur_dir);
			node = await fsapi.pathToNode(fullpath);
			if (!node) return {err: `${path}: not found`}
			val = await node.getValue({text:true});
		}
		if (iter) {
cwarn(iter);
			let scr = document.getElementById(`script_mods.${modname}`);
			if (scr) scr._del();
			delete NS.mods[modname];
			NS.mods[modname]=undefined;
		}
		if (!await capi.loadMod(modname)) return {err:"Could not load blah"};
		let blah = new NS.mods[modname](term);
		rv = await blah.init(val, name, {node, opts});
		iter++;
	} while (rv==="RELOAD");
	if (rv) return {err: rv};
};//»

//»

const command_options={//«
	ls: {
		s: {
			a: 1,
			l: 1,
//			r: 1,
			R: 1
		},
		l: {
			long: 1,
			all: 1,
			recursive: 1
		}
	},
	rm: {
		s:{
			r:1, R:1
		},
		l:{
			recursive: 1
		}
	},
	vim:{
		l:{parsel: 1, "convert-markers":1}
	},
	nano:{
		l:{"convert-markers":1}
	},
	
	less:{
		l:{parsel: 1}
	},
	dl:{
		s: {n: 3,},
		l: {name: 2}
	}
};//»

const shell_commands={//«
nano: com_nano,
epoch: com_epoch,
hist: com_hist,
help: com_help,
export: com_export,
pwd: com_pwd,
clear: com_clear,
cd:com_cd,
ls:com_ls,
echo:com_echo,
env:com_env,
app:com_app,
appicon:com_appicon,
open:com_open,
};
if (dev_mode){

shell_commands.test = com_test;

}


for (let coms in NS.coms){
	for (let com in coms){
		if (!shell_commands[com]){
			shell_commands[com] = coms[com];
			continue;
		}
	}
}

//»
for (let k in ALL_LIBS){
	let arr = ALL_LIBS[k];
	for (let com of arr) shell_commands[com]=k;
}

let BUILTINS = shell_commands._keys;


//»

//Shell object«

const Shell = function(term){

//Var«
const CONTROL_WORDS = ["if", "then", "elif", "else", "fi", "do", "while", "until", "for", "in", "done", "select", "case", "esac"];
const terr=(arg, if_script)=>{//«
//	if (isstr(arg)) arg = term.fmt([arg]);
	term.response(arg);
	if (!if_script) term.response_end();
};//»
//»
//Funcs«

const execute_file=async (comword, cur_dir, env)=>{//«

	const e=s=>{
		return `sh: ${comword}: ${s}`;
	};
	let node = await fsapi.pathToNode(normPath(comword, cur_dir));
	if (!node) return e(`not found`);
	let app = node.appName;
	if (app===FOLDER_APP) return e("is a directory");
	if (app!==TEXT_EDITOR_APP) return e("not a text file");
	if (!comword.match(/\.sh$/i)){
		return e(`only executing files with '.sh' extension`);
	}
	let text = await node.text;
	if (!text) return e("no text returned");
	let rv;
	let lines = text.split("\n");
	let out = [];
	for (let ln of lines){
		let com = ln.trim();
		if (!com) continue;
		await this.execute(com, {script_out: out, env});
	}
	return out;
};//»

//»

//Parse«

//Var«
const shell_metas = [" ", "\t", "|", "&", ";", "(", ")", "<", ">"];
const shell_c_op = [";;&", "||", "&&", ";;", ";&", "|&", "((", "&", ";", "|", "(", ")"];
const shell_r_op = ["<<<", "&>>", "<>", ">>", "<<", "<&", "&>", ">&", ">", "<"];
//»

const shell_escapes = line_arr => {//«
	for (let i = 0; i < line_arr.length; i++) {
		let arr = line_arr[i].split("");
		for (let j = 0; j < arr.length; j++) {
			if (arr[j] == "\\") {
				if (arr[j + 1]) {
					let obj = {
						"t": "esc",
						"esc": arr[j + 1]
					};
					arr[j] = obj;
					arr.splice(j + 1, 1);
					j--;
				}
			}
		}
		line_arr[i] = arr;
	}
	return line_arr;
};//»
const shell_quote_strings = (line_arr) => {//«
	let qtype = null;
	let qarr = [];
	let orig_line_num;
	let orig_pos;
	let ds = null;
	OUTERLOOP: for (let i = 0; i < line_arr.length; i++) {
		let arr = line_arr[i];
		for (let j = 0; j < arr.length; j++) {
			let chneg1 = arr[j - 1];
			let ch = arr[j];
			let ch2 = arr[j + 1];
			let ch3 = arr[j + 2];
			if (!qtype && ((((ch == '"' || ch == "'" || ch == "\x60") || (ch == "<" && ch2 == "<" && ch3 && ch3 != "<" && (j == 0 || (j > 0 && chneg1 != "<"))))))) {
				if (ch == "<") return "sh: heredocs are not implemented";
				qtype = ch;
				orig_line_num = i;
				if (arr[j - 1] == "$") {
					if (ch == "'") {
						arr.splice(j - 1, 1);
						ds = true;
						j--;
					} else if (ch == '"') {
						arr.splice(j - 1, 1);
						j--;
					}
				}
				orig_pos = j;
			} else if (qtype) {
				if (ch == qtype || (!ds && qtype == "'" && ch.esc == "'")) {
					if (ch.esc == "'") qarr.push("\\");
					else if (ch.esc === "\x60") qtype = "\x60";
					line_arr[orig_line_num].splice(orig_pos, 2, {
						t: 'quote',
						'$': ds,
						quote_t: qtype,
						quote: qarr
					});
					qtype = null;
					ds = null;
					qarr = [];
					if (i > orig_line_num) {
						let rem = arr.splice(j);
						for (let k = 1; k < rem.length; k++) line_arr[orig_line_num].push(rem[k]);
						line_arr.splice(i, 1);
						i = orig_line_num;
						arr = line_arr[i];
						j = orig_pos + j + 1;
					} else j -= 1;
				} else {
					if (!ds && qtype == "'" && ch.esc) {
						qarr.push("\\");
						qarr.push(ch.esc);
					} else if (ch.esc && (qtype == "\x60" || qtype == '"')) {
//There are no escapes in double quotes except $,\x60,and \
						if (ch.esc == "$" || ch.esc == "\x60" || ch.esc == "\\") qarr.push(ch);
						else {
							if (qtype == '"' && ch.esc != '"') {
								qarr.push("\\");
							} else if (qtype == "\x60" && ch.esc != "\x60") {
								qarr.push("\\");
							}
							qarr.push(ch.esc);
						}
					} else qarr.push(ch);
					arr.splice(j, 1);
					j--;
				}
			}
		}
		if (qtype) {
			qarr.push("\n");
			if (i > orig_line_num) {
				line_arr.splice(i, 1);
				i--;
			}
		}
	}
	if (qtype) return "Unterminated quote";
	else {
		let line = line_arr[line_arr.length - 1];
		let lasttok = line[line.length - 1];
		if (lasttok === "\\") return "Newline escapes are not implemented";
	}
	return line_arr;
};//»
const shell_tokify = line_arr => {//«
	let lnnum = 1;
	let wordnum = 0;
//	const badtok=(tok, num)=>{return `sh: unsupported token (${num}): '${tok}'`;};
	const badtok=(tok, num)=>{return `sh: unsupported token: '${tok}'`;};
	const mkword=(str)=>{return{t:"word",word:str,ln:lnnum,wn:(wordnum++)}};
	const mkrop=(str)=>{return{t:"r_op",r_op:str,ln:lnnum}};
	const mkds=(str)=>{return{t:"ds",ds:"$",ln:lnnum}};
//	const mknl=()=>{return{t:"c_op",c_op:"nl",nl:true,ln:lnnum};};
	const add_to_pipe=()=>{//«
		if (ret[0]===" ") ret.shift();
		if (ret[ret.length-1]==" ") ret.pop();
		pipe.push(ret);
		ret = [];
	};//»
	if (line_arr == null) return null;
	let ret = [];
	let pipe = [];
	let word = null;
	for (let i = 0; i < line_arr.length; i++) {
		let arr = line_arr[i];
		for (let j = 0; j < arr.length; j++) {
			let ch = arr[j];
			let ch1 = arr[j + 1];
			if (shell_metas.includes(ch)) {
				if (word) ret.push(mkword(word.join("")));
				if (ch == "\t" || ch == " ") {
					let usej = null;
					for (let k = j + 1;
						(arr[k] == " " || arr[k] == "\t"); k++) usej = k;
					if (usej) j = usej;
					ret.push(" ");
				} else {
					let next = arr[j + 1];
					if (next && shell_metas.includes(next)) {
						let comb = ch + next;
						if (shell_c_op.includes(comb)) {
							return badtok(comb, 1);
						}
						else if (shell_r_op.includes(comb)) {
							if (comb==">>") {
								ret.push(mkrop(comb));
								j++;
							}
							else return badtok(comb, 2);
						}
						else {
							if (ch===">"||ch==">>") ret.push(mkrop(ch));
							else if (ch=="|") add_to_pipe();
							else return badtok(ch, 3);
						}
					} 
					else {
						if (ch===">"||ch==">>") ret.push(mkrop(ch));
						else if (ch=="|") add_to_pipe();
						else return badtok(ch, 4);
					}
				}
				word = null;
			} 
			else {
				if (!word) {
//A word array isn't in effect
//					if (ch == "{" || ch == "}" || ch == ",") ret.push(mkword(ch));
					if (ch == "\n") ret.push(ch);
					else if (ch == "$") ret.push(mkds());
					else if (typeof(ch) == "string") word = [ch];
					else if (typeof(ch) == "object") ret.push(ch);
				} else if (ch == "$") {
					ret.push(mkword(word.join("")));
					word = null;
					ret.push(mkds());
				} else {
//					if (ch == "{" || ch == "}" || ch == ",") {
//						ret.push(mkword(word.join("")));
//						ret.push(mkword(ch));
//						word = null;
//					} 
					if (ch == "\n") {
						ret.push(mkword(word.join("")));
						ret.push(ch);
						word = null;
					} else if (ch.t == "esc") {
						if (ch.esc == "{" || ch.esc == "}" || ch.esc == ",") {
							ret.push(mkword(word.join("")));
							ret.push(ch);
							word = null;
						} else {
							ret.push(mkword(word.join("")));
							ret.push(ch);
							word = null;
						}
					} else if (typeof(ch) == "string" && ((ch != " " && ch != "(" && ch != ")"))) {
						word.push(ch);
					} else {
						ret.push(mkword(word.join("")));
						ret.push(ch);
						word = null;
					}
				}
			}
		}
		if (word) {
			let useword = word.join("");
			let pushnl = true;
			if (useword.match(/\\$/)) {
				useword = useword.replace(/\\$/, "");
				pushnl = null;
			}
			if (useword) ret.push(mkword(useword));
		} else {
		}
		word = null;
	}
	add_to_pipe();
	if (!pipe[pipe.length-1].length){
		return "Unterminated pipeline";
	}
	return pipe;
};//»

//»

//GDUJNBROPI

this.execute=async(command_str, opts={})=>{//«

//WIMNNUYDKL
let started_time = (new Date).getTime();

//Cancel test function
const can=()=>{return started_time < cancelled_time;};

let {script_out, env, addRows}=opts;
let rv;

//Where does the output go?
let redir;

//This is only used for pipeline commands that are after the first command
// cat somefile.txt | these | might | use | the | stdin | array
let stdin;

//This tells all commands with color output (currently just ls) the number of rows to add to the objects
//that at used in response() to add to line_colors[]
let add_rows = addRows || 0;

//Refuse and enter command that seems too long for our taste
if (command_str.length > MAX_LINE_LEN) return terr(`'${command_str.slice(0,10)} ...': line length > MAX_LINE_LEN(${MAX_LINE_LEN})`, script_out);

command_str = command_str.replace(/^ +/,"");

//Only for creating newlines in single quotes: $'1\n2' and escaping spaces outside of quotes
let arr = shell_escapes([command_str]);

//Makes quote objects from single, double and backtick quotes. Fails if not terminated
arr = shell_quote_strings(arr);
if (isstr(arr)) return terr(term.fmt(arr), script_out);

/*
This creates word objects and '$' objects.
It also creates '>' and '>>' redirections as well as pipelines.
All unsupported tokens (redirects like '<' and control like ';') cause failure
*/
let pipe = shell_tokify(arr);
if (isstr(pipe)) return terr(term.fmt(pipe), script_out);

while (pipe.length) {//«

	let arr = pipe.shift();
	let args=[];

/*
1) Environment variable substitution
2) File globbing '*', '?' and character ranges [a-zA-Z0-9]
3) Curly brace expansion:

$ echo file{0..3}.txt
file0.txt file1.txt file2.txt file3.txt
*/
	rv = await all_expansions(arr, term);
	if (can()) return;
	term.response(rv);
	let inpipe = pipe.length;

/*
- Turn quote objects into word objects
- Single quotes that start with '$' look for internal escapes (currently only newline)
- Backquotes are executed and replaced with the output
*/
	for (let i=0; i < arr.length; i++){//«
		let tok = arr[i];
		let typ = tok.t;
		let val = tok[typ];
		if (typ==="quote") { 
			let typ = tok.quote_t;
			let ds = tok['$'];
			let outstr='';
			for (let ch of val){
				if (isobj(ch)&&ch.t=="esc"){
					if (ch.esc=="n"&&typ=="'"&&ds) outstr+="\n";
					else outstr+=ch.esc;
				}
				else outstr+=ch;
			}
			val = outstr;
			if (typ=="\x60") {
				let out=[];
				add_rows = await this.execute(val, {script_out: out, env, addRows: add_rows});
				if (can()) return;
				if (isstr(out)) val = out;
				else if (isarr(out)&&out.length) val = out.join(" ");
				else val = "";
			}
			arr[i]={t:"word", word: val, from_quote: true};
		}
	}//»

/*
All sequences of non-whitespace separated quotes and words are concatenated:
~$ echo "q 1"A"q 2""q 3"B   "q 4"C"q       5"D"q 6"
q 1Aq 2q 3B q 4Cq       5Dq 6
*/
	for (let i=0; i < arr.length-1; i++){//«
		let tok0 = arr[i];
		let tok1 = arr[i+1];
		let have_quote = tok0.from_quote || tok1.from_quote;
		if (tok0.word && tok1.word && have_quote){
			arr[i] = {t: "word", word: `${tok0.word}${tok1.word}`, from_quote: true}
			arr.splice(i+1, 1);
			i--;
		}
	}//»

//Concatenate all sequences of escaped spaces and words
// ~$ touch this\ is\ cool.txt
	for (let i=0; i < arr.length-1; i++){//«
		let tok0 = arr[i];
		let tok1 = arr[i+1];
		if (tok0.esc === " " || tok1.esc === " "){
			arr[i] = {t: "word", word: `${tok0.word||" "}${tok1.word||" "}`, esc: tok1.esc}
			arr.splice(i+1, 1);
			i--;
		}
	}//»

/*
- Create redirection objects
- Objects are converted into strings ({t:"word", word: "blah"} -> "blah")
- Replace tilde with home path
*/
	for (let i=0; i < arr.length; i++){//«
		let tok = arr[i];
		let typ = tok.t;
		let val = tok[typ];
		if (tok===" "){
			continue;
		}
		if (typ==="r_op"){
			let rop = tok.r_op;
			if (!(rop==">"||rop==">>")) {
//				if (tok.r_op !== ">"&& tok._rop !== ">>"){
				return terr(`sh: unsupported operator: '${tok.r_op}'`, script_out);
			}
			if (redir) return terr("sh: already have a redirect", script_out);
			let tok2 = arr[i+1];
			if (!tok2) return terr("sh: syntax error near unexpected token `newline'");
			if (tok2.t == "quote") tok2={t: "word", word: tok2.quote.join("")}
			if (tok2==" ") {
				i++;
				tok2 = arr[i+1];
			}
			if (!(tok2 && tok2.t==="word")) return terr(`sh: invalid or missing redirection operand`, script_out);
			arr.splice(i+1, 1);
			val = null;
			redir = [tok.r_op, tok2.word];
		}
		if (val) {
			if (val.match(/^~/)){
				if (val==="~") val = globals.HOME_PATH;
				else if (val.match(/^~\x2f/)) val = globals.HOME_PATH+val.slice(1);
			}
			args.push(val);
		}
	}//»

	arr = args;

//Set environment variables (exports to terminal's environment if there is nothing left)
	rv = add_to_env(arr, env, {term});
	add_rows+=rv.length;
	term.response(rv);
	if (arr[0]==" ") arr.shift();

//Get the command. Immediately return if not found.
	let comword = arr.shift();
	if (!comword) {
		return terr("", script_out);
	}

//Replace with an alias if we can
	let alias = ALIASES[comword];
	if (alias){
		let ar = alias.split(/\x20+/);
		alias = ar.shift();
		if (ar.length){
			arr.unshift(...ar);
		}
	}
	let usecomword = alias||comword;
	let com = shell_commands[usecomword];

//If we have a string rather than a function, do the command library importing routine
	if (isstr(com)){//«
		let lib = shell_libs[com];
		if (!lib){
			try{
				let r = (Math.random()+"").slice(12);
				lib = (await import(`/mods/coms/${com}.js?v=${r}`)).coms;
				if (can()) return;
			}catch(e){
				if (can()) return;
cerr(e);
				terr(`sh: command library: '${com}' could not be loaded`);
				return ++add_rows;
			}
			shell_libs[com] = lib;
		}
		com = lib[usecomword];
	}//»

//Not found!
	if (!com) {//«
//If the user attempts to use, e.g. 'if', let them know that this isn't that kind of shell
		if (CONTROL_WORDS.includes(comword)){
			terr(`sh: control structures are not implemented`, script_out);
			return ++add_rows;
		}
//It doesn't look like a file.
		if (!comword.match(/\x2f/)) {
			terr(`sh: ${comword}: command not found`, script_out);
			return ++add_rows;
		}

//Try to execute a "shell script"
		let rv = await execute_file(comword, term.cur_dir, env);
		if (can()) return;
		if (isstr(rv)) {
			terr(rv, script_out);
			return ++add_rows;
		}

//Collect the stdin (used as optional input for the next command) for pipelines
		if (inpipe) stdin = rv;
		else {
			if (script_out){
				 if (rv && rv.length) script_out.push(...rv);
			}
			else{
				term.response(rv);
				term.response_end();
			}
		}
		continue;
	}//»

//Look for the command's options
	let gotopts = command_options[usecomword];
	let opts;

//Parse the options and fail if there is an error message
	rv = get_options(arr, usecomword, gotopts);
	if (rv[1]&&rv[1][0]) {
		add_rows++;
		term.response(rv[1][0]);
		continue;
	}
	opts = rv[0];

//Run command
	rv = await com(arr, {redir, script_out, stdin, inpipe, term, add_rows, env, opts, command_str});
	if (can()) return;
	if (!rv) rv = {};
	let {out, err, colors, didFmt, pretty} = rv;
	if (err) {
		if (isstr(err)) err = [err];
		add_rows+=err.length;
		term.response(err);
	}
	if (out) {//«
		if (isstr(out)) out=[out];
		if (redir&&redir.length){
			if (isarr(out)) out = out.join("\n");
			let {err} = await write_to_redir(term, out, redir, env);
			if (can()) return;
			if (err) {
				add_rows++;
				term.response(err);
			}
			stdin = [];
		}
//Set the stdin for the next command
		else if (inpipe) {
			stdin = out;
		}
		else if (!script_out){
//Print the output
			term.response(out,{didFmt, colors, pretty});
		}
		else{
		}
	}//»
	else stdin = null;

//If we are expecting to collect the output of a script or command substitition, collect the output
	if (!inpipe && script_out && out && out.length) script_out.push(...out);

}//»

//In a script, refresh rather than returning to the prompt
if (script_out) {
	term.refresh();
//	return {out: script_out, addRows: add_rows};
	return add_rows;
}

//Command line input returns to prompt
term.response_end();

}//»

};

//»

//»

//Terminal«

//Issues«
/*@GYWJNFGHXP: Just started on a "solution" to the issue referenced on the Bug below.«

For now, we are doing replacements for open paren, open square brace and plus sign.
What about period, asterisk and question mark?


We now allow for the tab completion like:

$ cat 'Some (weird) f<TAB>

to become:

$ cat 'Some (weird) filename.txt'

But this also actually works when we are at the beginning:

$ 'Some (weird) f<TAB>

becomes:

$ 'Some (weird) filename.txt'

...this is *really* only supposed to search in the command pathway.

»*/
/*Bug found on Feb. 14, 2023://«

There seems to be an issue with commands that wrap around that have long
arguments (like filenames) with embedded spaces that are escaped. Say
the terminal is only like 40 chars wide:

$ ls /home/me/videos/This\ is\ a\ video\
with\ embedded\ spaces.mp4

There was actually a line break inserted here in the command history, probably
related to doing a tab completion that had to wrap around.

I want to implement tab completions that are inside of quotes (like bash does).
Given a file named "file with spaces.txt", doing:

$ cat 'file w<TAB>

...should complete to:

$ cat 'file with spaces.txt'

There needs to be some basic parsing done to ensure that this does not work,
i.e. there should be an odd number of non-escaped quotes.

$ cat ' 'file w<TAB>

//»*/
//»

export const app = function(Win) {

//Var«

const {main, Desk} = Win;
const topwin = Win;
const winid = topwin.id;
const termobj = this;

const ENV = {}

//vim markers
let MARK_BG_COL="#777";
let MARK_FG_COL="#000";

let did_init = false;
this.Desk = Desk;
this.winid = winid;
this.topwin = topwin;

const SCISSORS_ICON = "\u2702";

let stat_lines;

let MIN_TERM_WID = 20;
let terminal_locked  = false;

let is_scrolling = false;
let wheel_iter;
let dblclick_timeout;
let downevt=null;

let MAX_TAB_SIZE=256;
let awaiting_remote_tab_completion = false;
//const com_completers = ["app","lib","import"];
const com_completers = ["help", "app", "appicon"];

const STAT_OK=1;
const STAT_WARNING=2;
const STAT_ERROR=3;

let nrows, ncols;
let x=0, y=0;
let w,h;
let xhold,yhold;
let hold_x, hold_y;

let editor;
let pager;
let app_prompt;

let num_ctrl_d = 0;
let CLEAN_COPIED_STRING_MODE = false;
let DO_EXTRACT_PROMPT = true;
const MAX_OVERLAY_LENGTH = 42;
let overlay_timer = null;
let TERMINAL_IS_LOCKED = false;
let buffer_scroll_num = null;
let buffer_hold;
let line_height;

let FF = "monospace";
let FW = "500";
let CURBG = "#00f";
let CURFG = "#fff";
let OVERLAYOP = "0.75";
let TCOL = "#e3e3e3";

let topwin_focused = true;
let no_prompt_mode = false;

let min_height;

let com_scroll_mode = false;

let num_stat_lines = 0;
let num_lines = 0;
let scroll_num = 0;
let scrollnum_hold;

let min_fs = 8;
let def_fs = 24;
let gr_fs;

this.scroll_num = scroll_num;
this.ENV = ENV;

let max_scroll_num=50;
let max_fmt_len = 4997;

let last_com_str=null;
let last_mode;

let root_state = null;
let cur_shell = null;
let shell = null;
let ls_padding = 2;
let await_next_tab = null;

let cur_prompt_line = 0;
let line_continue_flag = false;
let cur_scroll_command;
let prompt_str;
let prompt_len;
//let buf_lines = [];
let lines = [];
let line_colors = [];
let lines_hold_2;
let lines_hold;
let line_colors_hold;

let current_cut_str = "";

let history = [];

let command_hold = null;
let command_pos_hold = 0;
let bufpos = 0;

let sleeping = null;

let cur_ps1;
let cur_prompt="$";
//let cur_dir;

//»
//DOM«

let overdiv = make('div');//«
overdiv._pos="absolute";
overdiv._loc(0,0);
overdiv._w="100%";
overdiv._h="100%";
topwin.overdiv=overdiv;
//»
let wrapdiv = make('div');//«
wrapdiv.id="termwrapdiv_"+winid;
wrapdiv._bgcol="#000";
wrapdiv._pos="absolute";
wrapdiv._loc(0,0);
wrapdiv._tcol = TCOL;
wrapdiv._fw = FW;
wrapdiv._ff = FF;
wrapdiv.style.whiteSpace = "pre";
//»
let tabdiv = make('div');//«
tabdiv.id="termtabdiv_"+winid;
tabdiv._w="100%";
tabdiv.style.userSelect = "text"
tabdiv._pos="absolute";
tabdiv.onmousedown=(e)=>{downevt=e;};
tabdiv.onmouseup=e=>{//«
	if (!downevt) return;
	let d = capi.dist(e.clientX,e.clientY,downevt.clientX, downevt.clientY);
	if (d < 10) return;
	focus_or_copy();
};//»
tabdiv.onclick=e=>{//«
	e.stopPropagation();
	if (dblclick_timeout){
		clearTimeout(dblclick_timeout);
		dblclick_timeout=null;
		setTimeout(focus_or_copy,333);
		return;
	}
	setTimeout(focus_or_copy,500);
};//»
tabdiv.ondblclick=e=>{e.stopPropagation();dblclick_timeout=setTimeout(focus_or_copy,500);}
tabdiv._loc(0,0);
tabdiv.style.tabSize = 4;
this.tabsize = tabdiv.style.tabSize;
wrapdiv.tabdiv = tabdiv;
//»

let textarea;
let areadiv;
if (!isMobile) {
	textarea = make('textarea');
	textarea.id = `textarea_${Win.id}`;
	textarea._noinput = true;
	textarea.width = 1;
	textarea.height = 1;
	textarea.style.opacity = 0;
	textarea.focus();
	this.textarea = textarea; 
}

	areadiv = make('div');
	areadiv._pos="absolute";
	areadiv._loc(0,0);
	areadiv._z=-1;
	if (textarea) {
		areadiv.appendChild(textarea);
	}
	this.areadiv = areadiv;
	main._tcol="black";
	main._bgcol="black";

//let overlay;«

let fakediv = make('div');
fakediv.innerHTML = '<div style="opacity: '+OVERLAYOP+';border-radius: 15px; font-size: xx-large; padding: 0.2em 0.5em; position: absolute; -webkit-user-select: none; transition: opacity 180ms ease-in; color: rgb(16, 16, 16); background-color: rgb(240, 240, 240); font-family: monospace;"></div>';
let overlay = fakediv.childNodes[0];
overlay.id = "overlay_"+winid;

//»

//Listeners«
const onpaste = e =>{//«
//	if (pager) return;
	textarea.value="";
	setTimeout(()=>{
		let val = textarea.value;
		if (!(val&&val.length)) return;
		if (editor) editor.check_paste(val);
		else dopaste();
	}
	,25);
}//»
if (textarea) textarea.onpaste = onpaste;
main.onwheel=e=>{//«
	if (!sleeping){
		let dy = e.deltaY;
		if (!is_scrolling){
			if (!scroll_num) return;
			if (dy > 0) return;
			scrollnum_hold = scroll_num;
			is_scrolling = true;
			wheel_iter = 0;
		}
		let skip_factor = 10;
/*
		if (ENV.SCROLL_SKIP_FACTOR){
			let got = ENV.SCROLL_SKIP_FACTOR.ppi();
			if (!Number.isFinite(got)) cwarn(`Invalid SCROLL_SKIP_FACTOR: ${ENV.SCROLL_SKIP_FACTOR}`);
			else skip_factor = got;
		}
*/
		wheel_iter++;
		if (wheel_iter%skip_factor) return;
		if (dy < 0) dy = Math.ceil(4*dy);
		else dy = Math.floor(4*dy);
		if (!dy) return;
		scroll_num += dy;
		if (scroll_num < 0) scroll_num = 0;
		else if (scroll_num >= scrollnum_hold) {
			scroll_num = scrollnum_hold;
			is_scrolling = false;
		}
		render();
	}
};//»
main.onscroll=e=>{e.preventDefault();scroll_middle();};
main.onclick=()=>{
	textarea&&textarea.focus();
}
overdiv.onmousemove = e=>{//«
	e.stopPropagation();
	if (Desk) Desk.mousemove(e);
};//»
//»

wrapdiv.appendChild(tabdiv);
main.appendChild(wrapdiv);
main.appendChild(areadiv);

//»

//Util«

const savehist = async()=>{//«
	if (!await fsapi.writeFile(HISTORY_PATH, history.join("\n")+"\n")){
cwarn(`Problem writing to history path: ${HISTORY_PATH}`);
	}
};//»

const dopaste=()=>{//«
	let val = textarea.value;
	if (val && val.length) handle_insert(val);
	textarea.value="";
}
//»
const check_scrolling=()=>{//«
	if (is_scrolling){
		scroll_num = scrollnum_hold;
		is_scrolling = false;
		render();
		return true;
	}
	return false;
}//»

const wrap_line = (str)=>{//«
	str = str.replace(/\t/g,"\x20".rep(this.tabsize));
	let out = '';
	let w = this.w;
	while (str.length > w){
		if (!out) out = str.slice(0,w);
		else out = out+"\n"+str.slice(0,w);
		str = str.slice(w);
	}
	if (str.length>0){
		if (!out) out = str;
		else out = out+"\n"+str;
	}
	return out;
};//»
const fmt_ls=(arr, lens, ret, types, color_ret, start_from, col_arg)=>{//«
	let pad = ls_padding;
	if (!start_from) start_from=0;
	if (col_arg == 1) {//«
		for (let i=0; i < arr.length; i++) {
			if (w >= arr[i].length) ret.push(arr[i]);
			else {
				let iter = 0;
				let str = null;
				while(str != "") {
					str = arr[i].substr(iter, iter+w);
					ret.push(str);
					iter += w;
				}
			}
		}
		return;
	}//»
	const min_col_wid=(col_num, use_cols)=>{//«
		let max_len = 0;
		let got_len;
		let use_pad = pad;
		for (let i=col_num; i < num ; i+=use_cols) {
			if (i+1 == use_cols) use_pad = 0;
			got_len = lens[i]+use_pad;
			if (got_len > max_len) max_len = got_len;
		}
		return max_len;
	};//»
	let num = arr.length;
	let col_wids = [];
	let col_pos = [0];
	let max_cols = col_arg;
	if (!max_cols) {
		let min_wid = 1 + pad;
		max_cols = Math.floor(w/min_wid);
		if (arr.length < max_cols) max_cols = arr.length;
	}
	let num_rows = Math.floor(num/max_cols);
	let num_cols = max_cols;
	let rem = num%num_cols;
	let tot_wid = 0;
	let min_wid;
	for (let i=0; i < max_cols; i++) {
		min_wid = min_col_wid(i, num_cols);
		tot_wid += min_wid;
		if (tot_wid > w) {
			fmt_ls(arr, lens, ret, types, color_ret, start_from, (num_cols - 1));
			return;
		}
		col_wids.push(min_wid);
		col_pos.push(tot_wid);
	}
	col_pos.pop();
	let matrix = [];
	let row_num;
	let col_num;
	let cur_row = -1;
	let xpos;
	for (let i=0; i < num; i++) {
		let typ;
		if (types) typ = types[i];
		let color;
		if (typ==DIRECTORY_TYPE) color="#909fff";
		else if (typ==LINK_TYPE) color="#0cc";
		else if (typ==BAD_LINK_TYPE) color="#f00";
		col_num = Math.floor(i%num_cols);
		row_num = Math.floor(i/num_cols);

		if (row_num != cur_row) {
			matrix.push([]);
			xpos=0;
		}
		let str = arr[i] + " ".rep(col_wids[col_num] - arr[i].length);
		matrix[row_num][col_num] = str;
		if (color_ret) {
			let use_row_num = row_num+start_from;
			if (!color_ret[use_row_num]) color_ret[use_row_num] = {};
			let uselen = arr[i].length;
			if (arr[i].match(/\/$/)) uselen--;
			if (color) color_ret[use_row_num][xpos] = [uselen, color];
		}
		xpos += str.length;
		cur_row = row_num;
	}
	for (let i=0; i < matrix.length; i++) ret.push(matrix[i].join(""));
	return;
};//»
const fmt2=(str, type, maxlen)=>{//«
    if (type) str = type + ": " + str;
    let ret = [];
    let w = this.w;
    let dopad = 0;
    if (maxlen&&maxlen < w) {
        dopad = Math.floor((w - maxlen)/2);
        w = maxlen;
    }

    let wordarr = str.split(/\x20+/);
    let curln = "";
    for (let i=0; i < wordarr.length; i++){
        let w1 = wordarr[i];
        if (((curln + " " + w1).length) >= w){
            if (dopad) ret.push((" ".repeat(dopad))+curln);
            else ret.push(curln);
            curln = w1;
        }
        else {
            if (!curln) curln = w1;
            else curln += " " + w1;
        }
        if (i+1==wordarr.length) {
            if (dopad) ret.push((" ".repeat(dopad))+curln);
            else ret.push(curln);
        }
    }
    return ret;
}
//»
const fmt = (str, startx)=>{//«
	if (str === this.EOF) return [];
	let use_max_len = get_max_len();
	if (str instanceof Blob) str = "[Blob " + str.type + " ("+str.size+")]"
	else if (str.length > use_max_len) str = str.slice(0, use_max_len)+"...";
	
//	if (type) str = type + ": " + str;
	let ret = [];
	let iter =  0;
	let do_wide = null;
	let marr;
	if (str.match && str.match(/[\x80-\xFE]/)) {
		do_wide = true;
		let arr = str.split("");
		for (let i=0; i < arr.length; i++) {
			if (arr[i].match(/[\x80-\xFE]/)) {
				arr.splice(i+1, 0, "\x03");
				i++;
			}
		}
		str = arr.join("");
	}
	let doadd = 0;
	if (startx) doadd = startx;
	if (!str.split) str = str+"";
	let arr = str.split("\n");
	let ln;
	for (ln of arr) {
		while((ln.length+doadd) >= w) {
			iter++;
			let val = ln.slice(0,w-doadd);
			if (do_wide) val = val.replace(/\x03/g, "");
			ret.push(val);
			ln = ln.slice(w-doadd);
			str = ln;
			doadd = 0;
		}
	}
	if (do_wide) ret.push(ln.replace(/\x03/g, ""));
	else ret.push(ln);
	return ret;
};//»
const fmt_lines_sync=(arr, startx)=>{//«
    let all = [];
	let usestart = startx;
    for (let i=0; i < arr.length; i++) {
		all = all.concat(fmt(arr[i],usestart));
		usestart = 0;
	}
    return all;
};//»

const obj_to_string = obj =>{//«
	if (obj.id) return `[object ${obj.constructor.name}(${obj.id})]`;
	return `[object ${obj.constructor.name}]`;
};//»
const get_history=async(val)=>{//«
	let fnode = await fsapi.pathToNode(HISTORY_FOLDER);
	if (!fnode){
		if (!await fsapi.mkDir(globals.HOME_PATH, ".history")){
cerr("Could not make the .history folder!");
			return;
		}
	}
	else if (fnode.appName !== FOLDER_APP){
		cwarn("History directory path is NOT a directory!!!");
		return;
	}
	let node = await fsapi.pathToNode(HISTORY_PATH);
	if (!node) return;
	let text = (await node.text).split("\n");
	return text;
}//»
const scroll_middle=()=>{//«
	let y1 = main.scrollTop;
	main.scrollTop=(main.scrollHeight-main.clientHeight)/2;
	let y2 = main.scrollTop;
};//»
const focus_or_copy=()=>{//«
	let sel = window.getSelection();
	if (sel.isCollapsed)textarea&&textarea.focus();
	else do_clipboard_copy();
};//»

///*
const delete_mods=()=>{//«
	for (let m of DEL_MODS){
		let scr = document.getElementById(`script_mods.${m}`);
		if (scr) scr._del();
		delete NS.mods[m];
		NS.mods[m]=undefined;
	}
	for (let m of DEL_COMS){
		delete shell_libs[m];
	}

};//»
//*/
const get_homedir=()=>{//«
	if (root_state) return "/";
	return globals.HOME_PATH;
};//»
const get_buffer = (if_str)=>{//«
//const get_buffer = (if_str, if_no_buf)=>{
	let ret=[];
	if (if_str) ret = "";
	let ln;

/*«
	if (!if_no_buf) {
		if (buf_lines) {
			for (let i=0; i < buf_lines.length; i++) {
				ln = buf_lines[i].join("").replace(/\u00a0/g, " ");
				if (if_str) ret +=  ln + "\n"
				else ret.push(ln);
			}
		}
	}
»*/

	let actor = editor || pager;
	let uselines;
	if (actor && actor.get_lines) uselines = actor.get_lines();//in foldmode, vim's lines contain fold markers
	else uselines = lines;
	for (let i=0; i < uselines.length; i++) {
		ln = uselines[i].join("").replace(/\u00a0/g, " ");
		if (if_str) ret +=  ln + "\n"
		else ret.push(ln);
	}

	if (actor && actor.parSel){//Paragraph select mode
		if (if_str) ret = ret.split("\n");
		let paras = [];
		let curln = "";
		for (let ln of ret){
			if (ln.match(/^\s*$/)){
				if (curln) {
					paras.push(curln);
					curln = "";
				}
				paras.push("");
				continue;
			}
			if (ln.match(/-\s*$/)) ln = ln.replace(/-\s+$/,"-");
			else ln = ln.replace(/\s*$/," ");
			curln = curln + ln;
		}
		if (curln) paras.push(curln);
		if (if_str) ret = paras.join("\n");
		else ret = paras;
	}

	return ret;
};
this.real_get_buffer=get_buffer;
this.get_buffer=()=>{return get_buffer();}
this.get_history = ()=>{
	return history;
};
//»
const cur_date_str=()=>{//«
	let d = new Date();
	return (d.getMonth()+1) + "/" + d.getDate() + "/" + d.getFullYear().toString().substr(2);
};//»
const extract_prompt_from_str=(str)=>{//«
	if (!DO_EXTRACT_PROMPT) return str;
	let prstr = get_prompt_str();
	let re = new RegExp("^"+prstr.replace("$","\\$"));
	if (re.test(str)) str = str.substr(prstr.length);
	return str;
};//»
const copy_text=(str, mess)=>{//«
	if (!textarea) return;
	if (!mess) mess = SCISSORS_ICON;
	textarea.focus();
	textarea.value = str;
	textarea.select();
	document.execCommand("copy")
	do_overlay(mess);
};//»
const do_clear_line=()=>{//«
	if (cur_shell) return;
	let str="";
	for (let i = lines.length; i > y+scroll_num+1; i--) str = lines.pop().join("") + str;
	let ln = lines[y+scroll_num];
	str = ln.slice(x).join("") + str;
	lines[y+scroll_num] = ln.slice(0, x);	
	if (cur_prompt_line < scroll_num) {
		scroll_num -= (scroll_num - cur_prompt_line);
		y=0;
	}
	current_cut_str = str;
	render();
};//»
const do_copy_buffer = () => { copy_text(get_buffer(true), "Copied: entire buffer"); };
const do_clipboard_copy=(if_buffer, strarg)=>{//«
const do_copy=str=>{//«
    if (!str) return;
    str = str.replace(/^[\/a-zA-Z]*[$#] /,"");
    let copySource = make("pre");
    copySource.textContent = str;
    copySource.style.cssText = "-webkit-user-select: text;position: absolute;top: -99px";
    document.body.appendChild(copySource);
    let selection = document.getSelection();
    let anchorNode = selection.anchorNode;
    let anchorOffset = selection.anchorOffset;
    let focusNode = selection.focusNode;
    let focusOffset = selection.focusOffset;
    selection.selectAllChildren(copySource);

    document.execCommand("copy")
    if (selection.extend) {
        selection.collapse(anchorNode, anchorOffset);
        selection.extend(focusNode, focusOffset)
    }
    copySource._del();
}//»
	let str;
	if (strarg) str = strarg;
	else if (if_buffer) str = get_buffer(true);
	else str = getSelection().toString()
	if (CLEAN_COPIED_STRING_MODE) {
		str = str.replace(/\n/g,"");
		str = extract_prompt_from_str(str);
	}
	else {
//cwarn("Do you really ever want this string to be stripped of newlines and the prompt? CLEAN_COPIED_STRING_MODE==false !!!");
	}

	do_copy(str);
	textarea&&textarea.focus();
	do_overlay(`Copied: ${str.slice(0,9)}...`);
};//»
const do_clipboard_paste=()=>{//«
	if (!textarea) return;
	textarea.value = "";
	document.execCommand("paste")
};//»
const do_overlay=(strarg)=>{//«
	let str;
	if (strarg) {
		str = strarg;
		if (str.length > MAX_OVERLAY_LENGTH) str = str.slice(0,MAX_OVERLAY_LENGTH)+"...";
	}
	else str = w+"x"+h;
	overlay.innerText = str;
	if (overlay_timer) clearTimeout(overlay_timer);
	else main.appendChild(overlay);
	capi.center(overlay, main);
	overlay_timer = setTimeout(()=>{
		overlay_timer = null;
		overlay._del();
	}, 1500);
};//»
const set_new_fs=(val)=>{//«
	gr_fs = val;
	localStorage.Terminal_fs = gr_fs;
	wrapdiv._fs = gr_fs;
	resize();
};//»
const get_max_len=()=>{//«
	let max_len = max_fmt_len;
	let maxlenarg = ENV['MAX_FMT_LEN'];
	if (maxlenarg && maxlenarg.match(/^[0-9]+$/)) max_len = parseInt(maxlenarg);
	return max_len;
};//»
const check_line_len=(dy)=>{//«
	if (!dy) dy = 0;
	if (lines[cy()+dy].length > w) {
		let diff = lines[cy()+dy].length-w;
		for (let i=0; i < diff; i++) lines[cy()+dy].pop();
	}
};//»
const cx=()=>{return x;}
const cy=()=>{return y + scroll_num;}
const trim_lines=()=>{while (cur_prompt_line+1 != lines.length) lines.pop();};

//»
//Render«

const render=(opts={})=>{

const diagnose=n=>{//«
/*
//let val = Math.floor(100*real_lines[scroll_num]/(real_lines[lines.length-1]||real_lines[lines.length-2]));
console.error(`NAN${n}`);
log("scroll", scroll_num);
log("usescroll", usescroll);
log("lines.length",lines.length);
log(real_lines);
*/
};//»
//Var«
	let actor = editor||pager;
	if (actor) ({x,y,scroll_num}=actor);
	let visual_line_mode;
	let visual_block_mode;
	let visual_mode;
	let macro_mode;
	let seltop;
	let selbot;
	let selleft;
	let selright;
	let selmark;
	let stat_input_mode;
	let stat_com_arr;
	let stat_message, stat_message_type;
	let error_cursor;
	let real_lines;
	let real_line_mode=false;
	let show_marks;
	let splice_mode;
//	let opts = {};
	if (actor) ({stat_input_mode,stat_com_arr,stat_message,stat_message_type,real_line_mode}=actor);
	if (!stat_input_mode) stat_input_mode="";
	if (editor) ({splice_mode, macro_mode,visual_block_mode,visual_line_mode,visual_mode,show_marks,seltop,selbot,selleft,selright,selmark,error_cursor,real_lines, opts}=editor);
	if (!(ncols&&nrows)) return;

	let docursor = false;
	if (opts.noCursor){}
	else if (!TERMINAL_IS_LOCKED) docursor = true;

	let usescroll = scroll_num;
	let is_buf_scroll = false;
	if (buffer_scroll_num!==null) {
		usescroll = buffer_scroll_num;
		is_buf_scroll = true;
	}
	let scry=usescroll;
	let slicefrom = scry;
	let sliceto = scry + nrows;
	let uselines=[];
	let is_str = false;
	let xoff = 0;
	if (editor) xoff = Math.floor(x/w)*w;
	let usex = x;
	let outarr = [];
	let donum;
	usex = x-xoff;
//»
	for (let i=slicefrom; i < sliceto; i++) {//«
		let ln = lines[i];
		if (!ln) {
			if (editor) uselines.push(['<span style="color: #6c97c4;">~</span>']);
			else uselines.push([""]);
		}
		else {
			let arr = ln.slice(xoff,xoff+w);
			let newln = arr;
			newln.tcolor = ln.tcolor;
			newln.marks = ln.marks;
			uselines.push(newln);
		}
	}//»
	let len = uselines.length;//«
	if (len + num_stat_lines != h) {
		donum = h - num_stat_lines;
	}
	else donum = len;//»
	for (let i = 0; i < donum; i++) {//«
		let ind;
		let arr = uselines[i];
		while((ind=arr.indexOf("&"))>-1) arr[ind] = "&amp;";
		while((ind=arr.indexOf("<"))>-1) arr[ind] = "&lt;";
		while((ind=arr.indexOf(">"))>-1) arr[ind] = "&gt;";

		let marks=null;
		if (!arr||(arr.length==1&&!arr.marks&&arr[0]=="")) arr = [" "];
		if (editor && show_marks && arr.marks) marks = arr.marks
		let gotit = arr.indexOf(null);
		if (gotit > -1) arr[gotit] = " ";
		let curnum = i+usescroll;
		let colobj = line_colors[curnum];
		if ((visual_line_mode||visual_mode||visual_block_mode)&&seltop<=curnum&&selbot>=curnum){//«
			if (visual_line_mode) {
				let ln_min1 = arr.length-1;
				if (ln_min1 == -1) ln_min1=0;
				arr[0] = '<span style="background-color:#aaa;color:#000;">'+(arr[0]||" ");
				arr[ln_min1] = (arr[ln_min1]||" ")+'</span>';
			}
			else if (visual_mode){
				let useleft, useright;
				if (seltop==curnum && selbot==curnum){
					useleft = selleft;
					useright = selright;
				}
				else if (curnum > seltop && curnum < selbot){
					useleft = 0;
					useright = arr.length-1;
				}
				else if (seltop===curnum){
					useright = arr.length-1;
					useleft = (curnum==cy())?x:selmark;
				}
				else if (selbot===curnum){
					useleft = 0;
					useright = (curnum==cy())?x:selmark;
				}
				else{
					throw new Error("WUTUTUTU");
				}
				let str = '<span style="color:#000;background-color:#aaa;">'+(arr[useleft]||" ");
				arr[useleft]=str;
				if (useright == -1) useright = 0;
				if (arr[useright]) arr[useright] = arr[useright]+"</span>";
				else arr[useright] = "</span>";
			}
			else {
				let str = '<span style="color:#000;background-color:#aaa;">'+(arr[selleft]||"");
				arr[selleft]=str;
				if (arr[selright]) arr[selright] = arr[selright]+"</span>";
				else arr[selright] = "</span>";
			}
		}//»
		else if (arr[0]=="\xd7"){
			arr[0]=`<span style="color:rgb(95,215,255);">${arr[0]}`
			arr[arr.length-1]=`${arr[arr.length-1]}</span>`;
		}
		else if (colobj){//«
			let nums = Object.keys(colobj);
			for (let numstr of nums) {
				if (numstr.match(/^_/)) continue;
				let num1 = parseInt(numstr)-xoff;
				let obj = colobj[numstr];
				let num2 = num1 + obj[0]-1;
				let col = obj[1];
				let bgcol = obj[2];
				let str = '<span style="color:'+col+";";
				if (bgcol) str += "background-color:"+bgcol+";"
				if (!arr[num1]) str += '"> ';
				else str += '">'+arr[num1];
				arr[num1] = str;
				if (arr[num2]) arr[num2] = arr[num2]+"</span>";
				else arr[num2] = "</span>";
if (num2 > w) {
//console.log("LONGLINE");
	break;
}
			}
		}//»
		if (marks){//«
			for (let s of marks){
				let pos = s.ln.indexOf(s);
				if (pos >= 0) {
					let str=arr[pos];
					let tag1 = "";
					let tag2 = "";
					let marr;
					if (marr=str.match(/^(<.+>)(.)$/)) tag1 = marr[1];
					else if (marr=str.match(/^(.)(<.+>)$/)) tag2 = marr[2];
					let usebg = MARK_BG_COL;
					let usefg = MARK_FG_COL;
					let usech = s.mark||" ";
					if (!(pos==usex&&i==y)) arr[pos] = tag1+'<span style="background-color:'+usebg+';color:'+usefg+';">'+usech+"</span>"+tag2;
				}
			}
		}//»

		if (!(pager||is_buf_scroll||stat_input_mode||is_scrolling)) {//«
//		if (!(pager||is_buf_scroll||stat_input_mode||scroll_cursor_mode)) {
//			if (docursor && i==y && topwin_focused) {
			if (docursor && i==y) {
				if (!arr[usex]||arr[usex]=="\x00") {
					arr[usex]=" ";
				}
				else if (arr[usex]=="\n") arr[usex] = " <br>";
				let usebg = CURBG;
//				if (ssh_mode) usebg = "red";
				let ch = arr[usex]||" ";
				let pre="";
				let usech;
				if (ch.match(/^</)&&!ch.match(/>$/)){
					let arr = ch.split(">");
					usech = arr.pop();
					pre = arr[0]+">";
				}
				else usech = ch;
				if (!usech.length) usech = " ";
				let sty;
				if (topwin_focused) sty = `background-color:${usebg}`;
				else sty=`border:1px solid ${usebg}`;
				arr[usex] = pre+`<span id="cursor_${winid}" style="${sty}">${usech}</span>`;
			}
		}//»
		else if (error_cursor) {//«
			if (i+usescroll == error_cursor[0]) {
				let str = '<span style="color:#fff;background-color:#f00;"';
				let num1 = error_cursor[1];
				if (!arr[num1]) str += '"> ';
				else str += '">'+arr[num1];
				arr[num1] = str+"</span>";
			}
		}//»

		outarr.push(arr.join(""));
	}//»
	if (actor) {//«
		let usestr;
		let recstr;
		if (stat_input_mode) {
			let arr,ind;
		
			if (!stat_com_arr.slice) arr = [];
			else arr = stat_com_arr.slice();
			while((ind=arr.indexOf("&"))>-1) arr[ind] = "&amp;";
			while((ind=arr.indexOf("<"))>-1) arr[ind] = "&lt;";
			while((ind=arr.indexOf(">"))>-1) arr[ind] = "&gt;";
			if (!arr[x]) arr[x] = " ";
			let arrstr=arr.join("");
			arr[x] = '<span style="background-color:'+CURBG+';color:'+CURFG+'">'+arr[x]+"</span>";
			if (visual_line_mode) {
				usestr = `${stat_input_mode}'&lt;,'&gt;${arr.join("")}`;
			}
			else {
				usestr = stat_input_mode + arr.join("");
			}
		}
		else if (editor) {//«
			let mess="", messtype, messln=0;
			let recmess="";
			if (stat_message) {
				mess = stat_message;
				messln = mess.length;
				mess = mess.replace(/&/g,"&amp;");
				mess = mess.replace(/</g,"&lt;");
				recmess = mess;
				let t = stat_message_type;
				let bgcol=null;
				let tcol="#000";
				if (macro_mode){
					bgcol="#551a8b";
					tcol="#fff";
				}
				else if (t==STAT_OK) bgcol="#090";
				else if (t==STAT_WARNING) bgcol="#dd6";
				else if (t==STAT_ERROR) {
					bgcol="#c44";
					tcol="#fff";
				}
				if (bgcol) mess = '<span style="color:'+tcol+';background-color:'+bgcol+'">'+mess+'</span>';
				editor.unset_stat_message();
			}
			else if (editor.insert) recmess = mess = "-- INSERT --";
			else if (visual_line_mode) recmess = mess = "-- VISUAL LINE --";
			else if (visual_mode) recmess = mess = "-- VISUAL --";
			else if (visual_block_mode) recmess = mess = "-- VISUAL BLOCK --";
			else if (splice_mode) mess="splice mode";

			if (mess && !messln) messln = mess.length-7;
			
			let per;
			let t,b;
			if (scroll_num==0) t = true;
			if (!lines[sliceto-1]) b=true;
			if (t&&b) per = "All";
			else if (t) per="Top";
			else if (b) per = "Bot";
			else {
				if (real_lines) {
					let val = Math.floor(100*real_lines[scroll_num]/(real_lines[lines.length-1]||real_lines[lines.length-2]));
					if (isNaN(val)) {
						diagnose(1);
					}
					per = (val)+"%";
				}
				else {
					let val = Math.floor(100*scroll_num/lines.length-1);
					if (isNaN(val)) {
						diagnose(2);
					}
					per = (val)+"%";
				}
			}
			let perln = per.length;
			let perx = w-5;
			try {
				if (perln > 4) per = "?%";
				per = "\x20".repeat(4-perln)+per;
			}
			catch(e){
//cerr("Bad perlen", perln);
//log("per", per);
//log("real_lines",real_lines);
//log("scroll_num",scroll_num);
//log(real_lines[scroll_num]);
//log("lines.length-1",lines.length-1);
//log(real_lines[lines.length-1]);
			}
			let add_one = 1;
			if (real_line_mode) add_one = 0;
			let lncol;
			if (real_lines) {
				let val = real_lines[y+usescroll]+add_one;
				if (isNaN(val)) diagnose(3);
				lncol = (val)+","+(x+add_one);
			}
			else lncol = (y+usescroll+add_one)+","+(x+add_one);
			let lncolln = lncol.length;
			let lncolx = w - 18;
			let diff = lncolx - messln;
			if (diff <= 0) diff = 1;
			let diff2 = (perx - lncolx - lncolln);
			if (diff2 <= 0) diff2 = 1;
			let spaces = "\x20".repeat(diff) + lncol + "\x20".repeat(diff2)+per;
			let str = mess + spaces;
			usestr = '<span>'+str+'</span>';

		}//»
		else if (stat_message) {
			recstr = usestr = stat_message;
			stat_message = null;
		}
		else if (pager) {
			let per = Math.floor(100*(usescroll+donum)/lines.length);
			if (per > 100) per = 100;
			recstr = usestr = `${pager.fname} ${per}% of ${lines.length} lines (press q to quit)`;
		}

		if (pager) {
			if (!stat_input_mode) usestr = '<span style=background-color:#aaa;color:#000>'+usestr+'</span>'
		}
		outarr.push(usestr);
	}//»
	if (stat_lines){//«
		for (let i=0; i < num_stat_lines; i++){
			let ln = stat_lines[i];
			if (!ln) ln = "";
			outarr.push(ln.replace(/&/g,"&amp;").replace(/<(?!\/?span)/ig,"&lt;"));
		}
	}
	if (min_height && h < min_height){
		tabdiv.innerHTML=`<center><span style="background-color:#f00;color:#fff;">Min height: ${min_height}</span></center>`;
	}
	else tabdiv.innerHTML = outarr.join("\n");
//»

};

//»
//Curses«

const getgrid=()=>{//«
	let tdiv = tabdiv;
	if (!(wrapdiv._w&&wrapdiv._h)) {
		if (topwin.killed) return;
cerr("DIMS NOT SET");
		return;
	}
	let usech = "X";

	let str = "";
	let iter = 0;
	wrapdiv._over="auto";
	while (true) {
		if (topwin.killed) return;
		str+=usech;
		tdiv.innerHTML = str;
		if (tdiv.scrollWidth > wrapdiv._w) {
			tdiv.innerHTML = usech.repeat(str.length-1);
			wrapdiv._w = tdiv.clientWidth;
			ncols = str.length - 1;
			break;
		}
		iter++;
		if (iter > 10000) {
log(wrapdiv);
			cwarn("INFINITE LOOP ALERT DOING WIDTH: " + tdiv.scrollWidth + " > " + w);
			return 
		}
	}
	str = usech;
	iter = 0;
	while (true) {
		tdiv.innerHTML = str;
		if (tdiv.scrollHeight > wrapdiv._h) {
			let newarr = str.split("\n");
			newarr.pop();
			tdiv.innerHTML = newarr.join("\n");
			wrapdiv._h = tdiv.clientHeight;
			nrows = newarr.length;
			break;
		}
		str+="\n"+usech;
		iter++;
		if (iter > 10000) {
log(wrapdiv);
			return cwarn("INFINITE LOOP ALERT DOING HEIGHT: " + tdiv.scrollHeight + " > " + h);
		}
	}
	tdiv.innerHTML="";
	wrapdiv._over="hidden";
};//»
const clear_table=()=>{//«
//const clear_table=(if_keep_buf)=>{
//	if (if_keep_buf) {
//		buf_lines = buf_lines.concat(lines.slice(0, scroll_num));
//		lines =  lines.slice(scroll_num);
//		line_colors =  line_colors.slice(scroll_num);
//	}
//	else {
	lines = [];
	line_colors = [];
//	}
	scroll_num = 0;
	render();
};//»
const clear=()=>{//«
//const clear=(if_keep_buffer)=>{
//	clear_table(if_keep_buffer);
	clear_table();
//	if (if_keep_buffer) cur_prompt_line = y;
};
//»
const shift_line=(x1, y1, x2, y2)=>{//«
	let uselines = lines;
	let str_arr = [];
	let start_len = 0;
	if (uselines[scroll_num + y1]) {
		str_arr = uselines[scroll_num + y1].slice(x1);
		start_len = uselines[scroll_num + y1].length;
	}
	if (y1 == (y2 + 1)) {
		if (uselines[scroll_num + y2]) uselines[scroll_num + y2] = uselines[scroll_num + y2].concat(str_arr);
		uselines.splice(y1 + scroll_num, 1);
	}
	return str_arr;
};//»
const scroll_into_view=(which)=>{//«
	if (!h) return;
	const doscroll=()=>{//«
		if (lines.length-scroll_num+num_stat_lines <= h) return false;
		else {
			if (y>=h) {
				scroll_num=lines.length-h+num_stat_lines;
				y=h-1;
			}
			else {
				scroll_num++;
				y--;
			}
			return true;
		}
	};//»
	let did_scroll = false;
	while (doscroll()) did_scroll = true;
	return did_scroll;
};//»
const resize = () => {//«
	if (topwin.killed) return;
	wrapdiv._w = main._w;
	wrapdiv._h = main._h;
	let oldw = w;
	let oldh = h;
	ncols=nrows=0;
	tabdiv._dis="";
	wrapdiv._bgcol="#000";
	main._bgcol="#000";
	getgrid();
	if (ncols < MIN_TERM_WID){
		tabdiv._dis="none";
		wrapdiv._bgcol="#400";
		main._bgcol="#400";
		terminal_locked = true;
		do_overlay(`Min\xa0width:\xa0${MIN_TERM_WID}`);
		return;
	}
	if (!(ncols&&nrows)) {
		terminal_locked = true;
		return;
	}
	terminal_locked = false;
	w = ncols;
	h = nrows;
	if (!(oldw==w&&oldh==h)) do_overlay();
	this.w = w;
	this.h = h;
	line_height = wrapdiv.clientHeight/h;
	scroll_into_view();
	scroll_middle();
	if (editor){
		if (editor.resize) {
			editor.resize(w,h);
			return;
		}
	}
	render();
};
//»

//»
//Parse/Prompt«

const get_com_pos=()=>{//«
	let add_x=0;
	if (cy() > cur_prompt_line) {
		add_x = w - prompt_len + x;
		for (let i=cur_prompt_line+1; i < cy(); i++) add_x+=w;
	}
	else add_x = x - prompt_len;
	return add_x;
};//»
const get_com_arr=(from_x)=>{//«
	let uselines = lines;
	let com_arr = [];
	let j, line;
	for (let i = cur_prompt_line; i < uselines.length; i++) {
		line = uselines[i];
		if (i==cur_prompt_line) j=prompt_len;
		else j=0;
		let len = line.length;
		for (; j < len; j++) com_arr.push(line[j]);
		if (len < w && i < uselines.length-1) com_arr.push("\n");
	}
	return com_arr;
};
//»
const get_command_arr=async (dir, arr, pattern)=>{//«
	const dokids = kids=>{
		if (!kids) return;
		let keys = Object.keys(kids);
		for (let k of keys){
			let app = kids[k].appName;
			if ((!app||app=="Com") && re.test(k)){
				match_arr.push([k, "Command"]);
			}
		}
	};
	let match_arr = [];
	let re = new RegExp("^" + pattern);
	for (let i=0; i < arr.length; i++) {
		let com = arr[i];
		if (pattern == "") {
			if (com.match(/^_/)) continue
			match_arr.push([com, "Command"]);
		}
		else if (re.test(com)) match_arr.push([arr[i], "Command"]);
	}
	return match_arr;
};//»
const execute=async(str, if_init, halt_on_fail)=>{//«

	ENV['USER'] = globals.CURRENT_USER;
	cur_shell = shell;
	let gotstr = str.trim();

	str = str.replace(/\x7f/g, "");

	let env = {};
	for (let k in ENV){
		env[k]=ENV[k];
	}
	shell.execute(str,{env});

	let ind = history.indexOf(gotstr);
	if (ind >= 0) {
		history.splice(ind, 1);
	}
	else{
		await fsapi.writeFile(HISTORY_PATH, `${gotstr}\n`, {append: true});
	}
	history.push(gotstr);

};
//»
const get_prompt_str=()=>{//«
	let goodch = ["u", "U", "h", "H", "d", "t", "w"];
	let gotps = ENV.PS1;
	let ds = "\$";
	if (root_state) {
		ds = "#"; 
		gotps = "\\w" + ds;
	}
	else if (!gotps) gotps = "\\w" + ds;
	if (gotps) {//«
		cur_ps1 = gotps;
		let arr = cur_ps1.split("");
		let str = "";
		for (let i=0; i < arr.length; i++) {
			let c = arr[i];
			let c1 = arr[i+1];
			if (c == "\\" && c1 && goodch.includes(c1)) {
				if (c1 == "w") str += this.cur_dir.replace(/^\/+/, "/");
				else if (c1 == "u" || c1 == "U") {
					if (ENV.USER) {
						if (c1 == "u") str += ENV.USER.toLowerCase();
						else str += ENV.USER;
					}
					else str += "user";
				}
				else if (c1 == "h" || c1 == "H") {
					if (ENV.HOSTNAME) {
						if (c1 == "h") str += ENV.HOSTNAME.toLowerCase();
						else  str += ENV.HOSTNAME;
					}
					else str += "home";
				}
				else if (c1 == "t") str += new Date().toTimeString().split(" ")[0];
				else if (c1 == "d") str += cur_date_str();
				i++;
			}
			else str += c;
		}
		cur_prompt = str;
	}//»
	if (ENV.USER) {
		if ((new RegExp("^/home/"+ENV.USER+"\\$$")).test(cur_prompt)) {
			cur_prompt = "~$";
		}
		else if ((new RegExp("^/home/"+ENV.USER+"/")).test(cur_prompt)) cur_prompt = cur_prompt.replace(/^\/home\/[^\/]+\x2f/,"~/");
	}
	cur_prompt=cur_prompt.replace(/ *$/, " ");
	return cur_prompt.replace(/ /g, "\xa0");
};//»
const set_prompt=(opts={})=>{//«
	let if_nopush = opts.NOPUSH;
	let if_noscroll = opts.NOSCROLL;
	let use_str = get_prompt_str();

	topwin.title=use_str.replace(/..$/,"");
	
	let plines;
	if (use_str==="") plines = [[""]];
	else{
		if (use_str.length+1 >= w) use_str = "..."+use_str.substr(-(w-5));
		plines = [use_str.split("")];
	}
	let line;
	let use_col = null;
	let len_min1;
	if (!lines.length) {
		lines = plines;
		len_min1 = lines.length-1;
		cur_prompt_line = 0;
	}
	else {
		len_min1 = lines.length-1;
		line = plines.shift();
		if (line_continue_flag) lines[len_min1] = lines[len_min1].concat(line);
//		else if (if_force) {
//			lines.push(line);
//			len_min1++;
//		}
		else {
			if (!lines[len_min1][0]) lines[len_min1] = line;
			else {
				lines.push(line);
				len_min1++;
			}
		}
		if (use_col) line_colors[len_min1] = {'0': [line.length, use_col]};
		while(plines.length) {
			line = plines.shift();
			lines.push(line);
			len_min1++;
			if (use_col) line_colors[len_min1] = {'0': [line.length, use_col]};
		}
		if (!if_noscroll) {
			cur_prompt_line = len_min1;
			scroll_into_view();
		}
	}
	prompt_len = lines[len_min1].length;
	if (prompt_len==1 && lines[len_min1][0]==="") prompt_len=0;
	x=prompt_len;
	y=lines.length - 1 - scroll_num;
	line_continue_flag = false;
};
//»
const insert_cur_scroll=()=>{//«
	com_scroll_mode = false;
	lines = lines_hold_2.slice(0, lines.length);
	let str = cur_scroll_command;
	let arr = fmt_lines_sync(str.split("\n"), prompt_len);
	let curarr = get_prompt_str().split("");
	for (let i=0; i < arr.length; i++) {
		let charr = arr[i].split("");
		for (let j=0; j < charr.length; j++) curarr.push(charr[j]);
		lines[cur_prompt_line + i] = curarr;
		y = cur_prompt_line + i - scroll_num;
		x = curarr.length;
		curarr = [];
	}
	if (x == w-1) {
		x=0;
		y++;
	}
	cur_scroll_command = null;
	return str;
};//»
const get_dir_contents=async(dir, pattern, opts={})=>{//«
	let {if_cd, if_keep_ast} = opts;
	const domatch=async()=>{//«
		kids = ret.kids;
		keys = Object.keys(kids);
		let match_arr = [];
		if (!if_keep_ast) pattern = pattern.replace(/\*/g, "[a-zA-Z_]*");
		pattern = pattern.replace(/\xa0/g, " ");
		let re = new RegExp("^" + pattern.replace(/\./g,"\\."));
		for (let i=0; i < keys.length; i++) {
			let key = keys[i];
			if (key=="."||key=="..") continue;
			let kid = kids[key];
			if (!root_state){
				let cur = kid;
				while (cur.treeroot !== true) {
					if (cur.rootonly === true) {
						kid = null;
						break;
					}
					cur = cur.par;
				}
				if (!kid) continue;
			}
			let useapp = kid.appName;
			if (if_cd && useapp !== FOLDER_APP) continue;
			let ret = [keys[i], useapp];
			if (useapp == "Link") ret.push(kid.link);
			if (pattern == "" || re.test(keys[i])) match_arr.push(ret);
		}
		return match_arr;
	};//»
	if (dir===null) throw new Error("get_dir_contents() no dir!");
	let ret = await fsapi.pathToNode(dir);
	if (!(ret&&ret.appName==FOLDER_APP)) return [];
	let type = ret.type;
	let kids=ret.kids;
	let keys=Object.keys(kids);
	if (type==FS_TYPE&&!ret.done) {
		let ret2 = await fsapi.popDir(ret,{});
		if (!ret2) return [];
		ret.done = true;
		ret.kids = ret2;
	}
	return domatch();
};
//»

//»
//Response«

const response_end = () => {//«
	if (!did_init) return;
	if (pager) return;
	set_prompt();
	scroll_into_view();
	sleeping = null;
	bufpos = 0;
	setTimeout(()=>{cur_shell = null;},10);
	render();
};
this.response_end = response_end;
//»

const response = (out, opts={})=>{//«
	if (isstr(out)) out = [out];
	else if (!out) return;
	let {didFmt, colors, pretty} = opts;
	if (colors) {
		for (let i=0; i < colors.length; i++) line_colors[scroll_num + y + i] = colors[i];
	}
	if (lines.length && !lines[lines.length-1].length) lines.pop();
	for (let ln of out){
		if (didFmt){
			lines.push(ln.split(""));
			continue;
		}
		let arr;
		if (pretty) arr = fmt2(ln);
		else arr = fmt(ln);
		for (let l of arr){
			lines.push(l.split(""));
		}
	}
};
this.response = response;
//»

//»
//Key handlers«
const do_ctrl_C=()=>{//«
	if (cur_shell) {
		ENV['?'] = 0;
		if (cur_shell.stdin) {
			cur_shell.stdin(null, true);
			delete cur_shell.stdin;
		}
	}
	else {
		handle_priv(null,"^".charCodeAt(), null, true);
		handle_priv(null,"C".charCodeAt(), null, true);
		root_state = null;
		bufpos = 0;
		command_hold = null;
		ENV['?'] = 0;
		response_end();
	}
};//»

const handle_insert=val=>{//«
	let arr = val.split("");
	let gotspace = false;
	for (let ch of arr) {
		let code = ch.charCodeAt();
		if (!(code >= 32 && code <= 126)) {
			if (code==10) continue;
			code = 32;
		}
		if (code==32) {
			if (gotspace) continue;
			gotspace = true;
		}
		else gotspace = false;
		handle_priv(null,code, null, true);
	}
};//»
const handle_line_str=(str, from_scroll, uselen, if_no_render)=>{//«
	let did_fail = false;
	const copy_lines=(arr, howmany)=>{//«
		let newarr = [];
		for (let i=0; i <= howmany; i++) {
			let ln = arr[i];
			if (!ln) {
				did_fail = true;
				ln = [" "];
			}
			newarr.push(ln);
		}
		return newarr;
	}//»
	if (str=="") {}
	else if (!str) return;
	let curnum = cur_prompt_line;
	let curx;
	if (typeof uselen=="number") curx=uselen;
	else curx = prompt_len;
	lines_hold_2 = lines;
	if (!com_scroll_mode) {
		lines = copy_lines(lines, cur_prompt_line)
		if (did_fail) {
			clear();
			return 
		}
	}
	lines[lines.length-1] = lines[lines.length-1].slice(0, prompt_len);
	let curpos = prompt_len;
	cur_scroll_command = str;
	let arr = str.split("\n");
	let addlines = 0;
	for (let lnstr of arr) {
		let i;
		if (!lnstr) lnstr = "";
		for (i=curnum;lnstr.length>0;i++) {
			let curln = lines[i];
			if (!curln) curln = [];
			let strbeg = lnstr.slice(0,w-curpos);
			curx = curpos + strbeg.length;
			curln.push(...strbeg);
			lines[i] = curln;
			lnstr = lnstr.slice(w-curpos);
			if (lnstr.length > 0) {
				curnum++;
				curx = 0;
			}
			curpos = 0;
			addlines++;
		}
		curnum++;
	}
	scroll_into_view();
	y = lines.length-1-scroll_num;
	x = curx;
	if (x==w) {
		y++;
		if (!lines[y+scroll_num]) lines.push([]);
		x=0;
		scroll_into_view();
	}
	if (!if_no_render) render();
};
//»
const handle_tab=async()=>{//«
	const docontents=async()=>{//«
		if (contents.length == 1) {//«

//METACHAR_ESCAPE

//\x22 -> "
//\x27 -> '
//\x60 -> `
//\x5b -> [
			let chars = contents[0][0].replace(/[ \x22\x27\x5b\x60#~{<>$|&!;()]/g, "\\$&").split("");
			let type = contents[0][1];
			tok = tok.replace(/\*$/,"");
			let str = tok;
			for (let i=tok.length; i < chars.length; i++) {
				let gotch = chars[i];
				str+=gotch;
				handle_letter_press(gotch);
			}
			if (type==FOLDER_APP) {
				handle_letter_press("/");//"/"
				let rv = await fsapi.popDirByPath(use_dir+"/"+str,{root:root_state});
				if (!rv) return cerr("hdk76FH3");
			}
			else if (type=="appDir"||type=="libDir"){
				handle_letter_press(".");//"/"
			}
			else if (type=="Link") {
				let link = contents[0][2];
				if (!link){
cwarn("WHAT DOES THIS MEAN: contents[0][2]?!?!?!?");
				}
				else if (!link.match(/^\x2f/)) {
//cwarn("handle_tab():  GOWDA link YO NOT FULLPATH LALA");
				}
				else {
					let obj = await fsapi.pathToNode(link);
					if (obj&&obj.appName==FOLDER_APP) {
if (await_next_tab) handle_letter_press("/");
						await_next_tab = true;
//log("!");
					}
					else {
						if (!lines[cy()][cx()]) handle_letter_press(" ");
					}
				}
			}
			else {
				if (!lines[cy()][cx()]) handle_letter_press(" ");
			}
		}//»
		else if (contents.length > 1) {//«
			if (await_next_tab) {//«
				let diff = cy() - cur_prompt_line;
				let repeat_arr = get_com_arr();
				let ret_arr = [];
				for (let i=0; i < contents.length; i++) {
					let arr = contents[i];
					let nm = arr[0];
					if (arr[1]===FOLDER_APP) nm+="/";
					ret_arr.push(nm);
				}
				let names_sorted = ret_arr.sort();
				let name_lens = [];
				for (let nm of names_sorted) name_lens.push(nm.length);
				let command_return = [];
				fmt_ls(names_sorted, name_lens, command_return);
				response(command_return, {didFmt: true});
				response_end();
				for (let i=0; i < repeat_arr.length; i++) handle_letter_press(repeat_arr[i]);
				let xoff = repeat_arr.length - arr_pos;
				for (let i=0; i < xoff; i++) handle_arrow(LEFT_KEYCODE,"");
				render();
			}//»
			else {//«
				if (!tok.length) {await_next_tab = true;return;}
				let max_len = tok.length;
				let got_substr = "";
				let curstr = tok;
				let curpos = tok.length;
				TABLOOP: while(true) {
					let curch = null;
					for (let arr of contents) {
						let word = arr[0];
						if (curpos == word.length) break TABLOOP;
						if (!curch) curch = word[curpos];
						else if (curch!==word[curpos]) break TABLOOP;
					}
					curstr += curch;
					curpos++;
				}
				got_substr = curstr;

				let got_rest = got_substr.substr(tok.length);
				if (got_rest.length > 0) {
					if (contents.length > 1)await_next_tab = true;
					else await_next_tab = null;
					
					let chars = got_rest.split("");
					for (let i=0; i < chars.length; i++) {
						let gotch = chars[i];
						if (gotch == " ") gotch = "\xa0";
						handle_letter_press(gotch);
					}
				}
				else await_next_tab = true;
			}//»
		}//»
	};//»
	const do_get_dir_contents = async() => {//«
		let ret = await get_dir_contents(use_dir, tok, {if_cd: tok0==="cd"});
		if (!ret.length) return;
		contents = ret;
		docontents();
	};//»
	if (cur_scroll_command) insert_cur_scroll();
	let contents;
	let use_dir = this.cur_dir;
	if (cur_shell) return;
	let arr_pos = get_com_pos();
	let arr = get_com_arr();
	let tok = "";
	let new_arr = arr.slice(0, arr_pos);
	let com_str = new_arr.join("");
	new_arr = com_str.split(/ +/);
	if (!new_arr[0] && new_arr[1]) new_arr.shift();
	let tokpos = new_arr.length;
	if (tokpos > 1) {
		if (new_arr[new_arr.length-2].match(/[\x60\(|;] *$/)) tokpos = 1;
	}
	let tok0 = new_arr[0];
//	if (ALIASES[tok0]) tok0 = ALIASES[tok0];
	if ((com_str.match(/[\x22\x27]/g)||[]).length===1){//\x22=" \x27='«

//At the end of a string with exactly one non-backtick quote character...
//Just a quick and dirty way to do tab completion with quotes

		let have_quote;
		let s="";

		for (let i=arr_pos-1; i >=0; i--){
			let ch = arr[i];
			if (ch.match(/[\x22\x27]/)){
				have_quote = ch;
				break;
			}
			s=`${ch}${s}`;
		}
		if (s.match(/\x2f/)){
			if (s.match(/^\x2f/)) use_dir="";
			let ar = s.split("/");
			s = ar.pop();
			use_dir=`${use_dir}/${ar.join("/")}`;
		}
//GYWJNFGHXP
		let use_str= s.replace(/([\[(+*?])/g,"\\$1");
		let ret = await get_dir_contents(use_dir, use_str,{if_cd: tok0==="cd", if_keep_ast: true});//, async ret => {
		if (!ret.length) return;
		if(ret.length===1){
			let rem = ret[0][0].slice(s.length);
			for (let ch of rem) handle_letter_press(ch);
			if (ret[0][1]===FOLDER_APP){
				handle_letter_press("/");
				await_next_tab = true;
			}
			else if (ret[0][1]==="Link"){
				let obj = await fsapi.pathToNode(`${use_dir}/${use_str}${rem}`);
				if (obj && obj.appName===FOLDER_APP){
					handle_letter_press("/");
					await_next_tab = true;
				}
				else handle_letter_press(have_quote);
			}
			else handle_letter_press(have_quote);
			return;
		}
		if (await_next_tab){
			contents = ret;
			docontents();
			return;
		}
		let all=[];
		for (let ar of ret) all.push(ar[0]);
		let rem = capi.sharedStart(all).slice(s.length);
		for (let ch of rem) handle_letter_press(ch);
		await_next_tab = true;
		return;
	}//»
	tok = new_arr.pop();
	tok = tok.replace(/^[^<>=]*[<>=]+/,"")
	if (tok.match(/^[^\x60;|&(]*[\x60;|&(][\/.a-zA-Z_]/)) {
		tok = tok.replace(/^[^\x60;|&(]*[\x60;|&(]/,"");
		tokpos = 1;
	}
	let got_path = null;
	if (tok.match(/\x2f/)) {//«
		tok = tok.replace(/^~\x2f/, "/home/"+ENV.USER+"/");
		got_path = true;
		let dir_arr = tok.split("/");
		tok = dir_arr.pop();
		let dir_str;
		let new_dir_str;
		if (dir_arr.length == 1 && dir_arr[0] == "") new_dir_str = "/";
		else {
			dir_str = dir_arr.join("/");
			let use_cur = this.cur_dir;
			if (dir_str.match(/^\x2f/)) use_cur = null;
			new_dir_str = capi.getFullPath(dir_str, this.cur_dir);
		}
		use_dir = new_dir_str;
	}//»
	let nogood = null;
	if (!(!got_path && (tokpos==1||(tokpos>1 && com_completers.includes(tok0))))) return do_get_dir_contents();
	if (tokpos==1) {
		contents = await get_command_arr(use_dir, BUILTINS, tok)
	}
	else {
		if (tok0 == "help"){
			contents = await get_command_arr(use_dir, BUILTINS, tok)
		}
		else if (tok0 == "app" || tok0 == "appicon"){
			contents = await get_command_arr(use_dir, await capi.getAppList(), tok)
		}
	}
	if (contents && contents.length) docontents();
	else do_get_dir_contents();
};//»
const handle_buffer_scroll=(if_up)=>{//«
	if (buffer_scroll_num===null) {
		buffer_scroll_num = scroll_num;
		scroll_cursor_y = y;
		hold_x = x;
		hold_y = y;
	}
	let n = buffer_scroll_num;
	if (if_up) {//«
		if (n == 0) return;
		let donum;
		if (n - h > 0) {
			donum = h;
			n -= h;
		}
		else n = 0;
		y=0;
	}//»
	else {//«
		let donum = h;
		if (n + donum >= lines.length) return;
		n += donum;
		if (n + h > lines.length) {
			n = lines.length - h;
			if (n < 0) n = 0;
		}
		y=0;
	}//»
	buffer_scroll_num = n;
	render();
};//»
const handle_arrow=(code, mod, sym)=>{//«

	if (mod == "") {//«
		if (code == KC['UP']) {//«
			if (cur_shell) return;
			if (bufpos < history.length) {
				if (command_hold == null && bufpos == 0) {
					command_hold = get_com_arr().join("");
					command_pos_hold = get_com_pos() + prompt_len;
				}
				bufpos++;
			}
			else return;
			let str = history[history.length - bufpos];
			if (str) {
				let diffy = scroll_num - cur_prompt_line;
/*«
				if (diffy > 0) {
					y=0;
					scroll_num -= diffy;
					cur_prompt_line = scroll_num;
					set_prompt({NOPUSH:1, NOSCROLL:1});
				}
				else y = cur_prompt_line;
»*/
				while (cur_prompt_line+1 != lines.length) { 
if (!lines.length){
console.error("COULDA BEEN INFINITE LOOP: "+(cur_prompt_line+1) +" != "+lines.length);
break;
}
					lines.pop();
				}
				handle_line_str(str.trim(), true);
				com_scroll_mode = true;
			}
		}//»
		else if (code == KC['DOWN']) {//«
			if (cur_shell) return;
			if (bufpos > 0) bufpos--;
			else return;
			if (command_hold==null) return;
			let pos = history.length - bufpos;
			if (bufpos == 0) {
				trim_lines();
				handle_line_str(command_hold.replace(/\n$/,""),null,null,true);
				x = command_pos_hold;
				command_hold = null;
				render();
			}
			else {
				let str = history[history.length - bufpos];
				if (str) {
/*«
					let diffy = scroll_num - cur_prompt_line;
					if (diffy > 0) {
						y=0;
						scroll_num -= diffy;
						cur_prompt_line = scroll_num;
						set_prompt({NOPUSH:1, NOSCROLL:1});
					}
»*/
					trim_lines();
					handle_line_str(str.trim(), true);
					com_scroll_mode = true;
				}
			}
		}//»
		else if (code == LEFT_KEYCODE) {//«
			if (cur_scroll_command) {
				insert_cur_scroll();
			}
			if (cx() == 0) {
				if (cy() == 0) return;
				if (cy() > cur_prompt_line) {
					if (y==0) {
						scroll_num--;
					}
					else y--;
					x = lines[cy()].length;
					if (x==w) x--;
					if (x<0) x = 0;
					render();
					return;
				}
				else return;
			}
			if (cy()==cur_prompt_line && x==prompt_len) return;
			x--;
			render();

		}//»
		else if (code == KC["RIGHT"]) {//«
			if (cur_scroll_command) insert_cur_scroll();
//Or if this is less than w-2 with a newline for a CONT like current CLI environment.
			let nextline = lines[cy()+1];
			let thisline = lines[cy()];
			let thisch = thisline[cx()];
			let thislinelen = thisline.length;

			if (x == w-1 || ((x < w-1) && nextline && ((x==0&&!thislinelen) || (x==lines[cy()].length)))) {//«
				if (x<w-1){
					if (!thisch) {
						if (!nextline) return;
					}
				}
				else if (!thisch) return;
				if (lines[cy() + 1]) {
					x=0;
					if (y+1==h) scroll_num++;
					else y++;
					render();
				}
				else { 
					lines.push([]);
					x=0;
					y++;
					if (!scroll_into_view(9)) render();
					return;
				}
			}//»
			else {
				if (x==thislinelen||!thisch) return;
				x++;
				render();
			}
		}//»
	}//»
	else if (mod=="C") {//«
		if (kc(code,"UP")) {//«
			if (bufpos < history.length) {
				if (command_hold == null && bufpos == 0) {
					command_hold = get_com_arr().join("");
					command_pos_hold = get_com_pos() + prompt_len;
				}
				bufpos++;
			}
			else return;

			let re = new RegExp("^" + command_hold);
			for (let i = history.length - bufpos; bufpos <= history.length; bufpos++) {
				let str = history[history.length - bufpos];
				if (re.test(str)) {
					trim_lines();
					handle_line_str(str.trim(), true);
					com_scroll_mode = true;
					break;
				}
			}
		}//»
		else if (kc(code,"DOWN")) {//«
			if (bufpos > 0 && command_hold) bufpos--;
			else return;
			let re = new RegExp("^" + command_hold);
			for (let i = history.length - bufpos; bufpos > 0; bufpos--) {
				let str = history[history.length - bufpos];
				if (re.test(str)) {
					trim_lines();
					handle_line_str(str.trim(), true);
					com_scroll_mode = true;
					return;
				}
			}
			if (command_hold) {
				trim_lines();
				handle_line_str(command_hold.trim(), true);
				com_scroll_mode = true;
				command_hold = null;
			}
			else {
			}
		}//»
		else if (kc(code,"LEFT")) {//«
			if (cur_scroll_command) insert_cur_scroll();
			let arr = get_com_arr();
			let pos;
			let start_x;
			let char_pos = null;
			let use_pos = null;
			let add_x = get_com_pos();
			if (add_x==0) return;
			start_x = add_x;
			if (arr[add_x] && arr[add_x] != " " && arr[add_x-1] == " ") add_x--;
			if (!arr[add_x] || arr[add_x] == " ") {
				add_x--;
				while(add_x > 0 && (!arr[add_x] || arr[add_x] == " ")) add_x--;
				char_pos = add_x;
			}
			else char_pos = add_x;
			if (char_pos > 0 && arr[char_pos-1] == " ") use_pos = char_pos;
			while(char_pos > 0 && arr[char_pos] != " ") char_pos--;
			if (char_pos == 0) use_pos = 0;
			else use_pos = char_pos+1;
			for (let i=0; i < start_x - use_pos; i++) handle_arrow(LEFT_KEYCODE, "");
		}//»
		else if (kc(code,"RIGHT")) {//«
			if (cur_scroll_command) insert_cur_scroll();
			let arr;
			arr = get_com_arr();
			let pos;
			let start_x;
			let char_pos = null;
			let use_pos = null;
			let add_x = get_com_pos();
			if (add_x == arr.length) return;
			else if (!arr[add_x]) return;
			start_x = add_x;
			if (arr[add_x] != " ") {
				add_x++;
				while(add_x != arr.length && arr[add_x] != " ") add_x++;
				char_pos = add_x;
				if (char_pos == arr.length) use_pos = char_pos;
				else {
					char_pos++;
					while(char_pos != arr.length && arr[char_pos] == " ") char_pos++;
					use_pos = char_pos;
				}
			}
			else {
				add_x++;
				while(add_x != arr.length && arr[add_x] == " ") add_x++;
				use_pos = add_x;
			}
			for (let i=0; i < use_pos - start_x; i++) handle_arrow(KC["RIGHT"], "");
		}//»
	}//»

};//»
const handle_page=(sym)=>{//«
	if (sym=="HOME_") {//«
		if (cur_shell) return;
		if (bufpos < history.length) {
			if (command_hold == null && bufpos == 0) {
				command_hold = get_com_arr().join("");
				command_pos_hold = get_com_pos() + prompt_len;
			}
			bufpos = history.length;
			let str = history[0];
			if (str) {
				trim_lines();
				handle_line_str(str.trim(), true);
			}
		}
	}//»
	else if (sym=="END_") {//«
		if (cur_shell) return;
		if (bufpos > 0) {
			bufpos = 0;
			if (command_hold!=null) {
				trim_lines();
				handle_line_str(command_hold.trim(), true);
				command_hold = null;
			}
		}
	}//»
};//»
const handle_backspace=()=>{//«
	let prevch = lines[cy()][cx()-1];
	if (((y+scroll_num) ==  cur_prompt_line) && (x == prompt_len)) return;
	else {
		let do_check = true;
		let is_zero = null;
		if (cx()==0 && y==0) return;
		if (cx()==0 && (cy()-1) < cur_prompt_line) return;
		if (cur_scroll_command) insert_cur_scroll();

		if (cx()==0 && cy() > 0) {//«
			if (lines[cy()].length < w) {//«
				let char_arg = lines[cy()][0];
				if (char_arg) {
					check_line_len(-1);
					is_zero = true;
					lines[cy()].splice(x, 1);
					lines[cy()-1].pop();
					lines[cy()-1].push(char_arg);
					y--;
					x = lines[cy()].length - 1;
					render();
				}
				else {
					lines[cy()-1].pop();
					lines.splice(cy(), 1);
					y--;
					x=lines[cy()].length;
					check_line_len();
					render();
					return;
				}
			}//»
			else {//«
				y--;
				do_check = true;
				lines[cy()].pop();
				x = lines[cy()].length;
				render();
			}//»
		}//»
		else {//«
			x--;
			lines[cy()].splice(x, 1);
		}//»

		let usey=2;
		if (!is_zero) {
			usey = 1;
			do_check = true;
		}

		if (do_check && lines[cy()+usey] && lines[cy()].length == w-1) {//«
			let char_arg = lines[cy()+usey][0];
			if (char_arg) lines[cy()].push(char_arg);
			else lines.splice(cy()+usey, 1);
			if(lines[cy()+usey]) {//«
				lines[cy()+usey].splice(0, 1);
				let line;
				for (let i=usey+1; line = lines[cy()+i]; i++) {
					let char_arg = line[0];
					if (char_arg) {
						line.splice(0,1);
						lines[cy()+i-1].push(char_arg);
						if (!line.length) lines.splice(i+1, 1);
					}
				}
			}//»
		}//»

	}
	render();
};//»
const handle_delete=(mod)=>{//«
	if (mod == "") {
		if (lines[cy()+1]) {
			handle_arrow(KC.RIGHT, "");
			handle_backspace();
		}
		else {
			lines[cy()].splice(x, 1);
			render();
		}
	}
};
//»
const handle_enter=async(if_paste)=>{//«
	if (!sleeping){
		bufpos = 0;
		command_hold = null;
		let str;
		if (cur_shell) {//«
//cwarn("Enter with cur_shell!!!");
//			let ret = get_com_arr(1);
//			if (str == null) return response_end();
//			str = ret.join("");
			return;
		}//»
		else {//«
			if (cur_scroll_command) str = insert_cur_scroll();
			else str = get_com_arr().join("");
			if (!str) {
				ENV['?']="0";
				response_end();
				return;
			}
		}//»
		x=0;
		y++;
		lines.push([]);
		if (!str || str.match(/^ +$/)) return response_end();
		if (str) {
			last_com_str = str;
		}
		if (!if_paste) sleeping = true;
		scroll_into_view();
		render();
		await execute(str);
		sleeping = null;
	}
};//»
const handle_letter_press=(char_arg, if_no_render)=>{//«
	const dounshift=(uselines)=>{//«
		if ((uselines[cy()].length) > w) {
			let use_char = uselines[cy()].pop()
			if (!uselines[cy()+1]) uselines[cy()+1] = [use_char];
			else uselines[cy()+1].unshift(use_char);
			if (x==w) {
				x=0;
				y++;
			}
			for (let i=1; line = uselines[cy()+i]; i++) {
				if (line.length > w) {
					if (uselines[cy()+i+1]) uselines[cy()+i+1].unshift(line.pop());
					else uselines[cy()+i+1] = [line.pop()];
				}
				else {
					if (uselines[cy()+i-1].length > w) {
						line.unshift(uselines[cy()+i-1].pop());
					}
				}
			}
		}
	};//»
	let line;
	if (lines && lines[scroll_num + y]) {
		if ((x) < lines[scroll_num + y].length && lines[scroll_num + y][0]) {
			lines[scroll_num + y].splice(x, 0, char_arg);
			shift_line(x-1, y, x, y);
		}
	}

	let usex = x+1;
	let usey = y;
	y = usey;

	let endch = null;
	let didinc = false;
	if (usex == w) {
		if (lines[cy()][cx()+1]) endch = lines[cy()].pop();
		didinc = true;
		usey++;
		usex=0;
	}
	if (!lines[cy()]) {//«
		lines[cy()] = [];
		lines[cy()][0] = char_arg;
	}//»
	else if (lines[cy()] && char_arg) {//«
		let do_line = null;
		if (lines[cy()][x]) do_line = true;
		lines[cy()][x] = char_arg;
	}//»
	let ln = lines[scroll_num+usey];
	if (ln && ln[usex]) {//«
		if (x+1==w) {
			if (!didinc) {
				usey++;
				usex=0;
			}
			if (endch) {
				if (!ln||!ln.length||ln[0]===null) lines[scroll_num+usey] = [endch];
				else ln.unshift(endch);	
			}
		}
		else usex = x+1;
	}//»
	else {//«
		if (!ln||!ln.length||ln[0]===null) {
			lines[scroll_num+usey] = [endch];
		}
	}//»
	x = usex;
	y = usey;
	dounshift(lines);
	scroll_into_view(8);
	if (!if_no_render) render();
	if (textarea) textarea.value = "";
};//»


const handle_priv=(sym, code, mod, ispress, e)=>{//«
	if (sleeping) {
		if (ispress || sym=="BACK_") return;
	}
	if (cur_shell){
		if (sym==="c_C") {
			cur_shell = null;
			sleeping = false;
			response("^C");
			response_end();
			cancelled_time = (new Date).getTime();
		}
		return;
	}
	if (!lines[cy()]) {
		if (code == 75 && alt) return;
		else {
			if (cy() > 1 && !lines[cy()-1]) set_prompt();
			else lines[cy()] = [null];
		}
	}
	let ret = null;
 	if (ispress) {
		num_ctrl_d = 0;
		if (buffer_scroll_num!==null){
			buffer_scroll_num = null;
			x = hold_x;
			y = hold_y;
			render();
		}
		if (cur_scroll_command) insert_cur_scroll();
		if (code == 0) return;
		else if (code == 1 || code == 2) code = 32;
		else if (code == 8226 || code == 9633) code = "+".charCodeAt();
		else if (code == 8211) code = "-".charCodeAt();
		else if (code == 3) {}
		else if (code < 32) code = 127;
		ret = handle_letter_press(String.fromCharCode(code)); 
	}
	else {
		if (sym == "d_C") return do_ctrl_D();
		num_ctrl_d = 0;
		if (buffer_scroll_num!==null){
			buffer_scroll_num = null;
			x = hold_x;
			y = hold_y;
			render();
		}
		if (code >= 37 && code <= 40) handle_arrow(code, mod, sym);
		else if (sym=="HOME_"||sym=="END_") handle_page(sym);
		else if (code == KC['DEL']) handle_delete(mod);
		else if (sym=="TAB_") handle_tab();
		else if (sym=="BACK_")  handle_backspace();
		else if (sym=="ENTER_") handle_enter();
		else if (sym == "c_C") do_ctrl_C();
		else if (sym == "k_C") do_clear_line();
		else if (sym == "y_C") {
			for (let i=0; i < current_cut_str.length; i++) handle_letter_press(current_cut_str[i]);
		}
		else if (sym == "c_CAS") clear();
		else if (sym=="a_C") {//«
			e.preventDefault();
			if (cur_scroll_command) insert_cur_scroll();
			x=prompt_len;
			y=cur_prompt_line - scroll_num;
			if (y<0) {
				scroll_num+=y;
				y=0;
			}
			render();
		}//»
		else if (sym=="e_C") {//«
			if (cur_scroll_command) insert_cur_scroll();
			y=lines.length-scroll_num-1;
			if (y>=h){
				scroll_num+=y-h+1
				y=h-1;
			}
			if (lines[cy()].length == 1 && !lines[cy()][0]) x = 0;
			else x=lines[cy()].length;
			render();
		}//»
		else if (sym=="l_A") log(line_colors);
	}
	return ret;
};
//»
const handle=(sym, e, ispress, code, mod)=>{//«
	let marr;
	if (terminal_locked) return;
	if (is_scrolling){
		if (!ispress) {
			if (sym.match(/^[A-Z]+_$/)){
				if (sym==="SPACE_") return;
			}
			else return;
		}
		scroll_num = scrollnum_hold;
		is_scrolling = false;
		render();
		return;
	}
	if (e && sym=="d_C") e.preventDefault();
	if (!ispress) {//«
		if (sym == "=_C") {
			e.preventDefault();
			set_new_fs(gr_fs+1);
			return;
		}
		else if (sym == "-_C") {
			e.preventDefault();
			if (gr_fs-1 <= min_fs) return;
			set_new_fs(gr_fs-1);
			return;
		}
		else if (sym=="0_C") {
			gr_fs = def_fs;
			set_new_fs(gr_fs);
			return;
		}
		else if (sym=="c_CS") return do_clipboard_copy();
		else if (sym=="v_CS") return do_clipboard_paste();
		else if (sym=="a_CA") return do_copy_buffer();
		else if (sym=="p_CA"){
			PARAGRAPH_SELECT_MODE = !PARAGRAPH_SELECT_MODE;
			do_overlay(`Paragraph select: ${PARAGRAPH_SELECT_MODE}`);
			return;
		}
	}//»
	if (code == KC['TAB'] && e) e.preventDefault();
	else await_next_tab = null;
	if (e&&sym=="o_C") e.preventDefault();

	if (pager) {//«
		pager.key_handler(sym, e, ispress, code);
		return 
	}//»
	else if (editor) return editor.key_handler(sym, e, ispress, code);

	if (ispress){}
	else if (!sym) return;

	handle_priv(sym, code, mod, ispress, e);
};
//»

//»
//Init«

const init = async(appargs={})=>{
	ENV['USER'] = globals.CURRENT_USER;
	this.cur_dir = get_homedir();
	let gotfs = localStorage.Terminal_fs;
	if (gotfs) {
		let val = strnum(gotfs);
		if (isnum(val,true)) gr_fs = val;
		else {
			gr_fs = def_fs;
			delete localStorage.Terminal_fs;
		}
	}
	else gr_fs = def_fs;
	wrapdiv._fs = gr_fs;
	resize();
	let {reInit} = appargs;
	if (!reInit) reInit = {};
	let {termBuffer, addMessage, commandStr} = reInit;
//	let gotbuf = reInit.termBuffer;
	if (termBuffer) history = termBuffer;
	else {
		let arr = await get_history();
		if (!arr) history = [];
		else {
			arr.pop();
			arr = arr.reverse();
			arr = capi.uniq(arr);
			history = arr.reverse();
		}
	}

	let init_prompt = `System shell\x20(${winid.replace("_","#")})`;
	if (addMessage) init_prompt = `${addMessage}\n${init_prompt}`;
	response(init_prompt.split("\n"));
	did_init = true;
	sleeping = false;
	shell = new Shell(this);
	set_prompt();
	render();
	if (commandStr) {
		for (let c of commandStr) handle_letter_press(c); 
		handle_enter();
	};
};
//»
//Obj/CB«

this.onappinit = init;
this.onescape=()=>{//«
textarea&&textarea.focus();
	if (check_scrolling()) return true;
	let dorender=false;
	if (buffer_scroll_num !== null) {
		buffer_scroll_num = null;
		x = hold_x;
		y = hold_y;
		dorender = true;
	}
	if (dorender) return true;
	return false;
}
//»
this.onsave=()=>{//«
	if (editor) editor.save();
}//»
this.onkill = (if_dev_reload)=>{//«


	if (this.cur_edit_node) this.cur_edit_node.unlockFile();
	this.reInit={
		termBuffer: history
	};
	if (!if_dev_reload) return savehist();
	let actor = editor||pager;
	let s="";
	if (DEL_MODS.length) s+=`Deleted mods: ${DEL_MODS.join(",")}`;
	if (DEL_COMS.length) {
		if (s) s+="\n";
		s+=`Deleted coms: ${DEL_COMS.join(",")}`;
	}
	if (!s) return;
//	cwarn(`${s}`);
	delete_mods();
	this.reInit.addMessage=s;
	if (actor) this.reInit.commandStr = actor.command_str;
	savehist();

}//»
this.onfocus=()=>{//«
	topwin_focused=true;
	if (cur_scroll_command) insert_cur_scroll();
	render();
	textarea&&textarea.focus();
}//»
this.toggle_paste=()=>{//«
	if (textarea){
		textarea._del();
		textarea = null;	
		return "off";
	}
	textarea = make('textarea');
	textarea._noinput = true;
	textarea.width = 1;
	textarea.height = 1;
	textarea.style.opacity = 0;
	textarea.onpaste = onpaste;
	areadiv.appendChild(textarea);
	textarea.focus();
	return "on";
};//»
this.onblur=()=>{//«
	topwin_focused=false;
	render();
	if (cur_scroll_command) insert_cur_scroll();
	textarea && textarea.blur();
}//»
this.onresize = resize;
this.onkeydown=(e,sym,mod)=>{handle(sym,e,false,e.keyCode,mod);};
this.onkeypress=(e)=>{handle(e.key,e,true,e.charCode,"");};
this.overrides = {//«
	"UP_C": 1,
	"DOWN_C": 1,
	"LEFT_C": 1,
	"RIGHT_C": 1,
	"UP_CA": 1,
	"DOWN_CA": 1,
	"LEFT_CA": 1,
	"RIGHT_CA": 1,
	"h_CAS": 1,
	"d_CAS": 1,
	"c_CAS": 1,
	"o_CAS": 1,
	"l_C": 1,
	"k_C": 1,
	"l_A":1,
//	"c_A":1
};//»

//Terminal-specific methods

//Editor/Pager specific«

this.clipboard_copy=(s)=>{do_clipboard_copy(null,s);};
this.modequit=(arg)=>{//«
	let actor = editor||pager;
	scroll_num = scrollnum_hold;
	lines = lines_hold;
	line_colors = line_colors_hold;
	y = yhold;
	x = xhold;
	num_stat_lines = 0;
	delete this.is_editing;
	editor=pager=null;
	if (actor&&actor.cb) {
		actor.cb();
	}
//	return arg;
};
//»
this.hold_lines = ()=>{
	lines_hold = lines;
	line_colors_hold = line_colors;
};
this.set_lines = (linesarg, colorsarg)=>{
	lines = linesarg;
	line_colors = colorsarg;
};
this.init_edit_mode=(ed, nstatlns)=>{
	yhold=y;
	xhold=x;
	scrollnum_hold = scroll_num;
	scroll_num=x=y=0;
	editor = ed;
	num_stat_lines=nstatlns;
};
this.init_pager_mode=(pg, nstatlns)=>{
	yhold=y;
	xhold=x;
	scrollnum_hold = scroll_num;
	scroll_num=x=y=0;
	pager = pg;
	num_stat_lines=nstatlns;
};
this.stat_render=(arr)=>{
	if (arr.length > num_stat_lines){
cerr(`the arr argument has length ${arr.length} (expected <= ${num_stat_lines})`);
		return;
	}
	stat_lines = arr;
	render();
};
this.compare_last_line=(str)=>{
log(lines);
cwarn("compare", str);

};
//»
this.wrap_line = wrap_line;
this.dopaste=dopaste;
this.refresh = render;
this.fmt = fmt;
this.fmt_ls = fmt_ls;
this.fmt2 = fmt2;
this.clear=clear;
this.get_dir_contents=get_dir_contents;
this.get_homedir = get_homedir;
this.set_tab_size = (s)=>{//«
	if (!s.match(/[0-9]+/)) return;
	let n = parseInt(s);
	if (n==0||n>MAX_TAB_SIZE) return;
	tabdiv.style.tabSize = n;
	this.tabsize = tabdiv.style.tabSize;
	return true;
};//»
this.try_kill=()=>{//«
	if (editor) {
		editor.set_stat_message("Really close the window? [y/N]");
		render();
		editor.set_ask_close_cb();
	}
}//»

/*«Unused
this.is_busy=()=>{return !!cur_shell;}
»*/

//»

}; 

//»


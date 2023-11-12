# webos12  

## wut

even is it.

## Viewing and editing source files

vim is the recommended text editor, mainly because of the ability to enable row
folding via the manual insertion of markers.  Since the files in this
repository can be quite large, row folding is an essential feature of the
development side. The instructions below are specific to vim's runtime
configuration file, .vimrc.

### Enabling row folding

To browse the source code as intended, the following lines must be included in
your .vimrc:

	set foldmethod=marker
	set foldmarker=«,»
	set foldlevelstart=0

To quickly toggle between opened and closed row folds with the Enter key, add this line:

	nmap <enter> za

### Inserting fold markers

These instructions will enable the easy insertion of fold markers into your
code (from both normal and insert mode).

To insert an open fold marker, invoked with Alt+o, add these lines:

	execute "set <M-o>=\eo"
	nnoremap <M-o> a//«<esc>
	inoremap <M-o> //«

To insert a close fold marker, invoked with Alt+c, add these lines:

	execute "set <M-c>=\ec"
	nnoremap <M-c> a//»<esc>
	inoremap <M-c> //»

To insert both an open and close fold marker, with a space in between,
invoked with Alt+f, add these lines:

	execute "set <M-f>=\ef"
	nnoremap <M-f> a//«<enter><enter>//»<esc>
	inoremap <M-f> //«<enter><enter>//»


## Oldest to newest 

https://github.com/linuxontheweb/linuxontheweb.github.io

https://github.com/abc123os/abc123os.github.io


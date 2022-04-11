window.onerror = function(message, source, line, col, error) {
	try {
		// sometimes we don't get any useful information other than the filename
		if (error)
			Sidebar.print(error.stack)
		if (line)
			Sidebar.print(`ERROR: ${message}\nin ${source}\nat ${line}:${col}`)
		else
			Sidebar.print(`ERROR: ${message}\nin ${source}`)
	} catch(e) {
		console.error("error in window.onerror:", e, arguments)
		// yeah no
	}
}

immediate()

if (document.readyState == 'loading')
	document.addEventListener('DOMContentLoaded', dom_ready)
else
	dom_ready()

function immediate() {
	console.log("🌅 STARTING INIT")
	Sidebar.print("hi!\ncommit: "+window.COMMIT)
	
	// (we can access <html> even if DOMContentLoaded hasn't occurred yet)
	// dark theme
	let dark = window.matchMedia("(prefers-color-scheme: dark)")
	dark.onchange = (query) => View.flag('dark', query.matches)
	dark.onchange(dark)
	
	Req.try_load_auth()
	
	if (!Req.auth) {
		console.warn("🌇 Not logged in!")
		return
	}
	
	View.flag('loggedIn', true)
	
	Settings.early()
	
	// get own user
	Lp.chain({values:{uid:Req.uid}, requests:[{type:'user', fields:'*', query:'id = @uid'}]}, resp=>{
		let me = resp.user[0]
		if (!me) {
			console.error(resp, 'me?"')
			throw "missing user me?"
		}
		console.log("🌄 Got own userdata")
		Req.me = me
		do_when_ready(()=> View.update_my_user(Req.me))
	})
	
	Lp.start_websocket()
	
	Act.pull_recent()
	
	Nav.init()
}

function dom_ready() {
	console.log("🌄 DOCUMENT READY")
	
	// draw buttons
	// i really don't like this
	for (let button of document.querySelectorAll("button:not([data-noreplace])")) {
		let container = document.createElement('button-container')
		button.replaceWith(container)
		container.className += " "+button.className
		button.className = ""
		if (button.dataset.staticLink != undefined) {
			button.setAttribute('tabindex', "-1")
			let a = document.createElement('a')
			container.append(a)
			container = a
		}
		container.append(button)
	}
	
	// set up event handlers:
	
	// video player does not fire 'click' events so instead
	// need to detect when the video is played
	// using a custom event
	document.addEventListener('videoclicked', (e)=>{
		image_focus_click_handler(e.target, true)
	})
	document.onmousedown = (e)=>{
		if (!e.button && e.target) // 0 or none (prevent right click etc.)
			image_focus_click_handler(e.target)
	}
	
	let embiggened_image
	// clicking outside an image shrinks it
	// maybe could block this if the click is on a link/button?
	document.onclick = (e)=>{
		let element = e.target
		if (!(element instanceof HTMLTextAreaElement)) {
			if (embiggened_image && element != embiggened_image) {
				delete embiggened_image.dataset.big
				embiggened_image = null
			}
		}
	}
	
	function image_focus_click_handler(element, grow_only) {
		if (element.dataset.shrink != null) {
			// if click on image that's already big:
			if (embiggened_image && embiggened_image == element) {
				if (!grow_only) {
					delete embiggened_image.dataset.big
					embiggened_image = null
				}
			} else if (element != embiggened_image) { // if click on new iamge
				embiggened_image && delete embiggened_image.dataset.big
				element.dataset.big = ""
				embiggened_image = element
			}
		}
	}
	
	Sidebar.onload()
	
	print("running "+run_on_load.length+" deferred items")
	do_when_ready = x=>x()
	run_on_load.forEach(x=>x())
	run_on_load = null
	
	//danger: View.onload() can potentially run after view.start() (but before view.render())  TODO
}

// HTML RENDERING

<!--/* trick indenter
var Draw = Object.create(null)
with (Draw) (function($) { "use strict"
Object.assign(Draw, { //*/

avatarURL: function(user, params) {
	if (!user || !user.avatar)
		return "resource/avatar.png"
	return Req.fileURL(user.avatar, params)
},

largeIcon: function(entity) {
	var element = document.createElement('img')
	if (entity.Type == 'user')
		element.src = avatarURL(entity, "size=400&crop=true")
	else
		element.src = "resource/unknown.png"
	return entity
},

// icon + name
iconTitle: function(entity, reverse) {
	var element = document.createDocumentFragment()
	if (reverse) {
		element.appendChild(title(entity))
		element.appendChild(document.createTextNode(" "))
		element.appendChild(icon(entity))
	} else {
		element.appendChild(icon(entity))
		element.appendChild(document.createTextNode(" "))
		element.appendChild(title(entity))
	}
	return element
},

entityLink: function(entity) {
	var path = Nav.entityPath(entity);
	if (path)
		var element = Nav.link(path)
	else
		element = document.createElement('span')
	return element
},

// page (or category) wiht user
pageBar: function(page) {
	var bar = entityTitleLink(page)
	if (page.createUser) {
		var usr = entityTitleLink(page.createUser, true)
		usr.className += " rightAlign"
		bar.appendChild(usr)
	}
	return bar
},

entityTitleLink: function(entity, reverse) {
	var element = entityLink(entity)
	var icon = iconTitle(entity, reverse)
	element.appendChild(icon)
	return element
},

title: function(entity) {
	var element = document.createElement('span')
	element.textContent = entity ? entity.name : "MISSINGNO."
	element.className = 'textItem pre entity-title'
	return element
},

textItem: function(text) {
	var element = document.createElement('span')
	element.textContent = text
	element.className = 'textItem pre'
	return element
},

iconURL: function(entity) {
	if (entity.Type == 'user') {
		return 
	} else if (entity.Type == 'category')
		return "resource/category.png"
	else if (entity.Type == 'content') {
		if (!hasPerm(entity.permissions, 0, 'r'))
			return "resource/hiddenpage.png"
		// todo: hidden icon
		return "resource/page.png"
	}
	return "resource/unknown.png"
},

chatMessagePane: function() {
	var outer = document.createElement('scroll-outer')
	outer.className = "grow chatScroller"
	outer.hiddden = true
	var inner = document.createElement('scroll-inner')
	outer.appendChild(inner)
	return [outer, inner]
},

userList: function() {
	var outer = document.createElement('div')
	outer.className = "bar rem2-3 userlist"
	var inner = document.createElement('span')
	outer.appendChild(inner)
	var b = button()
	b[1].textContent = "Hide"
	b[0].className += " rightAlign item loggedIn"
	outer.appendChild(b[0])
	return [outer, inner, b[1]]
},

userListAvatar: function(status) {
	var a = linkAvatar(status.user)
	if (status.status == "idle")
		a.className += " status-idle"
	return a
},

sidebarDebug: function(text) {
	var x = document.createElement('div')
	x.className = 'debugMessage pre'
	x.textContent = text
	return x
},

linkAvatar: function(user) {
	var a = entityLink(user)
	a.appendChild(avatar(user))
	a.title = user.username
	return a
},

avatar: function(user) {
	var element = document.createElement('img')
	element.className += "item avatar"
	element.src = avatarURL(user, "size=120&crop=true")
	return element
},

fileThumbnail: function(file, onclick) {
	var div = document.createElement('div')
	div.className = "fileThumbnail item"
	/*div.onclick = function() {
		selectFile(file)
		}*/
	div.setAttribute('data-id', file.id)
	var img = document.createElement('img')
	img.src = Req.fileURL(file.id, "size=50")
	img.alt = file.name
	img.title = file.name
	div.appendChild(img)
	if (onclick) {
		div.onclick = function(e) {
			onclick(file, e)
		}
	}
	return div
},

icon: function(entity) {
	var element
	if (entity && entity.Type == 'user') {
		element = document.createElement('img')
		element.className += "item icon avatar"
		element.src = avatarURL(entity, "size=120&crop=true")
	} else {
		element = document.createElement('span')
		element.setAttribute('role', 'img')
		element.className = "item icon iconBg"
		if (!entity) {
			element.style.backgroundImage = "url('resource/unknown.png')"
		} else if (entity.Type == 'category')
			element.style.backgroundImage = "url('resource/category.png')"
		else if (entity.Type == 'content') {
			if (!hasPerm(entity.permissions, 0, 'r'))
				element.style.backgroundImage = "url('resource/hiddenpage.png')"
			else
				element.style.backgroundImage = "url('resource/page.png')"
		} else
			element.style.backgroundImage = "url('resource/unknown.png')"
	}
	return element
},

markup: function(page) {
	if (page.values)
		var lang = page.values.markupLang
	return Parse.parseLang(page.content, lang, true)
},

titlePath: function(path) {
	var element = document.createDocumentFragment()
	if (!path)
		return element
	path.forEach(function(item, i, path) {
		if (item) { //todo: use entities here instead
			var link = Nav.link(item[0])
			link.textContent = item[1]
			link.className = "textItem pre entity-title"
			element.appendChild(link)
		}
		
		if (i < path.length-1) {
			var slash = document.createElement('span')
			slash.textContent = "/"
			slash.className = "pathSeparator textItem"
			element.appendChild(slash)
		}
	})
	return element
},
// I wonder if maybe there should be a message split when
// avatar changes
// but perhaps this can be abused, and it's probably annoying anyway...
messageBlock: function(comment) {
	var user = comment.createUser || {} //fix for deleted comments?
	var date = comment.createDate
	
	var div = document.createElement('message-block')
	
	var timeStamp = document.createElement('time')
	timeStamp.setAttribute("datetime", date+"")
	timeStamp.textContent = timeString(date)
	div.appendChild(timeStamp)
	
	var av = +comment.meta.a
	if (av)
		user = Object.create(user, { //TODO: this breaks if user is undefined (which I think is possible?) YES
			// also used by commentTitle
			avatar: {value: av}
		})
	div.appendChild(avatar(user))
	
	var name = document.createElement('span')
	name.className = 'username'
	name.textContent = user.name+":"
	div.appendChild(name)
	
	var contentBox = document.createElement('message-contents')
	div.appendChild(contentBox)
	div.setAttribute('data-uid', comment.createUserId)
	return [div, contentBox]
},
messagePart: function(comment){
	var element = document.createElement('message-part')
	element.className = "markup-root"
	element.setAttribute('data-id', comment.id)
	element.setAttribute('tabindex', "0")
	var contents = Parse.parseLang(comment.content, comment.meta.m, false)
	if (comment.createDate.getTime() != comment.editDate.getTime())
		element.className += " edited"
	element.appendChild(contents)
	return element
},
timeString: function(date) {
	if (new Date()-date > 1000*60*60*12) {
		var options = {year:'numeric',month:'long',day:'numeric',hour:'2-digit', minute:'2-digit'}
	} else {
		options = {hour:'2-digit', minute:'2-digit'}
	}
	return date.toLocaleString([], options)
},

button: function() {
	var container = document.createElement("div")
	container.className = "buttonContainer"
	var button = document.createElement("button")
	container.appendChild(button)
	return [container, button]
}, // BAD ↕
linkButton: function() {
	var container = document.createElement("div")
	container.className = "buttonContainer"
	var a = document.createElement('a')
	container.appendChild(a)
	var button = document.createElement("button")
	a.appendChild(button)
	return [container, button]
},
pageInfo: function(page) {
	var e = document.createElement('div')
	e.className = "pageInfoPane rem2-3 bar bottomBorder"
	//with(e){
	e.appendChild(authorBox(page))
	var b = linkButton()
	b[1].textContent = "Edit"
	Nav.link("editpage/"+page.id, b[1].parentNode)
	b[0].className += " item"
	e.appendChild(b[0])
	return e
},
sidebarTabs: function(list, callback) {
	var d = document.createElement('table')
	d.className = "tabs"
	var r = document.createElement('tr')
	d.appendChild(r)
	var btns = []
	var x = {
		elem: d,
		select: function(i) {
			list.forEach(function(item, i2) {
				btns[i2].setAttribute('aria-selected', i==i2)
				item.elem.hidden = i!=i2
			})
		},
	}
	list.forEach(function(item, i) {
		var td = document.createElement('td')
		var btn = document.createElement('button')
		btn.setAttribute('role', "tab")
		btn.setAttribute('aria-selected', "false")
		btn.id = "sidebar-tab-"+i
		btn.setAttribute('aria-controls', "sidebar-panel-"+i)
		td.appendChild(btn)
		r.appendChild(td)
		btn.textContent = item.label
		btns[i] = btn
		btn.onclick = function() {
			x.select(i)
		}
	})
	return x
},
setBgImage: function(element, url) {
	element.style.backgroundImage = ""
	if (url)
		element.style.backgroundImage = "url(\""+url+"\")" //todo: escape chars in url!
	
},
activityItem: function(item) {
	var bar = entityTitleLink(item.content)
	bar.className += " linkBar bar rem1-5"
	bar.appendChild(document.createTextNode(" "))
	var time = timeAgo(item.lastDate)
	time.className += " textItem"
	bar.appendChild(time)
	bar.appendChild(document.createTextNode(" "))
	//bar.appendChild(textItem("("+item.count+")"))
	item.users.forEach(function(u) {
		if (u)
			bar.appendChild(icon(u))
	})
	return bar
},
navButtons: function(callback) {
	var prev = button()
	prev[0].className += " item"
	var next = button()
	next[0].className += " item"
	var page = textItem()
	prev[1].textContent = "<"
	next[1].textContent = ">"
	page.textContent = 1
	var e = document.createDocumentFragment()
	e.appendChild(prev[0])
	e.appendChild(next[0])
	e.appendChild(page)
	var x = {
		value: 1,
		element: e,
		onchange: function(){},
		set: function(p) {
			x.value = p
			page.textContent = p
		}
	}
	prev[1].onclick = function(){
		change(-1)
	}
	next[1].onclick = function(){
		change(1)
	}
	function change(d) {
		if (x.value+d < 1)
			return
		x.value += d
		x.onchange(x.value)
	}
	return x
},

authorBox: function(page) {
	var element = document.createDocumentFragment()
	if (!page)
		return element
	element.appendChild(pageEditedTime("Author:", page.createDate))
	element.appendChild(document.createTextNode(" "))
	element.appendChild(entityTitleLink(page.createUser, true))
	if (page.editUserId != page.createUserId) {
		element.appendChild(document.createTextNode(" "))
		element.appendChild(pageEditedTime("Edited by:", page.editDate))
		element.appendChild(entityTitleLink(page.editUser, true))
	} else if (page.createDate != page.editDate) { //edited by same user
		element.appendChild(document.createTextNode(" "))
		element.appendChild(pageEditedTime("Edited", page.editDate))
	}
	return element
},

pageEditedTime: function(label, time) {
	var b = document.createElement('span')
	b.className = "item"

	var a = document.createElement('div')
	a.className = "half half-label"
	a.textContent = label
	b.appendChild(a)

	a = timeAgo(time)
	a.className += " half"
	b.appendChild(a)
	return b
},

timeAgo: function(time) {
	var t = document.createElement('time')
	t.setAttribute('dateTime', time.toISOString())
	t.textContent = timeAgoString(time)
	t.title = ""+time
	return t
},

timeAgoString: function(date) {
	var seconds = Math.floor((Date.now() - date.getTime()) / 1000)
	var interval = Math.floor(seconds / 31536000)
	if (interval >= 1) return interval + " years ago"
	interval = Math.round(seconds / 2592000)
	if (interval >= 1) return interval + " months ago"
	interval = Math.round(seconds / 86400)
	if (interval >= 1) return interval + " days ago"
	interval = Math.round(seconds / 3600)
	if (interval >= 1) return interval + " hours ago"
	interval = Math.round(seconds / 60)
	if (interval >= 1) return interval + " minutes ago"
	if (seconds < 0)
		return " IN THE FUTURE?"
	return Math.round(seconds) + " seconds ago"
},

categoryInput: function() {
	var elem = document.createElement('select')
	var x = {
		element: elem,
		set: function(id) {
			elem.value = id
		},
		get: function() {
			return +elem.value
		},
		update: function() {
			elem.replaceChildren()
			var list = []
			categoryList(Entity.categoryMap[0], list)
			list.forEach(function(item) {
				var x = document.createElement('option')
				x.textContent = item[0]
				x.value = item[1]
				elem.appendChild(x)
			})
		}
	}
	function categoryList(node, ret, depth) {
		depth = depth || 0
		ret.push([">".repeat(depth)+" "+node.name, node.id])
		node.children && node.children.forEach(function(node) {
			categoryList(node, ret, depth+1)
		})
	}
	return x
},

permissionInput: function() {
	var elem = document.createElement('input')
	var x = {
		element: elem,
		set: function(perms) {
			elem.value = JSON.stringify(perms)
		},
		get: function() {
			return JSON.parse(elem.value)
		}
	}
	return x
},

userSelector: function() {
	var elem = document.createElement('user-select')
	elem.className = "bar rem1-5"
	var input = document.createElement('input')
	input.placeholder = "Search Username"
	input.className = "item"
	var dropdown = document.createElement('select')
	dropdown.className = "item"
	var placeholder = document.createElement('option')
	placeholder.textContent = "select user..."
	placeholder.disabled = true
	placeholder.hidden = true
	
	var placeholder2 = document.createElement('option')
	placeholder2.textContent = "loading..."
	placeholder2.disabled = true
	placeholder2.hidden = true
	
	var submit = document.createElement('button')
	submit.textContent = "select"
	submit.disabled = true
	submit.className = "item"
	
	var results = null
	
	var x = {
		elem: elem,
		searchText: null,
	}
	input.oninput = function() {
		reset()
	}
	input.onkeypress = function(e) {
		if (e.keyCode == 13) {
			e.preventDefault()
			dropdown.focus()
		}
	}
	dropdown.onkeypress = function(e) {
		if (e.keyCode == 13 && dropdown.value) {
			e.preventDefault()
			submit.click()
		}
	}
	dropdown.onfocus = function() {
		if (input.value == x.searchText)
			return
		x.searchText = input.value
		dropdown.replaceChildren(placeholder2)
		placeholder2.selected = true
		results = true
		Req.searchUsers(x.searchText, function(users) {
			dropdown.replaceChildren()
			if (!users) {
				x.searchText = null //error
				return
			}
			results = users
			submit.disabled = false
			var found = false
			users.forEach(function(user) {
				var option = document.createElement('option')
				option.value = user.id
				option.textContent = user.username
				dropdown.appendChild(option)
				found = true
			})
			if (!found) {
				var option = document.createElement('option')
				option.value = "0"
				option.textContent = "(no results)"
				option.disabled = true
				dropdown.appendChild(option)
				dropdown.value = "0"
				input.focus()
			}
		})
	}
	submit.onclick = function() {
		var uid = dropdown.value
		if (uid) {
			x.onchange(results[uid])
			input.focus()
			input.value=""
			reset()
		}
	}
	function reset() {
		if (results) {
			submit.disabled = true
			dropdown.replaceChildren(placeholder)
			placeholder.selected = true
			results = null
			x.searchText = null
		}
	}
	
	elem.appendChild(input)
	elem.appendChild(dropdown)
	elem.appendChild(submit)
	results = true
	reset()
	return x
},

messageControls: function() {
	var elem = document.createElement('message-controls')
	var x = {
		elem: elem
	}
	var btn = button()
	elem.appendChild(btn[0])
	btn[1].onclick = function() {
		x.onclick()
	}
	btn[1].tabIndex = "-1"
	btn[1].textContent = "edit"
	btn[0].className += " rightAlign loggedIn"
	return x
},

<!--/* 
}) //*/

function hasPerm(perms, id, perm) {
	return perms && perms[id] && perms[id].indexOf(perm) != -1
}
	
<!--/*
}(window)) //*/ // pass external values


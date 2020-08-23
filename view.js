<!--/* trick indenter
var View = Object.create(null)
with (View) (function($) { "use strict"
Object.assign(View, { //*/

// create public variables here
views: {
	"": {
		className: 'homeMode',
		render: function() {
			setPath()
			var text = "Welcome to SmileBASIC Source 2!"
			//var index = $.Math.random()*(text.length-1)|0
			//text = text.substring(0,index)+text[index+1]+text[index]+text.substr(index+2)
			setTitle(text)
		}
	},
	login: {
		className: 'registerMode',
		render: function() {
			setPath()
			setTitle("Log-in or Create an Account")
		}
	},
	test: {
		className: 'testMode',
		render: function() {
			setPath()
			setTitle("Testing")
		}
	},
	user: {
		start: function(id, query, render) {
			return $.Req.getUserView(id, render)
		},
		className: 'userMode',
		render: function(user, userpage, activity, ca, content) {
			if (!user)
				return //er
			setEntityTitle(user)
			$userPageAvatarLink.href = Req.fileURL(user.avatar)
			$userPageAvatar.src = Req.fileURL(user.avatar, "size=400&crop=true")
			setPath([["users","Users"], [Nav.entityPath(user), user.name]])
			if (userpage)
				$userPageContents.replaceChildren(Draw.markup(userpage))
			else
				$userPageContents.replaceChildren()
		},
		cleanUp: function() { //todo: this probably needs more info to tell what next page is (so, whether to delete certain things)
			$userPageAvatar.src = ""
			$userPageContents.replaceChildren()
		}
	},
	page: {
		start: function(id, query, render) {
			return $.Req.getPageView(id, render)
		},
		className: 'pageMode',
		render: function(page) {
			if (!page)
				return
			//todo: some kind of common error handler?
			setEntityTitle(page)
			setEntityPath(page)
			$pageContents.replaceChildren(Parse.parseLang(page.content, page.values.markupLang))
		},
		cleanUp: function() {
			$pageContents.replaceChildren()
		}
	},
	category: {
		start: function(id, query, render) {
			return $.Req.getCategoryView(id, render)
		},
		className: 'categoryMode',
		render: function(category, cats, pages, pinned) {
			if (!category)
				return
			setEntityTitle(category)
			setEntityPath(category)
			$categoryDescription.replaceChildren(Parse.parseLang(category.description, category.values.markupLang))
			$categoryCategories.replaceChildren()
			category.children.forEach(function(child) {
				var bar = Draw.entityTitleLink(child)
				bar.className += " categoryPage bar rem2-3"
				$categoryCategories.appendChild(bar)
			});
			pinned.forEach(function(page) {
				var bar = Draw.pageBar(page)
				bar.className += " categoryPage bar rem2-3"
				$categoryCategories.appendChild(bar)
			})
			pages.forEach(function(page) {
				var bar = Draw.pageBar(page)
				bar.className += " categoryPage bar rem2-3"
				$categoryPages.appendChild(bar)
			})
		},
		cleanUp: function() {
			$categoryCategories.replaceChildren()
			$categoryPages.replaceChildren()
			$categoryDescription.replaceChildren()
		}
	},
	pages: {
		redirect: 'page'
	},
	chat: {
		start: function(id, query, render) {
			return $.Req.getChatView(id, render)
		},
		className: 'chatMode',
		render: function(page, comments) {
			console.log(page)
			setEntityTitle(page)
			setEntityPath(page)
			var lastUid = NaN
			var lastBlock;
			comments.forEach(function(comment) {
				var uid = comment.createUserId
				if (!lastBlock || uid != lastUid) {
					lastBlock = Draw.messageBlock(comment.createUser, comment.createDate)
					$messageList.appendChild(lastBlock[0])
				}
				lastBlock[1].appendChild(Draw.messagePart(comment))
				lastUid = uid
			})
		},
		cleanUp: function() {
			$messageList.replaceChildren()
		},
		init: function() {
		}
	},
	template: {
		start: function(id, query, render) {
			// this should make a request for data from the api
			// and call `render` when it's finished
			// DO NOT MODIFY ANY HTML IN THIS FUNCTION
			// If you don't need to load anything asynchronously,
			// you can leave out this function and `render` will be
			// called immediately instead (with arguments (id, query, type))
			render(1,2,3,4)
		},
		className: 'templateMode', // the className of <body> is set to this
		render: function(a,b,c,d) {
			// this function is called after the data is recieved, and
			// should render the page
		},
		cleanUp: function() {
			// this is called before switching to another page,
			// to remove any unneeded content that was created by `render`
		},
		init: function() {
			// this is called when the page initially loads
			// (in the future, it may be deferred until the view is visited
			// for the first time)
		}
	},
},
errorView: {
	className: 'errorMode',
	render: function(id, query, type) {
		setPath()
		setTitle("Unknown page type: \""+type+"\"")
	}
},
getView: function(name) {
	var view = views[name]
	while (view && view.redirect) //danger!
		view = views[view.redirect]
	return view || errorView
},

setEntityTitle: function(entity) {
	$pageTitle.replaceChildren(Draw.iconTitle(entity))
	$.document.title = entity.name
},
setTitle: function(text) {
	$pageTitle.textContent = text
	$.document.title = text
},

setPath: function(path) {
	$navPane.replaceChildren(Draw.titlePath(path))
},
setEntityPath: function(page) {
	if (page.type == 'category')
		var node = page
	else
		node = page.parent
	var path = []
	while (node) {
		path.unshift([Nav.entityPath(node), node.name])
		node = node.parent
	}
	if (page.type == 'category')
		path.push(null)
	else
		path.push([Nav.entityPath(page), page.name])
	setPath(path)
},

loadStart: function() {
	flag('loading', true)
},
loadEnd: function() {
	flag('loading', false)
},

flags: {},
flag: function(flag, state) {
	if (!flags[flag] != !state) {
		if (state)
			flags[flag] = true
		else
			delete flags[flag]
		var cls = ""
		for (flag in flags)
			cls += " f-"+flag
		$.document.documentElement.className = cls
	}
},

onLoad: function() {
	for (var n in views) {
		views[n].name = n
		if (views[n].init)
			views[n].init()
		// maybe we can just call these the first time the view is visited instead of right away,
		// though none of them should really take a significant amount of time, so whatver
	}
}

<!--/* 
}) //*/

// create private variables here
// these will override public vars

var x = views

<!--/*
}(window)) //*/ // pass external values


//todo: rename resource to avoid collision with request.js

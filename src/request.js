function arrayToggle(array, value) {
	let i = array.indexOf(value)
	if (i<0) {
		array.push(value)
		return true
	}
	array.splice(i, 1)
	return false
}

const Req = {
	on_login() {
		console.log("login")
		View.flag('loggedIn', true)
		
		// display user info etc.
		// start long poller
		console.log("staring long poller")
		if (Store.get('websocket'))
			Lp.start(true)
		else
			Lp.start(false)
		
		Act.pull_recent()
		//TODO
		// update currently viewed page (in case page was hidden)
	},
	on_logout() {
		View.flag('loggedIn', false)
		//this is all messy
		window.location.reload()
	},
	on_guest_load() {
		Act.pull_recent()
	},
	
	auth: null,
	storage_key: "auth",
	//storage_key = "devauth"
	
	server: "smilebasicsource.com/api", // no you can't add "https://" to this string, because we need to use wss:// in another place
	
	uid: null,
	
	me: null,
	
	locked: false, // for testing
	
	raw_request(url, method, callback, data, auth) {
		let x = new XMLHttpRequest()
		x.open(method, url)
		let args = arguments
		
		let start = Date.now()
		
		let retry = (time, reason)=>{
			// this is not recursion because retry is called in async callback functions only!
			if (time) {
				console.log("will retry", reason, "in "+time/1000+" sec")
				if (time > 2000)
					try {
						print("Warning: request was rate limited with extremely long wait time: "+time/1000+" seconds")
					} catch(e) {}
				let id = setTimeout(()=>{retry(null, reason)}, time)
				x.abort = ()=>{clearTimeout(id)}
			} else {
				console.log("retrying request", reason)
				x.abort = this.raw_request.apply(this, args).abort
			}
		}
		
		x.onload = ()=>{
			let type = x.getResponseHeader('Content-Type')
			let resp
			if (/^application\/json(?!=\w)/.test(type))
				resp = JSON.safe_parse(x.responseText)
			else
				resp = x.responseText
			let code = x.status
			
			if (code==200) //this should maybe check other 2xx responses, but I think 204 is (was?) used for timeouts...
				callback(null, resp)
			else if (code==502)
				retry(5000, 'bad gateway')
			else if (code==408 || code==204 || code==524)
				// record says server uses 408, testing showed only 204. idk
				retry(null, 'timeout')
			else if (code == 429) { // rate limit
				let after = +(x.getResponseHeader('Retry-After') || 1)
				retry((after+0.5)*1000, "rate limited "+after+"sec")
			} else if (code==400)
				callback('error', JSON.safe_parse(resp))
			else if (code==401)
				callback('auth', resp)
			else if (code==403)
				callback('permission', resp)
			else if (code==404)
				callback('404', resp)
			else if (code==418)
				callback('ban', resp)
			else if (code==500) {
				print("got 500 error! "+resp)
				console.warn('got 500 error', x, resp)
				callback('error', JSON.safe_parse(resp))
				//retry(1000, '500 error')
			} else { // other
				alert("Request failed! "+code+" "+url)
				console.log("REQUEST FAILED", x)
				resp = JSON.safe_parse(resp)
				callback('error', resp, code)
			}
		}
		x.onerror = ()=>{
			let time = Date.now()-start
			//console.log("xhr onerror after ms:"+time)
			if (time > 18*1000)
				retry(null, "3ds timeout") // i think other browsers do this too now?
			else {
				print("Request failed!")
				retry(5000, "request error")
			}
		}
		x.setRequestHeader('Cache-Control', "no-cache, no-store, must-revalidate")
		x.setRequestHeader('Pragma', "no-cache") // for internet explorer
		auth && x.setRequestHeader('Authorization', "Bearer "+auth)
		
		// no data
		if (data == undefined)
			x.send()
		// data is Object (convert to json)
		else if (Object.getPrototypeOf(data)==Object.prototype) { //plain object. we do need to support sending strings etc. as json later though...
			x.setRequestHeader('Content-Type', "application/json;charset=UTF-8")
			x.send(JSON.stringify(data))
		// otherwise, send raw (ex: string, FormData)
		} else
			x.send(data)
		
		return x
	},
	
	query_string(obj) {
		if (!obj)
			return ""
		let params = []
		for (let key in obj) {
			let val = obj[key]
			if (val == undefined) // I changed this to == so null is ignored too. I think that's fine? better than turning it into a string, at least. perhaps it should map to "key=" or "key" instead
				continue
			let item = encodeURIComponent(key)+"="
			// array items are encoded as
			// ids:[1,2,3] -> ids=1&ids=2&ids=3
			if (val instanceof Array)
				val.forEach(x => params.push(item+encodeURIComponent(x)))
			// otherwise, key=value
			else
				params.push(item+encodeURIComponent(val))
		}
		if (!params.length)
			return ""
		return "?"+params.join("&")
	},
	// idk having all brackets bold + dimgray was kinda nice...
	request(url, method, callback, data) {
		return this.raw_request(`https://${this.server}/${url}`, method, (e, resp)=>{
			if (e == 'auth')
				this.log_out()
			else
				callback(e, resp)
		}, data, this.auth)
	},
	
	// logs the user out and clears the cached token
	log_out() {
		Store.remove(this.storage_key)
		Lp.stop()
		this.auth = null
		this.on_logout()
	},
	// call to set the current auth token
	// should only be called once (triggers login event)
	got_auth(new_auth) {
		let new_uid
		try {
			new_uid = Number(JSON.parse(window.atob(new_auth.split(".")[1])).uid) //yeah
		} catch(e) {
			this.log_out()
			return false
		}
		this.auth = new_auth
		this.uid = new_uid
		this.on_login()
		return true
	},
	
	authenticate(username, password, callback) {
		return this.request("User/authenticate", 'POST', (e, resp)=>{
			if (!e) {
				this.got_auth(resp)
				Store.set(this.storage_key, resp, true)
			}
			callback(e, resp)
		}, {username: username, password: password})
	},
	
	// try to load cached auth token from localstorage
	// triggers on_login and returns true if successful
	// (doesn't check if auth is expired though)
	// return: Boolean
	try_load_cached_auth() {
		let auth = Store.get(this.storage_key)
		let ok = auth ? this.got_auth(auth) : false
		if (!ok)
			this.on_guest_load()
		return ok
	},
	
	put_file(file, callback) {
		return this.request("File/"+file.id, 'PUT', callback, file)
	},
	
	read(requests, filters, callback, first) {
		let offset = null
		if (first) {
			console.log("Req: doing first request!")
			offset = 1
			requests = [
				['systemaggregate'], //~💖
				...requests,
				['category~Ctree'],
				['user~Ume', {ids:[Req.uid], limit:1}],
			]
		}
		let query = {
			requests: requests.map(([thing, data])=>{
				// if we're injecting something at the start
				if (offset)
					thing = thing.replace(/\d+/g, (d)=> +d + offset)
				
				if (data)
					thing += "-"+JSON.stringify(data)
				return thing
			}),
		}
		Object.assign(query, filters) // we're not ready for {...} syntax yet
		
		return this.request("Read/chain"+this.query_string(query), 'GET', (e, resp)=>{
			if (!e) {
				Entity.process(resp)
			}
			callback(e, resp, first && !e)
		})
	},
	
	get_me(callback) {
		return this.request("User/me", 'GET', (e, resp)=>{
			if (!e) {
				let l = [resp]
				Entity.process_list('user',l,{})
				callback(l[0])
			} else
				callback(null)
		})
	},
	
	set_basic(data, callback) {
		return this.request("User/basic", 'PUT', (e, resp)=>{
			if (!e) {
				let l = [resp]
				Entity.process_list('user',l,{})
				callback(l[0])
			} else
				callback(null)
		}, data)
	},
	
	set_sensitive(data, callback) {
		return this,request("User/sensitive", 'POST', callback, data)
	},
	
	// this should accept as many types as possible
	// unused!
	upload_image(thing, callback) {
		if (thing instanceof HTMLCanvasElement) {
			thing.toBlob((blob)=>{
				if (blob)
					this.upload_file(blob, callback)
				else
					callback(null)
			})
		} else if (thing instanceof File || thing instanceof Blob) {
			this.uploadFile(thing, callback)
		} else if (thing instanceof Image) {
			this.callback(null)
			// todo
		} else {
			this.callback(null)
		}
	},
	
	upload_file(file, params, callback) {
		let form = new FormData()
		form.append('file', file)
		
		this.request("File"+this.query_string(params), 'POST', (e, resp)=>{
			if (e)
				callback(e, resp)
			else {
				let l = [resp]
				Entity.process_list('file',l,{})
				callback(e, l[0])
			}
		}, form)
	},
	
	toggle_hiding(id, callback) {
		return this.get_me((me)=>{
			if (me) {
				let hiding = me.hidelist
				let hidden = arrayToggle(hiding, id)
				this.set_basic({hidelist:hiding}, (e)=>{
					if (e)
						callback(null)
					else
						callback(hidden)
				})
			} else
				callback(null)
		})
	},
	
	searchUsers(text, callback) {
		let like = text.replace(/%/g,"_") //the best we can do...
		let count = 20
		return this.read([
			['user', {limit: count, usernameLike: "%"+like+"%", sort: 'editDate', reverse: true}],
		], {}, (e, resp)=>{
			if (!e)
				callback(resp.user_map)
			else
				callback(null)
		})
	},
	
	search1(text, callback) {
		let like = text.replace(/%/g,"_") //the best we can do...
		let count = 20
		let page = 0
		page = page*count
		return this.read([
			['user~Usearch', {limit: count, skip: page, usernameLike: like+"%"}],
			['content', {limit: count, skip: page, nameLike: "%"+like+"%"}],
			['content', {limit: count, skip: page, keyword: like}],
			['user.1createUserId.2createUserId'],
		],{
			content: 'name,id,type,permissions,createUserId', //eh
		}, (e, resp)=>{
			if (!e)
				callback(resp.Usearch, resp.content)
			else
				callback(null)
		})
	},
	
	// might be worth speeding up in entity.js (100ms)
	get_recent_activity(callback, fail) {
		let day = 1000*60*60*24
		let start = new Date(Date.now() - day).toISOString()
		// "except no that won't work if site dies lol"
		return this.read([
			['activity', {createStart: start}],
			['comment~Mall', {reverse: true, limit: 1000}],
			['activity~Awatching', {contentLimit:{watches:true}}],
			['content.0contentId.1parentId.2contentId'],
			['comment', {limit: 50, reverse: true, createStart: start}],
			['user.0userId.1editUserId.2userId.4createUserId'],
		], {
			content: 'name,id,permissions,type',
			Mall: 'parentId,editUserId,editDate',
		}, (e,resp)=>{
			if (e)
				fail(e, resp)
			else
				callback(resp)
		})
	},
	
	setVote(id, state, callback) {
		return this.request("Vote/"+id+"/"+(state||"delete"), 'POST', callback)
	},
	
	editPage(page, callback) {
		if (this.locked) {
			console.log("editing page:", page)
			callback(true, null)
			return
		}
		if (page.id)
			this.request("Content/"+page.id, 'PUT', callback, page)
		else
			this.request("Content", 'POST', callback, page)
	},
	
	get_older_comments(pid, firstId, count, callback, err) {
		let fi = {reverse: true, limit: count, parentIds: [pid]}
		if (firstId != null)
			fi.maxId = firstId // maxId is EXCLUSIVE
		return this.read([
			['comment', fi],
			['user.0createUserId.0editUserId'],
		], {}, (e, resp)=>{
			if (!e)
				callback(resp.comment)
			else
				callback(null)
		})
		// so messy, with the different types of error hiding and shit
	},
	
	get_newer_comments(pid, lastId, count, callback) {
		let fi = {limit: count, parentIds: [pid]}
		if (lastId != null)
			fi.minId = lastId
		return this.read([
			['comment', fi],
			['user.0createUserId.0editUserId'],
		], {}, (e, resp)=>{
			if (!e)
				callback(resp.comment)
			else
				callback(null)
		})
	},
	
	send_message(room, text, meta, callback) {
		return this.request("Comment", 'POST', callback, {parentId: room, content: Entity.encode_comment(text, meta)})
	},
	
	edit_message(id, room, text, meta, callback) {
		return this.request("Comment/"+id, 'PUT', callback, {parentId: room, content: Entity.encode_comment(text, meta)})
	},
	
	delete_message(id, callback) {
		return this.request("Comment/"+id+"/delete", 'POST', callback)
	},
	
	file_url(id, query) {
		if (query)
			return "https://"+this.server+"/File/raw/"+id+"?"+query
		return "https://"+this.server+"/File/raw/"+id
	},
}
Object.seal(Req)

if (0)
	server = protocol+"//newdev.smilebasicsource.com/api"

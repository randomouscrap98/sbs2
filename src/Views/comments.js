// todo: put these vars in a scope somewhere?
// maybe define scopes at like View.views[name]? and separate methods from the rest of the scope of course,

let comment_form

View.addView('comments', {
	init() {
		comment_form = new Form({
			fields: [
				['search', 'text', {label: "Search", convert: CONVERT.string, param: 's'}],
				['pages', 'number_list', {label: "Page Ids", convert: CONVERT.number_list, param: 'pid'}],
				['users', 'number_list', {label: "User Ids", convert: CONVERT.number_list, param: 'uid'}],
				['start', 'date', {label: "Start Date", convert: CONVERT.date, param: 'start'}],
				['end', 'date', {label: "End Date", convert: CONVERT.date, param: 'end'}],
				['range', 'range', {label: "Id Range", convert: CONVERT.range, param: 'ids'}],
				['reverse', 'checkbox', {label: "Newest First", convert: CONVERT.flag, param: 'r'}],
			]
		})
		$commentSearchForm.replaceWith(comment_form.elem)
		$commentSearchButton.onclick = ()=>{
			let data = comment_form.get()
			let name = "comments"
			if (data.pages && data.pages.length==1) {
				name += "/"+data.pages[0]
				delete data.pages
			}
			let query = comment_form.to_query(data)
			Nav.go(name+query)
		}
		View.bind_enter($commentSearch, $commentSearchButton.onclick)
	},
	start(id, query, render, quick) {
		let data = comment_form.from_query(query)
		if (id)
			data.pages = [id]
		let [search, merge] = build_search(data)
		
		if (search) {
			return Req.read([
				['comment', search],
				['content.0parentId'],
				['user.0createUserId'],
			], {}, (e, resp)=>{
				if (e) return render(null)
				render(resp.comment, resp.content, data, merge)
			})
		} else {
			// if no search, just display the form right away
			quick(()=>{
				View.setTitle("Comments")
				comment_form.set(data)
				$commentSearchResults.replaceChildren()
			})
		}
		
	},
	className: 'comments',
	render(comments, pages, data, merge) {
		View.setTitle("Comments")
		comment_form.set(data)
		
		$commentSearchResults.replaceChildren()
		if (!comments.length) {
			$commentSearchResults.textContent = "(no result)"
		} else {
			let map = Entity.page_map(pages)
			if (merge) {
				let last_time = 0
				for (let comment of comments) {
					if (comment.deleted)
						continue
					let part = Draw.message_part(comment)
					Draw.insert_comment_merge($commentSearchResults, part, comment, last_time, false)
					last_time = comment.createDate
				}
			} else {
				for (let c of comments) {
					c.parent = map[c.parentId]
					$commentSearchResults.append(Draw.search_comment(c))
				}
			}
		}
	},
	cleanUp() {
		$commentSearchResults.replaceChildren()
	},
})

function build_search(data) {
	let merge = true;
	let search = {limit: 200}
	if (!data.search && !(data.users && data.users.length) && !data.range && !data.start && !data.end)
		return [null, null]
	if (data.reverse) {
		search.reverse = true
		merge = false
	}
	if (data.search) {
		search.contentLike = "%\n%"+data.search+"%"
		merge = false
	}
	if (data.pages)
		search.parentIds = data.pages
	if (data.users) { // todo: is an empty list [] or null?
		search.userIds = data.users
		merge = false
	}
	let range = data.range
	// todo: list of ids (remember to turn off merge)
	if (range) {
		if (typeof range == 'number')
			range = [range, range]
		// either: 123-456
		// or      123-
		if (range[0] !== null)
			search.minId = range[0]-1
		if (range[1] !== null)
			search.maxId = range[1]+1
	}
	if (data.start)
		search.createStart = data.start.toISOString()
	if (data.end)
		search.createEnd = data.end.toISOString()
	return [search, merge]
}
// todo: ids should accept either:
// <number>
// <number>-
// <number>-<number>
// <number>,<number>... (or space etc)

View.addView('chatlogs', {
	redirect: (id, query)=>{
		let q = {r: true}
		// we do it this way so the ORDER is preserved :D
		for (let key in query) {
			if (key=='t')
				q.s = query.t // name changed
			else if (key=='pid')
				q.pid = query.pid
			else if (key=='uid')
				q.uid = query.uid
		}
		// switch to "comments/<id>" url if there is one pid
		id = null
		if (q.pid) {
			let pids = CONVERT.number_list.decode(q.pid)
			if (pids && pids.length==1) {
				delete q.pid
				id = pids[0]
			}
		}
		return ['comments', id, q]
	},
	//TODO: results are links to chatlog viewer which lets you load surrounding messages etc.
	// show page name etc.
})

// ha

// env+square wave for trumpets ?
// c# c# b f# c#

'use strict'

const TTSSystem = {
	speakUtterance(u) {
		return new Promise((yay, nay) => {
			u.onend = e=>(e.charIndex < e.target.length) ? nay(e) : yay()
			u.onerror = e=>nay(e)
			
			speechSynthesis.speak(u)
		})
	},
	
	playSound(s) {
		return new Promise((yay, nay) => {
			let se = s.elem
			
			se.currentTime = 0
			se.volume = ('number'==typeof s.volume) ? s.volume : 1.0
			
			let removeListeners = ()=>{ se.onpause = se.onerror = null }
			
			se.onpause = e=>removeListeners((se.currentTime < se.duration) ? nay(e) : yay())
			se.onerror = e=>removeListeners(nay(e))
			
			se.play()
		})
	},
	
	speakMessage(message, merged = false) {
		let tree = Markup.langs.parse(message.text, message.values.m)
		
		let msg
		if (!merged) {
			let author = message.Author
			let memorable_name = author.bridge ? (author.nickname || message.values.b) : author.username
			msg = `${memorable_name} says\n`
		}
		
		this.speakScript(this.renderSpeechScript(tree, { msg }))
	},
	
	queue: [],
	current: null,
	async speakScript(utter) {
		if (this.queue.push(utter)-1) return
		
		try {
			while (this.queue.length) {
				for (let u of this.queue[0]) {
					this.current = u
					if (u instanceof SpeechSynthesisUtterance) await this.speakUtterance(u)
					else if (u.elem instanceof HTMLAudioElement) await this.playSound(u)
				}
				this.current = null
				this.queue.shift()
			}
		} catch { return }
	},
	
	placeholderSound: "./resource/meow.wav",
	
	synthParams: {
		voice: null,
		volume: 1.0,
		pitch: 1.0,
		rate: 1.25,
	},
	
	// creates a list of smaller utterances and media to play in sequence
	renderSpeechScript(tree, opts = {}) {
		opts.msg ||= ""
		opts.volume ||= 1
		opts.pitch ||= 1
		opts.rate ||= 1
		opts.utter ||= []
		opts.media ||= {}
		
		let clamp01 = x=>Math.max(0, Math.min(x, 1))
		
		let sound = url=>{
			finalizeChunk()
			let elem = opts.media[url] ||= new Audio(url)
			elem.loop = false
			let volume = clamp01(this.synthParams.volume * opts.volume)
			opts.utter.push({ elem, volume })
		}
		
		// pushes utterance onto the end of the speech queue.
		let finalizeChunk = ()=>{
			opts.msg = opts.msg.trim()
			if (!opts.msg.length) return
			
			let u = new SpeechSynthesisUtterance(opts.msg)
			u.voice = this.synthParams.voice
			u.volume = clamp01(this.synthParams.volume * opts.volume)
			u.pitch = clamp01(this.synthParams.pitch * opts.pitch)
			u.rate = clamp01(this.synthParams.rate * opts.rate)
			
			opts.utter.push(u)
			opts.msg = ""
		}
		
		// goofy way to do things
		function simplifyUrl(s) {
			if (s.includes("://qcs.s")) return "qcs"
			if (s.includes("cdn.discordapp.com/")) return "discord"
			if (s.includes(" ") && !s.includes(".")) return false // silly fake link heuristics
			if (s.includes(" ") && s.includes(".") && s.indexOf(" ") < s.indexOf(".")) return false
			else try { return new URL(s).hostname.replace("www.", "") }
			catch { return "invalid URL" }
		}
		
		for (let elem of tree.content) {
			if ('string'==typeof elem) {
				if (elem.length > 2500) opts.msg += "(message too long)"
				else opts.msg += elem
			} else if ('object'==typeof elem) switch (elem.type) {
				case 'bold': {
					// TODO: is this even.. good to do?
					finalizeChunk()
					this.renderSpeechScript(elem, {...opts, pitch: opts.pitch * 0.75})
					finalizeChunk()
				break }
				case 'italic': {
					finalizeChunk()
					this.renderSpeechScript(elem, {...opts, rate: opts.rate * 0.9})
					finalizeChunk()
				break }
				case 'underline': {
					finalizeChunk()
					this.renderSpeechScript(elem, {...opts, pitch: opts.pitch * 0.9, rate: opts.rate * 0.9})
					finalizeChunk()
				break }
				case 'video': {
					opts.msg += `\nvideo from ${simplifyUrl(elem.args.url)}\n`
				break }
				case 'youtube': {
					opts.msg += "\nyoutube video\n"
				break }
				case 'link': {
					// depending on if they're labeled or unlabeled,
					// i treat these as either inline or block respectively.
					// inline being normal space pause, block being sentence break.
					if (elem.content) {
						this.renderSpeechScript(elem, opts)
						opts.msg += " (link)"
					} else {
						opts.msg += elem.args.text ? ` ${elem.args.text} (link)` : `\nlink to ${simplifyUrl(elem.args.url)}\n`
					}
				break }
				case 'simple_link': {
					let url = simplifyUrl(elem.args.url)
					if (!url) opts.msg += ` ${elem.args.url} (fake link)`
					else opts.msg += elem.args.text ? ` ${elem.args.text} (link)` : `\nlink to ${url}\n`
				break }
				case 'image': { // pretty safe bet that all images are block elements
					opts.msg += "\n" + (elem.args.alt ? `${elem.args.alt} (image)` : `image from ${simplifyUrl(elem.args.url)}`) + "\n"
				break }
				case 'audio': {
					sound(elem.args.url)
					// todo: time limite for audio?
				break }
				case 'code': {
					opts.msg += "\ncode block"
					if (elem.args.lang && elem.args.lang != 'sb') // sign of the times...
						opts.msg += ` written in ${elem.args.lang}`
					opts.msg += "\n"
				break }
				case 'icode': {
					opts.msg += elem.args.text
				break }
				case 'spoiler': {
					opts.msg += "\nspoiler"
					if (elem.args.label)
						opts.msg += ` for ${elem.args.label}`
					opts.msg += "\n"
				break }
				default: {
					if (elem.content)
						this.renderSpeechScript(elem, opts)
					else {
						sound(this.placeholderSound)
						console.log(`TTS renderer ignored ${elem.type}`)
					}
				break }
			}
		}
		
		// if we're root elem, we probably have unfinalized stuff.
		// finalize it and return the utterance list.
		if (tree.type == 'ROOT') {
			finalizeChunk()
			return opts.utter
		}
	},
	
	cancel() {
		// clear out queue
		this.queue = []
		
		// cancel current thing
		speechSynthesis.cancel()
		if (this.current && this.current.elem instanceof HTMLAudioElement)
			this.current.elem.pause()
		this.current = null
	}
}

// TODO: strikethrough, sup, sub, tables (maybe read head? or read only if smaller than 10 cells?),
//       ruby (true already handled), horiz. rule, maybe lists,
//       maybe headers? (louder volume?), quote text (with barely-used src),
//       maybe anchors should work (as in `[[#test]]`), keys
// (from quick run through of 12y markup guide and glance at comments)

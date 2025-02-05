const FileUploader = NAMESPACE({
	file: null,
	last_file: null,
	file_upload_form: null,
	
	onload() {
		this.file_upload_form = new Form({
			fields: [
				['size', 'output', {label: "Info"}], //todo: separate set of output fields?
				['name', 'text', {label: "Name"}],
				['hash', 'text', {label: "Hash"}],
				['bucket', 'text', {label: "Bucket"}],
				['quantize', 'select', {
					options: [null, 2, 4, 8, 16, 32, 64, 256],
					label: "Quantize",
					option_labels: ["no", "2", "4", "8", "16", "32", "64", "256"],
				}],
			],
		})
		$file_upload_form.replaceWith(this.file_upload_form.elem)
		this.file_cancel()
		
		document.addEventListener('paste', ev=>{
			let data = ev.clipboardData
			if (data && data.files) {
				let file = data.files[0]
				if (file && (/^image\//).test(file.type))
					this.got_file(file)
			}
		})
		document.addEventListener('dragover', ev=>{
			if (ev.dataTransfer.types.includes("Files")) {
				ev.preventDefault()
				ev.dataTransfer.dropEffect = 'copy'
			}
		})
		document.addEventListener('drop', ev=>{
			if (ev.target instanceof HTMLTextAreaElement)
				return
			let file = ev.dataTransfer.files[0]
			if (file) {
				ev.preventDefault()
				if (/^image\//.test(file.type))
					this.got_file(file)
			}
		})
		
		//todo: write decoder for xpm :)
		$file_browse.onchange = e=>{
			let file = $file_browse.files[0]
			try {
				file && this.got_file(file)
			} finally {
				$file_browse.value = ""
			}
		}
		// todo: just cancel the download instead of disabling the form idk
		$file_url_form.onsubmit = async (ev)=>{
			ev.preventDefault()
			if ($file_url_form.hasAttribute('data-disabled'))
				return
			try {
				$file_url_form.setAttribute('data-disabled', "")
				let url = $file_url_input.value
				if (!url)
					return
				print('requesting image (might fail)...')
				let resp = await fetch(new Request(url))
				let blob = await resp.blob()
				blob.name = url
				this.got_file(blob)
				$file_url_input.value = ""
			} catch(e) {
				print('failed:', e)
			} finally {
				$file_url_form.removeAttribute('data-disabled')
			}
		}
		
		$file_cancel.onclick = $file_done.onclick = e=>{
			this.file_cancel()
		}
		$file_url_insert.onclick = e=>{
			let file = this.last_file
			if (!file) return
			let curr = Nav.view()
			if (!curr || !curr.Insert_Text) return
			
			let url = Req.image_url(file.hash)
			
			let meta = JSON.parse(file.meta)
			let markup = Settings.values.chat_markup
			if (markup=='12y') {
				url = "!"+url
				if (meta.width && meta.height)
					url += "#"+meta.width+"x"+meta.height
			} else if (markup=='12y2') {
				url = "!"+url
				if (meta.width && meta.height)
					url += "["+meta.width+"x"+meta.height+"]"
			}
			
			Sidebar.close_fullscreen()
			curr.Insert_Text(url)
		}
		$file_upload.onclick = Draw.event_lock(done=>{
			if (!this.file) return void done()
			
			this.file_upload_form.read()
			let data = this.file_upload_form.get()
			
			let params = {
				tryresize: true,
				name: data.name || "",
				values: {},
			}
			let priv = false
			if (data.bucket!=null) {
				params.values.bucket = data.bucket || ""
				priv = true
			}
			// ok this is silly. why even bother with the Form thing
			if (data.quantize)
				params.quantize = data.quantize
			if (data.hash)
				params.hash = data.hash
			if (priv)
				params.globalPerms = ""
			print(`uploading ${priv?"private":"public"} file...`)
			
			Req.upload_file(this.file, params).do = (file, err)=>{
				done()
				if (err) return
				
				if (priv && file.permissions[0])
					alert("file permissions not set correctly!\nid:"+file.id)
				
				this.show_content(file)
			}
		})
		$file_url.onfocus = e=>{
			window.setTimeout(()=>{
				$file_url.select()
			})
		}
	},
	
	show_content(content) {
		let url = Req.image_url(content.hash)
		this.show_parts(2, url, null)
		$file_upload_page.href = "#page/"+content.hash
		this.last_file = content
	},
	
	/*get_metadata(file) {
		if (file.type=="image/png") {
			// signature: 0-7
			// IHDR length: 8-11
			// IHDR name: 12-15
			// IHDR data: 16-29
		} else if (file.type=="image/jpeg") {
			
			
		}
	},*/
	
	convert_image(file, quality, callback) {
		let img = new Image()
		img.onload = e=>{
			let canvas = document.createElement('canvas')
			canvas.width = img.naturalWidth
			canvas.height = img.naturalHeight
			let c2d = canvas.getContext('2d')
			c2d.drawImage(img, 0, 0)
			URL.revokeObjectURL(img.src)
			let name = file.name
			file = null
			let format = quality!=null ? 'jpeg' : 'png'
			canvas.toBlob(x=>{
				if (x)
					x.name = name+"."+format
				callback(x)
			}, "image/"+format, quality)
		}
		img.onerror = e=>{
			URL.revokeObjectURL(img.src)
			callback(null)
		}
		img.src = URL.createObjectURL(file)
	},
	
	// file is only set if we're uploading a file
	show_parts(phase, url, file) {
		$file_inputs.hidden = phase!=0
		$file_cancel.hidden = phase!=1
		$file_upload.hidden = phase!=1
		this.file_upload_form.elem.hidden = phase!=1
		$file_url_insert.hidden = phase!=2
		$file_url.hidden = phase!=2
		$file_done.hidden = phase!=2
		$file_upload_page.hidden = phase!=2
		// we set to "" first, so the old image isnt visible whilst the new one is loading
		$file_image.src = ""
		if (url) {
			$file_image.src = url
			$file_image.onload = ev=>{
				$file_image.title = $file_image.naturalWidth+" x "+$file_image.naturalHeight
			}
			$file_url.value = url
			$file_url.scrollLeft = 999
		} else {
			$file_url.value = ""
		}
		this.file = file || null
	},
	file_cancel() {
		this.show_parts(0, null, null)
	},
	
	got_file(file) {
		let url = URL.createObjectURL(file)
		this.show_parts(1, url, file)
		let name = String(file.name)//.replace(/[.]\w{3,4}$/, "")
		window.setTimeout(()=>URL.revokeObjectURL(url))
		this.file_upload_form.set_some({
			size: file.type+" "+(file.size/1000)+" kB",
			name,
			hash: null,
		})
		this.file_upload_form.write()
		Sidebar.tabs.select('file')
	},
})

do_when_ready(x=>FileUploader.onload())

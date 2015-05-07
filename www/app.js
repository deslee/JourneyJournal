(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var React = require('react/addons');
var Router = require('react-router');
var handleGapiRequest = require('../utilities/gapiHandler')
var moment = require('moment')

module.exports = React.createClass({displayName: "exports",
	mixins: [ Router.State, Router.Navigation ],
	getInitialState: function() {
		return {
		}
	},
	componentWillMount: function() {
	},
	backup: function() {
		if (this.state.backingUp) {
			return
		}

		this.setState({backingUp: true})
		this.loadDocuments(function(err, results) {
			if (err) {
				console.log(err)
				return
			}
			var json = JSON.stringify(results);
			var pause = 2

			uploadBackupToDrive(json, function(e) {
				if (e) {
					console.log(e)
					this.setState({backingUp: false})
					return
				}
				alertify.message('Backed up Journal', pause);
				setTimeout(function() {
					this.setState({backingUp: false})
				}.bind(this), pause)
			}.bind(this));
		}.bind(this))
	},
	restore: function() {
		this.transitionTo('restore')
	},
	loadDocuments: function(callback) {
		this.props.db.allDocs({
			include_docs: true,
		}).then(function(results) {
			var results = results.rows.map(function(doc){
				var entry = doc.doc;
				return entry
			}.bind(this));
			callback(null, results)
		}.bind(this))
		.catch(function(e) {
			callback(e)
		});
	},
	render: function() {
		var backupText = this.state.backingUp ? 'Backing up' : 'Backup to drive'
		var restoreText = this.state.restoring ? 'Restoring' : 'View backups'
		return (React.createElement("div", null, 
			React.createElement("button", {onClick: this.backup}, backupText), React.createElement("br", null), 
			React.createElement("button", {onClick: this.restore}, restoreText), React.createElement("br", null)
		))
	}
});

function uploadBackupToDrive(json, callback) {
	var boundary = '-------314159265358979323846'
	var delimiter = "\r\n--" + boundary + "\r\n"
	var close_delim = "\r\n--" + boundary + "--"
	var contentType="application/json"


	var dateString = 'backup-' +moment().format("YYYYMMDDhhmmss") 
	var fileName = prompt('Choose a name for this backup', dateString);

	if (fileName == null) {
		callback('canceled')
		return
	}
	fileName = fileName + '.json'

	var metadata = {
		'title': fileName,
		'mimeType': contentType,
		'parents': [{'id': 'appfolder'}]
	};

	var base64Data = btoa(JSON.stringify(json));

	var multipartRequestBody =
		delimiter +
		'Content-Type: application/json\r\n\r\n' +
		JSON.stringify(metadata) +
		delimiter +
		'Content-Type: ' + contentType + '\r\n' +
		'Content-Transfer-Encoding: base64\r\n' +
		'\r\n' +
		base64Data +
		close_delim;

	var request = gapi.client.request({
		'path': '/upload/drive/v2/files',
		'method': 'POST',
		'params': {'uploadType': 'multipart'},
		'headers': {
			'Content-Type': 'multipart/mixed; boundary="' + boundary + '"'
		},
		'body': multipartRequestBody
	});
	handleGapiRequest(request, callback)
}


},{"../utilities/gapiHandler":14,"moment":"a2/Bwm","react-router":"vYZgCY","react/addons":"yutbdK"}],2:[function(require,module,exports){
var React = require('react/addons');
var Router = require('react-router');
var ensureLoaded = require('./utilities/ensureGapiLoaded')

var Route = Router.Route;
var Link = Router.Link;
var DefaultRoute = Router.DefaultRoute;
var NotFoundRoute = Router.NotFoundRoute;

var RootRouteHandler = require('./routes/RootRouteHandler')
var NotFoundRouteHandler = require('./routes/NotFoundRouteHandler');


var SettingsRouteHandler = require('./routes/SettingsRouteHandler');
var EditorRouteHandler = require('./routes/EditorRouteHandler');
var IndexRouteHandler = require('./routes/IndexRouteHandler');
var restoreRouteHandler = require('./routes/RestoreRouteHandler');
/* deslight require hook - do not modify this line */

var routes = (
	React.createElement(Route, {handler: RootRouteHandler, path: "/"}, 
		React.createElement(DefaultRoute, {handler: IndexRouteHandler, name: "index"}), 
		React.createElement(Route, {handler: EditorRouteHandler, name: "editor", path: "editor/:id"}), 
		React.createElement(NotFoundRoute, {handler: NotFoundRouteHandler}), 
		React.createElement(Route, {handler: SettingsRouteHandler, name: "settings", path: "settings"}), 
React.createElement(Route, {handler: restoreRouteHandler, name: "restore", path: "restore"}), 
"/* deslight route hook - do not modify this line */"
	)
);


function init() {
	ensureLoaded(function() {
		Router.run(routes, function(Handler) {
				   React.render(React.createElement(Handler, null), document.getElementById('root_journey'));
		});
	})
}

if (typeof(device) != 'undefined' && device.platform !== 'browser') {
		document.addEventListener('deviceReady', function() {
			init()
		}, false)
}
else {
	init()
}


},{"./routes/EditorRouteHandler":3,"./routes/IndexRouteHandler":4,"./routes/NotFoundRouteHandler":5,"./routes/RestoreRouteHandler":6,"./routes/RootRouteHandler":7,"./routes/SettingsRouteHandler":8,"./utilities/ensureGapiLoaded":13,"react-router":"vYZgCY","react/addons":"yutbdK"}],3:[function(require,module,exports){
var React = require('react/addons');
var Router = require('react-router');
var RouteHandler = Router.RouteHandler;
var alertify = window['alertify'] = require('alertifyjs')

var dates = require('../utilities/dates')
var decrypt = require('../utilities/decryptEntry')
var encrypt = require('../utilities/encryptEntry')
var moment = require('moment')
function getNextSave() {
		var d = new Date()
		d.setSeconds(d.getSeconds() + 5);
		return d;
}

module.exports = React.createClass({displayName: "exports",
	mixins: [ Router.State, Router.Navigation],
	getInitialState: function() {
		return {
			doc: undefined,
			timeout: undefined,
			next_save: getNextSave(),
			content: '',
			tags: [],
			modified: false
		}
	},
	componentDidMount: function() {
		var id = this.props.params.id
		this.props.db.get(id).then(function(doc) {
			var entry = decrypt(this.props.authkey, doc)
			this.setState({
				doc: {
					id: entry._id,
					rev: entry._rev
				},
				content: entry.content,
				tags: entry.tags ? entry.tags : [],
				datetime: entry.datetime
			});

		}.bind(this)).catch(function(err) {
			if (err.status === 404) {
				this.setState({
					datetime: moment().format("YYYYMMDDhhmmss")
				})
			}
			else {
				console.log(err);
			}
		}.bind(this))

		window.onbeforeunload = function (e) {
			if (this.state.modified) {
				var message = "Journey has unsaved changes. Do you want to leave the page and discard your changes?",
					e = e || window.event;
				// For IE and Firefox
				if (e) {
					e.returnValue = message;
				}

				// For Safari
				return message;
			}
		}.bind(this);
	},
	componentWillUnmount: function() {
		window.onbeforeunload = null;
		window.clearTimeout(this.state.timeout);
	},
	scheduleSave: function() {
		window.clearTimeout(this.state.timeout);
		var timeout = window.setTimeout(function() {
			this.saveEntry();
		}.bind(this), 500)
		this.setState({timeout: timeout})
	},
	changed: function(e) {
		var content = e.target.value;
		this.scheduleSave()
		this.setState({content: content, modified: true})
	},
	saveEntry: function() {
		var content = this.state.content
		var id = this.props.params.id
		var db = this.props.db

		var afterSave = function(response) {
			this.setState({
				next_save: getNextSave(),
				doc: response,
				modified: false
			})
			//alertify.notify('saving...', 'save', 1)
		}.bind(this);

		var putDoc = encrypt(this.props.authkey, {
			_id: id,
			content: content,
			tags: this.state.tags,
			datetime: this.state.datetime
		})

		if (this.state.doc) {
			putDoc._rev = this.state.doc.rev
		}
		db.put(
			putDoc
		).then(afterSave).catch(function(e) {
			console.log(e);				
		});
	},
	transitionToIndex: function() {
		if (this.state.modified) {
			window.clearTimeout(this.state.timeout);
			var message = "Journey has unsaved changes. Do you want to leave the page and discard your changes?"
			alertify.confirm(message).set('title', 'Unsaved Changes').set('labels', {ok:'Yes', cancel:'No'}).set('onok', function(){
				this.transitionTo('index');
			}.bind(this)).set('oncancel', function() {
				this.scheduleSave();
			}.bind(this)); 
		}
		else {
			this.transitionTo('index');
		}
	},
	deleteEntry: function() {
		var db = this.props.db
		if (this.state.doc) {
			alertify.confirm('Delete this entry?')
			.set('title', 'Confirm Action')
			.set('labels', {ok:'Yes', cancel:'No'})
			.set('onok', function() {
				db.remove(this.state.doc.id, this.state.doc.rev)
				.then(function() {
					this.transitionToIndex()	
				}.bind(this))
				.catch(function(err){console.log(err)})
			}.bind(this)); 
		}
	},
	addTagFromElement: function(element) {
		var value = element.value
		element.value = ''
		if (value.length > 0 && this.state.tags.indexOf(value) === -1) {
			console.log('new tag:', value)
			this.setState({
				tags: this.state.tags.concat(value),
				modified: true
			});
			this.scheduleSave();
		}
	},
	tagsInputChanged: function(e) {
		switch (e.target.value.substr(-1)) {
			case ',':
			case ' ':
				e.target.value = e.target.value.substring(0, e.target.value.length-1);
				this.addTagFromElement(e.target);
				break	
		}
	},
	removeTag: function(tag) {
		var idx = this.state.tags.indexOf(tag)
		if (idx !== -1) {
			var tags = this.state.tags
			tags.splice(idx, 1)
			this.setState({tags: tags, modified: true});
			this.scheduleSave()
		}
	},
	tagKeyDown: function(e) {
		if (e.keyCode === 13) {
			this.addTagFromElement(this.refs.tags.getDOMNode());
		}
	},
	focus: function() {
		this.setState({focused: true})
	},
	blur: function() {
		this.setState({focused: false})
	},
	focusTagsInput: function() {
		this.refs.tags.getDOMNode().focus();
	},
	render: function() {
		var route = this.getRoutes();

		var deleteElement;
		
		if (this.state.doc) {
			deleteElement = (
				React.createElement("div", {className: "entry_delete", onClick: this.deleteEntry}, 
				React.createElement("i", {className: "fa fa-trash"})
				)
			);
		}
		
		return (
			React.createElement("div", {className: "journey_container"}, 
				React.createElement("div", {className: "journey_toolbar entry_top"}, 
					React.createElement("div", {className: "entry_back", onClick: this.transitionToIndex}, 
						"← back"
					), 
					deleteElement
				), 

				React.createElement("textarea", {onFocus: this.focus, onBlur: this.blur, onChange: this.changed, ref: "editor", className: "content journey_editor", value: this.state.content}
				), 
				React.createElement("div", {className: "journey_toolbar entry_tags" + (this.state.focused ? ' hide' : '')}, 
					React.createElement("div", {className: "entry_tags_container"}, 
					React.createElement("i", {className: "fa fa-tags", onClick: this.focusTagsInput}), 
						this.state.tags.map(function(tag) {
							return React.createElement("span", {className: "entry_tag", onClick: this.removeTag.bind(this, tag), key: tag}, tag)
						}.bind(this))
					)
				), 
				React.createElement("div", {className: "journey_toolbar entry_tags_input"}, 
					React.createElement("input", {className: "", onInput: this.tagsInputChanged, onKeyDown: this.tagKeyDown, ref: "tags"})
				)
			)
		);
	}
});


},{"../utilities/dates":10,"../utilities/decryptEntry":11,"../utilities/encryptEntry":12,"alertifyjs":"YeVBtY","moment":"a2/Bwm","react-router":"vYZgCY","react/addons":"yutbdK"}],4:[function(require,module,exports){
var React = require('react/addons');
var Router = require('react-router');
var RouteHandler = Router.RouteHandler;
var decrypt = require('../utilities/decryptEntry')
var moment = require('moment')

module.exports = React.createClass({displayName: "exports",
	mixins: [ Router.State, Router.Navigation ],
	getInitialState: function() {
		return {
			entries: []
		}
	},
	componentDidMount: function() {
		var db = this.props.db;
		db.get('journey_metadata')
		.then(function(doc) {
			var nextId = doc.nextId

			db.allDocs({
				include_docs: true,
				startkey: 'entry0',
				endkey: 'entryz'
			}).then(function(results) {
				var results = results.rows.map(function(doc){
					var entry = decrypt(this.props.authkey, doc.doc);
					return entry
				}.bind(this)).sort(function(a, b) {
					var a = a.datetime ? moment(a.datetime, 'YYYYMMDDhhmmss') : moment().year(1969)
					var b = b.datetime ? moment(b.datetime, 'YYYYMMDDhhmmss') : moment().year(1969)
					var diff = b.diff(a)
					return diff;
				});
				this.setState({ results:results, entries:results })
			}.bind(this))
			.catch(function(e) {
				console.log(e);
			});
		}.bind(this));

	},
	createEntry: function() {
		var db = this.props.db;
		db.get('journey_metadata')
		.then(function(doc) {
			var nextId = doc.nextId
			doc.nextId++;
			db.put(doc).then(function(doc) {
			})
			.catch(function(e) {
				console.log(e);
			});

			this.transitionTo('editor', {id: 'entry'+doc.nextId});
		}.bind(this));
	},
	editEntry: function(entry, e) {
		this.transitionTo('editor', {id: entry._id})
	},
	filter: function(e) {
		var value = e.target.value;
		if (value.length > 0) {
			this.setState({entries: this.state.results.filter(function(entry) {
				return entry.content.indexOf(value) !== -1 || entry.tags.join().indexOf(value) !== -1
			})})
		}
		else {
			this.setState({entries: this.state.results})
		}
	},
	focusSearch: function() {
		this.refs.filter.getDOMNode().focus()
	},
	settingsClicked: function() {
		this.transitionTo('settings');
	},
	render: function() {
		var route = this.getRoutes();

		
		return (
			React.createElement("div", {className: "journey_container"}, 
				React.createElement("div", {className: "journey_toolbar search", onClick: this.focusSearch}, 
					React.createElement("i", {className: "fa fa-search search_index"}), 
					React.createElement("input", {placeholder: "filter", ref: "filter", onChange: this.filter, className: "journey_input", type: "text"}), 
					React.createElement("i", {className: "fa fa-cog settings_button", onClick: this.settingsClicked})
				), 
				React.createElement("div", {className: "journey_index_list content"}, 
					this.state.entries.map(function(entry) {
						if (entry.tags.length > 0) {
							var tags = React.createElement("span", null, "tags: ", entry.tags.map(function(tag, idx, list) {
								if (idx == list.length-1) {
									return React.createElement("span", {key: tag}, tag)
								}
								return (
									React.createElement("span", {key: tag}, tag, ", ")
								)					
							})
							)
						}

						return (
							React.createElement("div", {className: "journey_index_item", onClick: this.editEntry.bind(this, entry), key: entry._id}, 
								React.createElement("div", {className: "journey_index_item_title"}, 
								 entry.title.substring(0, 24) + ((entry.title.length > 24) ? '...':'') 
								), 	

								React.createElement("div", {className: "journey_index_item_metadata"}, 
									tags, " "
								)	
							)
						)				
					}.bind(this))
				), 

				React.createElement("div", {onClick: this.createEntry, className: "journey_toolbar create"}, 
					"create new entry"
				)
			)
		);
	}
});


},{"../utilities/decryptEntry":11,"moment":"a2/Bwm","react-router":"vYZgCY","react/addons":"yutbdK"}],5:[function(require,module,exports){
var React = require('react/addons');
var Router = require('react-router');
var RouteHandler = Router.RouteHandler;

module.exports = React.createClass({displayName: "exports",
	mixins: [ Router.State ],
	render: function() {
		var route = this.getRoutes();
		
		return (
			React.createElement("div", null, 
				React.createElement("h2", null, "Not found")
			)
		);
	}
});


},{"react-router":"vYZgCY","react/addons":"yutbdK"}],6:[function(require,module,exports){
var React = require('react/addons');
var Router = require('react-router');
var RouteHandler = Router.RouteHandler;
var alertify = require('alertifyjs')
var handleGapiRequest = require('../utilities/gapiHandler')

module.exports = React.createClass({displayName: "exports",
	mixins: [ Router.State, Router.Navigation ],
	getInitialState: function() {
		return {
			files: [],
			loading: true
		}
	},
	componentWillMount: function() {
		var fileListReceived = function(files) {
			if (files.length == 0) {
				var message = "No files in Drive"
				alertify.alert(message).set('title', 'Info').set('onok', function(){
					this.transitionTo('settings');
				}.bind(this))

			}
			this.setState({files: files.sort(function(a,b) {
				return a < b ? 1 : 0
			}), loading: false})
		}.bind(this)

		var retrievePageOfFiles = function(request, result) {
			handleGapiRequest(request, function(e, resp) {
				if (e) {
					console.log(e)
					return
				}
				result = result.concat(resp.items);
				var nextPageToken = resp.nextPageToken;
				if (nextPageToken) {
					request = gapi.client.drive.files.list({
						'pageToken': nextPageToken
					});
					retrievePageOfFiles(request, result);
				} else {
					fileListReceived(result);
				}
			}.bind(this))
		}

		var initialRequest = gapi.client.drive.files.list({
			'q': '\'appfolder\' in parents'
		});
		retrievePageOfFiles(initialRequest, []);
	},
	restoreFromFile: function(file) {
		var message = "Are you sure?\nThis cannot be undone!"
		alertify.confirm(message).set('title', 'Restore Journal').set('labels', {ok:'Yes', cancel:'No'}).set('onok', function(){
			getFile(file, function(data) {
				var journal = JSON.parse(data).map(function(doc){
					delete doc._rev
					return doc
				})
				this.props.clearDatabaseAndDeauthenticate(journal);
			}.bind(this))
		}.bind(this))

	},
	deleteFile: function(file) {
		var message = "Are you sure?\nThis cannot be undone!"
		alertify.confirm(message).set('title', 'Delete backup').set('labels', {ok:'Yes', cancel:'No'}).set('onok', function(){

			file.deleting = true;

			var request = gapi.client.drive.files.delete({fileId:file.id})

			handleGapiRequest(request, function() {
				var files = this.state.files.filter(function(f) {
					return f.id !== file.id					   
				})
				this.setState({files: files})
			}.bind(this))
		}.bind(this))
	},
	render: function() {
		var fileButtons = this.state.loading === false ? (
			React.createElement("div", null, 
			this.state.files.map(function(file) {
				return React.createElement("div", {className: "buttonGroup", key: file.id}, 
					React.createElement("button", {className: "restore_btn", onClick: this.restoreFromFile.bind(this, file)}, file.title), 
					React.createElement("button", {className: "delete_btn"+(file.deleting ? ' deleting' : ''), onClick: this.deleteFile.bind(this, file)}, "Delete")
				)									  
			}.bind(this))
			)
	   ) : React.createElement("p", null, "Loading")
		
		return (
			React.createElement("div", {className: "journey_container"}, 
				React.createElement("div", {className: "journey_toolbar entry_top"}, 
					React.createElement("div", {className: "entry_back", onClick: this.transitionTo.bind(this, 'settings')}, 
						"← back"
					)
				), 
				React.createElement("div", {className: "restore_screen"}, 
					fileButtons
				)
			)
		);
	}
});

function getFile(file, callback) {
	gapi.client.drive.files.get({
		fileId: file.id,
		alt:'media'
	}).execute(function(response) {
		callback(response)
	})
}


},{"../utilities/gapiHandler":14,"alertifyjs":"YeVBtY","react-router":"vYZgCY","react/addons":"yutbdK"}],7:[function(require,module,exports){
var React = require('react/addons');
var Router = require('react-router');
var RouteHandler = Router.RouteHandler;
var Authenticate = require('./authenticate');
var PouchDB = require('pouchdb');
var sjcl = require('sjcl')
var alertify = require('alertifyjs')

function createDB(journal, callback) {
	var db = new PouchDB('journey_app', {auto_compaction: true});
	if (journal) {
		db.bulkDocs(journal).then(function(result) {
			callback(db)
		}).catch(function(){
			console.log(err);	
		});
	}
	else {
		callback(db)
	}
}

module.exports = React.createClass({displayName: "exports",
	mixins: [ Router.State, Router.Navigation ],
	componentWillMount: function() {
		document.addEventListener("pause", function() {
			this.setState({key: undefined, wrongAttempts: 0})
		}.bind(this), false);

		createDB(null, function(db) {
			this.setState({
				key: undefined,
				db: db, 
				wrongAttempts: 0,
				verifyKey: false
			})

			db.get('journey_metadata').then(function(doc) {
				this.setState({
					exists: true,
					loaded: true
				})
			}.bind(this)).catch(function(e) {
				if (e.status===404) {
					this.setState({
						exists: false,
						loaded: true
					})
				} else {
					console.log(err);	
				}
			}.bind(this))

		}.bind(this))
	},
	componentWillUnmount: function() {

	},
	createMetadata: function(key) {
		this.state.db.put({
			_id: 'journey_metadata',
			verify: sjcl.encrypt(key, 'journey journal'),
			nextId: 0		
		}).then(function(response) {
		}).catch(function(e) {
			console.log(e)
		})
	},
	clearDatabaseAndDeauthenticate: function(journal) {
		this.state.db.destroy().then(function() {
			createDB(journal, function(db) {
				this.setState({
					db: db,
					key: undefined,
					wrongAttempts: 0,
					exists: false
				})
				this.transitionTo('index');
			}.bind(this));
		}.bind(this))
	},
	setKey: function(key) {
		this.state.db.get('journey_metadata').then(function(doc) {
			try {
				var result = sjcl.decrypt(key, doc.verify)
				this.setState({key: key})
			}
			catch(err) {
				if (err.message === "ccm: tag doesn't match") {
					this.setState({
						wrongAttempts: this.state.wrongAttempts+1
					})
					alertify.error('Wrong!', 1)
				}
				else {
					console.log(err);
					console.log(err.stack);
				}
			}

		}.bind(this)).catch(function(e) {
			if (e.status===404) {
				if (!this.state.verifyKey) {
					this.setState({wrongAttempts: 0, verifyKey: key})
				}
				else {
					if (key === this.state.verifyKey) {
						this.createMetadata(key)
						this.setState({key: key})
					}
					else {

					}
					this.setState({verifyKey: false});
				}
			}
			else {
				console.log(e)
			}
		}.bind(this))
	},
	render: function() {
		var handler = React.createElement(RouteHandler, {db: this.state.db, foo: "bar", authkey: this.state.key, clearDatabaseAndDeauthenticate: this.clearDatabaseAndDeauthenticate})

		if (!this.state.loaded) {
			return React.createElement("div", null)
		}

		if (!this.state.key) {
			handler = React.createElement(Authenticate, {exists: this.state.exists, onAuthenticated: this.setKey, wrongAttempts: this.state.wrongAttempts, verifyKey: this.state.verifyKey, clearDatabaseAndDeauthenticate: this.clearDatabaseAndDeauthenticate})
		}

		
		return (
			React.createElement("div", null, 
				React.createElement("main", null, 
					handler
				)
			)
		);
	}
});



},{"./authenticate":9,"alertifyjs":"YeVBtY","pouchdb":"Ztn7p+","react-router":"vYZgCY","react/addons":"yutbdK","sjcl":24}],8:[function(require,module,exports){
var React = require('react/addons');
var Router = require('react-router');
var RouteHandler = Router.RouteHandler;
var decrypt = require('../utilities/decryptEntry')
var alertify = require('alertifyjs')

var Gapi = require('../components/gapi')

module.exports = React.createClass({displayName: "exports",
	mixins: [ Router.State, Router.Navigation],
	transitionToIndex: function() {
		this.transitionTo('index');
	},
	getInitialState: function() {
		return {
			json: ''
		}
	},
	exportFile: function(decrypted) {
		this.props.db.allDocs({
			include_docs: true,
		}).then(function(results) {
			var results = results.rows.filter(function(row) {
				return !decrypted || row.id !== 'journey_metadata'
			}).map(function(doc){
				var entry = doc.doc;
				if (decrypted) {
					decrypt(this.props.authkey, doc.doc);
				}
				entry.id = undefined;
				entry.rev = undefined
				return entry
			}.bind(this));

			var json = JSON.stringify(results);
			this.setState({json: json});
		}.bind(this))
		.catch(function(e) {
			console.log(e);
		});
	},
	deleteJournal: function() {
		var message = "Are you sure?\nThis cannot be undone!"
		alertify.confirm(message).set('title', 'Delete Journal').set('labels', {ok:'Yes', cancel:'No'}).set('onok', function(){
			this.props.clearDatabaseAndDeauthenticate();
		}.bind(this))
	},
	render: function() {
		var route = this.getRoutes();
		
		return (
			React.createElement("div", {className: "journey_container"}, 
				React.createElement("div", {className: "journey_toolbar entry_top"}, 
					React.createElement("div", {className: "entry_back", onClick: this.transitionToIndex}, 
						"← back"
					)
				), 
				React.createElement("div", {className: "content"}, 

					React.createElement(Gapi, {db: this.props.db}), 

					React.createElement("button", {onClick: this.exportFile.bind(this, false)}, "Export to json (encrypted)"), React.createElement("br", null), 
					React.createElement("button", {onClick: this.exportFile.bind(this, true)}, "Export to json (decrypted)"), React.createElement("br", null), 

					React.createElement("button", {onClick: this.deleteJournal}, "Delete journal"), 

					React.createElement("textarea", {className: "jsonView", value: this.state.json})
				)
			)
		);
	}
});


},{"../components/gapi":1,"../utilities/decryptEntry":11,"alertifyjs":"YeVBtY","react-router":"vYZgCY","react/addons":"yutbdK"}],9:[function(require,module,exports){
var React = require('react/addons');
var Router = require('react-router');

module.exports = React.createClass({displayName: "exports",
	submit: function(e) {
		if (e.keyCode===13) {
			var element = this.refs.password.getDOMNode()
			this.props.onAuthenticated(element.value)
			element.value = ''
		}
	},
	resetDatabase: function() {
		var message = "Are you sure?\nThis cannot be undone!"
		alertify.confirm(message).set('title', 'Delete Journal').set('labels', {ok:'Yes', cancel:'No'}).set('onok', function(){
			this.props.clearDatabaseAndDeauthenticate()
		}.bind(this));
		alertify.error('Journal reset!', 1)
	},
	render: function() {
		var placeholder = 'choose a password'
		if (this.props.verifyKey) {
			placeholder = 'verify password'
		}
		if (this.props.exists) {
			placeholder = 'enter a password'
		}

		var resetpw = (this.props.wrongAttempts >= 3) ? React.createElement("div", {onClick: this.resetDatabase, className: "reset_password_button"}, React.createElement("p", null, "forgot your password?"), React.createElement("p", null, "click here to delete the journal and start over")) : undefined

		return (React.createElement("div", {className: "auth_wrapper"}, 
				React.createElement("div", null, 
					React.createElement("i", {className: "fa fa-lock"}), 
					React.createElement("input", {placeholder: placeholder, type: "password", autoFocus: "true", ref: "password", onKeyDown: this.submit})
				), 
				resetpw
		))
	}
});


},{"react-router":"vYZgCY","react/addons":"yutbdK"}],10:[function(require,module,exports){
module.exports = {
    convert:function(d) {
        // Converts the date in d to a date-object. The input can be:
        //   a date object: returned without modification
        //  an array      : Interpreted as [year,month,day]. NOTE: month is 0-11.
        //   a number     : Interpreted as number of milliseconds
        //                  since 1 Jan 1970 (a timestamp) 
        //   a string     : Any format supported by the javascript engine, like
        //                  "YYYY/MM/DD", "MM/DD/YYYY", "Jan 31 2009" etc.
        //  an object     : Interpreted as an object with year, month and date
        //                  attributes.  **NOTE** month is 0-11.
        return (
            d.constructor === Date ? d :
            d.constructor === Array ? new Date(d[0],d[1],d[2]) :
            d.constructor === Number ? new Date(d) :
            d.constructor === String ? new Date(d) :
            typeof d === "object" ? new Date(d.year,d.month,d.date) :
            NaN
        );
    },
    compare:function(a,b) {
        // Compare two dates (could be of any type supported by the convert
        // function above) and returns:
        //  -1 : if a < b
        //   0 : if a = b
        //   1 : if a > b
        // NaN : if a or b is an illegal date
        // NOTE: The code inside isFinite does an assignment (=).
        return (
            isFinite(a=this.convert(a).valueOf()) &&
            isFinite(b=this.convert(b).valueOf()) ?
            (a>b)-(a<b) :
            NaN
        );
    },
    inRange:function(d,start,end) {
        // Checks if date in d is between dates in start and end.
        // Returns a boolean or NaN:
        //    true  : if d is between start and end (inclusive)
        //    false : if d is before start or after end
        //    NaN   : if one or more of the dates is illegal.
        // NOTE: The code inside isFinite does an assignment (=).
       return (
            isFinite(d=this.convert(d).valueOf()) &&
            isFinite(start=this.convert(start).valueOf()) &&
            isFinite(end=this.convert(end).valueOf()) ?
            start <= d && d <= end :
            NaN
        );
    }
}


},{}],11:[function(require,module,exports){
var sjcl = require('sjcl')

module.exports = function(key, entry) {
	entry.content = sjcl.decrypt(key, entry.content)
	entry.title = entry.content.split('\n')[0]
	if (entry.datetime) {
		entry.datetime = sjcl.decrypt(key, entry.datetime)
	}
	entry.tags = sjcl.decrypt(key, entry.tags).split(',').filter(function(tag) {
		return tag !== ''
	})
	return entry;
}


},{"sjcl":24}],12:[function(require,module,exports){
var sjcl = require('sjcl')

module.exports = function(key, entry) {
	entry.content = sjcl.encrypt(key, entry.content)
	if (entry.datetime) {
		entry.datetime = sjcl.encrypt(key, entry.datetime)
	}
	entry.tags = sjcl.encrypt(key, entry.tags.join(','))
	return entry;
}


},{"sjcl":24}],13:[function(require,module,exports){
//ensures all the necessary components are loaded
module.exports = function ensureLoaded(callback) {
	var loadAuth = function(cb) {
		gapi.load('auth', function() {
			cb()
		})
	}

	var loadClient = function(cb) {
		gapi.load('client', function() {
			cb()
		})
	}

	var loadDrive = function(cb) {
		gapi.client.load('drive', 'v2', function() {
			cb()
		})
	}
	
	loadAuth(loadClient.bind(this, loadDrive.bind(this, callback)))
}


},{}],14:[function(require,module,exports){
var ensureLoaded = require('./ensureGapiLoaded')

var info = {
	client_id: '671665185348-plgvceofju2co1aoc94cig2kcf6r0mh6.apps.googleusercontent.com',
	scope: 'https://www.googleapis.com/auth/drive.appfolder'
}

var appUrl = 'https://deslee.me/authorize/journey'

var gapiConfig = {
	auth_uri: 'https://accounts.google.com/o/oauth2/auth',
	token_uri: 'https://accounts.google.com/o/oauth2/token',
	redirect_uri: appUrl
};

var login_url = gapiConfig.auth_uri
+ '?client_id=' + info.client_id
+ '&redirect_uri=' + gapiConfig.redirect_uri
+ '&response_type=code'
+ '&scope=' + info.scope


function handleGapiRequest(request, callback) {
	var triedRefresh = false
	var handle401 = function() {
		delete localStorage.token
		gapi.auth.signOut();
		triedRefresh = true
		ensureAuthorized(execute)
	}

	var handleResponse = function(response) {
		if (response.code == 401 && !triedRefresh) {
			handle401()
		}
		else if (response.code == 403) {
			console.log(response)
			callback(response)
		}else {
			// we have data
			callback(null, response)
		}
	}


	var execute = function(err) {
		if (err) {
			console.log(err);
		} else {
			request.execute(handleResponse)
		}
	}
	ensureAuthorized(execute)
}

function getAuthorizationCodeWebview(callback) {
	var loginWindow = window.open(login_url, '_blank', 'location=yes')
	loginWindow.addEventListener('loadstop', function(e) {
		var url = e.url
		var code = /\?code=(.+)$/.exec(url);
		var error = /\?error=(.+)$/.exec(url);

		if (code) {
			loginWindow.executeScript({code: "document.body.innerHTML"}, function(values){
				var token = JSON.parse(values[0])
				// we have the token!
				localStorage.setItem('token', token)
				gapi.auth.setToken(token)
				loginWindow.close()
				callback()
			})
		}
		if (error) {
			loginWindow.close()
			callback(error)
		}
	})
}

function getAuthorizationCodeBrowser(callback) {
	var handleResult = function(result) {
		if (result && !result.error) {
			var token = gapi.auth.getToken()
			localStorage.setItem('token', JSON.stringify(token))
			callback() // we are authorized!
		} else if (info.immediate == true) {
			info.immediate = false
			gapi.auth.authorize(info, handleResult)
		}
		else {
			// error, return the error
			callback(result)
		}
	}


	info.immediate = true;
	gapi.auth.authorize(info, handleResult);
}

function getAuthorizationCode(callback) {
	if (typeof(device) == 'undefined') device = {platform: 'browser'}
	switch(device.platform) {
		case 'browser':
			getAuthorizationCodeBrowser(callback)
		break;
		case 'Android':
			getAuthorizationCodeWebview(callback)
	}
}

function authorize(callback) {
	getAuthorizationCode(callback)
}


//ensureLoaded is called before this
function _ensureAuthorized(callback) {
	var token = localStorage.getItem('token')
	if (token) {
		if (!gapi.auth.getToken()) {
			try {
				gapi.auth.setToken(JSON.parse(token))
			} catch(e) {
				delete localStorage.token
				_ensureAuthorized(callback)
			}
		}
		// hooray! we are authorized!
		callback()
	}
	else {
		authorize(callback)
	}
}

function ensureAuthorized(callback) {
	ensureLoaded(_ensureAuthorized.bind(this, callback))
}

module.exports = handleGapiRequest


},{"./ensureGapiLoaded":13}],15:[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = Buffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192

/**
 * If `Buffer._useTypedArrays`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (compatible down to IE6)
 */
Buffer._useTypedArrays = (function () {
  // Detect if browser supports Typed Arrays. Supported browsers are IE 10+, Firefox 4+,
  // Chrome 7+, Safari 5.1+, Opera 11.6+, iOS 4.2+. If the browser does not support adding
  // properties to `Uint8Array` instances, then that's the same as no `Uint8Array` support
  // because we need to be able to add all the node Buffer API methods. This is an issue
  // in Firefox 4-29. Now fixed: https://bugzilla.mozilla.org/show_bug.cgi?id=695438
  try {
    var buf = new ArrayBuffer(0)
    var arr = new Uint8Array(buf)
    arr.foo = function () { return 42 }
    return 42 === arr.foo() &&
        typeof arr.subarray === 'function' // Chrome 9-10 lack `subarray`
  } catch (e) {
    return false
  }
})()

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (subject, encoding, noZero) {
  if (!(this instanceof Buffer))
    return new Buffer(subject, encoding, noZero)

  var type = typeof subject

  // Workaround: node's base64 implementation allows for non-padded strings
  // while base64-js does not.
  if (encoding === 'base64' && type === 'string') {
    subject = stringtrim(subject)
    while (subject.length % 4 !== 0) {
      subject = subject + '='
    }
  }

  // Find the length
  var length
  if (type === 'number')
    length = coerce(subject)
  else if (type === 'string')
    length = Buffer.byteLength(subject, encoding)
  else if (type === 'object')
    length = coerce(subject.length) // assume that object is array-like
  else
    throw new Error('First argument needs to be a number, array or string.')

  var buf
  if (Buffer._useTypedArrays) {
    // Preferred: Return an augmented `Uint8Array` instance for best performance
    buf = Buffer._augment(new Uint8Array(length))
  } else {
    // Fallback: Return THIS instance of Buffer (created by `new`)
    buf = this
    buf.length = length
    buf._isBuffer = true
  }

  var i
  if (Buffer._useTypedArrays && typeof subject.byteLength === 'number') {
    // Speed optimization -- use set if we're copying from a typed array
    buf._set(subject)
  } else if (isArrayish(subject)) {
    // Treat array-ish objects as a byte array
    for (i = 0; i < length; i++) {
      if (Buffer.isBuffer(subject))
        buf[i] = subject.readUInt8(i)
      else
        buf[i] = subject[i]
    }
  } else if (type === 'string') {
    buf.write(subject, 0, encoding)
  } else if (type === 'number' && !Buffer._useTypedArrays && !noZero) {
    for (i = 0; i < length; i++) {
      buf[i] = 0
    }
  }

  return buf
}

// STATIC METHODS
// ==============

Buffer.isEncoding = function (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.isBuffer = function (b) {
  return !!(b !== null && b !== undefined && b._isBuffer)
}

Buffer.byteLength = function (str, encoding) {
  var ret
  str = str + ''
  switch (encoding || 'utf8') {
    case 'hex':
      ret = str.length / 2
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8ToBytes(str).length
      break
    case 'ascii':
    case 'binary':
    case 'raw':
      ret = str.length
      break
    case 'base64':
      ret = base64ToBytes(str).length
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = str.length * 2
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.concat = function (list, totalLength) {
  assert(isArray(list), 'Usage: Buffer.concat(list, [totalLength])\n' +
      'list should be an Array.')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (typeof totalLength !== 'number') {
    totalLength = 0
    for (i = 0; i < list.length; i++) {
      totalLength += list[i].length
    }
  }

  var buf = new Buffer(totalLength)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

// BUFFER INSTANCE METHODS
// =======================

function _hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  assert(strLen % 2 === 0, 'Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16)
    assert(!isNaN(byte), 'Invalid hex string')
    buf[offset + i] = byte
  }
  Buffer._charsWritten = i * 2
  return i
}

function _utf8Write (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(utf8ToBytes(string), buf, offset, length)
  return charsWritten
}

function _asciiWrite (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(asciiToBytes(string), buf, offset, length)
  return charsWritten
}

function _binaryWrite (buf, string, offset, length) {
  return _asciiWrite(buf, string, offset, length)
}

function _base64Write (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(base64ToBytes(string), buf, offset, length)
  return charsWritten
}

function _utf16leWrite (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(utf16leToBytes(string), buf, offset, length)
  return charsWritten
}

Buffer.prototype.write = function (string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length
      length = undefined
    }
  } else {  // legacy
    var swap = encoding
    encoding = offset
    offset = length
    length = swap
  }

  offset = Number(offset) || 0
  var remaining = this.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase()

  var ret
  switch (encoding) {
    case 'hex':
      ret = _hexWrite(this, string, offset, length)
      break
    case 'utf8':
    case 'utf-8':
      ret = _utf8Write(this, string, offset, length)
      break
    case 'ascii':
      ret = _asciiWrite(this, string, offset, length)
      break
    case 'binary':
      ret = _binaryWrite(this, string, offset, length)
      break
    case 'base64':
      ret = _base64Write(this, string, offset, length)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = _utf16leWrite(this, string, offset, length)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toString = function (encoding, start, end) {
  var self = this

  encoding = String(encoding || 'utf8').toLowerCase()
  start = Number(start) || 0
  end = (end !== undefined)
    ? Number(end)
    : end = self.length

  // Fastpath empty strings
  if (end === start)
    return ''

  var ret
  switch (encoding) {
    case 'hex':
      ret = _hexSlice(self, start, end)
      break
    case 'utf8':
    case 'utf-8':
      ret = _utf8Slice(self, start, end)
      break
    case 'ascii':
      ret = _asciiSlice(self, start, end)
      break
    case 'binary':
      ret = _binarySlice(self, start, end)
      break
    case 'base64':
      ret = _base64Slice(self, start, end)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = _utf16leSlice(self, start, end)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toJSON = function () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function (target, target_start, start, end) {
  var source = this

  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (!target_start) target_start = 0

  // Copy 0 bytes; we're done
  if (end === start) return
  if (target.length === 0 || source.length === 0) return

  // Fatal error conditions
  assert(end >= start, 'sourceEnd < sourceStart')
  assert(target_start >= 0 && target_start < target.length,
      'targetStart out of bounds')
  assert(start >= 0 && start < source.length, 'sourceStart out of bounds')
  assert(end >= 0 && end <= source.length, 'sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length)
    end = this.length
  if (target.length - target_start < end - start)
    end = target.length - target_start + start

  var len = end - start

  if (len < 100 || !Buffer._useTypedArrays) {
    for (var i = 0; i < len; i++)
      target[i + target_start] = this[i + start]
  } else {
    target._set(this.subarray(start, start + len), target_start)
  }
}

function _base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function _utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function _asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++)
    ret += String.fromCharCode(buf[i])
  return ret
}

function _binarySlice (buf, start, end) {
  return _asciiSlice(buf, start, end)
}

function _hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function _utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i+1] * 256)
  }
  return res
}

Buffer.prototype.slice = function (start, end) {
  var len = this.length
  start = clamp(start, len, 0)
  end = clamp(end, len, len)

  if (Buffer._useTypedArrays) {
    return Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    var newBuf = new Buffer(sliceLen, undefined, true)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
    return newBuf
  }
}

// `get` will be removed in Node 0.13+
Buffer.prototype.get = function (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` will be removed in Node 0.13+
Buffer.prototype.set = function (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

Buffer.prototype.readUInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  return this[offset]
}

function _readUInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    val = buf[offset]
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
  } else {
    val = buf[offset] << 8
    if (offset + 1 < len)
      val |= buf[offset + 1]
  }
  return val
}

Buffer.prototype.readUInt16LE = function (offset, noAssert) {
  return _readUInt16(this, offset, true, noAssert)
}

Buffer.prototype.readUInt16BE = function (offset, noAssert) {
  return _readUInt16(this, offset, false, noAssert)
}

function _readUInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    if (offset + 2 < len)
      val = buf[offset + 2] << 16
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
    val |= buf[offset]
    if (offset + 3 < len)
      val = val + (buf[offset + 3] << 24 >>> 0)
  } else {
    if (offset + 1 < len)
      val = buf[offset + 1] << 16
    if (offset + 2 < len)
      val |= buf[offset + 2] << 8
    if (offset + 3 < len)
      val |= buf[offset + 3]
    val = val + (buf[offset] << 24 >>> 0)
  }
  return val
}

Buffer.prototype.readUInt32LE = function (offset, noAssert) {
  return _readUInt32(this, offset, true, noAssert)
}

Buffer.prototype.readUInt32BE = function (offset, noAssert) {
  return _readUInt32(this, offset, false, noAssert)
}

Buffer.prototype.readInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null,
        'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  var neg = this[offset] & 0x80
  if (neg)
    return (0xff - this[offset] + 1) * -1
  else
    return this[offset]
}

function _readInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = _readUInt16(buf, offset, littleEndian, true)
  var neg = val & 0x8000
  if (neg)
    return (0xffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt16LE = function (offset, noAssert) {
  return _readInt16(this, offset, true, noAssert)
}

Buffer.prototype.readInt16BE = function (offset, noAssert) {
  return _readInt16(this, offset, false, noAssert)
}

function _readInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = _readUInt32(buf, offset, littleEndian, true)
  var neg = val & 0x80000000
  if (neg)
    return (0xffffffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt32LE = function (offset, noAssert) {
  return _readInt32(this, offset, true, noAssert)
}

Buffer.prototype.readInt32BE = function (offset, noAssert) {
  return _readInt32(this, offset, false, noAssert)
}

function _readFloat (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 23, 4)
}

Buffer.prototype.readFloatLE = function (offset, noAssert) {
  return _readFloat(this, offset, true, noAssert)
}

Buffer.prototype.readFloatBE = function (offset, noAssert) {
  return _readFloat(this, offset, false, noAssert)
}

function _readDouble (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 7 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 52, 8)
}

Buffer.prototype.readDoubleLE = function (offset, noAssert) {
  return _readDouble(this, offset, true, noAssert)
}

Buffer.prototype.readDoubleBE = function (offset, noAssert) {
  return _readDouble(this, offset, false, noAssert)
}

Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'trying to write beyond buffer length')
    verifuint(value, 0xff)
  }

  if (offset >= this.length) return

  this[offset] = value
}

function _writeUInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 2); i < j; i++) {
    buf[offset + i] =
        (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
            (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
  _writeUInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
  _writeUInt16(this, value, offset, false, noAssert)
}

function _writeUInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffffffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 4); i < j; i++) {
    buf[offset + i] =
        (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
  _writeUInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
  _writeUInt32(this, value, offset, false, noAssert)
}

Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7f, -0x80)
  }

  if (offset >= this.length)
    return

  if (value >= 0)
    this.writeUInt8(value, offset, noAssert)
  else
    this.writeUInt8(0xff + value + 1, offset, noAssert)
}

function _writeInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fff, -0x8000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    _writeUInt16(buf, value, offset, littleEndian, noAssert)
  else
    _writeUInt16(buf, 0xffff + value + 1, offset, littleEndian, noAssert)
}

Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
  _writeInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
  _writeInt16(this, value, offset, false, noAssert)
}

function _writeInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fffffff, -0x80000000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    _writeUInt32(buf, value, offset, littleEndian, noAssert)
  else
    _writeUInt32(buf, 0xffffffff + value + 1, offset, littleEndian, noAssert)
}

Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
  _writeInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
  _writeInt32(this, value, offset, false, noAssert)
}

function _writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifIEEE754(value, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 23, 4)
}

Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
  _writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
  _writeFloat(this, value, offset, false, noAssert)
}

function _writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 7 < buf.length,
        'Trying to write beyond buffer length')
    verifIEEE754(value, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 52, 8)
}

Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
  _writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
  _writeDouble(this, value, offset, false, noAssert)
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (typeof value === 'string') {
    value = value.charCodeAt(0)
  }

  assert(typeof value === 'number' && !isNaN(value), 'value is not a number')
  assert(end >= start, 'end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  assert(start >= 0 && start < this.length, 'start out of bounds')
  assert(end >= 0 && end <= this.length, 'end out of bounds')

  for (var i = start; i < end; i++) {
    this[i] = value
  }
}

Buffer.prototype.inspect = function () {
  var out = []
  var len = this.length
  for (var i = 0; i < len; i++) {
    out[i] = toHex(this[i])
    if (i === exports.INSPECT_MAX_BYTES) {
      out[i + 1] = '...'
      break
    }
  }
  return '<Buffer ' + out.join(' ') + '>'
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer._useTypedArrays) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1)
        buf[i] = this[i]
      return buf.buffer
    }
  } else {
    throw new Error('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function (arr) {
  arr._isBuffer = true

  // save reference to original Uint8Array get/set methods before overwriting
  arr._get = arr.get
  arr._set = arr.set

  // deprecated, will be removed in node 0.13+
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

// slice(start, end)
function clamp (index, len, defaultValue) {
  if (typeof index !== 'number') return defaultValue
  index = ~~index;  // Coerce to integer.
  if (index >= len) return len
  if (index >= 0) return index
  index += len
  if (index >= 0) return index
  return 0
}

function coerce (length) {
  // Coerce length to a number (possibly NaN), round up
  // in case it's fractional (e.g. 123.456) then do a
  // double negate to coerce a NaN to 0. Easy, right?
  length = ~~Math.ceil(+length)
  return length < 0 ? 0 : length
}

function isArray (subject) {
  return (Array.isArray || function (subject) {
    return Object.prototype.toString.call(subject) === '[object Array]'
  })(subject)
}

function isArrayish (subject) {
  return isArray(subject) || Buffer.isBuffer(subject) ||
      subject && typeof subject === 'object' &&
      typeof subject.length === 'number'
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    var b = str.charCodeAt(i)
    if (b <= 0x7F)
      byteArray.push(str.charCodeAt(i))
    else {
      var start = i
      if (b >= 0xD800 && b <= 0xDFFF) i++
      var h = encodeURIComponent(str.slice(start, i+1)).substr(1).split('%')
      for (var j = 0; j < h.length; j++)
        byteArray.push(parseInt(h[j], 16))
    }
  }
  return byteArray
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(str)
}

function blitBuffer (src, dst, offset, length) {
  var pos
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length))
      break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

/*
 * We have to make sure that the value is a valid integer. This means that it
 * is non-negative. It has no fractional component and that it does not
 * exceed the maximum allowed value.
 */
function verifuint (value, max) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value >= 0, 'specified a negative value for writing an unsigned value')
  assert(value <= max, 'value is larger than maximum value for type')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifsint (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifIEEE754 (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
}

function assert (test, message) {
  if (!test) throw new Error(message || 'Failed assertion')
}

},{"base64-js":16,"ieee754":17}],16:[function(require,module,exports){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)
	var PLUS_URL_SAFE = '-'.charCodeAt(0)
	var SLASH_URL_SAFE = '_'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS ||
		    code === PLUS_URL_SAFE)
			return 62 // '+'
		if (code === SLASH ||
		    code === SLASH_URL_SAFE)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],17:[function(require,module,exports){
exports.read = function(buffer, offset, isLE, mLen, nBytes) {
  var e, m,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      nBits = -7,
      i = isLE ? (nBytes - 1) : 0,
      d = isLE ? -1 : 1,
      s = buffer[offset + i];

  i += d;

  e = s & ((1 << (-nBits)) - 1);
  s >>= (-nBits);
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8);

  m = e & ((1 << (-nBits)) - 1);
  e >>= (-nBits);
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8);

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity);
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
};

exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0),
      i = isLE ? 0 : (nBytes - 1),
      d = isLE ? 1 : -1,
      s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

  value = Math.abs(value);

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }

    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8);

  e = (e << mLen) | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8);

  buffer[offset + i - d] |= s * 128;
};

},{}],18:[function(require,module,exports){
var Buffer = require('buffer').Buffer;
var intSize = 4;
var zeroBuffer = new Buffer(intSize); zeroBuffer.fill(0);
var chrsz = 8;

function toArray(buf, bigEndian) {
  if ((buf.length % intSize) !== 0) {
    var len = buf.length + (intSize - (buf.length % intSize));
    buf = Buffer.concat([buf, zeroBuffer], len);
  }

  var arr = [];
  var fn = bigEndian ? buf.readInt32BE : buf.readInt32LE;
  for (var i = 0; i < buf.length; i += intSize) {
    arr.push(fn.call(buf, i));
  }
  return arr;
}

function toBuffer(arr, size, bigEndian) {
  var buf = new Buffer(size);
  var fn = bigEndian ? buf.writeInt32BE : buf.writeInt32LE;
  for (var i = 0; i < arr.length; i++) {
    fn.call(buf, arr[i], i * 4, true);
  }
  return buf;
}

function hash(buf, fn, hashSize, bigEndian) {
  if (!Buffer.isBuffer(buf)) buf = new Buffer(buf);
  var arr = fn(toArray(buf, bigEndian), buf.length * chrsz);
  return toBuffer(arr, hashSize, bigEndian);
}

module.exports = { hash: hash };

},{"buffer":15}],19:[function(require,module,exports){
var Buffer = require('buffer').Buffer
var sha = require('./sha')
var sha256 = require('./sha256')
var rng = require('./rng')
var md5 = require('./md5')

var algorithms = {
  sha1: sha,
  sha256: sha256,
  md5: md5
}

var blocksize = 64
var zeroBuffer = new Buffer(blocksize); zeroBuffer.fill(0)
function hmac(fn, key, data) {
  if(!Buffer.isBuffer(key)) key = new Buffer(key)
  if(!Buffer.isBuffer(data)) data = new Buffer(data)

  if(key.length > blocksize) {
    key = fn(key)
  } else if(key.length < blocksize) {
    key = Buffer.concat([key, zeroBuffer], blocksize)
  }

  var ipad = new Buffer(blocksize), opad = new Buffer(blocksize)
  for(var i = 0; i < blocksize; i++) {
    ipad[i] = key[i] ^ 0x36
    opad[i] = key[i] ^ 0x5C
  }

  var hash = fn(Buffer.concat([ipad, data]))
  return fn(Buffer.concat([opad, hash]))
}

function hash(alg, key) {
  alg = alg || 'sha1'
  var fn = algorithms[alg]
  var bufs = []
  var length = 0
  if(!fn) error('algorithm:', alg, 'is not yet supported')
  return {
    update: function (data) {
      if(!Buffer.isBuffer(data)) data = new Buffer(data)
        
      bufs.push(data)
      length += data.length
      return this
    },
    digest: function (enc) {
      var buf = Buffer.concat(bufs)
      var r = key ? hmac(fn, key, buf) : fn(buf)
      bufs = null
      return enc ? r.toString(enc) : r
    }
  }
}

function error () {
  var m = [].slice.call(arguments).join(' ')
  throw new Error([
    m,
    'we accept pull requests',
    'http://github.com/dominictarr/crypto-browserify'
    ].join('\n'))
}

exports.createHash = function (alg) { return hash(alg) }
exports.createHmac = function (alg, key) { return hash(alg, key) }
exports.randomBytes = function(size, callback) {
  if (callback && callback.call) {
    try {
      callback.call(this, undefined, new Buffer(rng(size)))
    } catch (err) { callback(err) }
  } else {
    return new Buffer(rng(size))
  }
}

function each(a, f) {
  for(var i in a)
    f(a[i], i)
}

// the least I can do is make error messages for the rest of the node.js/crypto api.
each(['createCredentials'
, 'createCipher'
, 'createCipheriv'
, 'createDecipher'
, 'createDecipheriv'
, 'createSign'
, 'createVerify'
, 'createDiffieHellman'
, 'pbkdf2'], function (name) {
  exports[name] = function () {
    error('sorry,', name, 'is not implemented yet')
  }
})

},{"./md5":20,"./rng":21,"./sha":22,"./sha256":23,"buffer":15}],20:[function(require,module,exports){
/*
 * A JavaScript implementation of the RSA Data Security, Inc. MD5 Message
 * Digest Algorithm, as defined in RFC 1321.
 * Version 2.1 Copyright (C) Paul Johnston 1999 - 2002.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for more info.
 */

var helpers = require('./helpers');

/*
 * Perform a simple self-test to see if the VM is working
 */
function md5_vm_test()
{
  return hex_md5("abc") == "900150983cd24fb0d6963f7d28e17f72";
}

/*
 * Calculate the MD5 of an array of little-endian words, and a bit length
 */
function core_md5(x, len)
{
  /* append padding */
  x[len >> 5] |= 0x80 << ((len) % 32);
  x[(((len + 64) >>> 9) << 4) + 14] = len;

  var a =  1732584193;
  var b = -271733879;
  var c = -1732584194;
  var d =  271733878;

  for(var i = 0; i < x.length; i += 16)
  {
    var olda = a;
    var oldb = b;
    var oldc = c;
    var oldd = d;

    a = md5_ff(a, b, c, d, x[i+ 0], 7 , -680876936);
    d = md5_ff(d, a, b, c, x[i+ 1], 12, -389564586);
    c = md5_ff(c, d, a, b, x[i+ 2], 17,  606105819);
    b = md5_ff(b, c, d, a, x[i+ 3], 22, -1044525330);
    a = md5_ff(a, b, c, d, x[i+ 4], 7 , -176418897);
    d = md5_ff(d, a, b, c, x[i+ 5], 12,  1200080426);
    c = md5_ff(c, d, a, b, x[i+ 6], 17, -1473231341);
    b = md5_ff(b, c, d, a, x[i+ 7], 22, -45705983);
    a = md5_ff(a, b, c, d, x[i+ 8], 7 ,  1770035416);
    d = md5_ff(d, a, b, c, x[i+ 9], 12, -1958414417);
    c = md5_ff(c, d, a, b, x[i+10], 17, -42063);
    b = md5_ff(b, c, d, a, x[i+11], 22, -1990404162);
    a = md5_ff(a, b, c, d, x[i+12], 7 ,  1804603682);
    d = md5_ff(d, a, b, c, x[i+13], 12, -40341101);
    c = md5_ff(c, d, a, b, x[i+14], 17, -1502002290);
    b = md5_ff(b, c, d, a, x[i+15], 22,  1236535329);

    a = md5_gg(a, b, c, d, x[i+ 1], 5 , -165796510);
    d = md5_gg(d, a, b, c, x[i+ 6], 9 , -1069501632);
    c = md5_gg(c, d, a, b, x[i+11], 14,  643717713);
    b = md5_gg(b, c, d, a, x[i+ 0], 20, -373897302);
    a = md5_gg(a, b, c, d, x[i+ 5], 5 , -701558691);
    d = md5_gg(d, a, b, c, x[i+10], 9 ,  38016083);
    c = md5_gg(c, d, a, b, x[i+15], 14, -660478335);
    b = md5_gg(b, c, d, a, x[i+ 4], 20, -405537848);
    a = md5_gg(a, b, c, d, x[i+ 9], 5 ,  568446438);
    d = md5_gg(d, a, b, c, x[i+14], 9 , -1019803690);
    c = md5_gg(c, d, a, b, x[i+ 3], 14, -187363961);
    b = md5_gg(b, c, d, a, x[i+ 8], 20,  1163531501);
    a = md5_gg(a, b, c, d, x[i+13], 5 , -1444681467);
    d = md5_gg(d, a, b, c, x[i+ 2], 9 , -51403784);
    c = md5_gg(c, d, a, b, x[i+ 7], 14,  1735328473);
    b = md5_gg(b, c, d, a, x[i+12], 20, -1926607734);

    a = md5_hh(a, b, c, d, x[i+ 5], 4 , -378558);
    d = md5_hh(d, a, b, c, x[i+ 8], 11, -2022574463);
    c = md5_hh(c, d, a, b, x[i+11], 16,  1839030562);
    b = md5_hh(b, c, d, a, x[i+14], 23, -35309556);
    a = md5_hh(a, b, c, d, x[i+ 1], 4 , -1530992060);
    d = md5_hh(d, a, b, c, x[i+ 4], 11,  1272893353);
    c = md5_hh(c, d, a, b, x[i+ 7], 16, -155497632);
    b = md5_hh(b, c, d, a, x[i+10], 23, -1094730640);
    a = md5_hh(a, b, c, d, x[i+13], 4 ,  681279174);
    d = md5_hh(d, a, b, c, x[i+ 0], 11, -358537222);
    c = md5_hh(c, d, a, b, x[i+ 3], 16, -722521979);
    b = md5_hh(b, c, d, a, x[i+ 6], 23,  76029189);
    a = md5_hh(a, b, c, d, x[i+ 9], 4 , -640364487);
    d = md5_hh(d, a, b, c, x[i+12], 11, -421815835);
    c = md5_hh(c, d, a, b, x[i+15], 16,  530742520);
    b = md5_hh(b, c, d, a, x[i+ 2], 23, -995338651);

    a = md5_ii(a, b, c, d, x[i+ 0], 6 , -198630844);
    d = md5_ii(d, a, b, c, x[i+ 7], 10,  1126891415);
    c = md5_ii(c, d, a, b, x[i+14], 15, -1416354905);
    b = md5_ii(b, c, d, a, x[i+ 5], 21, -57434055);
    a = md5_ii(a, b, c, d, x[i+12], 6 ,  1700485571);
    d = md5_ii(d, a, b, c, x[i+ 3], 10, -1894986606);
    c = md5_ii(c, d, a, b, x[i+10], 15, -1051523);
    b = md5_ii(b, c, d, a, x[i+ 1], 21, -2054922799);
    a = md5_ii(a, b, c, d, x[i+ 8], 6 ,  1873313359);
    d = md5_ii(d, a, b, c, x[i+15], 10, -30611744);
    c = md5_ii(c, d, a, b, x[i+ 6], 15, -1560198380);
    b = md5_ii(b, c, d, a, x[i+13], 21,  1309151649);
    a = md5_ii(a, b, c, d, x[i+ 4], 6 , -145523070);
    d = md5_ii(d, a, b, c, x[i+11], 10, -1120210379);
    c = md5_ii(c, d, a, b, x[i+ 2], 15,  718787259);
    b = md5_ii(b, c, d, a, x[i+ 9], 21, -343485551);

    a = safe_add(a, olda);
    b = safe_add(b, oldb);
    c = safe_add(c, oldc);
    d = safe_add(d, oldd);
  }
  return Array(a, b, c, d);

}

/*
 * These functions implement the four basic operations the algorithm uses.
 */
function md5_cmn(q, a, b, x, s, t)
{
  return safe_add(bit_rol(safe_add(safe_add(a, q), safe_add(x, t)), s),b);
}
function md5_ff(a, b, c, d, x, s, t)
{
  return md5_cmn((b & c) | ((~b) & d), a, b, x, s, t);
}
function md5_gg(a, b, c, d, x, s, t)
{
  return md5_cmn((b & d) | (c & (~d)), a, b, x, s, t);
}
function md5_hh(a, b, c, d, x, s, t)
{
  return md5_cmn(b ^ c ^ d, a, b, x, s, t);
}
function md5_ii(a, b, c, d, x, s, t)
{
  return md5_cmn(c ^ (b | (~d)), a, b, x, s, t);
}

/*
 * Add integers, wrapping at 2^32. This uses 16-bit operations internally
 * to work around bugs in some JS interpreters.
 */
function safe_add(x, y)
{
  var lsw = (x & 0xFFFF) + (y & 0xFFFF);
  var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xFFFF);
}

/*
 * Bitwise rotate a 32-bit number to the left.
 */
function bit_rol(num, cnt)
{
  return (num << cnt) | (num >>> (32 - cnt));
}

module.exports = function md5(buf) {
  return helpers.hash(buf, core_md5, 16);
};

},{"./helpers":18}],21:[function(require,module,exports){
// Original code adapted from Robert Kieffer.
// details at https://github.com/broofa/node-uuid
(function() {
  var _global = this;

  var mathRNG, whatwgRNG;

  // NOTE: Math.random() does not guarantee "cryptographic quality"
  mathRNG = function(size) {
    var bytes = new Array(size);
    var r;

    for (var i = 0, r; i < size; i++) {
      if ((i & 0x03) == 0) r = Math.random() * 0x100000000;
      bytes[i] = r >>> ((i & 0x03) << 3) & 0xff;
    }

    return bytes;
  }

  if (_global.crypto && crypto.getRandomValues) {
    whatwgRNG = function(size) {
      var bytes = new Uint8Array(size);
      crypto.getRandomValues(bytes);
      return bytes;
    }
  }

  module.exports = whatwgRNG || mathRNG;

}())

},{}],22:[function(require,module,exports){
/*
 * A JavaScript implementation of the Secure Hash Algorithm, SHA-1, as defined
 * in FIPS PUB 180-1
 * Version 2.1a Copyright Paul Johnston 2000 - 2002.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for details.
 */

var helpers = require('./helpers');

/*
 * Calculate the SHA-1 of an array of big-endian words, and a bit length
 */
function core_sha1(x, len)
{
  /* append padding */
  x[len >> 5] |= 0x80 << (24 - len % 32);
  x[((len + 64 >> 9) << 4) + 15] = len;

  var w = Array(80);
  var a =  1732584193;
  var b = -271733879;
  var c = -1732584194;
  var d =  271733878;
  var e = -1009589776;

  for(var i = 0; i < x.length; i += 16)
  {
    var olda = a;
    var oldb = b;
    var oldc = c;
    var oldd = d;
    var olde = e;

    for(var j = 0; j < 80; j++)
    {
      if(j < 16) w[j] = x[i + j];
      else w[j] = rol(w[j-3] ^ w[j-8] ^ w[j-14] ^ w[j-16], 1);
      var t = safe_add(safe_add(rol(a, 5), sha1_ft(j, b, c, d)),
                       safe_add(safe_add(e, w[j]), sha1_kt(j)));
      e = d;
      d = c;
      c = rol(b, 30);
      b = a;
      a = t;
    }

    a = safe_add(a, olda);
    b = safe_add(b, oldb);
    c = safe_add(c, oldc);
    d = safe_add(d, oldd);
    e = safe_add(e, olde);
  }
  return Array(a, b, c, d, e);

}

/*
 * Perform the appropriate triplet combination function for the current
 * iteration
 */
function sha1_ft(t, b, c, d)
{
  if(t < 20) return (b & c) | ((~b) & d);
  if(t < 40) return b ^ c ^ d;
  if(t < 60) return (b & c) | (b & d) | (c & d);
  return b ^ c ^ d;
}

/*
 * Determine the appropriate additive constant for the current iteration
 */
function sha1_kt(t)
{
  return (t < 20) ?  1518500249 : (t < 40) ?  1859775393 :
         (t < 60) ? -1894007588 : -899497514;
}

/*
 * Add integers, wrapping at 2^32. This uses 16-bit operations internally
 * to work around bugs in some JS interpreters.
 */
function safe_add(x, y)
{
  var lsw = (x & 0xFFFF) + (y & 0xFFFF);
  var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xFFFF);
}

/*
 * Bitwise rotate a 32-bit number to the left.
 */
function rol(num, cnt)
{
  return (num << cnt) | (num >>> (32 - cnt));
}

module.exports = function sha1(buf) {
  return helpers.hash(buf, core_sha1, 20, true);
};

},{"./helpers":18}],23:[function(require,module,exports){

/**
 * A JavaScript implementation of the Secure Hash Algorithm, SHA-256, as defined
 * in FIPS 180-2
 * Version 2.2-beta Copyright Angel Marin, Paul Johnston 2000 - 2009.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 *
 */

var helpers = require('./helpers');

var safe_add = function(x, y) {
  var lsw = (x & 0xFFFF) + (y & 0xFFFF);
  var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xFFFF);
};

var S = function(X, n) {
  return (X >>> n) | (X << (32 - n));
};

var R = function(X, n) {
  return (X >>> n);
};

var Ch = function(x, y, z) {
  return ((x & y) ^ ((~x) & z));
};

var Maj = function(x, y, z) {
  return ((x & y) ^ (x & z) ^ (y & z));
};

var Sigma0256 = function(x) {
  return (S(x, 2) ^ S(x, 13) ^ S(x, 22));
};

var Sigma1256 = function(x) {
  return (S(x, 6) ^ S(x, 11) ^ S(x, 25));
};

var Gamma0256 = function(x) {
  return (S(x, 7) ^ S(x, 18) ^ R(x, 3));
};

var Gamma1256 = function(x) {
  return (S(x, 17) ^ S(x, 19) ^ R(x, 10));
};

var core_sha256 = function(m, l) {
  var K = new Array(0x428A2F98,0x71374491,0xB5C0FBCF,0xE9B5DBA5,0x3956C25B,0x59F111F1,0x923F82A4,0xAB1C5ED5,0xD807AA98,0x12835B01,0x243185BE,0x550C7DC3,0x72BE5D74,0x80DEB1FE,0x9BDC06A7,0xC19BF174,0xE49B69C1,0xEFBE4786,0xFC19DC6,0x240CA1CC,0x2DE92C6F,0x4A7484AA,0x5CB0A9DC,0x76F988DA,0x983E5152,0xA831C66D,0xB00327C8,0xBF597FC7,0xC6E00BF3,0xD5A79147,0x6CA6351,0x14292967,0x27B70A85,0x2E1B2138,0x4D2C6DFC,0x53380D13,0x650A7354,0x766A0ABB,0x81C2C92E,0x92722C85,0xA2BFE8A1,0xA81A664B,0xC24B8B70,0xC76C51A3,0xD192E819,0xD6990624,0xF40E3585,0x106AA070,0x19A4C116,0x1E376C08,0x2748774C,0x34B0BCB5,0x391C0CB3,0x4ED8AA4A,0x5B9CCA4F,0x682E6FF3,0x748F82EE,0x78A5636F,0x84C87814,0x8CC70208,0x90BEFFFA,0xA4506CEB,0xBEF9A3F7,0xC67178F2);
  var HASH = new Array(0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A, 0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19);
    var W = new Array(64);
    var a, b, c, d, e, f, g, h, i, j;
    var T1, T2;
  /* append padding */
  m[l >> 5] |= 0x80 << (24 - l % 32);
  m[((l + 64 >> 9) << 4) + 15] = l;
  for (var i = 0; i < m.length; i += 16) {
    a = HASH[0]; b = HASH[1]; c = HASH[2]; d = HASH[3]; e = HASH[4]; f = HASH[5]; g = HASH[6]; h = HASH[7];
    for (var j = 0; j < 64; j++) {
      if (j < 16) {
        W[j] = m[j + i];
      } else {
        W[j] = safe_add(safe_add(safe_add(Gamma1256(W[j - 2]), W[j - 7]), Gamma0256(W[j - 15])), W[j - 16]);
      }
      T1 = safe_add(safe_add(safe_add(safe_add(h, Sigma1256(e)), Ch(e, f, g)), K[j]), W[j]);
      T2 = safe_add(Sigma0256(a), Maj(a, b, c));
      h = g; g = f; f = e; e = safe_add(d, T1); d = c; c = b; b = a; a = safe_add(T1, T2);
    }
    HASH[0] = safe_add(a, HASH[0]); HASH[1] = safe_add(b, HASH[1]); HASH[2] = safe_add(c, HASH[2]); HASH[3] = safe_add(d, HASH[3]);
    HASH[4] = safe_add(e, HASH[4]); HASH[5] = safe_add(f, HASH[5]); HASH[6] = safe_add(g, HASH[6]); HASH[7] = safe_add(h, HASH[7]);
  }
  return HASH;
};

module.exports = function sha256(buf) {
  return helpers.hash(buf, core_sha256, 32, true);
};

},{"./helpers":18}],24:[function(require,module,exports){
"use strict";function q(a){throw a;}var s=void 0,u=!1;var sjcl={cipher:{},hash:{},keyexchange:{},mode:{},misc:{},codec:{},exception:{corrupt:function(a){this.toString=function(){return"CORRUPT: "+this.message};this.message=a},invalid:function(a){this.toString=function(){return"INVALID: "+this.message};this.message=a},bug:function(a){this.toString=function(){return"BUG: "+this.message};this.message=a},notReady:function(a){this.toString=function(){return"NOT READY: "+this.message};this.message=a}}};
"undefined"!==typeof module&&module.exports&&(module.exports=sjcl);"function"===typeof define&&define([],function(){return sjcl});
sjcl.cipher.aes=function(a){this.k[0][0][0]||this.D();var b,c,d,e,f=this.k[0][4],g=this.k[1];b=a.length;var h=1;4!==b&&(6!==b&&8!==b)&&q(new sjcl.exception.invalid("invalid aes key size"));this.b=[d=a.slice(0),e=[]];for(a=b;a<4*b+28;a++){c=d[a-1];if(0===a%b||8===b&&4===a%b)c=f[c>>>24]<<24^f[c>>16&255]<<16^f[c>>8&255]<<8^f[c&255],0===a%b&&(c=c<<8^c>>>24^h<<24,h=h<<1^283*(h>>7));d[a]=d[a-b]^c}for(b=0;a;b++,a--)c=d[b&3?a:a-4],e[b]=4>=a||4>b?c:g[0][f[c>>>24]]^g[1][f[c>>16&255]]^g[2][f[c>>8&255]]^g[3][f[c&
255]]};
sjcl.cipher.aes.prototype={encrypt:function(a){return w(this,a,0)},decrypt:function(a){return w(this,a,1)},k:[[[],[],[],[],[]],[[],[],[],[],[]]],D:function(){var a=this.k[0],b=this.k[1],c=a[4],d=b[4],e,f,g,h=[],l=[],k,n,m,p;for(e=0;0x100>e;e++)l[(h[e]=e<<1^283*(e>>7))^e]=e;for(f=g=0;!c[f];f^=k||1,g=l[g]||1){m=g^g<<1^g<<2^g<<3^g<<4;m=m>>8^m&255^99;c[f]=m;d[m]=f;n=h[e=h[k=h[f]]];p=0x1010101*n^0x10001*e^0x101*k^0x1010100*f;n=0x101*h[m]^0x1010100*m;for(e=0;4>e;e++)a[e][f]=n=n<<24^n>>>8,b[e][m]=p=p<<24^p>>>8}for(e=
0;5>e;e++)a[e]=a[e].slice(0),b[e]=b[e].slice(0)}};
function w(a,b,c){4!==b.length&&q(new sjcl.exception.invalid("invalid aes block size"));var d=a.b[c],e=b[0]^d[0],f=b[c?3:1]^d[1],g=b[2]^d[2];b=b[c?1:3]^d[3];var h,l,k,n=d.length/4-2,m,p=4,t=[0,0,0,0];h=a.k[c];a=h[0];var r=h[1],v=h[2],y=h[3],z=h[4];for(m=0;m<n;m++)h=a[e>>>24]^r[f>>16&255]^v[g>>8&255]^y[b&255]^d[p],l=a[f>>>24]^r[g>>16&255]^v[b>>8&255]^y[e&255]^d[p+1],k=a[g>>>24]^r[b>>16&255]^v[e>>8&255]^y[f&255]^d[p+2],b=a[b>>>24]^r[e>>16&255]^v[f>>8&255]^y[g&255]^d[p+3],p+=4,e=h,f=l,g=k;for(m=0;4>
m;m++)t[c?3&-m:m]=z[e>>>24]<<24^z[f>>16&255]<<16^z[g>>8&255]<<8^z[b&255]^d[p++],h=e,e=f,f=g,g=b,b=h;return t}
sjcl.bitArray={bitSlice:function(a,b,c){a=sjcl.bitArray.P(a.slice(b/32),32-(b&31)).slice(1);return c===s?a:sjcl.bitArray.clamp(a,c-b)},extract:function(a,b,c){var d=Math.floor(-b-c&31);return((b+c-1^b)&-32?a[b/32|0]<<32-d^a[b/32+1|0]>>>d:a[b/32|0]>>>d)&(1<<c)-1},concat:function(a,b){if(0===a.length||0===b.length)return a.concat(b);var c=a[a.length-1],d=sjcl.bitArray.getPartial(c);return 32===d?a.concat(b):sjcl.bitArray.P(b,d,c|0,a.slice(0,a.length-1))},bitLength:function(a){var b=a.length;return 0===
b?0:32*(b-1)+sjcl.bitArray.getPartial(a[b-1])},clamp:function(a,b){if(32*a.length<b)return a;a=a.slice(0,Math.ceil(b/32));var c=a.length;b&=31;0<c&&b&&(a[c-1]=sjcl.bitArray.partial(b,a[c-1]&2147483648>>b-1,1));return a},partial:function(a,b,c){return 32===a?b:(c?b|0:b<<32-a)+0x10000000000*a},getPartial:function(a){return Math.round(a/0x10000000000)||32},equal:function(a,b){if(sjcl.bitArray.bitLength(a)!==sjcl.bitArray.bitLength(b))return u;var c=0,d;for(d=0;d<a.length;d++)c|=a[d]^b[d];return 0===
c},P:function(a,b,c,d){var e;e=0;for(d===s&&(d=[]);32<=b;b-=32)d.push(c),c=0;if(0===b)return d.concat(a);for(e=0;e<a.length;e++)d.push(c|a[e]>>>b),c=a[e]<<32-b;e=a.length?a[a.length-1]:0;a=sjcl.bitArray.getPartial(e);d.push(sjcl.bitArray.partial(b+a&31,32<b+a?c:d.pop(),1));return d},l:function(a,b){return[a[0]^b[0],a[1]^b[1],a[2]^b[2],a[3]^b[3]]},byteswapM:function(a){var b,c;for(b=0;b<a.length;++b)c=a[b],a[b]=c>>>24|c>>>8&0xff00|(c&0xff00)<<8|c<<24;return a}};
sjcl.codec.utf8String={fromBits:function(a){var b="",c=sjcl.bitArray.bitLength(a),d,e;for(d=0;d<c/8;d++)0===(d&3)&&(e=a[d/4]),b+=String.fromCharCode(e>>>24),e<<=8;return decodeURIComponent(escape(b))},toBits:function(a){a=unescape(encodeURIComponent(a));var b=[],c,d=0;for(c=0;c<a.length;c++)d=d<<8|a.charCodeAt(c),3===(c&3)&&(b.push(d),d=0);c&3&&b.push(sjcl.bitArray.partial(8*(c&3),d));return b}};
sjcl.codec.hex={fromBits:function(a){var b="",c;for(c=0;c<a.length;c++)b+=((a[c]|0)+0xf00000000000).toString(16).substr(4);return b.substr(0,sjcl.bitArray.bitLength(a)/4)},toBits:function(a){var b,c=[],d;a=a.replace(/\s|0x/g,"");d=a.length;a+="00000000";for(b=0;b<a.length;b+=8)c.push(parseInt(a.substr(b,8),16)^0);return sjcl.bitArray.clamp(c,4*d)}};
sjcl.codec.base64={J:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",fromBits:function(a,b,c){var d="",e=0,f=sjcl.codec.base64.J,g=0,h=sjcl.bitArray.bitLength(a);c&&(f=f.substr(0,62)+"-_");for(c=0;6*d.length<h;)d+=f.charAt((g^a[c]>>>e)>>>26),6>e?(g=a[c]<<6-e,e+=26,c++):(g<<=6,e-=6);for(;d.length&3&&!b;)d+="=";return d},toBits:function(a,b){a=a.replace(/\s|=/g,"");var c=[],d,e=0,f=sjcl.codec.base64.J,g=0,h;b&&(f=f.substr(0,62)+"-_");for(d=0;d<a.length;d++)h=f.indexOf(a.charAt(d)),
0>h&&q(new sjcl.exception.invalid("this isn't base64!")),26<e?(e-=26,c.push(g^h>>>e),g=h<<32-e):(e+=6,g^=h<<32-e);e&56&&c.push(sjcl.bitArray.partial(e&56,g,1));return c}};sjcl.codec.base64url={fromBits:function(a){return sjcl.codec.base64.fromBits(a,1,1)},toBits:function(a){return sjcl.codec.base64.toBits(a,1)}};sjcl.hash.sha256=function(a){this.b[0]||this.D();a?(this.r=a.r.slice(0),this.o=a.o.slice(0),this.h=a.h):this.reset()};sjcl.hash.sha256.hash=function(a){return(new sjcl.hash.sha256).update(a).finalize()};
sjcl.hash.sha256.prototype={blockSize:512,reset:function(){this.r=this.N.slice(0);this.o=[];this.h=0;return this},update:function(a){"string"===typeof a&&(a=sjcl.codec.utf8String.toBits(a));var b,c=this.o=sjcl.bitArray.concat(this.o,a);b=this.h;a=this.h=b+sjcl.bitArray.bitLength(a);for(b=512+b&-512;b<=a;b+=512)x(this,c.splice(0,16));return this},finalize:function(){var a,b=this.o,c=this.r,b=sjcl.bitArray.concat(b,[sjcl.bitArray.partial(1,1)]);for(a=b.length+2;a&15;a++)b.push(0);b.push(Math.floor(this.h/
4294967296));for(b.push(this.h|0);b.length;)x(this,b.splice(0,16));this.reset();return c},N:[],b:[],D:function(){function a(a){return 0x100000000*(a-Math.floor(a))|0}var b=0,c=2,d;a:for(;64>b;c++){for(d=2;d*d<=c;d++)if(0===c%d)continue a;8>b&&(this.N[b]=a(Math.pow(c,0.5)));this.b[b]=a(Math.pow(c,1/3));b++}}};
function x(a,b){var c,d,e,f=b.slice(0),g=a.r,h=a.b,l=g[0],k=g[1],n=g[2],m=g[3],p=g[4],t=g[5],r=g[6],v=g[7];for(c=0;64>c;c++)16>c?d=f[c]:(d=f[c+1&15],e=f[c+14&15],d=f[c&15]=(d>>>7^d>>>18^d>>>3^d<<25^d<<14)+(e>>>17^e>>>19^e>>>10^e<<15^e<<13)+f[c&15]+f[c+9&15]|0),d=d+v+(p>>>6^p>>>11^p>>>25^p<<26^p<<21^p<<7)+(r^p&(t^r))+h[c],v=r,r=t,t=p,p=m+d|0,m=n,n=k,k=l,l=d+(k&n^m&(k^n))+(k>>>2^k>>>13^k>>>22^k<<30^k<<19^k<<10)|0;g[0]=g[0]+l|0;g[1]=g[1]+k|0;g[2]=g[2]+n|0;g[3]=g[3]+m|0;g[4]=g[4]+p|0;g[5]=g[5]+t|0;g[6]=
g[6]+r|0;g[7]=g[7]+v|0}
sjcl.mode.ccm={name:"ccm",encrypt:function(a,b,c,d,e){var f,g=b.slice(0),h=sjcl.bitArray,l=h.bitLength(c)/8,k=h.bitLength(g)/8;e=e||64;d=d||[];7>l&&q(new sjcl.exception.invalid("ccm: iv must be at least 7 bytes"));for(f=2;4>f&&k>>>8*f;f++);f<15-l&&(f=15-l);c=h.clamp(c,8*(15-f));b=sjcl.mode.ccm.L(a,b,c,d,e,f);g=sjcl.mode.ccm.p(a,g,c,b,e,f);return h.concat(g.data,g.tag)},decrypt:function(a,b,c,d,e){e=e||64;d=d||[];var f=sjcl.bitArray,g=f.bitLength(c)/8,h=f.bitLength(b),l=f.clamp(b,h-e),k=f.bitSlice(b,
h-e),h=(h-e)/8;7>g&&q(new sjcl.exception.invalid("ccm: iv must be at least 7 bytes"));for(b=2;4>b&&h>>>8*b;b++);b<15-g&&(b=15-g);c=f.clamp(c,8*(15-b));l=sjcl.mode.ccm.p(a,l,c,k,e,b);a=sjcl.mode.ccm.L(a,l.data,c,d,e,b);f.equal(l.tag,a)||q(new sjcl.exception.corrupt("ccm: tag doesn't match"));return l.data},L:function(a,b,c,d,e,f){var g=[],h=sjcl.bitArray,l=h.l;e/=8;(e%2||4>e||16<e)&&q(new sjcl.exception.invalid("ccm: invalid tag length"));(0xffffffff<d.length||0xffffffff<b.length)&&q(new sjcl.exception.bug("ccm: can't deal with 4GiB or more data"));
f=[h.partial(8,(d.length?64:0)|e-2<<2|f-1)];f=h.concat(f,c);f[3]|=h.bitLength(b)/8;f=a.encrypt(f);if(d.length){c=h.bitLength(d)/8;65279>=c?g=[h.partial(16,c)]:0xffffffff>=c&&(g=h.concat([h.partial(16,65534)],[c]));g=h.concat(g,d);for(d=0;d<g.length;d+=4)f=a.encrypt(l(f,g.slice(d,d+4).concat([0,0,0])))}for(d=0;d<b.length;d+=4)f=a.encrypt(l(f,b.slice(d,d+4).concat([0,0,0])));return h.clamp(f,8*e)},p:function(a,b,c,d,e,f){var g,h=sjcl.bitArray;g=h.l;var l=b.length,k=h.bitLength(b);c=h.concat([h.partial(8,
f-1)],c).concat([0,0,0]).slice(0,4);d=h.bitSlice(g(d,a.encrypt(c)),0,e);if(!l)return{tag:d,data:[]};for(g=0;g<l;g+=4)c[3]++,e=a.encrypt(c),b[g]^=e[0],b[g+1]^=e[1],b[g+2]^=e[2],b[g+3]^=e[3];return{tag:d,data:h.clamp(b,k)}}};
sjcl.mode.ocb2={name:"ocb2",encrypt:function(a,b,c,d,e,f){128!==sjcl.bitArray.bitLength(c)&&q(new sjcl.exception.invalid("ocb iv must be 128 bits"));var g,h=sjcl.mode.ocb2.H,l=sjcl.bitArray,k=l.l,n=[0,0,0,0];c=h(a.encrypt(c));var m,p=[];d=d||[];e=e||64;for(g=0;g+4<b.length;g+=4)m=b.slice(g,g+4),n=k(n,m),p=p.concat(k(c,a.encrypt(k(c,m)))),c=h(c);m=b.slice(g);b=l.bitLength(m);g=a.encrypt(k(c,[0,0,0,b]));m=l.clamp(k(m.concat([0,0,0]),g),b);n=k(n,k(m.concat([0,0,0]),g));n=a.encrypt(k(n,k(c,h(c))));d.length&&
(n=k(n,f?d:sjcl.mode.ocb2.pmac(a,d)));return p.concat(l.concat(m,l.clamp(n,e)))},decrypt:function(a,b,c,d,e,f){128!==sjcl.bitArray.bitLength(c)&&q(new sjcl.exception.invalid("ocb iv must be 128 bits"));e=e||64;var g=sjcl.mode.ocb2.H,h=sjcl.bitArray,l=h.l,k=[0,0,0,0],n=g(a.encrypt(c)),m,p,t=sjcl.bitArray.bitLength(b)-e,r=[];d=d||[];for(c=0;c+4<t/32;c+=4)m=l(n,a.decrypt(l(n,b.slice(c,c+4)))),k=l(k,m),r=r.concat(m),n=g(n);p=t-32*c;m=a.encrypt(l(n,[0,0,0,p]));m=l(m,h.clamp(b.slice(c),p).concat([0,0,0]));
k=l(k,m);k=a.encrypt(l(k,l(n,g(n))));d.length&&(k=l(k,f?d:sjcl.mode.ocb2.pmac(a,d)));h.equal(h.clamp(k,e),h.bitSlice(b,t))||q(new sjcl.exception.corrupt("ocb: tag doesn't match"));return r.concat(h.clamp(m,p))},pmac:function(a,b){var c,d=sjcl.mode.ocb2.H,e=sjcl.bitArray,f=e.l,g=[0,0,0,0],h=a.encrypt([0,0,0,0]),h=f(h,d(d(h)));for(c=0;c+4<b.length;c+=4)h=d(h),g=f(g,a.encrypt(f(h,b.slice(c,c+4))));c=b.slice(c);128>e.bitLength(c)&&(h=f(h,d(h)),c=e.concat(c,[-2147483648,0,0,0]));g=f(g,c);return a.encrypt(f(d(f(h,
d(h))),g))},H:function(a){return[a[0]<<1^a[1]>>>31,a[1]<<1^a[2]>>>31,a[2]<<1^a[3]>>>31,a[3]<<1^135*(a[0]>>>31)]}};
sjcl.mode.gcm={name:"gcm",encrypt:function(a,b,c,d,e){var f=b.slice(0);b=sjcl.bitArray;d=d||[];a=sjcl.mode.gcm.p(!0,a,f,d,c,e||128);return b.concat(a.data,a.tag)},decrypt:function(a,b,c,d,e){var f=b.slice(0),g=sjcl.bitArray,h=g.bitLength(f);e=e||128;d=d||[];e<=h?(b=g.bitSlice(f,h-e),f=g.bitSlice(f,0,h-e)):(b=f,f=[]);a=sjcl.mode.gcm.p(u,a,f,d,c,e);g.equal(a.tag,b)||q(new sjcl.exception.corrupt("gcm: tag doesn't match"));return a.data},Z:function(a,b){var c,d,e,f,g,h=sjcl.bitArray.l;e=[0,0,0,0];f=b.slice(0);
for(c=0;128>c;c++){(d=0!==(a[Math.floor(c/32)]&1<<31-c%32))&&(e=h(e,f));g=0!==(f[3]&1);for(d=3;0<d;d--)f[d]=f[d]>>>1|(f[d-1]&1)<<31;f[0]>>>=1;g&&(f[0]^=-0x1f000000)}return e},g:function(a,b,c){var d,e=c.length;b=b.slice(0);for(d=0;d<e;d+=4)b[0]^=0xffffffff&c[d],b[1]^=0xffffffff&c[d+1],b[2]^=0xffffffff&c[d+2],b[3]^=0xffffffff&c[d+3],b=sjcl.mode.gcm.Z(b,a);return b},p:function(a,b,c,d,e,f){var g,h,l,k,n,m,p,t,r=sjcl.bitArray;m=c.length;p=r.bitLength(c);t=r.bitLength(d);h=r.bitLength(e);g=b.encrypt([0,
0,0,0]);96===h?(e=e.slice(0),e=r.concat(e,[1])):(e=sjcl.mode.gcm.g(g,[0,0,0,0],e),e=sjcl.mode.gcm.g(g,e,[0,0,Math.floor(h/0x100000000),h&0xffffffff]));h=sjcl.mode.gcm.g(g,[0,0,0,0],d);n=e.slice(0);d=h.slice(0);a||(d=sjcl.mode.gcm.g(g,h,c));for(k=0;k<m;k+=4)n[3]++,l=b.encrypt(n),c[k]^=l[0],c[k+1]^=l[1],c[k+2]^=l[2],c[k+3]^=l[3];c=r.clamp(c,p);a&&(d=sjcl.mode.gcm.g(g,h,c));a=[Math.floor(t/0x100000000),t&0xffffffff,Math.floor(p/0x100000000),p&0xffffffff];d=sjcl.mode.gcm.g(g,d,a);l=b.encrypt(e);d[0]^=l[0];
d[1]^=l[1];d[2]^=l[2];d[3]^=l[3];return{tag:r.bitSlice(d,0,f),data:c}}};sjcl.misc.hmac=function(a,b){this.M=b=b||sjcl.hash.sha256;var c=[[],[]],d,e=b.prototype.blockSize/32;this.n=[new b,new b];a.length>e&&(a=b.hash(a));for(d=0;d<e;d++)c[0][d]=a[d]^909522486,c[1][d]=a[d]^1549556828;this.n[0].update(c[0]);this.n[1].update(c[1]);this.G=new b(this.n[0])};
sjcl.misc.hmac.prototype.encrypt=sjcl.misc.hmac.prototype.mac=function(a){this.Q&&q(new sjcl.exception.invalid("encrypt on already updated hmac called!"));this.update(a);return this.digest(a)};sjcl.misc.hmac.prototype.reset=function(){this.G=new this.M(this.n[0]);this.Q=u};sjcl.misc.hmac.prototype.update=function(a){this.Q=!0;this.G.update(a)};sjcl.misc.hmac.prototype.digest=function(){var a=this.G.finalize(),a=(new this.M(this.n[1])).update(a).finalize();this.reset();return a};
sjcl.misc.pbkdf2=function(a,b,c,d,e){c=c||1E3;(0>d||0>c)&&q(sjcl.exception.invalid("invalid params to pbkdf2"));"string"===typeof a&&(a=sjcl.codec.utf8String.toBits(a));"string"===typeof b&&(b=sjcl.codec.utf8String.toBits(b));e=e||sjcl.misc.hmac;a=new e(a);var f,g,h,l,k=[],n=sjcl.bitArray;for(l=1;32*k.length<(d||1);l++){e=f=a.encrypt(n.concat(b,[l]));for(g=1;g<c;g++){f=a.encrypt(f);for(h=0;h<f.length;h++)e[h]^=f[h]}k=k.concat(e)}d&&(k=n.clamp(k,d));return k};
sjcl.prng=function(a){this.c=[new sjcl.hash.sha256];this.i=[0];this.F=0;this.s={};this.C=0;this.K={};this.O=this.d=this.j=this.W=0;this.b=[0,0,0,0,0,0,0,0];this.f=[0,0,0,0];this.A=s;this.B=a;this.q=u;this.w={progress:{},seeded:{}};this.m=this.V=0;this.t=1;this.u=2;this.S=0x10000;this.I=[0,48,64,96,128,192,0x100,384,512,768,1024];this.T=3E4;this.R=80};
sjcl.prng.prototype={randomWords:function(a,b){var c=[],d;d=this.isReady(b);var e;d===this.m&&q(new sjcl.exception.notReady("generator isn't seeded"));if(d&this.u){d=!(d&this.t);e=[];var f=0,g;this.O=e[0]=(new Date).valueOf()+this.T;for(g=0;16>g;g++)e.push(0x100000000*Math.random()|0);for(g=0;g<this.c.length&&!(e=e.concat(this.c[g].finalize()),f+=this.i[g],this.i[g]=0,!d&&this.F&1<<g);g++);this.F>=1<<this.c.length&&(this.c.push(new sjcl.hash.sha256),this.i.push(0));this.d-=f;f>this.j&&(this.j=f);this.F++;
this.b=sjcl.hash.sha256.hash(this.b.concat(e));this.A=new sjcl.cipher.aes(this.b);for(d=0;4>d&&!(this.f[d]=this.f[d]+1|0,this.f[d]);d++);}for(d=0;d<a;d+=4)0===(d+1)%this.S&&A(this),e=B(this),c.push(e[0],e[1],e[2],e[3]);A(this);return c.slice(0,a)},setDefaultParanoia:function(a,b){0===a&&"Setting paranoia=0 will ruin your security; use it only for testing"!==b&&q("Setting paranoia=0 will ruin your security; use it only for testing");this.B=a},addEntropy:function(a,b,c){c=c||"user";var d,e,f=(new Date).valueOf(),
g=this.s[c],h=this.isReady(),l=0;d=this.K[c];d===s&&(d=this.K[c]=this.W++);g===s&&(g=this.s[c]=0);this.s[c]=(this.s[c]+1)%this.c.length;switch(typeof a){case "number":b===s&&(b=1);this.c[g].update([d,this.C++,1,b,f,1,a|0]);break;case "object":c=Object.prototype.toString.call(a);if("[object Uint32Array]"===c){e=[];for(c=0;c<a.length;c++)e.push(a[c]);a=e}else{"[object Array]"!==c&&(l=1);for(c=0;c<a.length&&!l;c++)"number"!==typeof a[c]&&(l=1)}if(!l){if(b===s)for(c=b=0;c<a.length;c++)for(e=a[c];0<e;)b++,
e>>>=1;this.c[g].update([d,this.C++,2,b,f,a.length].concat(a))}break;case "string":b===s&&(b=a.length);this.c[g].update([d,this.C++,3,b,f,a.length]);this.c[g].update(a);break;default:l=1}l&&q(new sjcl.exception.bug("random: addEntropy only supports number, array of numbers or string"));this.i[g]+=b;this.d+=b;h===this.m&&(this.isReady()!==this.m&&C("seeded",Math.max(this.j,this.d)),C("progress",this.getProgress()))},isReady:function(a){a=this.I[a!==s?a:this.B];return this.j&&this.j>=a?this.i[0]>this.R&&
(new Date).valueOf()>this.O?this.u|this.t:this.t:this.d>=a?this.u|this.m:this.m},getProgress:function(a){a=this.I[a?a:this.B];return this.j>=a?1:this.d>a?1:this.d/a},startCollectors:function(){this.q||(this.a={loadTimeCollector:D(this,this.aa),mouseCollector:D(this,this.ba),keyboardCollector:D(this,this.$),accelerometerCollector:D(this,this.U),touchCollector:D(this,this.da)},window.addEventListener?(window.addEventListener("load",this.a.loadTimeCollector,u),window.addEventListener("mousemove",this.a.mouseCollector,
u),window.addEventListener("keypress",this.a.keyboardCollector,u),window.addEventListener("devicemotion",this.a.accelerometerCollector,u),window.addEventListener("touchmove",this.a.touchCollector,u)):document.attachEvent?(document.attachEvent("onload",this.a.loadTimeCollector),document.attachEvent("onmousemove",this.a.mouseCollector),document.attachEvent("keypress",this.a.keyboardCollector)):q(new sjcl.exception.bug("can't attach event")),this.q=!0)},stopCollectors:function(){this.q&&(window.removeEventListener?
(window.removeEventListener("load",this.a.loadTimeCollector,u),window.removeEventListener("mousemove",this.a.mouseCollector,u),window.removeEventListener("keypress",this.a.keyboardCollector,u),window.removeEventListener("devicemotion",this.a.accelerometerCollector,u),window.removeEventListener("touchmove",this.a.touchCollector,u)):document.detachEvent&&(document.detachEvent("onload",this.a.loadTimeCollector),document.detachEvent("onmousemove",this.a.mouseCollector),document.detachEvent("keypress",
this.a.keyboardCollector)),this.q=u)},addEventListener:function(a,b){this.w[a][this.V++]=b},removeEventListener:function(a,b){var c,d,e=this.w[a],f=[];for(d in e)e.hasOwnProperty(d)&&e[d]===b&&f.push(d);for(c=0;c<f.length;c++)d=f[c],delete e[d]},$:function(){E(1)},ba:function(a){var b,c;try{b=a.x||a.clientX||a.offsetX||0,c=a.y||a.clientY||a.offsetY||0}catch(d){c=b=0}0!=b&&0!=c&&sjcl.random.addEntropy([b,c],2,"mouse");E(0)},da:function(a){a=a.touches[0]||a.changedTouches[0];sjcl.random.addEntropy([a.pageX||
a.clientX,a.pageY||a.clientY],1,"touch");E(0)},aa:function(){E(2)},U:function(a){a=a.accelerationIncludingGravity.x||a.accelerationIncludingGravity.y||a.accelerationIncludingGravity.z;if(window.orientation){var b=window.orientation;"number"===typeof b&&sjcl.random.addEntropy(b,1,"accelerometer")}a&&sjcl.random.addEntropy(a,2,"accelerometer");E(0)}};function C(a,b){var c,d=sjcl.random.w[a],e=[];for(c in d)d.hasOwnProperty(c)&&e.push(d[c]);for(c=0;c<e.length;c++)e[c](b)}
function E(a){"undefined"!==typeof window&&window.performance&&"function"===typeof window.performance.now?sjcl.random.addEntropy(window.performance.now(),a,"loadtime"):sjcl.random.addEntropy((new Date).valueOf(),a,"loadtime")}function A(a){a.b=B(a).concat(B(a));a.A=new sjcl.cipher.aes(a.b)}function B(a){for(var b=0;4>b&&!(a.f[b]=a.f[b]+1|0,a.f[b]);b++);return a.A.encrypt(a.f)}function D(a,b){return function(){b.apply(a,arguments)}}sjcl.random=new sjcl.prng(6);
a:try{var F,G,H,I;if(I="undefined"!==typeof module){var J;if(J=module.exports){var K;try{K=require("crypto")}catch(L){K=null}J=(G=K)&&G.randomBytes}I=J}if(I)F=G.randomBytes(128),F=new Uint32Array((new Uint8Array(F)).buffer),sjcl.random.addEntropy(F,1024,"crypto['randomBytes']");else if("undefined"!==typeof window&&"undefined"!==typeof Uint32Array){H=new Uint32Array(32);if(window.crypto&&window.crypto.getRandomValues)window.crypto.getRandomValues(H);else if(window.msCrypto&&window.msCrypto.getRandomValues)window.msCrypto.getRandomValues(H);
else break a;sjcl.random.addEntropy(H,1024,"crypto['getRandomValues']")}}catch(M){"undefined"!==typeof window&&window.console&&(console.log("There was an error collecting entropy from the browser:"),console.log(M))}
sjcl.json={defaults:{v:1,iter:1E3,ks:128,ts:64,mode:"ccm",adata:"",cipher:"aes"},Y:function(a,b,c,d){c=c||{};d=d||{};var e=sjcl.json,f=e.e({iv:sjcl.random.randomWords(4,0)},e.defaults),g;e.e(f,c);c=f.adata;"string"===typeof f.salt&&(f.salt=sjcl.codec.base64.toBits(f.salt));"string"===typeof f.iv&&(f.iv=sjcl.codec.base64.toBits(f.iv));(!sjcl.mode[f.mode]||!sjcl.cipher[f.cipher]||"string"===typeof a&&100>=f.iter||64!==f.ts&&96!==f.ts&&128!==f.ts||128!==f.ks&&192!==f.ks&&0x100!==f.ks||2>f.iv.length||4<
f.iv.length)&&q(new sjcl.exception.invalid("json encrypt: invalid parameters"));"string"===typeof a?(g=sjcl.misc.cachedPbkdf2(a,f),a=g.key.slice(0,f.ks/32),f.salt=g.salt):sjcl.ecc&&a instanceof sjcl.ecc.elGamal.publicKey&&(g=a.kem(),f.kemtag=g.tag,a=g.key.slice(0,f.ks/32));"string"===typeof b&&(b=sjcl.codec.utf8String.toBits(b));"string"===typeof c&&(f.adata=c=sjcl.codec.utf8String.toBits(c));g=new sjcl.cipher[f.cipher](a);e.e(d,f);d.key=a;f.ct=sjcl.mode[f.mode].encrypt(g,b,f.iv,c,f.ts);return f},
encrypt:function(a,b,c,d){var e=sjcl.json,f=e.Y.apply(e,arguments);return e.encode(f)},X:function(a,b,c,d){c=c||{};d=d||{};var e=sjcl.json;b=e.e(e.e(e.e({},e.defaults),b),c,!0);var f,g;f=b.adata;"string"===typeof b.salt&&(b.salt=sjcl.codec.base64.toBits(b.salt));"string"===typeof b.iv&&(b.iv=sjcl.codec.base64.toBits(b.iv));(!sjcl.mode[b.mode]||!sjcl.cipher[b.cipher]||"string"===typeof a&&100>=b.iter||64!==b.ts&&96!==b.ts&&128!==b.ts||128!==b.ks&&192!==b.ks&&0x100!==b.ks||!b.iv||2>b.iv.length||4<b.iv.length)&&
q(new sjcl.exception.invalid("json decrypt: invalid parameters"));"string"===typeof a?(g=sjcl.misc.cachedPbkdf2(a,b),a=g.key.slice(0,b.ks/32),b.salt=g.salt):sjcl.ecc&&a instanceof sjcl.ecc.elGamal.secretKey&&(a=a.unkem(sjcl.codec.base64.toBits(b.kemtag)).slice(0,b.ks/32));"string"===typeof f&&(f=sjcl.codec.utf8String.toBits(f));g=new sjcl.cipher[b.cipher](a);f=sjcl.mode[b.mode].decrypt(g,b.ct,b.iv,f,b.ts);e.e(d,b);d.key=a;return 1===c.raw?f:sjcl.codec.utf8String.fromBits(f)},decrypt:function(a,b,
c,d){var e=sjcl.json;return e.X(a,e.decode(b),c,d)},encode:function(a){var b,c="{",d="";for(b in a)if(a.hasOwnProperty(b))switch(b.match(/^[a-z0-9]+$/i)||q(new sjcl.exception.invalid("json encode: invalid property name")),c+=d+'"'+b+'":',d=",",typeof a[b]){case "number":case "boolean":c+=a[b];break;case "string":c+='"'+escape(a[b])+'"';break;case "object":c+='"'+sjcl.codec.base64.fromBits(a[b],0)+'"';break;default:q(new sjcl.exception.bug("json encode: unsupported type"))}return c+"}"},decode:function(a){a=
a.replace(/\s/g,"");a.match(/^\{.*\}$/)||q(new sjcl.exception.invalid("json decode: this isn't json!"));a=a.replace(/^\{|\}$/g,"").split(/,/);var b={},c,d;for(c=0;c<a.length;c++)(d=a[c].match(/^\s*(?:(["']?)([a-z][a-z0-9]*)\1)\s*:\s*(?:(-?\d+)|"([a-z0-9+\/%*_.@=\-]*)"|(true|false))$/i))||q(new sjcl.exception.invalid("json decode: this isn't json!")),d[3]?b[d[2]]=parseInt(d[3],10):d[4]?b[d[2]]=d[2].match(/^(ct|adata|salt|iv)$/)?sjcl.codec.base64.toBits(d[4]):unescape(d[4]):d[5]&&(b[d[2]]="true"===
d[5]);return b},e:function(a,b,c){a===s&&(a={});if(b===s)return a;for(var d in b)b.hasOwnProperty(d)&&(c&&(a[d]!==s&&a[d]!==b[d])&&q(new sjcl.exception.invalid("required parameter overridden")),a[d]=b[d]);return a},fa:function(a,b){var c={},d;for(d in a)a.hasOwnProperty(d)&&a[d]!==b[d]&&(c[d]=a[d]);return c},ea:function(a,b){var c={},d;for(d=0;d<b.length;d++)a[b[d]]!==s&&(c[b[d]]=a[b[d]]);return c}};sjcl.encrypt=sjcl.json.encrypt;sjcl.decrypt=sjcl.json.decrypt;sjcl.misc.ca={};
sjcl.misc.cachedPbkdf2=function(a,b){var c=sjcl.misc.ca,d;b=b||{};d=b.iter||1E3;c=c[a]=c[a]||{};d=c[d]=c[d]||{firstSalt:b.salt&&b.salt.length?b.salt.slice(0):sjcl.random.randomWords(2,0)};c=b.salt===s?d.firstSalt:b.salt;d[c]=d[c]||sjcl.misc.pbkdf2(a,c,b.iter);return{key:d[c].slice(0),salt:c.slice(0)}};

},{"crypto":19}]},{},[2])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2Rlc21vbmQvUHJvamVjdHMvSm91cm5leUpvdXJuYWwvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiL2hvbWUvZGVzbW9uZC9Qcm9qZWN0cy9Kb3VybmV5Sm91cm5hbC9hcHAvY29tcG9uZW50cy9nYXBpLmpzIiwiL2hvbWUvZGVzbW9uZC9Qcm9qZWN0cy9Kb3VybmV5Sm91cm5hbC9hcHAvbWFpbi5qcyIsIi9ob21lL2Rlc21vbmQvUHJvamVjdHMvSm91cm5leUpvdXJuYWwvYXBwL3JvdXRlcy9FZGl0b3JSb3V0ZUhhbmRsZXIuanMiLCIvaG9tZS9kZXNtb25kL1Byb2plY3RzL0pvdXJuZXlKb3VybmFsL2FwcC9yb3V0ZXMvSW5kZXhSb3V0ZUhhbmRsZXIuanMiLCIvaG9tZS9kZXNtb25kL1Byb2plY3RzL0pvdXJuZXlKb3VybmFsL2FwcC9yb3V0ZXMvTm90Rm91bmRSb3V0ZUhhbmRsZXIuanMiLCIvaG9tZS9kZXNtb25kL1Byb2plY3RzL0pvdXJuZXlKb3VybmFsL2FwcC9yb3V0ZXMvUmVzdG9yZVJvdXRlSGFuZGxlci5qcyIsIi9ob21lL2Rlc21vbmQvUHJvamVjdHMvSm91cm5leUpvdXJuYWwvYXBwL3JvdXRlcy9Sb290Um91dGVIYW5kbGVyLmpzIiwiL2hvbWUvZGVzbW9uZC9Qcm9qZWN0cy9Kb3VybmV5Sm91cm5hbC9hcHAvcm91dGVzL1NldHRpbmdzUm91dGVIYW5kbGVyLmpzIiwiL2hvbWUvZGVzbW9uZC9Qcm9qZWN0cy9Kb3VybmV5Sm91cm5hbC9hcHAvcm91dGVzL2F1dGhlbnRpY2F0ZS5qcyIsIi9ob21lL2Rlc21vbmQvUHJvamVjdHMvSm91cm5leUpvdXJuYWwvYXBwL3V0aWxpdGllcy9kYXRlcy5qcyIsIi9ob21lL2Rlc21vbmQvUHJvamVjdHMvSm91cm5leUpvdXJuYWwvYXBwL3V0aWxpdGllcy9kZWNyeXB0RW50cnkuanMiLCIvaG9tZS9kZXNtb25kL1Byb2plY3RzL0pvdXJuZXlKb3VybmFsL2FwcC91dGlsaXRpZXMvZW5jcnlwdEVudHJ5LmpzIiwiL2hvbWUvZGVzbW9uZC9Qcm9qZWN0cy9Kb3VybmV5Sm91cm5hbC9hcHAvdXRpbGl0aWVzL2Vuc3VyZUdhcGlMb2FkZWQuanMiLCIvaG9tZS9kZXNtb25kL1Byb2plY3RzL0pvdXJuZXlKb3VybmFsL2FwcC91dGlsaXRpZXMvZ2FwaUhhbmRsZXIuanMiLCIvaG9tZS9kZXNtb25kL1Byb2plY3RzL0pvdXJuZXlKb3VybmFsL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9pbmRleC5qcyIsIi9ob21lL2Rlc21vbmQvUHJvamVjdHMvSm91cm5leUpvdXJuYWwvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9iYXNlNjQtanMvbGliL2I2NC5qcyIsIi9ob21lL2Rlc21vbmQvUHJvamVjdHMvSm91cm5leUpvdXJuYWwvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9pZWVlNzU0L2luZGV4LmpzIiwiL2hvbWUvZGVzbW9uZC9Qcm9qZWN0cy9Kb3VybmV5Sm91cm5hbC9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9jcnlwdG8tYnJvd3NlcmlmeS9oZWxwZXJzLmpzIiwiL2hvbWUvZGVzbW9uZC9Qcm9qZWN0cy9Kb3VybmV5Sm91cm5hbC9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9jcnlwdG8tYnJvd3NlcmlmeS9pbmRleC5qcyIsIi9ob21lL2Rlc21vbmQvUHJvamVjdHMvSm91cm5leUpvdXJuYWwvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvY3J5cHRvLWJyb3dzZXJpZnkvbWQ1LmpzIiwiL2hvbWUvZGVzbW9uZC9Qcm9qZWN0cy9Kb3VybmV5Sm91cm5hbC9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9jcnlwdG8tYnJvd3NlcmlmeS9ybmcuanMiLCIvaG9tZS9kZXNtb25kL1Byb2plY3RzL0pvdXJuZXlKb3VybmFsL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2NyeXB0by1icm93c2VyaWZ5L3NoYS5qcyIsIi9ob21lL2Rlc21vbmQvUHJvamVjdHMvSm91cm5leUpvdXJuYWwvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvY3J5cHRvLWJyb3dzZXJpZnkvc2hhMjU2LmpzIiwiL2hvbWUvZGVzbW9uZC9Qcm9qZWN0cy9Kb3VybmV5Sm91cm5hbC9ub2RlX21vZHVsZXMvc2pjbC9zamNsLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUEsSUFBSSxLQUFLLEdBQUcsT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDO0FBQ3BDLElBQUksTUFBTSxHQUFHLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQztBQUNyQyxJQUFJLGlCQUFpQixHQUFHLE9BQU8sQ0FBQywwQkFBMEIsQ0FBQztBQUMzRCxJQUFJLE1BQU0sR0FBRyxPQUFPLENBQUMsUUFBUSxDQUFDOztBQUU5QixvQ0FBb0MsdUJBQUE7Q0FDbkMsTUFBTSxFQUFFLEVBQUUsTUFBTSxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUMsVUFBVSxFQUFFO0NBQzNDLGVBQWUsRUFBRSxX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QUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNybENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbktBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIFJlYWN0ID0gcmVxdWlyZSgncmVhY3QvYWRkb25zJyk7XG52YXIgUm91dGVyID0gcmVxdWlyZSgncmVhY3Qtcm91dGVyJyk7XG52YXIgaGFuZGxlR2FwaVJlcXVlc3QgPSByZXF1aXJlKCcuLi91dGlsaXRpZXMvZ2FwaUhhbmRsZXInKVxudmFyIG1vbWVudCA9IHJlcXVpcmUoJ21vbWVudCcpXG5cbm1vZHVsZS5leHBvcnRzID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xuXHRtaXhpbnM6IFsgUm91dGVyLlN0YXRlLCBSb3V0ZXIuTmF2aWdhdGlvbiBdLFxuXHRnZXRJbml0aWFsU3RhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiB7XG5cdFx0fVxuXHR9LFxuXHRjb21wb25lbnRXaWxsTW91bnQ6IGZ1bmN0aW9uKCkge1xuXHR9LFxuXHRiYWNrdXA6IGZ1bmN0aW9uKCkge1xuXHRcdGlmICh0aGlzLnN0YXRlLmJhY2tpbmdVcCkge1xuXHRcdFx0cmV0dXJuXG5cdFx0fVxuXG5cdFx0dGhpcy5zZXRTdGF0ZSh7YmFja2luZ1VwOiB0cnVlfSlcblx0XHR0aGlzLmxvYWREb2N1bWVudHMoZnVuY3Rpb24oZXJyLCByZXN1bHRzKSB7XG5cdFx0XHRpZiAoZXJyKSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKGVycilcblx0XHRcdFx0cmV0dXJuXG5cdFx0XHR9XG5cdFx0XHR2YXIganNvbiA9IEpTT04uc3RyaW5naWZ5KHJlc3VsdHMpO1xuXHRcdFx0dmFyIHBhdXNlID0gMlxuXG5cdFx0XHR1cGxvYWRCYWNrdXBUb0RyaXZlKGpzb24sIGZ1bmN0aW9uKGUpIHtcblx0XHRcdFx0aWYgKGUpIHtcblx0XHRcdFx0XHRjb25zb2xlLmxvZyhlKVxuXHRcdFx0XHRcdHRoaXMuc2V0U3RhdGUoe2JhY2tpbmdVcDogZmFsc2V9KVxuXHRcdFx0XHRcdHJldHVyblxuXHRcdFx0XHR9XG5cdFx0XHRcdGFsZXJ0aWZ5Lm1lc3NhZ2UoJ0JhY2tlZCB1cCBKb3VybmFsJywgcGF1c2UpO1xuXHRcdFx0XHRzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdHRoaXMuc2V0U3RhdGUoe2JhY2tpbmdVcDogZmFsc2V9KVxuXHRcdFx0XHR9LmJpbmQodGhpcyksIHBhdXNlKVxuXHRcdFx0fS5iaW5kKHRoaXMpKTtcblx0XHR9LmJpbmQodGhpcykpXG5cdH0sXG5cdHJlc3RvcmU6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMudHJhbnNpdGlvblRvKCdyZXN0b3JlJylcblx0fSxcblx0bG9hZERvY3VtZW50czogZnVuY3Rpb24oY2FsbGJhY2spIHtcblx0XHR0aGlzLnByb3BzLmRiLmFsbERvY3Moe1xuXHRcdFx0aW5jbHVkZV9kb2NzOiB0cnVlLFxuXHRcdH0pLnRoZW4oZnVuY3Rpb24ocmVzdWx0cykge1xuXHRcdFx0dmFyIHJlc3VsdHMgPSByZXN1bHRzLnJvd3MubWFwKGZ1bmN0aW9uKGRvYyl7XG5cdFx0XHRcdHZhciBlbnRyeSA9IGRvYy5kb2M7XG5cdFx0XHRcdHJldHVybiBlbnRyeVxuXHRcdFx0fS5iaW5kKHRoaXMpKTtcblx0XHRcdGNhbGxiYWNrKG51bGwsIHJlc3VsdHMpXG5cdFx0fS5iaW5kKHRoaXMpKVxuXHRcdC5jYXRjaChmdW5jdGlvbihlKSB7XG5cdFx0XHRjYWxsYmFjayhlKVxuXHRcdH0pO1xuXHR9LFxuXHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBiYWNrdXBUZXh0ID0gdGhpcy5zdGF0ZS5iYWNraW5nVXAgPyAnQmFja2luZyB1cCcgOiAnQmFja3VwIHRvIGRyaXZlJ1xuXHRcdHZhciByZXN0b3JlVGV4dCA9IHRoaXMuc3RhdGUucmVzdG9yaW5nID8gJ1Jlc3RvcmluZycgOiAnVmlldyBiYWNrdXBzJ1xuXHRcdHJldHVybiAoPGRpdj5cblx0XHRcdDxidXR0b24gb25DbGljaz17dGhpcy5iYWNrdXB9PntiYWNrdXBUZXh0fTwvYnV0dG9uPjxiciAvPlxuXHRcdFx0PGJ1dHRvbiBvbkNsaWNrPXt0aGlzLnJlc3RvcmV9PntyZXN0b3JlVGV4dH08L2J1dHRvbj48YnIgLz5cblx0XHQ8L2Rpdj4pXG5cdH1cbn0pO1xuXG5mdW5jdGlvbiB1cGxvYWRCYWNrdXBUb0RyaXZlKGpzb24sIGNhbGxiYWNrKSB7XG5cdHZhciBib3VuZGFyeSA9ICctLS0tLS0tMzE0MTU5MjY1MzU4OTc5MzIzODQ2J1xuXHR2YXIgZGVsaW1pdGVyID0gXCJcXHJcXG4tLVwiICsgYm91bmRhcnkgKyBcIlxcclxcblwiXG5cdHZhciBjbG9zZV9kZWxpbSA9IFwiXFxyXFxuLS1cIiArIGJvdW5kYXJ5ICsgXCItLVwiXG5cdHZhciBjb250ZW50VHlwZT1cImFwcGxpY2F0aW9uL2pzb25cIlxuXG5cblx0dmFyIGRhdGVTdHJpbmcgPSAnYmFja3VwLScgK21vbWVudCgpLmZvcm1hdChcIllZWVlNTUREaGhtbXNzXCIpIFxuXHR2YXIgZmlsZU5hbWUgPSBwcm9tcHQoJ0Nob29zZSBhIG5hbWUgZm9yIHRoaXMgYmFja3VwJywgZGF0ZVN0cmluZyk7XG5cblx0aWYgKGZpbGVOYW1lID09IG51bGwpIHtcblx0XHRjYWxsYmFjaygnY2FuY2VsZWQnKVxuXHRcdHJldHVyblxuXHR9XG5cdGZpbGVOYW1lID0gZmlsZU5hbWUgKyAnLmpzb24nXG5cblx0dmFyIG1ldGFkYXRhID0ge1xuXHRcdCd0aXRsZSc6IGZpbGVOYW1lLFxuXHRcdCdtaW1lVHlwZSc6IGNvbnRlbnRUeXBlLFxuXHRcdCdwYXJlbnRzJzogW3snaWQnOiAnYXBwZm9sZGVyJ31dXG5cdH07XG5cblx0dmFyIGJhc2U2NERhdGEgPSBidG9hKEpTT04uc3RyaW5naWZ5KGpzb24pKTtcblxuXHR2YXIgbXVsdGlwYXJ0UmVxdWVzdEJvZHkgPVxuXHRcdGRlbGltaXRlciArXG5cdFx0J0NvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvblxcclxcblxcclxcbicgK1xuXHRcdEpTT04uc3RyaW5naWZ5KG1ldGFkYXRhKSArXG5cdFx0ZGVsaW1pdGVyICtcblx0XHQnQ29udGVudC1UeXBlOiAnICsgY29udGVudFR5cGUgKyAnXFxyXFxuJyArXG5cdFx0J0NvbnRlbnQtVHJhbnNmZXItRW5jb2Rpbmc6IGJhc2U2NFxcclxcbicgK1xuXHRcdCdcXHJcXG4nICtcblx0XHRiYXNlNjREYXRhICtcblx0XHRjbG9zZV9kZWxpbTtcblxuXHR2YXIgcmVxdWVzdCA9IGdhcGkuY2xpZW50LnJlcXVlc3Qoe1xuXHRcdCdwYXRoJzogJy91cGxvYWQvZHJpdmUvdjIvZmlsZXMnLFxuXHRcdCdtZXRob2QnOiAnUE9TVCcsXG5cdFx0J3BhcmFtcyc6IHsndXBsb2FkVHlwZSc6ICdtdWx0aXBhcnQnfSxcblx0XHQnaGVhZGVycyc6IHtcblx0XHRcdCdDb250ZW50LVR5cGUnOiAnbXVsdGlwYXJ0L21peGVkOyBib3VuZGFyeT1cIicgKyBib3VuZGFyeSArICdcIidcblx0XHR9LFxuXHRcdCdib2R5JzogbXVsdGlwYXJ0UmVxdWVzdEJvZHlcblx0fSk7XG5cdGhhbmRsZUdhcGlSZXF1ZXN0KHJlcXVlc3QsIGNhbGxiYWNrKVxufVxuIiwidmFyIFJlYWN0ID0gcmVxdWlyZSgncmVhY3QvYWRkb25zJyk7XG52YXIgUm91dGVyID0gcmVxdWlyZSgncmVhY3Qtcm91dGVyJyk7XG52YXIgZW5zdXJlTG9hZGVkID0gcmVxdWlyZSgnLi91dGlsaXRpZXMvZW5zdXJlR2FwaUxvYWRlZCcpXG5cbnZhciBSb3V0ZSA9IFJvdXRlci5Sb3V0ZTtcbnZhciBMaW5rID0gUm91dGVyLkxpbms7XG52YXIgRGVmYXVsdFJvdXRlID0gUm91dGVyLkRlZmF1bHRSb3V0ZTtcbnZhciBOb3RGb3VuZFJvdXRlID0gUm91dGVyLk5vdEZvdW5kUm91dGU7XG5cbnZhciBSb290Um91dGVIYW5kbGVyID0gcmVxdWlyZSgnLi9yb3V0ZXMvUm9vdFJvdXRlSGFuZGxlcicpXG52YXIgTm90Rm91bmRSb3V0ZUhhbmRsZXIgPSByZXF1aXJlKCcuL3JvdXRlcy9Ob3RGb3VuZFJvdXRlSGFuZGxlcicpO1xuXG5cbnZhciBTZXR0aW5nc1JvdXRlSGFuZGxlciA9IHJlcXVpcmUoJy4vcm91dGVzL1NldHRpbmdzUm91dGVIYW5kbGVyJyk7XG52YXIgRWRpdG9yUm91dGVIYW5kbGVyID0gcmVxdWlyZSgnLi9yb3V0ZXMvRWRpdG9yUm91dGVIYW5kbGVyJyk7XG52YXIgSW5kZXhSb3V0ZUhhbmRsZXIgPSByZXF1aXJlKCcuL3JvdXRlcy9JbmRleFJvdXRlSGFuZGxlcicpO1xudmFyIHJlc3RvcmVSb3V0ZUhhbmRsZXIgPSByZXF1aXJlKCcuL3JvdXRlcy9SZXN0b3JlUm91dGVIYW5kbGVyJyk7XG4vKiBkZXNsaWdodCByZXF1aXJlIGhvb2sgLSBkbyBub3QgbW9kaWZ5IHRoaXMgbGluZSAqL1xuXG52YXIgcm91dGVzID0gKFxuXHQ8Um91dGUgaGFuZGxlcj17Um9vdFJvdXRlSGFuZGxlcn0gcGF0aD1cIi9cIj5cblx0XHQ8RGVmYXVsdFJvdXRlIGhhbmRsZXI9e0luZGV4Um91dGVIYW5kbGVyfSBuYW1lPSdpbmRleCcvPlxuXHRcdDxSb3V0ZSBoYW5kbGVyPXtFZGl0b3JSb3V0ZUhhbmRsZXJ9IG5hbWU9XCJlZGl0b3JcIiBwYXRoPSdlZGl0b3IvOmlkJy8+XG5cdFx0PE5vdEZvdW5kUm91dGUgaGFuZGxlcj17Tm90Rm91bmRSb3V0ZUhhbmRsZXJ9IC8+XG5cdFx0PFJvdXRlIGhhbmRsZXI9e1NldHRpbmdzUm91dGVIYW5kbGVyfSBuYW1lPSdzZXR0aW5ncycgcGF0aD0nc2V0dGluZ3MnLz5cbjxSb3V0ZSBoYW5kbGVyPXtyZXN0b3JlUm91dGVIYW5kbGVyfSBuYW1lPSdyZXN0b3JlJyBwYXRoPSdyZXN0b3JlJy8+XG4vKiBkZXNsaWdodCByb3V0ZSBob29rIC0gZG8gbm90IG1vZGlmeSB0aGlzIGxpbmUgKi9cblx0PC9Sb3V0ZT5cbik7XG5cblxuZnVuY3Rpb24gaW5pdCgpIHtcblx0ZW5zdXJlTG9hZGVkKGZ1bmN0aW9uKCkge1xuXHRcdFJvdXRlci5ydW4ocm91dGVzLCBmdW5jdGlvbihIYW5kbGVyKSB7XG5cdFx0XHRcdCAgIFJlYWN0LnJlbmRlcig8SGFuZGxlciAvPiwgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Jvb3Rfam91cm5leScpKTtcblx0XHR9KTtcblx0fSlcbn1cblxuaWYgKHR5cGVvZihkZXZpY2UpICE9ICd1bmRlZmluZWQnICYmIGRldmljZS5wbGF0Zm9ybSAhPT0gJ2Jyb3dzZXInKSB7XG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZGV2aWNlUmVhZHknLCBmdW5jdGlvbigpIHtcblx0XHRcdGluaXQoKVxuXHRcdH0sIGZhbHNlKVxufVxuZWxzZSB7XG5cdGluaXQoKVxufVxuIiwidmFyIFJlYWN0ID0gcmVxdWlyZSgncmVhY3QvYWRkb25zJyk7XG52YXIgUm91dGVyID0gcmVxdWlyZSgncmVhY3Qtcm91dGVyJyk7XG52YXIgUm91dGVIYW5kbGVyID0gUm91dGVyLlJvdXRlSGFuZGxlcjtcbnZhciBhbGVydGlmeSA9IHdpbmRvd1snYWxlcnRpZnknXSA9IHJlcXVpcmUoJ2FsZXJ0aWZ5anMnKVxuXG52YXIgZGF0ZXMgPSByZXF1aXJlKCcuLi91dGlsaXRpZXMvZGF0ZXMnKVxudmFyIGRlY3J5cHQgPSByZXF1aXJlKCcuLi91dGlsaXRpZXMvZGVjcnlwdEVudHJ5JylcbnZhciBlbmNyeXB0ID0gcmVxdWlyZSgnLi4vdXRpbGl0aWVzL2VuY3J5cHRFbnRyeScpXG52YXIgbW9tZW50ID0gcmVxdWlyZSgnbW9tZW50JylcbmZ1bmN0aW9uIGdldE5leHRTYXZlKCkge1xuXHRcdHZhciBkID0gbmV3IERhdGUoKVxuXHRcdGQuc2V0U2Vjb25kcyhkLmdldFNlY29uZHMoKSArIDUpO1xuXHRcdHJldHVybiBkO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcblx0bWl4aW5zOiBbIFJvdXRlci5TdGF0ZSwgUm91dGVyLk5hdmlnYXRpb25dLFxuXHRnZXRJbml0aWFsU3RhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiB7XG5cdFx0XHRkb2M6IHVuZGVmaW5lZCxcblx0XHRcdHRpbWVvdXQ6IHVuZGVmaW5lZCxcblx0XHRcdG5leHRfc2F2ZTogZ2V0TmV4dFNhdmUoKSxcblx0XHRcdGNvbnRlbnQ6ICcnLFxuXHRcdFx0dGFnczogW10sXG5cdFx0XHRtb2RpZmllZDogZmFsc2Vcblx0XHR9XG5cdH0sXG5cdGNvbXBvbmVudERpZE1vdW50OiBmdW5jdGlvbigpIHtcblx0XHR2YXIgaWQgPSB0aGlzLnByb3BzLnBhcmFtcy5pZFxuXHRcdHRoaXMucHJvcHMuZGIuZ2V0KGlkKS50aGVuKGZ1bmN0aW9uKGRvYykge1xuXHRcdFx0dmFyIGVudHJ5ID0gZGVjcnlwdCh0aGlzLnByb3BzLmF1dGhrZXksIGRvYylcblx0XHRcdHRoaXMuc2V0U3RhdGUoe1xuXHRcdFx0XHRkb2M6IHtcblx0XHRcdFx0XHRpZDogZW50cnkuX2lkLFxuXHRcdFx0XHRcdHJldjogZW50cnkuX3JldlxuXHRcdFx0XHR9LFxuXHRcdFx0XHRjb250ZW50OiBlbnRyeS5jb250ZW50LFxuXHRcdFx0XHR0YWdzOiBlbnRyeS50YWdzID8gZW50cnkudGFncyA6IFtdLFxuXHRcdFx0XHRkYXRldGltZTogZW50cnkuZGF0ZXRpbWVcblx0XHRcdH0pO1xuXG5cdFx0fS5iaW5kKHRoaXMpKS5jYXRjaChmdW5jdGlvbihlcnIpIHtcblx0XHRcdGlmIChlcnIuc3RhdHVzID09PSA0MDQpIHtcblx0XHRcdFx0dGhpcy5zZXRTdGF0ZSh7XG5cdFx0XHRcdFx0ZGF0ZXRpbWU6IG1vbWVudCgpLmZvcm1hdChcIllZWVlNTUREaGhtbXNzXCIpXG5cdFx0XHRcdH0pXG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0Y29uc29sZS5sb2coZXJyKTtcblx0XHRcdH1cblx0XHR9LmJpbmQodGhpcykpXG5cblx0XHR3aW5kb3cub25iZWZvcmV1bmxvYWQgPSBmdW5jdGlvbiAoZSkge1xuXHRcdFx0aWYgKHRoaXMuc3RhdGUubW9kaWZpZWQpIHtcblx0XHRcdFx0dmFyIG1lc3NhZ2UgPSBcIkpvdXJuZXkgaGFzIHVuc2F2ZWQgY2hhbmdlcy4gRG8geW91IHdhbnQgdG8gbGVhdmUgdGhlIHBhZ2UgYW5kIGRpc2NhcmQgeW91ciBjaGFuZ2VzP1wiLFxuXHRcdFx0XHRcdGUgPSBlIHx8IHdpbmRvdy5ldmVudDtcblx0XHRcdFx0Ly8gRm9yIElFIGFuZCBGaXJlZm94XG5cdFx0XHRcdGlmIChlKSB7XG5cdFx0XHRcdFx0ZS5yZXR1cm5WYWx1ZSA9IG1lc3NhZ2U7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBGb3IgU2FmYXJpXG5cdFx0XHRcdHJldHVybiBtZXNzYWdlO1xuXHRcdFx0fVxuXHRcdH0uYmluZCh0aGlzKTtcblx0fSxcblx0Y29tcG9uZW50V2lsbFVubW91bnQ6IGZ1bmN0aW9uKCkge1xuXHRcdHdpbmRvdy5vbmJlZm9yZXVubG9hZCA9IG51bGw7XG5cdFx0d2luZG93LmNsZWFyVGltZW91dCh0aGlzLnN0YXRlLnRpbWVvdXQpO1xuXHR9LFxuXHRzY2hlZHVsZVNhdmU6IGZ1bmN0aW9uKCkge1xuXHRcdHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy5zdGF0ZS50aW1lb3V0KTtcblx0XHR2YXIgdGltZW91dCA9IHdpbmRvdy5zZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5zYXZlRW50cnkoKTtcblx0XHR9LmJpbmQodGhpcyksIDUwMClcblx0XHR0aGlzLnNldFN0YXRlKHt0aW1lb3V0OiB0aW1lb3V0fSlcblx0fSxcblx0Y2hhbmdlZDogZnVuY3Rpb24oZSkge1xuXHRcdHZhciBjb250ZW50ID0gZS50YXJnZXQudmFsdWU7XG5cdFx0dGhpcy5zY2hlZHVsZVNhdmUoKVxuXHRcdHRoaXMuc2V0U3RhdGUoe2NvbnRlbnQ6IGNvbnRlbnQsIG1vZGlmaWVkOiB0cnVlfSlcblx0fSxcblx0c2F2ZUVudHJ5OiBmdW5jdGlvbigpIHtcblx0XHR2YXIgY29udGVudCA9IHRoaXMuc3RhdGUuY29udGVudFxuXHRcdHZhciBpZCA9IHRoaXMucHJvcHMucGFyYW1zLmlkXG5cdFx0dmFyIGRiID0gdGhpcy5wcm9wcy5kYlxuXG5cdFx0dmFyIGFmdGVyU2F2ZSA9IGZ1bmN0aW9uKHJlc3BvbnNlKSB7XG5cdFx0XHR0aGlzLnNldFN0YXRlKHtcblx0XHRcdFx0bmV4dF9zYXZlOiBnZXROZXh0U2F2ZSgpLFxuXHRcdFx0XHRkb2M6IHJlc3BvbnNlLFxuXHRcdFx0XHRtb2RpZmllZDogZmFsc2Vcblx0XHRcdH0pXG5cdFx0XHQvL2FsZXJ0aWZ5Lm5vdGlmeSgnc2F2aW5nLi4uJywgJ3NhdmUnLCAxKVxuXHRcdH0uYmluZCh0aGlzKTtcblxuXHRcdHZhciBwdXREb2MgPSBlbmNyeXB0KHRoaXMucHJvcHMuYXV0aGtleSwge1xuXHRcdFx0X2lkOiBpZCxcblx0XHRcdGNvbnRlbnQ6IGNvbnRlbnQsXG5cdFx0XHR0YWdzOiB0aGlzLnN0YXRlLnRhZ3MsXG5cdFx0XHRkYXRldGltZTogdGhpcy5zdGF0ZS5kYXRldGltZVxuXHRcdH0pXG5cblx0XHRpZiAodGhpcy5zdGF0ZS5kb2MpIHtcblx0XHRcdHB1dERvYy5fcmV2ID0gdGhpcy5zdGF0ZS5kb2MucmV2XG5cdFx0fVxuXHRcdGRiLnB1dChcblx0XHRcdHB1dERvY1xuXHRcdCkudGhlbihhZnRlclNhdmUpLmNhdGNoKGZ1bmN0aW9uKGUpIHtcblx0XHRcdGNvbnNvbGUubG9nKGUpO1x0XHRcdFx0XG5cdFx0fSk7XG5cdH0sXG5cdHRyYW5zaXRpb25Ub0luZGV4OiBmdW5jdGlvbigpIHtcblx0XHRpZiAodGhpcy5zdGF0ZS5tb2RpZmllZCkge1xuXHRcdFx0d2luZG93LmNsZWFyVGltZW91dCh0aGlzLnN0YXRlLnRpbWVvdXQpO1xuXHRcdFx0dmFyIG1lc3NhZ2UgPSBcIkpvdXJuZXkgaGFzIHVuc2F2ZWQgY2hhbmdlcy4gRG8geW91IHdhbnQgdG8gbGVhdmUgdGhlIHBhZ2UgYW5kIGRpc2NhcmQgeW91ciBjaGFuZ2VzP1wiXG5cdFx0XHRhbGVydGlmeS5jb25maXJtKG1lc3NhZ2UpLnNldCgndGl0bGUnLCAnVW5zYXZlZCBDaGFuZ2VzJykuc2V0KCdsYWJlbHMnLCB7b2s6J1llcycsIGNhbmNlbDonTm8nfSkuc2V0KCdvbm9rJywgZnVuY3Rpb24oKXtcblx0XHRcdFx0dGhpcy50cmFuc2l0aW9uVG8oJ2luZGV4Jyk7XG5cdFx0XHR9LmJpbmQodGhpcykpLnNldCgnb25jYW5jZWwnLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0dGhpcy5zY2hlZHVsZVNhdmUoKTtcblx0XHRcdH0uYmluZCh0aGlzKSk7IFxuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdHRoaXMudHJhbnNpdGlvblRvKCdpbmRleCcpO1xuXHRcdH1cblx0fSxcblx0ZGVsZXRlRW50cnk6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBkYiA9IHRoaXMucHJvcHMuZGJcblx0XHRpZiAodGhpcy5zdGF0ZS5kb2MpIHtcblx0XHRcdGFsZXJ0aWZ5LmNvbmZpcm0oJ0RlbGV0ZSB0aGlzIGVudHJ5PycpXG5cdFx0XHQuc2V0KCd0aXRsZScsICdDb25maXJtIEFjdGlvbicpXG5cdFx0XHQuc2V0KCdsYWJlbHMnLCB7b2s6J1llcycsIGNhbmNlbDonTm8nfSlcblx0XHRcdC5zZXQoJ29ub2snLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0ZGIucmVtb3ZlKHRoaXMuc3RhdGUuZG9jLmlkLCB0aGlzLnN0YXRlLmRvYy5yZXYpXG5cdFx0XHRcdC50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdHRoaXMudHJhbnNpdGlvblRvSW5kZXgoKVx0XG5cdFx0XHRcdH0uYmluZCh0aGlzKSlcblx0XHRcdFx0LmNhdGNoKGZ1bmN0aW9uKGVycil7Y29uc29sZS5sb2coZXJyKX0pXG5cdFx0XHR9LmJpbmQodGhpcykpOyBcblx0XHR9XG5cdH0sXG5cdGFkZFRhZ0Zyb21FbGVtZW50OiBmdW5jdGlvbihlbGVtZW50KSB7XG5cdFx0dmFyIHZhbHVlID0gZWxlbWVudC52YWx1ZVxuXHRcdGVsZW1lbnQudmFsdWUgPSAnJ1xuXHRcdGlmICh2YWx1ZS5sZW5ndGggPiAwICYmIHRoaXMuc3RhdGUudGFncy5pbmRleE9mKHZhbHVlKSA9PT0gLTEpIHtcblx0XHRcdGNvbnNvbGUubG9nKCduZXcgdGFnOicsIHZhbHVlKVxuXHRcdFx0dGhpcy5zZXRTdGF0ZSh7XG5cdFx0XHRcdHRhZ3M6IHRoaXMuc3RhdGUudGFncy5jb25jYXQodmFsdWUpLFxuXHRcdFx0XHRtb2RpZmllZDogdHJ1ZVxuXHRcdFx0fSk7XG5cdFx0XHR0aGlzLnNjaGVkdWxlU2F2ZSgpO1xuXHRcdH1cblx0fSxcblx0dGFnc0lucHV0Q2hhbmdlZDogZnVuY3Rpb24oZSkge1xuXHRcdHN3aXRjaCAoZS50YXJnZXQudmFsdWUuc3Vic3RyKC0xKSkge1xuXHRcdFx0Y2FzZSAnLCc6XG5cdFx0XHRjYXNlICcgJzpcblx0XHRcdFx0ZS50YXJnZXQudmFsdWUgPSBlLnRhcmdldC52YWx1ZS5zdWJzdHJpbmcoMCwgZS50YXJnZXQudmFsdWUubGVuZ3RoLTEpO1xuXHRcdFx0XHR0aGlzLmFkZFRhZ0Zyb21FbGVtZW50KGUudGFyZ2V0KTtcblx0XHRcdFx0YnJlYWtcdFxuXHRcdH1cblx0fSxcblx0cmVtb3ZlVGFnOiBmdW5jdGlvbih0YWcpIHtcblx0XHR2YXIgaWR4ID0gdGhpcy5zdGF0ZS50YWdzLmluZGV4T2YodGFnKVxuXHRcdGlmIChpZHggIT09IC0xKSB7XG5cdFx0XHR2YXIgdGFncyA9IHRoaXMuc3RhdGUudGFnc1xuXHRcdFx0dGFncy5zcGxpY2UoaWR4LCAxKVxuXHRcdFx0dGhpcy5zZXRTdGF0ZSh7dGFnczogdGFncywgbW9kaWZpZWQ6IHRydWV9KTtcblx0XHRcdHRoaXMuc2NoZWR1bGVTYXZlKClcblx0XHR9XG5cdH0sXG5cdHRhZ0tleURvd246IGZ1bmN0aW9uKGUpIHtcblx0XHRpZiAoZS5rZXlDb2RlID09PSAxMykge1xuXHRcdFx0dGhpcy5hZGRUYWdGcm9tRWxlbWVudCh0aGlzLnJlZnMudGFncy5nZXRET01Ob2RlKCkpO1xuXHRcdH1cblx0fSxcblx0Zm9jdXM6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMuc2V0U3RhdGUoe2ZvY3VzZWQ6IHRydWV9KVxuXHR9LFxuXHRibHVyOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLnNldFN0YXRlKHtmb2N1c2VkOiBmYWxzZX0pXG5cdH0sXG5cdGZvY3VzVGFnc0lucHV0OiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLnJlZnMudGFncy5nZXRET01Ob2RlKCkuZm9jdXMoKTtcblx0fSxcblx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHR2YXIgcm91dGUgPSB0aGlzLmdldFJvdXRlcygpO1xuXG5cdFx0dmFyIGRlbGV0ZUVsZW1lbnQ7XG5cdFx0XG5cdFx0aWYgKHRoaXMuc3RhdGUuZG9jKSB7XG5cdFx0XHRkZWxldGVFbGVtZW50ID0gKFxuXHRcdFx0XHQ8ZGl2IGNsYXNzTmFtZT1cImVudHJ5X2RlbGV0ZVwiIG9uQ2xpY2s9e3RoaXMuZGVsZXRlRW50cnl9PlxuXHRcdFx0XHQ8aSBjbGFzc05hbWU9XCJmYSBmYS10cmFzaFwiPjwvaT5cblx0XHRcdFx0PC9kaXY+XG5cdFx0XHQpO1xuXHRcdH1cblx0XHRcblx0XHRyZXR1cm4gKFxuXHRcdFx0PGRpdiBjbGFzc05hbWU9XCJqb3VybmV5X2NvbnRhaW5lclwiPlxuXHRcdFx0XHQ8ZGl2IGNsYXNzTmFtZT1cImpvdXJuZXlfdG9vbGJhciBlbnRyeV90b3BcIj5cblx0XHRcdFx0XHQ8ZGl2IGNsYXNzTmFtZT1cImVudHJ5X2JhY2tcIiBvbkNsaWNrPXt0aGlzLnRyYW5zaXRpb25Ub0luZGV4fT5cblx0XHRcdFx0XHRcdCYjODU5MjsgYmFja1xuXHRcdFx0XHRcdDwvZGl2PlxuXHRcdFx0XHRcdHtkZWxldGVFbGVtZW50fVxuXHRcdFx0XHQ8L2Rpdj5cblxuXHRcdFx0XHQ8dGV4dGFyZWEgb25Gb2N1cz17dGhpcy5mb2N1c30gb25CbHVyPXt0aGlzLmJsdXJ9IG9uQ2hhbmdlPXt0aGlzLmNoYW5nZWR9IHJlZj1cImVkaXRvclwiIGNsYXNzTmFtZT1cImNvbnRlbnQgam91cm5leV9lZGl0b3JcIiB2YWx1ZT17dGhpcy5zdGF0ZS5jb250ZW50fT5cblx0XHRcdFx0PC90ZXh0YXJlYT5cblx0XHRcdFx0PGRpdiBjbGFzc05hbWU9e1wiam91cm5leV90b29sYmFyIGVudHJ5X3RhZ3NcIiArICh0aGlzLnN0YXRlLmZvY3VzZWQgPyAnIGhpZGUnIDogJycpfT5cblx0XHRcdFx0XHQ8ZGl2IGNsYXNzTmFtZT1cImVudHJ5X3RhZ3NfY29udGFpbmVyXCI+XG5cdFx0XHRcdFx0PGkgY2xhc3NOYW1lPVwiZmEgZmEtdGFnc1wiIG9uQ2xpY2s9e3RoaXMuZm9jdXNUYWdzSW5wdXR9PjwvaT5cblx0XHRcdFx0XHRcdHt0aGlzLnN0YXRlLnRhZ3MubWFwKGZ1bmN0aW9uKHRhZykge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gPHNwYW4gY2xhc3NOYW1lPVwiZW50cnlfdGFnXCIgb25DbGljaz17dGhpcy5yZW1vdmVUYWcuYmluZCh0aGlzLCB0YWcpfSBrZXk9e3RhZ30+e3RhZ308L3NwYW4+XG5cdFx0XHRcdFx0XHR9LmJpbmQodGhpcykpfVxuXHRcdFx0XHRcdDwvZGl2PlxuXHRcdFx0XHQ8L2Rpdj5cblx0XHRcdFx0PGRpdiBjbGFzc05hbWU9e1wiam91cm5leV90b29sYmFyIGVudHJ5X3RhZ3NfaW5wdXRcIn0gPlxuXHRcdFx0XHRcdDxpbnB1dCBjbGFzc05hbWU9XCJcIiBvbklucHV0PXt0aGlzLnRhZ3NJbnB1dENoYW5nZWR9IG9uS2V5RG93bj17dGhpcy50YWdLZXlEb3dufSByZWY9XCJ0YWdzXCIvPlxuXHRcdFx0XHQ8L2Rpdj5cblx0XHRcdDwvZGl2PlxuXHRcdCk7XG5cdH1cbn0pO1xuIiwidmFyIFJlYWN0ID0gcmVxdWlyZSgncmVhY3QvYWRkb25zJyk7XG52YXIgUm91dGVyID0gcmVxdWlyZSgncmVhY3Qtcm91dGVyJyk7XG52YXIgUm91dGVIYW5kbGVyID0gUm91dGVyLlJvdXRlSGFuZGxlcjtcbnZhciBkZWNyeXB0ID0gcmVxdWlyZSgnLi4vdXRpbGl0aWVzL2RlY3J5cHRFbnRyeScpXG52YXIgbW9tZW50ID0gcmVxdWlyZSgnbW9tZW50JylcblxubW9kdWxlLmV4cG9ydHMgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG5cdG1peGluczogWyBSb3V0ZXIuU3RhdGUsIFJvdXRlci5OYXZpZ2F0aW9uIF0sXG5cdGdldEluaXRpYWxTdGF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGVudHJpZXM6IFtdXG5cdFx0fVxuXHR9LFxuXHRjb21wb25lbnREaWRNb3VudDogZnVuY3Rpb24oKSB7XG5cdFx0dmFyIGRiID0gdGhpcy5wcm9wcy5kYjtcblx0XHRkYi5nZXQoJ2pvdXJuZXlfbWV0YWRhdGEnKVxuXHRcdC50aGVuKGZ1bmN0aW9uKGRvYykge1xuXHRcdFx0dmFyIG5leHRJZCA9IGRvYy5uZXh0SWRcblxuXHRcdFx0ZGIuYWxsRG9jcyh7XG5cdFx0XHRcdGluY2x1ZGVfZG9jczogdHJ1ZSxcblx0XHRcdFx0c3RhcnRrZXk6ICdlbnRyeTAnLFxuXHRcdFx0XHRlbmRrZXk6ICdlbnRyeXonXG5cdFx0XHR9KS50aGVuKGZ1bmN0aW9uKHJlc3VsdHMpIHtcblx0XHRcdFx0dmFyIHJlc3VsdHMgPSByZXN1bHRzLnJvd3MubWFwKGZ1bmN0aW9uKGRvYyl7XG5cdFx0XHRcdFx0dmFyIGVudHJ5ID0gZGVjcnlwdCh0aGlzLnByb3BzLmF1dGhrZXksIGRvYy5kb2MpO1xuXHRcdFx0XHRcdHJldHVybiBlbnRyeVxuXHRcdFx0XHR9LmJpbmQodGhpcykpLnNvcnQoZnVuY3Rpb24oYSwgYikge1xuXHRcdFx0XHRcdHZhciBhID0gYS5kYXRldGltZSA/IG1vbWVudChhLmRhdGV0aW1lLCAnWVlZWU1NRERoaG1tc3MnKSA6IG1vbWVudCgpLnllYXIoMTk2OSlcblx0XHRcdFx0XHR2YXIgYiA9IGIuZGF0ZXRpbWUgPyBtb21lbnQoYi5kYXRldGltZSwgJ1lZWVlNTUREaGhtbXNzJykgOiBtb21lbnQoKS55ZWFyKDE5NjkpXG5cdFx0XHRcdFx0dmFyIGRpZmYgPSBiLmRpZmYoYSlcblx0XHRcdFx0XHRyZXR1cm4gZGlmZjtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHRoaXMuc2V0U3RhdGUoeyByZXN1bHRzOnJlc3VsdHMsIGVudHJpZXM6cmVzdWx0cyB9KVxuXHRcdFx0fS5iaW5kKHRoaXMpKVxuXHRcdFx0LmNhdGNoKGZ1bmN0aW9uKGUpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coZSk7XG5cdFx0XHR9KTtcblx0XHR9LmJpbmQodGhpcykpO1xuXG5cdH0sXG5cdGNyZWF0ZUVudHJ5OiBmdW5jdGlvbigpIHtcblx0XHR2YXIgZGIgPSB0aGlzLnByb3BzLmRiO1xuXHRcdGRiLmdldCgnam91cm5leV9tZXRhZGF0YScpXG5cdFx0LnRoZW4oZnVuY3Rpb24oZG9jKSB7XG5cdFx0XHR2YXIgbmV4dElkID0gZG9jLm5leHRJZFxuXHRcdFx0ZG9jLm5leHRJZCsrO1xuXHRcdFx0ZGIucHV0KGRvYykudGhlbihmdW5jdGlvbihkb2MpIHtcblx0XHRcdH0pXG5cdFx0XHQuY2F0Y2goZnVuY3Rpb24oZSkge1xuXHRcdFx0XHRjb25zb2xlLmxvZyhlKTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0aGlzLnRyYW5zaXRpb25UbygnZWRpdG9yJywge2lkOiAnZW50cnknK2RvYy5uZXh0SWR9KTtcblx0XHR9LmJpbmQodGhpcykpO1xuXHR9LFxuXHRlZGl0RW50cnk6IGZ1bmN0aW9uKGVudHJ5LCBlKSB7XG5cdFx0dGhpcy50cmFuc2l0aW9uVG8oJ2VkaXRvcicsIHtpZDogZW50cnkuX2lkfSlcblx0fSxcblx0ZmlsdGVyOiBmdW5jdGlvbihlKSB7XG5cdFx0dmFyIHZhbHVlID0gZS50YXJnZXQudmFsdWU7XG5cdFx0aWYgKHZhbHVlLmxlbmd0aCA+IDApIHtcblx0XHRcdHRoaXMuc2V0U3RhdGUoe2VudHJpZXM6IHRoaXMuc3RhdGUucmVzdWx0cy5maWx0ZXIoZnVuY3Rpb24oZW50cnkpIHtcblx0XHRcdFx0cmV0dXJuIGVudHJ5LmNvbnRlbnQuaW5kZXhPZih2YWx1ZSkgIT09IC0xIHx8IGVudHJ5LnRhZ3Muam9pbigpLmluZGV4T2YodmFsdWUpICE9PSAtMVxuXHRcdFx0fSl9KVxuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdHRoaXMuc2V0U3RhdGUoe2VudHJpZXM6IHRoaXMuc3RhdGUucmVzdWx0c30pXG5cdFx0fVxuXHR9LFxuXHRmb2N1c1NlYXJjaDogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5yZWZzLmZpbHRlci5nZXRET01Ob2RlKCkuZm9jdXMoKVxuXHR9LFxuXHRzZXR0aW5nc0NsaWNrZWQ6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMudHJhbnNpdGlvblRvKCdzZXR0aW5ncycpO1xuXHR9LFxuXHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciByb3V0ZSA9IHRoaXMuZ2V0Um91dGVzKCk7XG5cblx0XHRcblx0XHRyZXR1cm4gKFxuXHRcdFx0PGRpdiBjbGFzc05hbWU9XCJqb3VybmV5X2NvbnRhaW5lclwiPlxuXHRcdFx0XHQ8ZGl2IGNsYXNzTmFtZT1cImpvdXJuZXlfdG9vbGJhciBzZWFyY2hcIiBvbkNsaWNrPXt0aGlzLmZvY3VzU2VhcmNofT5cblx0XHRcdFx0XHQ8aSBjbGFzc05hbWU9XCJmYSBmYS1zZWFyY2ggc2VhcmNoX2luZGV4XCI+PC9pPlxuXHRcdFx0XHRcdDxpbnB1dCBwbGFjZWhvbGRlcj1cImZpbHRlclwiIHJlZj1cImZpbHRlclwiIG9uQ2hhbmdlPXt0aGlzLmZpbHRlcn0gY2xhc3NOYW1lPVwiam91cm5leV9pbnB1dFwiIHR5cGU9XCJ0ZXh0XCIgLz5cblx0XHRcdFx0XHQ8aSBjbGFzc05hbWU9XCJmYSBmYS1jb2cgc2V0dGluZ3NfYnV0dG9uXCIgb25DbGljaz17dGhpcy5zZXR0aW5nc0NsaWNrZWR9PjwvaT5cblx0XHRcdFx0PC9kaXY+XG5cdFx0XHRcdDxkaXYgY2xhc3NOYW1lPVwiam91cm5leV9pbmRleF9saXN0IGNvbnRlbnRcIj5cblx0XHRcdFx0XHR7dGhpcy5zdGF0ZS5lbnRyaWVzLm1hcChmdW5jdGlvbihlbnRyeSkge1xuXHRcdFx0XHRcdFx0aWYgKGVudHJ5LnRhZ3MubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdFx0XHR2YXIgdGFncyA9IDxzcGFuPnRhZ3M6IHtlbnRyeS50YWdzLm1hcChmdW5jdGlvbih0YWcsIGlkeCwgbGlzdCkge1xuXHRcdFx0XHRcdFx0XHRcdGlmIChpZHggPT0gbGlzdC5sZW5ndGgtMSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIDxzcGFuIGtleT17dGFnfT57dGFnfTwvc3Bhbj5cblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIChcblx0XHRcdFx0XHRcdFx0XHRcdDxzcGFuIGtleT17dGFnfT57dGFnfSwgPC9zcGFuPlxuXHRcdFx0XHRcdFx0XHRcdClcdFx0XHRcdFx0XG5cdFx0XHRcdFx0XHRcdH0pfVxuXHRcdFx0XHRcdFx0XHQ8L3NwYW4+XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdHJldHVybiAoXG5cdFx0XHRcdFx0XHRcdDxkaXYgY2xhc3NOYW1lPVwiam91cm5leV9pbmRleF9pdGVtXCIgb25DbGljaz17dGhpcy5lZGl0RW50cnkuYmluZCh0aGlzLCBlbnRyeSl9IGtleT17ZW50cnkuX2lkfT5cblx0XHRcdFx0XHRcdFx0XHQ8ZGl2IGNsYXNzTmFtZT1cImpvdXJuZXlfaW5kZXhfaXRlbV90aXRsZVwiPlxuXHRcdFx0XHRcdFx0XHRcdCB7ZW50cnkudGl0bGUuc3Vic3RyaW5nKDAsIDI0KSArICgoZW50cnkudGl0bGUubGVuZ3RoID4gMjQpID8gJy4uLic6JycpIH0gXG5cdFx0XHRcdFx0XHRcdFx0PC9kaXY+XHRcblxuXHRcdFx0XHRcdFx0XHRcdDxkaXYgY2xhc3NOYW1lPVwiam91cm5leV9pbmRleF9pdGVtX21ldGFkYXRhXCI+XG5cdFx0XHRcdFx0XHRcdFx0XHR7dGFnc30mbmJzcDtcblx0XHRcdFx0XHRcdFx0XHQ8L2Rpdj5cdFxuXHRcdFx0XHRcdFx0XHQ8L2Rpdj5cblx0XHRcdFx0XHRcdClcdFx0XHRcdFxuXHRcdFx0XHRcdH0uYmluZCh0aGlzKSl9XG5cdFx0XHRcdDwvZGl2PlxuXG5cdFx0XHRcdDxkaXYgb25DbGljaz17dGhpcy5jcmVhdGVFbnRyeX0gY2xhc3NOYW1lPVwiam91cm5leV90b29sYmFyIGNyZWF0ZVwiPlxuXHRcdFx0XHRcdGNyZWF0ZSBuZXcgZW50cnlcblx0XHRcdFx0PC9kaXY+XG5cdFx0XHQ8L2Rpdj5cblx0XHQpO1xuXHR9XG59KTtcbiIsInZhciBSZWFjdCA9IHJlcXVpcmUoJ3JlYWN0L2FkZG9ucycpO1xudmFyIFJvdXRlciA9IHJlcXVpcmUoJ3JlYWN0LXJvdXRlcicpO1xudmFyIFJvdXRlSGFuZGxlciA9IFJvdXRlci5Sb3V0ZUhhbmRsZXI7XG5cbm1vZHVsZS5leHBvcnRzID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xuXHRtaXhpbnM6IFsgUm91dGVyLlN0YXRlIF0sXG5cdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0dmFyIHJvdXRlID0gdGhpcy5nZXRSb3V0ZXMoKTtcblx0XHRcblx0XHRyZXR1cm4gKFxuXHRcdFx0PGRpdj5cblx0XHRcdFx0PGgyPk5vdCBmb3VuZDwvaDI+XG5cdFx0XHQ8L2Rpdj5cblx0XHQpO1xuXHR9XG59KTtcbiIsInZhciBSZWFjdCA9IHJlcXVpcmUoJ3JlYWN0L2FkZG9ucycpO1xudmFyIFJvdXRlciA9IHJlcXVpcmUoJ3JlYWN0LXJvdXRlcicpO1xudmFyIFJvdXRlSGFuZGxlciA9IFJvdXRlci5Sb3V0ZUhhbmRsZXI7XG52YXIgYWxlcnRpZnkgPSByZXF1aXJlKCdhbGVydGlmeWpzJylcbnZhciBoYW5kbGVHYXBpUmVxdWVzdCA9IHJlcXVpcmUoJy4uL3V0aWxpdGllcy9nYXBpSGFuZGxlcicpXG5cbm1vZHVsZS5leHBvcnRzID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xuXHRtaXhpbnM6IFsgUm91dGVyLlN0YXRlLCBSb3V0ZXIuTmF2aWdhdGlvbiBdLFxuXHRnZXRJbml0aWFsU3RhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiB7XG5cdFx0XHRmaWxlczogW10sXG5cdFx0XHRsb2FkaW5nOiB0cnVlXG5cdFx0fVxuXHR9LFxuXHRjb21wb25lbnRXaWxsTW91bnQ6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBmaWxlTGlzdFJlY2VpdmVkID0gZnVuY3Rpb24oZmlsZXMpIHtcblx0XHRcdGlmIChmaWxlcy5sZW5ndGggPT0gMCkge1xuXHRcdFx0XHR2YXIgbWVzc2FnZSA9IFwiTm8gZmlsZXMgaW4gRHJpdmVcIlxuXHRcdFx0XHRhbGVydGlmeS5hbGVydChtZXNzYWdlKS5zZXQoJ3RpdGxlJywgJ0luZm8nKS5zZXQoJ29ub2snLCBmdW5jdGlvbigpe1xuXHRcdFx0XHRcdHRoaXMudHJhbnNpdGlvblRvKCdzZXR0aW5ncycpO1xuXHRcdFx0XHR9LmJpbmQodGhpcykpXG5cblx0XHRcdH1cblx0XHRcdHRoaXMuc2V0U3RhdGUoe2ZpbGVzOiBmaWxlcy5zb3J0KGZ1bmN0aW9uKGEsYikge1xuXHRcdFx0XHRyZXR1cm4gYSA8IGIgPyAxIDogMFxuXHRcdFx0fSksIGxvYWRpbmc6IGZhbHNlfSlcblx0XHR9LmJpbmQodGhpcylcblxuXHRcdHZhciByZXRyaWV2ZVBhZ2VPZkZpbGVzID0gZnVuY3Rpb24ocmVxdWVzdCwgcmVzdWx0KSB7XG5cdFx0XHRoYW5kbGVHYXBpUmVxdWVzdChyZXF1ZXN0LCBmdW5jdGlvbihlLCByZXNwKSB7XG5cdFx0XHRcdGlmIChlKSB7XG5cdFx0XHRcdFx0Y29uc29sZS5sb2coZSlcblx0XHRcdFx0XHRyZXR1cm5cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXN1bHQgPSByZXN1bHQuY29uY2F0KHJlc3AuaXRlbXMpO1xuXHRcdFx0XHR2YXIgbmV4dFBhZ2VUb2tlbiA9IHJlc3AubmV4dFBhZ2VUb2tlbjtcblx0XHRcdFx0aWYgKG5leHRQYWdlVG9rZW4pIHtcblx0XHRcdFx0XHRyZXF1ZXN0ID0gZ2FwaS5jbGllbnQuZHJpdmUuZmlsZXMubGlzdCh7XG5cdFx0XHRcdFx0XHQncGFnZVRva2VuJzogbmV4dFBhZ2VUb2tlblxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdHJldHJpZXZlUGFnZU9mRmlsZXMocmVxdWVzdCwgcmVzdWx0KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRmaWxlTGlzdFJlY2VpdmVkKHJlc3VsdCk7XG5cdFx0XHRcdH1cblx0XHRcdH0uYmluZCh0aGlzKSlcblx0XHR9XG5cblx0XHR2YXIgaW5pdGlhbFJlcXVlc3QgPSBnYXBpLmNsaWVudC5kcml2ZS5maWxlcy5saXN0KHtcblx0XHRcdCdxJzogJ1xcJ2FwcGZvbGRlclxcJyBpbiBwYXJlbnRzJ1xuXHRcdH0pO1xuXHRcdHJldHJpZXZlUGFnZU9mRmlsZXMoaW5pdGlhbFJlcXVlc3QsIFtdKTtcblx0fSxcblx0cmVzdG9yZUZyb21GaWxlOiBmdW5jdGlvbihmaWxlKSB7XG5cdFx0dmFyIG1lc3NhZ2UgPSBcIkFyZSB5b3Ugc3VyZT9cXG5UaGlzIGNhbm5vdCBiZSB1bmRvbmUhXCJcblx0XHRhbGVydGlmeS5jb25maXJtKG1lc3NhZ2UpLnNldCgndGl0bGUnLCAnUmVzdG9yZSBKb3VybmFsJykuc2V0KCdsYWJlbHMnLCB7b2s6J1llcycsIGNhbmNlbDonTm8nfSkuc2V0KCdvbm9rJywgZnVuY3Rpb24oKXtcblx0XHRcdGdldEZpbGUoZmlsZSwgZnVuY3Rpb24oZGF0YSkge1xuXHRcdFx0XHR2YXIgam91cm5hbCA9IEpTT04ucGFyc2UoZGF0YSkubWFwKGZ1bmN0aW9uKGRvYyl7XG5cdFx0XHRcdFx0ZGVsZXRlIGRvYy5fcmV2XG5cdFx0XHRcdFx0cmV0dXJuIGRvY1xuXHRcdFx0XHR9KVxuXHRcdFx0XHR0aGlzLnByb3BzLmNsZWFyRGF0YWJhc2VBbmREZWF1dGhlbnRpY2F0ZShqb3VybmFsKTtcblx0XHRcdH0uYmluZCh0aGlzKSlcblx0XHR9LmJpbmQodGhpcykpXG5cblx0fSxcblx0ZGVsZXRlRmlsZTogZnVuY3Rpb24oZmlsZSkge1xuXHRcdHZhciBtZXNzYWdlID0gXCJBcmUgeW91IHN1cmU/XFxuVGhpcyBjYW5ub3QgYmUgdW5kb25lIVwiXG5cdFx0YWxlcnRpZnkuY29uZmlybShtZXNzYWdlKS5zZXQoJ3RpdGxlJywgJ0RlbGV0ZSBiYWNrdXAnKS5zZXQoJ2xhYmVscycsIHtvazonWWVzJywgY2FuY2VsOidObyd9KS5zZXQoJ29ub2snLCBmdW5jdGlvbigpe1xuXG5cdFx0XHRmaWxlLmRlbGV0aW5nID0gdHJ1ZTtcblxuXHRcdFx0dmFyIHJlcXVlc3QgPSBnYXBpLmNsaWVudC5kcml2ZS5maWxlcy5kZWxldGUoe2ZpbGVJZDpmaWxlLmlkfSlcblxuXHRcdFx0aGFuZGxlR2FwaVJlcXVlc3QocmVxdWVzdCwgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBmaWxlcyA9IHRoaXMuc3RhdGUuZmlsZXMuZmlsdGVyKGZ1bmN0aW9uKGYpIHtcblx0XHRcdFx0XHRyZXR1cm4gZi5pZCAhPT0gZmlsZS5pZFx0XHRcdFx0XHQgICBcblx0XHRcdFx0fSlcblx0XHRcdFx0dGhpcy5zZXRTdGF0ZSh7ZmlsZXM6IGZpbGVzfSlcblx0XHRcdH0uYmluZCh0aGlzKSlcblx0XHR9LmJpbmQodGhpcykpXG5cdH0sXG5cdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0dmFyIGZpbGVCdXR0b25zID0gdGhpcy5zdGF0ZS5sb2FkaW5nID09PSBmYWxzZSA/IChcblx0XHRcdDxkaXY+XG5cdFx0XHR7dGhpcy5zdGF0ZS5maWxlcy5tYXAoZnVuY3Rpb24oZmlsZSkge1xuXHRcdFx0XHRyZXR1cm4gPGRpdiBjbGFzc05hbWU9XCJidXR0b25Hcm91cFwiIGtleT17ZmlsZS5pZH0gPlxuXHRcdFx0XHRcdDxidXR0b24gY2xhc3NOYW1lPVwicmVzdG9yZV9idG5cIiBvbkNsaWNrPXt0aGlzLnJlc3RvcmVGcm9tRmlsZS5iaW5kKHRoaXMsIGZpbGUpfT57ZmlsZS50aXRsZX08L2J1dHRvbj5cblx0XHRcdFx0XHQ8YnV0dG9uIGNsYXNzTmFtZT17XCJkZWxldGVfYnRuXCIrKGZpbGUuZGVsZXRpbmcgPyAnIGRlbGV0aW5nJyA6ICcnKX0gb25DbGljaz17dGhpcy5kZWxldGVGaWxlLmJpbmQodGhpcywgZmlsZSl9PkRlbGV0ZTwvYnV0dG9uPlxuXHRcdFx0XHQ8L2Rpdj5cdFx0XHRcdFx0XHRcdFx0XHQgIFxuXHRcdFx0fS5iaW5kKHRoaXMpKX0gXG5cdFx0XHQ8L2Rpdj5cblx0ICAgKSA6IDxwPkxvYWRpbmc8L3A+XG5cdFx0XG5cdFx0cmV0dXJuIChcblx0XHRcdDxkaXYgY2xhc3NOYW1lPVwiam91cm5leV9jb250YWluZXJcIj5cblx0XHRcdFx0PGRpdiBjbGFzc05hbWU9XCJqb3VybmV5X3Rvb2xiYXIgZW50cnlfdG9wXCI+XG5cdFx0XHRcdFx0PGRpdiBjbGFzc05hbWU9XCJlbnRyeV9iYWNrXCIgb25DbGljaz17dGhpcy50cmFuc2l0aW9uVG8uYmluZCh0aGlzLCAnc2V0dGluZ3MnKX0+XG5cdFx0XHRcdFx0XHQmIzg1OTI7IGJhY2tcblx0XHRcdFx0XHQ8L2Rpdj5cblx0XHRcdFx0PC9kaXY+XG5cdFx0XHRcdDxkaXYgY2xhc3NOYW1lPVwicmVzdG9yZV9zY3JlZW5cIj5cblx0XHRcdFx0XHR7ZmlsZUJ1dHRvbnN9XG5cdFx0XHRcdDwvZGl2PlxuXHRcdFx0PC9kaXY+XG5cdFx0KTtcblx0fVxufSk7XG5cbmZ1bmN0aW9uIGdldEZpbGUoZmlsZSwgY2FsbGJhY2spIHtcblx0Z2FwaS5jbGllbnQuZHJpdmUuZmlsZXMuZ2V0KHtcblx0XHRmaWxlSWQ6IGZpbGUuaWQsXG5cdFx0YWx0OidtZWRpYSdcblx0fSkuZXhlY3V0ZShmdW5jdGlvbihyZXNwb25zZSkge1xuXHRcdGNhbGxiYWNrKHJlc3BvbnNlKVxuXHR9KVxufVxuIiwidmFyIFJlYWN0ID0gcmVxdWlyZSgncmVhY3QvYWRkb25zJyk7XG52YXIgUm91dGVyID0gcmVxdWlyZSgncmVhY3Qtcm91dGVyJyk7XG52YXIgUm91dGVIYW5kbGVyID0gUm91dGVyLlJvdXRlSGFuZGxlcjtcbnZhciBBdXRoZW50aWNhdGUgPSByZXF1aXJlKCcuL2F1dGhlbnRpY2F0ZScpO1xudmFyIFBvdWNoREIgPSByZXF1aXJlKCdwb3VjaGRiJyk7XG52YXIgc2pjbCA9IHJlcXVpcmUoJ3NqY2wnKVxudmFyIGFsZXJ0aWZ5ID0gcmVxdWlyZSgnYWxlcnRpZnlqcycpXG5cbmZ1bmN0aW9uIGNyZWF0ZURCKGpvdXJuYWwsIGNhbGxiYWNrKSB7XG5cdHZhciBkYiA9IG5ldyBQb3VjaERCKCdqb3VybmV5X2FwcCcsIHthdXRvX2NvbXBhY3Rpb246IHRydWV9KTtcblx0aWYgKGpvdXJuYWwpIHtcblx0XHRkYi5idWxrRG9jcyhqb3VybmFsKS50aGVuKGZ1bmN0aW9uKHJlc3VsdCkge1xuXHRcdFx0Y2FsbGJhY2soZGIpXG5cdFx0fSkuY2F0Y2goZnVuY3Rpb24oKXtcblx0XHRcdGNvbnNvbGUubG9nKGVycik7XHRcblx0XHR9KTtcblx0fVxuXHRlbHNlIHtcblx0XHRjYWxsYmFjayhkYilcblx0fVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcblx0bWl4aW5zOiBbIFJvdXRlci5TdGF0ZSwgUm91dGVyLk5hdmlnYXRpb24gXSxcblx0Y29tcG9uZW50V2lsbE1vdW50OiBmdW5jdGlvbigpIHtcblx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwicGF1c2VcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLnNldFN0YXRlKHtrZXk6IHVuZGVmaW5lZCwgd3JvbmdBdHRlbXB0czogMH0pXG5cdFx0fS5iaW5kKHRoaXMpLCBmYWxzZSk7XG5cblx0XHRjcmVhdGVEQihudWxsLCBmdW5jdGlvbihkYikge1xuXHRcdFx0dGhpcy5zZXRTdGF0ZSh7XG5cdFx0XHRcdGtleTogdW5kZWZpbmVkLFxuXHRcdFx0XHRkYjogZGIsIFxuXHRcdFx0XHR3cm9uZ0F0dGVtcHRzOiAwLFxuXHRcdFx0XHR2ZXJpZnlLZXk6IGZhbHNlXG5cdFx0XHR9KVxuXG5cdFx0XHRkYi5nZXQoJ2pvdXJuZXlfbWV0YWRhdGEnKS50aGVuKGZ1bmN0aW9uKGRvYykge1xuXHRcdFx0XHR0aGlzLnNldFN0YXRlKHtcblx0XHRcdFx0XHRleGlzdHM6IHRydWUsXG5cdFx0XHRcdFx0bG9hZGVkOiB0cnVlXG5cdFx0XHRcdH0pXG5cdFx0XHR9LmJpbmQodGhpcykpLmNhdGNoKGZ1bmN0aW9uKGUpIHtcblx0XHRcdFx0aWYgKGUuc3RhdHVzPT09NDA0KSB7XG5cdFx0XHRcdFx0dGhpcy5zZXRTdGF0ZSh7XG5cdFx0XHRcdFx0XHRleGlzdHM6IGZhbHNlLFxuXHRcdFx0XHRcdFx0bG9hZGVkOiB0cnVlXG5cdFx0XHRcdFx0fSlcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjb25zb2xlLmxvZyhlcnIpO1x0XG5cdFx0XHRcdH1cblx0XHRcdH0uYmluZCh0aGlzKSlcblxuXHRcdH0uYmluZCh0aGlzKSlcblx0fSxcblx0Y29tcG9uZW50V2lsbFVubW91bnQ6IGZ1bmN0aW9uKCkge1xuXG5cdH0sXG5cdGNyZWF0ZU1ldGFkYXRhOiBmdW5jdGlvbihrZXkpIHtcblx0XHR0aGlzLnN0YXRlLmRiLnB1dCh7XG5cdFx0XHRfaWQ6ICdqb3VybmV5X21ldGFkYXRhJyxcblx0XHRcdHZlcmlmeTogc2pjbC5lbmNyeXB0KGtleSwgJ2pvdXJuZXkgam91cm5hbCcpLFxuXHRcdFx0bmV4dElkOiAwXHRcdFxuXHRcdH0pLnRoZW4oZnVuY3Rpb24ocmVzcG9uc2UpIHtcblx0XHR9KS5jYXRjaChmdW5jdGlvbihlKSB7XG5cdFx0XHRjb25zb2xlLmxvZyhlKVxuXHRcdH0pXG5cdH0sXG5cdGNsZWFyRGF0YWJhc2VBbmREZWF1dGhlbnRpY2F0ZTogZnVuY3Rpb24oam91cm5hbCkge1xuXHRcdHRoaXMuc3RhdGUuZGIuZGVzdHJveSgpLnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHRjcmVhdGVEQihqb3VybmFsLCBmdW5jdGlvbihkYikge1xuXHRcdFx0XHR0aGlzLnNldFN0YXRlKHtcblx0XHRcdFx0XHRkYjogZGIsXG5cdFx0XHRcdFx0a2V5OiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0d3JvbmdBdHRlbXB0czogMCxcblx0XHRcdFx0XHRleGlzdHM6IGZhbHNlXG5cdFx0XHRcdH0pXG5cdFx0XHRcdHRoaXMudHJhbnNpdGlvblRvKCdpbmRleCcpO1xuXHRcdFx0fS5iaW5kKHRoaXMpKTtcblx0XHR9LmJpbmQodGhpcykpXG5cdH0sXG5cdHNldEtleTogZnVuY3Rpb24oa2V5KSB7XG5cdFx0dGhpcy5zdGF0ZS5kYi5nZXQoJ2pvdXJuZXlfbWV0YWRhdGEnKS50aGVuKGZ1bmN0aW9uKGRvYykge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0dmFyIHJlc3VsdCA9IHNqY2wuZGVjcnlwdChrZXksIGRvYy52ZXJpZnkpXG5cdFx0XHRcdHRoaXMuc2V0U3RhdGUoe2tleToga2V5fSlcblx0XHRcdH1cblx0XHRcdGNhdGNoKGVycikge1xuXHRcdFx0XHRpZiAoZXJyLm1lc3NhZ2UgPT09IFwiY2NtOiB0YWcgZG9lc24ndCBtYXRjaFwiKSB7XG5cdFx0XHRcdFx0dGhpcy5zZXRTdGF0ZSh7XG5cdFx0XHRcdFx0XHR3cm9uZ0F0dGVtcHRzOiB0aGlzLnN0YXRlLndyb25nQXR0ZW1wdHMrMVxuXHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0YWxlcnRpZnkuZXJyb3IoJ1dyb25nIScsIDEpXG5cdFx0XHRcdH1cblx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0Y29uc29sZS5sb2coZXJyKTtcblx0XHRcdFx0XHRjb25zb2xlLmxvZyhlcnIuc3RhY2spO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHR9LmJpbmQodGhpcykpLmNhdGNoKGZ1bmN0aW9uKGUpIHtcblx0XHRcdGlmIChlLnN0YXR1cz09PTQwNCkge1xuXHRcdFx0XHRpZiAoIXRoaXMuc3RhdGUudmVyaWZ5S2V5KSB7XG5cdFx0XHRcdFx0dGhpcy5zZXRTdGF0ZSh7d3JvbmdBdHRlbXB0czogMCwgdmVyaWZ5S2V5OiBrZXl9KVxuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdGlmIChrZXkgPT09IHRoaXMuc3RhdGUudmVyaWZ5S2V5KSB7XG5cdFx0XHRcdFx0XHR0aGlzLmNyZWF0ZU1ldGFkYXRhKGtleSlcblx0XHRcdFx0XHRcdHRoaXMuc2V0U3RhdGUoe2tleToga2V5fSlcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZWxzZSB7XG5cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dGhpcy5zZXRTdGF0ZSh7dmVyaWZ5S2V5OiBmYWxzZX0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0Y29uc29sZS5sb2coZSlcblx0XHRcdH1cblx0XHR9LmJpbmQodGhpcykpXG5cdH0sXG5cdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0dmFyIGhhbmRsZXIgPSA8Um91dGVIYW5kbGVyIGRiPXt0aGlzLnN0YXRlLmRifSBmb289XCJiYXJcIiBhdXRoa2V5PXt0aGlzLnN0YXRlLmtleX0gY2xlYXJEYXRhYmFzZUFuZERlYXV0aGVudGljYXRlPXt0aGlzLmNsZWFyRGF0YWJhc2VBbmREZWF1dGhlbnRpY2F0ZX0gLz5cblxuXHRcdGlmICghdGhpcy5zdGF0ZS5sb2FkZWQpIHtcblx0XHRcdHJldHVybiA8ZGl2PjwvZGl2PlxuXHRcdH1cblxuXHRcdGlmICghdGhpcy5zdGF0ZS5rZXkpIHtcblx0XHRcdGhhbmRsZXIgPSA8QXV0aGVudGljYXRlIGV4aXN0cz17dGhpcy5zdGF0ZS5leGlzdHN9IG9uQXV0aGVudGljYXRlZD17dGhpcy5zZXRLZXl9IHdyb25nQXR0ZW1wdHM9e3RoaXMuc3RhdGUud3JvbmdBdHRlbXB0c30gdmVyaWZ5S2V5PXt0aGlzLnN0YXRlLnZlcmlmeUtleX0gY2xlYXJEYXRhYmFzZUFuZERlYXV0aGVudGljYXRlPXt0aGlzLmNsZWFyRGF0YWJhc2VBbmREZWF1dGhlbnRpY2F0ZX0vPlxuXHRcdH1cblxuXHRcdFxuXHRcdHJldHVybiAoXG5cdFx0XHQ8ZGl2PlxuXHRcdFx0XHQ8bWFpbj5cblx0XHRcdFx0XHR7aGFuZGxlcn1cblx0XHRcdFx0PC9tYWluPlxuXHRcdFx0PC9kaXY+XG5cdFx0KTtcblx0fVxufSk7XG5cbiIsInZhciBSZWFjdCA9IHJlcXVpcmUoJ3JlYWN0L2FkZG9ucycpO1xudmFyIFJvdXRlciA9IHJlcXVpcmUoJ3JlYWN0LXJvdXRlcicpO1xudmFyIFJvdXRlSGFuZGxlciA9IFJvdXRlci5Sb3V0ZUhhbmRsZXI7XG52YXIgZGVjcnlwdCA9IHJlcXVpcmUoJy4uL3V0aWxpdGllcy9kZWNyeXB0RW50cnknKVxudmFyIGFsZXJ0aWZ5ID0gcmVxdWlyZSgnYWxlcnRpZnlqcycpXG5cbnZhciBHYXBpID0gcmVxdWlyZSgnLi4vY29tcG9uZW50cy9nYXBpJylcblxubW9kdWxlLmV4cG9ydHMgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG5cdG1peGluczogWyBSb3V0ZXIuU3RhdGUsIFJvdXRlci5OYXZpZ2F0aW9uXSxcblx0dHJhbnNpdGlvblRvSW5kZXg6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMudHJhbnNpdGlvblRvKCdpbmRleCcpO1xuXHR9LFxuXHRnZXRJbml0aWFsU3RhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiB7XG5cdFx0XHRqc29uOiAnJ1xuXHRcdH1cblx0fSxcblx0ZXhwb3J0RmlsZTogZnVuY3Rpb24oZGVjcnlwdGVkKSB7XG5cdFx0dGhpcy5wcm9wcy5kYi5hbGxEb2NzKHtcblx0XHRcdGluY2x1ZGVfZG9jczogdHJ1ZSxcblx0XHR9KS50aGVuKGZ1bmN0aW9uKHJlc3VsdHMpIHtcblx0XHRcdHZhciByZXN1bHRzID0gcmVzdWx0cy5yb3dzLmZpbHRlcihmdW5jdGlvbihyb3cpIHtcblx0XHRcdFx0cmV0dXJuICFkZWNyeXB0ZWQgfHwgcm93LmlkICE9PSAnam91cm5leV9tZXRhZGF0YSdcblx0XHRcdH0pLm1hcChmdW5jdGlvbihkb2Mpe1xuXHRcdFx0XHR2YXIgZW50cnkgPSBkb2MuZG9jO1xuXHRcdFx0XHRpZiAoZGVjcnlwdGVkKSB7XG5cdFx0XHRcdFx0ZGVjcnlwdCh0aGlzLnByb3BzLmF1dGhrZXksIGRvYy5kb2MpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGVudHJ5LmlkID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRlbnRyeS5yZXYgPSB1bmRlZmluZWRcblx0XHRcdFx0cmV0dXJuIGVudHJ5XG5cdFx0XHR9LmJpbmQodGhpcykpO1xuXG5cdFx0XHR2YXIganNvbiA9IEpTT04uc3RyaW5naWZ5KHJlc3VsdHMpO1xuXHRcdFx0dGhpcy5zZXRTdGF0ZSh7anNvbjoganNvbn0pO1xuXHRcdH0uYmluZCh0aGlzKSlcblx0XHQuY2F0Y2goZnVuY3Rpb24oZSkge1xuXHRcdFx0Y29uc29sZS5sb2coZSk7XG5cdFx0fSk7XG5cdH0sXG5cdGRlbGV0ZUpvdXJuYWw6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBtZXNzYWdlID0gXCJBcmUgeW91IHN1cmU/XFxuVGhpcyBjYW5ub3QgYmUgdW5kb25lIVwiXG5cdFx0YWxlcnRpZnkuY29uZmlybShtZXNzYWdlKS5zZXQoJ3RpdGxlJywgJ0RlbGV0ZSBKb3VybmFsJykuc2V0KCdsYWJlbHMnLCB7b2s6J1llcycsIGNhbmNlbDonTm8nfSkuc2V0KCdvbm9rJywgZnVuY3Rpb24oKXtcblx0XHRcdHRoaXMucHJvcHMuY2xlYXJEYXRhYmFzZUFuZERlYXV0aGVudGljYXRlKCk7XG5cdFx0fS5iaW5kKHRoaXMpKVxuXHR9LFxuXHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciByb3V0ZSA9IHRoaXMuZ2V0Um91dGVzKCk7XG5cdFx0XG5cdFx0cmV0dXJuIChcblx0XHRcdDxkaXYgY2xhc3NOYW1lPVwiam91cm5leV9jb250YWluZXJcIj5cblx0XHRcdFx0PGRpdiBjbGFzc05hbWU9XCJqb3VybmV5X3Rvb2xiYXIgZW50cnlfdG9wXCI+XG5cdFx0XHRcdFx0PGRpdiBjbGFzc05hbWU9XCJlbnRyeV9iYWNrXCIgb25DbGljaz17dGhpcy50cmFuc2l0aW9uVG9JbmRleH0+XG5cdFx0XHRcdFx0XHQmIzg1OTI7IGJhY2tcblx0XHRcdFx0XHQ8L2Rpdj5cblx0XHRcdFx0PC9kaXY+XG5cdFx0XHRcdDxkaXYgY2xhc3NOYW1lPVwiY29udGVudFwiPlxuXG5cdFx0XHRcdFx0PEdhcGkgZGI9e3RoaXMucHJvcHMuZGJ9PjwvR2FwaT5cblxuXHRcdFx0XHRcdDxidXR0b24gb25DbGljaz17dGhpcy5leHBvcnRGaWxlLmJpbmQodGhpcywgZmFsc2UpfT5FeHBvcnQgdG8ganNvbiAoZW5jcnlwdGVkKTwvYnV0dG9uPjxiciAvPlxuXHRcdFx0XHRcdDxidXR0b24gb25DbGljaz17dGhpcy5leHBvcnRGaWxlLmJpbmQodGhpcywgdHJ1ZSl9PkV4cG9ydCB0byBqc29uIChkZWNyeXB0ZWQpPC9idXR0b24+PGJyIC8+XG5cblx0XHRcdFx0XHQ8YnV0dG9uIG9uQ2xpY2s9e3RoaXMuZGVsZXRlSm91cm5hbH0+RGVsZXRlIGpvdXJuYWw8L2J1dHRvbj5cblxuXHRcdFx0XHRcdDx0ZXh0YXJlYSBjbGFzc05hbWU9XCJqc29uVmlld1wiIHZhbHVlPXt0aGlzLnN0YXRlLmpzb259PjwvdGV4dGFyZWE+XG5cdFx0XHRcdDwvZGl2PlxuXHRcdFx0PC9kaXY+XG5cdFx0KTtcblx0fVxufSk7XG4iLCJ2YXIgUmVhY3QgPSByZXF1aXJlKCdyZWFjdC9hZGRvbnMnKTtcbnZhciBSb3V0ZXIgPSByZXF1aXJlKCdyZWFjdC1yb3V0ZXInKTtcblxubW9kdWxlLmV4cG9ydHMgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG5cdHN1Ym1pdDogZnVuY3Rpb24oZSkge1xuXHRcdGlmIChlLmtleUNvZGU9PT0xMykge1xuXHRcdFx0dmFyIGVsZW1lbnQgPSB0aGlzLnJlZnMucGFzc3dvcmQuZ2V0RE9NTm9kZSgpXG5cdFx0XHR0aGlzLnByb3BzLm9uQXV0aGVudGljYXRlZChlbGVtZW50LnZhbHVlKVxuXHRcdFx0ZWxlbWVudC52YWx1ZSA9ICcnXG5cdFx0fVxuXHR9LFxuXHRyZXNldERhdGFiYXNlOiBmdW5jdGlvbigpIHtcblx0XHR2YXIgbWVzc2FnZSA9IFwiQXJlIHlvdSBzdXJlP1xcblRoaXMgY2Fubm90IGJlIHVuZG9uZSFcIlxuXHRcdGFsZXJ0aWZ5LmNvbmZpcm0obWVzc2FnZSkuc2V0KCd0aXRsZScsICdEZWxldGUgSm91cm5hbCcpLnNldCgnbGFiZWxzJywge29rOidZZXMnLCBjYW5jZWw6J05vJ30pLnNldCgnb25vaycsIGZ1bmN0aW9uKCl7XG5cdFx0XHR0aGlzLnByb3BzLmNsZWFyRGF0YWJhc2VBbmREZWF1dGhlbnRpY2F0ZSgpXG5cdFx0fS5iaW5kKHRoaXMpKTtcblx0XHRhbGVydGlmeS5lcnJvcignSm91cm5hbCByZXNldCEnLCAxKVxuXHR9LFxuXHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBwbGFjZWhvbGRlciA9ICdjaG9vc2UgYSBwYXNzd29yZCdcblx0XHRpZiAodGhpcy5wcm9wcy52ZXJpZnlLZXkpIHtcblx0XHRcdHBsYWNlaG9sZGVyID0gJ3ZlcmlmeSBwYXNzd29yZCdcblx0XHR9XG5cdFx0aWYgKHRoaXMucHJvcHMuZXhpc3RzKSB7XG5cdFx0XHRwbGFjZWhvbGRlciA9ICdlbnRlciBhIHBhc3N3b3JkJ1xuXHRcdH1cblxuXHRcdHZhciByZXNldHB3ID0gKHRoaXMucHJvcHMud3JvbmdBdHRlbXB0cyA+PSAzKSA/IDxkaXYgb25DbGljaz17dGhpcy5yZXNldERhdGFiYXNlfSBjbGFzc05hbWU9XCJyZXNldF9wYXNzd29yZF9idXR0b25cIj48cD5mb3Jnb3QgeW91ciBwYXNzd29yZD88L3A+PHA+Y2xpY2sgaGVyZSB0byBkZWxldGUgdGhlIGpvdXJuYWwgYW5kIHN0YXJ0IG92ZXI8L3A+PC9kaXY+IDogdW5kZWZpbmVkXG5cblx0XHRyZXR1cm4gKDxkaXYgY2xhc3NOYW1lPVwiYXV0aF93cmFwcGVyXCI+XG5cdFx0XHRcdDxkaXY+XG5cdFx0XHRcdFx0PGkgY2xhc3NOYW1lPVwiZmEgZmEtbG9ja1wiPjwvaT5cblx0XHRcdFx0XHQ8aW5wdXQgcGxhY2Vob2xkZXI9e3BsYWNlaG9sZGVyfSB0eXBlPVwicGFzc3dvcmRcIiBhdXRvRm9jdXM9XCJ0cnVlXCIgcmVmPVwicGFzc3dvcmRcIiBvbktleURvd249e3RoaXMuc3VibWl0fS8+XG5cdFx0XHRcdDwvZGl2PlxuXHRcdFx0XHR7cmVzZXRwd31cblx0XHQ8L2Rpdj4pXG5cdH1cbn0pO1xuIiwibW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgY29udmVydDpmdW5jdGlvbihkKSB7XG4gICAgICAgIC8vIENvbnZlcnRzIHRoZSBkYXRlIGluIGQgdG8gYSBkYXRlLW9iamVjdC4gVGhlIGlucHV0IGNhbiBiZTpcbiAgICAgICAgLy8gICBhIGRhdGUgb2JqZWN0OiByZXR1cm5lZCB3aXRob3V0IG1vZGlmaWNhdGlvblxuICAgICAgICAvLyAgYW4gYXJyYXkgICAgICA6IEludGVycHJldGVkIGFzIFt5ZWFyLG1vbnRoLGRheV0uIE5PVEU6IG1vbnRoIGlzIDAtMTEuXG4gICAgICAgIC8vICAgYSBudW1iZXIgICAgIDogSW50ZXJwcmV0ZWQgYXMgbnVtYmVyIG9mIG1pbGxpc2Vjb25kc1xuICAgICAgICAvLyAgICAgICAgICAgICAgICAgIHNpbmNlIDEgSmFuIDE5NzAgKGEgdGltZXN0YW1wKSBcbiAgICAgICAgLy8gICBhIHN0cmluZyAgICAgOiBBbnkgZm9ybWF0IHN1cHBvcnRlZCBieSB0aGUgamF2YXNjcmlwdCBlbmdpbmUsIGxpa2VcbiAgICAgICAgLy8gICAgICAgICAgICAgICAgICBcIllZWVkvTU0vRERcIiwgXCJNTS9ERC9ZWVlZXCIsIFwiSmFuIDMxIDIwMDlcIiBldGMuXG4gICAgICAgIC8vICBhbiBvYmplY3QgICAgIDogSW50ZXJwcmV0ZWQgYXMgYW4gb2JqZWN0IHdpdGggeWVhciwgbW9udGggYW5kIGRhdGVcbiAgICAgICAgLy8gICAgICAgICAgICAgICAgICBhdHRyaWJ1dGVzLiAgKipOT1RFKiogbW9udGggaXMgMC0xMS5cbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIGQuY29uc3RydWN0b3IgPT09IERhdGUgPyBkIDpcbiAgICAgICAgICAgIGQuY29uc3RydWN0b3IgPT09IEFycmF5ID8gbmV3IERhdGUoZFswXSxkWzFdLGRbMl0pIDpcbiAgICAgICAgICAgIGQuY29uc3RydWN0b3IgPT09IE51bWJlciA/IG5ldyBEYXRlKGQpIDpcbiAgICAgICAgICAgIGQuY29uc3RydWN0b3IgPT09IFN0cmluZyA/IG5ldyBEYXRlKGQpIDpcbiAgICAgICAgICAgIHR5cGVvZiBkID09PSBcIm9iamVjdFwiID8gbmV3IERhdGUoZC55ZWFyLGQubW9udGgsZC5kYXRlKSA6XG4gICAgICAgICAgICBOYU5cbiAgICAgICAgKTtcbiAgICB9LFxuICAgIGNvbXBhcmU6ZnVuY3Rpb24oYSxiKSB7XG4gICAgICAgIC8vIENvbXBhcmUgdHdvIGRhdGVzIChjb3VsZCBiZSBvZiBhbnkgdHlwZSBzdXBwb3J0ZWQgYnkgdGhlIGNvbnZlcnRcbiAgICAgICAgLy8gZnVuY3Rpb24gYWJvdmUpIGFuZCByZXR1cm5zOlxuICAgICAgICAvLyAgLTEgOiBpZiBhIDwgYlxuICAgICAgICAvLyAgIDAgOiBpZiBhID0gYlxuICAgICAgICAvLyAgIDEgOiBpZiBhID4gYlxuICAgICAgICAvLyBOYU4gOiBpZiBhIG9yIGIgaXMgYW4gaWxsZWdhbCBkYXRlXG4gICAgICAgIC8vIE5PVEU6IFRoZSBjb2RlIGluc2lkZSBpc0Zpbml0ZSBkb2VzIGFuIGFzc2lnbm1lbnQgKD0pLlxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgaXNGaW5pdGUoYT10aGlzLmNvbnZlcnQoYSkudmFsdWVPZigpKSAmJlxuICAgICAgICAgICAgaXNGaW5pdGUoYj10aGlzLmNvbnZlcnQoYikudmFsdWVPZigpKSA/XG4gICAgICAgICAgICAoYT5iKS0oYTxiKSA6XG4gICAgICAgICAgICBOYU5cbiAgICAgICAgKTtcbiAgICB9LFxuICAgIGluUmFuZ2U6ZnVuY3Rpb24oZCxzdGFydCxlbmQpIHtcbiAgICAgICAgLy8gQ2hlY2tzIGlmIGRhdGUgaW4gZCBpcyBiZXR3ZWVuIGRhdGVzIGluIHN0YXJ0IGFuZCBlbmQuXG4gICAgICAgIC8vIFJldHVybnMgYSBib29sZWFuIG9yIE5hTjpcbiAgICAgICAgLy8gICAgdHJ1ZSAgOiBpZiBkIGlzIGJldHdlZW4gc3RhcnQgYW5kIGVuZCAoaW5jbHVzaXZlKVxuICAgICAgICAvLyAgICBmYWxzZSA6IGlmIGQgaXMgYmVmb3JlIHN0YXJ0IG9yIGFmdGVyIGVuZFxuICAgICAgICAvLyAgICBOYU4gICA6IGlmIG9uZSBvciBtb3JlIG9mIHRoZSBkYXRlcyBpcyBpbGxlZ2FsLlxuICAgICAgICAvLyBOT1RFOiBUaGUgY29kZSBpbnNpZGUgaXNGaW5pdGUgZG9lcyBhbiBhc3NpZ25tZW50ICg9KS5cbiAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgaXNGaW5pdGUoZD10aGlzLmNvbnZlcnQoZCkudmFsdWVPZigpKSAmJlxuICAgICAgICAgICAgaXNGaW5pdGUoc3RhcnQ9dGhpcy5jb252ZXJ0KHN0YXJ0KS52YWx1ZU9mKCkpICYmXG4gICAgICAgICAgICBpc0Zpbml0ZShlbmQ9dGhpcy5jb252ZXJ0KGVuZCkudmFsdWVPZigpKSA/XG4gICAgICAgICAgICBzdGFydCA8PSBkICYmIGQgPD0gZW5kIDpcbiAgICAgICAgICAgIE5hTlxuICAgICAgICApO1xuICAgIH1cbn1cbiIsInZhciBzamNsID0gcmVxdWlyZSgnc2pjbCcpXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oa2V5LCBlbnRyeSkge1xuXHRlbnRyeS5jb250ZW50ID0gc2pjbC5kZWNyeXB0KGtleSwgZW50cnkuY29udGVudClcblx0ZW50cnkudGl0bGUgPSBlbnRyeS5jb250ZW50LnNwbGl0KCdcXG4nKVswXVxuXHRpZiAoZW50cnkuZGF0ZXRpbWUpIHtcblx0XHRlbnRyeS5kYXRldGltZSA9IHNqY2wuZGVjcnlwdChrZXksIGVudHJ5LmRhdGV0aW1lKVxuXHR9XG5cdGVudHJ5LnRhZ3MgPSBzamNsLmRlY3J5cHQoa2V5LCBlbnRyeS50YWdzKS5zcGxpdCgnLCcpLmZpbHRlcihmdW5jdGlvbih0YWcpIHtcblx0XHRyZXR1cm4gdGFnICE9PSAnJ1xuXHR9KVxuXHRyZXR1cm4gZW50cnk7XG59XG4iLCJ2YXIgc2pjbCA9IHJlcXVpcmUoJ3NqY2wnKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGtleSwgZW50cnkpIHtcblx0ZW50cnkuY29udGVudCA9IHNqY2wuZW5jcnlwdChrZXksIGVudHJ5LmNvbnRlbnQpXG5cdGlmIChlbnRyeS5kYXRldGltZSkge1xuXHRcdGVudHJ5LmRhdGV0aW1lID0gc2pjbC5lbmNyeXB0KGtleSwgZW50cnkuZGF0ZXRpbWUpXG5cdH1cblx0ZW50cnkudGFncyA9IHNqY2wuZW5jcnlwdChrZXksIGVudHJ5LnRhZ3Muam9pbignLCcpKVxuXHRyZXR1cm4gZW50cnk7XG59XG4iLCIvL2Vuc3VyZXMgYWxsIHRoZSBuZWNlc3NhcnkgY29tcG9uZW50cyBhcmUgbG9hZGVkXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGVuc3VyZUxvYWRlZChjYWxsYmFjaykge1xuXHR2YXIgbG9hZEF1dGggPSBmdW5jdGlvbihjYikge1xuXHRcdGdhcGkubG9hZCgnYXV0aCcsIGZ1bmN0aW9uKCkge1xuXHRcdFx0Y2IoKVxuXHRcdH0pXG5cdH1cblxuXHR2YXIgbG9hZENsaWVudCA9IGZ1bmN0aW9uKGNiKSB7XG5cdFx0Z2FwaS5sb2FkKCdjbGllbnQnLCBmdW5jdGlvbigpIHtcblx0XHRcdGNiKClcblx0XHR9KVxuXHR9XG5cblx0dmFyIGxvYWREcml2ZSA9IGZ1bmN0aW9uKGNiKSB7XG5cdFx0Z2FwaS5jbGllbnQubG9hZCgnZHJpdmUnLCAndjInLCBmdW5jdGlvbigpIHtcblx0XHRcdGNiKClcblx0XHR9KVxuXHR9XG5cdFxuXHRsb2FkQXV0aChsb2FkQ2xpZW50LmJpbmQodGhpcywgbG9hZERyaXZlLmJpbmQodGhpcywgY2FsbGJhY2spKSlcbn1cbiIsInZhciBlbnN1cmVMb2FkZWQgPSByZXF1aXJlKCcuL2Vuc3VyZUdhcGlMb2FkZWQnKVxuXG52YXIgaW5mbyA9IHtcblx0Y2xpZW50X2lkOiAnNjcxNjY1MTg1MzQ4LXBsZ3ZjZW9manUyY28xYW9jOTRjaWcya2NmNnIwbWg2LmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tJyxcblx0c2NvcGU6ICdodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9hdXRoL2RyaXZlLmFwcGZvbGRlcidcbn1cblxudmFyIGFwcFVybCA9ICdodHRwczovL2Rlc2xlZS5tZS9hdXRob3JpemUvam91cm5leSdcblxudmFyIGdhcGlDb25maWcgPSB7XG5cdGF1dGhfdXJpOiAnaHR0cHM6Ly9hY2NvdW50cy5nb29nbGUuY29tL28vb2F1dGgyL2F1dGgnLFxuXHR0b2tlbl91cmk6ICdodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20vby9vYXV0aDIvdG9rZW4nLFxuXHRyZWRpcmVjdF91cmk6IGFwcFVybFxufTtcblxudmFyIGxvZ2luX3VybCA9IGdhcGlDb25maWcuYXV0aF91cmlcbisgJz9jbGllbnRfaWQ9JyArIGluZm8uY2xpZW50X2lkXG4rICcmcmVkaXJlY3RfdXJpPScgKyBnYXBpQ29uZmlnLnJlZGlyZWN0X3VyaVxuKyAnJnJlc3BvbnNlX3R5cGU9Y29kZSdcbisgJyZzY29wZT0nICsgaW5mby5zY29wZVxuXG5cbmZ1bmN0aW9uIGhhbmRsZUdhcGlSZXF1ZXN0KHJlcXVlc3QsIGNhbGxiYWNrKSB7XG5cdHZhciB0cmllZFJlZnJlc2ggPSBmYWxzZVxuXHR2YXIgaGFuZGxlNDAxID0gZnVuY3Rpb24oKSB7XG5cdFx0ZGVsZXRlIGxvY2FsU3RvcmFnZS50b2tlblxuXHRcdGdhcGkuYXV0aC5zaWduT3V0KCk7XG5cdFx0dHJpZWRSZWZyZXNoID0gdHJ1ZVxuXHRcdGVuc3VyZUF1dGhvcml6ZWQoZXhlY3V0ZSlcblx0fVxuXG5cdHZhciBoYW5kbGVSZXNwb25zZSA9IGZ1bmN0aW9uKHJlc3BvbnNlKSB7XG5cdFx0aWYgKHJlc3BvbnNlLmNvZGUgPT0gNDAxICYmICF0cmllZFJlZnJlc2gpIHtcblx0XHRcdGhhbmRsZTQwMSgpXG5cdFx0fVxuXHRcdGVsc2UgaWYgKHJlc3BvbnNlLmNvZGUgPT0gNDAzKSB7XG5cdFx0XHRjb25zb2xlLmxvZyhyZXNwb25zZSlcblx0XHRcdGNhbGxiYWNrKHJlc3BvbnNlKVxuXHRcdH1lbHNlIHtcblx0XHRcdC8vIHdlIGhhdmUgZGF0YVxuXHRcdFx0Y2FsbGJhY2sobnVsbCwgcmVzcG9uc2UpXG5cdFx0fVxuXHR9XG5cblxuXHR2YXIgZXhlY3V0ZSA9IGZ1bmN0aW9uKGVycikge1xuXHRcdGlmIChlcnIpIHtcblx0XHRcdGNvbnNvbGUubG9nKGVycik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJlcXVlc3QuZXhlY3V0ZShoYW5kbGVSZXNwb25zZSlcblx0XHR9XG5cdH1cblx0ZW5zdXJlQXV0aG9yaXplZChleGVjdXRlKVxufVxuXG5mdW5jdGlvbiBnZXRBdXRob3JpemF0aW9uQ29kZVdlYnZpZXcoY2FsbGJhY2spIHtcblx0dmFyIGxvZ2luV2luZG93ID0gd2luZG93Lm9wZW4obG9naW5fdXJsLCAnX2JsYW5rJywgJ2xvY2F0aW9uPXllcycpXG5cdGxvZ2luV2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWRzdG9wJywgZnVuY3Rpb24oZSkge1xuXHRcdHZhciB1cmwgPSBlLnVybFxuXHRcdHZhciBjb2RlID0gL1xcP2NvZGU9KC4rKSQvLmV4ZWModXJsKTtcblx0XHR2YXIgZXJyb3IgPSAvXFw/ZXJyb3I9KC4rKSQvLmV4ZWModXJsKTtcblxuXHRcdGlmIChjb2RlKSB7XG5cdFx0XHRsb2dpbldpbmRvdy5leGVjdXRlU2NyaXB0KHtjb2RlOiBcImRvY3VtZW50LmJvZHkuaW5uZXJIVE1MXCJ9LCBmdW5jdGlvbih2YWx1ZXMpe1xuXHRcdFx0XHR2YXIgdG9rZW4gPSBKU09OLnBhcnNlKHZhbHVlc1swXSlcblx0XHRcdFx0Ly8gd2UgaGF2ZSB0aGUgdG9rZW4hXG5cdFx0XHRcdGxvY2FsU3RvcmFnZS5zZXRJdGVtKCd0b2tlbicsIHRva2VuKVxuXHRcdFx0XHRnYXBpLmF1dGguc2V0VG9rZW4odG9rZW4pXG5cdFx0XHRcdGxvZ2luV2luZG93LmNsb3NlKClcblx0XHRcdFx0Y2FsbGJhY2soKVxuXHRcdFx0fSlcblx0XHR9XG5cdFx0aWYgKGVycm9yKSB7XG5cdFx0XHRsb2dpbldpbmRvdy5jbG9zZSgpXG5cdFx0XHRjYWxsYmFjayhlcnJvcilcblx0XHR9XG5cdH0pXG59XG5cbmZ1bmN0aW9uIGdldEF1dGhvcml6YXRpb25Db2RlQnJvd3NlcihjYWxsYmFjaykge1xuXHR2YXIgaGFuZGxlUmVzdWx0ID0gZnVuY3Rpb24ocmVzdWx0KSB7XG5cdFx0aWYgKHJlc3VsdCAmJiAhcmVzdWx0LmVycm9yKSB7XG5cdFx0XHR2YXIgdG9rZW4gPSBnYXBpLmF1dGguZ2V0VG9rZW4oKVxuXHRcdFx0bG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3Rva2VuJywgSlNPTi5zdHJpbmdpZnkodG9rZW4pKVxuXHRcdFx0Y2FsbGJhY2soKSAvLyB3ZSBhcmUgYXV0aG9yaXplZCFcblx0XHR9IGVsc2UgaWYgKGluZm8uaW1tZWRpYXRlID09IHRydWUpIHtcblx0XHRcdGluZm8uaW1tZWRpYXRlID0gZmFsc2Vcblx0XHRcdGdhcGkuYXV0aC5hdXRob3JpemUoaW5mbywgaGFuZGxlUmVzdWx0KVxuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdC8vIGVycm9yLCByZXR1cm4gdGhlIGVycm9yXG5cdFx0XHRjYWxsYmFjayhyZXN1bHQpXG5cdFx0fVxuXHR9XG5cblxuXHRpbmZvLmltbWVkaWF0ZSA9IHRydWU7XG5cdGdhcGkuYXV0aC5hdXRob3JpemUoaW5mbywgaGFuZGxlUmVzdWx0KTtcbn1cblxuZnVuY3Rpb24gZ2V0QXV0aG9yaXphdGlvbkNvZGUoY2FsbGJhY2spIHtcblx0aWYgKHR5cGVvZihkZXZpY2UpID09ICd1bmRlZmluZWQnKSBkZXZpY2UgPSB7cGxhdGZvcm06ICdicm93c2VyJ31cblx0c3dpdGNoKGRldmljZS5wbGF0Zm9ybSkge1xuXHRcdGNhc2UgJ2Jyb3dzZXInOlxuXHRcdFx0Z2V0QXV0aG9yaXphdGlvbkNvZGVCcm93c2VyKGNhbGxiYWNrKVxuXHRcdGJyZWFrO1xuXHRcdGNhc2UgJ0FuZHJvaWQnOlxuXHRcdFx0Z2V0QXV0aG9yaXphdGlvbkNvZGVXZWJ2aWV3KGNhbGxiYWNrKVxuXHR9XG59XG5cbmZ1bmN0aW9uIGF1dGhvcml6ZShjYWxsYmFjaykge1xuXHRnZXRBdXRob3JpemF0aW9uQ29kZShjYWxsYmFjaylcbn1cblxuXG4vL2Vuc3VyZUxvYWRlZCBpcyBjYWxsZWQgYmVmb3JlIHRoaXNcbmZ1bmN0aW9uIF9lbnN1cmVBdXRob3JpemVkKGNhbGxiYWNrKSB7XG5cdHZhciB0b2tlbiA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCd0b2tlbicpXG5cdGlmICh0b2tlbikge1xuXHRcdGlmICghZ2FwaS5hdXRoLmdldFRva2VuKCkpIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGdhcGkuYXV0aC5zZXRUb2tlbihKU09OLnBhcnNlKHRva2VuKSlcblx0XHRcdH0gY2F0Y2goZSkge1xuXHRcdFx0XHRkZWxldGUgbG9jYWxTdG9yYWdlLnRva2VuXG5cdFx0XHRcdF9lbnN1cmVBdXRob3JpemVkKGNhbGxiYWNrKVxuXHRcdFx0fVxuXHRcdH1cblx0XHQvLyBob29yYXkhIHdlIGFyZSBhdXRob3JpemVkIVxuXHRcdGNhbGxiYWNrKClcblx0fVxuXHRlbHNlIHtcblx0XHRhdXRob3JpemUoY2FsbGJhY2spXG5cdH1cbn1cblxuZnVuY3Rpb24gZW5zdXJlQXV0aG9yaXplZChjYWxsYmFjaykge1xuXHRlbnN1cmVMb2FkZWQoX2Vuc3VyZUF1dGhvcml6ZWQuYmluZCh0aGlzLCBjYWxsYmFjaykpXG59XG5cbm1vZHVsZS5leHBvcnRzID0gaGFuZGxlR2FwaVJlcXVlc3RcbiIsIi8qIVxuICogVGhlIGJ1ZmZlciBtb2R1bGUgZnJvbSBub2RlLmpzLCBmb3IgdGhlIGJyb3dzZXIuXG4gKlxuICogQGF1dGhvciAgIEZlcm9zcyBBYm91a2hhZGlqZWggPGZlcm9zc0BmZXJvc3Mub3JnPiA8aHR0cDovL2Zlcm9zcy5vcmc+XG4gKiBAbGljZW5zZSAgTUlUXG4gKi9cblxudmFyIGJhc2U2NCA9IHJlcXVpcmUoJ2Jhc2U2NC1qcycpXG52YXIgaWVlZTc1NCA9IHJlcXVpcmUoJ2llZWU3NTQnKVxuXG5leHBvcnRzLkJ1ZmZlciA9IEJ1ZmZlclxuZXhwb3J0cy5TbG93QnVmZmVyID0gQnVmZmVyXG5leHBvcnRzLklOU1BFQ1RfTUFYX0JZVEVTID0gNTBcbkJ1ZmZlci5wb29sU2l6ZSA9IDgxOTJcblxuLyoqXG4gKiBJZiBgQnVmZmVyLl91c2VUeXBlZEFycmF5c2A6XG4gKiAgID09PSB0cnVlICAgIFVzZSBVaW50OEFycmF5IGltcGxlbWVudGF0aW9uIChmYXN0ZXN0KVxuICogICA9PT0gZmFsc2UgICBVc2UgT2JqZWN0IGltcGxlbWVudGF0aW9uIChjb21wYXRpYmxlIGRvd24gdG8gSUU2KVxuICovXG5CdWZmZXIuX3VzZVR5cGVkQXJyYXlzID0gKGZ1bmN0aW9uICgpIHtcbiAgLy8gRGV0ZWN0IGlmIGJyb3dzZXIgc3VwcG9ydHMgVHlwZWQgQXJyYXlzLiBTdXBwb3J0ZWQgYnJvd3NlcnMgYXJlIElFIDEwKywgRmlyZWZveCA0KyxcbiAgLy8gQ2hyb21lIDcrLCBTYWZhcmkgNS4xKywgT3BlcmEgMTEuNissIGlPUyA0LjIrLiBJZiB0aGUgYnJvd3NlciBkb2VzIG5vdCBzdXBwb3J0IGFkZGluZ1xuICAvLyBwcm9wZXJ0aWVzIHRvIGBVaW50OEFycmF5YCBpbnN0YW5jZXMsIHRoZW4gdGhhdCdzIHRoZSBzYW1lIGFzIG5vIGBVaW50OEFycmF5YCBzdXBwb3J0XG4gIC8vIGJlY2F1c2Ugd2UgbmVlZCB0byBiZSBhYmxlIHRvIGFkZCBhbGwgdGhlIG5vZGUgQnVmZmVyIEFQSSBtZXRob2RzLiBUaGlzIGlzIGFuIGlzc3VlXG4gIC8vIGluIEZpcmVmb3ggNC0yOS4gTm93IGZpeGVkOiBodHRwczovL2J1Z3ppbGxhLm1vemlsbGEub3JnL3Nob3dfYnVnLmNnaT9pZD02OTU0MzhcbiAgdHJ5IHtcbiAgICB2YXIgYnVmID0gbmV3IEFycmF5QnVmZmVyKDApXG4gICAgdmFyIGFyciA9IG5ldyBVaW50OEFycmF5KGJ1ZilcbiAgICBhcnIuZm9vID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gNDIgfVxuICAgIHJldHVybiA0MiA9PT0gYXJyLmZvbygpICYmXG4gICAgICAgIHR5cGVvZiBhcnIuc3ViYXJyYXkgPT09ICdmdW5jdGlvbicgLy8gQ2hyb21lIDktMTAgbGFjayBgc3ViYXJyYXlgXG4gIH0gY2F0Y2ggKGUpIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxufSkoKVxuXG4vKipcbiAqIENsYXNzOiBCdWZmZXJcbiAqID09PT09PT09PT09PT1cbiAqXG4gKiBUaGUgQnVmZmVyIGNvbnN0cnVjdG9yIHJldHVybnMgaW5zdGFuY2VzIG9mIGBVaW50OEFycmF5YCB0aGF0IGFyZSBhdWdtZW50ZWRcbiAqIHdpdGggZnVuY3Rpb24gcHJvcGVydGllcyBmb3IgYWxsIHRoZSBub2RlIGBCdWZmZXJgIEFQSSBmdW5jdGlvbnMuIFdlIHVzZVxuICogYFVpbnQ4QXJyYXlgIHNvIHRoYXQgc3F1YXJlIGJyYWNrZXQgbm90YXRpb24gd29ya3MgYXMgZXhwZWN0ZWQgLS0gaXQgcmV0dXJuc1xuICogYSBzaW5nbGUgb2N0ZXQuXG4gKlxuICogQnkgYXVnbWVudGluZyB0aGUgaW5zdGFuY2VzLCB3ZSBjYW4gYXZvaWQgbW9kaWZ5aW5nIHRoZSBgVWludDhBcnJheWBcbiAqIHByb3RvdHlwZS5cbiAqL1xuZnVuY3Rpb24gQnVmZmVyIChzdWJqZWN0LCBlbmNvZGluZywgbm9aZXJvKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBCdWZmZXIpKVxuICAgIHJldHVybiBuZXcgQnVmZmVyKHN1YmplY3QsIGVuY29kaW5nLCBub1plcm8pXG5cbiAgdmFyIHR5cGUgPSB0eXBlb2Ygc3ViamVjdFxuXG4gIC8vIFdvcmthcm91bmQ6IG5vZGUncyBiYXNlNjQgaW1wbGVtZW50YXRpb24gYWxsb3dzIGZvciBub24tcGFkZGVkIHN0cmluZ3NcbiAgLy8gd2hpbGUgYmFzZTY0LWpzIGRvZXMgbm90LlxuICBpZiAoZW5jb2RpbmcgPT09ICdiYXNlNjQnICYmIHR5cGUgPT09ICdzdHJpbmcnKSB7XG4gICAgc3ViamVjdCA9IHN0cmluZ3RyaW0oc3ViamVjdClcbiAgICB3aGlsZSAoc3ViamVjdC5sZW5ndGggJSA0ICE9PSAwKSB7XG4gICAgICBzdWJqZWN0ID0gc3ViamVjdCArICc9J1xuICAgIH1cbiAgfVxuXG4gIC8vIEZpbmQgdGhlIGxlbmd0aFxuICB2YXIgbGVuZ3RoXG4gIGlmICh0eXBlID09PSAnbnVtYmVyJylcbiAgICBsZW5ndGggPSBjb2VyY2Uoc3ViamVjdClcbiAgZWxzZSBpZiAodHlwZSA9PT0gJ3N0cmluZycpXG4gICAgbGVuZ3RoID0gQnVmZmVyLmJ5dGVMZW5ndGgoc3ViamVjdCwgZW5jb2RpbmcpXG4gIGVsc2UgaWYgKHR5cGUgPT09ICdvYmplY3QnKVxuICAgIGxlbmd0aCA9IGNvZXJjZShzdWJqZWN0Lmxlbmd0aCkgLy8gYXNzdW1lIHRoYXQgb2JqZWN0IGlzIGFycmF5LWxpa2VcbiAgZWxzZVxuICAgIHRocm93IG5ldyBFcnJvcignRmlyc3QgYXJndW1lbnQgbmVlZHMgdG8gYmUgYSBudW1iZXIsIGFycmF5IG9yIHN0cmluZy4nKVxuXG4gIHZhciBidWZcbiAgaWYgKEJ1ZmZlci5fdXNlVHlwZWRBcnJheXMpIHtcbiAgICAvLyBQcmVmZXJyZWQ6IFJldHVybiBhbiBhdWdtZW50ZWQgYFVpbnQ4QXJyYXlgIGluc3RhbmNlIGZvciBiZXN0IHBlcmZvcm1hbmNlXG4gICAgYnVmID0gQnVmZmVyLl9hdWdtZW50KG5ldyBVaW50OEFycmF5KGxlbmd0aCkpXG4gIH0gZWxzZSB7XG4gICAgLy8gRmFsbGJhY2s6IFJldHVybiBUSElTIGluc3RhbmNlIG9mIEJ1ZmZlciAoY3JlYXRlZCBieSBgbmV3YClcbiAgICBidWYgPSB0aGlzXG4gICAgYnVmLmxlbmd0aCA9IGxlbmd0aFxuICAgIGJ1Zi5faXNCdWZmZXIgPSB0cnVlXG4gIH1cblxuICB2YXIgaVxuICBpZiAoQnVmZmVyLl91c2VUeXBlZEFycmF5cyAmJiB0eXBlb2Ygc3ViamVjdC5ieXRlTGVuZ3RoID09PSAnbnVtYmVyJykge1xuICAgIC8vIFNwZWVkIG9wdGltaXphdGlvbiAtLSB1c2Ugc2V0IGlmIHdlJ3JlIGNvcHlpbmcgZnJvbSBhIHR5cGVkIGFycmF5XG4gICAgYnVmLl9zZXQoc3ViamVjdClcbiAgfSBlbHNlIGlmIChpc0FycmF5aXNoKHN1YmplY3QpKSB7XG4gICAgLy8gVHJlYXQgYXJyYXktaXNoIG9iamVjdHMgYXMgYSBieXRlIGFycmF5XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoQnVmZmVyLmlzQnVmZmVyKHN1YmplY3QpKVxuICAgICAgICBidWZbaV0gPSBzdWJqZWN0LnJlYWRVSW50OChpKVxuICAgICAgZWxzZVxuICAgICAgICBidWZbaV0gPSBzdWJqZWN0W2ldXG4gICAgfVxuICB9IGVsc2UgaWYgKHR5cGUgPT09ICdzdHJpbmcnKSB7XG4gICAgYnVmLndyaXRlKHN1YmplY3QsIDAsIGVuY29kaW5nKVxuICB9IGVsc2UgaWYgKHR5cGUgPT09ICdudW1iZXInICYmICFCdWZmZXIuX3VzZVR5cGVkQXJyYXlzICYmICFub1plcm8pIHtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIGJ1ZltpXSA9IDBcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYnVmXG59XG5cbi8vIFNUQVRJQyBNRVRIT0RTXG4vLyA9PT09PT09PT09PT09PVxuXG5CdWZmZXIuaXNFbmNvZGluZyA9IGZ1bmN0aW9uIChlbmNvZGluZykge1xuICBzd2l0Y2ggKFN0cmluZyhlbmNvZGluZykudG9Mb3dlckNhc2UoKSkge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICBjYXNlICdiaW5hcnknOlxuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgY2FzZSAncmF3JzpcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1Y3MtMic6XG4gICAgY2FzZSAndXRmMTZsZSc6XG4gICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgcmV0dXJuIHRydWVcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIGZhbHNlXG4gIH1cbn1cblxuQnVmZmVyLmlzQnVmZmVyID0gZnVuY3Rpb24gKGIpIHtcbiAgcmV0dXJuICEhKGIgIT09IG51bGwgJiYgYiAhPT0gdW5kZWZpbmVkICYmIGIuX2lzQnVmZmVyKVxufVxuXG5CdWZmZXIuYnl0ZUxlbmd0aCA9IGZ1bmN0aW9uIChzdHIsIGVuY29kaW5nKSB7XG4gIHZhciByZXRcbiAgc3RyID0gc3RyICsgJydcbiAgc3dpdGNoIChlbmNvZGluZyB8fCAndXRmOCcpIHtcbiAgICBjYXNlICdoZXgnOlxuICAgICAgcmV0ID0gc3RyLmxlbmd0aCAvIDJcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgICAgcmV0ID0gdXRmOFRvQnl0ZXMoc3RyKS5sZW5ndGhcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYXNjaWknOlxuICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgY2FzZSAncmF3JzpcbiAgICAgIHJldCA9IHN0ci5sZW5ndGhcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgIHJldCA9IGJhc2U2NFRvQnl0ZXMoc3RyKS5sZW5ndGhcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldCA9IHN0ci5sZW5ndGggKiAyXG4gICAgICBicmVha1xuICAgIGRlZmF1bHQ6XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gZW5jb2RpbmcnKVxuICB9XG4gIHJldHVybiByZXRcbn1cblxuQnVmZmVyLmNvbmNhdCA9IGZ1bmN0aW9uIChsaXN0LCB0b3RhbExlbmd0aCkge1xuICBhc3NlcnQoaXNBcnJheShsaXN0KSwgJ1VzYWdlOiBCdWZmZXIuY29uY2F0KGxpc3QsIFt0b3RhbExlbmd0aF0pXFxuJyArXG4gICAgICAnbGlzdCBzaG91bGQgYmUgYW4gQXJyYXkuJylcblxuICBpZiAobGlzdC5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gbmV3IEJ1ZmZlcigwKVxuICB9IGVsc2UgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgcmV0dXJuIGxpc3RbMF1cbiAgfVxuXG4gIHZhciBpXG4gIGlmICh0eXBlb2YgdG90YWxMZW5ndGggIT09ICdudW1iZXInKSB7XG4gICAgdG90YWxMZW5ndGggPSAwXG4gICAgZm9yIChpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgIHRvdGFsTGVuZ3RoICs9IGxpc3RbaV0ubGVuZ3RoXG4gICAgfVxuICB9XG5cbiAgdmFyIGJ1ZiA9IG5ldyBCdWZmZXIodG90YWxMZW5ndGgpXG4gIHZhciBwb3MgPSAwXG4gIGZvciAoaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGl0ZW0gPSBsaXN0W2ldXG4gICAgaXRlbS5jb3B5KGJ1ZiwgcG9zKVxuICAgIHBvcyArPSBpdGVtLmxlbmd0aFxuICB9XG4gIHJldHVybiBidWZcbn1cblxuLy8gQlVGRkVSIElOU1RBTkNFIE1FVEhPRFNcbi8vID09PT09PT09PT09PT09PT09PT09PT09XG5cbmZ1bmN0aW9uIF9oZXhXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIG9mZnNldCA9IE51bWJlcihvZmZzZXQpIHx8IDBcbiAgdmFyIHJlbWFpbmluZyA9IGJ1Zi5sZW5ndGggLSBvZmZzZXRcbiAgaWYgKCFsZW5ndGgpIHtcbiAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgfSBlbHNlIHtcbiAgICBsZW5ndGggPSBOdW1iZXIobGVuZ3RoKVxuICAgIGlmIChsZW5ndGggPiByZW1haW5pbmcpIHtcbiAgICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICAgIH1cbiAgfVxuXG4gIC8vIG11c3QgYmUgYW4gZXZlbiBudW1iZXIgb2YgZGlnaXRzXG4gIHZhciBzdHJMZW4gPSBzdHJpbmcubGVuZ3RoXG4gIGFzc2VydChzdHJMZW4gJSAyID09PSAwLCAnSW52YWxpZCBoZXggc3RyaW5nJylcblxuICBpZiAobGVuZ3RoID4gc3RyTGVuIC8gMikge1xuICAgIGxlbmd0aCA9IHN0ckxlbiAvIDJcbiAgfVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGJ5dGUgPSBwYXJzZUludChzdHJpbmcuc3Vic3RyKGkgKiAyLCAyKSwgMTYpXG4gICAgYXNzZXJ0KCFpc05hTihieXRlKSwgJ0ludmFsaWQgaGV4IHN0cmluZycpXG4gICAgYnVmW29mZnNldCArIGldID0gYnl0ZVxuICB9XG4gIEJ1ZmZlci5fY2hhcnNXcml0dGVuID0gaSAqIDJcbiAgcmV0dXJuIGlcbn1cblxuZnVuY3Rpb24gX3V0ZjhXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHZhciBjaGFyc1dyaXR0ZW4gPSBCdWZmZXIuX2NoYXJzV3JpdHRlbiA9XG4gICAgYmxpdEJ1ZmZlcih1dGY4VG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxuICByZXR1cm4gY2hhcnNXcml0dGVuXG59XG5cbmZ1bmN0aW9uIF9hc2NpaVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgdmFyIGNoYXJzV3JpdHRlbiA9IEJ1ZmZlci5fY2hhcnNXcml0dGVuID1cbiAgICBibGl0QnVmZmVyKGFzY2lpVG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxuICByZXR1cm4gY2hhcnNXcml0dGVuXG59XG5cbmZ1bmN0aW9uIF9iaW5hcnlXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBfYXNjaWlXcml0ZShidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIF9iYXNlNjRXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHZhciBjaGFyc1dyaXR0ZW4gPSBCdWZmZXIuX2NoYXJzV3JpdHRlbiA9XG4gICAgYmxpdEJ1ZmZlcihiYXNlNjRUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG4gIHJldHVybiBjaGFyc1dyaXR0ZW5cbn1cblxuZnVuY3Rpb24gX3V0ZjE2bGVXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHZhciBjaGFyc1dyaXR0ZW4gPSBCdWZmZXIuX2NoYXJzV3JpdHRlbiA9XG4gICAgYmxpdEJ1ZmZlcih1dGYxNmxlVG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxuICByZXR1cm4gY2hhcnNXcml0dGVuXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGUgPSBmdW5jdGlvbiAoc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCwgZW5jb2RpbmcpIHtcbiAgLy8gU3VwcG9ydCBib3RoIChzdHJpbmcsIG9mZnNldCwgbGVuZ3RoLCBlbmNvZGluZylcbiAgLy8gYW5kIHRoZSBsZWdhY3kgKHN0cmluZywgZW5jb2RpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICBpZiAoaXNGaW5pdGUob2Zmc2V0KSkge1xuICAgIGlmICghaXNGaW5pdGUobGVuZ3RoKSkge1xuICAgICAgZW5jb2RpbmcgPSBsZW5ndGhcbiAgICAgIGxlbmd0aCA9IHVuZGVmaW5lZFxuICAgIH1cbiAgfSBlbHNlIHsgIC8vIGxlZ2FjeVxuICAgIHZhciBzd2FwID0gZW5jb2RpbmdcbiAgICBlbmNvZGluZyA9IG9mZnNldFxuICAgIG9mZnNldCA9IGxlbmd0aFxuICAgIGxlbmd0aCA9IHN3YXBcbiAgfVxuXG4gIG9mZnNldCA9IE51bWJlcihvZmZzZXQpIHx8IDBcbiAgdmFyIHJlbWFpbmluZyA9IHRoaXMubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmICghbGVuZ3RoKSB7XG4gICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gIH0gZWxzZSB7XG4gICAgbGVuZ3RoID0gTnVtYmVyKGxlbmd0aClcbiAgICBpZiAobGVuZ3RoID4gcmVtYWluaW5nKSB7XG4gICAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgICB9XG4gIH1cbiAgZW5jb2RpbmcgPSBTdHJpbmcoZW5jb2RpbmcgfHwgJ3V0ZjgnKS50b0xvd2VyQ2FzZSgpXG5cbiAgdmFyIHJldFxuICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgY2FzZSAnaGV4JzpcbiAgICAgIHJldCA9IF9oZXhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICd1dGY4JzpcbiAgICBjYXNlICd1dGYtOCc6XG4gICAgICByZXQgPSBfdXRmOFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgIHJldCA9IF9hc2NpaVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICByZXQgPSBfYmluYXJ5V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgIHJldCA9IF9iYXNlNjRXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1Y3MtMic6XG4gICAgY2FzZSAndXRmMTZsZSc6XG4gICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgcmV0ID0gX3V0ZjE2bGVXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIGVuY29kaW5nJylcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbiAoZW5jb2RpbmcsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHNlbGYgPSB0aGlzXG5cbiAgZW5jb2RpbmcgPSBTdHJpbmcoZW5jb2RpbmcgfHwgJ3V0ZjgnKS50b0xvd2VyQ2FzZSgpXG4gIHN0YXJ0ID0gTnVtYmVyKHN0YXJ0KSB8fCAwXG4gIGVuZCA9IChlbmQgIT09IHVuZGVmaW5lZClcbiAgICA/IE51bWJlcihlbmQpXG4gICAgOiBlbmQgPSBzZWxmLmxlbmd0aFxuXG4gIC8vIEZhc3RwYXRoIGVtcHR5IHN0cmluZ3NcbiAgaWYgKGVuZCA9PT0gc3RhcnQpXG4gICAgcmV0dXJuICcnXG5cbiAgdmFyIHJldFxuICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgY2FzZSAnaGV4JzpcbiAgICAgIHJldCA9IF9oZXhTbGljZShzZWxmLCBzdGFydCwgZW5kKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICd1dGY4JzpcbiAgICBjYXNlICd1dGYtOCc6XG4gICAgICByZXQgPSBfdXRmOFNsaWNlKHNlbGYsIHN0YXJ0LCBlbmQpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgIHJldCA9IF9hc2NpaVNsaWNlKHNlbGYsIHN0YXJ0LCBlbmQpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICByZXQgPSBfYmluYXJ5U2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgIHJldCA9IF9iYXNlNjRTbGljZShzZWxmLCBzdGFydCwgZW5kKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1Y3MtMic6XG4gICAgY2FzZSAndXRmMTZsZSc6XG4gICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgcmV0ID0gX3V0ZjE2bGVTbGljZShzZWxmLCBzdGFydCwgZW5kKVxuICAgICAgYnJlYWtcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIGVuY29kaW5nJylcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUudG9KU09OID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4ge1xuICAgIHR5cGU6ICdCdWZmZXInLFxuICAgIGRhdGE6IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKHRoaXMuX2FyciB8fCB0aGlzLCAwKVxuICB9XG59XG5cbi8vIGNvcHkodGFyZ2V0QnVmZmVyLCB0YXJnZXRTdGFydD0wLCBzb3VyY2VTdGFydD0wLCBzb3VyY2VFbmQ9YnVmZmVyLmxlbmd0aClcbkJ1ZmZlci5wcm90b3R5cGUuY29weSA9IGZ1bmN0aW9uICh0YXJnZXQsIHRhcmdldF9zdGFydCwgc3RhcnQsIGVuZCkge1xuICB2YXIgc291cmNlID0gdGhpc1xuXG4gIGlmICghc3RhcnQpIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCAmJiBlbmQgIT09IDApIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICghdGFyZ2V0X3N0YXJ0KSB0YXJnZXRfc3RhcnQgPSAwXG5cbiAgLy8gQ29weSAwIGJ5dGVzOyB3ZSdyZSBkb25lXG4gIGlmIChlbmQgPT09IHN0YXJ0KSByZXR1cm5cbiAgaWYgKHRhcmdldC5sZW5ndGggPT09IDAgfHwgc291cmNlLmxlbmd0aCA9PT0gMCkgcmV0dXJuXG5cbiAgLy8gRmF0YWwgZXJyb3IgY29uZGl0aW9uc1xuICBhc3NlcnQoZW5kID49IHN0YXJ0LCAnc291cmNlRW5kIDwgc291cmNlU3RhcnQnKVxuICBhc3NlcnQodGFyZ2V0X3N0YXJ0ID49IDAgJiYgdGFyZ2V0X3N0YXJ0IDwgdGFyZ2V0Lmxlbmd0aCxcbiAgICAgICd0YXJnZXRTdGFydCBvdXQgb2YgYm91bmRzJylcbiAgYXNzZXJ0KHN0YXJ0ID49IDAgJiYgc3RhcnQgPCBzb3VyY2UubGVuZ3RoLCAnc291cmNlU3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGFzc2VydChlbmQgPj0gMCAmJiBlbmQgPD0gc291cmNlLmxlbmd0aCwgJ3NvdXJjZUVuZCBvdXQgb2YgYm91bmRzJylcblxuICAvLyBBcmUgd2Ugb29iP1xuICBpZiAoZW5kID4gdGhpcy5sZW5ndGgpXG4gICAgZW5kID0gdGhpcy5sZW5ndGhcbiAgaWYgKHRhcmdldC5sZW5ndGggLSB0YXJnZXRfc3RhcnQgPCBlbmQgLSBzdGFydClcbiAgICBlbmQgPSB0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0X3N0YXJ0ICsgc3RhcnRcblxuICB2YXIgbGVuID0gZW5kIC0gc3RhcnRcblxuICBpZiAobGVuIDwgMTAwIHx8ICFCdWZmZXIuX3VzZVR5cGVkQXJyYXlzKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIHRhcmdldFtpICsgdGFyZ2V0X3N0YXJ0XSA9IHRoaXNbaSArIHN0YXJ0XVxuICB9IGVsc2Uge1xuICAgIHRhcmdldC5fc2V0KHRoaXMuc3ViYXJyYXkoc3RhcnQsIHN0YXJ0ICsgbGVuKSwgdGFyZ2V0X3N0YXJ0KVxuICB9XG59XG5cbmZ1bmN0aW9uIF9iYXNlNjRTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIGlmIChzdGFydCA9PT0gMCAmJiBlbmQgPT09IGJ1Zi5sZW5ndGgpIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmKVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBiYXNlNjQuZnJvbUJ5dGVBcnJheShidWYuc2xpY2Uoc3RhcnQsIGVuZCkpXG4gIH1cbn1cblxuZnVuY3Rpb24gX3V0ZjhTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciByZXMgPSAnJ1xuICB2YXIgdG1wID0gJydcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgaWYgKGJ1ZltpXSA8PSAweDdGKSB7XG4gICAgICByZXMgKz0gZGVjb2RlVXRmOENoYXIodG1wKSArIFN0cmluZy5mcm9tQ2hhckNvZGUoYnVmW2ldKVxuICAgICAgdG1wID0gJydcbiAgICB9IGVsc2Uge1xuICAgICAgdG1wICs9ICclJyArIGJ1ZltpXS50b1N0cmluZygxNilcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzICsgZGVjb2RlVXRmOENoYXIodG1wKVxufVxuXG5mdW5jdGlvbiBfYXNjaWlTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciByZXQgPSAnJ1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspXG4gICAgcmV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnVmW2ldKVxuICByZXR1cm4gcmV0XG59XG5cbmZ1bmN0aW9uIF9iaW5hcnlTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHJldHVybiBfYXNjaWlTbGljZShidWYsIHN0YXJ0LCBlbmQpXG59XG5cbmZ1bmN0aW9uIF9oZXhTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG5cbiAgaWYgKCFzdGFydCB8fCBzdGFydCA8IDApIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCB8fCBlbmQgPCAwIHx8IGVuZCA+IGxlbikgZW5kID0gbGVuXG5cbiAgdmFyIG91dCA9ICcnXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgb3V0ICs9IHRvSGV4KGJ1ZltpXSlcbiAgfVxuICByZXR1cm4gb3V0XG59XG5cbmZ1bmN0aW9uIF91dGYxNmxlU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgYnl0ZXMgPSBidWYuc2xpY2Uoc3RhcnQsIGVuZClcbiAgdmFyIHJlcyA9ICcnXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYnl0ZXMubGVuZ3RoOyBpICs9IDIpIHtcbiAgICByZXMgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShieXRlc1tpXSArIGJ5dGVzW2krMV0gKiAyNTYpXG4gIH1cbiAgcmV0dXJuIHJlc1xufVxuXG5CdWZmZXIucHJvdG90eXBlLnNsaWNlID0gZnVuY3Rpb24gKHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIHN0YXJ0ID0gY2xhbXAoc3RhcnQsIGxlbiwgMClcbiAgZW5kID0gY2xhbXAoZW5kLCBsZW4sIGxlbilcblxuICBpZiAoQnVmZmVyLl91c2VUeXBlZEFycmF5cykge1xuICAgIHJldHVybiBCdWZmZXIuX2F1Z21lbnQodGhpcy5zdWJhcnJheShzdGFydCwgZW5kKSlcbiAgfSBlbHNlIHtcbiAgICB2YXIgc2xpY2VMZW4gPSBlbmQgLSBzdGFydFxuICAgIHZhciBuZXdCdWYgPSBuZXcgQnVmZmVyKHNsaWNlTGVuLCB1bmRlZmluZWQsIHRydWUpXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzbGljZUxlbjsgaSsrKSB7XG4gICAgICBuZXdCdWZbaV0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gICAgcmV0dXJuIG5ld0J1ZlxuICB9XG59XG5cbi8vIGBnZXRgIHdpbGwgYmUgcmVtb3ZlZCBpbiBOb2RlIDAuMTMrXG5CdWZmZXIucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIChvZmZzZXQpIHtcbiAgY29uc29sZS5sb2coJy5nZXQoKSBpcyBkZXByZWNhdGVkLiBBY2Nlc3MgdXNpbmcgYXJyYXkgaW5kZXhlcyBpbnN0ZWFkLicpXG4gIHJldHVybiB0aGlzLnJlYWRVSW50OChvZmZzZXQpXG59XG5cbi8vIGBzZXRgIHdpbGwgYmUgcmVtb3ZlZCBpbiBOb2RlIDAuMTMrXG5CdWZmZXIucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uICh2LCBvZmZzZXQpIHtcbiAgY29uc29sZS5sb2coJy5zZXQoKSBpcyBkZXByZWNhdGVkLiBBY2Nlc3MgdXNpbmcgYXJyYXkgaW5kZXhlcyBpbnN0ZWFkLicpXG4gIHJldHVybiB0aGlzLndyaXRlVUludDgodiwgb2Zmc2V0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50OCA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgPCB0aGlzLmxlbmd0aCwgJ1RyeWluZyB0byByZWFkIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgfVxuXG4gIGlmIChvZmZzZXQgPj0gdGhpcy5sZW5ndGgpXG4gICAgcmV0dXJuXG5cbiAgcmV0dXJuIHRoaXNbb2Zmc2V0XVxufVxuXG5mdW5jdGlvbiBfcmVhZFVJbnQxNiAoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAxIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byByZWFkIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIHZhciB2YWxcbiAgaWYgKGxpdHRsZUVuZGlhbikge1xuICAgIHZhbCA9IGJ1ZltvZmZzZXRdXG4gICAgaWYgKG9mZnNldCArIDEgPCBsZW4pXG4gICAgICB2YWwgfD0gYnVmW29mZnNldCArIDFdIDw8IDhcbiAgfSBlbHNlIHtcbiAgICB2YWwgPSBidWZbb2Zmc2V0XSA8PCA4XG4gICAgaWYgKG9mZnNldCArIDEgPCBsZW4pXG4gICAgICB2YWwgfD0gYnVmW29mZnNldCArIDFdXG4gIH1cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MTZMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZFVJbnQxNih0aGlzLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MTZCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZFVJbnQxNih0aGlzLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3JlYWRVSW50MzIgKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMyA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICB2YXIgdmFsXG4gIGlmIChsaXR0bGVFbmRpYW4pIHtcbiAgICBpZiAob2Zmc2V0ICsgMiA8IGxlbilcbiAgICAgIHZhbCA9IGJ1ZltvZmZzZXQgKyAyXSA8PCAxNlxuICAgIGlmIChvZmZzZXQgKyAxIDwgbGVuKVxuICAgICAgdmFsIHw9IGJ1ZltvZmZzZXQgKyAxXSA8PCA4XG4gICAgdmFsIHw9IGJ1ZltvZmZzZXRdXG4gICAgaWYgKG9mZnNldCArIDMgPCBsZW4pXG4gICAgICB2YWwgPSB2YWwgKyAoYnVmW29mZnNldCArIDNdIDw8IDI0ID4+PiAwKVxuICB9IGVsc2Uge1xuICAgIGlmIChvZmZzZXQgKyAxIDwgbGVuKVxuICAgICAgdmFsID0gYnVmW29mZnNldCArIDFdIDw8IDE2XG4gICAgaWYgKG9mZnNldCArIDIgPCBsZW4pXG4gICAgICB2YWwgfD0gYnVmW29mZnNldCArIDJdIDw8IDhcbiAgICBpZiAob2Zmc2V0ICsgMyA8IGxlbilcbiAgICAgIHZhbCB8PSBidWZbb2Zmc2V0ICsgM11cbiAgICB2YWwgPSB2YWwgKyAoYnVmW29mZnNldF0gPDwgMjQgPj4+IDApXG4gIH1cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZFVJbnQzMih0aGlzLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZFVJbnQzMih0aGlzLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50OCA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLFxuICAgICAgICAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgPCB0aGlzLmxlbmd0aCwgJ1RyeWluZyB0byByZWFkIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgfVxuXG4gIGlmIChvZmZzZXQgPj0gdGhpcy5sZW5ndGgpXG4gICAgcmV0dXJuXG5cbiAgdmFyIG5lZyA9IHRoaXNbb2Zmc2V0XSAmIDB4ODBcbiAgaWYgKG5lZylcbiAgICByZXR1cm4gKDB4ZmYgLSB0aGlzW29mZnNldF0gKyAxKSAqIC0xXG4gIGVsc2VcbiAgICByZXR1cm4gdGhpc1tvZmZzZXRdXG59XG5cbmZ1bmN0aW9uIF9yZWFkSW50MTYgKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMSA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICB2YXIgdmFsID0gX3JlYWRVSW50MTYoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgdHJ1ZSlcbiAgdmFyIG5lZyA9IHZhbCAmIDB4ODAwMFxuICBpZiAobmVnKVxuICAgIHJldHVybiAoMHhmZmZmIC0gdmFsICsgMSkgKiAtMVxuICBlbHNlXG4gICAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQxNkxFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIF9yZWFkSW50MTYodGhpcywgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZEludDE2KHRoaXMsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfcmVhZEludDMyIChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDMgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgdmFyIHZhbCA9IF9yZWFkVUludDMyKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIHRydWUpXG4gIHZhciBuZWcgPSB2YWwgJiAweDgwMDAwMDAwXG4gIGlmIChuZWcpXG4gICAgcmV0dXJuICgweGZmZmZmZmZmIC0gdmFsICsgMSkgKiAtMVxuICBlbHNlXG4gICAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQzMkxFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIF9yZWFkSW50MzIodGhpcywgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MzJCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZEludDMyKHRoaXMsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfcmVhZEZsb2F0IChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgKyAzIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byByZWFkIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgfVxuXG4gIHJldHVybiBpZWVlNzU0LnJlYWQoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgMjMsIDQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEZsb2F0TEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRGbG9hdCh0aGlzLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdEJFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIF9yZWFkRmxvYXQodGhpcywgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIF9yZWFkRG91YmxlIChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgKyA3IDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byByZWFkIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgfVxuXG4gIHJldHVybiBpZWVlNzU0LnJlYWQoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgNTIsIDgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZERvdWJsZUxFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIF9yZWFkRG91YmxlKHRoaXMsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZERvdWJsZUJFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIF9yZWFkRG91YmxlKHRoaXMsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDggPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0IDwgdGhpcy5sZW5ndGgsICd0cnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmdWludCh2YWx1ZSwgMHhmZilcbiAgfVxuXG4gIGlmIChvZmZzZXQgPj0gdGhpcy5sZW5ndGgpIHJldHVyblxuXG4gIHRoaXNbb2Zmc2V0XSA9IHZhbHVlXG59XG5cbmZ1bmN0aW9uIF93cml0ZVVJbnQxNiAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAxIDwgYnVmLmxlbmd0aCwgJ3RyeWluZyB0byB3cml0ZSBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gICAgdmVyaWZ1aW50KHZhbHVlLCAweGZmZmYpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICBmb3IgKHZhciBpID0gMCwgaiA9IE1hdGgubWluKGxlbiAtIG9mZnNldCwgMik7IGkgPCBqOyBpKyspIHtcbiAgICBidWZbb2Zmc2V0ICsgaV0gPVxuICAgICAgICAodmFsdWUgJiAoMHhmZiA8PCAoOCAqIChsaXR0bGVFbmRpYW4gPyBpIDogMSAtIGkpKSkpID4+PlxuICAgICAgICAgICAgKGxpdHRsZUVuZGlhbiA/IGkgOiAxIC0gaSkgKiA4XG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQxNkxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQxNkJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIF93cml0ZVVJbnQzMiAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAzIDwgYnVmLmxlbmd0aCwgJ3RyeWluZyB0byB3cml0ZSBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gICAgdmVyaWZ1aW50KHZhbHVlLCAweGZmZmZmZmZmKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgZm9yICh2YXIgaSA9IDAsIGogPSBNYXRoLm1pbihsZW4gLSBvZmZzZXQsIDQpOyBpIDwgajsgaSsrKSB7XG4gICAgYnVmW29mZnNldCArIGldID1cbiAgICAgICAgKHZhbHVlID4+PiAobGl0dGxlRW5kaWFuID8gaSA6IDMgLSBpKSAqIDgpICYgMHhmZlxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MzJMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MzJCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50OCA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgPCB0aGlzLmxlbmd0aCwgJ1RyeWluZyB0byB3cml0ZSBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gICAgdmVyaWZzaW50KHZhbHVlLCAweDdmLCAtMHg4MClcbiAgfVxuXG4gIGlmIChvZmZzZXQgPj0gdGhpcy5sZW5ndGgpXG4gICAgcmV0dXJuXG5cbiAgaWYgKHZhbHVlID49IDApXG4gICAgdGhpcy53cml0ZVVJbnQ4KHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KVxuICBlbHNlXG4gICAgdGhpcy53cml0ZVVJbnQ4KDB4ZmYgKyB2YWx1ZSArIDEsIG9mZnNldCwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIF93cml0ZUludDE2IChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDEgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZnNpbnQodmFsdWUsIDB4N2ZmZiwgLTB4ODAwMClcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIGlmICh2YWx1ZSA+PSAwKVxuICAgIF93cml0ZVVJbnQxNihidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpXG4gIGVsc2VcbiAgICBfd3JpdGVVSW50MTYoYnVmLCAweGZmZmYgKyB2YWx1ZSArIDEsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDE2TEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3dyaXRlSW50MzIgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMyA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmc2ludCh2YWx1ZSwgMHg3ZmZmZmZmZiwgLTB4ODAwMDAwMDApXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICBpZiAodmFsdWUgPj0gMClcbiAgICBfd3JpdGVVSW50MzIoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KVxuICBlbHNlXG4gICAgX3dyaXRlVUludDMyKGJ1ZiwgMHhmZmZmZmZmZiArIHZhbHVlICsgMSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MzJMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyQkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfd3JpdGVGbG9hdCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAzIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byB3cml0ZSBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gICAgdmVyaWZJRUVFNzU0KHZhbHVlLCAzLjQwMjgyMzQ2NjM4NTI4ODZlKzM4LCAtMy40MDI4MjM0NjYzODUyODg2ZSszOClcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIGllZWU3NTQud3JpdGUoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRmxvYXRMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVGbG9hdCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0QkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfd3JpdGVEb3VibGUgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgNyA8IGJ1Zi5sZW5ndGgsXG4gICAgICAgICdUcnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmSUVFRTc1NCh2YWx1ZSwgMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgsIC0xLjc5NzY5MzEzNDg2MjMxNTdFKzMwOClcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIGllZWU3NTQud3JpdGUoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDUyLCA4KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRG91YmxlTEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlRG91YmxlKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRG91YmxlQkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlRG91YmxlKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuLy8gZmlsbCh2YWx1ZSwgc3RhcnQ9MCwgZW5kPWJ1ZmZlci5sZW5ndGgpXG5CdWZmZXIucHJvdG90eXBlLmZpbGwgPSBmdW5jdGlvbiAodmFsdWUsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKCF2YWx1ZSkgdmFsdWUgPSAwXG4gIGlmICghc3RhcnQpIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCkgZW5kID0gdGhpcy5sZW5ndGhcblxuICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgIHZhbHVlID0gdmFsdWUuY2hhckNvZGVBdCgwKVxuICB9XG5cbiAgYXNzZXJ0KHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicgJiYgIWlzTmFOKHZhbHVlKSwgJ3ZhbHVlIGlzIG5vdCBhIG51bWJlcicpXG4gIGFzc2VydChlbmQgPj0gc3RhcnQsICdlbmQgPCBzdGFydCcpXG5cbiAgLy8gRmlsbCAwIGJ5dGVzOyB3ZSdyZSBkb25lXG4gIGlmIChlbmQgPT09IHN0YXJ0KSByZXR1cm5cbiAgaWYgKHRoaXMubGVuZ3RoID09PSAwKSByZXR1cm5cblxuICBhc3NlcnQoc3RhcnQgPj0gMCAmJiBzdGFydCA8IHRoaXMubGVuZ3RoLCAnc3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGFzc2VydChlbmQgPj0gMCAmJiBlbmQgPD0gdGhpcy5sZW5ndGgsICdlbmQgb3V0IG9mIGJvdW5kcycpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICB0aGlzW2ldID0gdmFsdWVcbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmluc3BlY3QgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBvdXQgPSBbXVxuICB2YXIgbGVuID0gdGhpcy5sZW5ndGhcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgIG91dFtpXSA9IHRvSGV4KHRoaXNbaV0pXG4gICAgaWYgKGkgPT09IGV4cG9ydHMuSU5TUEVDVF9NQVhfQllURVMpIHtcbiAgICAgIG91dFtpICsgMV0gPSAnLi4uJ1xuICAgICAgYnJlYWtcbiAgICB9XG4gIH1cbiAgcmV0dXJuICc8QnVmZmVyICcgKyBvdXQuam9pbignICcpICsgJz4nXG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIG5ldyBgQXJyYXlCdWZmZXJgIHdpdGggdGhlICpjb3BpZWQqIG1lbW9yeSBvZiB0aGUgYnVmZmVyIGluc3RhbmNlLlxuICogQWRkZWQgaW4gTm9kZSAwLjEyLiBPbmx5IGF2YWlsYWJsZSBpbiBicm93c2VycyB0aGF0IHN1cHBvcnQgQXJyYXlCdWZmZXIuXG4gKi9cbkJ1ZmZlci5wcm90b3R5cGUudG9BcnJheUJ1ZmZlciA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKHR5cGVvZiBVaW50OEFycmF5ICE9PSAndW5kZWZpbmVkJykge1xuICAgIGlmIChCdWZmZXIuX3VzZVR5cGVkQXJyYXlzKSB7XG4gICAgICByZXR1cm4gKG5ldyBCdWZmZXIodGhpcykpLmJ1ZmZlclxuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgYnVmID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5sZW5ndGgpXG4gICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gYnVmLmxlbmd0aDsgaSA8IGxlbjsgaSArPSAxKVxuICAgICAgICBidWZbaV0gPSB0aGlzW2ldXG4gICAgICByZXR1cm4gYnVmLmJ1ZmZlclxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0J1ZmZlci50b0FycmF5QnVmZmVyIG5vdCBzdXBwb3J0ZWQgaW4gdGhpcyBicm93c2VyJylcbiAgfVxufVxuXG4vLyBIRUxQRVIgRlVOQ1RJT05TXG4vLyA9PT09PT09PT09PT09PT09XG5cbmZ1bmN0aW9uIHN0cmluZ3RyaW0gKHN0cikge1xuICBpZiAoc3RyLnRyaW0pIHJldHVybiBzdHIudHJpbSgpXG4gIHJldHVybiBzdHIucmVwbGFjZSgvXlxccyt8XFxzKyQvZywgJycpXG59XG5cbnZhciBCUCA9IEJ1ZmZlci5wcm90b3R5cGVcblxuLyoqXG4gKiBBdWdtZW50IGEgVWludDhBcnJheSAqaW5zdGFuY2UqIChub3QgdGhlIFVpbnQ4QXJyYXkgY2xhc3MhKSB3aXRoIEJ1ZmZlciBtZXRob2RzXG4gKi9cbkJ1ZmZlci5fYXVnbWVudCA9IGZ1bmN0aW9uIChhcnIpIHtcbiAgYXJyLl9pc0J1ZmZlciA9IHRydWVcblxuICAvLyBzYXZlIHJlZmVyZW5jZSB0byBvcmlnaW5hbCBVaW50OEFycmF5IGdldC9zZXQgbWV0aG9kcyBiZWZvcmUgb3ZlcndyaXRpbmdcbiAgYXJyLl9nZXQgPSBhcnIuZ2V0XG4gIGFyci5fc2V0ID0gYXJyLnNldFxuXG4gIC8vIGRlcHJlY2F0ZWQsIHdpbGwgYmUgcmVtb3ZlZCBpbiBub2RlIDAuMTMrXG4gIGFyci5nZXQgPSBCUC5nZXRcbiAgYXJyLnNldCA9IEJQLnNldFxuXG4gIGFyci53cml0ZSA9IEJQLndyaXRlXG4gIGFyci50b1N0cmluZyA9IEJQLnRvU3RyaW5nXG4gIGFyci50b0xvY2FsZVN0cmluZyA9IEJQLnRvU3RyaW5nXG4gIGFyci50b0pTT04gPSBCUC50b0pTT05cbiAgYXJyLmNvcHkgPSBCUC5jb3B5XG4gIGFyci5zbGljZSA9IEJQLnNsaWNlXG4gIGFyci5yZWFkVUludDggPSBCUC5yZWFkVUludDhcbiAgYXJyLnJlYWRVSW50MTZMRSA9IEJQLnJlYWRVSW50MTZMRVxuICBhcnIucmVhZFVJbnQxNkJFID0gQlAucmVhZFVJbnQxNkJFXG4gIGFyci5yZWFkVUludDMyTEUgPSBCUC5yZWFkVUludDMyTEVcbiAgYXJyLnJlYWRVSW50MzJCRSA9IEJQLnJlYWRVSW50MzJCRVxuICBhcnIucmVhZEludDggPSBCUC5yZWFkSW50OFxuICBhcnIucmVhZEludDE2TEUgPSBCUC5yZWFkSW50MTZMRVxuICBhcnIucmVhZEludDE2QkUgPSBCUC5yZWFkSW50MTZCRVxuICBhcnIucmVhZEludDMyTEUgPSBCUC5yZWFkSW50MzJMRVxuICBhcnIucmVhZEludDMyQkUgPSBCUC5yZWFkSW50MzJCRVxuICBhcnIucmVhZEZsb2F0TEUgPSBCUC5yZWFkRmxvYXRMRVxuICBhcnIucmVhZEZsb2F0QkUgPSBCUC5yZWFkRmxvYXRCRVxuICBhcnIucmVhZERvdWJsZUxFID0gQlAucmVhZERvdWJsZUxFXG4gIGFyci5yZWFkRG91YmxlQkUgPSBCUC5yZWFkRG91YmxlQkVcbiAgYXJyLndyaXRlVUludDggPSBCUC53cml0ZVVJbnQ4XG4gIGFyci53cml0ZVVJbnQxNkxFID0gQlAud3JpdGVVSW50MTZMRVxuICBhcnIud3JpdGVVSW50MTZCRSA9IEJQLndyaXRlVUludDE2QkVcbiAgYXJyLndyaXRlVUludDMyTEUgPSBCUC53cml0ZVVJbnQzMkxFXG4gIGFyci53cml0ZVVJbnQzMkJFID0gQlAud3JpdGVVSW50MzJCRVxuICBhcnIud3JpdGVJbnQ4ID0gQlAud3JpdGVJbnQ4XG4gIGFyci53cml0ZUludDE2TEUgPSBCUC53cml0ZUludDE2TEVcbiAgYXJyLndyaXRlSW50MTZCRSA9IEJQLndyaXRlSW50MTZCRVxuICBhcnIud3JpdGVJbnQzMkxFID0gQlAud3JpdGVJbnQzMkxFXG4gIGFyci53cml0ZUludDMyQkUgPSBCUC53cml0ZUludDMyQkVcbiAgYXJyLndyaXRlRmxvYXRMRSA9IEJQLndyaXRlRmxvYXRMRVxuICBhcnIud3JpdGVGbG9hdEJFID0gQlAud3JpdGVGbG9hdEJFXG4gIGFyci53cml0ZURvdWJsZUxFID0gQlAud3JpdGVEb3VibGVMRVxuICBhcnIud3JpdGVEb3VibGVCRSA9IEJQLndyaXRlRG91YmxlQkVcbiAgYXJyLmZpbGwgPSBCUC5maWxsXG4gIGFyci5pbnNwZWN0ID0gQlAuaW5zcGVjdFxuICBhcnIudG9BcnJheUJ1ZmZlciA9IEJQLnRvQXJyYXlCdWZmZXJcblxuICByZXR1cm4gYXJyXG59XG5cbi8vIHNsaWNlKHN0YXJ0LCBlbmQpXG5mdW5jdGlvbiBjbGFtcCAoaW5kZXgsIGxlbiwgZGVmYXVsdFZhbHVlKSB7XG4gIGlmICh0eXBlb2YgaW5kZXggIT09ICdudW1iZXInKSByZXR1cm4gZGVmYXVsdFZhbHVlXG4gIGluZGV4ID0gfn5pbmRleDsgIC8vIENvZXJjZSB0byBpbnRlZ2VyLlxuICBpZiAoaW5kZXggPj0gbGVuKSByZXR1cm4gbGVuXG4gIGlmIChpbmRleCA+PSAwKSByZXR1cm4gaW5kZXhcbiAgaW5kZXggKz0gbGVuXG4gIGlmIChpbmRleCA+PSAwKSByZXR1cm4gaW5kZXhcbiAgcmV0dXJuIDBcbn1cblxuZnVuY3Rpb24gY29lcmNlIChsZW5ndGgpIHtcbiAgLy8gQ29lcmNlIGxlbmd0aCB0byBhIG51bWJlciAocG9zc2libHkgTmFOKSwgcm91bmQgdXBcbiAgLy8gaW4gY2FzZSBpdCdzIGZyYWN0aW9uYWwgKGUuZy4gMTIzLjQ1NikgdGhlbiBkbyBhXG4gIC8vIGRvdWJsZSBuZWdhdGUgdG8gY29lcmNlIGEgTmFOIHRvIDAuIEVhc3ksIHJpZ2h0P1xuICBsZW5ndGggPSB+fk1hdGguY2VpbCgrbGVuZ3RoKVxuICByZXR1cm4gbGVuZ3RoIDwgMCA/IDAgOiBsZW5ndGhcbn1cblxuZnVuY3Rpb24gaXNBcnJheSAoc3ViamVjdCkge1xuICByZXR1cm4gKEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24gKHN1YmplY3QpIHtcbiAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHN1YmplY3QpID09PSAnW29iamVjdCBBcnJheV0nXG4gIH0pKHN1YmplY3QpXG59XG5cbmZ1bmN0aW9uIGlzQXJyYXlpc2ggKHN1YmplY3QpIHtcbiAgcmV0dXJuIGlzQXJyYXkoc3ViamVjdCkgfHwgQnVmZmVyLmlzQnVmZmVyKHN1YmplY3QpIHx8XG4gICAgICBzdWJqZWN0ICYmIHR5cGVvZiBzdWJqZWN0ID09PSAnb2JqZWN0JyAmJlxuICAgICAgdHlwZW9mIHN1YmplY3QubGVuZ3RoID09PSAnbnVtYmVyJ1xufVxuXG5mdW5jdGlvbiB0b0hleCAobikge1xuICBpZiAobiA8IDE2KSByZXR1cm4gJzAnICsgbi50b1N0cmluZygxNilcbiAgcmV0dXJuIG4udG9TdHJpbmcoMTYpXG59XG5cbmZ1bmN0aW9uIHV0ZjhUb0J5dGVzIChzdHIpIHtcbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGIgPSBzdHIuY2hhckNvZGVBdChpKVxuICAgIGlmIChiIDw9IDB4N0YpXG4gICAgICBieXRlQXJyYXkucHVzaChzdHIuY2hhckNvZGVBdChpKSlcbiAgICBlbHNlIHtcbiAgICAgIHZhciBzdGFydCA9IGlcbiAgICAgIGlmIChiID49IDB4RDgwMCAmJiBiIDw9IDB4REZGRikgaSsrXG4gICAgICB2YXIgaCA9IGVuY29kZVVSSUNvbXBvbmVudChzdHIuc2xpY2Uoc3RhcnQsIGkrMSkpLnN1YnN0cigxKS5zcGxpdCgnJScpXG4gICAgICBmb3IgKHZhciBqID0gMDsgaiA8IGgubGVuZ3RoOyBqKyspXG4gICAgICAgIGJ5dGVBcnJheS5wdXNoKHBhcnNlSW50KGhbal0sIDE2KSlcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiBhc2NpaVRvQnl0ZXMgKHN0cikge1xuICB2YXIgYnl0ZUFycmF5ID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICAvLyBOb2RlJ3MgY29kZSBzZWVtcyB0byBiZSBkb2luZyB0aGlzIGFuZCBub3QgJiAweDdGLi5cbiAgICBieXRlQXJyYXkucHVzaChzdHIuY2hhckNvZGVBdChpKSAmIDB4RkYpXG4gIH1cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiB1dGYxNmxlVG9CeXRlcyAoc3RyKSB7XG4gIHZhciBjLCBoaSwgbG9cbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgYyA9IHN0ci5jaGFyQ29kZUF0KGkpXG4gICAgaGkgPSBjID4+IDhcbiAgICBsbyA9IGMgJSAyNTZcbiAgICBieXRlQXJyYXkucHVzaChsbylcbiAgICBieXRlQXJyYXkucHVzaChoaSlcbiAgfVxuXG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gYmFzZTY0VG9CeXRlcyAoc3RyKSB7XG4gIHJldHVybiBiYXNlNjQudG9CeXRlQXJyYXkoc3RyKVxufVxuXG5mdW5jdGlvbiBibGl0QnVmZmVyIChzcmMsIGRzdCwgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgdmFyIHBvc1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKChpICsgb2Zmc2V0ID49IGRzdC5sZW5ndGgpIHx8IChpID49IHNyYy5sZW5ndGgpKVxuICAgICAgYnJlYWtcbiAgICBkc3RbaSArIG9mZnNldF0gPSBzcmNbaV1cbiAgfVxuICByZXR1cm4gaVxufVxuXG5mdW5jdGlvbiBkZWNvZGVVdGY4Q2hhciAoc3RyKSB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIGRlY29kZVVSSUNvbXBvbmVudChzdHIpXG4gIH0gY2F0Y2ggKGVycikge1xuICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKDB4RkZGRCkgLy8gVVRGIDggaW52YWxpZCBjaGFyXG4gIH1cbn1cblxuLypcbiAqIFdlIGhhdmUgdG8gbWFrZSBzdXJlIHRoYXQgdGhlIHZhbHVlIGlzIGEgdmFsaWQgaW50ZWdlci4gVGhpcyBtZWFucyB0aGF0IGl0XG4gKiBpcyBub24tbmVnYXRpdmUuIEl0IGhhcyBubyBmcmFjdGlvbmFsIGNvbXBvbmVudCBhbmQgdGhhdCBpdCBkb2VzIG5vdFxuICogZXhjZWVkIHRoZSBtYXhpbXVtIGFsbG93ZWQgdmFsdWUuXG4gKi9cbmZ1bmN0aW9uIHZlcmlmdWludCAodmFsdWUsIG1heCkge1xuICBhc3NlcnQodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJywgJ2Nhbm5vdCB3cml0ZSBhIG5vbi1udW1iZXIgYXMgYSBudW1iZXInKVxuICBhc3NlcnQodmFsdWUgPj0gMCwgJ3NwZWNpZmllZCBhIG5lZ2F0aXZlIHZhbHVlIGZvciB3cml0aW5nIGFuIHVuc2lnbmVkIHZhbHVlJylcbiAgYXNzZXJ0KHZhbHVlIDw9IG1heCwgJ3ZhbHVlIGlzIGxhcmdlciB0aGFuIG1heGltdW0gdmFsdWUgZm9yIHR5cGUnKVxuICBhc3NlcnQoTWF0aC5mbG9vcih2YWx1ZSkgPT09IHZhbHVlLCAndmFsdWUgaGFzIGEgZnJhY3Rpb25hbCBjb21wb25lbnQnKVxufVxuXG5mdW5jdGlvbiB2ZXJpZnNpbnQgKHZhbHVlLCBtYXgsIG1pbikge1xuICBhc3NlcnQodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJywgJ2Nhbm5vdCB3cml0ZSBhIG5vbi1udW1iZXIgYXMgYSBudW1iZXInKVxuICBhc3NlcnQodmFsdWUgPD0gbWF4LCAndmFsdWUgbGFyZ2VyIHRoYW4gbWF4aW11bSBhbGxvd2VkIHZhbHVlJylcbiAgYXNzZXJ0KHZhbHVlID49IG1pbiwgJ3ZhbHVlIHNtYWxsZXIgdGhhbiBtaW5pbXVtIGFsbG93ZWQgdmFsdWUnKVxuICBhc3NlcnQoTWF0aC5mbG9vcih2YWx1ZSkgPT09IHZhbHVlLCAndmFsdWUgaGFzIGEgZnJhY3Rpb25hbCBjb21wb25lbnQnKVxufVxuXG5mdW5jdGlvbiB2ZXJpZklFRUU3NTQgKHZhbHVlLCBtYXgsIG1pbikge1xuICBhc3NlcnQodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJywgJ2Nhbm5vdCB3cml0ZSBhIG5vbi1udW1iZXIgYXMgYSBudW1iZXInKVxuICBhc3NlcnQodmFsdWUgPD0gbWF4LCAndmFsdWUgbGFyZ2VyIHRoYW4gbWF4aW11bSBhbGxvd2VkIHZhbHVlJylcbiAgYXNzZXJ0KHZhbHVlID49IG1pbiwgJ3ZhbHVlIHNtYWxsZXIgdGhhbiBtaW5pbXVtIGFsbG93ZWQgdmFsdWUnKVxufVxuXG5mdW5jdGlvbiBhc3NlcnQgKHRlc3QsIG1lc3NhZ2UpIHtcbiAgaWYgKCF0ZXN0KSB0aHJvdyBuZXcgRXJyb3IobWVzc2FnZSB8fCAnRmFpbGVkIGFzc2VydGlvbicpXG59XG4iLCJ2YXIgbG9va3VwID0gJ0FCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5Ky8nO1xuXG47KGZ1bmN0aW9uIChleHBvcnRzKSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuICB2YXIgQXJyID0gKHR5cGVvZiBVaW50OEFycmF5ICE9PSAndW5kZWZpbmVkJylcbiAgICA/IFVpbnQ4QXJyYXlcbiAgICA6IEFycmF5XG5cblx0dmFyIFBMVVMgICA9ICcrJy5jaGFyQ29kZUF0KDApXG5cdHZhciBTTEFTSCAgPSAnLycuY2hhckNvZGVBdCgwKVxuXHR2YXIgTlVNQkVSID0gJzAnLmNoYXJDb2RlQXQoMClcblx0dmFyIExPV0VSICA9ICdhJy5jaGFyQ29kZUF0KDApXG5cdHZhciBVUFBFUiAgPSAnQScuY2hhckNvZGVBdCgwKVxuXHR2YXIgUExVU19VUkxfU0FGRSA9ICctJy5jaGFyQ29kZUF0KDApXG5cdHZhciBTTEFTSF9VUkxfU0FGRSA9ICdfJy5jaGFyQ29kZUF0KDApXG5cblx0ZnVuY3Rpb24gZGVjb2RlIChlbHQpIHtcblx0XHR2YXIgY29kZSA9IGVsdC5jaGFyQ29kZUF0KDApXG5cdFx0aWYgKGNvZGUgPT09IFBMVVMgfHxcblx0XHQgICAgY29kZSA9PT0gUExVU19VUkxfU0FGRSlcblx0XHRcdHJldHVybiA2MiAvLyAnKydcblx0XHRpZiAoY29kZSA9PT0gU0xBU0ggfHxcblx0XHQgICAgY29kZSA9PT0gU0xBU0hfVVJMX1NBRkUpXG5cdFx0XHRyZXR1cm4gNjMgLy8gJy8nXG5cdFx0aWYgKGNvZGUgPCBOVU1CRVIpXG5cdFx0XHRyZXR1cm4gLTEgLy9ubyBtYXRjaFxuXHRcdGlmIChjb2RlIDwgTlVNQkVSICsgMTApXG5cdFx0XHRyZXR1cm4gY29kZSAtIE5VTUJFUiArIDI2ICsgMjZcblx0XHRpZiAoY29kZSA8IFVQUEVSICsgMjYpXG5cdFx0XHRyZXR1cm4gY29kZSAtIFVQUEVSXG5cdFx0aWYgKGNvZGUgPCBMT1dFUiArIDI2KVxuXHRcdFx0cmV0dXJuIGNvZGUgLSBMT1dFUiArIDI2XG5cdH1cblxuXHRmdW5jdGlvbiBiNjRUb0J5dGVBcnJheSAoYjY0KSB7XG5cdFx0dmFyIGksIGosIGwsIHRtcCwgcGxhY2VIb2xkZXJzLCBhcnJcblxuXHRcdGlmIChiNjQubGVuZ3RoICUgNCA+IDApIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBzdHJpbmcuIExlbmd0aCBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgNCcpXG5cdFx0fVxuXG5cdFx0Ly8gdGhlIG51bWJlciBvZiBlcXVhbCBzaWducyAocGxhY2UgaG9sZGVycylcblx0XHQvLyBpZiB0aGVyZSBhcmUgdHdvIHBsYWNlaG9sZGVycywgdGhhbiB0aGUgdHdvIGNoYXJhY3RlcnMgYmVmb3JlIGl0XG5cdFx0Ly8gcmVwcmVzZW50IG9uZSBieXRlXG5cdFx0Ly8gaWYgdGhlcmUgaXMgb25seSBvbmUsIHRoZW4gdGhlIHRocmVlIGNoYXJhY3RlcnMgYmVmb3JlIGl0IHJlcHJlc2VudCAyIGJ5dGVzXG5cdFx0Ly8gdGhpcyBpcyBqdXN0IGEgY2hlYXAgaGFjayB0byBub3QgZG8gaW5kZXhPZiB0d2ljZVxuXHRcdHZhciBsZW4gPSBiNjQubGVuZ3RoXG5cdFx0cGxhY2VIb2xkZXJzID0gJz0nID09PSBiNjQuY2hhckF0KGxlbiAtIDIpID8gMiA6ICc9JyA9PT0gYjY0LmNoYXJBdChsZW4gLSAxKSA/IDEgOiAwXG5cblx0XHQvLyBiYXNlNjQgaXMgNC8zICsgdXAgdG8gdHdvIGNoYXJhY3RlcnMgb2YgdGhlIG9yaWdpbmFsIGRhdGFcblx0XHRhcnIgPSBuZXcgQXJyKGI2NC5sZW5ndGggKiAzIC8gNCAtIHBsYWNlSG9sZGVycylcblxuXHRcdC8vIGlmIHRoZXJlIGFyZSBwbGFjZWhvbGRlcnMsIG9ubHkgZ2V0IHVwIHRvIHRoZSBsYXN0IGNvbXBsZXRlIDQgY2hhcnNcblx0XHRsID0gcGxhY2VIb2xkZXJzID4gMCA/IGI2NC5sZW5ndGggLSA0IDogYjY0Lmxlbmd0aFxuXG5cdFx0dmFyIEwgPSAwXG5cblx0XHRmdW5jdGlvbiBwdXNoICh2KSB7XG5cdFx0XHRhcnJbTCsrXSA9IHZcblx0XHR9XG5cblx0XHRmb3IgKGkgPSAwLCBqID0gMDsgaSA8IGw7IGkgKz0gNCwgaiArPSAzKSB7XG5cdFx0XHR0bXAgPSAoZGVjb2RlKGI2NC5jaGFyQXQoaSkpIDw8IDE4KSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMSkpIDw8IDEyKSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMikpIDw8IDYpIHwgZGVjb2RlKGI2NC5jaGFyQXQoaSArIDMpKVxuXHRcdFx0cHVzaCgodG1wICYgMHhGRjAwMDApID4+IDE2KVxuXHRcdFx0cHVzaCgodG1wICYgMHhGRjAwKSA+PiA4KVxuXHRcdFx0cHVzaCh0bXAgJiAweEZGKVxuXHRcdH1cblxuXHRcdGlmIChwbGFjZUhvbGRlcnMgPT09IDIpIHtcblx0XHRcdHRtcCA9IChkZWNvZGUoYjY0LmNoYXJBdChpKSkgPDwgMikgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDEpKSA+PiA0KVxuXHRcdFx0cHVzaCh0bXAgJiAweEZGKVxuXHRcdH0gZWxzZSBpZiAocGxhY2VIb2xkZXJzID09PSAxKSB7XG5cdFx0XHR0bXAgPSAoZGVjb2RlKGI2NC5jaGFyQXQoaSkpIDw8IDEwKSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMSkpIDw8IDQpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAyKSkgPj4gMilcblx0XHRcdHB1c2goKHRtcCA+PiA4KSAmIDB4RkYpXG5cdFx0XHRwdXNoKHRtcCAmIDB4RkYpXG5cdFx0fVxuXG5cdFx0cmV0dXJuIGFyclxuXHR9XG5cblx0ZnVuY3Rpb24gdWludDhUb0Jhc2U2NCAodWludDgpIHtcblx0XHR2YXIgaSxcblx0XHRcdGV4dHJhQnl0ZXMgPSB1aW50OC5sZW5ndGggJSAzLCAvLyBpZiB3ZSBoYXZlIDEgYnl0ZSBsZWZ0LCBwYWQgMiBieXRlc1xuXHRcdFx0b3V0cHV0ID0gXCJcIixcblx0XHRcdHRlbXAsIGxlbmd0aFxuXG5cdFx0ZnVuY3Rpb24gZW5jb2RlIChudW0pIHtcblx0XHRcdHJldHVybiBsb29rdXAuY2hhckF0KG51bSlcblx0XHR9XG5cblx0XHRmdW5jdGlvbiB0cmlwbGV0VG9CYXNlNjQgKG51bSkge1xuXHRcdFx0cmV0dXJuIGVuY29kZShudW0gPj4gMTggJiAweDNGKSArIGVuY29kZShudW0gPj4gMTIgJiAweDNGKSArIGVuY29kZShudW0gPj4gNiAmIDB4M0YpICsgZW5jb2RlKG51bSAmIDB4M0YpXG5cdFx0fVxuXG5cdFx0Ly8gZ28gdGhyb3VnaCB0aGUgYXJyYXkgZXZlcnkgdGhyZWUgYnl0ZXMsIHdlJ2xsIGRlYWwgd2l0aCB0cmFpbGluZyBzdHVmZiBsYXRlclxuXHRcdGZvciAoaSA9IDAsIGxlbmd0aCA9IHVpbnQ4Lmxlbmd0aCAtIGV4dHJhQnl0ZXM7IGkgPCBsZW5ndGg7IGkgKz0gMykge1xuXHRcdFx0dGVtcCA9ICh1aW50OFtpXSA8PCAxNikgKyAodWludDhbaSArIDFdIDw8IDgpICsgKHVpbnQ4W2kgKyAyXSlcblx0XHRcdG91dHB1dCArPSB0cmlwbGV0VG9CYXNlNjQodGVtcClcblx0XHR9XG5cblx0XHQvLyBwYWQgdGhlIGVuZCB3aXRoIHplcm9zLCBidXQgbWFrZSBzdXJlIHRvIG5vdCBmb3JnZXQgdGhlIGV4dHJhIGJ5dGVzXG5cdFx0c3dpdGNoIChleHRyYUJ5dGVzKSB7XG5cdFx0XHRjYXNlIDE6XG5cdFx0XHRcdHRlbXAgPSB1aW50OFt1aW50OC5sZW5ndGggLSAxXVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKHRlbXAgPj4gMilcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSgodGVtcCA8PCA0KSAmIDB4M0YpXG5cdFx0XHRcdG91dHB1dCArPSAnPT0nXG5cdFx0XHRcdGJyZWFrXG5cdFx0XHRjYXNlIDI6XG5cdFx0XHRcdHRlbXAgPSAodWludDhbdWludDgubGVuZ3RoIC0gMl0gPDwgOCkgKyAodWludDhbdWludDgubGVuZ3RoIC0gMV0pXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUodGVtcCA+PiAxMClcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSgodGVtcCA+PiA0KSAmIDB4M0YpXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUoKHRlbXAgPDwgMikgJiAweDNGKVxuXHRcdFx0XHRvdXRwdXQgKz0gJz0nXG5cdFx0XHRcdGJyZWFrXG5cdFx0fVxuXG5cdFx0cmV0dXJuIG91dHB1dFxuXHR9XG5cblx0ZXhwb3J0cy50b0J5dGVBcnJheSA9IGI2NFRvQnl0ZUFycmF5XG5cdGV4cG9ydHMuZnJvbUJ5dGVBcnJheSA9IHVpbnQ4VG9CYXNlNjRcbn0odHlwZW9mIGV4cG9ydHMgPT09ICd1bmRlZmluZWQnID8gKHRoaXMuYmFzZTY0anMgPSB7fSkgOiBleHBvcnRzKSlcbiIsImV4cG9ydHMucmVhZCA9IGZ1bmN0aW9uKGJ1ZmZlciwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG0sXG4gICAgICBlTGVuID0gbkJ5dGVzICogOCAtIG1MZW4gLSAxLFxuICAgICAgZU1heCA9ICgxIDw8IGVMZW4pIC0gMSxcbiAgICAgIGVCaWFzID0gZU1heCA+PiAxLFxuICAgICAgbkJpdHMgPSAtNyxcbiAgICAgIGkgPSBpc0xFID8gKG5CeXRlcyAtIDEpIDogMCxcbiAgICAgIGQgPSBpc0xFID8gLTEgOiAxLFxuICAgICAgcyA9IGJ1ZmZlcltvZmZzZXQgKyBpXTtcblxuICBpICs9IGQ7XG5cbiAgZSA9IHMgJiAoKDEgPDwgKC1uQml0cykpIC0gMSk7XG4gIHMgPj49ICgtbkJpdHMpO1xuICBuQml0cyArPSBlTGVuO1xuICBmb3IgKDsgbkJpdHMgPiAwOyBlID0gZSAqIDI1NiArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KTtcblxuICBtID0gZSAmICgoMSA8PCAoLW5CaXRzKSkgLSAxKTtcbiAgZSA+Pj0gKC1uQml0cyk7XG4gIG5CaXRzICs9IG1MZW47XG4gIGZvciAoOyBuQml0cyA+IDA7IG0gPSBtICogMjU2ICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpO1xuXG4gIGlmIChlID09PSAwKSB7XG4gICAgZSA9IDEgLSBlQmlhcztcbiAgfSBlbHNlIGlmIChlID09PSBlTWF4KSB7XG4gICAgcmV0dXJuIG0gPyBOYU4gOiAoKHMgPyAtMSA6IDEpICogSW5maW5pdHkpO1xuICB9IGVsc2Uge1xuICAgIG0gPSBtICsgTWF0aC5wb3coMiwgbUxlbik7XG4gICAgZSA9IGUgLSBlQmlhcztcbiAgfVxuICByZXR1cm4gKHMgPyAtMSA6IDEpICogbSAqIE1hdGgucG93KDIsIGUgLSBtTGVuKTtcbn07XG5cbmV4cG9ydHMud3JpdGUgPSBmdW5jdGlvbihidWZmZXIsIHZhbHVlLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbSwgYyxcbiAgICAgIGVMZW4gPSBuQnl0ZXMgKiA4IC0gbUxlbiAtIDEsXG4gICAgICBlTWF4ID0gKDEgPDwgZUxlbikgLSAxLFxuICAgICAgZUJpYXMgPSBlTWF4ID4+IDEsXG4gICAgICBydCA9IChtTGVuID09PSAyMyA/IE1hdGgucG93KDIsIC0yNCkgLSBNYXRoLnBvdygyLCAtNzcpIDogMCksXG4gICAgICBpID0gaXNMRSA/IDAgOiAobkJ5dGVzIC0gMSksXG4gICAgICBkID0gaXNMRSA/IDEgOiAtMSxcbiAgICAgIHMgPSB2YWx1ZSA8IDAgfHwgKHZhbHVlID09PSAwICYmIDEgLyB2YWx1ZSA8IDApID8gMSA6IDA7XG5cbiAgdmFsdWUgPSBNYXRoLmFicyh2YWx1ZSk7XG5cbiAgaWYgKGlzTmFOKHZhbHVlKSB8fCB2YWx1ZSA9PT0gSW5maW5pdHkpIHtcbiAgICBtID0gaXNOYU4odmFsdWUpID8gMSA6IDA7XG4gICAgZSA9IGVNYXg7XG4gIH0gZWxzZSB7XG4gICAgZSA9IE1hdGguZmxvb3IoTWF0aC5sb2codmFsdWUpIC8gTWF0aC5MTjIpO1xuICAgIGlmICh2YWx1ZSAqIChjID0gTWF0aC5wb3coMiwgLWUpKSA8IDEpIHtcbiAgICAgIGUtLTtcbiAgICAgIGMgKj0gMjtcbiAgICB9XG4gICAgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICB2YWx1ZSArPSBydCAvIGM7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbHVlICs9IHJ0ICogTWF0aC5wb3coMiwgMSAtIGVCaWFzKTtcbiAgICB9XG4gICAgaWYgKHZhbHVlICogYyA+PSAyKSB7XG4gICAgICBlKys7XG4gICAgICBjIC89IDI7XG4gICAgfVxuXG4gICAgaWYgKGUgKyBlQmlhcyA+PSBlTWF4KSB7XG4gICAgICBtID0gMDtcbiAgICAgIGUgPSBlTWF4O1xuICAgIH0gZWxzZSBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIG0gPSAodmFsdWUgKiBjIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKTtcbiAgICAgIGUgPSBlICsgZUJpYXM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSB2YWx1ZSAqIE1hdGgucG93KDIsIGVCaWFzIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKTtcbiAgICAgIGUgPSAwO1xuICAgIH1cbiAgfVxuXG4gIGZvciAoOyBtTGVuID49IDg7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IG0gJiAweGZmLCBpICs9IGQsIG0gLz0gMjU2LCBtTGVuIC09IDgpO1xuXG4gIGUgPSAoZSA8PCBtTGVuKSB8IG07XG4gIGVMZW4gKz0gbUxlbjtcbiAgZm9yICg7IGVMZW4gPiAwOyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBlICYgMHhmZiwgaSArPSBkLCBlIC89IDI1NiwgZUxlbiAtPSA4KTtcblxuICBidWZmZXJbb2Zmc2V0ICsgaSAtIGRdIHw9IHMgKiAxMjg7XG59O1xuIiwidmFyIEJ1ZmZlciA9IHJlcXVpcmUoJ2J1ZmZlcicpLkJ1ZmZlcjtcbnZhciBpbnRTaXplID0gNDtcbnZhciB6ZXJvQnVmZmVyID0gbmV3IEJ1ZmZlcihpbnRTaXplKTsgemVyb0J1ZmZlci5maWxsKDApO1xudmFyIGNocnN6ID0gODtcblxuZnVuY3Rpb24gdG9BcnJheShidWYsIGJpZ0VuZGlhbikge1xuICBpZiAoKGJ1Zi5sZW5ndGggJSBpbnRTaXplKSAhPT0gMCkge1xuICAgIHZhciBsZW4gPSBidWYubGVuZ3RoICsgKGludFNpemUgLSAoYnVmLmxlbmd0aCAlIGludFNpemUpKTtcbiAgICBidWYgPSBCdWZmZXIuY29uY2F0KFtidWYsIHplcm9CdWZmZXJdLCBsZW4pO1xuICB9XG5cbiAgdmFyIGFyciA9IFtdO1xuICB2YXIgZm4gPSBiaWdFbmRpYW4gPyBidWYucmVhZEludDMyQkUgOiBidWYucmVhZEludDMyTEU7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYnVmLmxlbmd0aDsgaSArPSBpbnRTaXplKSB7XG4gICAgYXJyLnB1c2goZm4uY2FsbChidWYsIGkpKTtcbiAgfVxuICByZXR1cm4gYXJyO1xufVxuXG5mdW5jdGlvbiB0b0J1ZmZlcihhcnIsIHNpemUsIGJpZ0VuZGlhbikge1xuICB2YXIgYnVmID0gbmV3IEJ1ZmZlcihzaXplKTtcbiAgdmFyIGZuID0gYmlnRW5kaWFuID8gYnVmLndyaXRlSW50MzJCRSA6IGJ1Zi53cml0ZUludDMyTEU7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYXJyLmxlbmd0aDsgaSsrKSB7XG4gICAgZm4uY2FsbChidWYsIGFycltpXSwgaSAqIDQsIHRydWUpO1xuICB9XG4gIHJldHVybiBidWY7XG59XG5cbmZ1bmN0aW9uIGhhc2goYnVmLCBmbiwgaGFzaFNpemUsIGJpZ0VuZGlhbikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihidWYpKSBidWYgPSBuZXcgQnVmZmVyKGJ1Zik7XG4gIHZhciBhcnIgPSBmbih0b0FycmF5KGJ1ZiwgYmlnRW5kaWFuKSwgYnVmLmxlbmd0aCAqIGNocnN6KTtcbiAgcmV0dXJuIHRvQnVmZmVyKGFyciwgaGFzaFNpemUsIGJpZ0VuZGlhbik7XG59XG5cbm1vZHVsZS5leHBvcnRzID0geyBoYXNoOiBoYXNoIH07XG4iLCJ2YXIgQnVmZmVyID0gcmVxdWlyZSgnYnVmZmVyJykuQnVmZmVyXG52YXIgc2hhID0gcmVxdWlyZSgnLi9zaGEnKVxudmFyIHNoYTI1NiA9IHJlcXVpcmUoJy4vc2hhMjU2JylcbnZhciBybmcgPSByZXF1aXJlKCcuL3JuZycpXG52YXIgbWQ1ID0gcmVxdWlyZSgnLi9tZDUnKVxuXG52YXIgYWxnb3JpdGhtcyA9IHtcbiAgc2hhMTogc2hhLFxuICBzaGEyNTY6IHNoYTI1NixcbiAgbWQ1OiBtZDVcbn1cblxudmFyIGJsb2Nrc2l6ZSA9IDY0XG52YXIgemVyb0J1ZmZlciA9IG5ldyBCdWZmZXIoYmxvY2tzaXplKTsgemVyb0J1ZmZlci5maWxsKDApXG5mdW5jdGlvbiBobWFjKGZuLCBrZXksIGRhdGEpIHtcbiAgaWYoIUJ1ZmZlci5pc0J1ZmZlcihrZXkpKSBrZXkgPSBuZXcgQnVmZmVyKGtleSlcbiAgaWYoIUJ1ZmZlci5pc0J1ZmZlcihkYXRhKSkgZGF0YSA9IG5ldyBCdWZmZXIoZGF0YSlcblxuICBpZihrZXkubGVuZ3RoID4gYmxvY2tzaXplKSB7XG4gICAga2V5ID0gZm4oa2V5KVxuICB9IGVsc2UgaWYoa2V5Lmxlbmd0aCA8IGJsb2Nrc2l6ZSkge1xuICAgIGtleSA9IEJ1ZmZlci5jb25jYXQoW2tleSwgemVyb0J1ZmZlcl0sIGJsb2Nrc2l6ZSlcbiAgfVxuXG4gIHZhciBpcGFkID0gbmV3IEJ1ZmZlcihibG9ja3NpemUpLCBvcGFkID0gbmV3IEJ1ZmZlcihibG9ja3NpemUpXG4gIGZvcih2YXIgaSA9IDA7IGkgPCBibG9ja3NpemU7IGkrKykge1xuICAgIGlwYWRbaV0gPSBrZXlbaV0gXiAweDM2XG4gICAgb3BhZFtpXSA9IGtleVtpXSBeIDB4NUNcbiAgfVxuXG4gIHZhciBoYXNoID0gZm4oQnVmZmVyLmNvbmNhdChbaXBhZCwgZGF0YV0pKVxuICByZXR1cm4gZm4oQnVmZmVyLmNvbmNhdChbb3BhZCwgaGFzaF0pKVxufVxuXG5mdW5jdGlvbiBoYXNoKGFsZywga2V5KSB7XG4gIGFsZyA9IGFsZyB8fCAnc2hhMSdcbiAgdmFyIGZuID0gYWxnb3JpdGhtc1thbGddXG4gIHZhciBidWZzID0gW11cbiAgdmFyIGxlbmd0aCA9IDBcbiAgaWYoIWZuKSBlcnJvcignYWxnb3JpdGhtOicsIGFsZywgJ2lzIG5vdCB5ZXQgc3VwcG9ydGVkJylcbiAgcmV0dXJuIHtcbiAgICB1cGRhdGU6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICBpZighQnVmZmVyLmlzQnVmZmVyKGRhdGEpKSBkYXRhID0gbmV3IEJ1ZmZlcihkYXRhKVxuICAgICAgICBcbiAgICAgIGJ1ZnMucHVzaChkYXRhKVxuICAgICAgbGVuZ3RoICs9IGRhdGEubGVuZ3RoXG4gICAgICByZXR1cm4gdGhpc1xuICAgIH0sXG4gICAgZGlnZXN0OiBmdW5jdGlvbiAoZW5jKSB7XG4gICAgICB2YXIgYnVmID0gQnVmZmVyLmNvbmNhdChidWZzKVxuICAgICAgdmFyIHIgPSBrZXkgPyBobWFjKGZuLCBrZXksIGJ1ZikgOiBmbihidWYpXG4gICAgICBidWZzID0gbnVsbFxuICAgICAgcmV0dXJuIGVuYyA/IHIudG9TdHJpbmcoZW5jKSA6IHJcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gZXJyb3IgKCkge1xuICB2YXIgbSA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzKS5qb2luKCcgJylcbiAgdGhyb3cgbmV3IEVycm9yKFtcbiAgICBtLFxuICAgICd3ZSBhY2NlcHQgcHVsbCByZXF1ZXN0cycsXG4gICAgJ2h0dHA6Ly9naXRodWIuY29tL2RvbWluaWN0YXJyL2NyeXB0by1icm93c2VyaWZ5J1xuICAgIF0uam9pbignXFxuJykpXG59XG5cbmV4cG9ydHMuY3JlYXRlSGFzaCA9IGZ1bmN0aW9uIChhbGcpIHsgcmV0dXJuIGhhc2goYWxnKSB9XG5leHBvcnRzLmNyZWF0ZUhtYWMgPSBmdW5jdGlvbiAoYWxnLCBrZXkpIHsgcmV0dXJuIGhhc2goYWxnLCBrZXkpIH1cbmV4cG9ydHMucmFuZG9tQnl0ZXMgPSBmdW5jdGlvbihzaXplLCBjYWxsYmFjaykge1xuICBpZiAoY2FsbGJhY2sgJiYgY2FsbGJhY2suY2FsbCkge1xuICAgIHRyeSB7XG4gICAgICBjYWxsYmFjay5jYWxsKHRoaXMsIHVuZGVmaW5lZCwgbmV3IEJ1ZmZlcihybmcoc2l6ZSkpKVxuICAgIH0gY2F0Y2ggKGVycikgeyBjYWxsYmFjayhlcnIpIH1cbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbmV3IEJ1ZmZlcihybmcoc2l6ZSkpXG4gIH1cbn1cblxuZnVuY3Rpb24gZWFjaChhLCBmKSB7XG4gIGZvcih2YXIgaSBpbiBhKVxuICAgIGYoYVtpXSwgaSlcbn1cblxuLy8gdGhlIGxlYXN0IEkgY2FuIGRvIGlzIG1ha2UgZXJyb3IgbWVzc2FnZXMgZm9yIHRoZSByZXN0IG9mIHRoZSBub2RlLmpzL2NyeXB0byBhcGkuXG5lYWNoKFsnY3JlYXRlQ3JlZGVudGlhbHMnXG4sICdjcmVhdGVDaXBoZXInXG4sICdjcmVhdGVDaXBoZXJpdidcbiwgJ2NyZWF0ZURlY2lwaGVyJ1xuLCAnY3JlYXRlRGVjaXBoZXJpdidcbiwgJ2NyZWF0ZVNpZ24nXG4sICdjcmVhdGVWZXJpZnknXG4sICdjcmVhdGVEaWZmaWVIZWxsbWFuJ1xuLCAncGJrZGYyJ10sIGZ1bmN0aW9uIChuYW1lKSB7XG4gIGV4cG9ydHNbbmFtZV0gPSBmdW5jdGlvbiAoKSB7XG4gICAgZXJyb3IoJ3NvcnJ5LCcsIG5hbWUsICdpcyBub3QgaW1wbGVtZW50ZWQgeWV0JylcbiAgfVxufSlcbiIsIi8qXHJcbiAqIEEgSmF2YVNjcmlwdCBpbXBsZW1lbnRhdGlvbiBvZiB0aGUgUlNBIERhdGEgU2VjdXJpdHksIEluYy4gTUQ1IE1lc3NhZ2VcclxuICogRGlnZXN0IEFsZ29yaXRobSwgYXMgZGVmaW5lZCBpbiBSRkMgMTMyMS5cclxuICogVmVyc2lvbiAyLjEgQ29weXJpZ2h0IChDKSBQYXVsIEpvaG5zdG9uIDE5OTkgLSAyMDAyLlxyXG4gKiBPdGhlciBjb250cmlidXRvcnM6IEdyZWcgSG9sdCwgQW5kcmV3IEtlcGVydCwgWWRuYXIsIExvc3RpbmV0XHJcbiAqIERpc3RyaWJ1dGVkIHVuZGVyIHRoZSBCU0QgTGljZW5zZVxyXG4gKiBTZWUgaHR0cDovL3BhamhvbWUub3JnLnVrL2NyeXB0L21kNSBmb3IgbW9yZSBpbmZvLlxyXG4gKi9cclxuXHJcbnZhciBoZWxwZXJzID0gcmVxdWlyZSgnLi9oZWxwZXJzJyk7XHJcblxyXG4vKlxyXG4gKiBQZXJmb3JtIGEgc2ltcGxlIHNlbGYtdGVzdCB0byBzZWUgaWYgdGhlIFZNIGlzIHdvcmtpbmdcclxuICovXHJcbmZ1bmN0aW9uIG1kNV92bV90ZXN0KClcclxue1xyXG4gIHJldHVybiBoZXhfbWQ1KFwiYWJjXCIpID09IFwiOTAwMTUwOTgzY2QyNGZiMGQ2OTYzZjdkMjhlMTdmNzJcIjtcclxufVxyXG5cclxuLypcclxuICogQ2FsY3VsYXRlIHRoZSBNRDUgb2YgYW4gYXJyYXkgb2YgbGl0dGxlLWVuZGlhbiB3b3JkcywgYW5kIGEgYml0IGxlbmd0aFxyXG4gKi9cclxuZnVuY3Rpb24gY29yZV9tZDUoeCwgbGVuKVxyXG57XHJcbiAgLyogYXBwZW5kIHBhZGRpbmcgKi9cclxuICB4W2xlbiA+PiA1XSB8PSAweDgwIDw8ICgobGVuKSAlIDMyKTtcclxuICB4WygoKGxlbiArIDY0KSA+Pj4gOSkgPDwgNCkgKyAxNF0gPSBsZW47XHJcblxyXG4gIHZhciBhID0gIDE3MzI1ODQxOTM7XHJcbiAgdmFyIGIgPSAtMjcxNzMzODc5O1xyXG4gIHZhciBjID0gLTE3MzI1ODQxOTQ7XHJcbiAgdmFyIGQgPSAgMjcxNzMzODc4O1xyXG5cclxuICBmb3IodmFyIGkgPSAwOyBpIDwgeC5sZW5ndGg7IGkgKz0gMTYpXHJcbiAge1xyXG4gICAgdmFyIG9sZGEgPSBhO1xyXG4gICAgdmFyIG9sZGIgPSBiO1xyXG4gICAgdmFyIG9sZGMgPSBjO1xyXG4gICAgdmFyIG9sZGQgPSBkO1xyXG5cclxuICAgIGEgPSBtZDVfZmYoYSwgYiwgYywgZCwgeFtpKyAwXSwgNyAsIC02ODA4NzY5MzYpO1xyXG4gICAgZCA9IG1kNV9mZihkLCBhLCBiLCBjLCB4W2krIDFdLCAxMiwgLTM4OTU2NDU4Nik7XHJcbiAgICBjID0gbWQ1X2ZmKGMsIGQsIGEsIGIsIHhbaSsgMl0sIDE3LCAgNjA2MTA1ODE5KTtcclxuICAgIGIgPSBtZDVfZmYoYiwgYywgZCwgYSwgeFtpKyAzXSwgMjIsIC0xMDQ0NTI1MzMwKTtcclxuICAgIGEgPSBtZDVfZmYoYSwgYiwgYywgZCwgeFtpKyA0XSwgNyAsIC0xNzY0MTg4OTcpO1xyXG4gICAgZCA9IG1kNV9mZihkLCBhLCBiLCBjLCB4W2krIDVdLCAxMiwgIDEyMDAwODA0MjYpO1xyXG4gICAgYyA9IG1kNV9mZihjLCBkLCBhLCBiLCB4W2krIDZdLCAxNywgLTE0NzMyMzEzNDEpO1xyXG4gICAgYiA9IG1kNV9mZihiLCBjLCBkLCBhLCB4W2krIDddLCAyMiwgLTQ1NzA1OTgzKTtcclxuICAgIGEgPSBtZDVfZmYoYSwgYiwgYywgZCwgeFtpKyA4XSwgNyAsICAxNzcwMDM1NDE2KTtcclxuICAgIGQgPSBtZDVfZmYoZCwgYSwgYiwgYywgeFtpKyA5XSwgMTIsIC0xOTU4NDE0NDE3KTtcclxuICAgIGMgPSBtZDVfZmYoYywgZCwgYSwgYiwgeFtpKzEwXSwgMTcsIC00MjA2Myk7XHJcbiAgICBiID0gbWQ1X2ZmKGIsIGMsIGQsIGEsIHhbaSsxMV0sIDIyLCAtMTk5MDQwNDE2Mik7XHJcbiAgICBhID0gbWQ1X2ZmKGEsIGIsIGMsIGQsIHhbaSsxMl0sIDcgLCAgMTgwNDYwMzY4Mik7XHJcbiAgICBkID0gbWQ1X2ZmKGQsIGEsIGIsIGMsIHhbaSsxM10sIDEyLCAtNDAzNDExMDEpO1xyXG4gICAgYyA9IG1kNV9mZihjLCBkLCBhLCBiLCB4W2krMTRdLCAxNywgLTE1MDIwMDIyOTApO1xyXG4gICAgYiA9IG1kNV9mZihiLCBjLCBkLCBhLCB4W2krMTVdLCAyMiwgIDEyMzY1MzUzMjkpO1xyXG5cclxuICAgIGEgPSBtZDVfZ2coYSwgYiwgYywgZCwgeFtpKyAxXSwgNSAsIC0xNjU3OTY1MTApO1xyXG4gICAgZCA9IG1kNV9nZyhkLCBhLCBiLCBjLCB4W2krIDZdLCA5ICwgLTEwNjk1MDE2MzIpO1xyXG4gICAgYyA9IG1kNV9nZyhjLCBkLCBhLCBiLCB4W2krMTFdLCAxNCwgIDY0MzcxNzcxMyk7XHJcbiAgICBiID0gbWQ1X2dnKGIsIGMsIGQsIGEsIHhbaSsgMF0sIDIwLCAtMzczODk3MzAyKTtcclxuICAgIGEgPSBtZDVfZ2coYSwgYiwgYywgZCwgeFtpKyA1XSwgNSAsIC03MDE1NTg2OTEpO1xyXG4gICAgZCA9IG1kNV9nZyhkLCBhLCBiLCBjLCB4W2krMTBdLCA5ICwgIDM4MDE2MDgzKTtcclxuICAgIGMgPSBtZDVfZ2coYywgZCwgYSwgYiwgeFtpKzE1XSwgMTQsIC02NjA0NzgzMzUpO1xyXG4gICAgYiA9IG1kNV9nZyhiLCBjLCBkLCBhLCB4W2krIDRdLCAyMCwgLTQwNTUzNzg0OCk7XHJcbiAgICBhID0gbWQ1X2dnKGEsIGIsIGMsIGQsIHhbaSsgOV0sIDUgLCAgNTY4NDQ2NDM4KTtcclxuICAgIGQgPSBtZDVfZ2coZCwgYSwgYiwgYywgeFtpKzE0XSwgOSAsIC0xMDE5ODAzNjkwKTtcclxuICAgIGMgPSBtZDVfZ2coYywgZCwgYSwgYiwgeFtpKyAzXSwgMTQsIC0xODczNjM5NjEpO1xyXG4gICAgYiA9IG1kNV9nZyhiLCBjLCBkLCBhLCB4W2krIDhdLCAyMCwgIDExNjM1MzE1MDEpO1xyXG4gICAgYSA9IG1kNV9nZyhhLCBiLCBjLCBkLCB4W2krMTNdLCA1ICwgLTE0NDQ2ODE0NjcpO1xyXG4gICAgZCA9IG1kNV9nZyhkLCBhLCBiLCBjLCB4W2krIDJdLCA5ICwgLTUxNDAzNzg0KTtcclxuICAgIGMgPSBtZDVfZ2coYywgZCwgYSwgYiwgeFtpKyA3XSwgMTQsICAxNzM1MzI4NDczKTtcclxuICAgIGIgPSBtZDVfZ2coYiwgYywgZCwgYSwgeFtpKzEyXSwgMjAsIC0xOTI2NjA3NzM0KTtcclxuXHJcbiAgICBhID0gbWQ1X2hoKGEsIGIsIGMsIGQsIHhbaSsgNV0sIDQgLCAtMzc4NTU4KTtcclxuICAgIGQgPSBtZDVfaGgoZCwgYSwgYiwgYywgeFtpKyA4XSwgMTEsIC0yMDIyNTc0NDYzKTtcclxuICAgIGMgPSBtZDVfaGgoYywgZCwgYSwgYiwgeFtpKzExXSwgMTYsICAxODM5MDMwNTYyKTtcclxuICAgIGIgPSBtZDVfaGgoYiwgYywgZCwgYSwgeFtpKzE0XSwgMjMsIC0zNTMwOTU1Nik7XHJcbiAgICBhID0gbWQ1X2hoKGEsIGIsIGMsIGQsIHhbaSsgMV0sIDQgLCAtMTUzMDk5MjA2MCk7XHJcbiAgICBkID0gbWQ1X2hoKGQsIGEsIGIsIGMsIHhbaSsgNF0sIDExLCAgMTI3Mjg5MzM1Myk7XHJcbiAgICBjID0gbWQ1X2hoKGMsIGQsIGEsIGIsIHhbaSsgN10sIDE2LCAtMTU1NDk3NjMyKTtcclxuICAgIGIgPSBtZDVfaGgoYiwgYywgZCwgYSwgeFtpKzEwXSwgMjMsIC0xMDk0NzMwNjQwKTtcclxuICAgIGEgPSBtZDVfaGgoYSwgYiwgYywgZCwgeFtpKzEzXSwgNCAsICA2ODEyNzkxNzQpO1xyXG4gICAgZCA9IG1kNV9oaChkLCBhLCBiLCBjLCB4W2krIDBdLCAxMSwgLTM1ODUzNzIyMik7XHJcbiAgICBjID0gbWQ1X2hoKGMsIGQsIGEsIGIsIHhbaSsgM10sIDE2LCAtNzIyNTIxOTc5KTtcclxuICAgIGIgPSBtZDVfaGgoYiwgYywgZCwgYSwgeFtpKyA2XSwgMjMsICA3NjAyOTE4OSk7XHJcbiAgICBhID0gbWQ1X2hoKGEsIGIsIGMsIGQsIHhbaSsgOV0sIDQgLCAtNjQwMzY0NDg3KTtcclxuICAgIGQgPSBtZDVfaGgoZCwgYSwgYiwgYywgeFtpKzEyXSwgMTEsIC00MjE4MTU4MzUpO1xyXG4gICAgYyA9IG1kNV9oaChjLCBkLCBhLCBiLCB4W2krMTVdLCAxNiwgIDUzMDc0MjUyMCk7XHJcbiAgICBiID0gbWQ1X2hoKGIsIGMsIGQsIGEsIHhbaSsgMl0sIDIzLCAtOTk1MzM4NjUxKTtcclxuXHJcbiAgICBhID0gbWQ1X2lpKGEsIGIsIGMsIGQsIHhbaSsgMF0sIDYgLCAtMTk4NjMwODQ0KTtcclxuICAgIGQgPSBtZDVfaWkoZCwgYSwgYiwgYywgeFtpKyA3XSwgMTAsICAxMTI2ODkxNDE1KTtcclxuICAgIGMgPSBtZDVfaWkoYywgZCwgYSwgYiwgeFtpKzE0XSwgMTUsIC0xNDE2MzU0OTA1KTtcclxuICAgIGIgPSBtZDVfaWkoYiwgYywgZCwgYSwgeFtpKyA1XSwgMjEsIC01NzQzNDA1NSk7XHJcbiAgICBhID0gbWQ1X2lpKGEsIGIsIGMsIGQsIHhbaSsxMl0sIDYgLCAgMTcwMDQ4NTU3MSk7XHJcbiAgICBkID0gbWQ1X2lpKGQsIGEsIGIsIGMsIHhbaSsgM10sIDEwLCAtMTg5NDk4NjYwNik7XHJcbiAgICBjID0gbWQ1X2lpKGMsIGQsIGEsIGIsIHhbaSsxMF0sIDE1LCAtMTA1MTUyMyk7XHJcbiAgICBiID0gbWQ1X2lpKGIsIGMsIGQsIGEsIHhbaSsgMV0sIDIxLCAtMjA1NDkyMjc5OSk7XHJcbiAgICBhID0gbWQ1X2lpKGEsIGIsIGMsIGQsIHhbaSsgOF0sIDYgLCAgMTg3MzMxMzM1OSk7XHJcbiAgICBkID0gbWQ1X2lpKGQsIGEsIGIsIGMsIHhbaSsxNV0sIDEwLCAtMzA2MTE3NDQpO1xyXG4gICAgYyA9IG1kNV9paShjLCBkLCBhLCBiLCB4W2krIDZdLCAxNSwgLTE1NjAxOTgzODApO1xyXG4gICAgYiA9IG1kNV9paShiLCBjLCBkLCBhLCB4W2krMTNdLCAyMSwgIDEzMDkxNTE2NDkpO1xyXG4gICAgYSA9IG1kNV9paShhLCBiLCBjLCBkLCB4W2krIDRdLCA2ICwgLTE0NTUyMzA3MCk7XHJcbiAgICBkID0gbWQ1X2lpKGQsIGEsIGIsIGMsIHhbaSsxMV0sIDEwLCAtMTEyMDIxMDM3OSk7XHJcbiAgICBjID0gbWQ1X2lpKGMsIGQsIGEsIGIsIHhbaSsgMl0sIDE1LCAgNzE4Nzg3MjU5KTtcclxuICAgIGIgPSBtZDVfaWkoYiwgYywgZCwgYSwgeFtpKyA5XSwgMjEsIC0zNDM0ODU1NTEpO1xyXG5cclxuICAgIGEgPSBzYWZlX2FkZChhLCBvbGRhKTtcclxuICAgIGIgPSBzYWZlX2FkZChiLCBvbGRiKTtcclxuICAgIGMgPSBzYWZlX2FkZChjLCBvbGRjKTtcclxuICAgIGQgPSBzYWZlX2FkZChkLCBvbGRkKTtcclxuICB9XHJcbiAgcmV0dXJuIEFycmF5KGEsIGIsIGMsIGQpO1xyXG5cclxufVxyXG5cclxuLypcclxuICogVGhlc2UgZnVuY3Rpb25zIGltcGxlbWVudCB0aGUgZm91ciBiYXNpYyBvcGVyYXRpb25zIHRoZSBhbGdvcml0aG0gdXNlcy5cclxuICovXHJcbmZ1bmN0aW9uIG1kNV9jbW4ocSwgYSwgYiwgeCwgcywgdClcclxue1xyXG4gIHJldHVybiBzYWZlX2FkZChiaXRfcm9sKHNhZmVfYWRkKHNhZmVfYWRkKGEsIHEpLCBzYWZlX2FkZCh4LCB0KSksIHMpLGIpO1xyXG59XHJcbmZ1bmN0aW9uIG1kNV9mZihhLCBiLCBjLCBkLCB4LCBzLCB0KVxyXG57XHJcbiAgcmV0dXJuIG1kNV9jbW4oKGIgJiBjKSB8ICgofmIpICYgZCksIGEsIGIsIHgsIHMsIHQpO1xyXG59XHJcbmZ1bmN0aW9uIG1kNV9nZyhhLCBiLCBjLCBkLCB4LCBzLCB0KVxyXG57XHJcbiAgcmV0dXJuIG1kNV9jbW4oKGIgJiBkKSB8IChjICYgKH5kKSksIGEsIGIsIHgsIHMsIHQpO1xyXG59XHJcbmZ1bmN0aW9uIG1kNV9oaChhLCBiLCBjLCBkLCB4LCBzLCB0KVxyXG57XHJcbiAgcmV0dXJuIG1kNV9jbW4oYiBeIGMgXiBkLCBhLCBiLCB4LCBzLCB0KTtcclxufVxyXG5mdW5jdGlvbiBtZDVfaWkoYSwgYiwgYywgZCwgeCwgcywgdClcclxue1xyXG4gIHJldHVybiBtZDVfY21uKGMgXiAoYiB8ICh+ZCkpLCBhLCBiLCB4LCBzLCB0KTtcclxufVxyXG5cclxuLypcclxuICogQWRkIGludGVnZXJzLCB3cmFwcGluZyBhdCAyXjMyLiBUaGlzIHVzZXMgMTYtYml0IG9wZXJhdGlvbnMgaW50ZXJuYWxseVxyXG4gKiB0byB3b3JrIGFyb3VuZCBidWdzIGluIHNvbWUgSlMgaW50ZXJwcmV0ZXJzLlxyXG4gKi9cclxuZnVuY3Rpb24gc2FmZV9hZGQoeCwgeSlcclxue1xyXG4gIHZhciBsc3cgPSAoeCAmIDB4RkZGRikgKyAoeSAmIDB4RkZGRik7XHJcbiAgdmFyIG1zdyA9ICh4ID4+IDE2KSArICh5ID4+IDE2KSArIChsc3cgPj4gMTYpO1xyXG4gIHJldHVybiAobXN3IDw8IDE2KSB8IChsc3cgJiAweEZGRkYpO1xyXG59XHJcblxyXG4vKlxyXG4gKiBCaXR3aXNlIHJvdGF0ZSBhIDMyLWJpdCBudW1iZXIgdG8gdGhlIGxlZnQuXHJcbiAqL1xyXG5mdW5jdGlvbiBiaXRfcm9sKG51bSwgY250KVxyXG57XHJcbiAgcmV0dXJuIChudW0gPDwgY250KSB8IChudW0gPj4+ICgzMiAtIGNudCkpO1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIG1kNShidWYpIHtcclxuICByZXR1cm4gaGVscGVycy5oYXNoKGJ1ZiwgY29yZV9tZDUsIDE2KTtcclxufTtcclxuIiwiLy8gT3JpZ2luYWwgY29kZSBhZGFwdGVkIGZyb20gUm9iZXJ0IEtpZWZmZXIuXG4vLyBkZXRhaWxzIGF0IGh0dHBzOi8vZ2l0aHViLmNvbS9icm9vZmEvbm9kZS11dWlkXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBfZ2xvYmFsID0gdGhpcztcblxuICB2YXIgbWF0aFJORywgd2hhdHdnUk5HO1xuXG4gIC8vIE5PVEU6IE1hdGgucmFuZG9tKCkgZG9lcyBub3QgZ3VhcmFudGVlIFwiY3J5cHRvZ3JhcGhpYyBxdWFsaXR5XCJcbiAgbWF0aFJORyA9IGZ1bmN0aW9uKHNpemUpIHtcbiAgICB2YXIgYnl0ZXMgPSBuZXcgQXJyYXkoc2l6ZSk7XG4gICAgdmFyIHI7XG5cbiAgICBmb3IgKHZhciBpID0gMCwgcjsgaSA8IHNpemU7IGkrKykge1xuICAgICAgaWYgKChpICYgMHgwMykgPT0gMCkgciA9IE1hdGgucmFuZG9tKCkgKiAweDEwMDAwMDAwMDtcbiAgICAgIGJ5dGVzW2ldID0gciA+Pj4gKChpICYgMHgwMykgPDwgMykgJiAweGZmO1xuICAgIH1cblxuICAgIHJldHVybiBieXRlcztcbiAgfVxuXG4gIGlmIChfZ2xvYmFsLmNyeXB0byAmJiBjcnlwdG8uZ2V0UmFuZG9tVmFsdWVzKSB7XG4gICAgd2hhdHdnUk5HID0gZnVuY3Rpb24oc2l6ZSkge1xuICAgICAgdmFyIGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkoc2l6ZSk7XG4gICAgICBjcnlwdG8uZ2V0UmFuZG9tVmFsdWVzKGJ5dGVzKTtcbiAgICAgIHJldHVybiBieXRlcztcbiAgICB9XG4gIH1cblxuICBtb2R1bGUuZXhwb3J0cyA9IHdoYXR3Z1JORyB8fCBtYXRoUk5HO1xuXG59KCkpXG4iLCIvKlxuICogQSBKYXZhU2NyaXB0IGltcGxlbWVudGF0aW9uIG9mIHRoZSBTZWN1cmUgSGFzaCBBbGdvcml0aG0sIFNIQS0xLCBhcyBkZWZpbmVkXG4gKiBpbiBGSVBTIFBVQiAxODAtMVxuICogVmVyc2lvbiAyLjFhIENvcHlyaWdodCBQYXVsIEpvaG5zdG9uIDIwMDAgLSAyMDAyLlxuICogT3RoZXIgY29udHJpYnV0b3JzOiBHcmVnIEhvbHQsIEFuZHJldyBLZXBlcnQsIFlkbmFyLCBMb3N0aW5ldFxuICogRGlzdHJpYnV0ZWQgdW5kZXIgdGhlIEJTRCBMaWNlbnNlXG4gKiBTZWUgaHR0cDovL3BhamhvbWUub3JnLnVrL2NyeXB0L21kNSBmb3IgZGV0YWlscy5cbiAqL1xuXG52YXIgaGVscGVycyA9IHJlcXVpcmUoJy4vaGVscGVycycpO1xuXG4vKlxuICogQ2FsY3VsYXRlIHRoZSBTSEEtMSBvZiBhbiBhcnJheSBvZiBiaWctZW5kaWFuIHdvcmRzLCBhbmQgYSBiaXQgbGVuZ3RoXG4gKi9cbmZ1bmN0aW9uIGNvcmVfc2hhMSh4LCBsZW4pXG57XG4gIC8qIGFwcGVuZCBwYWRkaW5nICovXG4gIHhbbGVuID4+IDVdIHw9IDB4ODAgPDwgKDI0IC0gbGVuICUgMzIpO1xuICB4WygobGVuICsgNjQgPj4gOSkgPDwgNCkgKyAxNV0gPSBsZW47XG5cbiAgdmFyIHcgPSBBcnJheSg4MCk7XG4gIHZhciBhID0gIDE3MzI1ODQxOTM7XG4gIHZhciBiID0gLTI3MTczMzg3OTtcbiAgdmFyIGMgPSAtMTczMjU4NDE5NDtcbiAgdmFyIGQgPSAgMjcxNzMzODc4O1xuICB2YXIgZSA9IC0xMDA5NTg5Nzc2O1xuXG4gIGZvcih2YXIgaSA9IDA7IGkgPCB4Lmxlbmd0aDsgaSArPSAxNilcbiAge1xuICAgIHZhciBvbGRhID0gYTtcbiAgICB2YXIgb2xkYiA9IGI7XG4gICAgdmFyIG9sZGMgPSBjO1xuICAgIHZhciBvbGRkID0gZDtcbiAgICB2YXIgb2xkZSA9IGU7XG5cbiAgICBmb3IodmFyIGogPSAwOyBqIDwgODA7IGorKylcbiAgICB7XG4gICAgICBpZihqIDwgMTYpIHdbal0gPSB4W2kgKyBqXTtcbiAgICAgIGVsc2Ugd1tqXSA9IHJvbCh3W2otM10gXiB3W2otOF0gXiB3W2otMTRdIF4gd1tqLTE2XSwgMSk7XG4gICAgICB2YXIgdCA9IHNhZmVfYWRkKHNhZmVfYWRkKHJvbChhLCA1KSwgc2hhMV9mdChqLCBiLCBjLCBkKSksXG4gICAgICAgICAgICAgICAgICAgICAgIHNhZmVfYWRkKHNhZmVfYWRkKGUsIHdbal0pLCBzaGExX2t0KGopKSk7XG4gICAgICBlID0gZDtcbiAgICAgIGQgPSBjO1xuICAgICAgYyA9IHJvbChiLCAzMCk7XG4gICAgICBiID0gYTtcbiAgICAgIGEgPSB0O1xuICAgIH1cblxuICAgIGEgPSBzYWZlX2FkZChhLCBvbGRhKTtcbiAgICBiID0gc2FmZV9hZGQoYiwgb2xkYik7XG4gICAgYyA9IHNhZmVfYWRkKGMsIG9sZGMpO1xuICAgIGQgPSBzYWZlX2FkZChkLCBvbGRkKTtcbiAgICBlID0gc2FmZV9hZGQoZSwgb2xkZSk7XG4gIH1cbiAgcmV0dXJuIEFycmF5KGEsIGIsIGMsIGQsIGUpO1xuXG59XG5cbi8qXG4gKiBQZXJmb3JtIHRoZSBhcHByb3ByaWF0ZSB0cmlwbGV0IGNvbWJpbmF0aW9uIGZ1bmN0aW9uIGZvciB0aGUgY3VycmVudFxuICogaXRlcmF0aW9uXG4gKi9cbmZ1bmN0aW9uIHNoYTFfZnQodCwgYiwgYywgZClcbntcbiAgaWYodCA8IDIwKSByZXR1cm4gKGIgJiBjKSB8ICgofmIpICYgZCk7XG4gIGlmKHQgPCA0MCkgcmV0dXJuIGIgXiBjIF4gZDtcbiAgaWYodCA8IDYwKSByZXR1cm4gKGIgJiBjKSB8IChiICYgZCkgfCAoYyAmIGQpO1xuICByZXR1cm4gYiBeIGMgXiBkO1xufVxuXG4vKlxuICogRGV0ZXJtaW5lIHRoZSBhcHByb3ByaWF0ZSBhZGRpdGl2ZSBjb25zdGFudCBmb3IgdGhlIGN1cnJlbnQgaXRlcmF0aW9uXG4gKi9cbmZ1bmN0aW9uIHNoYTFfa3QodClcbntcbiAgcmV0dXJuICh0IDwgMjApID8gIDE1MTg1MDAyNDkgOiAodCA8IDQwKSA/ICAxODU5Nzc1MzkzIDpcbiAgICAgICAgICh0IDwgNjApID8gLTE4OTQwMDc1ODggOiAtODk5NDk3NTE0O1xufVxuXG4vKlxuICogQWRkIGludGVnZXJzLCB3cmFwcGluZyBhdCAyXjMyLiBUaGlzIHVzZXMgMTYtYml0IG9wZXJhdGlvbnMgaW50ZXJuYWxseVxuICogdG8gd29yayBhcm91bmQgYnVncyBpbiBzb21lIEpTIGludGVycHJldGVycy5cbiAqL1xuZnVuY3Rpb24gc2FmZV9hZGQoeCwgeSlcbntcbiAgdmFyIGxzdyA9ICh4ICYgMHhGRkZGKSArICh5ICYgMHhGRkZGKTtcbiAgdmFyIG1zdyA9ICh4ID4+IDE2KSArICh5ID4+IDE2KSArIChsc3cgPj4gMTYpO1xuICByZXR1cm4gKG1zdyA8PCAxNikgfCAobHN3ICYgMHhGRkZGKTtcbn1cblxuLypcbiAqIEJpdHdpc2Ugcm90YXRlIGEgMzItYml0IG51bWJlciB0byB0aGUgbGVmdC5cbiAqL1xuZnVuY3Rpb24gcm9sKG51bSwgY250KVxue1xuICByZXR1cm4gKG51bSA8PCBjbnQpIHwgKG51bSA+Pj4gKDMyIC0gY250KSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gc2hhMShidWYpIHtcbiAgcmV0dXJuIGhlbHBlcnMuaGFzaChidWYsIGNvcmVfc2hhMSwgMjAsIHRydWUpO1xufTtcbiIsIlxuLyoqXG4gKiBBIEphdmFTY3JpcHQgaW1wbGVtZW50YXRpb24gb2YgdGhlIFNlY3VyZSBIYXNoIEFsZ29yaXRobSwgU0hBLTI1NiwgYXMgZGVmaW5lZFxuICogaW4gRklQUyAxODAtMlxuICogVmVyc2lvbiAyLjItYmV0YSBDb3B5cmlnaHQgQW5nZWwgTWFyaW4sIFBhdWwgSm9obnN0b24gMjAwMCAtIDIwMDkuXG4gKiBPdGhlciBjb250cmlidXRvcnM6IEdyZWcgSG9sdCwgQW5kcmV3IEtlcGVydCwgWWRuYXIsIExvc3RpbmV0XG4gKlxuICovXG5cbnZhciBoZWxwZXJzID0gcmVxdWlyZSgnLi9oZWxwZXJzJyk7XG5cbnZhciBzYWZlX2FkZCA9IGZ1bmN0aW9uKHgsIHkpIHtcbiAgdmFyIGxzdyA9ICh4ICYgMHhGRkZGKSArICh5ICYgMHhGRkZGKTtcbiAgdmFyIG1zdyA9ICh4ID4+IDE2KSArICh5ID4+IDE2KSArIChsc3cgPj4gMTYpO1xuICByZXR1cm4gKG1zdyA8PCAxNikgfCAobHN3ICYgMHhGRkZGKTtcbn07XG5cbnZhciBTID0gZnVuY3Rpb24oWCwgbikge1xuICByZXR1cm4gKFggPj4+IG4pIHwgKFggPDwgKDMyIC0gbikpO1xufTtcblxudmFyIFIgPSBmdW5jdGlvbihYLCBuKSB7XG4gIHJldHVybiAoWCA+Pj4gbik7XG59O1xuXG52YXIgQ2ggPSBmdW5jdGlvbih4LCB5LCB6KSB7XG4gIHJldHVybiAoKHggJiB5KSBeICgofngpICYgeikpO1xufTtcblxudmFyIE1haiA9IGZ1bmN0aW9uKHgsIHksIHopIHtcbiAgcmV0dXJuICgoeCAmIHkpIF4gKHggJiB6KSBeICh5ICYgeikpO1xufTtcblxudmFyIFNpZ21hMDI1NiA9IGZ1bmN0aW9uKHgpIHtcbiAgcmV0dXJuIChTKHgsIDIpIF4gUyh4LCAxMykgXiBTKHgsIDIyKSk7XG59O1xuXG52YXIgU2lnbWExMjU2ID0gZnVuY3Rpb24oeCkge1xuICByZXR1cm4gKFMoeCwgNikgXiBTKHgsIDExKSBeIFMoeCwgMjUpKTtcbn07XG5cbnZhciBHYW1tYTAyNTYgPSBmdW5jdGlvbih4KSB7XG4gIHJldHVybiAoUyh4LCA3KSBeIFMoeCwgMTgpIF4gUih4LCAzKSk7XG59O1xuXG52YXIgR2FtbWExMjU2ID0gZnVuY3Rpb24oeCkge1xuICByZXR1cm4gKFMoeCwgMTcpIF4gUyh4LCAxOSkgXiBSKHgsIDEwKSk7XG59O1xuXG52YXIgY29yZV9zaGEyNTYgPSBmdW5jdGlvbihtLCBsKSB7XG4gIHZhciBLID0gbmV3IEFycmF5KDB4NDI4QTJGOTgsMHg3MTM3NDQ5MSwweEI1QzBGQkNGLDB4RTlCNURCQTUsMHgzOTU2QzI1QiwweDU5RjExMUYxLDB4OTIzRjgyQTQsMHhBQjFDNUVENSwweEQ4MDdBQTk4LDB4MTI4MzVCMDEsMHgyNDMxODVCRSwweDU1MEM3REMzLDB4NzJCRTVENzQsMHg4MERFQjFGRSwweDlCREMwNkE3LDB4QzE5QkYxNzQsMHhFNDlCNjlDMSwweEVGQkU0Nzg2LDB4RkMxOURDNiwweDI0MENBMUNDLDB4MkRFOTJDNkYsMHg0QTc0ODRBQSwweDVDQjBBOURDLDB4NzZGOTg4REEsMHg5ODNFNTE1MiwweEE4MzFDNjZELDB4QjAwMzI3QzgsMHhCRjU5N0ZDNywweEM2RTAwQkYzLDB4RDVBNzkxNDcsMHg2Q0E2MzUxLDB4MTQyOTI5NjcsMHgyN0I3MEE4NSwweDJFMUIyMTM4LDB4NEQyQzZERkMsMHg1MzM4MEQxMywweDY1MEE3MzU0LDB4NzY2QTBBQkIsMHg4MUMyQzkyRSwweDkyNzIyQzg1LDB4QTJCRkU4QTEsMHhBODFBNjY0QiwweEMyNEI4QjcwLDB4Qzc2QzUxQTMsMHhEMTkyRTgxOSwweEQ2OTkwNjI0LDB4RjQwRTM1ODUsMHgxMDZBQTA3MCwweDE5QTRDMTE2LDB4MUUzNzZDMDgsMHgyNzQ4Nzc0QywweDM0QjBCQ0I1LDB4MzkxQzBDQjMsMHg0RUQ4QUE0QSwweDVCOUNDQTRGLDB4NjgyRTZGRjMsMHg3NDhGODJFRSwweDc4QTU2MzZGLDB4ODRDODc4MTQsMHg4Q0M3MDIwOCwweDkwQkVGRkZBLDB4QTQ1MDZDRUIsMHhCRUY5QTNGNywweEM2NzE3OEYyKTtcbiAgdmFyIEhBU0ggPSBuZXcgQXJyYXkoMHg2QTA5RTY2NywgMHhCQjY3QUU4NSwgMHgzQzZFRjM3MiwgMHhBNTRGRjUzQSwgMHg1MTBFNTI3RiwgMHg5QjA1Njg4QywgMHgxRjgzRDlBQiwgMHg1QkUwQ0QxOSk7XG4gICAgdmFyIFcgPSBuZXcgQXJyYXkoNjQpO1xuICAgIHZhciBhLCBiLCBjLCBkLCBlLCBmLCBnLCBoLCBpLCBqO1xuICAgIHZhciBUMSwgVDI7XG4gIC8qIGFwcGVuZCBwYWRkaW5nICovXG4gIG1bbCA+PiA1XSB8PSAweDgwIDw8ICgyNCAtIGwgJSAzMik7XG4gIG1bKChsICsgNjQgPj4gOSkgPDwgNCkgKyAxNV0gPSBsO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IG0ubGVuZ3RoOyBpICs9IDE2KSB7XG4gICAgYSA9IEhBU0hbMF07IGIgPSBIQVNIWzFdOyBjID0gSEFTSFsyXTsgZCA9IEhBU0hbM107IGUgPSBIQVNIWzRdOyBmID0gSEFTSFs1XTsgZyA9IEhBU0hbNl07IGggPSBIQVNIWzddO1xuICAgIGZvciAodmFyIGogPSAwOyBqIDwgNjQ7IGorKykge1xuICAgICAgaWYgKGogPCAxNikge1xuICAgICAgICBXW2pdID0gbVtqICsgaV07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBXW2pdID0gc2FmZV9hZGQoc2FmZV9hZGQoc2FmZV9hZGQoR2FtbWExMjU2KFdbaiAtIDJdKSwgV1tqIC0gN10pLCBHYW1tYTAyNTYoV1tqIC0gMTVdKSksIFdbaiAtIDE2XSk7XG4gICAgICB9XG4gICAgICBUMSA9IHNhZmVfYWRkKHNhZmVfYWRkKHNhZmVfYWRkKHNhZmVfYWRkKGgsIFNpZ21hMTI1NihlKSksIENoKGUsIGYsIGcpKSwgS1tqXSksIFdbal0pO1xuICAgICAgVDIgPSBzYWZlX2FkZChTaWdtYTAyNTYoYSksIE1haihhLCBiLCBjKSk7XG4gICAgICBoID0gZzsgZyA9IGY7IGYgPSBlOyBlID0gc2FmZV9hZGQoZCwgVDEpOyBkID0gYzsgYyA9IGI7IGIgPSBhOyBhID0gc2FmZV9hZGQoVDEsIFQyKTtcbiAgICB9XG4gICAgSEFTSFswXSA9IHNhZmVfYWRkKGEsIEhBU0hbMF0pOyBIQVNIWzFdID0gc2FmZV9hZGQoYiwgSEFTSFsxXSk7IEhBU0hbMl0gPSBzYWZlX2FkZChjLCBIQVNIWzJdKTsgSEFTSFszXSA9IHNhZmVfYWRkKGQsIEhBU0hbM10pO1xuICAgIEhBU0hbNF0gPSBzYWZlX2FkZChlLCBIQVNIWzRdKTsgSEFTSFs1XSA9IHNhZmVfYWRkKGYsIEhBU0hbNV0pOyBIQVNIWzZdID0gc2FmZV9hZGQoZywgSEFTSFs2XSk7IEhBU0hbN10gPSBzYWZlX2FkZChoLCBIQVNIWzddKTtcbiAgfVxuICByZXR1cm4gSEFTSDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gc2hhMjU2KGJ1Zikge1xuICByZXR1cm4gaGVscGVycy5oYXNoKGJ1ZiwgY29yZV9zaGEyNTYsIDMyLCB0cnVlKTtcbn07XG4iLCJcInVzZSBzdHJpY3RcIjtmdW5jdGlvbiBxKGEpe3Rocm93IGE7fXZhciBzPXZvaWQgMCx1PSExO3ZhciBzamNsPXtjaXBoZXI6e30saGFzaDp7fSxrZXlleGNoYW5nZTp7fSxtb2RlOnt9LG1pc2M6e30sY29kZWM6e30sZXhjZXB0aW9uOntjb3JydXB0OmZ1bmN0aW9uKGEpe3RoaXMudG9TdHJpbmc9ZnVuY3Rpb24oKXtyZXR1cm5cIkNPUlJVUFQ6IFwiK3RoaXMubWVzc2FnZX07dGhpcy5tZXNzYWdlPWF9LGludmFsaWQ6ZnVuY3Rpb24oYSl7dGhpcy50b1N0cmluZz1mdW5jdGlvbigpe3JldHVyblwiSU5WQUxJRDogXCIrdGhpcy5tZXNzYWdlfTt0aGlzLm1lc3NhZ2U9YX0sYnVnOmZ1bmN0aW9uKGEpe3RoaXMudG9TdHJpbmc9ZnVuY3Rpb24oKXtyZXR1cm5cIkJVRzogXCIrdGhpcy5tZXNzYWdlfTt0aGlzLm1lc3NhZ2U9YX0sbm90UmVhZHk6ZnVuY3Rpb24oYSl7dGhpcy50b1N0cmluZz1mdW5jdGlvbigpe3JldHVyblwiTk9UIFJFQURZOiBcIit0aGlzLm1lc3NhZ2V9O3RoaXMubWVzc2FnZT1hfX19O1xuXCJ1bmRlZmluZWRcIiE9PXR5cGVvZiBtb2R1bGUmJm1vZHVsZS5leHBvcnRzJiYobW9kdWxlLmV4cG9ydHM9c2pjbCk7XCJmdW5jdGlvblwiPT09dHlwZW9mIGRlZmluZSYmZGVmaW5lKFtdLGZ1bmN0aW9uKCl7cmV0dXJuIHNqY2x9KTtcbnNqY2wuY2lwaGVyLmFlcz1mdW5jdGlvbihhKXt0aGlzLmtbMF1bMF1bMF18fHRoaXMuRCgpO3ZhciBiLGMsZCxlLGY9dGhpcy5rWzBdWzRdLGc9dGhpcy5rWzFdO2I9YS5sZW5ndGg7dmFyIGg9MTs0IT09YiYmKDYhPT1iJiY4IT09YikmJnEobmV3IHNqY2wuZXhjZXB0aW9uLmludmFsaWQoXCJpbnZhbGlkIGFlcyBrZXkgc2l6ZVwiKSk7dGhpcy5iPVtkPWEuc2xpY2UoMCksZT1bXV07Zm9yKGE9YjthPDQqYisyODthKyspe2M9ZFthLTFdO2lmKDA9PT1hJWJ8fDg9PT1iJiY0PT09YSViKWM9ZltjPj4+MjRdPDwyNF5mW2M+PjE2JjI1NV08PDE2XmZbYz4+OCYyNTVdPDw4XmZbYyYyNTVdLDA9PT1hJWImJihjPWM8PDheYz4+PjI0Xmg8PDI0LGg9aDw8MV4yODMqKGg+PjcpKTtkW2FdPWRbYS1iXV5jfWZvcihiPTA7YTtiKyssYS0tKWM9ZFtiJjM/YTphLTRdLGVbYl09ND49YXx8ND5iP2M6Z1swXVtmW2M+Pj4yNF1dXmdbMV1bZltjPj4xNiYyNTVdXV5nWzJdW2ZbYz4+OCYyNTVdXV5nWzNdW2ZbYyZcbjI1NV1dfTtcbnNqY2wuY2lwaGVyLmFlcy5wcm90b3R5cGU9e2VuY3J5cHQ6ZnVuY3Rpb24oYSl7cmV0dXJuIHcodGhpcyxhLDApfSxkZWNyeXB0OmZ1bmN0aW9uKGEpe3JldHVybiB3KHRoaXMsYSwxKX0sazpbW1tdLFtdLFtdLFtdLFtdXSxbW10sW10sW10sW10sW11dXSxEOmZ1bmN0aW9uKCl7dmFyIGE9dGhpcy5rWzBdLGI9dGhpcy5rWzFdLGM9YVs0XSxkPWJbNF0sZSxmLGcsaD1bXSxsPVtdLGssbixtLHA7Zm9yKGU9MDsweDEwMD5lO2UrKylsWyhoW2VdPWU8PDFeMjgzKihlPj43KSleZV09ZTtmb3IoZj1nPTA7IWNbZl07Zl49a3x8MSxnPWxbZ118fDEpe209Z15nPDwxXmc8PDJeZzw8M15nPDw0O209bT4+OF5tJjI1NV45OTtjW2ZdPW07ZFttXT1mO249aFtlPWhbaz1oW2ZdXV07cD0weDEwMTAxMDEqbl4weDEwMDAxKmVeMHgxMDEqa14weDEwMTAxMDAqZjtuPTB4MTAxKmhbbV1eMHgxMDEwMTAwKm07Zm9yKGU9MDs0PmU7ZSsrKWFbZV1bZl09bj1uPDwyNF5uPj4+OCxiW2VdW21dPXA9cDw8MjRecD4+Pjh9Zm9yKGU9XG4wOzU+ZTtlKyspYVtlXT1hW2VdLnNsaWNlKDApLGJbZV09YltlXS5zbGljZSgwKX19O1xuZnVuY3Rpb24gdyhhLGIsYyl7NCE9PWIubGVuZ3RoJiZxKG5ldyBzamNsLmV4Y2VwdGlvbi5pbnZhbGlkKFwiaW52YWxpZCBhZXMgYmxvY2sgc2l6ZVwiKSk7dmFyIGQ9YS5iW2NdLGU9YlswXV5kWzBdLGY9YltjPzM6MV1eZFsxXSxnPWJbMl1eZFsyXTtiPWJbYz8xOjNdXmRbM107dmFyIGgsbCxrLG49ZC5sZW5ndGgvNC0yLG0scD00LHQ9WzAsMCwwLDBdO2g9YS5rW2NdO2E9aFswXTt2YXIgcj1oWzFdLHY9aFsyXSx5PWhbM10sej1oWzRdO2ZvcihtPTA7bTxuO20rKyloPWFbZT4+PjI0XV5yW2Y+PjE2JjI1NV1edltnPj44JjI1NV1eeVtiJjI1NV1eZFtwXSxsPWFbZj4+PjI0XV5yW2c+PjE2JjI1NV1edltiPj44JjI1NV1eeVtlJjI1NV1eZFtwKzFdLGs9YVtnPj4+MjRdXnJbYj4+MTYmMjU1XV52W2U+PjgmMjU1XV55W2YmMjU1XV5kW3ArMl0sYj1hW2I+Pj4yNF1ecltlPj4xNiYyNTVdXnZbZj4+OCYyNTVdXnlbZyYyNTVdXmRbcCszXSxwKz00LGU9aCxmPWwsZz1rO2ZvcihtPTA7ND5cbm07bSsrKXRbYz8zJi1tOm1dPXpbZT4+PjI0XTw8MjReeltmPj4xNiYyNTVdPDwxNl56W2c+PjgmMjU1XTw8OF56W2ImMjU1XV5kW3ArK10saD1lLGU9ZixmPWcsZz1iLGI9aDtyZXR1cm4gdH1cbnNqY2wuYml0QXJyYXk9e2JpdFNsaWNlOmZ1bmN0aW9uKGEsYixjKXthPXNqY2wuYml0QXJyYXkuUChhLnNsaWNlKGIvMzIpLDMyLShiJjMxKSkuc2xpY2UoMSk7cmV0dXJuIGM9PT1zP2E6c2pjbC5iaXRBcnJheS5jbGFtcChhLGMtYil9LGV4dHJhY3Q6ZnVuY3Rpb24oYSxiLGMpe3ZhciBkPU1hdGguZmxvb3IoLWItYyYzMSk7cmV0dXJuKChiK2MtMV5iKSYtMzI/YVtiLzMyfDBdPDwzMi1kXmFbYi8zMisxfDBdPj4+ZDphW2IvMzJ8MF0+Pj5kKSYoMTw8YyktMX0sY29uY2F0OmZ1bmN0aW9uKGEsYil7aWYoMD09PWEubGVuZ3RofHwwPT09Yi5sZW5ndGgpcmV0dXJuIGEuY29uY2F0KGIpO3ZhciBjPWFbYS5sZW5ndGgtMV0sZD1zamNsLmJpdEFycmF5LmdldFBhcnRpYWwoYyk7cmV0dXJuIDMyPT09ZD9hLmNvbmNhdChiKTpzamNsLmJpdEFycmF5LlAoYixkLGN8MCxhLnNsaWNlKDAsYS5sZW5ndGgtMSkpfSxiaXRMZW5ndGg6ZnVuY3Rpb24oYSl7dmFyIGI9YS5sZW5ndGg7cmV0dXJuIDA9PT1cbmI/MDozMiooYi0xKStzamNsLmJpdEFycmF5LmdldFBhcnRpYWwoYVtiLTFdKX0sY2xhbXA6ZnVuY3Rpb24oYSxiKXtpZigzMiphLmxlbmd0aDxiKXJldHVybiBhO2E9YS5zbGljZSgwLE1hdGguY2VpbChiLzMyKSk7dmFyIGM9YS5sZW5ndGg7YiY9MzE7MDxjJiZiJiYoYVtjLTFdPXNqY2wuYml0QXJyYXkucGFydGlhbChiLGFbYy0xXSYyMTQ3NDgzNjQ4Pj5iLTEsMSkpO3JldHVybiBhfSxwYXJ0aWFsOmZ1bmN0aW9uKGEsYixjKXtyZXR1cm4gMzI9PT1hP2I6KGM/YnwwOmI8PDMyLWEpKzB4MTAwMDAwMDAwMDAqYX0sZ2V0UGFydGlhbDpmdW5jdGlvbihhKXtyZXR1cm4gTWF0aC5yb3VuZChhLzB4MTAwMDAwMDAwMDApfHwzMn0sZXF1YWw6ZnVuY3Rpb24oYSxiKXtpZihzamNsLmJpdEFycmF5LmJpdExlbmd0aChhKSE9PXNqY2wuYml0QXJyYXkuYml0TGVuZ3RoKGIpKXJldHVybiB1O3ZhciBjPTAsZDtmb3IoZD0wO2Q8YS5sZW5ndGg7ZCsrKWN8PWFbZF1eYltkXTtyZXR1cm4gMD09PVxuY30sUDpmdW5jdGlvbihhLGIsYyxkKXt2YXIgZTtlPTA7Zm9yKGQ9PT1zJiYoZD1bXSk7MzI8PWI7Yi09MzIpZC5wdXNoKGMpLGM9MDtpZigwPT09YilyZXR1cm4gZC5jb25jYXQoYSk7Zm9yKGU9MDtlPGEubGVuZ3RoO2UrKylkLnB1c2goY3xhW2VdPj4+YiksYz1hW2VdPDwzMi1iO2U9YS5sZW5ndGg/YVthLmxlbmd0aC0xXTowO2E9c2pjbC5iaXRBcnJheS5nZXRQYXJ0aWFsKGUpO2QucHVzaChzamNsLmJpdEFycmF5LnBhcnRpYWwoYithJjMxLDMyPGIrYT9jOmQucG9wKCksMSkpO3JldHVybiBkfSxsOmZ1bmN0aW9uKGEsYil7cmV0dXJuW2FbMF1eYlswXSxhWzFdXmJbMV0sYVsyXV5iWzJdLGFbM11eYlszXV19LGJ5dGVzd2FwTTpmdW5jdGlvbihhKXt2YXIgYixjO2ZvcihiPTA7YjxhLmxlbmd0aDsrK2IpYz1hW2JdLGFbYl09Yz4+PjI0fGM+Pj44JjB4ZmYwMHwoYyYweGZmMDApPDw4fGM8PDI0O3JldHVybiBhfX07XG5zamNsLmNvZGVjLnV0ZjhTdHJpbmc9e2Zyb21CaXRzOmZ1bmN0aW9uKGEpe3ZhciBiPVwiXCIsYz1zamNsLmJpdEFycmF5LmJpdExlbmd0aChhKSxkLGU7Zm9yKGQ9MDtkPGMvODtkKyspMD09PShkJjMpJiYoZT1hW2QvNF0pLGIrPVN0cmluZy5mcm9tQ2hhckNvZGUoZT4+PjI0KSxlPDw9ODtyZXR1cm4gZGVjb2RlVVJJQ29tcG9uZW50KGVzY2FwZShiKSl9LHRvQml0czpmdW5jdGlvbihhKXthPXVuZXNjYXBlKGVuY29kZVVSSUNvbXBvbmVudChhKSk7dmFyIGI9W10sYyxkPTA7Zm9yKGM9MDtjPGEubGVuZ3RoO2MrKylkPWQ8PDh8YS5jaGFyQ29kZUF0KGMpLDM9PT0oYyYzKSYmKGIucHVzaChkKSxkPTApO2MmMyYmYi5wdXNoKHNqY2wuYml0QXJyYXkucGFydGlhbCg4KihjJjMpLGQpKTtyZXR1cm4gYn19O1xuc2pjbC5jb2RlYy5oZXg9e2Zyb21CaXRzOmZ1bmN0aW9uKGEpe3ZhciBiPVwiXCIsYztmb3IoYz0wO2M8YS5sZW5ndGg7YysrKWIrPSgoYVtjXXwwKSsweGYwMDAwMDAwMDAwMCkudG9TdHJpbmcoMTYpLnN1YnN0cig0KTtyZXR1cm4gYi5zdWJzdHIoMCxzamNsLmJpdEFycmF5LmJpdExlbmd0aChhKS80KX0sdG9CaXRzOmZ1bmN0aW9uKGEpe3ZhciBiLGM9W10sZDthPWEucmVwbGFjZSgvXFxzfDB4L2csXCJcIik7ZD1hLmxlbmd0aDthKz1cIjAwMDAwMDAwXCI7Zm9yKGI9MDtiPGEubGVuZ3RoO2IrPTgpYy5wdXNoKHBhcnNlSW50KGEuc3Vic3RyKGIsOCksMTYpXjApO3JldHVybiBzamNsLmJpdEFycmF5LmNsYW1wKGMsNCpkKX19O1xuc2pjbC5jb2RlYy5iYXNlNjQ9e0o6XCJBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MDEyMzQ1Njc4OSsvXCIsZnJvbUJpdHM6ZnVuY3Rpb24oYSxiLGMpe3ZhciBkPVwiXCIsZT0wLGY9c2pjbC5jb2RlYy5iYXNlNjQuSixnPTAsaD1zamNsLmJpdEFycmF5LmJpdExlbmd0aChhKTtjJiYoZj1mLnN1YnN0cigwLDYyKStcIi1fXCIpO2ZvcihjPTA7NipkLmxlbmd0aDxoOylkKz1mLmNoYXJBdCgoZ15hW2NdPj4+ZSk+Pj4yNiksNj5lPyhnPWFbY108PDYtZSxlKz0yNixjKyspOihnPDw9NixlLT02KTtmb3IoO2QubGVuZ3RoJjMmJiFiOylkKz1cIj1cIjtyZXR1cm4gZH0sdG9CaXRzOmZ1bmN0aW9uKGEsYil7YT1hLnJlcGxhY2UoL1xcc3w9L2csXCJcIik7dmFyIGM9W10sZCxlPTAsZj1zamNsLmNvZGVjLmJhc2U2NC5KLGc9MCxoO2ImJihmPWYuc3Vic3RyKDAsNjIpK1wiLV9cIik7Zm9yKGQ9MDtkPGEubGVuZ3RoO2QrKyloPWYuaW5kZXhPZihhLmNoYXJBdChkKSksXG4wPmgmJnEobmV3IHNqY2wuZXhjZXB0aW9uLmludmFsaWQoXCJ0aGlzIGlzbid0IGJhc2U2NCFcIikpLDI2PGU/KGUtPTI2LGMucHVzaChnXmg+Pj5lKSxnPWg8PDMyLWUpOihlKz02LGdePWg8PDMyLWUpO2UmNTYmJmMucHVzaChzamNsLmJpdEFycmF5LnBhcnRpYWwoZSY1NixnLDEpKTtyZXR1cm4gY319O3NqY2wuY29kZWMuYmFzZTY0dXJsPXtmcm9tQml0czpmdW5jdGlvbihhKXtyZXR1cm4gc2pjbC5jb2RlYy5iYXNlNjQuZnJvbUJpdHMoYSwxLDEpfSx0b0JpdHM6ZnVuY3Rpb24oYSl7cmV0dXJuIHNqY2wuY29kZWMuYmFzZTY0LnRvQml0cyhhLDEpfX07c2pjbC5oYXNoLnNoYTI1Nj1mdW5jdGlvbihhKXt0aGlzLmJbMF18fHRoaXMuRCgpO2E/KHRoaXMucj1hLnIuc2xpY2UoMCksdGhpcy5vPWEuby5zbGljZSgwKSx0aGlzLmg9YS5oKTp0aGlzLnJlc2V0KCl9O3NqY2wuaGFzaC5zaGEyNTYuaGFzaD1mdW5jdGlvbihhKXtyZXR1cm4obmV3IHNqY2wuaGFzaC5zaGEyNTYpLnVwZGF0ZShhKS5maW5hbGl6ZSgpfTtcbnNqY2wuaGFzaC5zaGEyNTYucHJvdG90eXBlPXtibG9ja1NpemU6NTEyLHJlc2V0OmZ1bmN0aW9uKCl7dGhpcy5yPXRoaXMuTi5zbGljZSgwKTt0aGlzLm89W107dGhpcy5oPTA7cmV0dXJuIHRoaXN9LHVwZGF0ZTpmdW5jdGlvbihhKXtcInN0cmluZ1wiPT09dHlwZW9mIGEmJihhPXNqY2wuY29kZWMudXRmOFN0cmluZy50b0JpdHMoYSkpO3ZhciBiLGM9dGhpcy5vPXNqY2wuYml0QXJyYXkuY29uY2F0KHRoaXMubyxhKTtiPXRoaXMuaDthPXRoaXMuaD1iK3NqY2wuYml0QXJyYXkuYml0TGVuZ3RoKGEpO2ZvcihiPTUxMitiJi01MTI7Yjw9YTtiKz01MTIpeCh0aGlzLGMuc3BsaWNlKDAsMTYpKTtyZXR1cm4gdGhpc30sZmluYWxpemU6ZnVuY3Rpb24oKXt2YXIgYSxiPXRoaXMubyxjPXRoaXMucixiPXNqY2wuYml0QXJyYXkuY29uY2F0KGIsW3NqY2wuYml0QXJyYXkucGFydGlhbCgxLDEpXSk7Zm9yKGE9Yi5sZW5ndGgrMjthJjE1O2ErKyliLnB1c2goMCk7Yi5wdXNoKE1hdGguZmxvb3IodGhpcy5oL1xuNDI5NDk2NzI5NikpO2ZvcihiLnB1c2godGhpcy5ofDApO2IubGVuZ3RoOyl4KHRoaXMsYi5zcGxpY2UoMCwxNikpO3RoaXMucmVzZXQoKTtyZXR1cm4gY30sTjpbXSxiOltdLEQ6ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKGEpe3JldHVybiAweDEwMDAwMDAwMCooYS1NYXRoLmZsb29yKGEpKXwwfXZhciBiPTAsYz0yLGQ7YTpmb3IoOzY0PmI7YysrKXtmb3IoZD0yO2QqZDw9YztkKyspaWYoMD09PWMlZCljb250aW51ZSBhOzg+YiYmKHRoaXMuTltiXT1hKE1hdGgucG93KGMsMC41KSkpO3RoaXMuYltiXT1hKE1hdGgucG93KGMsMS8zKSk7YisrfX19O1xuZnVuY3Rpb24geChhLGIpe3ZhciBjLGQsZSxmPWIuc2xpY2UoMCksZz1hLnIsaD1hLmIsbD1nWzBdLGs9Z1sxXSxuPWdbMl0sbT1nWzNdLHA9Z1s0XSx0PWdbNV0scj1nWzZdLHY9Z1s3XTtmb3IoYz0wOzY0PmM7YysrKTE2PmM/ZD1mW2NdOihkPWZbYysxJjE1XSxlPWZbYysxNCYxNV0sZD1mW2MmMTVdPShkPj4+N15kPj4+MTheZD4+PjNeZDw8MjVeZDw8MTQpKyhlPj4+MTdeZT4+PjE5XmU+Pj4xMF5lPDwxNV5lPDwxMykrZltjJjE1XStmW2MrOSYxNV18MCksZD1kK3YrKHA+Pj42XnA+Pj4xMV5wPj4+MjVecDw8MjZecDw8MjFecDw8NykrKHJecCYodF5yKSkraFtjXSx2PXIscj10LHQ9cCxwPW0rZHwwLG09bixuPWssaz1sLGw9ZCsoayZuXm0mKGtebikpKyhrPj4+Ml5rPj4+MTNeaz4+PjIyXms8PDMwXms8PDE5Xms8PDEwKXwwO2dbMF09Z1swXStsfDA7Z1sxXT1nWzFdK2t8MDtnWzJdPWdbMl0rbnwwO2dbM109Z1szXSttfDA7Z1s0XT1nWzRdK3B8MDtnWzVdPWdbNV0rdHwwO2dbNl09XG5nWzZdK3J8MDtnWzddPWdbN10rdnwwfVxuc2pjbC5tb2RlLmNjbT17bmFtZTpcImNjbVwiLGVuY3J5cHQ6ZnVuY3Rpb24oYSxiLGMsZCxlKXt2YXIgZixnPWIuc2xpY2UoMCksaD1zamNsLmJpdEFycmF5LGw9aC5iaXRMZW5ndGgoYykvOCxrPWguYml0TGVuZ3RoKGcpLzg7ZT1lfHw2NDtkPWR8fFtdOzc+bCYmcShuZXcgc2pjbC5leGNlcHRpb24uaW52YWxpZChcImNjbTogaXYgbXVzdCBiZSBhdCBsZWFzdCA3IGJ5dGVzXCIpKTtmb3IoZj0yOzQ+ZiYmaz4+PjgqZjtmKyspO2Y8MTUtbCYmKGY9MTUtbCk7Yz1oLmNsYW1wKGMsOCooMTUtZikpO2I9c2pjbC5tb2RlLmNjbS5MKGEsYixjLGQsZSxmKTtnPXNqY2wubW9kZS5jY20ucChhLGcsYyxiLGUsZik7cmV0dXJuIGguY29uY2F0KGcuZGF0YSxnLnRhZyl9LGRlY3J5cHQ6ZnVuY3Rpb24oYSxiLGMsZCxlKXtlPWV8fDY0O2Q9ZHx8W107dmFyIGY9c2pjbC5iaXRBcnJheSxnPWYuYml0TGVuZ3RoKGMpLzgsaD1mLmJpdExlbmd0aChiKSxsPWYuY2xhbXAoYixoLWUpLGs9Zi5iaXRTbGljZShiLFxuaC1lKSxoPShoLWUpLzg7Nz5nJiZxKG5ldyBzamNsLmV4Y2VwdGlvbi5pbnZhbGlkKFwiY2NtOiBpdiBtdXN0IGJlIGF0IGxlYXN0IDcgYnl0ZXNcIikpO2ZvcihiPTI7ND5iJiZoPj4+OCpiO2IrKyk7YjwxNS1nJiYoYj0xNS1nKTtjPWYuY2xhbXAoYyw4KigxNS1iKSk7bD1zamNsLm1vZGUuY2NtLnAoYSxsLGMsayxlLGIpO2E9c2pjbC5tb2RlLmNjbS5MKGEsbC5kYXRhLGMsZCxlLGIpO2YuZXF1YWwobC50YWcsYSl8fHEobmV3IHNqY2wuZXhjZXB0aW9uLmNvcnJ1cHQoXCJjY206IHRhZyBkb2Vzbid0IG1hdGNoXCIpKTtyZXR1cm4gbC5kYXRhfSxMOmZ1bmN0aW9uKGEsYixjLGQsZSxmKXt2YXIgZz1bXSxoPXNqY2wuYml0QXJyYXksbD1oLmw7ZS89ODsoZSUyfHw0PmV8fDE2PGUpJiZxKG5ldyBzamNsLmV4Y2VwdGlvbi5pbnZhbGlkKFwiY2NtOiBpbnZhbGlkIHRhZyBsZW5ndGhcIikpOygweGZmZmZmZmZmPGQubGVuZ3RofHwweGZmZmZmZmZmPGIubGVuZ3RoKSYmcShuZXcgc2pjbC5leGNlcHRpb24uYnVnKFwiY2NtOiBjYW4ndCBkZWFsIHdpdGggNEdpQiBvciBtb3JlIGRhdGFcIikpO1xuZj1baC5wYXJ0aWFsKDgsKGQubGVuZ3RoPzY0OjApfGUtMjw8MnxmLTEpXTtmPWguY29uY2F0KGYsYyk7ZlszXXw9aC5iaXRMZW5ndGgoYikvODtmPWEuZW5jcnlwdChmKTtpZihkLmxlbmd0aCl7Yz1oLmJpdExlbmd0aChkKS84OzY1Mjc5Pj1jP2c9W2gucGFydGlhbCgxNixjKV06MHhmZmZmZmZmZj49YyYmKGc9aC5jb25jYXQoW2gucGFydGlhbCgxNiw2NTUzNCldLFtjXSkpO2c9aC5jb25jYXQoZyxkKTtmb3IoZD0wO2Q8Zy5sZW5ndGg7ZCs9NClmPWEuZW5jcnlwdChsKGYsZy5zbGljZShkLGQrNCkuY29uY2F0KFswLDAsMF0pKSl9Zm9yKGQ9MDtkPGIubGVuZ3RoO2QrPTQpZj1hLmVuY3J5cHQobChmLGIuc2xpY2UoZCxkKzQpLmNvbmNhdChbMCwwLDBdKSkpO3JldHVybiBoLmNsYW1wKGYsOCplKX0scDpmdW5jdGlvbihhLGIsYyxkLGUsZil7dmFyIGcsaD1zamNsLmJpdEFycmF5O2c9aC5sO3ZhciBsPWIubGVuZ3RoLGs9aC5iaXRMZW5ndGgoYik7Yz1oLmNvbmNhdChbaC5wYXJ0aWFsKDgsXG5mLTEpXSxjKS5jb25jYXQoWzAsMCwwXSkuc2xpY2UoMCw0KTtkPWguYml0U2xpY2UoZyhkLGEuZW5jcnlwdChjKSksMCxlKTtpZighbClyZXR1cm57dGFnOmQsZGF0YTpbXX07Zm9yKGc9MDtnPGw7Zys9NCljWzNdKyssZT1hLmVuY3J5cHQoYyksYltnXV49ZVswXSxiW2crMV1ePWVbMV0sYltnKzJdXj1lWzJdLGJbZyszXV49ZVszXTtyZXR1cm57dGFnOmQsZGF0YTpoLmNsYW1wKGIsayl9fX07XG5zamNsLm1vZGUub2NiMj17bmFtZTpcIm9jYjJcIixlbmNyeXB0OmZ1bmN0aW9uKGEsYixjLGQsZSxmKXsxMjghPT1zamNsLmJpdEFycmF5LmJpdExlbmd0aChjKSYmcShuZXcgc2pjbC5leGNlcHRpb24uaW52YWxpZChcIm9jYiBpdiBtdXN0IGJlIDEyOCBiaXRzXCIpKTt2YXIgZyxoPXNqY2wubW9kZS5vY2IyLkgsbD1zamNsLmJpdEFycmF5LGs9bC5sLG49WzAsMCwwLDBdO2M9aChhLmVuY3J5cHQoYykpO3ZhciBtLHA9W107ZD1kfHxbXTtlPWV8fDY0O2ZvcihnPTA7Zys0PGIubGVuZ3RoO2crPTQpbT1iLnNsaWNlKGcsZys0KSxuPWsobixtKSxwPXAuY29uY2F0KGsoYyxhLmVuY3J5cHQoayhjLG0pKSkpLGM9aChjKTttPWIuc2xpY2UoZyk7Yj1sLmJpdExlbmd0aChtKTtnPWEuZW5jcnlwdChrKGMsWzAsMCwwLGJdKSk7bT1sLmNsYW1wKGsobS5jb25jYXQoWzAsMCwwXSksZyksYik7bj1rKG4sayhtLmNvbmNhdChbMCwwLDBdKSxnKSk7bj1hLmVuY3J5cHQoayhuLGsoYyxoKGMpKSkpO2QubGVuZ3RoJiZcbihuPWsobixmP2Q6c2pjbC5tb2RlLm9jYjIucG1hYyhhLGQpKSk7cmV0dXJuIHAuY29uY2F0KGwuY29uY2F0KG0sbC5jbGFtcChuLGUpKSl9LGRlY3J5cHQ6ZnVuY3Rpb24oYSxiLGMsZCxlLGYpezEyOCE9PXNqY2wuYml0QXJyYXkuYml0TGVuZ3RoKGMpJiZxKG5ldyBzamNsLmV4Y2VwdGlvbi5pbnZhbGlkKFwib2NiIGl2IG11c3QgYmUgMTI4IGJpdHNcIikpO2U9ZXx8NjQ7dmFyIGc9c2pjbC5tb2RlLm9jYjIuSCxoPXNqY2wuYml0QXJyYXksbD1oLmwsaz1bMCwwLDAsMF0sbj1nKGEuZW5jcnlwdChjKSksbSxwLHQ9c2pjbC5iaXRBcnJheS5iaXRMZW5ndGgoYiktZSxyPVtdO2Q9ZHx8W107Zm9yKGM9MDtjKzQ8dC8zMjtjKz00KW09bChuLGEuZGVjcnlwdChsKG4sYi5zbGljZShjLGMrNCkpKSksaz1sKGssbSkscj1yLmNvbmNhdChtKSxuPWcobik7cD10LTMyKmM7bT1hLmVuY3J5cHQobChuLFswLDAsMCxwXSkpO209bChtLGguY2xhbXAoYi5zbGljZShjKSxwKS5jb25jYXQoWzAsMCwwXSkpO1xuaz1sKGssbSk7az1hLmVuY3J5cHQobChrLGwobixnKG4pKSkpO2QubGVuZ3RoJiYoaz1sKGssZj9kOnNqY2wubW9kZS5vY2IyLnBtYWMoYSxkKSkpO2guZXF1YWwoaC5jbGFtcChrLGUpLGguYml0U2xpY2UoYix0KSl8fHEobmV3IHNqY2wuZXhjZXB0aW9uLmNvcnJ1cHQoXCJvY2I6IHRhZyBkb2Vzbid0IG1hdGNoXCIpKTtyZXR1cm4gci5jb25jYXQoaC5jbGFtcChtLHApKX0scG1hYzpmdW5jdGlvbihhLGIpe3ZhciBjLGQ9c2pjbC5tb2RlLm9jYjIuSCxlPXNqY2wuYml0QXJyYXksZj1lLmwsZz1bMCwwLDAsMF0saD1hLmVuY3J5cHQoWzAsMCwwLDBdKSxoPWYoaCxkKGQoaCkpKTtmb3IoYz0wO2MrNDxiLmxlbmd0aDtjKz00KWg9ZChoKSxnPWYoZyxhLmVuY3J5cHQoZihoLGIuc2xpY2UoYyxjKzQpKSkpO2M9Yi5zbGljZShjKTsxMjg+ZS5iaXRMZW5ndGgoYykmJihoPWYoaCxkKGgpKSxjPWUuY29uY2F0KGMsWy0yMTQ3NDgzNjQ4LDAsMCwwXSkpO2c9ZihnLGMpO3JldHVybiBhLmVuY3J5cHQoZihkKGYoaCxcbmQoaCkpKSxnKSl9LEg6ZnVuY3Rpb24oYSl7cmV0dXJuW2FbMF08PDFeYVsxXT4+PjMxLGFbMV08PDFeYVsyXT4+PjMxLGFbMl08PDFeYVszXT4+PjMxLGFbM108PDFeMTM1KihhWzBdPj4+MzEpXX19O1xuc2pjbC5tb2RlLmdjbT17bmFtZTpcImdjbVwiLGVuY3J5cHQ6ZnVuY3Rpb24oYSxiLGMsZCxlKXt2YXIgZj1iLnNsaWNlKDApO2I9c2pjbC5iaXRBcnJheTtkPWR8fFtdO2E9c2pjbC5tb2RlLmdjbS5wKCEwLGEsZixkLGMsZXx8MTI4KTtyZXR1cm4gYi5jb25jYXQoYS5kYXRhLGEudGFnKX0sZGVjcnlwdDpmdW5jdGlvbihhLGIsYyxkLGUpe3ZhciBmPWIuc2xpY2UoMCksZz1zamNsLmJpdEFycmF5LGg9Zy5iaXRMZW5ndGgoZik7ZT1lfHwxMjg7ZD1kfHxbXTtlPD1oPyhiPWcuYml0U2xpY2UoZixoLWUpLGY9Zy5iaXRTbGljZShmLDAsaC1lKSk6KGI9ZixmPVtdKTthPXNqY2wubW9kZS5nY20ucCh1LGEsZixkLGMsZSk7Zy5lcXVhbChhLnRhZyxiKXx8cShuZXcgc2pjbC5leGNlcHRpb24uY29ycnVwdChcImdjbTogdGFnIGRvZXNuJ3QgbWF0Y2hcIikpO3JldHVybiBhLmRhdGF9LFo6ZnVuY3Rpb24oYSxiKXt2YXIgYyxkLGUsZixnLGg9c2pjbC5iaXRBcnJheS5sO2U9WzAsMCwwLDBdO2Y9Yi5zbGljZSgwKTtcbmZvcihjPTA7MTI4PmM7YysrKXsoZD0wIT09KGFbTWF0aC5mbG9vcihjLzMyKV0mMTw8MzEtYyUzMikpJiYoZT1oKGUsZikpO2c9MCE9PShmWzNdJjEpO2ZvcihkPTM7MDxkO2QtLSlmW2RdPWZbZF0+Pj4xfChmW2QtMV0mMSk8PDMxO2ZbMF0+Pj49MTtnJiYoZlswXV49LTB4MWYwMDAwMDApfXJldHVybiBlfSxnOmZ1bmN0aW9uKGEsYixjKXt2YXIgZCxlPWMubGVuZ3RoO2I9Yi5zbGljZSgwKTtmb3IoZD0wO2Q8ZTtkKz00KWJbMF1ePTB4ZmZmZmZmZmYmY1tkXSxiWzFdXj0weGZmZmZmZmZmJmNbZCsxXSxiWzJdXj0weGZmZmZmZmZmJmNbZCsyXSxiWzNdXj0weGZmZmZmZmZmJmNbZCszXSxiPXNqY2wubW9kZS5nY20uWihiLGEpO3JldHVybiBifSxwOmZ1bmN0aW9uKGEsYixjLGQsZSxmKXt2YXIgZyxoLGwsayxuLG0scCx0LHI9c2pjbC5iaXRBcnJheTttPWMubGVuZ3RoO3A9ci5iaXRMZW5ndGgoYyk7dD1yLmJpdExlbmd0aChkKTtoPXIuYml0TGVuZ3RoKGUpO2c9Yi5lbmNyeXB0KFswLFxuMCwwLDBdKTs5Nj09PWg/KGU9ZS5zbGljZSgwKSxlPXIuY29uY2F0KGUsWzFdKSk6KGU9c2pjbC5tb2RlLmdjbS5nKGcsWzAsMCwwLDBdLGUpLGU9c2pjbC5tb2RlLmdjbS5nKGcsZSxbMCwwLE1hdGguZmxvb3IoaC8weDEwMDAwMDAwMCksaCYweGZmZmZmZmZmXSkpO2g9c2pjbC5tb2RlLmdjbS5nKGcsWzAsMCwwLDBdLGQpO249ZS5zbGljZSgwKTtkPWguc2xpY2UoMCk7YXx8KGQ9c2pjbC5tb2RlLmdjbS5nKGcsaCxjKSk7Zm9yKGs9MDtrPG07ays9NCluWzNdKyssbD1iLmVuY3J5cHQobiksY1trXV49bFswXSxjW2srMV1ePWxbMV0sY1trKzJdXj1sWzJdLGNbayszXV49bFszXTtjPXIuY2xhbXAoYyxwKTthJiYoZD1zamNsLm1vZGUuZ2NtLmcoZyxoLGMpKTthPVtNYXRoLmZsb29yKHQvMHgxMDAwMDAwMDApLHQmMHhmZmZmZmZmZixNYXRoLmZsb29yKHAvMHgxMDAwMDAwMDApLHAmMHhmZmZmZmZmZl07ZD1zamNsLm1vZGUuZ2NtLmcoZyxkLGEpO2w9Yi5lbmNyeXB0KGUpO2RbMF1ePWxbMF07XG5kWzFdXj1sWzFdO2RbMl1ePWxbMl07ZFszXV49bFszXTtyZXR1cm57dGFnOnIuYml0U2xpY2UoZCwwLGYpLGRhdGE6Y319fTtzamNsLm1pc2MuaG1hYz1mdW5jdGlvbihhLGIpe3RoaXMuTT1iPWJ8fHNqY2wuaGFzaC5zaGEyNTY7dmFyIGM9W1tdLFtdXSxkLGU9Yi5wcm90b3R5cGUuYmxvY2tTaXplLzMyO3RoaXMubj1bbmV3IGIsbmV3IGJdO2EubGVuZ3RoPmUmJihhPWIuaGFzaChhKSk7Zm9yKGQ9MDtkPGU7ZCsrKWNbMF1bZF09YVtkXV45MDk1MjI0ODYsY1sxXVtkXT1hW2RdXjE1NDk1NTY4Mjg7dGhpcy5uWzBdLnVwZGF0ZShjWzBdKTt0aGlzLm5bMV0udXBkYXRlKGNbMV0pO3RoaXMuRz1uZXcgYih0aGlzLm5bMF0pfTtcbnNqY2wubWlzYy5obWFjLnByb3RvdHlwZS5lbmNyeXB0PXNqY2wubWlzYy5obWFjLnByb3RvdHlwZS5tYWM9ZnVuY3Rpb24oYSl7dGhpcy5RJiZxKG5ldyBzamNsLmV4Y2VwdGlvbi5pbnZhbGlkKFwiZW5jcnlwdCBvbiBhbHJlYWR5IHVwZGF0ZWQgaG1hYyBjYWxsZWQhXCIpKTt0aGlzLnVwZGF0ZShhKTtyZXR1cm4gdGhpcy5kaWdlc3QoYSl9O3NqY2wubWlzYy5obWFjLnByb3RvdHlwZS5yZXNldD1mdW5jdGlvbigpe3RoaXMuRz1uZXcgdGhpcy5NKHRoaXMublswXSk7dGhpcy5RPXV9O3NqY2wubWlzYy5obWFjLnByb3RvdHlwZS51cGRhdGU9ZnVuY3Rpb24oYSl7dGhpcy5RPSEwO3RoaXMuRy51cGRhdGUoYSl9O3NqY2wubWlzYy5obWFjLnByb3RvdHlwZS5kaWdlc3Q9ZnVuY3Rpb24oKXt2YXIgYT10aGlzLkcuZmluYWxpemUoKSxhPShuZXcgdGhpcy5NKHRoaXMublsxXSkpLnVwZGF0ZShhKS5maW5hbGl6ZSgpO3RoaXMucmVzZXQoKTtyZXR1cm4gYX07XG5zamNsLm1pc2MucGJrZGYyPWZ1bmN0aW9uKGEsYixjLGQsZSl7Yz1jfHwxRTM7KDA+ZHx8MD5jKSYmcShzamNsLmV4Y2VwdGlvbi5pbnZhbGlkKFwiaW52YWxpZCBwYXJhbXMgdG8gcGJrZGYyXCIpKTtcInN0cmluZ1wiPT09dHlwZW9mIGEmJihhPXNqY2wuY29kZWMudXRmOFN0cmluZy50b0JpdHMoYSkpO1wic3RyaW5nXCI9PT10eXBlb2YgYiYmKGI9c2pjbC5jb2RlYy51dGY4U3RyaW5nLnRvQml0cyhiKSk7ZT1lfHxzamNsLm1pc2MuaG1hYzthPW5ldyBlKGEpO3ZhciBmLGcsaCxsLGs9W10sbj1zamNsLmJpdEFycmF5O2ZvcihsPTE7MzIqay5sZW5ndGg8KGR8fDEpO2wrKyl7ZT1mPWEuZW5jcnlwdChuLmNvbmNhdChiLFtsXSkpO2ZvcihnPTE7ZzxjO2crKyl7Zj1hLmVuY3J5cHQoZik7Zm9yKGg9MDtoPGYubGVuZ3RoO2grKyllW2hdXj1mW2hdfWs9ay5jb25jYXQoZSl9ZCYmKGs9bi5jbGFtcChrLGQpKTtyZXR1cm4ga307XG5zamNsLnBybmc9ZnVuY3Rpb24oYSl7dGhpcy5jPVtuZXcgc2pjbC5oYXNoLnNoYTI1Nl07dGhpcy5pPVswXTt0aGlzLkY9MDt0aGlzLnM9e307dGhpcy5DPTA7dGhpcy5LPXt9O3RoaXMuTz10aGlzLmQ9dGhpcy5qPXRoaXMuVz0wO3RoaXMuYj1bMCwwLDAsMCwwLDAsMCwwXTt0aGlzLmY9WzAsMCwwLDBdO3RoaXMuQT1zO3RoaXMuQj1hO3RoaXMucT11O3RoaXMudz17cHJvZ3Jlc3M6e30sc2VlZGVkOnt9fTt0aGlzLm09dGhpcy5WPTA7dGhpcy50PTE7dGhpcy51PTI7dGhpcy5TPTB4MTAwMDA7dGhpcy5JPVswLDQ4LDY0LDk2LDEyOCwxOTIsMHgxMDAsMzg0LDUxMiw3NjgsMTAyNF07dGhpcy5UPTNFNDt0aGlzLlI9ODB9O1xuc2pjbC5wcm5nLnByb3RvdHlwZT17cmFuZG9tV29yZHM6ZnVuY3Rpb24oYSxiKXt2YXIgYz1bXSxkO2Q9dGhpcy5pc1JlYWR5KGIpO3ZhciBlO2Q9PT10aGlzLm0mJnEobmV3IHNqY2wuZXhjZXB0aW9uLm5vdFJlYWR5KFwiZ2VuZXJhdG9yIGlzbid0IHNlZWRlZFwiKSk7aWYoZCZ0aGlzLnUpe2Q9IShkJnRoaXMudCk7ZT1bXTt2YXIgZj0wLGc7dGhpcy5PPWVbMF09KG5ldyBEYXRlKS52YWx1ZU9mKCkrdGhpcy5UO2ZvcihnPTA7MTY+ZztnKyspZS5wdXNoKDB4MTAwMDAwMDAwKk1hdGgucmFuZG9tKCl8MCk7Zm9yKGc9MDtnPHRoaXMuYy5sZW5ndGgmJiEoZT1lLmNvbmNhdCh0aGlzLmNbZ10uZmluYWxpemUoKSksZis9dGhpcy5pW2ddLHRoaXMuaVtnXT0wLCFkJiZ0aGlzLkYmMTw8Zyk7ZysrKTt0aGlzLkY+PTE8PHRoaXMuYy5sZW5ndGgmJih0aGlzLmMucHVzaChuZXcgc2pjbC5oYXNoLnNoYTI1NiksdGhpcy5pLnB1c2goMCkpO3RoaXMuZC09ZjtmPnRoaXMuaiYmKHRoaXMuaj1mKTt0aGlzLkYrKztcbnRoaXMuYj1zamNsLmhhc2guc2hhMjU2Lmhhc2godGhpcy5iLmNvbmNhdChlKSk7dGhpcy5BPW5ldyBzamNsLmNpcGhlci5hZXModGhpcy5iKTtmb3IoZD0wOzQ+ZCYmISh0aGlzLmZbZF09dGhpcy5mW2RdKzF8MCx0aGlzLmZbZF0pO2QrKyk7fWZvcihkPTA7ZDxhO2QrPTQpMD09PShkKzEpJXRoaXMuUyYmQSh0aGlzKSxlPUIodGhpcyksYy5wdXNoKGVbMF0sZVsxXSxlWzJdLGVbM10pO0EodGhpcyk7cmV0dXJuIGMuc2xpY2UoMCxhKX0sc2V0RGVmYXVsdFBhcmFub2lhOmZ1bmN0aW9uKGEsYil7MD09PWEmJlwiU2V0dGluZyBwYXJhbm9pYT0wIHdpbGwgcnVpbiB5b3VyIHNlY3VyaXR5OyB1c2UgaXQgb25seSBmb3IgdGVzdGluZ1wiIT09YiYmcShcIlNldHRpbmcgcGFyYW5vaWE9MCB3aWxsIHJ1aW4geW91ciBzZWN1cml0eTsgdXNlIGl0IG9ubHkgZm9yIHRlc3RpbmdcIik7dGhpcy5CPWF9LGFkZEVudHJvcHk6ZnVuY3Rpb24oYSxiLGMpe2M9Y3x8XCJ1c2VyXCI7dmFyIGQsZSxmPShuZXcgRGF0ZSkudmFsdWVPZigpLFxuZz10aGlzLnNbY10saD10aGlzLmlzUmVhZHkoKSxsPTA7ZD10aGlzLktbY107ZD09PXMmJihkPXRoaXMuS1tjXT10aGlzLlcrKyk7Zz09PXMmJihnPXRoaXMuc1tjXT0wKTt0aGlzLnNbY109KHRoaXMuc1tjXSsxKSV0aGlzLmMubGVuZ3RoO3N3aXRjaCh0eXBlb2YgYSl7Y2FzZSBcIm51bWJlclwiOmI9PT1zJiYoYj0xKTt0aGlzLmNbZ10udXBkYXRlKFtkLHRoaXMuQysrLDEsYixmLDEsYXwwXSk7YnJlYWs7Y2FzZSBcIm9iamVjdFwiOmM9T2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKGEpO2lmKFwiW29iamVjdCBVaW50MzJBcnJheV1cIj09PWMpe2U9W107Zm9yKGM9MDtjPGEubGVuZ3RoO2MrKyllLnB1c2goYVtjXSk7YT1lfWVsc2V7XCJbb2JqZWN0IEFycmF5XVwiIT09YyYmKGw9MSk7Zm9yKGM9MDtjPGEubGVuZ3RoJiYhbDtjKyspXCJudW1iZXJcIiE9PXR5cGVvZiBhW2NdJiYobD0xKX1pZighbCl7aWYoYj09PXMpZm9yKGM9Yj0wO2M8YS5sZW5ndGg7YysrKWZvcihlPWFbY107MDxlOyliKyssXG5lPj4+PTE7dGhpcy5jW2ddLnVwZGF0ZShbZCx0aGlzLkMrKywyLGIsZixhLmxlbmd0aF0uY29uY2F0KGEpKX1icmVhaztjYXNlIFwic3RyaW5nXCI6Yj09PXMmJihiPWEubGVuZ3RoKTt0aGlzLmNbZ10udXBkYXRlKFtkLHRoaXMuQysrLDMsYixmLGEubGVuZ3RoXSk7dGhpcy5jW2ddLnVwZGF0ZShhKTticmVhaztkZWZhdWx0Omw9MX1sJiZxKG5ldyBzamNsLmV4Y2VwdGlvbi5idWcoXCJyYW5kb206IGFkZEVudHJvcHkgb25seSBzdXBwb3J0cyBudW1iZXIsIGFycmF5IG9mIG51bWJlcnMgb3Igc3RyaW5nXCIpKTt0aGlzLmlbZ10rPWI7dGhpcy5kKz1iO2g9PT10aGlzLm0mJih0aGlzLmlzUmVhZHkoKSE9PXRoaXMubSYmQyhcInNlZWRlZFwiLE1hdGgubWF4KHRoaXMuaix0aGlzLmQpKSxDKFwicHJvZ3Jlc3NcIix0aGlzLmdldFByb2dyZXNzKCkpKX0saXNSZWFkeTpmdW5jdGlvbihhKXthPXRoaXMuSVthIT09cz9hOnRoaXMuQl07cmV0dXJuIHRoaXMuaiYmdGhpcy5qPj1hP3RoaXMuaVswXT50aGlzLlImJlxuKG5ldyBEYXRlKS52YWx1ZU9mKCk+dGhpcy5PP3RoaXMudXx0aGlzLnQ6dGhpcy50OnRoaXMuZD49YT90aGlzLnV8dGhpcy5tOnRoaXMubX0sZ2V0UHJvZ3Jlc3M6ZnVuY3Rpb24oYSl7YT10aGlzLklbYT9hOnRoaXMuQl07cmV0dXJuIHRoaXMuaj49YT8xOnRoaXMuZD5hPzE6dGhpcy5kL2F9LHN0YXJ0Q29sbGVjdG9yczpmdW5jdGlvbigpe3RoaXMucXx8KHRoaXMuYT17bG9hZFRpbWVDb2xsZWN0b3I6RCh0aGlzLHRoaXMuYWEpLG1vdXNlQ29sbGVjdG9yOkQodGhpcyx0aGlzLmJhKSxrZXlib2FyZENvbGxlY3RvcjpEKHRoaXMsdGhpcy4kKSxhY2NlbGVyb21ldGVyQ29sbGVjdG9yOkQodGhpcyx0aGlzLlUpLHRvdWNoQ29sbGVjdG9yOkQodGhpcyx0aGlzLmRhKX0sd2luZG93LmFkZEV2ZW50TGlzdGVuZXI/KHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwibG9hZFwiLHRoaXMuYS5sb2FkVGltZUNvbGxlY3Rvcix1KSx3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlbW92ZVwiLHRoaXMuYS5tb3VzZUNvbGxlY3RvcixcbnUpLHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwia2V5cHJlc3NcIix0aGlzLmEua2V5Ym9hcmRDb2xsZWN0b3IsdSksd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJkZXZpY2Vtb3Rpb25cIix0aGlzLmEuYWNjZWxlcm9tZXRlckNvbGxlY3Rvcix1KSx3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcInRvdWNobW92ZVwiLHRoaXMuYS50b3VjaENvbGxlY3Rvcix1KSk6ZG9jdW1lbnQuYXR0YWNoRXZlbnQ/KGRvY3VtZW50LmF0dGFjaEV2ZW50KFwib25sb2FkXCIsdGhpcy5hLmxvYWRUaW1lQ29sbGVjdG9yKSxkb2N1bWVudC5hdHRhY2hFdmVudChcIm9ubW91c2Vtb3ZlXCIsdGhpcy5hLm1vdXNlQ29sbGVjdG9yKSxkb2N1bWVudC5hdHRhY2hFdmVudChcImtleXByZXNzXCIsdGhpcy5hLmtleWJvYXJkQ29sbGVjdG9yKSk6cShuZXcgc2pjbC5leGNlcHRpb24uYnVnKFwiY2FuJ3QgYXR0YWNoIGV2ZW50XCIpKSx0aGlzLnE9ITApfSxzdG9wQ29sbGVjdG9yczpmdW5jdGlvbigpe3RoaXMucSYmKHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyP1xuKHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKFwibG9hZFwiLHRoaXMuYS5sb2FkVGltZUNvbGxlY3Rvcix1KSx3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1vdXNlbW92ZVwiLHRoaXMuYS5tb3VzZUNvbGxlY3Rvcix1KSx3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImtleXByZXNzXCIsdGhpcy5hLmtleWJvYXJkQ29sbGVjdG9yLHUpLHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKFwiZGV2aWNlbW90aW9uXCIsdGhpcy5hLmFjY2VsZXJvbWV0ZXJDb2xsZWN0b3IsdSksd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJ0b3VjaG1vdmVcIix0aGlzLmEudG91Y2hDb2xsZWN0b3IsdSkpOmRvY3VtZW50LmRldGFjaEV2ZW50JiYoZG9jdW1lbnQuZGV0YWNoRXZlbnQoXCJvbmxvYWRcIix0aGlzLmEubG9hZFRpbWVDb2xsZWN0b3IpLGRvY3VtZW50LmRldGFjaEV2ZW50KFwib25tb3VzZW1vdmVcIix0aGlzLmEubW91c2VDb2xsZWN0b3IpLGRvY3VtZW50LmRldGFjaEV2ZW50KFwia2V5cHJlc3NcIixcbnRoaXMuYS5rZXlib2FyZENvbGxlY3RvcikpLHRoaXMucT11KX0sYWRkRXZlbnRMaXN0ZW5lcjpmdW5jdGlvbihhLGIpe3RoaXMud1thXVt0aGlzLlYrK109Yn0scmVtb3ZlRXZlbnRMaXN0ZW5lcjpmdW5jdGlvbihhLGIpe3ZhciBjLGQsZT10aGlzLndbYV0sZj1bXTtmb3IoZCBpbiBlKWUuaGFzT3duUHJvcGVydHkoZCkmJmVbZF09PT1iJiZmLnB1c2goZCk7Zm9yKGM9MDtjPGYubGVuZ3RoO2MrKylkPWZbY10sZGVsZXRlIGVbZF19LCQ6ZnVuY3Rpb24oKXtFKDEpfSxiYTpmdW5jdGlvbihhKXt2YXIgYixjO3RyeXtiPWEueHx8YS5jbGllbnRYfHxhLm9mZnNldFh8fDAsYz1hLnl8fGEuY2xpZW50WXx8YS5vZmZzZXRZfHwwfWNhdGNoKGQpe2M9Yj0wfTAhPWImJjAhPWMmJnNqY2wucmFuZG9tLmFkZEVudHJvcHkoW2IsY10sMixcIm1vdXNlXCIpO0UoMCl9LGRhOmZ1bmN0aW9uKGEpe2E9YS50b3VjaGVzWzBdfHxhLmNoYW5nZWRUb3VjaGVzWzBdO3NqY2wucmFuZG9tLmFkZEVudHJvcHkoW2EucGFnZVh8fFxuYS5jbGllbnRYLGEucGFnZVl8fGEuY2xpZW50WV0sMSxcInRvdWNoXCIpO0UoMCl9LGFhOmZ1bmN0aW9uKCl7RSgyKX0sVTpmdW5jdGlvbihhKXthPWEuYWNjZWxlcmF0aW9uSW5jbHVkaW5nR3Jhdml0eS54fHxhLmFjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHkueXx8YS5hY2NlbGVyYXRpb25JbmNsdWRpbmdHcmF2aXR5Lno7aWYod2luZG93Lm9yaWVudGF0aW9uKXt2YXIgYj13aW5kb3cub3JpZW50YXRpb247XCJudW1iZXJcIj09PXR5cGVvZiBiJiZzamNsLnJhbmRvbS5hZGRFbnRyb3B5KGIsMSxcImFjY2VsZXJvbWV0ZXJcIil9YSYmc2pjbC5yYW5kb20uYWRkRW50cm9weShhLDIsXCJhY2NlbGVyb21ldGVyXCIpO0UoMCl9fTtmdW5jdGlvbiBDKGEsYil7dmFyIGMsZD1zamNsLnJhbmRvbS53W2FdLGU9W107Zm9yKGMgaW4gZClkLmhhc093blByb3BlcnR5KGMpJiZlLnB1c2goZFtjXSk7Zm9yKGM9MDtjPGUubGVuZ3RoO2MrKyllW2NdKGIpfVxuZnVuY3Rpb24gRShhKXtcInVuZGVmaW5lZFwiIT09dHlwZW9mIHdpbmRvdyYmd2luZG93LnBlcmZvcm1hbmNlJiZcImZ1bmN0aW9uXCI9PT10eXBlb2Ygd2luZG93LnBlcmZvcm1hbmNlLm5vdz9zamNsLnJhbmRvbS5hZGRFbnRyb3B5KHdpbmRvdy5wZXJmb3JtYW5jZS5ub3coKSxhLFwibG9hZHRpbWVcIik6c2pjbC5yYW5kb20uYWRkRW50cm9weSgobmV3IERhdGUpLnZhbHVlT2YoKSxhLFwibG9hZHRpbWVcIil9ZnVuY3Rpb24gQShhKXthLmI9QihhKS5jb25jYXQoQihhKSk7YS5BPW5ldyBzamNsLmNpcGhlci5hZXMoYS5iKX1mdW5jdGlvbiBCKGEpe2Zvcih2YXIgYj0wOzQ+YiYmIShhLmZbYl09YS5mW2JdKzF8MCxhLmZbYl0pO2IrKyk7cmV0dXJuIGEuQS5lbmNyeXB0KGEuZil9ZnVuY3Rpb24gRChhLGIpe3JldHVybiBmdW5jdGlvbigpe2IuYXBwbHkoYSxhcmd1bWVudHMpfX1zamNsLnJhbmRvbT1uZXcgc2pjbC5wcm5nKDYpO1xuYTp0cnl7dmFyIEYsRyxILEk7aWYoST1cInVuZGVmaW5lZFwiIT09dHlwZW9mIG1vZHVsZSl7dmFyIEo7aWYoSj1tb2R1bGUuZXhwb3J0cyl7dmFyIEs7dHJ5e0s9cmVxdWlyZShcImNyeXB0b1wiKX1jYXRjaChMKXtLPW51bGx9Sj0oRz1LKSYmRy5yYW5kb21CeXRlc31JPUp9aWYoSSlGPUcucmFuZG9tQnl0ZXMoMTI4KSxGPW5ldyBVaW50MzJBcnJheSgobmV3IFVpbnQ4QXJyYXkoRikpLmJ1ZmZlciksc2pjbC5yYW5kb20uYWRkRW50cm9weShGLDEwMjQsXCJjcnlwdG9bJ3JhbmRvbUJ5dGVzJ11cIik7ZWxzZSBpZihcInVuZGVmaW5lZFwiIT09dHlwZW9mIHdpbmRvdyYmXCJ1bmRlZmluZWRcIiE9PXR5cGVvZiBVaW50MzJBcnJheSl7SD1uZXcgVWludDMyQXJyYXkoMzIpO2lmKHdpbmRvdy5jcnlwdG8mJndpbmRvdy5jcnlwdG8uZ2V0UmFuZG9tVmFsdWVzKXdpbmRvdy5jcnlwdG8uZ2V0UmFuZG9tVmFsdWVzKEgpO2Vsc2UgaWYod2luZG93Lm1zQ3J5cHRvJiZ3aW5kb3cubXNDcnlwdG8uZ2V0UmFuZG9tVmFsdWVzKXdpbmRvdy5tc0NyeXB0by5nZXRSYW5kb21WYWx1ZXMoSCk7XG5lbHNlIGJyZWFrIGE7c2pjbC5yYW5kb20uYWRkRW50cm9weShILDEwMjQsXCJjcnlwdG9bJ2dldFJhbmRvbVZhbHVlcyddXCIpfX1jYXRjaChNKXtcInVuZGVmaW5lZFwiIT09dHlwZW9mIHdpbmRvdyYmd2luZG93LmNvbnNvbGUmJihjb25zb2xlLmxvZyhcIlRoZXJlIHdhcyBhbiBlcnJvciBjb2xsZWN0aW5nIGVudHJvcHkgZnJvbSB0aGUgYnJvd3NlcjpcIiksY29uc29sZS5sb2coTSkpfVxuc2pjbC5qc29uPXtkZWZhdWx0czp7djoxLGl0ZXI6MUUzLGtzOjEyOCx0czo2NCxtb2RlOlwiY2NtXCIsYWRhdGE6XCJcIixjaXBoZXI6XCJhZXNcIn0sWTpmdW5jdGlvbihhLGIsYyxkKXtjPWN8fHt9O2Q9ZHx8e307dmFyIGU9c2pjbC5qc29uLGY9ZS5lKHtpdjpzamNsLnJhbmRvbS5yYW5kb21Xb3Jkcyg0LDApfSxlLmRlZmF1bHRzKSxnO2UuZShmLGMpO2M9Zi5hZGF0YTtcInN0cmluZ1wiPT09dHlwZW9mIGYuc2FsdCYmKGYuc2FsdD1zamNsLmNvZGVjLmJhc2U2NC50b0JpdHMoZi5zYWx0KSk7XCJzdHJpbmdcIj09PXR5cGVvZiBmLml2JiYoZi5pdj1zamNsLmNvZGVjLmJhc2U2NC50b0JpdHMoZi5pdikpOyghc2pjbC5tb2RlW2YubW9kZV18fCFzamNsLmNpcGhlcltmLmNpcGhlcl18fFwic3RyaW5nXCI9PT10eXBlb2YgYSYmMTAwPj1mLml0ZXJ8fDY0IT09Zi50cyYmOTYhPT1mLnRzJiYxMjghPT1mLnRzfHwxMjghPT1mLmtzJiYxOTIhPT1mLmtzJiYweDEwMCE9PWYua3N8fDI+Zi5pdi5sZW5ndGh8fDQ8XG5mLml2Lmxlbmd0aCkmJnEobmV3IHNqY2wuZXhjZXB0aW9uLmludmFsaWQoXCJqc29uIGVuY3J5cHQ6IGludmFsaWQgcGFyYW1ldGVyc1wiKSk7XCJzdHJpbmdcIj09PXR5cGVvZiBhPyhnPXNqY2wubWlzYy5jYWNoZWRQYmtkZjIoYSxmKSxhPWcua2V5LnNsaWNlKDAsZi5rcy8zMiksZi5zYWx0PWcuc2FsdCk6c2pjbC5lY2MmJmEgaW5zdGFuY2VvZiBzamNsLmVjYy5lbEdhbWFsLnB1YmxpY0tleSYmKGc9YS5rZW0oKSxmLmtlbXRhZz1nLnRhZyxhPWcua2V5LnNsaWNlKDAsZi5rcy8zMikpO1wic3RyaW5nXCI9PT10eXBlb2YgYiYmKGI9c2pjbC5jb2RlYy51dGY4U3RyaW5nLnRvQml0cyhiKSk7XCJzdHJpbmdcIj09PXR5cGVvZiBjJiYoZi5hZGF0YT1jPXNqY2wuY29kZWMudXRmOFN0cmluZy50b0JpdHMoYykpO2c9bmV3IHNqY2wuY2lwaGVyW2YuY2lwaGVyXShhKTtlLmUoZCxmKTtkLmtleT1hO2YuY3Q9c2pjbC5tb2RlW2YubW9kZV0uZW5jcnlwdChnLGIsZi5pdixjLGYudHMpO3JldHVybiBmfSxcbmVuY3J5cHQ6ZnVuY3Rpb24oYSxiLGMsZCl7dmFyIGU9c2pjbC5qc29uLGY9ZS5ZLmFwcGx5KGUsYXJndW1lbnRzKTtyZXR1cm4gZS5lbmNvZGUoZil9LFg6ZnVuY3Rpb24oYSxiLGMsZCl7Yz1jfHx7fTtkPWR8fHt9O3ZhciBlPXNqY2wuanNvbjtiPWUuZShlLmUoZS5lKHt9LGUuZGVmYXVsdHMpLGIpLGMsITApO3ZhciBmLGc7Zj1iLmFkYXRhO1wic3RyaW5nXCI9PT10eXBlb2YgYi5zYWx0JiYoYi5zYWx0PXNqY2wuY29kZWMuYmFzZTY0LnRvQml0cyhiLnNhbHQpKTtcInN0cmluZ1wiPT09dHlwZW9mIGIuaXYmJihiLml2PXNqY2wuY29kZWMuYmFzZTY0LnRvQml0cyhiLml2KSk7KCFzamNsLm1vZGVbYi5tb2RlXXx8IXNqY2wuY2lwaGVyW2IuY2lwaGVyXXx8XCJzdHJpbmdcIj09PXR5cGVvZiBhJiYxMDA+PWIuaXRlcnx8NjQhPT1iLnRzJiY5NiE9PWIudHMmJjEyOCE9PWIudHN8fDEyOCE9PWIua3MmJjE5MiE9PWIua3MmJjB4MTAwIT09Yi5rc3x8IWIuaXZ8fDI+Yi5pdi5sZW5ndGh8fDQ8Yi5pdi5sZW5ndGgpJiZcbnEobmV3IHNqY2wuZXhjZXB0aW9uLmludmFsaWQoXCJqc29uIGRlY3J5cHQ6IGludmFsaWQgcGFyYW1ldGVyc1wiKSk7XCJzdHJpbmdcIj09PXR5cGVvZiBhPyhnPXNqY2wubWlzYy5jYWNoZWRQYmtkZjIoYSxiKSxhPWcua2V5LnNsaWNlKDAsYi5rcy8zMiksYi5zYWx0PWcuc2FsdCk6c2pjbC5lY2MmJmEgaW5zdGFuY2VvZiBzamNsLmVjYy5lbEdhbWFsLnNlY3JldEtleSYmKGE9YS51bmtlbShzamNsLmNvZGVjLmJhc2U2NC50b0JpdHMoYi5rZW10YWcpKS5zbGljZSgwLGIua3MvMzIpKTtcInN0cmluZ1wiPT09dHlwZW9mIGYmJihmPXNqY2wuY29kZWMudXRmOFN0cmluZy50b0JpdHMoZikpO2c9bmV3IHNqY2wuY2lwaGVyW2IuY2lwaGVyXShhKTtmPXNqY2wubW9kZVtiLm1vZGVdLmRlY3J5cHQoZyxiLmN0LGIuaXYsZixiLnRzKTtlLmUoZCxiKTtkLmtleT1hO3JldHVybiAxPT09Yy5yYXc/ZjpzamNsLmNvZGVjLnV0ZjhTdHJpbmcuZnJvbUJpdHMoZil9LGRlY3J5cHQ6ZnVuY3Rpb24oYSxiLFxuYyxkKXt2YXIgZT1zamNsLmpzb247cmV0dXJuIGUuWChhLGUuZGVjb2RlKGIpLGMsZCl9LGVuY29kZTpmdW5jdGlvbihhKXt2YXIgYixjPVwie1wiLGQ9XCJcIjtmb3IoYiBpbiBhKWlmKGEuaGFzT3duUHJvcGVydHkoYikpc3dpdGNoKGIubWF0Y2goL15bYS16MC05XSskL2kpfHxxKG5ldyBzamNsLmV4Y2VwdGlvbi5pbnZhbGlkKFwianNvbiBlbmNvZGU6IGludmFsaWQgcHJvcGVydHkgbmFtZVwiKSksYys9ZCsnXCInK2IrJ1wiOicsZD1cIixcIix0eXBlb2YgYVtiXSl7Y2FzZSBcIm51bWJlclwiOmNhc2UgXCJib29sZWFuXCI6Yys9YVtiXTticmVhaztjYXNlIFwic3RyaW5nXCI6Yys9J1wiJytlc2NhcGUoYVtiXSkrJ1wiJzticmVhaztjYXNlIFwib2JqZWN0XCI6Yys9J1wiJytzamNsLmNvZGVjLmJhc2U2NC5mcm9tQml0cyhhW2JdLDApKydcIic7YnJlYWs7ZGVmYXVsdDpxKG5ldyBzamNsLmV4Y2VwdGlvbi5idWcoXCJqc29uIGVuY29kZTogdW5zdXBwb3J0ZWQgdHlwZVwiKSl9cmV0dXJuIGMrXCJ9XCJ9LGRlY29kZTpmdW5jdGlvbihhKXthPVxuYS5yZXBsYWNlKC9cXHMvZyxcIlwiKTthLm1hdGNoKC9eXFx7LipcXH0kLyl8fHEobmV3IHNqY2wuZXhjZXB0aW9uLmludmFsaWQoXCJqc29uIGRlY29kZTogdGhpcyBpc24ndCBqc29uIVwiKSk7YT1hLnJlcGxhY2UoL15cXHt8XFx9JC9nLFwiXCIpLnNwbGl0KC8sLyk7dmFyIGI9e30sYyxkO2ZvcihjPTA7YzxhLmxlbmd0aDtjKyspKGQ9YVtjXS5tYXRjaCgvXlxccyooPzooW1wiJ10/KShbYS16XVthLXowLTldKilcXDEpXFxzKjpcXHMqKD86KC0/XFxkKyl8XCIoW2EtejAtOStcXC8lKl8uQD1cXC1dKilcInwodHJ1ZXxmYWxzZSkpJC9pKSl8fHEobmV3IHNqY2wuZXhjZXB0aW9uLmludmFsaWQoXCJqc29uIGRlY29kZTogdGhpcyBpc24ndCBqc29uIVwiKSksZFszXT9iW2RbMl1dPXBhcnNlSW50KGRbM10sMTApOmRbNF0/YltkWzJdXT1kWzJdLm1hdGNoKC9eKGN0fGFkYXRhfHNhbHR8aXYpJC8pP3NqY2wuY29kZWMuYmFzZTY0LnRvQml0cyhkWzRdKTp1bmVzY2FwZShkWzRdKTpkWzVdJiYoYltkWzJdXT1cInRydWVcIj09PVxuZFs1XSk7cmV0dXJuIGJ9LGU6ZnVuY3Rpb24oYSxiLGMpe2E9PT1zJiYoYT17fSk7aWYoYj09PXMpcmV0dXJuIGE7Zm9yKHZhciBkIGluIGIpYi5oYXNPd25Qcm9wZXJ0eShkKSYmKGMmJihhW2RdIT09cyYmYVtkXSE9PWJbZF0pJiZxKG5ldyBzamNsLmV4Y2VwdGlvbi5pbnZhbGlkKFwicmVxdWlyZWQgcGFyYW1ldGVyIG92ZXJyaWRkZW5cIikpLGFbZF09YltkXSk7cmV0dXJuIGF9LGZhOmZ1bmN0aW9uKGEsYil7dmFyIGM9e30sZDtmb3IoZCBpbiBhKWEuaGFzT3duUHJvcGVydHkoZCkmJmFbZF0hPT1iW2RdJiYoY1tkXT1hW2RdKTtyZXR1cm4gY30sZWE6ZnVuY3Rpb24oYSxiKXt2YXIgYz17fSxkO2ZvcihkPTA7ZDxiLmxlbmd0aDtkKyspYVtiW2RdXSE9PXMmJihjW2JbZF1dPWFbYltkXV0pO3JldHVybiBjfX07c2pjbC5lbmNyeXB0PXNqY2wuanNvbi5lbmNyeXB0O3NqY2wuZGVjcnlwdD1zamNsLmpzb24uZGVjcnlwdDtzamNsLm1pc2MuY2E9e307XG5zamNsLm1pc2MuY2FjaGVkUGJrZGYyPWZ1bmN0aW9uKGEsYil7dmFyIGM9c2pjbC5taXNjLmNhLGQ7Yj1ifHx7fTtkPWIuaXRlcnx8MUUzO2M9Y1thXT1jW2FdfHx7fTtkPWNbZF09Y1tkXXx8e2ZpcnN0U2FsdDpiLnNhbHQmJmIuc2FsdC5sZW5ndGg/Yi5zYWx0LnNsaWNlKDApOnNqY2wucmFuZG9tLnJhbmRvbVdvcmRzKDIsMCl9O2M9Yi5zYWx0PT09cz9kLmZpcnN0U2FsdDpiLnNhbHQ7ZFtjXT1kW2NdfHxzamNsLm1pc2MucGJrZGYyKGEsYyxiLml0ZXIpO3JldHVybntrZXk6ZFtjXS5zbGljZSgwKSxzYWx0OmMuc2xpY2UoMCl9fTtcbiJdfQ==

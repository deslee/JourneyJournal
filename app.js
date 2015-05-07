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
		return;
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


},{"../utilities/gapiHandler":14,"moment":24,"react-router":"vYZgCY","react/addons":"yutbdK"}],2:[function(require,module,exports){
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
			alertify.notify('saving...', 'save', 1)
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
				React.createElement("div", {className: "journey_toolbar entry_tags_input" + (this.state.focused ? ' hide':'')}, 
					React.createElement("input", {className: "", onInput: this.tagsInputChanged, onKeyDown: this.tagKeyDown, ref: "tags"})
				)
			)
		);
	}
});


},{"../utilities/dates":10,"../utilities/decryptEntry":11,"../utilities/encryptEntry":12,"alertifyjs":"YeVBtY","moment":24,"react-router":"vYZgCY","react/addons":"yutbdK"}],4:[function(require,module,exports){
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


},{"../utilities/decryptEntry":11,"moment":24,"react-router":"vYZgCY","react/addons":"yutbdK"}],5:[function(require,module,exports){
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
		alertify.confirm(message).set('title', 'Delete Journal').set('labels', {ok:'Yes', cancel:'No'}).set('onok', function(){

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



},{"./authenticate":9,"alertifyjs":"YeVBtY","pouchdb":"Ztn7p+","react-router":"vYZgCY","react/addons":"yutbdK","sjcl":25}],8:[function(require,module,exports){
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


},{"sjcl":25}],12:[function(require,module,exports){
var sjcl = require('sjcl')

module.exports = function(key, entry) {
	entry.content = sjcl.encrypt(key, entry.content)
	if (entry.datetime) {
		entry.datetime = sjcl.encrypt(key, entry.datetime)
	}
	entry.tags = sjcl.encrypt(key, entry.tags.join(','))
	return entry;
}


},{"sjcl":25}],13:[function(require,module,exports){
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
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      nBits = -7,
      i = isLE ? (nBytes - 1) : 0,
      d = isLE ? -1 : 1,
      s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0),
      i = isLE ? 0 : (nBytes - 1),
      d = isLE ? 1 : -1,
      s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

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
//! moment.js
//! version : 2.10.2
//! authors : Tim Wood, Iskren Chernev, Moment.js contributors
//! license : MIT
//! momentjs.com

(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    global.moment = factory()
}(this, function () { 'use strict';

    var hookCallback;

    function utils_hooks__hooks () {
        return hookCallback.apply(null, arguments);
    }

    // This is done to register the method called with moment()
    // without creating circular dependencies.
    function setHookCallback (callback) {
        hookCallback = callback;
    }

    function defaultParsingFlags() {
        // We need to deep clone this object.
        return {
            empty           : false,
            unusedTokens    : [],
            unusedInput     : [],
            overflow        : -2,
            charsLeftOver   : 0,
            nullInput       : false,
            invalidMonth    : null,
            invalidFormat   : false,
            userInvalidated : false,
            iso             : false
        };
    }

    function isArray(input) {
        return Object.prototype.toString.call(input) === '[object Array]';
    }

    function isDate(input) {
        return Object.prototype.toString.call(input) === '[object Date]' || input instanceof Date;
    }

    function map(arr, fn) {
        var res = [], i;
        for (i = 0; i < arr.length; ++i) {
            res.push(fn(arr[i], i));
        }
        return res;
    }

    function hasOwnProp(a, b) {
        return Object.prototype.hasOwnProperty.call(a, b);
    }

    function extend(a, b) {
        for (var i in b) {
            if (hasOwnProp(b, i)) {
                a[i] = b[i];
            }
        }

        if (hasOwnProp(b, 'toString')) {
            a.toString = b.toString;
        }

        if (hasOwnProp(b, 'valueOf')) {
            a.valueOf = b.valueOf;
        }

        return a;
    }

    function create_utc__createUTC (input, format, locale, strict) {
        return createLocalOrUTC(input, format, locale, strict, true).utc();
    }

    function valid__isValid(m) {
        if (m._isValid == null) {
            m._isValid = !isNaN(m._d.getTime()) &&
                m._pf.overflow < 0 &&
                !m._pf.empty &&
                !m._pf.invalidMonth &&
                !m._pf.nullInput &&
                !m._pf.invalidFormat &&
                !m._pf.userInvalidated;

            if (m._strict) {
                m._isValid = m._isValid &&
                    m._pf.charsLeftOver === 0 &&
                    m._pf.unusedTokens.length === 0 &&
                    m._pf.bigHour === undefined;
            }
        }
        return m._isValid;
    }

    function valid__createInvalid (flags) {
        var m = create_utc__createUTC(NaN);
        if (flags != null) {
            extend(m._pf, flags);
        }
        else {
            m._pf.userInvalidated = true;
        }

        return m;
    }

    var momentProperties = utils_hooks__hooks.momentProperties = [];

    function copyConfig(to, from) {
        var i, prop, val;

        if (typeof from._isAMomentObject !== 'undefined') {
            to._isAMomentObject = from._isAMomentObject;
        }
        if (typeof from._i !== 'undefined') {
            to._i = from._i;
        }
        if (typeof from._f !== 'undefined') {
            to._f = from._f;
        }
        if (typeof from._l !== 'undefined') {
            to._l = from._l;
        }
        if (typeof from._strict !== 'undefined') {
            to._strict = from._strict;
        }
        if (typeof from._tzm !== 'undefined') {
            to._tzm = from._tzm;
        }
        if (typeof from._isUTC !== 'undefined') {
            to._isUTC = from._isUTC;
        }
        if (typeof from._offset !== 'undefined') {
            to._offset = from._offset;
        }
        if (typeof from._pf !== 'undefined') {
            to._pf = from._pf;
        }
        if (typeof from._locale !== 'undefined') {
            to._locale = from._locale;
        }

        if (momentProperties.length > 0) {
            for (i in momentProperties) {
                prop = momentProperties[i];
                val = from[prop];
                if (typeof val !== 'undefined') {
                    to[prop] = val;
                }
            }
        }

        return to;
    }

    var updateInProgress = false;

    // Moment prototype object
    function Moment(config) {
        copyConfig(this, config);
        this._d = new Date(+config._d);
        // Prevent infinite loop in case updateOffset creates new moment
        // objects.
        if (updateInProgress === false) {
            updateInProgress = true;
            utils_hooks__hooks.updateOffset(this);
            updateInProgress = false;
        }
    }

    function isMoment (obj) {
        return obj instanceof Moment || (obj != null && hasOwnProp(obj, '_isAMomentObject'));
    }

    function toInt(argumentForCoercion) {
        var coercedNumber = +argumentForCoercion,
            value = 0;

        if (coercedNumber !== 0 && isFinite(coercedNumber)) {
            if (coercedNumber >= 0) {
                value = Math.floor(coercedNumber);
            } else {
                value = Math.ceil(coercedNumber);
            }
        }

        return value;
    }

    function compareArrays(array1, array2, dontConvert) {
        var len = Math.min(array1.length, array2.length),
            lengthDiff = Math.abs(array1.length - array2.length),
            diffs = 0,
            i;
        for (i = 0; i < len; i++) {
            if ((dontConvert && array1[i] !== array2[i]) ||
                (!dontConvert && toInt(array1[i]) !== toInt(array2[i]))) {
                diffs++;
            }
        }
        return diffs + lengthDiff;
    }

    function Locale() {
    }

    var locales = {};
    var globalLocale;

    function normalizeLocale(key) {
        return key ? key.toLowerCase().replace('_', '-') : key;
    }

    // pick the locale from the array
    // try ['en-au', 'en-gb'] as 'en-au', 'en-gb', 'en', as in move through the list trying each
    // substring from most specific to least, but move to the next array item if it's a more specific variant than the current root
    function chooseLocale(names) {
        var i = 0, j, next, locale, split;

        while (i < names.length) {
            split = normalizeLocale(names[i]).split('-');
            j = split.length;
            next = normalizeLocale(names[i + 1]);
            next = next ? next.split('-') : null;
            while (j > 0) {
                locale = loadLocale(split.slice(0, j).join('-'));
                if (locale) {
                    return locale;
                }
                if (next && next.length >= j && compareArrays(split, next, true) >= j - 1) {
                    //the next array item is better than a shallower substring of this one
                    break;
                }
                j--;
            }
            i++;
        }
        return null;
    }

    function loadLocale(name) {
        var oldLocale = null;
        // TODO: Find a better way to register and load all the locales in Node
        if (!locales[name] && typeof module !== 'undefined' &&
                module && module.exports) {
            try {
                oldLocale = globalLocale._abbr;
                require('./locale/' + name);
                // because defineLocale currently also sets the global locale, we
                // want to undo that for lazy loaded locales
                locale_locales__getSetGlobalLocale(oldLocale);
            } catch (e) { }
        }
        return locales[name];
    }

    // This function will load locale and then set the global locale.  If
    // no arguments are passed in, it will simply return the current global
    // locale key.
    function locale_locales__getSetGlobalLocale (key, values) {
        var data;
        if (key) {
            if (typeof values === 'undefined') {
                data = locale_locales__getLocale(key);
            }
            else {
                data = defineLocale(key, values);
            }

            if (data) {
                // moment.duration._locale = moment._locale = data;
                globalLocale = data;
            }
        }

        return globalLocale._abbr;
    }

    function defineLocale (name, values) {
        if (values !== null) {
            values.abbr = name;
            if (!locales[name]) {
                locales[name] = new Locale();
            }
            locales[name].set(values);

            // backwards compat for now: also set the locale
            locale_locales__getSetGlobalLocale(name);

            return locales[name];
        } else {
            // useful for testing
            delete locales[name];
            return null;
        }
    }

    // returns locale data
    function locale_locales__getLocale (key) {
        var locale;

        if (key && key._locale && key._locale._abbr) {
            key = key._locale._abbr;
        }

        if (!key) {
            return globalLocale;
        }

        if (!isArray(key)) {
            //short-circuit everything else
            locale = loadLocale(key);
            if (locale) {
                return locale;
            }
            key = [key];
        }

        return chooseLocale(key);
    }

    var aliases = {};

    function addUnitAlias (unit, shorthand) {
        var lowerCase = unit.toLowerCase();
        aliases[lowerCase] = aliases[lowerCase + 's'] = aliases[shorthand] = unit;
    }

    function normalizeUnits(units) {
        return typeof units === 'string' ? aliases[units] || aliases[units.toLowerCase()] : undefined;
    }

    function normalizeObjectUnits(inputObject) {
        var normalizedInput = {},
            normalizedProp,
            prop;

        for (prop in inputObject) {
            if (hasOwnProp(inputObject, prop)) {
                normalizedProp = normalizeUnits(prop);
                if (normalizedProp) {
                    normalizedInput[normalizedProp] = inputObject[prop];
                }
            }
        }

        return normalizedInput;
    }

    function makeGetSet (unit, keepTime) {
        return function (value) {
            if (value != null) {
                get_set__set(this, unit, value);
                utils_hooks__hooks.updateOffset(this, keepTime);
                return this;
            } else {
                return get_set__get(this, unit);
            }
        };
    }

    function get_set__get (mom, unit) {
        return mom._d['get' + (mom._isUTC ? 'UTC' : '') + unit]();
    }

    function get_set__set (mom, unit, value) {
        return mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value);
    }

    // MOMENTS

    function getSet (units, value) {
        var unit;
        if (typeof units === 'object') {
            for (unit in units) {
                this.set(unit, units[unit]);
            }
        } else {
            units = normalizeUnits(units);
            if (typeof this[units] === 'function') {
                return this[units](value);
            }
        }
        return this;
    }

    function zeroFill(number, targetLength, forceSign) {
        var output = '' + Math.abs(number),
            sign = number >= 0;

        while (output.length < targetLength) {
            output = '0' + output;
        }
        return (sign ? (forceSign ? '+' : '') : '-') + output;
    }

    var formattingTokens = /(\[[^\[]*\])|(\\)?(Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|Q|YYYYYY|YYYYY|YYYY|YY|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|mm?|ss?|S{1,4}|x|X|zz?|ZZ?|.)/g;

    var localFormattingTokens = /(\[[^\[]*\])|(\\)?(LTS|LT|LL?L?L?|l{1,4})/g;

    var formatFunctions = {};

    var formatTokenFunctions = {};

    // token:    'M'
    // padded:   ['MM', 2]
    // ordinal:  'Mo'
    // callback: function () { this.month() + 1 }
    function addFormatToken (token, padded, ordinal, callback) {
        var func = callback;
        if (typeof callback === 'string') {
            func = function () {
                return this[callback]();
            };
        }
        if (token) {
            formatTokenFunctions[token] = func;
        }
        if (padded) {
            formatTokenFunctions[padded[0]] = function () {
                return zeroFill(func.apply(this, arguments), padded[1], padded[2]);
            };
        }
        if (ordinal) {
            formatTokenFunctions[ordinal] = function () {
                return this.localeData().ordinal(func.apply(this, arguments), token);
            };
        }
    }

    function removeFormattingTokens(input) {
        if (input.match(/\[[\s\S]/)) {
            return input.replace(/^\[|\]$/g, '');
        }
        return input.replace(/\\/g, '');
    }

    function makeFormatFunction(format) {
        var array = format.match(formattingTokens), i, length;

        for (i = 0, length = array.length; i < length; i++) {
            if (formatTokenFunctions[array[i]]) {
                array[i] = formatTokenFunctions[array[i]];
            } else {
                array[i] = removeFormattingTokens(array[i]);
            }
        }

        return function (mom) {
            var output = '';
            for (i = 0; i < length; i++) {
                output += array[i] instanceof Function ? array[i].call(mom, format) : array[i];
            }
            return output;
        };
    }

    // format date using native date object
    function formatMoment(m, format) {
        if (!m.isValid()) {
            return m.localeData().invalidDate();
        }

        format = expandFormat(format, m.localeData());

        if (!formatFunctions[format]) {
            formatFunctions[format] = makeFormatFunction(format);
        }

        return formatFunctions[format](m);
    }

    function expandFormat(format, locale) {
        var i = 5;

        function replaceLongDateFormatTokens(input) {
            return locale.longDateFormat(input) || input;
        }

        localFormattingTokens.lastIndex = 0;
        while (i >= 0 && localFormattingTokens.test(format)) {
            format = format.replace(localFormattingTokens, replaceLongDateFormatTokens);
            localFormattingTokens.lastIndex = 0;
            i -= 1;
        }

        return format;
    }

    var match1         = /\d/;            //       0 - 9
    var match2         = /\d\d/;          //      00 - 99
    var match3         = /\d{3}/;         //     000 - 999
    var match4         = /\d{4}/;         //    0000 - 9999
    var match6         = /[+-]?\d{6}/;    // -999999 - 999999
    var match1to2      = /\d\d?/;         //       0 - 99
    var match1to3      = /\d{1,3}/;       //       0 - 999
    var match1to4      = /\d{1,4}/;       //       0 - 9999
    var match1to6      = /[+-]?\d{1,6}/;  // -999999 - 999999

    var matchUnsigned  = /\d+/;           //       0 - inf
    var matchSigned    = /[+-]?\d+/;      //    -inf - inf

    var matchOffset    = /Z|[+-]\d\d:?\d\d/gi; // +00:00 -00:00 +0000 -0000 or Z

    var matchTimestamp = /[+-]?\d+(\.\d{1,3})?/; // 123456789 123456789.123

    // any word (or two) characters or numbers including two/three word month in arabic.
    var matchWord = /[0-9]*['a-z\u00A0-\u05FF\u0700-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+|[\u0600-\u06FF\/]+(\s*?[\u0600-\u06FF]+){1,2}/i;

    var regexes = {};

    function addRegexToken (token, regex, strictRegex) {
        regexes[token] = typeof regex === 'function' ? regex : function (isStrict) {
            return (isStrict && strictRegex) ? strictRegex : regex;
        };
    }

    function getParseRegexForToken (token, config) {
        if (!hasOwnProp(regexes, token)) {
            return new RegExp(unescapeFormat(token));
        }

        return regexes[token](config._strict, config._locale);
    }

    // Code from http://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
    function unescapeFormat(s) {
        return s.replace('\\', '').replace(/\\(\[)|\\(\])|\[([^\]\[]*)\]|\\(.)/g, function (matched, p1, p2, p3, p4) {
            return p1 || p2 || p3 || p4;
        }).replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    var tokens = {};

    function addParseToken (token, callback) {
        var i, func = callback;
        if (typeof token === 'string') {
            token = [token];
        }
        if (typeof callback === 'number') {
            func = function (input, array) {
                array[callback] = toInt(input);
            };
        }
        for (i = 0; i < token.length; i++) {
            tokens[token[i]] = func;
        }
    }

    function addWeekParseToken (token, callback) {
        addParseToken(token, function (input, array, config, token) {
            config._w = config._w || {};
            callback(input, config._w, config, token);
        });
    }

    function addTimeToArrayFromToken(token, input, config) {
        if (input != null && hasOwnProp(tokens, token)) {
            tokens[token](input, config._a, config, token);
        }
    }

    var YEAR = 0;
    var MONTH = 1;
    var DATE = 2;
    var HOUR = 3;
    var MINUTE = 4;
    var SECOND = 5;
    var MILLISECOND = 6;

    function daysInMonth(year, month) {
        return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    }

    // FORMATTING

    addFormatToken('M', ['MM', 2], 'Mo', function () {
        return this.month() + 1;
    });

    addFormatToken('MMM', 0, 0, function (format) {
        return this.localeData().monthsShort(this, format);
    });

    addFormatToken('MMMM', 0, 0, function (format) {
        return this.localeData().months(this, format);
    });

    // ALIASES

    addUnitAlias('month', 'M');

    // PARSING

    addRegexToken('M',    match1to2);
    addRegexToken('MM',   match1to2, match2);
    addRegexToken('MMM',  matchWord);
    addRegexToken('MMMM', matchWord);

    addParseToken(['M', 'MM'], function (input, array) {
        array[MONTH] = toInt(input) - 1;
    });

    addParseToken(['MMM', 'MMMM'], function (input, array, config, token) {
        var month = config._locale.monthsParse(input, token, config._strict);
        // if we didn't find a month name, mark the date as invalid.
        if (month != null) {
            array[MONTH] = month;
        } else {
            config._pf.invalidMonth = input;
        }
    });

    // LOCALES

    var defaultLocaleMonths = 'January_February_March_April_May_June_July_August_September_October_November_December'.split('_');
    function localeMonths (m) {
        return this._months[m.month()];
    }

    var defaultLocaleMonthsShort = 'Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec'.split('_');
    function localeMonthsShort (m) {
        return this._monthsShort[m.month()];
    }

    function localeMonthsParse (monthName, format, strict) {
        var i, mom, regex;

        if (!this._monthsParse) {
            this._monthsParse = [];
            this._longMonthsParse = [];
            this._shortMonthsParse = [];
        }

        for (i = 0; i < 12; i++) {
            // make the regex if we don't have it already
            mom = create_utc__createUTC([2000, i]);
            if (strict && !this._longMonthsParse[i]) {
                this._longMonthsParse[i] = new RegExp('^' + this.months(mom, '').replace('.', '') + '$', 'i');
                this._shortMonthsParse[i] = new RegExp('^' + this.monthsShort(mom, '').replace('.', '') + '$', 'i');
            }
            if (!strict && !this._monthsParse[i]) {
                regex = '^' + this.months(mom, '') + '|^' + this.monthsShort(mom, '');
                this._monthsParse[i] = new RegExp(regex.replace('.', ''), 'i');
            }
            // test the regex
            if (strict && format === 'MMMM' && this._longMonthsParse[i].test(monthName)) {
                return i;
            } else if (strict && format === 'MMM' && this._shortMonthsParse[i].test(monthName)) {
                return i;
            } else if (!strict && this._monthsParse[i].test(monthName)) {
                return i;
            }
        }
    }

    // MOMENTS

    function setMonth (mom, value) {
        var dayOfMonth;

        // TODO: Move this out of here!
        if (typeof value === 'string') {
            value = mom.localeData().monthsParse(value);
            // TODO: Another silent failure?
            if (typeof value !== 'number') {
                return mom;
            }
        }

        dayOfMonth = Math.min(mom.date(), daysInMonth(mom.year(), value));
        mom._d['set' + (mom._isUTC ? 'UTC' : '') + 'Month'](value, dayOfMonth);
        return mom;
    }

    function getSetMonth (value) {
        if (value != null) {
            setMonth(this, value);
            utils_hooks__hooks.updateOffset(this, true);
            return this;
        } else {
            return get_set__get(this, 'Month');
        }
    }

    function getDaysInMonth () {
        return daysInMonth(this.year(), this.month());
    }

    function checkOverflow (m) {
        var overflow;
        var a = m._a;

        if (a && m._pf.overflow === -2) {
            overflow =
                a[MONTH]       < 0 || a[MONTH]       > 11  ? MONTH :
                a[DATE]        < 1 || a[DATE]        > daysInMonth(a[YEAR], a[MONTH]) ? DATE :
                a[HOUR]        < 0 || a[HOUR]        > 24 || (a[HOUR] === 24 && (a[MINUTE] !== 0 || a[SECOND] !== 0 || a[MILLISECOND] !== 0)) ? HOUR :
                a[MINUTE]      < 0 || a[MINUTE]      > 59  ? MINUTE :
                a[SECOND]      < 0 || a[SECOND]      > 59  ? SECOND :
                a[MILLISECOND] < 0 || a[MILLISECOND] > 999 ? MILLISECOND :
                -1;

            if (m._pf._overflowDayOfYear && (overflow < YEAR || overflow > DATE)) {
                overflow = DATE;
            }

            m._pf.overflow = overflow;
        }

        return m;
    }

    function warn(msg) {
        if (utils_hooks__hooks.suppressDeprecationWarnings === false && typeof console !== 'undefined' && console.warn) {
            console.warn('Deprecation warning: ' + msg);
        }
    }

    function deprecate(msg, fn) {
        var firstTime = true;
        return extend(function () {
            if (firstTime) {
                warn(msg);
                firstTime = false;
            }
            return fn.apply(this, arguments);
        }, fn);
    }

    var deprecations = {};

    function deprecateSimple(name, msg) {
        if (!deprecations[name]) {
            warn(msg);
            deprecations[name] = true;
        }
    }

    utils_hooks__hooks.suppressDeprecationWarnings = false;

    var from_string__isoRegex = /^\s*(?:[+-]\d{6}|\d{4})-(?:(\d\d-\d\d)|(W\d\d$)|(W\d\d-\d)|(\d\d\d))((T| )(\d\d(:\d\d(:\d\d(\.\d+)?)?)?)?([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/;

    var isoDates = [
        ['YYYYYY-MM-DD', /[+-]\d{6}-\d{2}-\d{2}/],
        ['YYYY-MM-DD', /\d{4}-\d{2}-\d{2}/],
        ['GGGG-[W]WW-E', /\d{4}-W\d{2}-\d/],
        ['GGGG-[W]WW', /\d{4}-W\d{2}/],
        ['YYYY-DDD', /\d{4}-\d{3}/]
    ];

    // iso time formats and regexes
    var isoTimes = [
        ['HH:mm:ss.SSSS', /(T| )\d\d:\d\d:\d\d\.\d+/],
        ['HH:mm:ss', /(T| )\d\d:\d\d:\d\d/],
        ['HH:mm', /(T| )\d\d:\d\d/],
        ['HH', /(T| )\d\d/]
    ];

    var aspNetJsonRegex = /^\/?Date\((\-?\d+)/i;

    // date from iso format
    function configFromISO(config) {
        var i, l,
            string = config._i,
            match = from_string__isoRegex.exec(string);

        if (match) {
            config._pf.iso = true;
            for (i = 0, l = isoDates.length; i < l; i++) {
                if (isoDates[i][1].exec(string)) {
                    // match[5] should be 'T' or undefined
                    config._f = isoDates[i][0] + (match[6] || ' ');
                    break;
                }
            }
            for (i = 0, l = isoTimes.length; i < l; i++) {
                if (isoTimes[i][1].exec(string)) {
                    config._f += isoTimes[i][0];
                    break;
                }
            }
            if (string.match(matchOffset)) {
                config._f += 'Z';
            }
            configFromStringAndFormat(config);
        } else {
            config._isValid = false;
        }
    }

    // date from iso format or fallback
    function configFromString(config) {
        var matched = aspNetJsonRegex.exec(config._i);

        if (matched !== null) {
            config._d = new Date(+matched[1]);
            return;
        }

        configFromISO(config);
        if (config._isValid === false) {
            delete config._isValid;
            utils_hooks__hooks.createFromInputFallback(config);
        }
    }

    utils_hooks__hooks.createFromInputFallback = deprecate(
        'moment construction falls back to js Date. This is ' +
        'discouraged and will be removed in upcoming major ' +
        'release. Please refer to ' +
        'https://github.com/moment/moment/issues/1407 for more info.',
        function (config) {
            config._d = new Date(config._i + (config._useUTC ? ' UTC' : ''));
        }
    );

    function createDate (y, m, d, h, M, s, ms) {
        //can't just apply() to create a date:
        //http://stackoverflow.com/questions/181348/instantiating-a-javascript-object-by-calling-prototype-constructor-apply
        var date = new Date(y, m, d, h, M, s, ms);

        //the date constructor doesn't accept years < 1970
        if (y < 1970) {
            date.setFullYear(y);
        }
        return date;
    }

    function createUTCDate (y) {
        var date = new Date(Date.UTC.apply(null, arguments));
        if (y < 1970) {
            date.setUTCFullYear(y);
        }
        return date;
    }

    addFormatToken(0, ['YY', 2], 0, function () {
        return this.year() % 100;
    });

    addFormatToken(0, ['YYYY',   4],       0, 'year');
    addFormatToken(0, ['YYYYY',  5],       0, 'year');
    addFormatToken(0, ['YYYYYY', 6, true], 0, 'year');

    // ALIASES

    addUnitAlias('year', 'y');

    // PARSING

    addRegexToken('Y',      matchSigned);
    addRegexToken('YY',     match1to2, match2);
    addRegexToken('YYYY',   match1to4, match4);
    addRegexToken('YYYYY',  match1to6, match6);
    addRegexToken('YYYYYY', match1to6, match6);

    addParseToken(['YYYY', 'YYYYY', 'YYYYYY'], YEAR);
    addParseToken('YY', function (input, array) {
        array[YEAR] = utils_hooks__hooks.parseTwoDigitYear(input);
    });

    // HELPERS

    function daysInYear(year) {
        return isLeapYear(year) ? 366 : 365;
    }

    function isLeapYear(year) {
        return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    }

    // HOOKS

    utils_hooks__hooks.parseTwoDigitYear = function (input) {
        return toInt(input) + (toInt(input) > 68 ? 1900 : 2000);
    };

    // MOMENTS

    var getSetYear = makeGetSet('FullYear', false);

    function getIsLeapYear () {
        return isLeapYear(this.year());
    }

    addFormatToken('w', ['ww', 2], 'wo', 'week');
    addFormatToken('W', ['WW', 2], 'Wo', 'isoWeek');

    // ALIASES

    addUnitAlias('week', 'w');
    addUnitAlias('isoWeek', 'W');

    // PARSING

    addRegexToken('w',  match1to2);
    addRegexToken('ww', match1to2, match2);
    addRegexToken('W',  match1to2);
    addRegexToken('WW', match1to2, match2);

    addWeekParseToken(['w', 'ww', 'W', 'WW'], function (input, week, config, token) {
        week[token.substr(0, 1)] = toInt(input);
    });

    // HELPERS

    // firstDayOfWeek       0 = sun, 6 = sat
    //                      the day of the week that starts the week
    //                      (usually sunday or monday)
    // firstDayOfWeekOfYear 0 = sun, 6 = sat
    //                      the first week is the week that contains the first
    //                      of this day of the week
    //                      (eg. ISO weeks use thursday (4))
    function weekOfYear(mom, firstDayOfWeek, firstDayOfWeekOfYear) {
        var end = firstDayOfWeekOfYear - firstDayOfWeek,
            daysToDayOfWeek = firstDayOfWeekOfYear - mom.day(),
            adjustedMoment;


        if (daysToDayOfWeek > end) {
            daysToDayOfWeek -= 7;
        }

        if (daysToDayOfWeek < end - 7) {
            daysToDayOfWeek += 7;
        }

        adjustedMoment = local__createLocal(mom).add(daysToDayOfWeek, 'd');
        return {
            week: Math.ceil(adjustedMoment.dayOfYear() / 7),
            year: adjustedMoment.year()
        };
    }

    // LOCALES

    function localeWeek (mom) {
        return weekOfYear(mom, this._week.dow, this._week.doy).week;
    }

    var defaultLocaleWeek = {
        dow : 0, // Sunday is the first day of the week.
        doy : 6  // The week that contains Jan 1st is the first week of the year.
    };

    function localeFirstDayOfWeek () {
        return this._week.dow;
    }

    function localeFirstDayOfYear () {
        return this._week.doy;
    }

    // MOMENTS

    function getSetWeek (input) {
        var week = this.localeData().week(this);
        return input == null ? week : this.add((input - week) * 7, 'd');
    }

    function getSetISOWeek (input) {
        var week = weekOfYear(this, 1, 4).week;
        return input == null ? week : this.add((input - week) * 7, 'd');
    }

    addFormatToken('DDD', ['DDDD', 3], 'DDDo', 'dayOfYear');

    // ALIASES

    addUnitAlias('dayOfYear', 'DDD');

    // PARSING

    addRegexToken('DDD',  match1to3);
    addRegexToken('DDDD', match3);
    addParseToken(['DDD', 'DDDD'], function (input, array, config) {
        config._dayOfYear = toInt(input);
    });

    // HELPERS

    //http://en.wikipedia.org/wiki/ISO_week_date#Calculating_a_date_given_the_year.2C_week_number_and_weekday
    function dayOfYearFromWeeks(year, week, weekday, firstDayOfWeekOfYear, firstDayOfWeek) {
        var d = createUTCDate(year, 0, 1).getUTCDay();
        var daysToAdd;
        var dayOfYear;

        d = d === 0 ? 7 : d;
        weekday = weekday != null ? weekday : firstDayOfWeek;
        daysToAdd = firstDayOfWeek - d + (d > firstDayOfWeekOfYear ? 7 : 0) - (d < firstDayOfWeek ? 7 : 0);
        dayOfYear = 7 * (week - 1) + (weekday - firstDayOfWeek) + daysToAdd + 1;

        return {
            year      : dayOfYear > 0 ? year      : year - 1,
            dayOfYear : dayOfYear > 0 ? dayOfYear : daysInYear(year - 1) + dayOfYear
        };
    }

    // MOMENTS

    function getSetDayOfYear (input) {
        var dayOfYear = Math.round((this.clone().startOf('day') - this.clone().startOf('year')) / 864e5) + 1;
        return input == null ? dayOfYear : this.add((input - dayOfYear), 'd');
    }

    // Pick the first defined of two or three arguments.
    function defaults(a, b, c) {
        if (a != null) {
            return a;
        }
        if (b != null) {
            return b;
        }
        return c;
    }

    function currentDateArray(config) {
        var now = new Date();
        if (config._useUTC) {
            return [now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()];
        }
        return [now.getFullYear(), now.getMonth(), now.getDate()];
    }

    // convert an array to a date.
    // the array should mirror the parameters below
    // note: all values past the year are optional and will default to the lowest possible value.
    // [year, month, day , hour, minute, second, millisecond]
    function configFromArray (config) {
        var i, date, input = [], currentDate, yearToUse;

        if (config._d) {
            return;
        }

        currentDate = currentDateArray(config);

        //compute day of the year from weeks and weekdays
        if (config._w && config._a[DATE] == null && config._a[MONTH] == null) {
            dayOfYearFromWeekInfo(config);
        }

        //if the day of the year is set, figure out what it is
        if (config._dayOfYear) {
            yearToUse = defaults(config._a[YEAR], currentDate[YEAR]);

            if (config._dayOfYear > daysInYear(yearToUse)) {
                config._pf._overflowDayOfYear = true;
            }

            date = createUTCDate(yearToUse, 0, config._dayOfYear);
            config._a[MONTH] = date.getUTCMonth();
            config._a[DATE] = date.getUTCDate();
        }

        // Default to current date.
        // * if no year, month, day of month are given, default to today
        // * if day of month is given, default month and year
        // * if month is given, default only year
        // * if year is given, don't default anything
        for (i = 0; i < 3 && config._a[i] == null; ++i) {
            config._a[i] = input[i] = currentDate[i];
        }

        // Zero out whatever was not defaulted, including time
        for (; i < 7; i++) {
            config._a[i] = input[i] = (config._a[i] == null) ? (i === 2 ? 1 : 0) : config._a[i];
        }

        // Check for 24:00:00.000
        if (config._a[HOUR] === 24 &&
                config._a[MINUTE] === 0 &&
                config._a[SECOND] === 0 &&
                config._a[MILLISECOND] === 0) {
            config._nextDay = true;
            config._a[HOUR] = 0;
        }

        config._d = (config._useUTC ? createUTCDate : createDate).apply(null, input);
        // Apply timezone offset from input. The actual utcOffset can be changed
        // with parseZone.
        if (config._tzm != null) {
            config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);
        }

        if (config._nextDay) {
            config._a[HOUR] = 24;
        }
    }

    function dayOfYearFromWeekInfo(config) {
        var w, weekYear, week, weekday, dow, doy, temp;

        w = config._w;
        if (w.GG != null || w.W != null || w.E != null) {
            dow = 1;
            doy = 4;

            // TODO: We need to take the current isoWeekYear, but that depends on
            // how we interpret now (local, utc, fixed offset). So create
            // a now version of current config (take local/utc/offset flags, and
            // create now).
            weekYear = defaults(w.GG, config._a[YEAR], weekOfYear(local__createLocal(), 1, 4).year);
            week = defaults(w.W, 1);
            weekday = defaults(w.E, 1);
        } else {
            dow = config._locale._week.dow;
            doy = config._locale._week.doy;

            weekYear = defaults(w.gg, config._a[YEAR], weekOfYear(local__createLocal(), dow, doy).year);
            week = defaults(w.w, 1);

            if (w.d != null) {
                // weekday -- low day numbers are considered next week
                weekday = w.d;
                if (weekday < dow) {
                    ++week;
                }
            } else if (w.e != null) {
                // local weekday -- counting starts from begining of week
                weekday = w.e + dow;
            } else {
                // default to begining of week
                weekday = dow;
            }
        }
        temp = dayOfYearFromWeeks(weekYear, week, weekday, doy, dow);

        config._a[YEAR] = temp.year;
        config._dayOfYear = temp.dayOfYear;
    }

    utils_hooks__hooks.ISO_8601 = function () {};

    // date from string and format string
    function configFromStringAndFormat(config) {
        // TODO: Move this to another part of the creation flow to prevent circular deps
        if (config._f === utils_hooks__hooks.ISO_8601) {
            configFromISO(config);
            return;
        }

        config._a = [];
        config._pf.empty = true;

        // This array is used to make a Date, either with `new Date` or `Date.UTC`
        var string = '' + config._i,
            i, parsedInput, tokens, token, skipped,
            stringLength = string.length,
            totalParsedInputLength = 0;

        tokens = expandFormat(config._f, config._locale).match(formattingTokens) || [];

        for (i = 0; i < tokens.length; i++) {
            token = tokens[i];
            parsedInput = (string.match(getParseRegexForToken(token, config)) || [])[0];
            if (parsedInput) {
                skipped = string.substr(0, string.indexOf(parsedInput));
                if (skipped.length > 0) {
                    config._pf.unusedInput.push(skipped);
                }
                string = string.slice(string.indexOf(parsedInput) + parsedInput.length);
                totalParsedInputLength += parsedInput.length;
            }
            // don't parse if it's not a known token
            if (formatTokenFunctions[token]) {
                if (parsedInput) {
                    config._pf.empty = false;
                }
                else {
                    config._pf.unusedTokens.push(token);
                }
                addTimeToArrayFromToken(token, parsedInput, config);
            }
            else if (config._strict && !parsedInput) {
                config._pf.unusedTokens.push(token);
            }
        }

        // add remaining unparsed input length to the string
        config._pf.charsLeftOver = stringLength - totalParsedInputLength;
        if (string.length > 0) {
            config._pf.unusedInput.push(string);
        }

        // clear _12h flag if hour is <= 12
        if (config._pf.bigHour === true && config._a[HOUR] <= 12) {
            config._pf.bigHour = undefined;
        }
        // handle meridiem
        config._a[HOUR] = meridiemFixWrap(config._locale, config._a[HOUR], config._meridiem);

        configFromArray(config);
        checkOverflow(config);
    }


    function meridiemFixWrap (locale, hour, meridiem) {
        var isPm;

        if (meridiem == null) {
            // nothing to do
            return hour;
        }
        if (locale.meridiemHour != null) {
            return locale.meridiemHour(hour, meridiem);
        } else if (locale.isPM != null) {
            // Fallback
            isPm = locale.isPM(meridiem);
            if (isPm && hour < 12) {
                hour += 12;
            }
            if (!isPm && hour === 12) {
                hour = 0;
            }
            return hour;
        } else {
            // this is not supposed to happen
            return hour;
        }
    }

    function configFromStringAndArray(config) {
        var tempConfig,
            bestMoment,

            scoreToBeat,
            i,
            currentScore;

        if (config._f.length === 0) {
            config._pf.invalidFormat = true;
            config._d = new Date(NaN);
            return;
        }

        for (i = 0; i < config._f.length; i++) {
            currentScore = 0;
            tempConfig = copyConfig({}, config);
            if (config._useUTC != null) {
                tempConfig._useUTC = config._useUTC;
            }
            tempConfig._pf = defaultParsingFlags();
            tempConfig._f = config._f[i];
            configFromStringAndFormat(tempConfig);

            if (!valid__isValid(tempConfig)) {
                continue;
            }

            // if there is any input that was not parsed add a penalty for that format
            currentScore += tempConfig._pf.charsLeftOver;

            //or tokens
            currentScore += tempConfig._pf.unusedTokens.length * 10;

            tempConfig._pf.score = currentScore;

            if (scoreToBeat == null || currentScore < scoreToBeat) {
                scoreToBeat = currentScore;
                bestMoment = tempConfig;
            }
        }

        extend(config, bestMoment || tempConfig);
    }

    function configFromObject(config) {
        if (config._d) {
            return;
        }

        var i = normalizeObjectUnits(config._i);
        config._a = [i.year, i.month, i.day || i.date, i.hour, i.minute, i.second, i.millisecond];

        configFromArray(config);
    }

    function createFromConfig (config) {
        var input = config._i,
            format = config._f,
            res;

        config._locale = config._locale || locale_locales__getLocale(config._l);

        if (input === null || (format === undefined && input === '')) {
            return valid__createInvalid({nullInput: true});
        }

        if (typeof input === 'string') {
            config._i = input = config._locale.preparse(input);
        }

        if (isMoment(input)) {
            return new Moment(checkOverflow(input));
        } else if (isArray(format)) {
            configFromStringAndArray(config);
        } else if (format) {
            configFromStringAndFormat(config);
        } else {
            configFromInput(config);
        }

        res = new Moment(checkOverflow(config));
        if (res._nextDay) {
            // Adding is smart enough around DST
            res.add(1, 'd');
            res._nextDay = undefined;
        }

        return res;
    }

    function configFromInput(config) {
        var input = config._i;
        if (input === undefined) {
            config._d = new Date();
        } else if (isDate(input)) {
            config._d = new Date(+input);
        } else if (typeof input === 'string') {
            configFromString(config);
        } else if (isArray(input)) {
            config._a = map(input.slice(0), function (obj) {
                return parseInt(obj, 10);
            });
            configFromArray(config);
        } else if (typeof(input) === 'object') {
            configFromObject(config);
        } else if (typeof(input) === 'number') {
            // from milliseconds
            config._d = new Date(input);
        } else {
            utils_hooks__hooks.createFromInputFallback(config);
        }
    }

    function createLocalOrUTC (input, format, locale, strict, isUTC) {
        var c = {};

        if (typeof(locale) === 'boolean') {
            strict = locale;
            locale = undefined;
        }
        // object construction must be done this way.
        // https://github.com/moment/moment/issues/1423
        c._isAMomentObject = true;
        c._useUTC = c._isUTC = isUTC;
        c._l = locale;
        c._i = input;
        c._f = format;
        c._strict = strict;
        c._pf = defaultParsingFlags();

        return createFromConfig(c);
    }

    function local__createLocal (input, format, locale, strict) {
        return createLocalOrUTC(input, format, locale, strict, false);
    }

    var prototypeMin = deprecate(
         'moment().min is deprecated, use moment.min instead. https://github.com/moment/moment/issues/1548',
         function () {
             var other = local__createLocal.apply(null, arguments);
             return other < this ? this : other;
         }
     );

    var prototypeMax = deprecate(
        'moment().max is deprecated, use moment.max instead. https://github.com/moment/moment/issues/1548',
        function () {
            var other = local__createLocal.apply(null, arguments);
            return other > this ? this : other;
        }
    );

    // Pick a moment m from moments so that m[fn](other) is true for all
    // other. This relies on the function fn to be transitive.
    //
    // moments should either be an array of moment objects or an array, whose
    // first element is an array of moment objects.
    function pickBy(fn, moments) {
        var res, i;
        if (moments.length === 1 && isArray(moments[0])) {
            moments = moments[0];
        }
        if (!moments.length) {
            return local__createLocal();
        }
        res = moments[0];
        for (i = 1; i < moments.length; ++i) {
            if (moments[i][fn](res)) {
                res = moments[i];
            }
        }
        return res;
    }

    // TODO: Use [].sort instead?
    function min () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isBefore', args);
    }

    function max () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isAfter', args);
    }

    function Duration (duration) {
        var normalizedInput = normalizeObjectUnits(duration),
            years = normalizedInput.year || 0,
            quarters = normalizedInput.quarter || 0,
            months = normalizedInput.month || 0,
            weeks = normalizedInput.week || 0,
            days = normalizedInput.day || 0,
            hours = normalizedInput.hour || 0,
            minutes = normalizedInput.minute || 0,
            seconds = normalizedInput.second || 0,
            milliseconds = normalizedInput.millisecond || 0;

        // representation for dateAddRemove
        this._milliseconds = +milliseconds +
            seconds * 1e3 + // 1000
            minutes * 6e4 + // 1000 * 60
            hours * 36e5; // 1000 * 60 * 60
        // Because of dateAddRemove treats 24 hours as different from a
        // day when working around DST, we need to store them separately
        this._days = +days +
            weeks * 7;
        // It is impossible translate months into days without knowing
        // which months you are are talking about, so we have to store
        // it separately.
        this._months = +months +
            quarters * 3 +
            years * 12;

        this._data = {};

        this._locale = locale_locales__getLocale();

        this._bubble();
    }

    function isDuration (obj) {
        return obj instanceof Duration;
    }

    function offset (token, separator) {
        addFormatToken(token, 0, 0, function () {
            var offset = this.utcOffset();
            var sign = '+';
            if (offset < 0) {
                offset = -offset;
                sign = '-';
            }
            return sign + zeroFill(~~(offset / 60), 2) + separator + zeroFill(~~(offset) % 60, 2);
        });
    }

    offset('Z', ':');
    offset('ZZ', '');

    // PARSING

    addRegexToken('Z',  matchOffset);
    addRegexToken('ZZ', matchOffset);
    addParseToken(['Z', 'ZZ'], function (input, array, config) {
        config._useUTC = true;
        config._tzm = offsetFromString(input);
    });

    // HELPERS

    // timezone chunker
    // '+10:00' > ['10',  '00']
    // '-1530'  > ['-15', '30']
    var chunkOffset = /([\+\-]|\d\d)/gi;

    function offsetFromString(string) {
        var matches = ((string || '').match(matchOffset) || []);
        var chunk   = matches[matches.length - 1] || [];
        var parts   = (chunk + '').match(chunkOffset) || ['-', 0, 0];
        var minutes = +(parts[1] * 60) + toInt(parts[2]);

        return parts[0] === '+' ? minutes : -minutes;
    }

    // Return a moment from input, that is local/utc/zone equivalent to model.
    function cloneWithOffset(input, model) {
        var res, diff;
        if (model._isUTC) {
            res = model.clone();
            diff = (isMoment(input) || isDate(input) ? +input : +local__createLocal(input)) - (+res);
            // Use low-level api, because this fn is low-level api.
            res._d.setTime(+res._d + diff);
            utils_hooks__hooks.updateOffset(res, false);
            return res;
        } else {
            return local__createLocal(input).local();
        }
        return model._isUTC ? local__createLocal(input).zone(model._offset || 0) : local__createLocal(input).local();
    }

    function getDateOffset (m) {
        // On Firefox.24 Date#getTimezoneOffset returns a floating point.
        // https://github.com/moment/moment/pull/1871
        return -Math.round(m._d.getTimezoneOffset() / 15) * 15;
    }

    // HOOKS

    // This function will be called whenever a moment is mutated.
    // It is intended to keep the offset in sync with the timezone.
    utils_hooks__hooks.updateOffset = function () {};

    // MOMENTS

    // keepLocalTime = true means only change the timezone, without
    // affecting the local hour. So 5:31:26 +0300 --[utcOffset(2, true)]-->
    // 5:31:26 +0200 It is possible that 5:31:26 doesn't exist with offset
    // +0200, so we adjust the time as needed, to be valid.
    //
    // Keeping the time actually adds/subtracts (one hour)
    // from the actual represented time. That is why we call updateOffset
    // a second time. In case it wants us to change the offset again
    // _changeInProgress == true case, then we have to adjust, because
    // there is no such time in the given timezone.
    function getSetOffset (input, keepLocalTime) {
        var offset = this._offset || 0,
            localAdjust;
        if (input != null) {
            if (typeof input === 'string') {
                input = offsetFromString(input);
            }
            if (Math.abs(input) < 16) {
                input = input * 60;
            }
            if (!this._isUTC && keepLocalTime) {
                localAdjust = getDateOffset(this);
            }
            this._offset = input;
            this._isUTC = true;
            if (localAdjust != null) {
                this.add(localAdjust, 'm');
            }
            if (offset !== input) {
                if (!keepLocalTime || this._changeInProgress) {
                    add_subtract__addSubtract(this, create__createDuration(input - offset, 'm'), 1, false);
                } else if (!this._changeInProgress) {
                    this._changeInProgress = true;
                    utils_hooks__hooks.updateOffset(this, true);
                    this._changeInProgress = null;
                }
            }
            return this;
        } else {
            return this._isUTC ? offset : getDateOffset(this);
        }
    }

    function getSetZone (input, keepLocalTime) {
        if (input != null) {
            if (typeof input !== 'string') {
                input = -input;
            }

            this.utcOffset(input, keepLocalTime);

            return this;
        } else {
            return -this.utcOffset();
        }
    }

    function setOffsetToUTC (keepLocalTime) {
        return this.utcOffset(0, keepLocalTime);
    }

    function setOffsetToLocal (keepLocalTime) {
        if (this._isUTC) {
            this.utcOffset(0, keepLocalTime);
            this._isUTC = false;

            if (keepLocalTime) {
                this.subtract(getDateOffset(this), 'm');
            }
        }
        return this;
    }

    function setOffsetToParsedOffset () {
        if (this._tzm) {
            this.utcOffset(this._tzm);
        } else if (typeof this._i === 'string') {
            this.utcOffset(offsetFromString(this._i));
        }
        return this;
    }

    function hasAlignedHourOffset (input) {
        if (!input) {
            input = 0;
        }
        else {
            input = local__createLocal(input).utcOffset();
        }

        return (this.utcOffset() - input) % 60 === 0;
    }

    function isDaylightSavingTime () {
        return (
            this.utcOffset() > this.clone().month(0).utcOffset() ||
            this.utcOffset() > this.clone().month(5).utcOffset()
        );
    }

    function isDaylightSavingTimeShifted () {
        if (this._a) {
            var other = this._isUTC ? create_utc__createUTC(this._a) : local__createLocal(this._a);
            return this.isValid() && compareArrays(this._a, other.toArray()) > 0;
        }

        return false;
    }

    function isLocal () {
        return !this._isUTC;
    }

    function isUtcOffset () {
        return this._isUTC;
    }

    function isUtc () {
        return this._isUTC && this._offset === 0;
    }

    var aspNetRegex = /(\-)?(?:(\d*)\.)?(\d+)\:(\d+)(?:\:(\d+)\.?(\d{3})?)?/;

    // from http://docs.closure-library.googlecode.com/git/closure_goog_date_date.js.source.html
    // somewhat more in line with 4.4.3.2 2004 spec, but allows decimal anywhere
    var create__isoRegex = /^(-)?P(?:(?:([0-9,.]*)Y)?(?:([0-9,.]*)M)?(?:([0-9,.]*)D)?(?:T(?:([0-9,.]*)H)?(?:([0-9,.]*)M)?(?:([0-9,.]*)S)?)?|([0-9,.]*)W)$/;

    function create__createDuration (input, key) {
        var duration = input,
            // matching against regexp is expensive, do it on demand
            match = null,
            sign,
            ret,
            diffRes;

        if (isDuration(input)) {
            duration = {
                ms : input._milliseconds,
                d  : input._days,
                M  : input._months
            };
        } else if (typeof input === 'number') {
            duration = {};
            if (key) {
                duration[key] = input;
            } else {
                duration.milliseconds = input;
            }
        } else if (!!(match = aspNetRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y  : 0,
                d  : toInt(match[DATE])        * sign,
                h  : toInt(match[HOUR])        * sign,
                m  : toInt(match[MINUTE])      * sign,
                s  : toInt(match[SECOND])      * sign,
                ms : toInt(match[MILLISECOND]) * sign
            };
        } else if (!!(match = create__isoRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y : parseIso(match[2], sign),
                M : parseIso(match[3], sign),
                d : parseIso(match[4], sign),
                h : parseIso(match[5], sign),
                m : parseIso(match[6], sign),
                s : parseIso(match[7], sign),
                w : parseIso(match[8], sign)
            };
        } else if (duration == null) {// checks for null or undefined
            duration = {};
        } else if (typeof duration === 'object' && ('from' in duration || 'to' in duration)) {
            diffRes = momentsDifference(local__createLocal(duration.from), local__createLocal(duration.to));

            duration = {};
            duration.ms = diffRes.milliseconds;
            duration.M = diffRes.months;
        }

        ret = new Duration(duration);

        if (isDuration(input) && hasOwnProp(input, '_locale')) {
            ret._locale = input._locale;
        }

        return ret;
    }

    create__createDuration.fn = Duration.prototype;

    function parseIso (inp, sign) {
        // We'd normally use ~~inp for this, but unfortunately it also
        // converts floats to ints.
        // inp may be undefined, so careful calling replace on it.
        var res = inp && parseFloat(inp.replace(',', '.'));
        // apply sign while we're at it
        return (isNaN(res) ? 0 : res) * sign;
    }

    function positiveMomentsDifference(base, other) {
        var res = {milliseconds: 0, months: 0};

        res.months = other.month() - base.month() +
            (other.year() - base.year()) * 12;
        if (base.clone().add(res.months, 'M').isAfter(other)) {
            --res.months;
        }

        res.milliseconds = +other - +(base.clone().add(res.months, 'M'));

        return res;
    }

    function momentsDifference(base, other) {
        var res;
        other = cloneWithOffset(other, base);
        if (base.isBefore(other)) {
            res = positiveMomentsDifference(base, other);
        } else {
            res = positiveMomentsDifference(other, base);
            res.milliseconds = -res.milliseconds;
            res.months = -res.months;
        }

        return res;
    }

    function createAdder(direction, name) {
        return function (val, period) {
            var dur, tmp;
            //invert the arguments, but complain about it
            if (period !== null && !isNaN(+period)) {
                deprecateSimple(name, 'moment().' + name  + '(period, number) is deprecated. Please use moment().' + name + '(number, period).');
                tmp = val; val = period; period = tmp;
            }

            val = typeof val === 'string' ? +val : val;
            dur = create__createDuration(val, period);
            add_subtract__addSubtract(this, dur, direction);
            return this;
        };
    }

    function add_subtract__addSubtract (mom, duration, isAdding, updateOffset) {
        var milliseconds = duration._milliseconds,
            days = duration._days,
            months = duration._months;
        updateOffset = updateOffset == null ? true : updateOffset;

        if (milliseconds) {
            mom._d.setTime(+mom._d + milliseconds * isAdding);
        }
        if (days) {
            get_set__set(mom, 'Date', get_set__get(mom, 'Date') + days * isAdding);
        }
        if (months) {
            setMonth(mom, get_set__get(mom, 'Month') + months * isAdding);
        }
        if (updateOffset) {
            utils_hooks__hooks.updateOffset(mom, days || months);
        }
    }

    var add_subtract__add      = createAdder(1, 'add');
    var add_subtract__subtract = createAdder(-1, 'subtract');

    function moment_calendar__calendar (time) {
        // We want to compare the start of today, vs this.
        // Getting start-of-today depends on whether we're local/utc/offset or not.
        var now = time || local__createLocal(),
            sod = cloneWithOffset(now, this).startOf('day'),
            diff = this.diff(sod, 'days', true),
            format = diff < -6 ? 'sameElse' :
                diff < -1 ? 'lastWeek' :
                diff < 0 ? 'lastDay' :
                diff < 1 ? 'sameDay' :
                diff < 2 ? 'nextDay' :
                diff < 7 ? 'nextWeek' : 'sameElse';
        return this.format(this.localeData().calendar(format, this, local__createLocal(now)));
    }

    function clone () {
        return new Moment(this);
    }

    function isAfter (input, units) {
        var inputMs;
        units = normalizeUnits(typeof units !== 'undefined' ? units : 'millisecond');
        if (units === 'millisecond') {
            input = isMoment(input) ? input : local__createLocal(input);
            return +this > +input;
        } else {
            inputMs = isMoment(input) ? +input : +local__createLocal(input);
            return inputMs < +this.clone().startOf(units);
        }
    }

    function isBefore (input, units) {
        var inputMs;
        units = normalizeUnits(typeof units !== 'undefined' ? units : 'millisecond');
        if (units === 'millisecond') {
            input = isMoment(input) ? input : local__createLocal(input);
            return +this < +input;
        } else {
            inputMs = isMoment(input) ? +input : +local__createLocal(input);
            return +this.clone().endOf(units) < inputMs;
        }
    }

    function isBetween (from, to, units) {
        return this.isAfter(from, units) && this.isBefore(to, units);
    }

    function isSame (input, units) {
        var inputMs;
        units = normalizeUnits(units || 'millisecond');
        if (units === 'millisecond') {
            input = isMoment(input) ? input : local__createLocal(input);
            return +this === +input;
        } else {
            inputMs = +local__createLocal(input);
            return +(this.clone().startOf(units)) <= inputMs && inputMs <= +(this.clone().endOf(units));
        }
    }

    function absFloor (number) {
        if (number < 0) {
            return Math.ceil(number);
        } else {
            return Math.floor(number);
        }
    }

    function diff (input, units, asFloat) {
        var that = cloneWithOffset(input, this),
            zoneDelta = (that.utcOffset() - this.utcOffset()) * 6e4,
            delta, output;

        units = normalizeUnits(units);

        if (units === 'year' || units === 'month' || units === 'quarter') {
            output = monthDiff(this, that);
            if (units === 'quarter') {
                output = output / 3;
            } else if (units === 'year') {
                output = output / 12;
            }
        } else {
            delta = this - that;
            output = units === 'second' ? delta / 1e3 : // 1000
                units === 'minute' ? delta / 6e4 : // 1000 * 60
                units === 'hour' ? delta / 36e5 : // 1000 * 60 * 60
                units === 'day' ? (delta - zoneDelta) / 864e5 : // 1000 * 60 * 60 * 24, negate dst
                units === 'week' ? (delta - zoneDelta) / 6048e5 : // 1000 * 60 * 60 * 24 * 7, negate dst
                delta;
        }
        return asFloat ? output : absFloor(output);
    }

    function monthDiff (a, b) {
        // difference in months
        var wholeMonthDiff = ((b.year() - a.year()) * 12) + (b.month() - a.month()),
            // b is in (anchor - 1 month, anchor + 1 month)
            anchor = a.clone().add(wholeMonthDiff, 'months'),
            anchor2, adjust;

        if (b - anchor < 0) {
            anchor2 = a.clone().add(wholeMonthDiff - 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor - anchor2);
        } else {
            anchor2 = a.clone().add(wholeMonthDiff + 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor2 - anchor);
        }

        return -(wholeMonthDiff + adjust);
    }

    utils_hooks__hooks.defaultFormat = 'YYYY-MM-DDTHH:mm:ssZ';

    function toString () {
        return this.clone().locale('en').format('ddd MMM DD YYYY HH:mm:ss [GMT]ZZ');
    }

    function moment_format__toISOString () {
        var m = this.clone().utc();
        if (0 < m.year() && m.year() <= 9999) {
            if ('function' === typeof Date.prototype.toISOString) {
                // native implementation is ~50x faster, use it when we can
                return this.toDate().toISOString();
            } else {
                return formatMoment(m, 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
            }
        } else {
            return formatMoment(m, 'YYYYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
        }
    }

    function format (inputString) {
        var output = formatMoment(this, inputString || utils_hooks__hooks.defaultFormat);
        return this.localeData().postformat(output);
    }

    function from (time, withoutSuffix) {
        return create__createDuration({to: this, from: time}).locale(this.locale()).humanize(!withoutSuffix);
    }

    function fromNow (withoutSuffix) {
        return this.from(local__createLocal(), withoutSuffix);
    }

    function locale (key) {
        var newLocaleData;

        if (key === undefined) {
            return this._locale._abbr;
        } else {
            newLocaleData = locale_locales__getLocale(key);
            if (newLocaleData != null) {
                this._locale = newLocaleData;
            }
            return this;
        }
    }

    var lang = deprecate(
        'moment().lang() is deprecated. Instead, use moment().localeData() to get the language configuration. Use moment().locale() to change languages.',
        function (key) {
            if (key === undefined) {
                return this.localeData();
            } else {
                return this.locale(key);
            }
        }
    );

    function localeData () {
        return this._locale;
    }

    function startOf (units) {
        units = normalizeUnits(units);
        // the following switch intentionally omits break keywords
        // to utilize falling through the cases.
        switch (units) {
        case 'year':
            this.month(0);
            /* falls through */
        case 'quarter':
        case 'month':
            this.date(1);
            /* falls through */
        case 'week':
        case 'isoWeek':
        case 'day':
            this.hours(0);
            /* falls through */
        case 'hour':
            this.minutes(0);
            /* falls through */
        case 'minute':
            this.seconds(0);
            /* falls through */
        case 'second':
            this.milliseconds(0);
        }

        // weeks are a special case
        if (units === 'week') {
            this.weekday(0);
        }
        if (units === 'isoWeek') {
            this.isoWeekday(1);
        }

        // quarters are also special
        if (units === 'quarter') {
            this.month(Math.floor(this.month() / 3) * 3);
        }

        return this;
    }

    function endOf (units) {
        units = normalizeUnits(units);
        if (units === undefined || units === 'millisecond') {
            return this;
        }
        return this.startOf(units).add(1, (units === 'isoWeek' ? 'week' : units)).subtract(1, 'ms');
    }

    function to_type__valueOf () {
        return +this._d - ((this._offset || 0) * 60000);
    }

    function unix () {
        return Math.floor(+this / 1000);
    }

    function toDate () {
        return this._offset ? new Date(+this) : this._d;
    }

    function toArray () {
        var m = this;
        return [m.year(), m.month(), m.date(), m.hour(), m.minute(), m.second(), m.millisecond()];
    }

    function moment_valid__isValid () {
        return valid__isValid(this);
    }

    function parsingFlags () {
        return extend({}, this._pf);
    }

    function invalidAt () {
        return this._pf.overflow;
    }

    addFormatToken(0, ['gg', 2], 0, function () {
        return this.weekYear() % 100;
    });

    addFormatToken(0, ['GG', 2], 0, function () {
        return this.isoWeekYear() % 100;
    });

    function addWeekYearFormatToken (token, getter) {
        addFormatToken(0, [token, token.length], 0, getter);
    }

    addWeekYearFormatToken('gggg',     'weekYear');
    addWeekYearFormatToken('ggggg',    'weekYear');
    addWeekYearFormatToken('GGGG',  'isoWeekYear');
    addWeekYearFormatToken('GGGGG', 'isoWeekYear');

    // ALIASES

    addUnitAlias('weekYear', 'gg');
    addUnitAlias('isoWeekYear', 'GG');

    // PARSING

    addRegexToken('G',      matchSigned);
    addRegexToken('g',      matchSigned);
    addRegexToken('GG',     match1to2, match2);
    addRegexToken('gg',     match1to2, match2);
    addRegexToken('GGGG',   match1to4, match4);
    addRegexToken('gggg',   match1to4, match4);
    addRegexToken('GGGGG',  match1to6, match6);
    addRegexToken('ggggg',  match1to6, match6);

    addWeekParseToken(['gggg', 'ggggg', 'GGGG', 'GGGGG'], function (input, week, config, token) {
        week[token.substr(0, 2)] = toInt(input);
    });

    addWeekParseToken(['gg', 'GG'], function (input, week, config, token) {
        week[token] = utils_hooks__hooks.parseTwoDigitYear(input);
    });

    // HELPERS

    function weeksInYear(year, dow, doy) {
        return weekOfYear(local__createLocal([year, 11, 31 + dow - doy]), dow, doy).week;
    }

    // MOMENTS

    function getSetWeekYear (input) {
        var year = weekOfYear(this, this.localeData()._week.dow, this.localeData()._week.doy).year;
        return input == null ? year : this.add((input - year), 'y');
    }

    function getSetISOWeekYear (input) {
        var year = weekOfYear(this, 1, 4).year;
        return input == null ? year : this.add((input - year), 'y');
    }

    function getISOWeeksInYear () {
        return weeksInYear(this.year(), 1, 4);
    }

    function getWeeksInYear () {
        var weekInfo = this.localeData()._week;
        return weeksInYear(this.year(), weekInfo.dow, weekInfo.doy);
    }

    addFormatToken('Q', 0, 0, 'quarter');

    // ALIASES

    addUnitAlias('quarter', 'Q');

    // PARSING

    addRegexToken('Q', match1);
    addParseToken('Q', function (input, array) {
        array[MONTH] = (toInt(input) - 1) * 3;
    });

    // MOMENTS

    function getSetQuarter (input) {
        return input == null ? Math.ceil((this.month() + 1) / 3) : this.month((input - 1) * 3 + this.month() % 3);
    }

    addFormatToken('D', ['DD', 2], 'Do', 'date');

    // ALIASES

    addUnitAlias('date', 'D');

    // PARSING

    addRegexToken('D',  match1to2);
    addRegexToken('DD', match1to2, match2);
    addRegexToken('Do', function (isStrict, locale) {
        return isStrict ? locale._ordinalParse : locale._ordinalParseLenient;
    });

    addParseToken(['D', 'DD'], DATE);
    addParseToken('Do', function (input, array) {
        array[DATE] = toInt(input.match(match1to2)[0], 10);
    });

    // MOMENTS

    var getSetDayOfMonth = makeGetSet('Date', true);

    addFormatToken('d', 0, 'do', 'day');

    addFormatToken('dd', 0, 0, function (format) {
        return this.localeData().weekdaysMin(this, format);
    });

    addFormatToken('ddd', 0, 0, function (format) {
        return this.localeData().weekdaysShort(this, format);
    });

    addFormatToken('dddd', 0, 0, function (format) {
        return this.localeData().weekdays(this, format);
    });

    addFormatToken('e', 0, 0, 'weekday');
    addFormatToken('E', 0, 0, 'isoWeekday');

    // ALIASES

    addUnitAlias('day', 'd');
    addUnitAlias('weekday', 'e');
    addUnitAlias('isoWeekday', 'E');

    // PARSING

    addRegexToken('d',    match1to2);
    addRegexToken('e',    match1to2);
    addRegexToken('E',    match1to2);
    addRegexToken('dd',   matchWord);
    addRegexToken('ddd',  matchWord);
    addRegexToken('dddd', matchWord);

    addWeekParseToken(['dd', 'ddd', 'dddd'], function (input, week, config) {
        var weekday = config._locale.weekdaysParse(input);
        // if we didn't get a weekday name, mark the date as invalid
        if (weekday != null) {
            week.d = weekday;
        } else {
            config._pf.invalidWeekday = input;
        }
    });

    addWeekParseToken(['d', 'e', 'E'], function (input, week, config, token) {
        week[token] = toInt(input);
    });

    // HELPERS

    function parseWeekday(input, locale) {
        if (typeof input === 'string') {
            if (!isNaN(input)) {
                input = parseInt(input, 10);
            }
            else {
                input = locale.weekdaysParse(input);
                if (typeof input !== 'number') {
                    return null;
                }
            }
        }
        return input;
    }

    // LOCALES

    var defaultLocaleWeekdays = 'Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday'.split('_');
    function localeWeekdays (m) {
        return this._weekdays[m.day()];
    }

    var defaultLocaleWeekdaysShort = 'Sun_Mon_Tue_Wed_Thu_Fri_Sat'.split('_');
    function localeWeekdaysShort (m) {
        return this._weekdaysShort[m.day()];
    }

    var defaultLocaleWeekdaysMin = 'Su_Mo_Tu_We_Th_Fr_Sa'.split('_');
    function localeWeekdaysMin (m) {
        return this._weekdaysMin[m.day()];
    }

    function localeWeekdaysParse (weekdayName) {
        var i, mom, regex;

        if (!this._weekdaysParse) {
            this._weekdaysParse = [];
        }

        for (i = 0; i < 7; i++) {
            // make the regex if we don't have it already
            if (!this._weekdaysParse[i]) {
                mom = local__createLocal([2000, 1]).day(i);
                regex = '^' + this.weekdays(mom, '') + '|^' + this.weekdaysShort(mom, '') + '|^' + this.weekdaysMin(mom, '');
                this._weekdaysParse[i] = new RegExp(regex.replace('.', ''), 'i');
            }
            // test the regex
            if (this._weekdaysParse[i].test(weekdayName)) {
                return i;
            }
        }
    }

    // MOMENTS

    function getSetDayOfWeek (input) {
        var day = this._isUTC ? this._d.getUTCDay() : this._d.getDay();
        if (input != null) {
            input = parseWeekday(input, this.localeData());
            return this.add(input - day, 'd');
        } else {
            return day;
        }
    }

    function getSetLocaleDayOfWeek (input) {
        var weekday = (this.day() + 7 - this.localeData()._week.dow) % 7;
        return input == null ? weekday : this.add(input - weekday, 'd');
    }

    function getSetISODayOfWeek (input) {
        // behaves the same as moment#day except
        // as a getter, returns 7 instead of 0 (1-7 range instead of 0-6)
        // as a setter, sunday should belong to the previous week.
        return input == null ? this.day() || 7 : this.day(this.day() % 7 ? input : input - 7);
    }

    addFormatToken('H', ['HH', 2], 0, 'hour');
    addFormatToken('h', ['hh', 2], 0, function () {
        return this.hours() % 12 || 12;
    });

    function meridiem (token, lowercase) {
        addFormatToken(token, 0, 0, function () {
            return this.localeData().meridiem(this.hours(), this.minutes(), lowercase);
        });
    }

    meridiem('a', true);
    meridiem('A', false);

    // ALIASES

    addUnitAlias('hour', 'h');

    // PARSING

    function matchMeridiem (isStrict, locale) {
        return locale._meridiemParse;
    }

    addRegexToken('a',  matchMeridiem);
    addRegexToken('A',  matchMeridiem);
    addRegexToken('H',  match1to2);
    addRegexToken('h',  match1to2);
    addRegexToken('HH', match1to2, match2);
    addRegexToken('hh', match1to2, match2);

    addParseToken(['H', 'HH'], HOUR);
    addParseToken(['a', 'A'], function (input, array, config) {
        config._isPm = config._locale.isPM(input);
        config._meridiem = input;
    });
    addParseToken(['h', 'hh'], function (input, array, config) {
        array[HOUR] = toInt(input);
        config._pf.bigHour = true;
    });

    // LOCALES

    function localeIsPM (input) {
        // IE8 Quirks Mode & IE7 Standards Mode do not allow accessing strings like arrays
        // Using charAt should be more compatible.
        return ((input + '').toLowerCase().charAt(0) === 'p');
    }

    var defaultLocaleMeridiemParse = /[ap]\.?m?\.?/i;
    function localeMeridiem (hours, minutes, isLower) {
        if (hours > 11) {
            return isLower ? 'pm' : 'PM';
        } else {
            return isLower ? 'am' : 'AM';
        }
    }


    // MOMENTS

    // Setting the hour should keep the time, because the user explicitly
    // specified which hour he wants. So trying to maintain the same hour (in
    // a new timezone) makes sense. Adding/subtracting hours does not follow
    // this rule.
    var getSetHour = makeGetSet('Hours', true);

    addFormatToken('m', ['mm', 2], 0, 'minute');

    // ALIASES

    addUnitAlias('minute', 'm');

    // PARSING

    addRegexToken('m',  match1to2);
    addRegexToken('mm', match1to2, match2);
    addParseToken(['m', 'mm'], MINUTE);

    // MOMENTS

    var getSetMinute = makeGetSet('Minutes', false);

    addFormatToken('s', ['ss', 2], 0, 'second');

    // ALIASES

    addUnitAlias('second', 's');

    // PARSING

    addRegexToken('s',  match1to2);
    addRegexToken('ss', match1to2, match2);
    addParseToken(['s', 'ss'], SECOND);

    // MOMENTS

    var getSetSecond = makeGetSet('Seconds', false);

    addFormatToken('S', 0, 0, function () {
        return ~~(this.millisecond() / 100);
    });

    addFormatToken(0, ['SS', 2], 0, function () {
        return ~~(this.millisecond() / 10);
    });

    function millisecond__milliseconds (token) {
        addFormatToken(0, [token, 3], 0, 'millisecond');
    }

    millisecond__milliseconds('SSS');
    millisecond__milliseconds('SSSS');

    // ALIASES

    addUnitAlias('millisecond', 'ms');

    // PARSING

    addRegexToken('S',    match1to3, match1);
    addRegexToken('SS',   match1to3, match2);
    addRegexToken('SSS',  match1to3, match3);
    addRegexToken('SSSS', matchUnsigned);
    addParseToken(['S', 'SS', 'SSS', 'SSSS'], function (input, array) {
        array[MILLISECOND] = toInt(('0.' + input) * 1000);
    });

    // MOMENTS

    var getSetMillisecond = makeGetSet('Milliseconds', false);

    addFormatToken('z',  0, 0, 'zoneAbbr');
    addFormatToken('zz', 0, 0, 'zoneName');

    // MOMENTS

    function getZoneAbbr () {
        return this._isUTC ? 'UTC' : '';
    }

    function getZoneName () {
        return this._isUTC ? 'Coordinated Universal Time' : '';
    }

    var momentPrototype__proto = Moment.prototype;

    momentPrototype__proto.add          = add_subtract__add;
    momentPrototype__proto.calendar     = moment_calendar__calendar;
    momentPrototype__proto.clone        = clone;
    momentPrototype__proto.diff         = diff;
    momentPrototype__proto.endOf        = endOf;
    momentPrototype__proto.format       = format;
    momentPrototype__proto.from         = from;
    momentPrototype__proto.fromNow      = fromNow;
    momentPrototype__proto.get          = getSet;
    momentPrototype__proto.invalidAt    = invalidAt;
    momentPrototype__proto.isAfter      = isAfter;
    momentPrototype__proto.isBefore     = isBefore;
    momentPrototype__proto.isBetween    = isBetween;
    momentPrototype__proto.isSame       = isSame;
    momentPrototype__proto.isValid      = moment_valid__isValid;
    momentPrototype__proto.lang         = lang;
    momentPrototype__proto.locale       = locale;
    momentPrototype__proto.localeData   = localeData;
    momentPrototype__proto.max          = prototypeMax;
    momentPrototype__proto.min          = prototypeMin;
    momentPrototype__proto.parsingFlags = parsingFlags;
    momentPrototype__proto.set          = getSet;
    momentPrototype__proto.startOf      = startOf;
    momentPrototype__proto.subtract     = add_subtract__subtract;
    momentPrototype__proto.toArray      = toArray;
    momentPrototype__proto.toDate       = toDate;
    momentPrototype__proto.toISOString  = moment_format__toISOString;
    momentPrototype__proto.toJSON       = moment_format__toISOString;
    momentPrototype__proto.toString     = toString;
    momentPrototype__proto.unix         = unix;
    momentPrototype__proto.valueOf      = to_type__valueOf;

    // Year
    momentPrototype__proto.year       = getSetYear;
    momentPrototype__proto.isLeapYear = getIsLeapYear;

    // Week Year
    momentPrototype__proto.weekYear    = getSetWeekYear;
    momentPrototype__proto.isoWeekYear = getSetISOWeekYear;

    // Quarter
    momentPrototype__proto.quarter = momentPrototype__proto.quarters = getSetQuarter;

    // Month
    momentPrototype__proto.month       = getSetMonth;
    momentPrototype__proto.daysInMonth = getDaysInMonth;

    // Week
    momentPrototype__proto.week           = momentPrototype__proto.weeks        = getSetWeek;
    momentPrototype__proto.isoWeek        = momentPrototype__proto.isoWeeks     = getSetISOWeek;
    momentPrototype__proto.weeksInYear    = getWeeksInYear;
    momentPrototype__proto.isoWeeksInYear = getISOWeeksInYear;

    // Day
    momentPrototype__proto.date       = getSetDayOfMonth;
    momentPrototype__proto.day        = momentPrototype__proto.days             = getSetDayOfWeek;
    momentPrototype__proto.weekday    = getSetLocaleDayOfWeek;
    momentPrototype__proto.isoWeekday = getSetISODayOfWeek;
    momentPrototype__proto.dayOfYear  = getSetDayOfYear;

    // Hour
    momentPrototype__proto.hour = momentPrototype__proto.hours = getSetHour;

    // Minute
    momentPrototype__proto.minute = momentPrototype__proto.minutes = getSetMinute;

    // Second
    momentPrototype__proto.second = momentPrototype__proto.seconds = getSetSecond;

    // Millisecond
    momentPrototype__proto.millisecond = momentPrototype__proto.milliseconds = getSetMillisecond;

    // Offset
    momentPrototype__proto.utcOffset            = getSetOffset;
    momentPrototype__proto.utc                  = setOffsetToUTC;
    momentPrototype__proto.local                = setOffsetToLocal;
    momentPrototype__proto.parseZone            = setOffsetToParsedOffset;
    momentPrototype__proto.hasAlignedHourOffset = hasAlignedHourOffset;
    momentPrototype__proto.isDST                = isDaylightSavingTime;
    momentPrototype__proto.isDSTShifted         = isDaylightSavingTimeShifted;
    momentPrototype__proto.isLocal              = isLocal;
    momentPrototype__proto.isUtcOffset          = isUtcOffset;
    momentPrototype__proto.isUtc                = isUtc;
    momentPrototype__proto.isUTC                = isUtc;

    // Timezone
    momentPrototype__proto.zoneAbbr = getZoneAbbr;
    momentPrototype__proto.zoneName = getZoneName;

    // Deprecations
    momentPrototype__proto.dates  = deprecate('dates accessor is deprecated. Use date instead.', getSetDayOfMonth);
    momentPrototype__proto.months = deprecate('months accessor is deprecated. Use month instead', getSetMonth);
    momentPrototype__proto.years  = deprecate('years accessor is deprecated. Use year instead', getSetYear);
    momentPrototype__proto.zone   = deprecate('moment().zone is deprecated, use moment().utcOffset instead. https://github.com/moment/moment/issues/1779', getSetZone);

    var momentPrototype = momentPrototype__proto;

    function moment__createUnix (input) {
        return local__createLocal(input * 1000);
    }

    function moment__createInZone () {
        return local__createLocal.apply(null, arguments).parseZone();
    }

    var defaultCalendar = {
        sameDay : '[Today at] LT',
        nextDay : '[Tomorrow at] LT',
        nextWeek : 'dddd [at] LT',
        lastDay : '[Yesterday at] LT',
        lastWeek : '[Last] dddd [at] LT',
        sameElse : 'L'
    };

    function locale_calendar__calendar (key, mom, now) {
        var output = this._calendar[key];
        return typeof output === 'function' ? output.call(mom, now) : output;
    }

    var defaultLongDateFormat = {
        LTS  : 'h:mm:ss A',
        LT   : 'h:mm A',
        L    : 'MM/DD/YYYY',
        LL   : 'MMMM D, YYYY',
        LLL  : 'MMMM D, YYYY LT',
        LLLL : 'dddd, MMMM D, YYYY LT'
    };

    function longDateFormat (key) {
        var output = this._longDateFormat[key];
        if (!output && this._longDateFormat[key.toUpperCase()]) {
            output = this._longDateFormat[key.toUpperCase()].replace(/MMMM|MM|DD|dddd/g, function (val) {
                return val.slice(1);
            });
            this._longDateFormat[key] = output;
        }
        return output;
    }

    var defaultInvalidDate = 'Invalid date';

    function invalidDate () {
        return this._invalidDate;
    }

    var defaultOrdinal = '%d';
    var defaultOrdinalParse = /\d{1,2}/;

    function ordinal (number) {
        return this._ordinal.replace('%d', number);
    }

    function preParsePostFormat (string) {
        return string;
    }

    var defaultRelativeTime = {
        future : 'in %s',
        past   : '%s ago',
        s  : 'a few seconds',
        m  : 'a minute',
        mm : '%d minutes',
        h  : 'an hour',
        hh : '%d hours',
        d  : 'a day',
        dd : '%d days',
        M  : 'a month',
        MM : '%d months',
        y  : 'a year',
        yy : '%d years'
    };

    function relative__relativeTime (number, withoutSuffix, string, isFuture) {
        var output = this._relativeTime[string];
        return (typeof output === 'function') ?
            output(number, withoutSuffix, string, isFuture) :
            output.replace(/%d/i, number);
    }

    function pastFuture (diff, output) {
        var format = this._relativeTime[diff > 0 ? 'future' : 'past'];
        return typeof format === 'function' ? format(output) : format.replace(/%s/i, output);
    }

    function locale_set__set (config) {
        var prop, i;
        for (i in config) {
            prop = config[i];
            if (typeof prop === 'function') {
                this[i] = prop;
            } else {
                this['_' + i] = prop;
            }
        }
        // Lenient ordinal parsing accepts just a number in addition to
        // number + (possibly) stuff coming from _ordinalParseLenient.
        this._ordinalParseLenient = new RegExp(this._ordinalParse.source + '|' + /\d{1,2}/.source);
    }

    var prototype__proto = Locale.prototype;

    prototype__proto._calendar       = defaultCalendar;
    prototype__proto.calendar        = locale_calendar__calendar;
    prototype__proto._longDateFormat = defaultLongDateFormat;
    prototype__proto.longDateFormat  = longDateFormat;
    prototype__proto._invalidDate    = defaultInvalidDate;
    prototype__proto.invalidDate     = invalidDate;
    prototype__proto._ordinal        = defaultOrdinal;
    prototype__proto.ordinal         = ordinal;
    prototype__proto._ordinalParse   = defaultOrdinalParse;
    prototype__proto.preparse        = preParsePostFormat;
    prototype__proto.postformat      = preParsePostFormat;
    prototype__proto._relativeTime   = defaultRelativeTime;
    prototype__proto.relativeTime    = relative__relativeTime;
    prototype__proto.pastFuture      = pastFuture;
    prototype__proto.set             = locale_set__set;

    // Month
    prototype__proto.months       =        localeMonths;
    prototype__proto._months      = defaultLocaleMonths;
    prototype__proto.monthsShort  =        localeMonthsShort;
    prototype__proto._monthsShort = defaultLocaleMonthsShort;
    prototype__proto.monthsParse  =        localeMonthsParse;

    // Week
    prototype__proto.week = localeWeek;
    prototype__proto._week = defaultLocaleWeek;
    prototype__proto.firstDayOfYear = localeFirstDayOfYear;
    prototype__proto.firstDayOfWeek = localeFirstDayOfWeek;

    // Day of Week
    prototype__proto.weekdays       =        localeWeekdays;
    prototype__proto._weekdays      = defaultLocaleWeekdays;
    prototype__proto.weekdaysMin    =        localeWeekdaysMin;
    prototype__proto._weekdaysMin   = defaultLocaleWeekdaysMin;
    prototype__proto.weekdaysShort  =        localeWeekdaysShort;
    prototype__proto._weekdaysShort = defaultLocaleWeekdaysShort;
    prototype__proto.weekdaysParse  =        localeWeekdaysParse;

    // Hours
    prototype__proto.isPM = localeIsPM;
    prototype__proto._meridiemParse = defaultLocaleMeridiemParse;
    prototype__proto.meridiem = localeMeridiem;

    function lists__get (format, index, field, setter) {
        var locale = locale_locales__getLocale();
        var utc = create_utc__createUTC().set(setter, index);
        return locale[field](utc, format);
    }

    function list (format, index, field, count, setter) {
        if (typeof format === 'number') {
            index = format;
            format = undefined;
        }

        format = format || '';

        if (index != null) {
            return lists__get(format, index, field, setter);
        }

        var i;
        var out = [];
        for (i = 0; i < count; i++) {
            out[i] = lists__get(format, i, field, setter);
        }
        return out;
    }

    function lists__listMonths (format, index) {
        return list(format, index, 'months', 12, 'month');
    }

    function lists__listMonthsShort (format, index) {
        return list(format, index, 'monthsShort', 12, 'month');
    }

    function lists__listWeekdays (format, index) {
        return list(format, index, 'weekdays', 7, 'day');
    }

    function lists__listWeekdaysShort (format, index) {
        return list(format, index, 'weekdaysShort', 7, 'day');
    }

    function lists__listWeekdaysMin (format, index) {
        return list(format, index, 'weekdaysMin', 7, 'day');
    }

    locale_locales__getSetGlobalLocale('en', {
        ordinalParse: /\d{1,2}(th|st|nd|rd)/,
        ordinal : function (number) {
            var b = number % 10,
                output = (toInt(number % 100 / 10) === 1) ? 'th' :
                (b === 1) ? 'st' :
                (b === 2) ? 'nd' :
                (b === 3) ? 'rd' : 'th';
            return number + output;
        }
    });

    // Side effect imports
    utils_hooks__hooks.lang = deprecate('moment.lang is deprecated. Use moment.locale instead.', locale_locales__getSetGlobalLocale);
    utils_hooks__hooks.langData = deprecate('moment.langData is deprecated. Use moment.localeData instead.', locale_locales__getLocale);

    var mathAbs = Math.abs;

    function duration_abs__abs () {
        var data           = this._data;

        this._milliseconds = mathAbs(this._milliseconds);
        this._days         = mathAbs(this._days);
        this._months       = mathAbs(this._months);

        data.milliseconds  = mathAbs(data.milliseconds);
        data.seconds       = mathAbs(data.seconds);
        data.minutes       = mathAbs(data.minutes);
        data.hours         = mathAbs(data.hours);
        data.months        = mathAbs(data.months);
        data.years         = mathAbs(data.years);

        return this;
    }

    function duration_add_subtract__addSubtract (duration, input, value, direction) {
        var other = create__createDuration(input, value);

        duration._milliseconds += direction * other._milliseconds;
        duration._days         += direction * other._days;
        duration._months       += direction * other._months;

        return duration._bubble();
    }

    // supports only 2.0-style add(1, 's') or add(duration)
    function duration_add_subtract__add (input, value) {
        return duration_add_subtract__addSubtract(this, input, value, 1);
    }

    // supports only 2.0-style subtract(1, 's') or subtract(duration)
    function duration_add_subtract__subtract (input, value) {
        return duration_add_subtract__addSubtract(this, input, value, -1);
    }

    function bubble () {
        var milliseconds = this._milliseconds;
        var days         = this._days;
        var months       = this._months;
        var data         = this._data;
        var seconds, minutes, hours, years = 0;

        // The following code bubbles up values, see the tests for
        // examples of what that means.
        data.milliseconds = milliseconds % 1000;

        seconds           = absFloor(milliseconds / 1000);
        data.seconds      = seconds % 60;

        minutes           = absFloor(seconds / 60);
        data.minutes      = minutes % 60;

        hours             = absFloor(minutes / 60);
        data.hours        = hours % 24;

        days += absFloor(hours / 24);

        // Accurately convert days to years, assume start from year 0.
        years = absFloor(daysToYears(days));
        days -= absFloor(yearsToDays(years));

        // 30 days to a month
        // TODO (iskren): Use anchor date (like 1st Jan) to compute this.
        months += absFloor(days / 30);
        days   %= 30;

        // 12 months -> 1 year
        years  += absFloor(months / 12);
        months %= 12;

        data.days   = days;
        data.months = months;
        data.years  = years;

        return this;
    }

    function daysToYears (days) {
        // 400 years have 146097 days (taking into account leap year rules)
        return days * 400 / 146097;
    }

    function yearsToDays (years) {
        // years * 365 + absFloor(years / 4) -
        //     absFloor(years / 100) + absFloor(years / 400);
        return years * 146097 / 400;
    }

    function as (units) {
        var days;
        var months;
        var milliseconds = this._milliseconds;

        units = normalizeUnits(units);

        if (units === 'month' || units === 'year') {
            days   = this._days   + milliseconds / 864e5;
            months = this._months + daysToYears(days) * 12;
            return units === 'month' ? months : months / 12;
        } else {
            // handle milliseconds separately because of floating point math errors (issue #1867)
            days = this._days + Math.round(yearsToDays(this._months / 12));
            switch (units) {
                case 'week'   : return days / 7            + milliseconds / 6048e5;
                case 'day'    : return days                + milliseconds / 864e5;
                case 'hour'   : return days * 24           + milliseconds / 36e5;
                case 'minute' : return days * 24 * 60      + milliseconds / 6e4;
                case 'second' : return days * 24 * 60 * 60 + milliseconds / 1000;
                // Math.floor prevents floating point math errors here
                case 'millisecond': return Math.floor(days * 24 * 60 * 60 * 1000) + milliseconds;
                default: throw new Error('Unknown unit ' + units);
            }
        }
    }

    // TODO: Use this.as('ms')?
    function duration_as__valueOf () {
        return (
            this._milliseconds +
            this._days * 864e5 +
            (this._months % 12) * 2592e6 +
            toInt(this._months / 12) * 31536e6
        );
    }

    function makeAs (alias) {
        return function () {
            return this.as(alias);
        };
    }

    var asMilliseconds = makeAs('ms');
    var asSeconds      = makeAs('s');
    var asMinutes      = makeAs('m');
    var asHours        = makeAs('h');
    var asDays         = makeAs('d');
    var asWeeks        = makeAs('w');
    var asMonths       = makeAs('M');
    var asYears        = makeAs('y');

    function duration_get__get (units) {
        units = normalizeUnits(units);
        return this[units + 's']();
    }

    function makeGetter(name) {
        return function () {
            return this._data[name];
        };
    }

    var duration_get__milliseconds = makeGetter('milliseconds');
    var seconds      = makeGetter('seconds');
    var minutes      = makeGetter('minutes');
    var hours        = makeGetter('hours');
    var days         = makeGetter('days');
    var months       = makeGetter('months');
    var years        = makeGetter('years');

    function weeks () {
        return absFloor(this.days() / 7);
    }

    var round = Math.round;
    var thresholds = {
        s: 45,  // seconds to minute
        m: 45,  // minutes to hour
        h: 22,  // hours to day
        d: 26,  // days to month
        M: 11   // months to year
    };

    // helper function for moment.fn.from, moment.fn.fromNow, and moment.duration.fn.humanize
    function substituteTimeAgo(string, number, withoutSuffix, isFuture, locale) {
        return locale.relativeTime(number || 1, !!withoutSuffix, string, isFuture);
    }

    function duration_humanize__relativeTime (posNegDuration, withoutSuffix, locale) {
        var duration = create__createDuration(posNegDuration).abs();
        var seconds  = round(duration.as('s'));
        var minutes  = round(duration.as('m'));
        var hours    = round(duration.as('h'));
        var days     = round(duration.as('d'));
        var months   = round(duration.as('M'));
        var years    = round(duration.as('y'));

        var a = seconds < thresholds.s && ['s', seconds]  ||
                minutes === 1          && ['m']           ||
                minutes < thresholds.m && ['mm', minutes] ||
                hours   === 1          && ['h']           ||
                hours   < thresholds.h && ['hh', hours]   ||
                days    === 1          && ['d']           ||
                days    < thresholds.d && ['dd', days]    ||
                months  === 1          && ['M']           ||
                months  < thresholds.M && ['MM', months]  ||
                years   === 1          && ['y']           || ['yy', years];

        a[2] = withoutSuffix;
        a[3] = +posNegDuration > 0;
        a[4] = locale;
        return substituteTimeAgo.apply(null, a);
    }

    // This function allows you to set a threshold for relative time strings
    function duration_humanize__getSetRelativeTimeThreshold (threshold, limit) {
        if (thresholds[threshold] === undefined) {
            return false;
        }
        if (limit === undefined) {
            return thresholds[threshold];
        }
        thresholds[threshold] = limit;
        return true;
    }

    function humanize (withSuffix) {
        var locale = this.localeData();
        var output = duration_humanize__relativeTime(this, !withSuffix, locale);

        if (withSuffix) {
            output = locale.pastFuture(+this, output);
        }

        return locale.postformat(output);
    }

    var iso_string__abs = Math.abs;

    function iso_string__toISOString() {
        // inspired by https://github.com/dordille/moment-isoduration/blob/master/moment.isoduration.js
        var Y = iso_string__abs(this.years());
        var M = iso_string__abs(this.months());
        var D = iso_string__abs(this.days());
        var h = iso_string__abs(this.hours());
        var m = iso_string__abs(this.minutes());
        var s = iso_string__abs(this.seconds() + this.milliseconds() / 1000);
        var total = this.asSeconds();

        if (!total) {
            // this is the same as C#'s (Noda) and python (isodate)...
            // but not other JS (goog.date)
            return 'P0D';
        }

        return (total < 0 ? '-' : '') +
            'P' +
            (Y ? Y + 'Y' : '') +
            (M ? M + 'M' : '') +
            (D ? D + 'D' : '') +
            ((h || m || s) ? 'T' : '') +
            (h ? h + 'H' : '') +
            (m ? m + 'M' : '') +
            (s ? s + 'S' : '');
    }

    var duration_prototype__proto = Duration.prototype;

    duration_prototype__proto.abs            = duration_abs__abs;
    duration_prototype__proto.add            = duration_add_subtract__add;
    duration_prototype__proto.subtract       = duration_add_subtract__subtract;
    duration_prototype__proto.as             = as;
    duration_prototype__proto.asMilliseconds = asMilliseconds;
    duration_prototype__proto.asSeconds      = asSeconds;
    duration_prototype__proto.asMinutes      = asMinutes;
    duration_prototype__proto.asHours        = asHours;
    duration_prototype__proto.asDays         = asDays;
    duration_prototype__proto.asWeeks        = asWeeks;
    duration_prototype__proto.asMonths       = asMonths;
    duration_prototype__proto.asYears        = asYears;
    duration_prototype__proto.valueOf        = duration_as__valueOf;
    duration_prototype__proto._bubble        = bubble;
    duration_prototype__proto.get            = duration_get__get;
    duration_prototype__proto.milliseconds   = duration_get__milliseconds;
    duration_prototype__proto.seconds        = seconds;
    duration_prototype__proto.minutes        = minutes;
    duration_prototype__proto.hours          = hours;
    duration_prototype__proto.days           = days;
    duration_prototype__proto.weeks          = weeks;
    duration_prototype__proto.months         = months;
    duration_prototype__proto.years          = years;
    duration_prototype__proto.humanize       = humanize;
    duration_prototype__proto.toISOString    = iso_string__toISOString;
    duration_prototype__proto.toString       = iso_string__toISOString;
    duration_prototype__proto.toJSON         = iso_string__toISOString;
    duration_prototype__proto.locale         = locale;
    duration_prototype__proto.localeData     = localeData;

    // Deprecations
    duration_prototype__proto.toIsoString = deprecate('toIsoString() is deprecated. Please use toISOString() instead (notice the capitals)', iso_string__toISOString);
    duration_prototype__proto.lang = lang;

    // Side effect imports

    addFormatToken('X', 0, 0, 'unix');
    addFormatToken('x', 0, 0, 'valueOf');

    // PARSING

    addRegexToken('x', matchSigned);
    addRegexToken('X', matchTimestamp);
    addParseToken('X', function (input, array, config) {
        config._d = new Date(parseFloat(input, 10) * 1000);
    });
    addParseToken('x', function (input, array, config) {
        config._d = new Date(toInt(input));
    });

    // Side effect imports


    utils_hooks__hooks.version = '2.10.2';

    setHookCallback(local__createLocal);

    utils_hooks__hooks.fn                    = momentPrototype;
    utils_hooks__hooks.min                   = min;
    utils_hooks__hooks.max                   = max;
    utils_hooks__hooks.utc                   = create_utc__createUTC;
    utils_hooks__hooks.unix                  = moment__createUnix;
    utils_hooks__hooks.months                = lists__listMonths;
    utils_hooks__hooks.isDate                = isDate;
    utils_hooks__hooks.locale                = locale_locales__getSetGlobalLocale;
    utils_hooks__hooks.invalid               = valid__createInvalid;
    utils_hooks__hooks.duration              = create__createDuration;
    utils_hooks__hooks.isMoment              = isMoment;
    utils_hooks__hooks.weekdays              = lists__listWeekdays;
    utils_hooks__hooks.parseZone             = moment__createInZone;
    utils_hooks__hooks.localeData            = locale_locales__getLocale;
    utils_hooks__hooks.isDuration            = isDuration;
    utils_hooks__hooks.monthsShort           = lists__listMonthsShort;
    utils_hooks__hooks.weekdaysMin           = lists__listWeekdaysMin;
    utils_hooks__hooks.defineLocale          = defineLocale;
    utils_hooks__hooks.weekdaysShort         = lists__listWeekdaysShort;
    utils_hooks__hooks.normalizeUnits        = normalizeUnits;
    utils_hooks__hooks.relativeTimeThreshold = duration_humanize__getSetRelativeTimeThreshold;

    var _moment = utils_hooks__hooks;

    return _moment;

}));
},{}],25:[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2Rlc21vbmQvUHJvamVjdHMvSm91cm5leUpvdXJuYWwvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiL2hvbWUvZGVzbW9uZC9Qcm9qZWN0cy9Kb3VybmV5Sm91cm5hbC9hcHAvY29tcG9uZW50cy9nYXBpLmpzIiwiL2hvbWUvZGVzbW9uZC9Qcm9qZWN0cy9Kb3VybmV5Sm91cm5hbC9hcHAvbWFpbi5qcyIsIi9ob21lL2Rlc21vbmQvUHJvamVjdHMvSm91cm5leUpvdXJuYWwvYXBwL3JvdXRlcy9FZGl0b3JSb3V0ZUhhbmRsZXIuanMiLCIvaG9tZS9kZXNtb25kL1Byb2plY3RzL0pvdXJuZXlKb3VybmFsL2FwcC9yb3V0ZXMvSW5kZXhSb3V0ZUhhbmRsZXIuanMiLCIvaG9tZS9kZXNtb25kL1Byb2plY3RzL0pvdXJuZXlKb3VybmFsL2FwcC9yb3V0ZXMvTm90Rm91bmRSb3V0ZUhhbmRsZXIuanMiLCIvaG9tZS9kZXNtb25kL1Byb2plY3RzL0pvdXJuZXlKb3VybmFsL2FwcC9yb3V0ZXMvUmVzdG9yZVJvdXRlSGFuZGxlci5qcyIsIi9ob21lL2Rlc21vbmQvUHJvamVjdHMvSm91cm5leUpvdXJuYWwvYXBwL3JvdXRlcy9Sb290Um91dGVIYW5kbGVyLmpzIiwiL2hvbWUvZGVzbW9uZC9Qcm9qZWN0cy9Kb3VybmV5Sm91cm5hbC9hcHAvcm91dGVzL1NldHRpbmdzUm91dGVIYW5kbGVyLmpzIiwiL2hvbWUvZGVzbW9uZC9Qcm9qZWN0cy9Kb3VybmV5Sm91cm5hbC9hcHAvcm91dGVzL2F1dGhlbnRpY2F0ZS5qcyIsIi9ob21lL2Rlc21vbmQvUHJvamVjdHMvSm91cm5leUpvdXJuYWwvYXBwL3V0aWxpdGllcy9kYXRlcy5qcyIsIi9ob21lL2Rlc21vbmQvUHJvamVjdHMvSm91cm5leUpvdXJuYWwvYXBwL3V0aWxpdGllcy9kZWNyeXB0RW50cnkuanMiLCIvaG9tZS9kZXNtb25kL1Byb2plY3RzL0pvdXJuZXlKb3VybmFsL2FwcC91dGlsaXRpZXMvZW5jcnlwdEVudHJ5LmpzIiwiL2hvbWUvZGVzbW9uZC9Qcm9qZWN0cy9Kb3VybmV5Sm91cm5hbC9hcHAvdXRpbGl0aWVzL2Vuc3VyZUdhcGlMb2FkZWQuanMiLCIvaG9tZS9kZXNtb25kL1Byb2plY3RzL0pvdXJuZXlKb3VybmFsL2FwcC91dGlsaXRpZXMvZ2FwaUhhbmRsZXIuanMiLCIvaG9tZS9kZXNtb25kL1Byb2plY3RzL0pvdXJuZXlKb3VybmFsL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9pbmRleC5qcyIsIi9ob21lL2Rlc21vbmQvUHJvamVjdHMvSm91cm5leUpvdXJuYWwvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9iYXNlNjQtanMvbGliL2I2NC5qcyIsIi9ob21lL2Rlc21vbmQvUHJvamVjdHMvSm91cm5leUpvdXJuYWwvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9pZWVlNzU0L2luZGV4LmpzIiwiL2hvbWUvZGVzbW9uZC9Qcm9qZWN0cy9Kb3VybmV5Sm91cm5hbC9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9jcnlwdG8tYnJvd3NlcmlmeS9oZWxwZXJzLmpzIiwiL2hvbWUvZGVzbW9uZC9Qcm9qZWN0cy9Kb3VybmV5Sm91cm5hbC9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9jcnlwdG8tYnJvd3NlcmlmeS9pbmRleC5qcyIsIi9ob21lL2Rlc21vbmQvUHJvamVjdHMvSm91cm5leUpvdXJuYWwvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvY3J5cHRvLWJyb3dzZXJpZnkvbWQ1LmpzIiwiL2hvbWUvZGVzbW9uZC9Qcm9qZWN0cy9Kb3VybmV5Sm91cm5hbC9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9jcnlwdG8tYnJvd3NlcmlmeS9ybmcuanMiLCIvaG9tZS9kZXNtb25kL1Byb2plY3RzL0pvdXJuZXlKb3VybmFsL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2NyeXB0by1icm93c2VyaWZ5L3NoYS5qcyIsIi9ob21lL2Rlc21vbmQvUHJvamVjdHMvSm91cm5leUpvdXJuYWwvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvY3J5cHRvLWJyb3dzZXJpZnkvc2hhMjU2LmpzIiwiL2hvbWUvZGVzbW9uZC9Qcm9qZWN0cy9Kb3VybmV5Sm91cm5hbC9ub2RlX21vZHVsZXMvbW9tZW50L21vbWVudC5qcyIsIi9ob21lL2Rlc21vbmQvUHJvamVjdHMvSm91cm5leUpvdXJuYWwvbm9kZV9tb2R1bGVzL3NqY2wvc2pjbC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBLElBQUksS0FBSyxHQUFHLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQztBQUNwQyxJQUFJLE1BQU0sR0FBRyxPQUFPLENBQUMsY0FBYyxDQUFDLENBQUM7QUFDckMsSUFBSSxpQkFBaUIsR0FBRyxPQUFPLENBQUMsMEJBQTBCLENBQUM7QUFDM0QsSUFBSSxNQUFNLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQzs7QUFFOUIsb0NBQW9DLHVCQUFBO0NBQ25DLE1B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Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNybENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbktBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxZ0dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInZhciBSZWFjdCA9IHJlcXVpcmUoJ3JlYWN0L2FkZG9ucycpO1xudmFyIFJvdXRlciA9IHJlcXVpcmUoJ3JlYWN0LXJvdXRlcicpO1xudmFyIGhhbmRsZUdhcGlSZXF1ZXN0ID0gcmVxdWlyZSgnLi4vdXRpbGl0aWVzL2dhcGlIYW5kbGVyJylcbnZhciBtb21lbnQgPSByZXF1aXJlKCdtb21lbnQnKVxuXG5tb2R1bGUuZXhwb3J0cyA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcblx0bWl4aW5zOiBbIFJvdXRlci5TdGF0ZSwgUm91dGVyLk5hdmlnYXRpb24gXSxcblx0Z2V0SW5pdGlhbFN0YXRlOiBmdW5jdGlvbigpIHtcblx0XHRyZXR1cm4ge1xuXHRcdH1cblx0fSxcblx0Y29tcG9uZW50V2lsbE1vdW50OiBmdW5jdGlvbigpIHtcblx0fSxcblx0YmFja3VwOiBmdW5jdGlvbigpIHtcblx0XHRpZiAodGhpcy5zdGF0ZS5iYWNraW5nVXApIHtcblx0XHRcdHJldHVyblxuXHRcdH1cblxuXHRcdHRoaXMuc2V0U3RhdGUoe2JhY2tpbmdVcDogdHJ1ZX0pXG5cdFx0dGhpcy5sb2FkRG9jdW1lbnRzKGZ1bmN0aW9uKGVyciwgcmVzdWx0cykge1xuXHRcdFx0aWYgKGVycikge1xuXHRcdFx0XHRjb25zb2xlLmxvZyhlcnIpXG5cdFx0XHRcdHJldHVyblxuXHRcdFx0fVxuXHRcdFx0dmFyIGpzb24gPSBKU09OLnN0cmluZ2lmeShyZXN1bHRzKTtcblx0XHRcdHZhciBwYXVzZSA9IDJcblxuXHRcdFx0dXBsb2FkQmFja3VwVG9Ecml2ZShqc29uLCBmdW5jdGlvbihlKSB7XG5cdFx0XHRcdGFsZXJ0aWZ5Lm1lc3NhZ2UoJ0JhY2tlZCB1cCBKb3VybmFsJywgcGF1c2UpO1xuXHRcdFx0XHRzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdHRoaXMuc2V0U3RhdGUoe2JhY2tpbmdVcDogZmFsc2V9KVxuXHRcdFx0XHR9LmJpbmQodGhpcyksIHBhdXNlKVxuXHRcdFx0fS5iaW5kKHRoaXMpKTtcblx0XHR9LmJpbmQodGhpcykpXG5cdH0sXG5cdHJlc3RvcmU6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMudHJhbnNpdGlvblRvKCdyZXN0b3JlJylcblx0fSxcblx0bG9hZERvY3VtZW50czogZnVuY3Rpb24oY2FsbGJhY2spIHtcblx0XHR0aGlzLnByb3BzLmRiLmFsbERvY3Moe1xuXHRcdFx0aW5jbHVkZV9kb2NzOiB0cnVlLFxuXHRcdH0pLnRoZW4oZnVuY3Rpb24ocmVzdWx0cykge1xuXHRcdFx0dmFyIHJlc3VsdHMgPSByZXN1bHRzLnJvd3MubWFwKGZ1bmN0aW9uKGRvYyl7XG5cdFx0XHRcdHZhciBlbnRyeSA9IGRvYy5kb2M7XG5cdFx0XHRcdHJldHVybiBlbnRyeVxuXHRcdFx0fS5iaW5kKHRoaXMpKTtcblx0XHRcdGNhbGxiYWNrKG51bGwsIHJlc3VsdHMpXG5cdFx0fS5iaW5kKHRoaXMpKVxuXHRcdC5jYXRjaChmdW5jdGlvbihlKSB7XG5cdFx0XHRjYWxsYmFjayhlKVxuXHRcdH0pO1xuXHR9LFxuXHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBiYWNrdXBUZXh0ID0gdGhpcy5zdGF0ZS5iYWNraW5nVXAgPyAnQmFja2luZyB1cCcgOiAnQmFja3VwIHRvIGRyaXZlJ1xuXHRcdHZhciByZXN0b3JlVGV4dCA9IHRoaXMuc3RhdGUucmVzdG9yaW5nID8gJ1Jlc3RvcmluZycgOiAnVmlldyBiYWNrdXBzJ1xuXHRcdHJldHVybiAoPGRpdj5cblx0XHRcdDxidXR0b24gb25DbGljaz17dGhpcy5iYWNrdXB9PntiYWNrdXBUZXh0fTwvYnV0dG9uPjxiciAvPlxuXHRcdFx0PGJ1dHRvbiBvbkNsaWNrPXt0aGlzLnJlc3RvcmV9PntyZXN0b3JlVGV4dH08L2J1dHRvbj48YnIgLz5cblx0XHQ8L2Rpdj4pXG5cdH1cbn0pO1xuXG5mdW5jdGlvbiB1cGxvYWRCYWNrdXBUb0RyaXZlKGpzb24sIGNhbGxiYWNrKSB7XG5cdHZhciBib3VuZGFyeSA9ICctLS0tLS0tMzE0MTU5MjY1MzU4OTc5MzIzODQ2J1xuXHR2YXIgZGVsaW1pdGVyID0gXCJcXHJcXG4tLVwiICsgYm91bmRhcnkgKyBcIlxcclxcblwiXG5cdHZhciBjbG9zZV9kZWxpbSA9IFwiXFxyXFxuLS1cIiArIGJvdW5kYXJ5ICsgXCItLVwiXG5cdHZhciBjb250ZW50VHlwZT1cImFwcGxpY2F0aW9uL2pzb25cIlxuXG5cblx0dmFyIGRhdGVTdHJpbmcgPSAnYmFja3VwLScgK21vbWVudCgpLmZvcm1hdChcIllZWVlNTUREaGhtbXNzXCIpIFxuXHR2YXIgZmlsZU5hbWUgPSBwcm9tcHQoJ0Nob29zZSBhIG5hbWUgZm9yIHRoaXMgYmFja3VwJywgZGF0ZVN0cmluZyk7XG5cblx0aWYgKGZpbGVOYW1lID09IG51bGwpIHtcblx0XHRyZXR1cm47XG5cdH1cblx0ZmlsZU5hbWUgPSBmaWxlTmFtZSArICcuanNvbidcblxuXHR2YXIgbWV0YWRhdGEgPSB7XG5cdFx0J3RpdGxlJzogZmlsZU5hbWUsXG5cdFx0J21pbWVUeXBlJzogY29udGVudFR5cGUsXG5cdFx0J3BhcmVudHMnOiBbeydpZCc6ICdhcHBmb2xkZXInfV1cblx0fTtcblxuXHR2YXIgYmFzZTY0RGF0YSA9IGJ0b2EoSlNPTi5zdHJpbmdpZnkoanNvbikpO1xuXG5cdHZhciBtdWx0aXBhcnRSZXF1ZXN0Qm9keSA9XG5cdFx0ZGVsaW1pdGVyICtcblx0XHQnQ29udGVudC1UeXBlOiBhcHBsaWNhdGlvbi9qc29uXFxyXFxuXFxyXFxuJyArXG5cdFx0SlNPTi5zdHJpbmdpZnkobWV0YWRhdGEpICtcblx0XHRkZWxpbWl0ZXIgK1xuXHRcdCdDb250ZW50LVR5cGU6ICcgKyBjb250ZW50VHlwZSArICdcXHJcXG4nICtcblx0XHQnQ29udGVudC1UcmFuc2Zlci1FbmNvZGluZzogYmFzZTY0XFxyXFxuJyArXG5cdFx0J1xcclxcbicgK1xuXHRcdGJhc2U2NERhdGEgK1xuXHRcdGNsb3NlX2RlbGltO1xuXG5cdHZhciByZXF1ZXN0ID0gZ2FwaS5jbGllbnQucmVxdWVzdCh7XG5cdFx0J3BhdGgnOiAnL3VwbG9hZC9kcml2ZS92Mi9maWxlcycsXG5cdFx0J21ldGhvZCc6ICdQT1NUJyxcblx0XHQncGFyYW1zJzogeyd1cGxvYWRUeXBlJzogJ211bHRpcGFydCd9LFxuXHRcdCdoZWFkZXJzJzoge1xuXHRcdFx0J0NvbnRlbnQtVHlwZSc6ICdtdWx0aXBhcnQvbWl4ZWQ7IGJvdW5kYXJ5PVwiJyArIGJvdW5kYXJ5ICsgJ1wiJ1xuXHRcdH0sXG5cdFx0J2JvZHknOiBtdWx0aXBhcnRSZXF1ZXN0Qm9keVxuXHR9KTtcblx0aGFuZGxlR2FwaVJlcXVlc3QocmVxdWVzdCwgY2FsbGJhY2spXG59XG4iLCJ2YXIgUmVhY3QgPSByZXF1aXJlKCdyZWFjdC9hZGRvbnMnKTtcbnZhciBSb3V0ZXIgPSByZXF1aXJlKCdyZWFjdC1yb3V0ZXInKTtcbnZhciBlbnN1cmVMb2FkZWQgPSByZXF1aXJlKCcuL3V0aWxpdGllcy9lbnN1cmVHYXBpTG9hZGVkJylcblxudmFyIFJvdXRlID0gUm91dGVyLlJvdXRlO1xudmFyIExpbmsgPSBSb3V0ZXIuTGluaztcbnZhciBEZWZhdWx0Um91dGUgPSBSb3V0ZXIuRGVmYXVsdFJvdXRlO1xudmFyIE5vdEZvdW5kUm91dGUgPSBSb3V0ZXIuTm90Rm91bmRSb3V0ZTtcblxudmFyIFJvb3RSb3V0ZUhhbmRsZXIgPSByZXF1aXJlKCcuL3JvdXRlcy9Sb290Um91dGVIYW5kbGVyJylcbnZhciBOb3RGb3VuZFJvdXRlSGFuZGxlciA9IHJlcXVpcmUoJy4vcm91dGVzL05vdEZvdW5kUm91dGVIYW5kbGVyJyk7XG5cblxudmFyIFNldHRpbmdzUm91dGVIYW5kbGVyID0gcmVxdWlyZSgnLi9yb3V0ZXMvU2V0dGluZ3NSb3V0ZUhhbmRsZXInKTtcbnZhciBFZGl0b3JSb3V0ZUhhbmRsZXIgPSByZXF1aXJlKCcuL3JvdXRlcy9FZGl0b3JSb3V0ZUhhbmRsZXInKTtcbnZhciBJbmRleFJvdXRlSGFuZGxlciA9IHJlcXVpcmUoJy4vcm91dGVzL0luZGV4Um91dGVIYW5kbGVyJyk7XG52YXIgcmVzdG9yZVJvdXRlSGFuZGxlciA9IHJlcXVpcmUoJy4vcm91dGVzL1Jlc3RvcmVSb3V0ZUhhbmRsZXInKTtcbi8qIGRlc2xpZ2h0IHJlcXVpcmUgaG9vayAtIGRvIG5vdCBtb2RpZnkgdGhpcyBsaW5lICovXG5cbnZhciByb3V0ZXMgPSAoXG5cdDxSb3V0ZSBoYW5kbGVyPXtSb290Um91dGVIYW5kbGVyfSBwYXRoPVwiL1wiPlxuXHRcdDxEZWZhdWx0Um91dGUgaGFuZGxlcj17SW5kZXhSb3V0ZUhhbmRsZXJ9IG5hbWU9J2luZGV4Jy8+XG5cdFx0PFJvdXRlIGhhbmRsZXI9e0VkaXRvclJvdXRlSGFuZGxlcn0gbmFtZT1cImVkaXRvclwiIHBhdGg9J2VkaXRvci86aWQnLz5cblx0XHQ8Tm90Rm91bmRSb3V0ZSBoYW5kbGVyPXtOb3RGb3VuZFJvdXRlSGFuZGxlcn0gLz5cblx0XHQ8Um91dGUgaGFuZGxlcj17U2V0dGluZ3NSb3V0ZUhhbmRsZXJ9IG5hbWU9J3NldHRpbmdzJyBwYXRoPSdzZXR0aW5ncycvPlxuPFJvdXRlIGhhbmRsZXI9e3Jlc3RvcmVSb3V0ZUhhbmRsZXJ9IG5hbWU9J3Jlc3RvcmUnIHBhdGg9J3Jlc3RvcmUnLz5cbi8qIGRlc2xpZ2h0IHJvdXRlIGhvb2sgLSBkbyBub3QgbW9kaWZ5IHRoaXMgbGluZSAqL1xuXHQ8L1JvdXRlPlxuKTtcblxuXG5mdW5jdGlvbiBpbml0KCkge1xuXHRlbnN1cmVMb2FkZWQoZnVuY3Rpb24oKSB7XG5cdFx0Um91dGVyLnJ1bihyb3V0ZXMsIGZ1bmN0aW9uKEhhbmRsZXIpIHtcblx0XHRcdFx0ICAgUmVhY3QucmVuZGVyKDxIYW5kbGVyIC8+LCBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncm9vdF9qb3VybmV5JykpO1xuXHRcdH0pO1xuXHR9KVxufVxuXG5pZiAodHlwZW9mKGRldmljZSkgIT0gJ3VuZGVmaW5lZCcgJiYgZGV2aWNlLnBsYXRmb3JtICE9PSAnYnJvd3NlcicpIHtcblx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdkZXZpY2VSZWFkeScsIGZ1bmN0aW9uKCkge1xuXHRcdFx0aW5pdCgpXG5cdFx0fSwgZmFsc2UpXG59XG5lbHNlIHtcblx0aW5pdCgpXG59XG4iLCJ2YXIgUmVhY3QgPSByZXF1aXJlKCdyZWFjdC9hZGRvbnMnKTtcbnZhciBSb3V0ZXIgPSByZXF1aXJlKCdyZWFjdC1yb3V0ZXInKTtcbnZhciBSb3V0ZUhhbmRsZXIgPSBSb3V0ZXIuUm91dGVIYW5kbGVyO1xudmFyIGFsZXJ0aWZ5ID0gd2luZG93WydhbGVydGlmeSddID0gcmVxdWlyZSgnYWxlcnRpZnlqcycpXG5cbnZhciBkYXRlcyA9IHJlcXVpcmUoJy4uL3V0aWxpdGllcy9kYXRlcycpXG52YXIgZGVjcnlwdCA9IHJlcXVpcmUoJy4uL3V0aWxpdGllcy9kZWNyeXB0RW50cnknKVxudmFyIGVuY3J5cHQgPSByZXF1aXJlKCcuLi91dGlsaXRpZXMvZW5jcnlwdEVudHJ5JylcbnZhciBtb21lbnQgPSByZXF1aXJlKCdtb21lbnQnKVxuZnVuY3Rpb24gZ2V0TmV4dFNhdmUoKSB7XG5cdFx0dmFyIGQgPSBuZXcgRGF0ZSgpXG5cdFx0ZC5zZXRTZWNvbmRzKGQuZ2V0U2Vjb25kcygpICsgNSk7XG5cdFx0cmV0dXJuIGQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xuXHRtaXhpbnM6IFsgUm91dGVyLlN0YXRlLCBSb3V0ZXIuTmF2aWdhdGlvbl0sXG5cdGdldEluaXRpYWxTdGF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGRvYzogdW5kZWZpbmVkLFxuXHRcdFx0dGltZW91dDogdW5kZWZpbmVkLFxuXHRcdFx0bmV4dF9zYXZlOiBnZXROZXh0U2F2ZSgpLFxuXHRcdFx0Y29udGVudDogJycsXG5cdFx0XHR0YWdzOiBbXSxcblx0XHRcdG1vZGlmaWVkOiBmYWxzZVxuXHRcdH1cblx0fSxcblx0Y29tcG9uZW50RGlkTW91bnQ6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBpZCA9IHRoaXMucHJvcHMucGFyYW1zLmlkXG5cdFx0dGhpcy5wcm9wcy5kYi5nZXQoaWQpLnRoZW4oZnVuY3Rpb24oZG9jKSB7XG5cdFx0XHR2YXIgZW50cnkgPSBkZWNyeXB0KHRoaXMucHJvcHMuYXV0aGtleSwgZG9jKVxuXHRcdFx0dGhpcy5zZXRTdGF0ZSh7XG5cdFx0XHRcdGRvYzoge1xuXHRcdFx0XHRcdGlkOiBlbnRyeS5faWQsXG5cdFx0XHRcdFx0cmV2OiBlbnRyeS5fcmV2XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGNvbnRlbnQ6IGVudHJ5LmNvbnRlbnQsXG5cdFx0XHRcdHRhZ3M6IGVudHJ5LnRhZ3MgPyBlbnRyeS50YWdzIDogW10sXG5cdFx0XHRcdGRhdGV0aW1lOiBlbnRyeS5kYXRldGltZVxuXHRcdFx0fSk7XG5cblx0XHR9LmJpbmQodGhpcykpLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuXHRcdFx0aWYgKGVyci5zdGF0dXMgPT09IDQwNCkge1xuXHRcdFx0XHR0aGlzLnNldFN0YXRlKHtcblx0XHRcdFx0XHRkYXRldGltZTogbW9tZW50KCkuZm9ybWF0KFwiWVlZWU1NRERoaG1tc3NcIilcblx0XHRcdFx0fSlcblx0XHRcdH1cblx0XHRcdGVsc2Uge1xuXHRcdFx0XHRjb25zb2xlLmxvZyhlcnIpO1xuXHRcdFx0fVxuXHRcdH0uYmluZCh0aGlzKSlcblxuXHRcdHdpbmRvdy5vbmJlZm9yZXVubG9hZCA9IGZ1bmN0aW9uIChlKSB7XG5cdFx0XHRpZiAodGhpcy5zdGF0ZS5tb2RpZmllZCkge1xuXHRcdFx0XHR2YXIgbWVzc2FnZSA9IFwiSm91cm5leSBoYXMgdW5zYXZlZCBjaGFuZ2VzLiBEbyB5b3Ugd2FudCB0byBsZWF2ZSB0aGUgcGFnZSBhbmQgZGlzY2FyZCB5b3VyIGNoYW5nZXM/XCIsXG5cdFx0XHRcdFx0ZSA9IGUgfHwgd2luZG93LmV2ZW50O1xuXHRcdFx0XHQvLyBGb3IgSUUgYW5kIEZpcmVmb3hcblx0XHRcdFx0aWYgKGUpIHtcblx0XHRcdFx0XHRlLnJldHVyblZhbHVlID0gbWVzc2FnZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIEZvciBTYWZhcmlcblx0XHRcdFx0cmV0dXJuIG1lc3NhZ2U7XG5cdFx0XHR9XG5cdFx0fS5iaW5kKHRoaXMpO1xuXHR9LFxuXHRjb21wb25lbnRXaWxsVW5tb3VudDogZnVuY3Rpb24oKSB7XG5cdFx0d2luZG93Lm9uYmVmb3JldW5sb2FkID0gbnVsbDtcblx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMuc3RhdGUudGltZW91dCk7XG5cdH0sXG5cdHNjaGVkdWxlU2F2ZTogZnVuY3Rpb24oKSB7XG5cdFx0d2luZG93LmNsZWFyVGltZW91dCh0aGlzLnN0YXRlLnRpbWVvdXQpO1xuXHRcdHZhciB0aW1lb3V0ID0gd2luZG93LnNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLnNhdmVFbnRyeSgpO1xuXHRcdH0uYmluZCh0aGlzKSwgNTAwKVxuXHRcdHRoaXMuc2V0U3RhdGUoe3RpbWVvdXQ6IHRpbWVvdXR9KVxuXHR9LFxuXHRjaGFuZ2VkOiBmdW5jdGlvbihlKSB7XG5cdFx0dmFyIGNvbnRlbnQgPSBlLnRhcmdldC52YWx1ZTtcblx0XHR0aGlzLnNjaGVkdWxlU2F2ZSgpXG5cdFx0dGhpcy5zZXRTdGF0ZSh7Y29udGVudDogY29udGVudCwgbW9kaWZpZWQ6IHRydWV9KVxuXHR9LFxuXHRzYXZlRW50cnk6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBjb250ZW50ID0gdGhpcy5zdGF0ZS5jb250ZW50XG5cdFx0dmFyIGlkID0gdGhpcy5wcm9wcy5wYXJhbXMuaWRcblx0XHR2YXIgZGIgPSB0aGlzLnByb3BzLmRiXG5cblx0XHR2YXIgYWZ0ZXJTYXZlID0gZnVuY3Rpb24ocmVzcG9uc2UpIHtcblx0XHRcdHRoaXMuc2V0U3RhdGUoe1xuXHRcdFx0XHRuZXh0X3NhdmU6IGdldE5leHRTYXZlKCksXG5cdFx0XHRcdGRvYzogcmVzcG9uc2UsXG5cdFx0XHRcdG1vZGlmaWVkOiBmYWxzZVxuXHRcdFx0fSlcblx0XHRcdGFsZXJ0aWZ5Lm5vdGlmeSgnc2F2aW5nLi4uJywgJ3NhdmUnLCAxKVxuXHRcdH0uYmluZCh0aGlzKTtcblxuXHRcdHZhciBwdXREb2MgPSBlbmNyeXB0KHRoaXMucHJvcHMuYXV0aGtleSwge1xuXHRcdFx0X2lkOiBpZCxcblx0XHRcdGNvbnRlbnQ6IGNvbnRlbnQsXG5cdFx0XHR0YWdzOiB0aGlzLnN0YXRlLnRhZ3MsXG5cdFx0XHRkYXRldGltZTogdGhpcy5zdGF0ZS5kYXRldGltZVxuXHRcdH0pXG5cblx0XHRpZiAodGhpcy5zdGF0ZS5kb2MpIHtcblx0XHRcdHB1dERvYy5fcmV2ID0gdGhpcy5zdGF0ZS5kb2MucmV2XG5cdFx0fVxuXHRcdGRiLnB1dChcblx0XHRcdHB1dERvY1xuXHRcdCkudGhlbihhZnRlclNhdmUpLmNhdGNoKGZ1bmN0aW9uKGUpIHtcblx0XHRcdGNvbnNvbGUubG9nKGUpO1x0XHRcdFx0XG5cdFx0fSk7XG5cdH0sXG5cdHRyYW5zaXRpb25Ub0luZGV4OiBmdW5jdGlvbigpIHtcblx0XHRpZiAodGhpcy5zdGF0ZS5tb2RpZmllZCkge1xuXHRcdFx0d2luZG93LmNsZWFyVGltZW91dCh0aGlzLnN0YXRlLnRpbWVvdXQpO1xuXHRcdFx0dmFyIG1lc3NhZ2UgPSBcIkpvdXJuZXkgaGFzIHVuc2F2ZWQgY2hhbmdlcy4gRG8geW91IHdhbnQgdG8gbGVhdmUgdGhlIHBhZ2UgYW5kIGRpc2NhcmQgeW91ciBjaGFuZ2VzP1wiXG5cdFx0XHRhbGVydGlmeS5jb25maXJtKG1lc3NhZ2UpLnNldCgndGl0bGUnLCAnVW5zYXZlZCBDaGFuZ2VzJykuc2V0KCdsYWJlbHMnLCB7b2s6J1llcycsIGNhbmNlbDonTm8nfSkuc2V0KCdvbm9rJywgZnVuY3Rpb24oKXtcblx0XHRcdFx0dGhpcy50cmFuc2l0aW9uVG8oJ2luZGV4Jyk7XG5cdFx0XHR9LmJpbmQodGhpcykpLnNldCgnb25jYW5jZWwnLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0dGhpcy5zY2hlZHVsZVNhdmUoKTtcblx0XHRcdH0uYmluZCh0aGlzKSk7IFxuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdHRoaXMudHJhbnNpdGlvblRvKCdpbmRleCcpO1xuXHRcdH1cblx0fSxcblx0ZGVsZXRlRW50cnk6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBkYiA9IHRoaXMucHJvcHMuZGJcblx0XHRpZiAodGhpcy5zdGF0ZS5kb2MpIHtcblx0XHRcdGFsZXJ0aWZ5LmNvbmZpcm0oJ0RlbGV0ZSB0aGlzIGVudHJ5PycpXG5cdFx0XHQuc2V0KCd0aXRsZScsICdDb25maXJtIEFjdGlvbicpXG5cdFx0XHQuc2V0KCdsYWJlbHMnLCB7b2s6J1llcycsIGNhbmNlbDonTm8nfSlcblx0XHRcdC5zZXQoJ29ub2snLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0ZGIucmVtb3ZlKHRoaXMuc3RhdGUuZG9jLmlkLCB0aGlzLnN0YXRlLmRvYy5yZXYpXG5cdFx0XHRcdC50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdHRoaXMudHJhbnNpdGlvblRvSW5kZXgoKVx0XG5cdFx0XHRcdH0uYmluZCh0aGlzKSlcblx0XHRcdFx0LmNhdGNoKGZ1bmN0aW9uKGVycil7Y29uc29sZS5sb2coZXJyKX0pXG5cdFx0XHR9LmJpbmQodGhpcykpOyBcblx0XHR9XG5cdH0sXG5cdGFkZFRhZ0Zyb21FbGVtZW50OiBmdW5jdGlvbihlbGVtZW50KSB7XG5cdFx0dmFyIHZhbHVlID0gZWxlbWVudC52YWx1ZVxuXHRcdGVsZW1lbnQudmFsdWUgPSAnJ1xuXHRcdGlmICh2YWx1ZS5sZW5ndGggPiAwICYmIHRoaXMuc3RhdGUudGFncy5pbmRleE9mKHZhbHVlKSA9PT0gLTEpIHtcblx0XHRcdGNvbnNvbGUubG9nKCduZXcgdGFnOicsIHZhbHVlKVxuXHRcdFx0dGhpcy5zZXRTdGF0ZSh7XG5cdFx0XHRcdHRhZ3M6IHRoaXMuc3RhdGUudGFncy5jb25jYXQodmFsdWUpLFxuXHRcdFx0XHRtb2RpZmllZDogdHJ1ZVxuXHRcdFx0fSk7XG5cdFx0XHR0aGlzLnNjaGVkdWxlU2F2ZSgpO1xuXHRcdH1cblx0fSxcblx0dGFnc0lucHV0Q2hhbmdlZDogZnVuY3Rpb24oZSkge1xuXHRcdHN3aXRjaCAoZS50YXJnZXQudmFsdWUuc3Vic3RyKC0xKSkge1xuXHRcdFx0Y2FzZSAnLCc6XG5cdFx0XHRjYXNlICcgJzpcblx0XHRcdFx0ZS50YXJnZXQudmFsdWUgPSBlLnRhcmdldC52YWx1ZS5zdWJzdHJpbmcoMCwgZS50YXJnZXQudmFsdWUubGVuZ3RoLTEpO1xuXHRcdFx0XHR0aGlzLmFkZFRhZ0Zyb21FbGVtZW50KGUudGFyZ2V0KTtcblx0XHRcdFx0YnJlYWtcdFxuXHRcdH1cblx0fSxcblx0cmVtb3ZlVGFnOiBmdW5jdGlvbih0YWcpIHtcblx0XHR2YXIgaWR4ID0gdGhpcy5zdGF0ZS50YWdzLmluZGV4T2YodGFnKVxuXHRcdGlmIChpZHggIT09IC0xKSB7XG5cdFx0XHR2YXIgdGFncyA9IHRoaXMuc3RhdGUudGFnc1xuXHRcdFx0dGFncy5zcGxpY2UoaWR4LCAxKVxuXHRcdFx0dGhpcy5zZXRTdGF0ZSh7dGFnczogdGFncywgbW9kaWZpZWQ6IHRydWV9KTtcblx0XHRcdHRoaXMuc2NoZWR1bGVTYXZlKClcblx0XHR9XG5cdH0sXG5cdHRhZ0tleURvd246IGZ1bmN0aW9uKGUpIHtcblx0XHRpZiAoZS5rZXlDb2RlID09PSAxMykge1xuXHRcdFx0dGhpcy5hZGRUYWdGcm9tRWxlbWVudCh0aGlzLnJlZnMudGFncy5nZXRET01Ob2RlKCkpO1xuXHRcdH1cblx0fSxcblx0Zm9jdXM6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMuc2V0U3RhdGUoe2ZvY3VzZWQ6IHRydWV9KVxuXHR9LFxuXHRibHVyOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLnNldFN0YXRlKHtmb2N1c2VkOiBmYWxzZX0pXG5cdH0sXG5cdGZvY3VzVGFnc0lucHV0OiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLnJlZnMudGFncy5nZXRET01Ob2RlKCkuZm9jdXMoKTtcblx0fSxcblx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHR2YXIgcm91dGUgPSB0aGlzLmdldFJvdXRlcygpO1xuXG5cdFx0dmFyIGRlbGV0ZUVsZW1lbnQ7XG5cdFx0XG5cdFx0aWYgKHRoaXMuc3RhdGUuZG9jKSB7XG5cdFx0XHRkZWxldGVFbGVtZW50ID0gKFxuXHRcdFx0XHQ8ZGl2IGNsYXNzTmFtZT1cImVudHJ5X2RlbGV0ZVwiIG9uQ2xpY2s9e3RoaXMuZGVsZXRlRW50cnl9PlxuXHRcdFx0XHQ8aSBjbGFzc05hbWU9XCJmYSBmYS10cmFzaFwiPjwvaT5cblx0XHRcdFx0PC9kaXY+XG5cdFx0XHQpO1xuXHRcdH1cblx0XHRcblx0XHRyZXR1cm4gKFxuXHRcdFx0PGRpdiBjbGFzc05hbWU9XCJqb3VybmV5X2NvbnRhaW5lclwiPlxuXHRcdFx0XHQ8ZGl2IGNsYXNzTmFtZT1cImpvdXJuZXlfdG9vbGJhciBlbnRyeV90b3BcIj5cblx0XHRcdFx0XHQ8ZGl2IGNsYXNzTmFtZT1cImVudHJ5X2JhY2tcIiBvbkNsaWNrPXt0aGlzLnRyYW5zaXRpb25Ub0luZGV4fT5cblx0XHRcdFx0XHRcdCYjODU5MjsgYmFja1xuXHRcdFx0XHRcdDwvZGl2PlxuXHRcdFx0XHRcdHtkZWxldGVFbGVtZW50fVxuXHRcdFx0XHQ8L2Rpdj5cblxuXHRcdFx0XHQ8dGV4dGFyZWEgb25Gb2N1cz17dGhpcy5mb2N1c30gb25CbHVyPXt0aGlzLmJsdXJ9IG9uQ2hhbmdlPXt0aGlzLmNoYW5nZWR9IHJlZj1cImVkaXRvclwiIGNsYXNzTmFtZT1cImNvbnRlbnQgam91cm5leV9lZGl0b3JcIiB2YWx1ZT17dGhpcy5zdGF0ZS5jb250ZW50fT5cblx0XHRcdFx0PC90ZXh0YXJlYT5cblx0XHRcdFx0PGRpdiBjbGFzc05hbWU9e1wiam91cm5leV90b29sYmFyIGVudHJ5X3RhZ3NcIiArICh0aGlzLnN0YXRlLmZvY3VzZWQgPyAnIGhpZGUnIDogJycpfT5cblx0XHRcdFx0XHQ8ZGl2IGNsYXNzTmFtZT1cImVudHJ5X3RhZ3NfY29udGFpbmVyXCI+XG5cdFx0XHRcdFx0PGkgY2xhc3NOYW1lPVwiZmEgZmEtdGFnc1wiIG9uQ2xpY2s9e3RoaXMuZm9jdXNUYWdzSW5wdXR9PjwvaT5cblx0XHRcdFx0XHRcdHt0aGlzLnN0YXRlLnRhZ3MubWFwKGZ1bmN0aW9uKHRhZykge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gPHNwYW4gY2xhc3NOYW1lPVwiZW50cnlfdGFnXCIgb25DbGljaz17dGhpcy5yZW1vdmVUYWcuYmluZCh0aGlzLCB0YWcpfSBrZXk9e3RhZ30+e3RhZ308L3NwYW4+XG5cdFx0XHRcdFx0XHR9LmJpbmQodGhpcykpfVxuXHRcdFx0XHRcdDwvZGl2PlxuXHRcdFx0XHQ8L2Rpdj5cblx0XHRcdFx0PGRpdiBjbGFzc05hbWU9e1wiam91cm5leV90b29sYmFyIGVudHJ5X3RhZ3NfaW5wdXRcIiArICh0aGlzLnN0YXRlLmZvY3VzZWQgPyAnIGhpZGUnOicnKX0gPlxuXHRcdFx0XHRcdDxpbnB1dCBjbGFzc05hbWU9XCJcIiBvbklucHV0PXt0aGlzLnRhZ3NJbnB1dENoYW5nZWR9IG9uS2V5RG93bj17dGhpcy50YWdLZXlEb3dufSByZWY9XCJ0YWdzXCIvPlxuXHRcdFx0XHQ8L2Rpdj5cblx0XHRcdDwvZGl2PlxuXHRcdCk7XG5cdH1cbn0pO1xuIiwidmFyIFJlYWN0ID0gcmVxdWlyZSgncmVhY3QvYWRkb25zJyk7XG52YXIgUm91dGVyID0gcmVxdWlyZSgncmVhY3Qtcm91dGVyJyk7XG52YXIgUm91dGVIYW5kbGVyID0gUm91dGVyLlJvdXRlSGFuZGxlcjtcbnZhciBkZWNyeXB0ID0gcmVxdWlyZSgnLi4vdXRpbGl0aWVzL2RlY3J5cHRFbnRyeScpXG52YXIgbW9tZW50ID0gcmVxdWlyZSgnbW9tZW50JylcblxubW9kdWxlLmV4cG9ydHMgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG5cdG1peGluczogWyBSb3V0ZXIuU3RhdGUsIFJvdXRlci5OYXZpZ2F0aW9uIF0sXG5cdGdldEluaXRpYWxTdGF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGVudHJpZXM6IFtdXG5cdFx0fVxuXHR9LFxuXHRjb21wb25lbnREaWRNb3VudDogZnVuY3Rpb24oKSB7XG5cdFx0dmFyIGRiID0gdGhpcy5wcm9wcy5kYjtcblx0XHRkYi5nZXQoJ2pvdXJuZXlfbWV0YWRhdGEnKVxuXHRcdC50aGVuKGZ1bmN0aW9uKGRvYykge1xuXHRcdFx0dmFyIG5leHRJZCA9IGRvYy5uZXh0SWRcblxuXHRcdFx0ZGIuYWxsRG9jcyh7XG5cdFx0XHRcdGluY2x1ZGVfZG9jczogdHJ1ZSxcblx0XHRcdFx0c3RhcnRrZXk6ICdlbnRyeTAnLFxuXHRcdFx0XHRlbmRrZXk6ICdlbnRyeXonXG5cdFx0XHR9KS50aGVuKGZ1bmN0aW9uKHJlc3VsdHMpIHtcblx0XHRcdFx0dmFyIHJlc3VsdHMgPSByZXN1bHRzLnJvd3MubWFwKGZ1bmN0aW9uKGRvYyl7XG5cdFx0XHRcdFx0dmFyIGVudHJ5ID0gZGVjcnlwdCh0aGlzLnByb3BzLmF1dGhrZXksIGRvYy5kb2MpO1xuXHRcdFx0XHRcdHJldHVybiBlbnRyeVxuXHRcdFx0XHR9LmJpbmQodGhpcykpLnNvcnQoZnVuY3Rpb24oYSwgYikge1xuXHRcdFx0XHRcdHZhciBhID0gYS5kYXRldGltZSA/IG1vbWVudChhLmRhdGV0aW1lLCAnWVlZWU1NRERoaG1tc3MnKSA6IG1vbWVudCgpLnllYXIoMTk2OSlcblx0XHRcdFx0XHR2YXIgYiA9IGIuZGF0ZXRpbWUgPyBtb21lbnQoYi5kYXRldGltZSwgJ1lZWVlNTUREaGhtbXNzJykgOiBtb21lbnQoKS55ZWFyKDE5NjkpXG5cdFx0XHRcdFx0dmFyIGRpZmYgPSBiLmRpZmYoYSlcblx0XHRcdFx0XHRyZXR1cm4gZGlmZjtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHRoaXMuc2V0U3RhdGUoeyByZXN1bHRzOnJlc3VsdHMsIGVudHJpZXM6cmVzdWx0cyB9KVxuXHRcdFx0fS5iaW5kKHRoaXMpKVxuXHRcdFx0LmNhdGNoKGZ1bmN0aW9uKGUpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coZSk7XG5cdFx0XHR9KTtcblx0XHR9LmJpbmQodGhpcykpO1xuXG5cdH0sXG5cdGNyZWF0ZUVudHJ5OiBmdW5jdGlvbigpIHtcblx0XHR2YXIgZGIgPSB0aGlzLnByb3BzLmRiO1xuXHRcdGRiLmdldCgnam91cm5leV9tZXRhZGF0YScpXG5cdFx0LnRoZW4oZnVuY3Rpb24oZG9jKSB7XG5cdFx0XHR2YXIgbmV4dElkID0gZG9jLm5leHRJZFxuXHRcdFx0ZG9jLm5leHRJZCsrO1xuXHRcdFx0ZGIucHV0KGRvYykudGhlbihmdW5jdGlvbihkb2MpIHtcblx0XHRcdH0pXG5cdFx0XHQuY2F0Y2goZnVuY3Rpb24oZSkge1xuXHRcdFx0XHRjb25zb2xlLmxvZyhlKTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0aGlzLnRyYW5zaXRpb25UbygnZWRpdG9yJywge2lkOiAnZW50cnknK2RvYy5uZXh0SWR9KTtcblx0XHR9LmJpbmQodGhpcykpO1xuXHR9LFxuXHRlZGl0RW50cnk6IGZ1bmN0aW9uKGVudHJ5LCBlKSB7XG5cdFx0dGhpcy50cmFuc2l0aW9uVG8oJ2VkaXRvcicsIHtpZDogZW50cnkuX2lkfSlcblx0fSxcblx0ZmlsdGVyOiBmdW5jdGlvbihlKSB7XG5cdFx0dmFyIHZhbHVlID0gZS50YXJnZXQudmFsdWU7XG5cdFx0aWYgKHZhbHVlLmxlbmd0aCA+IDApIHtcblx0XHRcdHRoaXMuc2V0U3RhdGUoe2VudHJpZXM6IHRoaXMuc3RhdGUucmVzdWx0cy5maWx0ZXIoZnVuY3Rpb24oZW50cnkpIHtcblx0XHRcdFx0cmV0dXJuIGVudHJ5LmNvbnRlbnQuaW5kZXhPZih2YWx1ZSkgIT09IC0xIHx8IGVudHJ5LnRhZ3Muam9pbigpLmluZGV4T2YodmFsdWUpICE9PSAtMVxuXHRcdFx0fSl9KVxuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdHRoaXMuc2V0U3RhdGUoe2VudHJpZXM6IHRoaXMuc3RhdGUucmVzdWx0c30pXG5cdFx0fVxuXHR9LFxuXHRmb2N1c1NlYXJjaDogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5yZWZzLmZpbHRlci5nZXRET01Ob2RlKCkuZm9jdXMoKVxuXHR9LFxuXHRzZXR0aW5nc0NsaWNrZWQ6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMudHJhbnNpdGlvblRvKCdzZXR0aW5ncycpO1xuXHR9LFxuXHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciByb3V0ZSA9IHRoaXMuZ2V0Um91dGVzKCk7XG5cblx0XHRcblx0XHRyZXR1cm4gKFxuXHRcdFx0PGRpdiBjbGFzc05hbWU9XCJqb3VybmV5X2NvbnRhaW5lclwiPlxuXHRcdFx0XHQ8ZGl2IGNsYXNzTmFtZT1cImpvdXJuZXlfdG9vbGJhciBzZWFyY2hcIiBvbkNsaWNrPXt0aGlzLmZvY3VzU2VhcmNofT5cblx0XHRcdFx0XHQ8aSBjbGFzc05hbWU9XCJmYSBmYS1zZWFyY2ggc2VhcmNoX2luZGV4XCI+PC9pPlxuXHRcdFx0XHRcdDxpbnB1dCBwbGFjZWhvbGRlcj1cImZpbHRlclwiIHJlZj1cImZpbHRlclwiIG9uQ2hhbmdlPXt0aGlzLmZpbHRlcn0gY2xhc3NOYW1lPVwiam91cm5leV9pbnB1dFwiIHR5cGU9XCJ0ZXh0XCIgLz5cblx0XHRcdFx0XHQ8aSBjbGFzc05hbWU9XCJmYSBmYS1jb2cgc2V0dGluZ3NfYnV0dG9uXCIgb25DbGljaz17dGhpcy5zZXR0aW5nc0NsaWNrZWR9PjwvaT5cblx0XHRcdFx0PC9kaXY+XG5cdFx0XHRcdDxkaXYgY2xhc3NOYW1lPVwiam91cm5leV9pbmRleF9saXN0IGNvbnRlbnRcIj5cblx0XHRcdFx0XHR7dGhpcy5zdGF0ZS5lbnRyaWVzLm1hcChmdW5jdGlvbihlbnRyeSkge1xuXHRcdFx0XHRcdFx0aWYgKGVudHJ5LnRhZ3MubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdFx0XHR2YXIgdGFncyA9IDxzcGFuPnRhZ3M6IHtlbnRyeS50YWdzLm1hcChmdW5jdGlvbih0YWcsIGlkeCwgbGlzdCkge1xuXHRcdFx0XHRcdFx0XHRcdGlmIChpZHggPT0gbGlzdC5sZW5ndGgtMSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIDxzcGFuIGtleT17dGFnfT57dGFnfTwvc3Bhbj5cblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIChcblx0XHRcdFx0XHRcdFx0XHRcdDxzcGFuIGtleT17dGFnfT57dGFnfSwgPC9zcGFuPlxuXHRcdFx0XHRcdFx0XHRcdClcdFx0XHRcdFx0XG5cdFx0XHRcdFx0XHRcdH0pfVxuXHRcdFx0XHRcdFx0XHQ8L3NwYW4+XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdHJldHVybiAoXG5cdFx0XHRcdFx0XHRcdDxkaXYgY2xhc3NOYW1lPVwiam91cm5leV9pbmRleF9pdGVtXCIgb25DbGljaz17dGhpcy5lZGl0RW50cnkuYmluZCh0aGlzLCBlbnRyeSl9IGtleT17ZW50cnkuX2lkfT5cblx0XHRcdFx0XHRcdFx0XHQ8ZGl2IGNsYXNzTmFtZT1cImpvdXJuZXlfaW5kZXhfaXRlbV90aXRsZVwiPlxuXHRcdFx0XHRcdFx0XHRcdCB7ZW50cnkudGl0bGUuc3Vic3RyaW5nKDAsIDI0KSArICgoZW50cnkudGl0bGUubGVuZ3RoID4gMjQpID8gJy4uLic6JycpIH0gXG5cdFx0XHRcdFx0XHRcdFx0PC9kaXY+XHRcblxuXHRcdFx0XHRcdFx0XHRcdDxkaXYgY2xhc3NOYW1lPVwiam91cm5leV9pbmRleF9pdGVtX21ldGFkYXRhXCI+XG5cdFx0XHRcdFx0XHRcdFx0XHR7dGFnc30mbmJzcDtcblx0XHRcdFx0XHRcdFx0XHQ8L2Rpdj5cdFxuXHRcdFx0XHRcdFx0XHQ8L2Rpdj5cblx0XHRcdFx0XHRcdClcdFx0XHRcdFxuXHRcdFx0XHRcdH0uYmluZCh0aGlzKSl9XG5cdFx0XHRcdDwvZGl2PlxuXG5cdFx0XHRcdDxkaXYgb25DbGljaz17dGhpcy5jcmVhdGVFbnRyeX0gY2xhc3NOYW1lPVwiam91cm5leV90b29sYmFyIGNyZWF0ZVwiPlxuXHRcdFx0XHRcdGNyZWF0ZSBuZXcgZW50cnlcblx0XHRcdFx0PC9kaXY+XG5cdFx0XHQ8L2Rpdj5cblx0XHQpO1xuXHR9XG59KTtcbiIsInZhciBSZWFjdCA9IHJlcXVpcmUoJ3JlYWN0L2FkZG9ucycpO1xudmFyIFJvdXRlciA9IHJlcXVpcmUoJ3JlYWN0LXJvdXRlcicpO1xudmFyIFJvdXRlSGFuZGxlciA9IFJvdXRlci5Sb3V0ZUhhbmRsZXI7XG5cbm1vZHVsZS5leHBvcnRzID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xuXHRtaXhpbnM6IFsgUm91dGVyLlN0YXRlIF0sXG5cdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0dmFyIHJvdXRlID0gdGhpcy5nZXRSb3V0ZXMoKTtcblx0XHRcblx0XHRyZXR1cm4gKFxuXHRcdFx0PGRpdj5cblx0XHRcdFx0PGgyPk5vdCBmb3VuZDwvaDI+XG5cdFx0XHQ8L2Rpdj5cblx0XHQpO1xuXHR9XG59KTtcbiIsInZhciBSZWFjdCA9IHJlcXVpcmUoJ3JlYWN0L2FkZG9ucycpO1xudmFyIFJvdXRlciA9IHJlcXVpcmUoJ3JlYWN0LXJvdXRlcicpO1xudmFyIFJvdXRlSGFuZGxlciA9IFJvdXRlci5Sb3V0ZUhhbmRsZXI7XG52YXIgYWxlcnRpZnkgPSByZXF1aXJlKCdhbGVydGlmeWpzJylcbnZhciBoYW5kbGVHYXBpUmVxdWVzdCA9IHJlcXVpcmUoJy4uL3V0aWxpdGllcy9nYXBpSGFuZGxlcicpXG5cbm1vZHVsZS5leHBvcnRzID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xuXHRtaXhpbnM6IFsgUm91dGVyLlN0YXRlLCBSb3V0ZXIuTmF2aWdhdGlvbiBdLFxuXHRnZXRJbml0aWFsU3RhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiB7XG5cdFx0XHRmaWxlczogW10sXG5cdFx0XHRsb2FkaW5nOiB0cnVlXG5cdFx0fVxuXHR9LFxuXHRjb21wb25lbnRXaWxsTW91bnQ6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBmaWxlTGlzdFJlY2VpdmVkID0gZnVuY3Rpb24oZmlsZXMpIHtcblx0XHRcdGlmIChmaWxlcy5sZW5ndGggPT0gMCkge1xuXHRcdFx0XHR2YXIgbWVzc2FnZSA9IFwiTm8gZmlsZXMgaW4gRHJpdmVcIlxuXHRcdFx0XHRhbGVydGlmeS5hbGVydChtZXNzYWdlKS5zZXQoJ3RpdGxlJywgJ0luZm8nKS5zZXQoJ29ub2snLCBmdW5jdGlvbigpe1xuXHRcdFx0XHRcdHRoaXMudHJhbnNpdGlvblRvKCdzZXR0aW5ncycpO1xuXHRcdFx0XHR9LmJpbmQodGhpcykpXG5cblx0XHRcdH1cblx0XHRcdHRoaXMuc2V0U3RhdGUoe2ZpbGVzOiBmaWxlcy5zb3J0KGZ1bmN0aW9uKGEsYikge1xuXHRcdFx0XHRyZXR1cm4gYSA8IGIgPyAxIDogMFxuXHRcdFx0fSksIGxvYWRpbmc6IGZhbHNlfSlcblx0XHR9LmJpbmQodGhpcylcblxuXHRcdHZhciByZXRyaWV2ZVBhZ2VPZkZpbGVzID0gZnVuY3Rpb24ocmVxdWVzdCwgcmVzdWx0KSB7XG5cdFx0XHRoYW5kbGVHYXBpUmVxdWVzdChyZXF1ZXN0LCBmdW5jdGlvbihlLCByZXNwKSB7XG5cdFx0XHRcdGlmIChlKSB7XG5cdFx0XHRcdFx0Y29uc29sZS5sb2coZSlcblx0XHRcdFx0XHRyZXR1cm5cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXN1bHQgPSByZXN1bHQuY29uY2F0KHJlc3AuaXRlbXMpO1xuXHRcdFx0XHR2YXIgbmV4dFBhZ2VUb2tlbiA9IHJlc3AubmV4dFBhZ2VUb2tlbjtcblx0XHRcdFx0aWYgKG5leHRQYWdlVG9rZW4pIHtcblx0XHRcdFx0XHRyZXF1ZXN0ID0gZ2FwaS5jbGllbnQuZHJpdmUuZmlsZXMubGlzdCh7XG5cdFx0XHRcdFx0XHQncGFnZVRva2VuJzogbmV4dFBhZ2VUb2tlblxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdHJldHJpZXZlUGFnZU9mRmlsZXMocmVxdWVzdCwgcmVzdWx0KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRmaWxlTGlzdFJlY2VpdmVkKHJlc3VsdCk7XG5cdFx0XHRcdH1cblx0XHRcdH0uYmluZCh0aGlzKSlcblx0XHR9XG5cblx0XHR2YXIgaW5pdGlhbFJlcXVlc3QgPSBnYXBpLmNsaWVudC5kcml2ZS5maWxlcy5saXN0KHtcblx0XHRcdCdxJzogJ1xcJ2FwcGZvbGRlclxcJyBpbiBwYXJlbnRzJ1xuXHRcdH0pO1xuXHRcdHJldHJpZXZlUGFnZU9mRmlsZXMoaW5pdGlhbFJlcXVlc3QsIFtdKTtcblx0fSxcblx0cmVzdG9yZUZyb21GaWxlOiBmdW5jdGlvbihmaWxlKSB7XG5cdFx0dmFyIG1lc3NhZ2UgPSBcIkFyZSB5b3Ugc3VyZT9cXG5UaGlzIGNhbm5vdCBiZSB1bmRvbmUhXCJcblx0XHRhbGVydGlmeS5jb25maXJtKG1lc3NhZ2UpLnNldCgndGl0bGUnLCAnUmVzdG9yZSBKb3VybmFsJykuc2V0KCdsYWJlbHMnLCB7b2s6J1llcycsIGNhbmNlbDonTm8nfSkuc2V0KCdvbm9rJywgZnVuY3Rpb24oKXtcblx0XHRcdGdldEZpbGUoZmlsZSwgZnVuY3Rpb24oZGF0YSkge1xuXHRcdFx0XHR2YXIgam91cm5hbCA9IEpTT04ucGFyc2UoZGF0YSkubWFwKGZ1bmN0aW9uKGRvYyl7XG5cdFx0XHRcdFx0ZGVsZXRlIGRvYy5fcmV2XG5cdFx0XHRcdFx0cmV0dXJuIGRvY1xuXHRcdFx0XHR9KVxuXHRcdFx0XHR0aGlzLnByb3BzLmNsZWFyRGF0YWJhc2VBbmREZWF1dGhlbnRpY2F0ZShqb3VybmFsKTtcblx0XHRcdH0uYmluZCh0aGlzKSlcblx0XHR9LmJpbmQodGhpcykpXG5cblx0fSxcblx0ZGVsZXRlRmlsZTogZnVuY3Rpb24oZmlsZSkge1xuXHRcdHZhciBtZXNzYWdlID0gXCJBcmUgeW91IHN1cmU/XFxuVGhpcyBjYW5ub3QgYmUgdW5kb25lIVwiXG5cdFx0YWxlcnRpZnkuY29uZmlybShtZXNzYWdlKS5zZXQoJ3RpdGxlJywgJ0RlbGV0ZSBKb3VybmFsJykuc2V0KCdsYWJlbHMnLCB7b2s6J1llcycsIGNhbmNlbDonTm8nfSkuc2V0KCdvbm9rJywgZnVuY3Rpb24oKXtcblxuXHRcdFx0ZmlsZS5kZWxldGluZyA9IHRydWU7XG5cblx0XHRcdHZhciByZXF1ZXN0ID0gZ2FwaS5jbGllbnQuZHJpdmUuZmlsZXMuZGVsZXRlKHtmaWxlSWQ6ZmlsZS5pZH0pXG5cblx0XHRcdGhhbmRsZUdhcGlSZXF1ZXN0KHJlcXVlc3QsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgZmlsZXMgPSB0aGlzLnN0YXRlLmZpbGVzLmZpbHRlcihmdW5jdGlvbihmKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGYuaWQgIT09IGZpbGUuaWRcdFx0XHRcdFx0ICAgXG5cdFx0XHRcdH0pXG5cdFx0XHRcdHRoaXMuc2V0U3RhdGUoe2ZpbGVzOiBmaWxlc30pXG5cdFx0XHR9LmJpbmQodGhpcykpXG5cdFx0fS5iaW5kKHRoaXMpKVxuXHR9LFxuXHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBmaWxlQnV0dG9ucyA9IHRoaXMuc3RhdGUubG9hZGluZyA9PT0gZmFsc2UgPyAoXG5cdFx0XHQ8ZGl2PlxuXHRcdFx0e3RoaXMuc3RhdGUuZmlsZXMubWFwKGZ1bmN0aW9uKGZpbGUpIHtcblx0XHRcdFx0cmV0dXJuIDxkaXYgY2xhc3NOYW1lPVwiYnV0dG9uR3JvdXBcIiBrZXk9e2ZpbGUuaWR9ID5cblx0XHRcdFx0XHQ8YnV0dG9uIGNsYXNzTmFtZT1cInJlc3RvcmVfYnRuXCIgb25DbGljaz17dGhpcy5yZXN0b3JlRnJvbUZpbGUuYmluZCh0aGlzLCBmaWxlKX0+e2ZpbGUudGl0bGV9PC9idXR0b24+XG5cdFx0XHRcdFx0PGJ1dHRvbiBjbGFzc05hbWU9e1wiZGVsZXRlX2J0blwiKyhmaWxlLmRlbGV0aW5nID8gJyBkZWxldGluZycgOiAnJyl9IG9uQ2xpY2s9e3RoaXMuZGVsZXRlRmlsZS5iaW5kKHRoaXMsIGZpbGUpfT5EZWxldGU8L2J1dHRvbj5cblx0XHRcdFx0PC9kaXY+XHRcdFx0XHRcdFx0XHRcdFx0ICBcblx0XHRcdH0uYmluZCh0aGlzKSl9IFxuXHRcdFx0PC9kaXY+XG5cdCAgICkgOiA8cD5Mb2FkaW5nPC9wPlxuXHRcdFxuXHRcdHJldHVybiAoXG5cdFx0XHQ8ZGl2IGNsYXNzTmFtZT1cImpvdXJuZXlfY29udGFpbmVyXCI+XG5cdFx0XHRcdDxkaXYgY2xhc3NOYW1lPVwiam91cm5leV90b29sYmFyIGVudHJ5X3RvcFwiPlxuXHRcdFx0XHRcdDxkaXYgY2xhc3NOYW1lPVwiZW50cnlfYmFja1wiIG9uQ2xpY2s9e3RoaXMudHJhbnNpdGlvblRvLmJpbmQodGhpcywgJ3NldHRpbmdzJyl9PlxuXHRcdFx0XHRcdFx0JiM4NTkyOyBiYWNrXG5cdFx0XHRcdFx0PC9kaXY+XG5cdFx0XHRcdDwvZGl2PlxuXHRcdFx0XHQ8ZGl2IGNsYXNzTmFtZT1cInJlc3RvcmVfc2NyZWVuXCI+XG5cdFx0XHRcdFx0e2ZpbGVCdXR0b25zfVxuXHRcdFx0XHQ8L2Rpdj5cblx0XHRcdDwvZGl2PlxuXHRcdCk7XG5cdH1cbn0pO1xuXG5mdW5jdGlvbiBnZXRGaWxlKGZpbGUsIGNhbGxiYWNrKSB7XG5cdGdhcGkuY2xpZW50LmRyaXZlLmZpbGVzLmdldCh7XG5cdFx0ZmlsZUlkOiBmaWxlLmlkLFxuXHRcdGFsdDonbWVkaWEnXG5cdH0pLmV4ZWN1dGUoZnVuY3Rpb24ocmVzcG9uc2UpIHtcblx0XHRjYWxsYmFjayhyZXNwb25zZSlcblx0fSlcbn1cbiIsInZhciBSZWFjdCA9IHJlcXVpcmUoJ3JlYWN0L2FkZG9ucycpO1xudmFyIFJvdXRlciA9IHJlcXVpcmUoJ3JlYWN0LXJvdXRlcicpO1xudmFyIFJvdXRlSGFuZGxlciA9IFJvdXRlci5Sb3V0ZUhhbmRsZXI7XG52YXIgQXV0aGVudGljYXRlID0gcmVxdWlyZSgnLi9hdXRoZW50aWNhdGUnKTtcbnZhciBQb3VjaERCID0gcmVxdWlyZSgncG91Y2hkYicpO1xudmFyIHNqY2wgPSByZXF1aXJlKCdzamNsJylcbnZhciBhbGVydGlmeSA9IHJlcXVpcmUoJ2FsZXJ0aWZ5anMnKVxuXG5mdW5jdGlvbiBjcmVhdGVEQihqb3VybmFsLCBjYWxsYmFjaykge1xuXHR2YXIgZGIgPSBuZXcgUG91Y2hEQignam91cm5leV9hcHAnLCB7YXV0b19jb21wYWN0aW9uOiB0cnVlfSk7XG5cdGlmIChqb3VybmFsKSB7XG5cdFx0ZGIuYnVsa0RvY3Moam91cm5hbCkudGhlbihmdW5jdGlvbihyZXN1bHQpIHtcblx0XHRcdGNhbGxiYWNrKGRiKVxuXHRcdH0pLmNhdGNoKGZ1bmN0aW9uKCl7XG5cdFx0XHRjb25zb2xlLmxvZyhlcnIpO1x0XG5cdFx0fSk7XG5cdH1cblx0ZWxzZSB7XG5cdFx0Y2FsbGJhY2soZGIpXG5cdH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG5cdG1peGluczogWyBSb3V0ZXIuU3RhdGUsIFJvdXRlci5OYXZpZ2F0aW9uIF0sXG5cdGNvbXBvbmVudFdpbGxNb3VudDogZnVuY3Rpb24oKSB7XG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcInBhdXNlXCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5zZXRTdGF0ZSh7a2V5OiB1bmRlZmluZWQsIHdyb25nQXR0ZW1wdHM6IDB9KVxuXHRcdH0uYmluZCh0aGlzKSwgZmFsc2UpO1xuXG5cdFx0Y3JlYXRlREIobnVsbCwgZnVuY3Rpb24oZGIpIHtcblx0XHRcdHRoaXMuc2V0U3RhdGUoe1xuXHRcdFx0XHRrZXk6IHVuZGVmaW5lZCxcblx0XHRcdFx0ZGI6IGRiLCBcblx0XHRcdFx0d3JvbmdBdHRlbXB0czogMCxcblx0XHRcdFx0dmVyaWZ5S2V5OiBmYWxzZVxuXHRcdFx0fSlcblxuXHRcdFx0ZGIuZ2V0KCdqb3VybmV5X21ldGFkYXRhJykudGhlbihmdW5jdGlvbihkb2MpIHtcblx0XHRcdFx0dGhpcy5zZXRTdGF0ZSh7XG5cdFx0XHRcdFx0ZXhpc3RzOiB0cnVlLFxuXHRcdFx0XHRcdGxvYWRlZDogdHJ1ZVxuXHRcdFx0XHR9KVxuXHRcdFx0fS5iaW5kKHRoaXMpKS5jYXRjaChmdW5jdGlvbihlKSB7XG5cdFx0XHRcdGlmIChlLnN0YXR1cz09PTQwNCkge1xuXHRcdFx0XHRcdHRoaXMuc2V0U3RhdGUoe1xuXHRcdFx0XHRcdFx0ZXhpc3RzOiBmYWxzZSxcblx0XHRcdFx0XHRcdGxvYWRlZDogdHJ1ZVxuXHRcdFx0XHRcdH0pXG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y29uc29sZS5sb2coZXJyKTtcdFxuXHRcdFx0XHR9XG5cdFx0XHR9LmJpbmQodGhpcykpXG5cblx0XHR9LmJpbmQodGhpcykpXG5cdH0sXG5cdGNvbXBvbmVudFdpbGxVbm1vdW50OiBmdW5jdGlvbigpIHtcblxuXHR9LFxuXHRjcmVhdGVNZXRhZGF0YTogZnVuY3Rpb24oa2V5KSB7XG5cdFx0dGhpcy5zdGF0ZS5kYi5wdXQoe1xuXHRcdFx0X2lkOiAnam91cm5leV9tZXRhZGF0YScsXG5cdFx0XHR2ZXJpZnk6IHNqY2wuZW5jcnlwdChrZXksICdqb3VybmV5IGpvdXJuYWwnKSxcblx0XHRcdG5leHRJZDogMFx0XHRcblx0XHR9KS50aGVuKGZ1bmN0aW9uKHJlc3BvbnNlKSB7XG5cdFx0fSkuY2F0Y2goZnVuY3Rpb24oZSkge1xuXHRcdFx0Y29uc29sZS5sb2coZSlcblx0XHR9KVxuXHR9LFxuXHRjbGVhckRhdGFiYXNlQW5kRGVhdXRoZW50aWNhdGU6IGZ1bmN0aW9uKGpvdXJuYWwpIHtcblx0XHR0aGlzLnN0YXRlLmRiLmRlc3Ryb3koKS50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0Y3JlYXRlREIoam91cm5hbCwgZnVuY3Rpb24oZGIpIHtcblx0XHRcdFx0dGhpcy5zZXRTdGF0ZSh7XG5cdFx0XHRcdFx0ZGI6IGRiLFxuXHRcdFx0XHRcdGtleTogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdHdyb25nQXR0ZW1wdHM6IDAsXG5cdFx0XHRcdFx0ZXhpc3RzOiBmYWxzZVxuXHRcdFx0XHR9KVxuXHRcdFx0XHR0aGlzLnRyYW5zaXRpb25UbygnaW5kZXgnKTtcblx0XHRcdH0uYmluZCh0aGlzKSk7XG5cdFx0fS5iaW5kKHRoaXMpKVxuXHR9LFxuXHRzZXRLZXk6IGZ1bmN0aW9uKGtleSkge1xuXHRcdHRoaXMuc3RhdGUuZGIuZ2V0KCdqb3VybmV5X21ldGFkYXRhJykudGhlbihmdW5jdGlvbihkb2MpIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdHZhciByZXN1bHQgPSBzamNsLmRlY3J5cHQoa2V5LCBkb2MudmVyaWZ5KVxuXHRcdFx0XHR0aGlzLnNldFN0YXRlKHtrZXk6IGtleX0pXG5cdFx0XHR9XG5cdFx0XHRjYXRjaChlcnIpIHtcblx0XHRcdFx0aWYgKGVyci5tZXNzYWdlID09PSBcImNjbTogdGFnIGRvZXNuJ3QgbWF0Y2hcIikge1xuXHRcdFx0XHRcdHRoaXMuc2V0U3RhdGUoe1xuXHRcdFx0XHRcdFx0d3JvbmdBdHRlbXB0czogdGhpcy5zdGF0ZS53cm9uZ0F0dGVtcHRzKzFcblx0XHRcdFx0XHR9KVxuXHRcdFx0XHRcdGFsZXJ0aWZ5LmVycm9yKCdXcm9uZyEnLCAxKVxuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdGNvbnNvbGUubG9nKGVycik7XG5cdFx0XHRcdFx0Y29uc29sZS5sb2coZXJyLnN0YWNrKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0fS5iaW5kKHRoaXMpKS5jYXRjaChmdW5jdGlvbihlKSB7XG5cdFx0XHRpZiAoZS5zdGF0dXM9PT00MDQpIHtcblx0XHRcdFx0aWYgKCF0aGlzLnN0YXRlLnZlcmlmeUtleSkge1xuXHRcdFx0XHRcdHRoaXMuc2V0U3RhdGUoe3dyb25nQXR0ZW1wdHM6IDAsIHZlcmlmeUtleToga2V5fSlcblx0XHRcdFx0fVxuXHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRpZiAoa2V5ID09PSB0aGlzLnN0YXRlLnZlcmlmeUtleSkge1xuXHRcdFx0XHRcdFx0dGhpcy5jcmVhdGVNZXRhZGF0YShrZXkpXG5cdFx0XHRcdFx0XHR0aGlzLnNldFN0YXRlKHtrZXk6IGtleX0pXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVsc2Uge1xuXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHRoaXMuc2V0U3RhdGUoe3ZlcmlmeUtleTogZmFsc2V9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKGUpXG5cdFx0XHR9XG5cdFx0fS5iaW5kKHRoaXMpKVxuXHR9LFxuXHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBoYW5kbGVyID0gPFJvdXRlSGFuZGxlciBkYj17dGhpcy5zdGF0ZS5kYn0gZm9vPVwiYmFyXCIgYXV0aGtleT17dGhpcy5zdGF0ZS5rZXl9IGNsZWFyRGF0YWJhc2VBbmREZWF1dGhlbnRpY2F0ZT17dGhpcy5jbGVhckRhdGFiYXNlQW5kRGVhdXRoZW50aWNhdGV9IC8+XG5cblx0XHRpZiAoIXRoaXMuc3RhdGUubG9hZGVkKSB7XG5cdFx0XHRyZXR1cm4gPGRpdj48L2Rpdj5cblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuc3RhdGUua2V5KSB7XG5cdFx0XHRoYW5kbGVyID0gPEF1dGhlbnRpY2F0ZSBleGlzdHM9e3RoaXMuc3RhdGUuZXhpc3RzfSBvbkF1dGhlbnRpY2F0ZWQ9e3RoaXMuc2V0S2V5fSB3cm9uZ0F0dGVtcHRzPXt0aGlzLnN0YXRlLndyb25nQXR0ZW1wdHN9IHZlcmlmeUtleT17dGhpcy5zdGF0ZS52ZXJpZnlLZXl9IGNsZWFyRGF0YWJhc2VBbmREZWF1dGhlbnRpY2F0ZT17dGhpcy5jbGVhckRhdGFiYXNlQW5kRGVhdXRoZW50aWNhdGV9Lz5cblx0XHR9XG5cblx0XHRcblx0XHRyZXR1cm4gKFxuXHRcdFx0PGRpdj5cblx0XHRcdFx0PG1haW4+XG5cdFx0XHRcdFx0e2hhbmRsZXJ9XG5cdFx0XHRcdDwvbWFpbj5cblx0XHRcdDwvZGl2PlxuXHRcdCk7XG5cdH1cbn0pO1xuXG4iLCJ2YXIgUmVhY3QgPSByZXF1aXJlKCdyZWFjdC9hZGRvbnMnKTtcbnZhciBSb3V0ZXIgPSByZXF1aXJlKCdyZWFjdC1yb3V0ZXInKTtcbnZhciBSb3V0ZUhhbmRsZXIgPSBSb3V0ZXIuUm91dGVIYW5kbGVyO1xudmFyIGRlY3J5cHQgPSByZXF1aXJlKCcuLi91dGlsaXRpZXMvZGVjcnlwdEVudHJ5JylcbnZhciBhbGVydGlmeSA9IHJlcXVpcmUoJ2FsZXJ0aWZ5anMnKVxuXG52YXIgR2FwaSA9IHJlcXVpcmUoJy4uL2NvbXBvbmVudHMvZ2FwaScpXG5cbm1vZHVsZS5leHBvcnRzID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xuXHRtaXhpbnM6IFsgUm91dGVyLlN0YXRlLCBSb3V0ZXIuTmF2aWdhdGlvbl0sXG5cdHRyYW5zaXRpb25Ub0luZGV4OiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLnRyYW5zaXRpb25UbygnaW5kZXgnKTtcblx0fSxcblx0Z2V0SW5pdGlhbFN0YXRlOiBmdW5jdGlvbigpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0anNvbjogJydcblx0XHR9XG5cdH0sXG5cdGV4cG9ydEZpbGU6IGZ1bmN0aW9uKGRlY3J5cHRlZCkge1xuXHRcdHRoaXMucHJvcHMuZGIuYWxsRG9jcyh7XG5cdFx0XHRpbmNsdWRlX2RvY3M6IHRydWUsXG5cdFx0fSkudGhlbihmdW5jdGlvbihyZXN1bHRzKSB7XG5cdFx0XHR2YXIgcmVzdWx0cyA9IHJlc3VsdHMucm93cy5maWx0ZXIoZnVuY3Rpb24ocm93KSB7XG5cdFx0XHRcdHJldHVybiAhZGVjcnlwdGVkIHx8IHJvdy5pZCAhPT0gJ2pvdXJuZXlfbWV0YWRhdGEnXG5cdFx0XHR9KS5tYXAoZnVuY3Rpb24oZG9jKXtcblx0XHRcdFx0dmFyIGVudHJ5ID0gZG9jLmRvYztcblx0XHRcdFx0aWYgKGRlY3J5cHRlZCkge1xuXHRcdFx0XHRcdGRlY3J5cHQodGhpcy5wcm9wcy5hdXRoa2V5LCBkb2MuZG9jKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRlbnRyeS5pZCA9IHVuZGVmaW5lZDtcblx0XHRcdFx0ZW50cnkucmV2ID0gdW5kZWZpbmVkXG5cdFx0XHRcdHJldHVybiBlbnRyeVxuXHRcdFx0fS5iaW5kKHRoaXMpKTtcblxuXHRcdFx0dmFyIGpzb24gPSBKU09OLnN0cmluZ2lmeShyZXN1bHRzKTtcblx0XHRcdHRoaXMuc2V0U3RhdGUoe2pzb246IGpzb259KTtcblx0XHR9LmJpbmQodGhpcykpXG5cdFx0LmNhdGNoKGZ1bmN0aW9uKGUpIHtcblx0XHRcdGNvbnNvbGUubG9nKGUpO1xuXHRcdH0pO1xuXHR9LFxuXHRkZWxldGVKb3VybmFsOiBmdW5jdGlvbigpIHtcblx0XHR2YXIgbWVzc2FnZSA9IFwiQXJlIHlvdSBzdXJlP1xcblRoaXMgY2Fubm90IGJlIHVuZG9uZSFcIlxuXHRcdGFsZXJ0aWZ5LmNvbmZpcm0obWVzc2FnZSkuc2V0KCd0aXRsZScsICdEZWxldGUgSm91cm5hbCcpLnNldCgnbGFiZWxzJywge29rOidZZXMnLCBjYW5jZWw6J05vJ30pLnNldCgnb25vaycsIGZ1bmN0aW9uKCl7XG5cdFx0XHR0aGlzLnByb3BzLmNsZWFyRGF0YWJhc2VBbmREZWF1dGhlbnRpY2F0ZSgpO1xuXHRcdH0uYmluZCh0aGlzKSlcblx0fSxcblx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHR2YXIgcm91dGUgPSB0aGlzLmdldFJvdXRlcygpO1xuXHRcdFxuXHRcdHJldHVybiAoXG5cdFx0XHQ8ZGl2IGNsYXNzTmFtZT1cImpvdXJuZXlfY29udGFpbmVyXCI+XG5cdFx0XHRcdDxkaXYgY2xhc3NOYW1lPVwiam91cm5leV90b29sYmFyIGVudHJ5X3RvcFwiPlxuXHRcdFx0XHRcdDxkaXYgY2xhc3NOYW1lPVwiZW50cnlfYmFja1wiIG9uQ2xpY2s9e3RoaXMudHJhbnNpdGlvblRvSW5kZXh9PlxuXHRcdFx0XHRcdFx0JiM4NTkyOyBiYWNrXG5cdFx0XHRcdFx0PC9kaXY+XG5cdFx0XHRcdDwvZGl2PlxuXHRcdFx0XHQ8ZGl2IGNsYXNzTmFtZT1cImNvbnRlbnRcIj5cblxuXHRcdFx0XHRcdDxHYXBpIGRiPXt0aGlzLnByb3BzLmRifT48L0dhcGk+XG5cblx0XHRcdFx0XHQ8YnV0dG9uIG9uQ2xpY2s9e3RoaXMuZXhwb3J0RmlsZS5iaW5kKHRoaXMsIGZhbHNlKX0+RXhwb3J0IHRvIGpzb24gKGVuY3J5cHRlZCk8L2J1dHRvbj48YnIgLz5cblx0XHRcdFx0XHQ8YnV0dG9uIG9uQ2xpY2s9e3RoaXMuZXhwb3J0RmlsZS5iaW5kKHRoaXMsIHRydWUpfT5FeHBvcnQgdG8ganNvbiAoZGVjcnlwdGVkKTwvYnV0dG9uPjxiciAvPlxuXG5cdFx0XHRcdFx0PGJ1dHRvbiBvbkNsaWNrPXt0aGlzLmRlbGV0ZUpvdXJuYWx9PkRlbGV0ZSBqb3VybmFsPC9idXR0b24+XG5cblx0XHRcdFx0XHQ8dGV4dGFyZWEgY2xhc3NOYW1lPVwianNvblZpZXdcIiB2YWx1ZT17dGhpcy5zdGF0ZS5qc29ufT48L3RleHRhcmVhPlxuXHRcdFx0XHQ8L2Rpdj5cblx0XHRcdDwvZGl2PlxuXHRcdCk7XG5cdH1cbn0pO1xuIiwidmFyIFJlYWN0ID0gcmVxdWlyZSgncmVhY3QvYWRkb25zJyk7XG52YXIgUm91dGVyID0gcmVxdWlyZSgncmVhY3Qtcm91dGVyJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xuXHRzdWJtaXQ6IGZ1bmN0aW9uKGUpIHtcblx0XHRpZiAoZS5rZXlDb2RlPT09MTMpIHtcblx0XHRcdHZhciBlbGVtZW50ID0gdGhpcy5yZWZzLnBhc3N3b3JkLmdldERPTU5vZGUoKVxuXHRcdFx0dGhpcy5wcm9wcy5vbkF1dGhlbnRpY2F0ZWQoZWxlbWVudC52YWx1ZSlcblx0XHRcdGVsZW1lbnQudmFsdWUgPSAnJ1xuXHRcdH1cblx0fSxcblx0cmVzZXREYXRhYmFzZTogZnVuY3Rpb24oKSB7XG5cdFx0dmFyIG1lc3NhZ2UgPSBcIkFyZSB5b3Ugc3VyZT9cXG5UaGlzIGNhbm5vdCBiZSB1bmRvbmUhXCJcblx0XHRhbGVydGlmeS5jb25maXJtKG1lc3NhZ2UpLnNldCgndGl0bGUnLCAnRGVsZXRlIEpvdXJuYWwnKS5zZXQoJ2xhYmVscycsIHtvazonWWVzJywgY2FuY2VsOidObyd9KS5zZXQoJ29ub2snLCBmdW5jdGlvbigpe1xuXHRcdFx0dGhpcy5wcm9wcy5jbGVhckRhdGFiYXNlQW5kRGVhdXRoZW50aWNhdGUoKVxuXHRcdH0uYmluZCh0aGlzKSk7XG5cdFx0YWxlcnRpZnkuZXJyb3IoJ0pvdXJuYWwgcmVzZXQhJywgMSlcblx0fSxcblx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHR2YXIgcGxhY2Vob2xkZXIgPSAnY2hvb3NlIGEgcGFzc3dvcmQnXG5cdFx0aWYgKHRoaXMucHJvcHMudmVyaWZ5S2V5KSB7XG5cdFx0XHRwbGFjZWhvbGRlciA9ICd2ZXJpZnkgcGFzc3dvcmQnXG5cdFx0fVxuXHRcdGlmICh0aGlzLnByb3BzLmV4aXN0cykge1xuXHRcdFx0cGxhY2Vob2xkZXIgPSAnZW50ZXIgYSBwYXNzd29yZCdcblx0XHR9XG5cblx0XHR2YXIgcmVzZXRwdyA9ICh0aGlzLnByb3BzLndyb25nQXR0ZW1wdHMgPj0gMykgPyA8ZGl2IG9uQ2xpY2s9e3RoaXMucmVzZXREYXRhYmFzZX0gY2xhc3NOYW1lPVwicmVzZXRfcGFzc3dvcmRfYnV0dG9uXCI+PHA+Zm9yZ290IHlvdXIgcGFzc3dvcmQ/PC9wPjxwPmNsaWNrIGhlcmUgdG8gZGVsZXRlIHRoZSBqb3VybmFsIGFuZCBzdGFydCBvdmVyPC9wPjwvZGl2PiA6IHVuZGVmaW5lZFxuXG5cdFx0cmV0dXJuICg8ZGl2IGNsYXNzTmFtZT1cImF1dGhfd3JhcHBlclwiPlxuXHRcdFx0XHQ8ZGl2PlxuXHRcdFx0XHRcdDxpIGNsYXNzTmFtZT1cImZhIGZhLWxvY2tcIj48L2k+XG5cdFx0XHRcdFx0PGlucHV0IHBsYWNlaG9sZGVyPXtwbGFjZWhvbGRlcn0gdHlwZT1cInBhc3N3b3JkXCIgYXV0b0ZvY3VzPVwidHJ1ZVwiIHJlZj1cInBhc3N3b3JkXCIgb25LZXlEb3duPXt0aGlzLnN1Ym1pdH0vPlxuXHRcdFx0XHQ8L2Rpdj5cblx0XHRcdFx0e3Jlc2V0cHd9XG5cdFx0PC9kaXY+KVxuXHR9XG59KTtcbiIsIm1vZHVsZS5leHBvcnRzID0ge1xuICAgIGNvbnZlcnQ6ZnVuY3Rpb24oZCkge1xuICAgICAgICAvLyBDb252ZXJ0cyB0aGUgZGF0ZSBpbiBkIHRvIGEgZGF0ZS1vYmplY3QuIFRoZSBpbnB1dCBjYW4gYmU6XG4gICAgICAgIC8vICAgYSBkYXRlIG9iamVjdDogcmV0dXJuZWQgd2l0aG91dCBtb2RpZmljYXRpb25cbiAgICAgICAgLy8gIGFuIGFycmF5ICAgICAgOiBJbnRlcnByZXRlZCBhcyBbeWVhcixtb250aCxkYXldLiBOT1RFOiBtb250aCBpcyAwLTExLlxuICAgICAgICAvLyAgIGEgbnVtYmVyICAgICA6IEludGVycHJldGVkIGFzIG51bWJlciBvZiBtaWxsaXNlY29uZHNcbiAgICAgICAgLy8gICAgICAgICAgICAgICAgICBzaW5jZSAxIEphbiAxOTcwIChhIHRpbWVzdGFtcCkgXG4gICAgICAgIC8vICAgYSBzdHJpbmcgICAgIDogQW55IGZvcm1hdCBzdXBwb3J0ZWQgYnkgdGhlIGphdmFzY3JpcHQgZW5naW5lLCBsaWtlXG4gICAgICAgIC8vICAgICAgICAgICAgICAgICAgXCJZWVlZL01NL0REXCIsIFwiTU0vREQvWVlZWVwiLCBcIkphbiAzMSAyMDA5XCIgZXRjLlxuICAgICAgICAvLyAgYW4gb2JqZWN0ICAgICA6IEludGVycHJldGVkIGFzIGFuIG9iamVjdCB3aXRoIHllYXIsIG1vbnRoIGFuZCBkYXRlXG4gICAgICAgIC8vICAgICAgICAgICAgICAgICAgYXR0cmlidXRlcy4gICoqTk9URSoqIG1vbnRoIGlzIDAtMTEuXG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICBkLmNvbnN0cnVjdG9yID09PSBEYXRlID8gZCA6XG4gICAgICAgICAgICBkLmNvbnN0cnVjdG9yID09PSBBcnJheSA/IG5ldyBEYXRlKGRbMF0sZFsxXSxkWzJdKSA6XG4gICAgICAgICAgICBkLmNvbnN0cnVjdG9yID09PSBOdW1iZXIgPyBuZXcgRGF0ZShkKSA6XG4gICAgICAgICAgICBkLmNvbnN0cnVjdG9yID09PSBTdHJpbmcgPyBuZXcgRGF0ZShkKSA6XG4gICAgICAgICAgICB0eXBlb2YgZCA9PT0gXCJvYmplY3RcIiA/IG5ldyBEYXRlKGQueWVhcixkLm1vbnRoLGQuZGF0ZSkgOlxuICAgICAgICAgICAgTmFOXG4gICAgICAgICk7XG4gICAgfSxcbiAgICBjb21wYXJlOmZ1bmN0aW9uKGEsYikge1xuICAgICAgICAvLyBDb21wYXJlIHR3byBkYXRlcyAoY291bGQgYmUgb2YgYW55IHR5cGUgc3VwcG9ydGVkIGJ5IHRoZSBjb252ZXJ0XG4gICAgICAgIC8vIGZ1bmN0aW9uIGFib3ZlKSBhbmQgcmV0dXJuczpcbiAgICAgICAgLy8gIC0xIDogaWYgYSA8IGJcbiAgICAgICAgLy8gICAwIDogaWYgYSA9IGJcbiAgICAgICAgLy8gICAxIDogaWYgYSA+IGJcbiAgICAgICAgLy8gTmFOIDogaWYgYSBvciBiIGlzIGFuIGlsbGVnYWwgZGF0ZVxuICAgICAgICAvLyBOT1RFOiBUaGUgY29kZSBpbnNpZGUgaXNGaW5pdGUgZG9lcyBhbiBhc3NpZ25tZW50ICg9KS5cbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIGlzRmluaXRlKGE9dGhpcy5jb252ZXJ0KGEpLnZhbHVlT2YoKSkgJiZcbiAgICAgICAgICAgIGlzRmluaXRlKGI9dGhpcy5jb252ZXJ0KGIpLnZhbHVlT2YoKSkgP1xuICAgICAgICAgICAgKGE+YiktKGE8YikgOlxuICAgICAgICAgICAgTmFOXG4gICAgICAgICk7XG4gICAgfSxcbiAgICBpblJhbmdlOmZ1bmN0aW9uKGQsc3RhcnQsZW5kKSB7XG4gICAgICAgIC8vIENoZWNrcyBpZiBkYXRlIGluIGQgaXMgYmV0d2VlbiBkYXRlcyBpbiBzdGFydCBhbmQgZW5kLlxuICAgICAgICAvLyBSZXR1cm5zIGEgYm9vbGVhbiBvciBOYU46XG4gICAgICAgIC8vICAgIHRydWUgIDogaWYgZCBpcyBiZXR3ZWVuIHN0YXJ0IGFuZCBlbmQgKGluY2x1c2l2ZSlcbiAgICAgICAgLy8gICAgZmFsc2UgOiBpZiBkIGlzIGJlZm9yZSBzdGFydCBvciBhZnRlciBlbmRcbiAgICAgICAgLy8gICAgTmFOICAgOiBpZiBvbmUgb3IgbW9yZSBvZiB0aGUgZGF0ZXMgaXMgaWxsZWdhbC5cbiAgICAgICAgLy8gTk9URTogVGhlIGNvZGUgaW5zaWRlIGlzRmluaXRlIGRvZXMgYW4gYXNzaWdubWVudCAoPSkuXG4gICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIGlzRmluaXRlKGQ9dGhpcy5jb252ZXJ0KGQpLnZhbHVlT2YoKSkgJiZcbiAgICAgICAgICAgIGlzRmluaXRlKHN0YXJ0PXRoaXMuY29udmVydChzdGFydCkudmFsdWVPZigpKSAmJlxuICAgICAgICAgICAgaXNGaW5pdGUoZW5kPXRoaXMuY29udmVydChlbmQpLnZhbHVlT2YoKSkgP1xuICAgICAgICAgICAgc3RhcnQgPD0gZCAmJiBkIDw9IGVuZCA6XG4gICAgICAgICAgICBOYU5cbiAgICAgICAgKTtcbiAgICB9XG59XG4iLCJ2YXIgc2pjbCA9IHJlcXVpcmUoJ3NqY2wnKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGtleSwgZW50cnkpIHtcblx0ZW50cnkuY29udGVudCA9IHNqY2wuZGVjcnlwdChrZXksIGVudHJ5LmNvbnRlbnQpXG5cdGVudHJ5LnRpdGxlID0gZW50cnkuY29udGVudC5zcGxpdCgnXFxuJylbMF1cblx0aWYgKGVudHJ5LmRhdGV0aW1lKSB7XG5cdFx0ZW50cnkuZGF0ZXRpbWUgPSBzamNsLmRlY3J5cHQoa2V5LCBlbnRyeS5kYXRldGltZSlcblx0fVxuXHRlbnRyeS50YWdzID0gc2pjbC5kZWNyeXB0KGtleSwgZW50cnkudGFncykuc3BsaXQoJywnKS5maWx0ZXIoZnVuY3Rpb24odGFnKSB7XG5cdFx0cmV0dXJuIHRhZyAhPT0gJydcblx0fSlcblx0cmV0dXJuIGVudHJ5O1xufVxuIiwidmFyIHNqY2wgPSByZXF1aXJlKCdzamNsJylcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihrZXksIGVudHJ5KSB7XG5cdGVudHJ5LmNvbnRlbnQgPSBzamNsLmVuY3J5cHQoa2V5LCBlbnRyeS5jb250ZW50KVxuXHRpZiAoZW50cnkuZGF0ZXRpbWUpIHtcblx0XHRlbnRyeS5kYXRldGltZSA9IHNqY2wuZW5jcnlwdChrZXksIGVudHJ5LmRhdGV0aW1lKVxuXHR9XG5cdGVudHJ5LnRhZ3MgPSBzamNsLmVuY3J5cHQoa2V5LCBlbnRyeS50YWdzLmpvaW4oJywnKSlcblx0cmV0dXJuIGVudHJ5O1xufVxuIiwiLy9lbnN1cmVzIGFsbCB0aGUgbmVjZXNzYXJ5IGNvbXBvbmVudHMgYXJlIGxvYWRlZFxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBlbnN1cmVMb2FkZWQoY2FsbGJhY2spIHtcblx0dmFyIGxvYWRBdXRoID0gZnVuY3Rpb24oY2IpIHtcblx0XHRnYXBpLmxvYWQoJ2F1dGgnLCBmdW5jdGlvbigpIHtcblx0XHRcdGNiKClcblx0XHR9KVxuXHR9XG5cblx0dmFyIGxvYWRDbGllbnQgPSBmdW5jdGlvbihjYikge1xuXHRcdGdhcGkubG9hZCgnY2xpZW50JywgZnVuY3Rpb24oKSB7XG5cdFx0XHRjYigpXG5cdFx0fSlcblx0fVxuXG5cdHZhciBsb2FkRHJpdmUgPSBmdW5jdGlvbihjYikge1xuXHRcdGdhcGkuY2xpZW50LmxvYWQoJ2RyaXZlJywgJ3YyJywgZnVuY3Rpb24oKSB7XG5cdFx0XHRjYigpXG5cdFx0fSlcblx0fVxuXHRcblx0bG9hZEF1dGgobG9hZENsaWVudC5iaW5kKHRoaXMsIGxvYWREcml2ZS5iaW5kKHRoaXMsIGNhbGxiYWNrKSkpXG59XG4iLCJ2YXIgZW5zdXJlTG9hZGVkID0gcmVxdWlyZSgnLi9lbnN1cmVHYXBpTG9hZGVkJylcblxudmFyIGluZm8gPSB7XG5cdGNsaWVudF9pZDogJzY3MTY2NTE4NTM0OC1wbGd2Y2VvZmp1MmNvMWFvYzk0Y2lnMmtjZjZyMG1oNi5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbScsXG5cdHNjb3BlOiAnaHR0cHM6Ly93d3cuZ29vZ2xlYXBpcy5jb20vYXV0aC9kcml2ZS5hcHBmb2xkZXInXG59XG5cbnZhciBhcHBVcmwgPSAnaHR0cHM6Ly9kZXNsZWUubWUvYXV0aG9yaXplL2pvdXJuZXknXG5cbnZhciBnYXBpQ29uZmlnID0ge1xuXHRhdXRoX3VyaTogJ2h0dHBzOi8vYWNjb3VudHMuZ29vZ2xlLmNvbS9vL29hdXRoMi9hdXRoJyxcblx0dG9rZW5fdXJpOiAnaHR0cHM6Ly9hY2NvdW50cy5nb29nbGUuY29tL28vb2F1dGgyL3Rva2VuJyxcblx0cmVkaXJlY3RfdXJpOiBhcHBVcmxcbn07XG5cbnZhciBsb2dpbl91cmwgPSBnYXBpQ29uZmlnLmF1dGhfdXJpXG4rICc/Y2xpZW50X2lkPScgKyBpbmZvLmNsaWVudF9pZFxuKyAnJnJlZGlyZWN0X3VyaT0nICsgZ2FwaUNvbmZpZy5yZWRpcmVjdF91cmlcbisgJyZyZXNwb25zZV90eXBlPWNvZGUnXG4rICcmc2NvcGU9JyArIGluZm8uc2NvcGVcblxuXG5mdW5jdGlvbiBoYW5kbGVHYXBpUmVxdWVzdChyZXF1ZXN0LCBjYWxsYmFjaykge1xuXHR2YXIgdHJpZWRSZWZyZXNoID0gZmFsc2Vcblx0dmFyIGhhbmRsZTQwMSA9IGZ1bmN0aW9uKCkge1xuXHRcdGRlbGV0ZSBsb2NhbFN0b3JhZ2UudG9rZW5cblx0XHRnYXBpLmF1dGguc2lnbk91dCgpO1xuXHRcdHRyaWVkUmVmcmVzaCA9IHRydWVcblx0XHRlbnN1cmVBdXRob3JpemVkKGV4ZWN1dGUpXG5cdH1cblxuXHR2YXIgaGFuZGxlUmVzcG9uc2UgPSBmdW5jdGlvbihyZXNwb25zZSkge1xuXHRcdGlmIChyZXNwb25zZS5jb2RlID09IDQwMSAmJiAhdHJpZWRSZWZyZXNoKSB7XG5cdFx0XHRoYW5kbGU0MDEoKVxuXHRcdH1cblx0XHRlbHNlIGlmIChyZXNwb25zZS5jb2RlID09IDQwMykge1xuXHRcdFx0Y29uc29sZS5sb2cocmVzcG9uc2UpXG5cdFx0XHRjYWxsYmFjayhyZXNwb25zZSlcblx0XHR9ZWxzZSB7XG5cdFx0XHQvLyB3ZSBoYXZlIGRhdGFcblx0XHRcdGNhbGxiYWNrKG51bGwsIHJlc3BvbnNlKVxuXHRcdH1cblx0fVxuXG5cblx0dmFyIGV4ZWN1dGUgPSBmdW5jdGlvbihlcnIpIHtcblx0XHRpZiAoZXJyKSB7XG5cdFx0XHRjb25zb2xlLmxvZyhlcnIpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXF1ZXN0LmV4ZWN1dGUoaGFuZGxlUmVzcG9uc2UpXG5cdFx0fVxuXHR9XG5cdGVuc3VyZUF1dGhvcml6ZWQoZXhlY3V0ZSlcbn1cblxuZnVuY3Rpb24gZ2V0QXV0aG9yaXphdGlvbkNvZGVXZWJ2aWV3KGNhbGxiYWNrKSB7XG5cdHZhciBsb2dpbldpbmRvdyA9IHdpbmRvdy5vcGVuKGxvZ2luX3VybCwgJ19ibGFuaycsICdsb2NhdGlvbj15ZXMnKVxuXHRsb2dpbldpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdsb2Fkc3RvcCcsIGZ1bmN0aW9uKGUpIHtcblx0XHR2YXIgdXJsID0gZS51cmxcblx0XHR2YXIgY29kZSA9IC9cXD9jb2RlPSguKykkLy5leGVjKHVybCk7XG5cdFx0dmFyIGVycm9yID0gL1xcP2Vycm9yPSguKykkLy5leGVjKHVybCk7XG5cblx0XHRpZiAoY29kZSkge1xuXHRcdFx0bG9naW5XaW5kb3cuZXhlY3V0ZVNjcmlwdCh7Y29kZTogXCJkb2N1bWVudC5ib2R5LmlubmVySFRNTFwifSwgZnVuY3Rpb24odmFsdWVzKXtcblx0XHRcdFx0dmFyIHRva2VuID0gSlNPTi5wYXJzZSh2YWx1ZXNbMF0pXG5cdFx0XHRcdC8vIHdlIGhhdmUgdGhlIHRva2VuIVxuXHRcdFx0XHRsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgndG9rZW4nLCB0b2tlbilcblx0XHRcdFx0Z2FwaS5hdXRoLnNldFRva2VuKHRva2VuKVxuXHRcdFx0XHRsb2dpbldpbmRvdy5jbG9zZSgpXG5cdFx0XHRcdGNhbGxiYWNrKClcblx0XHRcdH0pXG5cdFx0fVxuXHRcdGlmIChlcnJvcikge1xuXHRcdFx0bG9naW5XaW5kb3cuY2xvc2UoKVxuXHRcdFx0Y2FsbGJhY2soZXJyb3IpXG5cdFx0fVxuXHR9KVxufVxuXG5mdW5jdGlvbiBnZXRBdXRob3JpemF0aW9uQ29kZUJyb3dzZXIoY2FsbGJhY2spIHtcblx0dmFyIGhhbmRsZVJlc3VsdCA9IGZ1bmN0aW9uKHJlc3VsdCkge1xuXHRcdGlmIChyZXN1bHQgJiYgIXJlc3VsdC5lcnJvcikge1xuXHRcdFx0dmFyIHRva2VuID0gZ2FwaS5hdXRoLmdldFRva2VuKClcblx0XHRcdGxvY2FsU3RvcmFnZS5zZXRJdGVtKCd0b2tlbicsIEpTT04uc3RyaW5naWZ5KHRva2VuKSlcblx0XHRcdGNhbGxiYWNrKCkgLy8gd2UgYXJlIGF1dGhvcml6ZWQhXG5cdFx0fSBlbHNlIGlmIChpbmZvLmltbWVkaWF0ZSA9PSB0cnVlKSB7XG5cdFx0XHRpbmZvLmltbWVkaWF0ZSA9IGZhbHNlXG5cdFx0XHRnYXBpLmF1dGguYXV0aG9yaXplKGluZm8sIGhhbmRsZVJlc3VsdClcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHQvLyBlcnJvciwgcmV0dXJuIHRoZSBlcnJvclxuXHRcdFx0Y2FsbGJhY2socmVzdWx0KVxuXHRcdH1cblx0fVxuXG5cblx0aW5mby5pbW1lZGlhdGUgPSB0cnVlO1xuXHRnYXBpLmF1dGguYXV0aG9yaXplKGluZm8sIGhhbmRsZVJlc3VsdCk7XG59XG5cbmZ1bmN0aW9uIGdldEF1dGhvcml6YXRpb25Db2RlKGNhbGxiYWNrKSB7XG5cdGlmICh0eXBlb2YoZGV2aWNlKSA9PSAndW5kZWZpbmVkJykgZGV2aWNlID0ge3BsYXRmb3JtOiAnYnJvd3Nlcid9XG5cdHN3aXRjaChkZXZpY2UucGxhdGZvcm0pIHtcblx0XHRjYXNlICdicm93c2VyJzpcblx0XHRcdGdldEF1dGhvcml6YXRpb25Db2RlQnJvd3NlcihjYWxsYmFjaylcblx0XHRicmVhaztcblx0XHRjYXNlICdBbmRyb2lkJzpcblx0XHRcdGdldEF1dGhvcml6YXRpb25Db2RlV2VidmlldyhjYWxsYmFjaylcblx0fVxufVxuXG5mdW5jdGlvbiBhdXRob3JpemUoY2FsbGJhY2spIHtcblx0Z2V0QXV0aG9yaXphdGlvbkNvZGUoY2FsbGJhY2spXG59XG5cblxuLy9lbnN1cmVMb2FkZWQgaXMgY2FsbGVkIGJlZm9yZSB0aGlzXG5mdW5jdGlvbiBfZW5zdXJlQXV0aG9yaXplZChjYWxsYmFjaykge1xuXHR2YXIgdG9rZW4gPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgndG9rZW4nKVxuXHRpZiAodG9rZW4pIHtcblx0XHRpZiAoIWdhcGkuYXV0aC5nZXRUb2tlbigpKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRnYXBpLmF1dGguc2V0VG9rZW4oSlNPTi5wYXJzZSh0b2tlbikpXG5cdFx0XHR9IGNhdGNoKGUpIHtcblx0XHRcdFx0ZGVsZXRlIGxvY2FsU3RvcmFnZS50b2tlblxuXHRcdFx0XHRfZW5zdXJlQXV0aG9yaXplZChjYWxsYmFjaylcblx0XHRcdH1cblx0XHR9XG5cdFx0Ly8gaG9vcmF5ISB3ZSBhcmUgYXV0aG9yaXplZCFcblx0XHRjYWxsYmFjaygpXG5cdH1cblx0ZWxzZSB7XG5cdFx0YXV0aG9yaXplKGNhbGxiYWNrKVxuXHR9XG59XG5cbmZ1bmN0aW9uIGVuc3VyZUF1dGhvcml6ZWQoY2FsbGJhY2spIHtcblx0ZW5zdXJlTG9hZGVkKF9lbnN1cmVBdXRob3JpemVkLmJpbmQodGhpcywgY2FsbGJhY2spKVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGhhbmRsZUdhcGlSZXF1ZXN0XG4iLCIvKiFcbiAqIFRoZSBidWZmZXIgbW9kdWxlIGZyb20gbm9kZS5qcywgZm9yIHRoZSBicm93c2VyLlxuICpcbiAqIEBhdXRob3IgICBGZXJvc3MgQWJvdWtoYWRpamVoIDxmZXJvc3NAZmVyb3NzLm9yZz4gPGh0dHA6Ly9mZXJvc3Mub3JnPlxuICogQGxpY2Vuc2UgIE1JVFxuICovXG5cbnZhciBiYXNlNjQgPSByZXF1aXJlKCdiYXNlNjQtanMnKVxudmFyIGllZWU3NTQgPSByZXF1aXJlKCdpZWVlNzU0JylcblxuZXhwb3J0cy5CdWZmZXIgPSBCdWZmZXJcbmV4cG9ydHMuU2xvd0J1ZmZlciA9IEJ1ZmZlclxuZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFUyA9IDUwXG5CdWZmZXIucG9vbFNpemUgPSA4MTkyXG5cbi8qKlxuICogSWYgYEJ1ZmZlci5fdXNlVHlwZWRBcnJheXNgOlxuICogICA9PT0gdHJ1ZSAgICBVc2UgVWludDhBcnJheSBpbXBsZW1lbnRhdGlvbiAoZmFzdGVzdClcbiAqICAgPT09IGZhbHNlICAgVXNlIE9iamVjdCBpbXBsZW1lbnRhdGlvbiAoY29tcGF0aWJsZSBkb3duIHRvIElFNilcbiAqL1xuQnVmZmVyLl91c2VUeXBlZEFycmF5cyA9IChmdW5jdGlvbiAoKSB7XG4gIC8vIERldGVjdCBpZiBicm93c2VyIHN1cHBvcnRzIFR5cGVkIEFycmF5cy4gU3VwcG9ydGVkIGJyb3dzZXJzIGFyZSBJRSAxMCssIEZpcmVmb3ggNCssXG4gIC8vIENocm9tZSA3KywgU2FmYXJpIDUuMSssIE9wZXJhIDExLjYrLCBpT1MgNC4yKy4gSWYgdGhlIGJyb3dzZXIgZG9lcyBub3Qgc3VwcG9ydCBhZGRpbmdcbiAgLy8gcHJvcGVydGllcyB0byBgVWludDhBcnJheWAgaW5zdGFuY2VzLCB0aGVuIHRoYXQncyB0aGUgc2FtZSBhcyBubyBgVWludDhBcnJheWAgc3VwcG9ydFxuICAvLyBiZWNhdXNlIHdlIG5lZWQgdG8gYmUgYWJsZSB0byBhZGQgYWxsIHRoZSBub2RlIEJ1ZmZlciBBUEkgbWV0aG9kcy4gVGhpcyBpcyBhbiBpc3N1ZVxuICAvLyBpbiBGaXJlZm94IDQtMjkuIE5vdyBmaXhlZDogaHR0cHM6Ly9idWd6aWxsYS5tb3ppbGxhLm9yZy9zaG93X2J1Zy5jZ2k/aWQ9Njk1NDM4XG4gIHRyeSB7XG4gICAgdmFyIGJ1ZiA9IG5ldyBBcnJheUJ1ZmZlcigwKVxuICAgIHZhciBhcnIgPSBuZXcgVWludDhBcnJheShidWYpXG4gICAgYXJyLmZvbyA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIDQyIH1cbiAgICByZXR1cm4gNDIgPT09IGFyci5mb28oKSAmJlxuICAgICAgICB0eXBlb2YgYXJyLnN1YmFycmF5ID09PSAnZnVuY3Rpb24nIC8vIENocm9tZSA5LTEwIGxhY2sgYHN1YmFycmF5YFxuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cbn0pKClcblxuLyoqXG4gKiBDbGFzczogQnVmZmVyXG4gKiA9PT09PT09PT09PT09XG4gKlxuICogVGhlIEJ1ZmZlciBjb25zdHJ1Y3RvciByZXR1cm5zIGluc3RhbmNlcyBvZiBgVWludDhBcnJheWAgdGhhdCBhcmUgYXVnbWVudGVkXG4gKiB3aXRoIGZ1bmN0aW9uIHByb3BlcnRpZXMgZm9yIGFsbCB0aGUgbm9kZSBgQnVmZmVyYCBBUEkgZnVuY3Rpb25zLiBXZSB1c2VcbiAqIGBVaW50OEFycmF5YCBzbyB0aGF0IHNxdWFyZSBicmFja2V0IG5vdGF0aW9uIHdvcmtzIGFzIGV4cGVjdGVkIC0tIGl0IHJldHVybnNcbiAqIGEgc2luZ2xlIG9jdGV0LlxuICpcbiAqIEJ5IGF1Z21lbnRpbmcgdGhlIGluc3RhbmNlcywgd2UgY2FuIGF2b2lkIG1vZGlmeWluZyB0aGUgYFVpbnQ4QXJyYXlgXG4gKiBwcm90b3R5cGUuXG4gKi9cbmZ1bmN0aW9uIEJ1ZmZlciAoc3ViamVjdCwgZW5jb2RpbmcsIG5vWmVybykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgQnVmZmVyKSlcbiAgICByZXR1cm4gbmV3IEJ1ZmZlcihzdWJqZWN0LCBlbmNvZGluZywgbm9aZXJvKVxuXG4gIHZhciB0eXBlID0gdHlwZW9mIHN1YmplY3RcblxuICAvLyBXb3JrYXJvdW5kOiBub2RlJ3MgYmFzZTY0IGltcGxlbWVudGF0aW9uIGFsbG93cyBmb3Igbm9uLXBhZGRlZCBzdHJpbmdzXG4gIC8vIHdoaWxlIGJhc2U2NC1qcyBkb2VzIG5vdC5cbiAgaWYgKGVuY29kaW5nID09PSAnYmFzZTY0JyAmJiB0eXBlID09PSAnc3RyaW5nJykge1xuICAgIHN1YmplY3QgPSBzdHJpbmd0cmltKHN1YmplY3QpXG4gICAgd2hpbGUgKHN1YmplY3QubGVuZ3RoICUgNCAhPT0gMCkge1xuICAgICAgc3ViamVjdCA9IHN1YmplY3QgKyAnPSdcbiAgICB9XG4gIH1cblxuICAvLyBGaW5kIHRoZSBsZW5ndGhcbiAgdmFyIGxlbmd0aFxuICBpZiAodHlwZSA9PT0gJ251bWJlcicpXG4gICAgbGVuZ3RoID0gY29lcmNlKHN1YmplY3QpXG4gIGVsc2UgaWYgKHR5cGUgPT09ICdzdHJpbmcnKVxuICAgIGxlbmd0aCA9IEJ1ZmZlci5ieXRlTGVuZ3RoKHN1YmplY3QsIGVuY29kaW5nKVxuICBlbHNlIGlmICh0eXBlID09PSAnb2JqZWN0JylcbiAgICBsZW5ndGggPSBjb2VyY2Uoc3ViamVjdC5sZW5ndGgpIC8vIGFzc3VtZSB0aGF0IG9iamVjdCBpcyBhcnJheS1saWtlXG4gIGVsc2VcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZpcnN0IGFyZ3VtZW50IG5lZWRzIHRvIGJlIGEgbnVtYmVyLCBhcnJheSBvciBzdHJpbmcuJylcblxuICB2YXIgYnVmXG4gIGlmIChCdWZmZXIuX3VzZVR5cGVkQXJyYXlzKSB7XG4gICAgLy8gUHJlZmVycmVkOiBSZXR1cm4gYW4gYXVnbWVudGVkIGBVaW50OEFycmF5YCBpbnN0YW5jZSBmb3IgYmVzdCBwZXJmb3JtYW5jZVxuICAgIGJ1ZiA9IEJ1ZmZlci5fYXVnbWVudChuZXcgVWludDhBcnJheShsZW5ndGgpKVxuICB9IGVsc2Uge1xuICAgIC8vIEZhbGxiYWNrOiBSZXR1cm4gVEhJUyBpbnN0YW5jZSBvZiBCdWZmZXIgKGNyZWF0ZWQgYnkgYG5ld2ApXG4gICAgYnVmID0gdGhpc1xuICAgIGJ1Zi5sZW5ndGggPSBsZW5ndGhcbiAgICBidWYuX2lzQnVmZmVyID0gdHJ1ZVxuICB9XG5cbiAgdmFyIGlcbiAgaWYgKEJ1ZmZlci5fdXNlVHlwZWRBcnJheXMgJiYgdHlwZW9mIHN1YmplY3QuYnl0ZUxlbmd0aCA9PT0gJ251bWJlcicpIHtcbiAgICAvLyBTcGVlZCBvcHRpbWl6YXRpb24gLS0gdXNlIHNldCBpZiB3ZSdyZSBjb3B5aW5nIGZyb20gYSB0eXBlZCBhcnJheVxuICAgIGJ1Zi5fc2V0KHN1YmplY3QpXG4gIH0gZWxzZSBpZiAoaXNBcnJheWlzaChzdWJqZWN0KSkge1xuICAgIC8vIFRyZWF0IGFycmF5LWlzaCBvYmplY3RzIGFzIGEgYnl0ZSBhcnJheVxuICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihzdWJqZWN0KSlcbiAgICAgICAgYnVmW2ldID0gc3ViamVjdC5yZWFkVUludDgoaSlcbiAgICAgIGVsc2VcbiAgICAgICAgYnVmW2ldID0gc3ViamVjdFtpXVxuICAgIH1cbiAgfSBlbHNlIGlmICh0eXBlID09PSAnc3RyaW5nJykge1xuICAgIGJ1Zi53cml0ZShzdWJqZWN0LCAwLCBlbmNvZGluZylcbiAgfSBlbHNlIGlmICh0eXBlID09PSAnbnVtYmVyJyAmJiAhQnVmZmVyLl91c2VUeXBlZEFycmF5cyAmJiAhbm9aZXJvKSB7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBidWZbaV0gPSAwXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJ1ZlxufVxuXG4vLyBTVEFUSUMgTUVUSE9EU1xuLy8gPT09PT09PT09PT09PT1cblxuQnVmZmVyLmlzRW5jb2RpbmcgPSBmdW5jdGlvbiAoZW5jb2RpbmcpIHtcbiAgc3dpdGNoIChTdHJpbmcoZW5jb2RpbmcpLnRvTG93ZXJDYXNlKCkpIHtcbiAgICBjYXNlICdoZXgnOlxuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgY2FzZSAnYmluYXJ5JzpcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgIGNhc2UgJ3Jhdyc6XG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldHVybiB0cnVlXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBmYWxzZVxuICB9XG59XG5cbkJ1ZmZlci5pc0J1ZmZlciA9IGZ1bmN0aW9uIChiKSB7XG4gIHJldHVybiAhIShiICE9PSBudWxsICYmIGIgIT09IHVuZGVmaW5lZCAmJiBiLl9pc0J1ZmZlcilcbn1cblxuQnVmZmVyLmJ5dGVMZW5ndGggPSBmdW5jdGlvbiAoc3RyLCBlbmNvZGluZykge1xuICB2YXIgcmV0XG4gIHN0ciA9IHN0ciArICcnXG4gIHN3aXRjaCAoZW5jb2RpbmcgfHwgJ3V0ZjgnKSB7XG4gICAgY2FzZSAnaGV4JzpcbiAgICAgIHJldCA9IHN0ci5sZW5ndGggLyAyXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgIHJldCA9IHV0ZjhUb0J5dGVzKHN0cikubGVuZ3RoXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICBjYXNlICdiaW5hcnknOlxuICAgIGNhc2UgJ3Jhdyc6XG4gICAgICByZXQgPSBzdHIubGVuZ3RoXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICByZXQgPSBiYXNlNjRUb0J5dGVzKHN0cikubGVuZ3RoXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICByZXQgPSBzdHIubGVuZ3RoICogMlxuICAgICAgYnJlYWtcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIGVuY29kaW5nJylcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbkJ1ZmZlci5jb25jYXQgPSBmdW5jdGlvbiAobGlzdCwgdG90YWxMZW5ndGgpIHtcbiAgYXNzZXJ0KGlzQXJyYXkobGlzdCksICdVc2FnZTogQnVmZmVyLmNvbmNhdChsaXN0LCBbdG90YWxMZW5ndGhdKVxcbicgK1xuICAgICAgJ2xpc3Qgc2hvdWxkIGJlIGFuIEFycmF5LicpXG5cbiAgaWYgKGxpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG5ldyBCdWZmZXIoMClcbiAgfSBlbHNlIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgIHJldHVybiBsaXN0WzBdXG4gIH1cblxuICB2YXIgaVxuICBpZiAodHlwZW9mIHRvdGFsTGVuZ3RoICE9PSAnbnVtYmVyJykge1xuICAgIHRvdGFsTGVuZ3RoID0gMFxuICAgIGZvciAoaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICB0b3RhbExlbmd0aCArPSBsaXN0W2ldLmxlbmd0aFxuICAgIH1cbiAgfVxuXG4gIHZhciBidWYgPSBuZXcgQnVmZmVyKHRvdGFsTGVuZ3RoKVxuICB2YXIgcG9zID0gMFxuICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgIHZhciBpdGVtID0gbGlzdFtpXVxuICAgIGl0ZW0uY29weShidWYsIHBvcylcbiAgICBwb3MgKz0gaXRlbS5sZW5ndGhcbiAgfVxuICByZXR1cm4gYnVmXG59XG5cbi8vIEJVRkZFUiBJTlNUQU5DRSBNRVRIT0RTXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PVxuXG5mdW5jdGlvbiBfaGV4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICBvZmZzZXQgPSBOdW1iZXIob2Zmc2V0KSB8fCAwXG4gIHZhciByZW1haW5pbmcgPSBidWYubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmICghbGVuZ3RoKSB7XG4gICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gIH0gZWxzZSB7XG4gICAgbGVuZ3RoID0gTnVtYmVyKGxlbmd0aClcbiAgICBpZiAobGVuZ3RoID4gcmVtYWluaW5nKSB7XG4gICAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgICB9XG4gIH1cblxuICAvLyBtdXN0IGJlIGFuIGV2ZW4gbnVtYmVyIG9mIGRpZ2l0c1xuICB2YXIgc3RyTGVuID0gc3RyaW5nLmxlbmd0aFxuICBhc3NlcnQoc3RyTGVuICUgMiA9PT0gMCwgJ0ludmFsaWQgaGV4IHN0cmluZycpXG5cbiAgaWYgKGxlbmd0aCA+IHN0ckxlbiAvIDIpIHtcbiAgICBsZW5ndGggPSBzdHJMZW4gLyAyXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIHZhciBieXRlID0gcGFyc2VJbnQoc3RyaW5nLnN1YnN0cihpICogMiwgMiksIDE2KVxuICAgIGFzc2VydCghaXNOYU4oYnl0ZSksICdJbnZhbGlkIGhleCBzdHJpbmcnKVxuICAgIGJ1ZltvZmZzZXQgKyBpXSA9IGJ5dGVcbiAgfVxuICBCdWZmZXIuX2NoYXJzV3JpdHRlbiA9IGkgKiAyXG4gIHJldHVybiBpXG59XG5cbmZ1bmN0aW9uIF91dGY4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gQnVmZmVyLl9jaGFyc1dyaXR0ZW4gPVxuICAgIGJsaXRCdWZmZXIodXRmOFRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5mdW5jdGlvbiBfYXNjaWlXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHZhciBjaGFyc1dyaXR0ZW4gPSBCdWZmZXIuX2NoYXJzV3JpdHRlbiA9XG4gICAgYmxpdEJ1ZmZlcihhc2NpaVRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5mdW5jdGlvbiBfYmluYXJ5V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gX2FzY2lpV3JpdGUoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBfYmFzZTY0V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gQnVmZmVyLl9jaGFyc1dyaXR0ZW4gPVxuICAgIGJsaXRCdWZmZXIoYmFzZTY0VG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxuICByZXR1cm4gY2hhcnNXcml0dGVuXG59XG5cbmZ1bmN0aW9uIF91dGYxNmxlV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gQnVmZmVyLl9jaGFyc1dyaXR0ZW4gPVxuICAgIGJsaXRCdWZmZXIodXRmMTZsZVRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24gKHN0cmluZywgb2Zmc2V0LCBsZW5ndGgsIGVuY29kaW5nKSB7XG4gIC8vIFN1cHBvcnQgYm90aCAoc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCwgZW5jb2RpbmcpXG4gIC8vIGFuZCB0aGUgbGVnYWN5IChzdHJpbmcsIGVuY29kaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgaWYgKGlzRmluaXRlKG9mZnNldCkpIHtcbiAgICBpZiAoIWlzRmluaXRlKGxlbmd0aCkpIHtcbiAgICAgIGVuY29kaW5nID0gbGVuZ3RoXG4gICAgICBsZW5ndGggPSB1bmRlZmluZWRcbiAgICB9XG4gIH0gZWxzZSB7ICAvLyBsZWdhY3lcbiAgICB2YXIgc3dhcCA9IGVuY29kaW5nXG4gICAgZW5jb2RpbmcgPSBvZmZzZXRcbiAgICBvZmZzZXQgPSBsZW5ndGhcbiAgICBsZW5ndGggPSBzd2FwXG4gIH1cblxuICBvZmZzZXQgPSBOdW1iZXIob2Zmc2V0KSB8fCAwXG4gIHZhciByZW1haW5pbmcgPSB0aGlzLmxlbmd0aCAtIG9mZnNldFxuICBpZiAoIWxlbmd0aCkge1xuICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICB9IGVsc2Uge1xuICAgIGxlbmd0aCA9IE51bWJlcihsZW5ndGgpXG4gICAgaWYgKGxlbmd0aCA+IHJlbWFpbmluZykge1xuICAgICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gICAgfVxuICB9XG4gIGVuY29kaW5nID0gU3RyaW5nKGVuY29kaW5nIHx8ICd1dGY4JykudG9Mb3dlckNhc2UoKVxuXG4gIHZhciByZXRcbiAgc3dpdGNoIChlbmNvZGluZykge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgICByZXQgPSBfaGV4V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgICAgcmV0ID0gX3V0ZjhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgICByZXQgPSBfYXNjaWlXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdiaW5hcnknOlxuICAgICAgcmV0ID0gX2JpbmFyeVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICByZXQgPSBfYmFzZTY0V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldCA9IF91dGYxNmxlV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBlbmNvZGluZycpXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gKGVuY29kaW5nLCBzdGFydCwgZW5kKSB7XG4gIHZhciBzZWxmID0gdGhpc1xuXG4gIGVuY29kaW5nID0gU3RyaW5nKGVuY29kaW5nIHx8ICd1dGY4JykudG9Mb3dlckNhc2UoKVxuICBzdGFydCA9IE51bWJlcihzdGFydCkgfHwgMFxuICBlbmQgPSAoZW5kICE9PSB1bmRlZmluZWQpXG4gICAgPyBOdW1iZXIoZW5kKVxuICAgIDogZW5kID0gc2VsZi5sZW5ndGhcblxuICAvLyBGYXN0cGF0aCBlbXB0eSBzdHJpbmdzXG4gIGlmIChlbmQgPT09IHN0YXJ0KVxuICAgIHJldHVybiAnJ1xuXG4gIHZhciByZXRcbiAgc3dpdGNoIChlbmNvZGluZykge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgICByZXQgPSBfaGV4U2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgICAgcmV0ID0gX3V0ZjhTbGljZShzZWxmLCBzdGFydCwgZW5kKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgICByZXQgPSBfYXNjaWlTbGljZShzZWxmLCBzdGFydCwgZW5kKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdiaW5hcnknOlxuICAgICAgcmV0ID0gX2JpbmFyeVNsaWNlKHNlbGYsIHN0YXJ0LCBlbmQpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICByZXQgPSBfYmFzZTY0U2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldCA9IF91dGYxNmxlU2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBlbmNvZGluZycpXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvSlNPTiA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnQnVmZmVyJyxcbiAgICBkYXRhOiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCh0aGlzLl9hcnIgfHwgdGhpcywgMClcbiAgfVxufVxuXG4vLyBjb3B5KHRhcmdldEJ1ZmZlciwgdGFyZ2V0U3RhcnQ9MCwgc291cmNlU3RhcnQ9MCwgc291cmNlRW5kPWJ1ZmZlci5sZW5ndGgpXG5CdWZmZXIucHJvdG90eXBlLmNvcHkgPSBmdW5jdGlvbiAodGFyZ2V0LCB0YXJnZXRfc3RhcnQsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHNvdXJjZSA9IHRoaXNcblxuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgJiYgZW5kICE9PSAwKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAoIXRhcmdldF9zdGFydCkgdGFyZ2V0X3N0YXJ0ID0gMFxuXG4gIC8vIENvcHkgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuXG4gIGlmICh0YXJnZXQubGVuZ3RoID09PSAwIHx8IHNvdXJjZS5sZW5ndGggPT09IDApIHJldHVyblxuXG4gIC8vIEZhdGFsIGVycm9yIGNvbmRpdGlvbnNcbiAgYXNzZXJ0KGVuZCA+PSBzdGFydCwgJ3NvdXJjZUVuZCA8IHNvdXJjZVN0YXJ0JylcbiAgYXNzZXJ0KHRhcmdldF9zdGFydCA+PSAwICYmIHRhcmdldF9zdGFydCA8IHRhcmdldC5sZW5ndGgsXG4gICAgICAndGFyZ2V0U3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGFzc2VydChzdGFydCA+PSAwICYmIHN0YXJ0IDwgc291cmNlLmxlbmd0aCwgJ3NvdXJjZVN0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBhc3NlcnQoZW5kID49IDAgJiYgZW5kIDw9IHNvdXJjZS5sZW5ndGgsICdzb3VyY2VFbmQgb3V0IG9mIGJvdW5kcycpXG5cbiAgLy8gQXJlIHdlIG9vYj9cbiAgaWYgKGVuZCA+IHRoaXMubGVuZ3RoKVxuICAgIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICh0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0X3N0YXJ0IDwgZW5kIC0gc3RhcnQpXG4gICAgZW5kID0gdGFyZ2V0Lmxlbmd0aCAtIHRhcmdldF9zdGFydCArIHN0YXJ0XG5cbiAgdmFyIGxlbiA9IGVuZCAtIHN0YXJ0XG5cbiAgaWYgKGxlbiA8IDEwMCB8fCAhQnVmZmVyLl91c2VUeXBlZEFycmF5cykge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICB0YXJnZXRbaSArIHRhcmdldF9zdGFydF0gPSB0aGlzW2kgKyBzdGFydF1cbiAgfSBlbHNlIHtcbiAgICB0YXJnZXQuX3NldCh0aGlzLnN1YmFycmF5KHN0YXJ0LCBzdGFydCArIGxlbiksIHRhcmdldF9zdGFydClcbiAgfVxufVxuXG5mdW5jdGlvbiBfYmFzZTY0U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICBpZiAoc3RhcnQgPT09IDAgJiYgZW5kID09PSBidWYubGVuZ3RoKSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1ZilcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmLnNsaWNlKHN0YXJ0LCBlbmQpKVxuICB9XG59XG5cbmZ1bmN0aW9uIF91dGY4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmVzID0gJydcbiAgdmFyIHRtcCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIGlmIChidWZbaV0gPD0gMHg3Rikge1xuICAgICAgcmVzICs9IGRlY29kZVV0ZjhDaGFyKHRtcCkgKyBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSlcbiAgICAgIHRtcCA9ICcnXG4gICAgfSBlbHNlIHtcbiAgICAgIHRtcCArPSAnJScgKyBidWZbaV0udG9TdHJpbmcoMTYpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlcyArIGRlY29kZVV0ZjhDaGFyKHRtcClcbn1cblxuZnVuY3Rpb24gX2FzY2lpU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmV0ID0gJydcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKVxuICAgIHJldCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSlcbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBfYmluYXJ5U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICByZXR1cm4gX2FzY2lpU2xpY2UoYnVmLCBzdGFydCwgZW5kKVxufVxuXG5mdW5jdGlvbiBfaGV4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuXG4gIGlmICghc3RhcnQgfHwgc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgfHwgZW5kIDwgMCB8fCBlbmQgPiBsZW4pIGVuZCA9IGxlblxuXG4gIHZhciBvdXQgPSAnJ1xuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIG91dCArPSB0b0hleChidWZbaV0pXG4gIH1cbiAgcmV0dXJuIG91dFxufVxuXG5mdW5jdGlvbiBfdXRmMTZsZVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGJ5dGVzID0gYnVmLnNsaWNlKHN0YXJ0LCBlbmQpXG4gIHZhciByZXMgPSAnJ1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGJ5dGVzLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgcmVzICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnl0ZXNbaV0gKyBieXRlc1tpKzFdICogMjU2KVxuICB9XG4gIHJldHVybiByZXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5zbGljZSA9IGZ1bmN0aW9uIChzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBzdGFydCA9IGNsYW1wKHN0YXJ0LCBsZW4sIDApXG4gIGVuZCA9IGNsYW1wKGVuZCwgbGVuLCBsZW4pXG5cbiAgaWYgKEJ1ZmZlci5fdXNlVHlwZWRBcnJheXMpIHtcbiAgICByZXR1cm4gQnVmZmVyLl9hdWdtZW50KHRoaXMuc3ViYXJyYXkoc3RhcnQsIGVuZCkpXG4gIH0gZWxzZSB7XG4gICAgdmFyIHNsaWNlTGVuID0gZW5kIC0gc3RhcnRcbiAgICB2YXIgbmV3QnVmID0gbmV3IEJ1ZmZlcihzbGljZUxlbiwgdW5kZWZpbmVkLCB0cnVlKVxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2xpY2VMZW47IGkrKykge1xuICAgICAgbmV3QnVmW2ldID0gdGhpc1tpICsgc3RhcnRdXG4gICAgfVxuICAgIHJldHVybiBuZXdCdWZcbiAgfVxufVxuXG4vLyBgZ2V0YCB3aWxsIGJlIHJlbW92ZWQgaW4gTm9kZSAwLjEzK1xuQnVmZmVyLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAob2Zmc2V0KSB7XG4gIGNvbnNvbGUubG9nKCcuZ2V0KCkgaXMgZGVwcmVjYXRlZC4gQWNjZXNzIHVzaW5nIGFycmF5IGluZGV4ZXMgaW5zdGVhZC4nKVxuICByZXR1cm4gdGhpcy5yZWFkVUludDgob2Zmc2V0KVxufVxuXG4vLyBgc2V0YCB3aWxsIGJlIHJlbW92ZWQgaW4gTm9kZSAwLjEzK1xuQnVmZmVyLnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbiAodiwgb2Zmc2V0KSB7XG4gIGNvbnNvbGUubG9nKCcuc2V0KCkgaXMgZGVwcmVjYXRlZC4gQWNjZXNzIHVzaW5nIGFycmF5IGluZGV4ZXMgaW5zdGVhZC4nKVxuICByZXR1cm4gdGhpcy53cml0ZVVJbnQ4KHYsIG9mZnNldClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDggPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0IDwgdGhpcy5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICBpZiAob2Zmc2V0ID49IHRoaXMubGVuZ3RoKVxuICAgIHJldHVyblxuXG4gIHJldHVybiB0aGlzW29mZnNldF1cbn1cblxuZnVuY3Rpb24gX3JlYWRVSW50MTYgKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMSA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICB2YXIgdmFsXG4gIGlmIChsaXR0bGVFbmRpYW4pIHtcbiAgICB2YWwgPSBidWZbb2Zmc2V0XVxuICAgIGlmIChvZmZzZXQgKyAxIDwgbGVuKVxuICAgICAgdmFsIHw9IGJ1ZltvZmZzZXQgKyAxXSA8PCA4XG4gIH0gZWxzZSB7XG4gICAgdmFsID0gYnVmW29mZnNldF0gPDwgOFxuICAgIGlmIChvZmZzZXQgKyAxIDwgbGVuKVxuICAgICAgdmFsIHw9IGJ1ZltvZmZzZXQgKyAxXVxuICB9XG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2TEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRVSW50MTYodGhpcywgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2QkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRVSW50MTYodGhpcywgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIF9yZWFkVUludDMyIChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDMgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgdmFyIHZhbFxuICBpZiAobGl0dGxlRW5kaWFuKSB7XG4gICAgaWYgKG9mZnNldCArIDIgPCBsZW4pXG4gICAgICB2YWwgPSBidWZbb2Zmc2V0ICsgMl0gPDwgMTZcbiAgICBpZiAob2Zmc2V0ICsgMSA8IGxlbilcbiAgICAgIHZhbCB8PSBidWZbb2Zmc2V0ICsgMV0gPDwgOFxuICAgIHZhbCB8PSBidWZbb2Zmc2V0XVxuICAgIGlmIChvZmZzZXQgKyAzIDwgbGVuKVxuICAgICAgdmFsID0gdmFsICsgKGJ1ZltvZmZzZXQgKyAzXSA8PCAyNCA+Pj4gMClcbiAgfSBlbHNlIHtcbiAgICBpZiAob2Zmc2V0ICsgMSA8IGxlbilcbiAgICAgIHZhbCA9IGJ1ZltvZmZzZXQgKyAxXSA8PCAxNlxuICAgIGlmIChvZmZzZXQgKyAyIDwgbGVuKVxuICAgICAgdmFsIHw9IGJ1ZltvZmZzZXQgKyAyXSA8PCA4XG4gICAgaWYgKG9mZnNldCArIDMgPCBsZW4pXG4gICAgICB2YWwgfD0gYnVmW29mZnNldCArIDNdXG4gICAgdmFsID0gdmFsICsgKGJ1ZltvZmZzZXRdIDw8IDI0ID4+PiAwKVxuICB9XG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyTEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRVSW50MzIodGhpcywgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyQkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRVSW50MzIodGhpcywgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDggPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCxcbiAgICAgICAgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0IDwgdGhpcy5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICBpZiAob2Zmc2V0ID49IHRoaXMubGVuZ3RoKVxuICAgIHJldHVyblxuXG4gIHZhciBuZWcgPSB0aGlzW29mZnNldF0gJiAweDgwXG4gIGlmIChuZWcpXG4gICAgcmV0dXJuICgweGZmIC0gdGhpc1tvZmZzZXRdICsgMSkgKiAtMVxuICBlbHNlXG4gICAgcmV0dXJuIHRoaXNbb2Zmc2V0XVxufVxuXG5mdW5jdGlvbiBfcmVhZEludDE2IChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDEgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgdmFyIHZhbCA9IF9yZWFkVUludDE2KGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIHRydWUpXG4gIHZhciBuZWcgPSB2YWwgJiAweDgwMDBcbiAgaWYgKG5lZylcbiAgICByZXR1cm4gKDB4ZmZmZiAtIHZhbCArIDEpICogLTFcbiAgZWxzZVxuICAgIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZEludDE2KHRoaXMsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDE2QkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRJbnQxNih0aGlzLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3JlYWRJbnQzMiAoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAzIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byByZWFkIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIHZhciB2YWwgPSBfcmVhZFVJbnQzMihidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCB0cnVlKVxuICB2YXIgbmVnID0gdmFsICYgMHg4MDAwMDAwMFxuICBpZiAobmVnKVxuICAgIHJldHVybiAoMHhmZmZmZmZmZiAtIHZhbCArIDEpICogLTFcbiAgZWxzZVxuICAgIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MzJMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZEludDMyKHRoaXMsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyQkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRJbnQzMih0aGlzLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3JlYWRGbG9hdCAoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMyA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICByZXR1cm4gaWVlZTc1NC5yZWFkKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdExFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIF9yZWFkRmxvYXQodGhpcywgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRmxvYXRCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZEZsb2F0KHRoaXMsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfcmVhZERvdWJsZSAoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICsgNyA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICByZXR1cm4gaWVlZTc1NC5yZWFkKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDUyLCA4KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZERvdWJsZSh0aGlzLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZERvdWJsZSh0aGlzLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQ4ID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCA8IHRoaXMubGVuZ3RoLCAndHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZnVpbnQodmFsdWUsIDB4ZmYpXG4gIH1cblxuICBpZiAob2Zmc2V0ID49IHRoaXMubGVuZ3RoKSByZXR1cm5cblxuICB0aGlzW29mZnNldF0gPSB2YWx1ZVxufVxuXG5mdW5jdGlvbiBfd3JpdGVVSW50MTYgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMSA8IGJ1Zi5sZW5ndGgsICd0cnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmdWludCh2YWx1ZSwgMHhmZmZmKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgZm9yICh2YXIgaSA9IDAsIGogPSBNYXRoLm1pbihsZW4gLSBvZmZzZXQsIDIpOyBpIDwgajsgaSsrKSB7XG4gICAgYnVmW29mZnNldCArIGldID1cbiAgICAgICAgKHZhbHVlICYgKDB4ZmYgPDwgKDggKiAobGl0dGxlRW5kaWFuID8gaSA6IDEgLSBpKSkpKSA+Pj5cbiAgICAgICAgICAgIChsaXR0bGVFbmRpYW4gPyBpIDogMSAtIGkpICogOFxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfd3JpdGVVSW50MzIgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMyA8IGJ1Zi5sZW5ndGgsICd0cnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmdWludCh2YWx1ZSwgMHhmZmZmZmZmZilcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIGZvciAodmFyIGkgPSAwLCBqID0gTWF0aC5taW4obGVuIC0gb2Zmc2V0LCA0KTsgaSA8IGo7IGkrKykge1xuICAgIGJ1ZltvZmZzZXQgKyBpXSA9XG4gICAgICAgICh2YWx1ZSA+Pj4gKGxpdHRsZUVuZGlhbiA/IGkgOiAzIC0gaSkgKiA4KSAmIDB4ZmZcbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyTEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyQkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDggPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0IDwgdGhpcy5sZW5ndGgsICdUcnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmc2ludCh2YWx1ZSwgMHg3ZiwgLTB4ODApXG4gIH1cblxuICBpZiAob2Zmc2V0ID49IHRoaXMubGVuZ3RoKVxuICAgIHJldHVyblxuXG4gIGlmICh2YWx1ZSA+PSAwKVxuICAgIHRoaXMud3JpdGVVSW50OCh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydClcbiAgZWxzZVxuICAgIHRoaXMud3JpdGVVSW50OCgweGZmICsgdmFsdWUgKyAxLCBvZmZzZXQsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfd3JpdGVJbnQxNiAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAxIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byB3cml0ZSBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gICAgdmVyaWZzaW50KHZhbHVlLCAweDdmZmYsIC0weDgwMDApXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICBpZiAodmFsdWUgPj0gMClcbiAgICBfd3JpdGVVSW50MTYoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KVxuICBlbHNlXG4gICAgX3dyaXRlVUludDE2KGJ1ZiwgMHhmZmZmICsgdmFsdWUgKyAxLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MTZCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIF93cml0ZUludDMyIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDMgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZnNpbnQodmFsdWUsIDB4N2ZmZmZmZmYsIC0weDgwMDAwMDAwKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgaWYgKHZhbHVlID49IDApXG4gICAgX3dyaXRlVUludDMyKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydClcbiAgZWxzZVxuICAgIF93cml0ZVVJbnQzMihidWYsIDB4ZmZmZmZmZmYgKyB2YWx1ZSArIDEsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyTEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQzMkJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3dyaXRlRmxvYXQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMyA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmSUVFRTc1NCh2YWx1ZSwgMy40MDI4MjM0NjYzODUyODg2ZSszOCwgLTMuNDAyODIzNDY2Mzg1Mjg4NmUrMzgpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0TEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVGbG9hdEJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3dyaXRlRG91YmxlIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDcgPCBidWYubGVuZ3RoLFxuICAgICAgICAnVHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZklFRUU3NTQodmFsdWUsIDEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4LCAtMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCA1MiwgOClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbi8vIGZpbGwodmFsdWUsIHN0YXJ0PTAsIGVuZD1idWZmZXIubGVuZ3RoKVxuQnVmZmVyLnByb3RvdHlwZS5maWxsID0gZnVuY3Rpb24gKHZhbHVlLCBzdGFydCwgZW5kKSB7XG4gIGlmICghdmFsdWUpIHZhbHVlID0gMFxuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQpIGVuZCA9IHRoaXMubGVuZ3RoXG5cbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICB2YWx1ZSA9IHZhbHVlLmNoYXJDb2RlQXQoMClcbiAgfVxuXG4gIGFzc2VydCh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInICYmICFpc05hTih2YWx1ZSksICd2YWx1ZSBpcyBub3QgYSBudW1iZXInKVxuICBhc3NlcnQoZW5kID49IHN0YXJ0LCAnZW5kIDwgc3RhcnQnKVxuXG4gIC8vIEZpbGwgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuXG4gIGlmICh0aGlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuXG5cbiAgYXNzZXJ0KHN0YXJ0ID49IDAgJiYgc3RhcnQgPCB0aGlzLmxlbmd0aCwgJ3N0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBhc3NlcnQoZW5kID49IDAgJiYgZW5kIDw9IHRoaXMubGVuZ3RoLCAnZW5kIG91dCBvZiBib3VuZHMnKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgdGhpc1tpXSA9IHZhbHVlXG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbnNwZWN0ID0gZnVuY3Rpb24gKCkge1xuICB2YXIgb3V0ID0gW11cbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICBvdXRbaV0gPSB0b0hleCh0aGlzW2ldKVxuICAgIGlmIChpID09PSBleHBvcnRzLklOU1BFQ1RfTUFYX0JZVEVTKSB7XG4gICAgICBvdXRbaSArIDFdID0gJy4uLidcbiAgICAgIGJyZWFrXG4gICAgfVxuICB9XG4gIHJldHVybiAnPEJ1ZmZlciAnICsgb3V0LmpvaW4oJyAnKSArICc+J1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBuZXcgYEFycmF5QnVmZmVyYCB3aXRoIHRoZSAqY29waWVkKiBtZW1vcnkgb2YgdGhlIGJ1ZmZlciBpbnN0YW5jZS5cbiAqIEFkZGVkIGluIE5vZGUgMC4xMi4gT25seSBhdmFpbGFibGUgaW4gYnJvd3NlcnMgdGhhdCBzdXBwb3J0IEFycmF5QnVmZmVyLlxuICovXG5CdWZmZXIucHJvdG90eXBlLnRvQXJyYXlCdWZmZXIgPSBmdW5jdGlvbiAoKSB7XG4gIGlmICh0eXBlb2YgVWludDhBcnJheSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBpZiAoQnVmZmVyLl91c2VUeXBlZEFycmF5cykge1xuICAgICAgcmV0dXJuIChuZXcgQnVmZmVyKHRoaXMpKS5idWZmZXJcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGJ1ZiA9IG5ldyBVaW50OEFycmF5KHRoaXMubGVuZ3RoKVxuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGJ1Zi5sZW5ndGg7IGkgPCBsZW47IGkgKz0gMSlcbiAgICAgICAgYnVmW2ldID0gdGhpc1tpXVxuICAgICAgcmV0dXJuIGJ1Zi5idWZmZXJcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdCdWZmZXIudG9BcnJheUJ1ZmZlciBub3Qgc3VwcG9ydGVkIGluIHRoaXMgYnJvd3NlcicpXG4gIH1cbn1cblxuLy8gSEVMUEVSIEZVTkNUSU9OU1xuLy8gPT09PT09PT09PT09PT09PVxuXG5mdW5jdGlvbiBzdHJpbmd0cmltIChzdHIpIHtcbiAgaWYgKHN0ci50cmltKSByZXR1cm4gc3RyLnRyaW0oKVxuICByZXR1cm4gc3RyLnJlcGxhY2UoL15cXHMrfFxccyskL2csICcnKVxufVxuXG52YXIgQlAgPSBCdWZmZXIucHJvdG90eXBlXG5cbi8qKlxuICogQXVnbWVudCBhIFVpbnQ4QXJyYXkgKmluc3RhbmNlKiAobm90IHRoZSBVaW50OEFycmF5IGNsYXNzISkgd2l0aCBCdWZmZXIgbWV0aG9kc1xuICovXG5CdWZmZXIuX2F1Z21lbnQgPSBmdW5jdGlvbiAoYXJyKSB7XG4gIGFyci5faXNCdWZmZXIgPSB0cnVlXG5cbiAgLy8gc2F2ZSByZWZlcmVuY2UgdG8gb3JpZ2luYWwgVWludDhBcnJheSBnZXQvc2V0IG1ldGhvZHMgYmVmb3JlIG92ZXJ3cml0aW5nXG4gIGFyci5fZ2V0ID0gYXJyLmdldFxuICBhcnIuX3NldCA9IGFyci5zZXRcblxuICAvLyBkZXByZWNhdGVkLCB3aWxsIGJlIHJlbW92ZWQgaW4gbm9kZSAwLjEzK1xuICBhcnIuZ2V0ID0gQlAuZ2V0XG4gIGFyci5zZXQgPSBCUC5zZXRcblxuICBhcnIud3JpdGUgPSBCUC53cml0ZVxuICBhcnIudG9TdHJpbmcgPSBCUC50b1N0cmluZ1xuICBhcnIudG9Mb2NhbGVTdHJpbmcgPSBCUC50b1N0cmluZ1xuICBhcnIudG9KU09OID0gQlAudG9KU09OXG4gIGFyci5jb3B5ID0gQlAuY29weVxuICBhcnIuc2xpY2UgPSBCUC5zbGljZVxuICBhcnIucmVhZFVJbnQ4ID0gQlAucmVhZFVJbnQ4XG4gIGFyci5yZWFkVUludDE2TEUgPSBCUC5yZWFkVUludDE2TEVcbiAgYXJyLnJlYWRVSW50MTZCRSA9IEJQLnJlYWRVSW50MTZCRVxuICBhcnIucmVhZFVJbnQzMkxFID0gQlAucmVhZFVJbnQzMkxFXG4gIGFyci5yZWFkVUludDMyQkUgPSBCUC5yZWFkVUludDMyQkVcbiAgYXJyLnJlYWRJbnQ4ID0gQlAucmVhZEludDhcbiAgYXJyLnJlYWRJbnQxNkxFID0gQlAucmVhZEludDE2TEVcbiAgYXJyLnJlYWRJbnQxNkJFID0gQlAucmVhZEludDE2QkVcbiAgYXJyLnJlYWRJbnQzMkxFID0gQlAucmVhZEludDMyTEVcbiAgYXJyLnJlYWRJbnQzMkJFID0gQlAucmVhZEludDMyQkVcbiAgYXJyLnJlYWRGbG9hdExFID0gQlAucmVhZEZsb2F0TEVcbiAgYXJyLnJlYWRGbG9hdEJFID0gQlAucmVhZEZsb2F0QkVcbiAgYXJyLnJlYWREb3VibGVMRSA9IEJQLnJlYWREb3VibGVMRVxuICBhcnIucmVhZERvdWJsZUJFID0gQlAucmVhZERvdWJsZUJFXG4gIGFyci53cml0ZVVJbnQ4ID0gQlAud3JpdGVVSW50OFxuICBhcnIud3JpdGVVSW50MTZMRSA9IEJQLndyaXRlVUludDE2TEVcbiAgYXJyLndyaXRlVUludDE2QkUgPSBCUC53cml0ZVVJbnQxNkJFXG4gIGFyci53cml0ZVVJbnQzMkxFID0gQlAud3JpdGVVSW50MzJMRVxuICBhcnIud3JpdGVVSW50MzJCRSA9IEJQLndyaXRlVUludDMyQkVcbiAgYXJyLndyaXRlSW50OCA9IEJQLndyaXRlSW50OFxuICBhcnIud3JpdGVJbnQxNkxFID0gQlAud3JpdGVJbnQxNkxFXG4gIGFyci53cml0ZUludDE2QkUgPSBCUC53cml0ZUludDE2QkVcbiAgYXJyLndyaXRlSW50MzJMRSA9IEJQLndyaXRlSW50MzJMRVxuICBhcnIud3JpdGVJbnQzMkJFID0gQlAud3JpdGVJbnQzMkJFXG4gIGFyci53cml0ZUZsb2F0TEUgPSBCUC53cml0ZUZsb2F0TEVcbiAgYXJyLndyaXRlRmxvYXRCRSA9IEJQLndyaXRlRmxvYXRCRVxuICBhcnIud3JpdGVEb3VibGVMRSA9IEJQLndyaXRlRG91YmxlTEVcbiAgYXJyLndyaXRlRG91YmxlQkUgPSBCUC53cml0ZURvdWJsZUJFXG4gIGFyci5maWxsID0gQlAuZmlsbFxuICBhcnIuaW5zcGVjdCA9IEJQLmluc3BlY3RcbiAgYXJyLnRvQXJyYXlCdWZmZXIgPSBCUC50b0FycmF5QnVmZmVyXG5cbiAgcmV0dXJuIGFyclxufVxuXG4vLyBzbGljZShzdGFydCwgZW5kKVxuZnVuY3Rpb24gY2xhbXAgKGluZGV4LCBsZW4sIGRlZmF1bHRWYWx1ZSkge1xuICBpZiAodHlwZW9mIGluZGV4ICE9PSAnbnVtYmVyJykgcmV0dXJuIGRlZmF1bHRWYWx1ZVxuICBpbmRleCA9IH5+aW5kZXg7ICAvLyBDb2VyY2UgdG8gaW50ZWdlci5cbiAgaWYgKGluZGV4ID49IGxlbikgcmV0dXJuIGxlblxuICBpZiAoaW5kZXggPj0gMCkgcmV0dXJuIGluZGV4XG4gIGluZGV4ICs9IGxlblxuICBpZiAoaW5kZXggPj0gMCkgcmV0dXJuIGluZGV4XG4gIHJldHVybiAwXG59XG5cbmZ1bmN0aW9uIGNvZXJjZSAobGVuZ3RoKSB7XG4gIC8vIENvZXJjZSBsZW5ndGggdG8gYSBudW1iZXIgKHBvc3NpYmx5IE5hTiksIHJvdW5kIHVwXG4gIC8vIGluIGNhc2UgaXQncyBmcmFjdGlvbmFsIChlLmcuIDEyMy40NTYpIHRoZW4gZG8gYVxuICAvLyBkb3VibGUgbmVnYXRlIHRvIGNvZXJjZSBhIE5hTiB0byAwLiBFYXN5LCByaWdodD9cbiAgbGVuZ3RoID0gfn5NYXRoLmNlaWwoK2xlbmd0aClcbiAgcmV0dXJuIGxlbmd0aCA8IDAgPyAwIDogbGVuZ3RoXG59XG5cbmZ1bmN0aW9uIGlzQXJyYXkgKHN1YmplY3QpIHtcbiAgcmV0dXJuIChBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uIChzdWJqZWN0KSB7XG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChzdWJqZWN0KSA9PT0gJ1tvYmplY3QgQXJyYXldJ1xuICB9KShzdWJqZWN0KVxufVxuXG5mdW5jdGlvbiBpc0FycmF5aXNoIChzdWJqZWN0KSB7XG4gIHJldHVybiBpc0FycmF5KHN1YmplY3QpIHx8IEJ1ZmZlci5pc0J1ZmZlcihzdWJqZWN0KSB8fFxuICAgICAgc3ViamVjdCAmJiB0eXBlb2Ygc3ViamVjdCA9PT0gJ29iamVjdCcgJiZcbiAgICAgIHR5cGVvZiBzdWJqZWN0Lmxlbmd0aCA9PT0gJ251bWJlcidcbn1cblxuZnVuY3Rpb24gdG9IZXggKG4pIHtcbiAgaWYgKG4gPCAxNikgcmV0dXJuICcwJyArIG4udG9TdHJpbmcoMTYpXG4gIHJldHVybiBuLnRvU3RyaW5nKDE2KVxufVxuXG5mdW5jdGlvbiB1dGY4VG9CeXRlcyAoc3RyKSB7XG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIHZhciBiID0gc3RyLmNoYXJDb2RlQXQoaSlcbiAgICBpZiAoYiA8PSAweDdGKVxuICAgICAgYnl0ZUFycmF5LnB1c2goc3RyLmNoYXJDb2RlQXQoaSkpXG4gICAgZWxzZSB7XG4gICAgICB2YXIgc3RhcnQgPSBpXG4gICAgICBpZiAoYiA+PSAweEQ4MDAgJiYgYiA8PSAweERGRkYpIGkrK1xuICAgICAgdmFyIGggPSBlbmNvZGVVUklDb21wb25lbnQoc3RyLnNsaWNlKHN0YXJ0LCBpKzEpKS5zdWJzdHIoMSkuc3BsaXQoJyUnKVxuICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBoLmxlbmd0aDsgaisrKVxuICAgICAgICBieXRlQXJyYXkucHVzaChwYXJzZUludChoW2pdLCAxNikpXG4gICAgfVxuICB9XG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gYXNjaWlUb0J5dGVzIChzdHIpIHtcbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgLy8gTm9kZSdzIGNvZGUgc2VlbXMgdG8gYmUgZG9pbmcgdGhpcyBhbmQgbm90ICYgMHg3Ri4uXG4gICAgYnl0ZUFycmF5LnB1c2goc3RyLmNoYXJDb2RlQXQoaSkgJiAweEZGKVxuICB9XG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gdXRmMTZsZVRvQnl0ZXMgKHN0cikge1xuICB2YXIgYywgaGksIGxvXG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIGMgPSBzdHIuY2hhckNvZGVBdChpKVxuICAgIGhpID0gYyA+PiA4XG4gICAgbG8gPSBjICUgMjU2XG4gICAgYnl0ZUFycmF5LnB1c2gobG8pXG4gICAgYnl0ZUFycmF5LnB1c2goaGkpXG4gIH1cblxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIGJhc2U2NFRvQnl0ZXMgKHN0cikge1xuICByZXR1cm4gYmFzZTY0LnRvQnl0ZUFycmF5KHN0cilcbn1cblxuZnVuY3Rpb24gYmxpdEJ1ZmZlciAoc3JjLCBkc3QsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHZhciBwb3NcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIGlmICgoaSArIG9mZnNldCA+PSBkc3QubGVuZ3RoKSB8fCAoaSA+PSBzcmMubGVuZ3RoKSlcbiAgICAgIGJyZWFrXG4gICAgZHN0W2kgKyBvZmZzZXRdID0gc3JjW2ldXG4gIH1cbiAgcmV0dXJuIGlcbn1cblxuZnVuY3Rpb24gZGVjb2RlVXRmOENoYXIgKHN0cikge1xuICB0cnkge1xuICAgIHJldHVybiBkZWNvZGVVUklDb21wb25lbnQoc3RyKVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZSgweEZGRkQpIC8vIFVURiA4IGludmFsaWQgY2hhclxuICB9XG59XG5cbi8qXG4gKiBXZSBoYXZlIHRvIG1ha2Ugc3VyZSB0aGF0IHRoZSB2YWx1ZSBpcyBhIHZhbGlkIGludGVnZXIuIFRoaXMgbWVhbnMgdGhhdCBpdFxuICogaXMgbm9uLW5lZ2F0aXZlLiBJdCBoYXMgbm8gZnJhY3Rpb25hbCBjb21wb25lbnQgYW5kIHRoYXQgaXQgZG9lcyBub3RcbiAqIGV4Y2VlZCB0aGUgbWF4aW11bSBhbGxvd2VkIHZhbHVlLlxuICovXG5mdW5jdGlvbiB2ZXJpZnVpbnQgKHZhbHVlLCBtYXgpIHtcbiAgYXNzZXJ0KHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicsICdjYW5ub3Qgd3JpdGUgYSBub24tbnVtYmVyIGFzIGEgbnVtYmVyJylcbiAgYXNzZXJ0KHZhbHVlID49IDAsICdzcGVjaWZpZWQgYSBuZWdhdGl2ZSB2YWx1ZSBmb3Igd3JpdGluZyBhbiB1bnNpZ25lZCB2YWx1ZScpXG4gIGFzc2VydCh2YWx1ZSA8PSBtYXgsICd2YWx1ZSBpcyBsYXJnZXIgdGhhbiBtYXhpbXVtIHZhbHVlIGZvciB0eXBlJylcbiAgYXNzZXJ0KE1hdGguZmxvb3IodmFsdWUpID09PSB2YWx1ZSwgJ3ZhbHVlIGhhcyBhIGZyYWN0aW9uYWwgY29tcG9uZW50Jylcbn1cblxuZnVuY3Rpb24gdmVyaWZzaW50ICh2YWx1ZSwgbWF4LCBtaW4pIHtcbiAgYXNzZXJ0KHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicsICdjYW5ub3Qgd3JpdGUgYSBub24tbnVtYmVyIGFzIGEgbnVtYmVyJylcbiAgYXNzZXJ0KHZhbHVlIDw9IG1heCwgJ3ZhbHVlIGxhcmdlciB0aGFuIG1heGltdW0gYWxsb3dlZCB2YWx1ZScpXG4gIGFzc2VydCh2YWx1ZSA+PSBtaW4sICd2YWx1ZSBzbWFsbGVyIHRoYW4gbWluaW11bSBhbGxvd2VkIHZhbHVlJylcbiAgYXNzZXJ0KE1hdGguZmxvb3IodmFsdWUpID09PSB2YWx1ZSwgJ3ZhbHVlIGhhcyBhIGZyYWN0aW9uYWwgY29tcG9uZW50Jylcbn1cblxuZnVuY3Rpb24gdmVyaWZJRUVFNzU0ICh2YWx1ZSwgbWF4LCBtaW4pIHtcbiAgYXNzZXJ0KHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicsICdjYW5ub3Qgd3JpdGUgYSBub24tbnVtYmVyIGFzIGEgbnVtYmVyJylcbiAgYXNzZXJ0KHZhbHVlIDw9IG1heCwgJ3ZhbHVlIGxhcmdlciB0aGFuIG1heGltdW0gYWxsb3dlZCB2YWx1ZScpXG4gIGFzc2VydCh2YWx1ZSA+PSBtaW4sICd2YWx1ZSBzbWFsbGVyIHRoYW4gbWluaW11bSBhbGxvd2VkIHZhbHVlJylcbn1cblxuZnVuY3Rpb24gYXNzZXJ0ICh0ZXN0LCBtZXNzYWdlKSB7XG4gIGlmICghdGVzdCkgdGhyb3cgbmV3IEVycm9yKG1lc3NhZ2UgfHwgJ0ZhaWxlZCBhc3NlcnRpb24nKVxufVxuIiwidmFyIGxvb2t1cCA9ICdBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MDEyMzQ1Njc4OSsvJztcblxuOyhmdW5jdGlvbiAoZXhwb3J0cykge1xuXHQndXNlIHN0cmljdCc7XG5cbiAgdmFyIEFyciA9ICh0eXBlb2YgVWludDhBcnJheSAhPT0gJ3VuZGVmaW5lZCcpXG4gICAgPyBVaW50OEFycmF5XG4gICAgOiBBcnJheVxuXG5cdHZhciBQTFVTICAgPSAnKycuY2hhckNvZGVBdCgwKVxuXHR2YXIgU0xBU0ggID0gJy8nLmNoYXJDb2RlQXQoMClcblx0dmFyIE5VTUJFUiA9ICcwJy5jaGFyQ29kZUF0KDApXG5cdHZhciBMT1dFUiAgPSAnYScuY2hhckNvZGVBdCgwKVxuXHR2YXIgVVBQRVIgID0gJ0EnLmNoYXJDb2RlQXQoMClcblx0dmFyIFBMVVNfVVJMX1NBRkUgPSAnLScuY2hhckNvZGVBdCgwKVxuXHR2YXIgU0xBU0hfVVJMX1NBRkUgPSAnXycuY2hhckNvZGVBdCgwKVxuXG5cdGZ1bmN0aW9uIGRlY29kZSAoZWx0KSB7XG5cdFx0dmFyIGNvZGUgPSBlbHQuY2hhckNvZGVBdCgwKVxuXHRcdGlmIChjb2RlID09PSBQTFVTIHx8XG5cdFx0ICAgIGNvZGUgPT09IFBMVVNfVVJMX1NBRkUpXG5cdFx0XHRyZXR1cm4gNjIgLy8gJysnXG5cdFx0aWYgKGNvZGUgPT09IFNMQVNIIHx8XG5cdFx0ICAgIGNvZGUgPT09IFNMQVNIX1VSTF9TQUZFKVxuXHRcdFx0cmV0dXJuIDYzIC8vICcvJ1xuXHRcdGlmIChjb2RlIDwgTlVNQkVSKVxuXHRcdFx0cmV0dXJuIC0xIC8vbm8gbWF0Y2hcblx0XHRpZiAoY29kZSA8IE5VTUJFUiArIDEwKVxuXHRcdFx0cmV0dXJuIGNvZGUgLSBOVU1CRVIgKyAyNiArIDI2XG5cdFx0aWYgKGNvZGUgPCBVUFBFUiArIDI2KVxuXHRcdFx0cmV0dXJuIGNvZGUgLSBVUFBFUlxuXHRcdGlmIChjb2RlIDwgTE9XRVIgKyAyNilcblx0XHRcdHJldHVybiBjb2RlIC0gTE9XRVIgKyAyNlxuXHR9XG5cblx0ZnVuY3Rpb24gYjY0VG9CeXRlQXJyYXkgKGI2NCkge1xuXHRcdHZhciBpLCBqLCBsLCB0bXAsIHBsYWNlSG9sZGVycywgYXJyXG5cblx0XHRpZiAoYjY0Lmxlbmd0aCAlIDQgPiAwKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgc3RyaW5nLiBMZW5ndGggbXVzdCBiZSBhIG11bHRpcGxlIG9mIDQnKVxuXHRcdH1cblxuXHRcdC8vIHRoZSBudW1iZXIgb2YgZXF1YWwgc2lnbnMgKHBsYWNlIGhvbGRlcnMpXG5cdFx0Ly8gaWYgdGhlcmUgYXJlIHR3byBwbGFjZWhvbGRlcnMsIHRoYW4gdGhlIHR3byBjaGFyYWN0ZXJzIGJlZm9yZSBpdFxuXHRcdC8vIHJlcHJlc2VudCBvbmUgYnl0ZVxuXHRcdC8vIGlmIHRoZXJlIGlzIG9ubHkgb25lLCB0aGVuIHRoZSB0aHJlZSBjaGFyYWN0ZXJzIGJlZm9yZSBpdCByZXByZXNlbnQgMiBieXRlc1xuXHRcdC8vIHRoaXMgaXMganVzdCBhIGNoZWFwIGhhY2sgdG8gbm90IGRvIGluZGV4T2YgdHdpY2Vcblx0XHR2YXIgbGVuID0gYjY0Lmxlbmd0aFxuXHRcdHBsYWNlSG9sZGVycyA9ICc9JyA9PT0gYjY0LmNoYXJBdChsZW4gLSAyKSA/IDIgOiAnPScgPT09IGI2NC5jaGFyQXQobGVuIC0gMSkgPyAxIDogMFxuXG5cdFx0Ly8gYmFzZTY0IGlzIDQvMyArIHVwIHRvIHR3byBjaGFyYWN0ZXJzIG9mIHRoZSBvcmlnaW5hbCBkYXRhXG5cdFx0YXJyID0gbmV3IEFycihiNjQubGVuZ3RoICogMyAvIDQgLSBwbGFjZUhvbGRlcnMpXG5cblx0XHQvLyBpZiB0aGVyZSBhcmUgcGxhY2Vob2xkZXJzLCBvbmx5IGdldCB1cCB0byB0aGUgbGFzdCBjb21wbGV0ZSA0IGNoYXJzXG5cdFx0bCA9IHBsYWNlSG9sZGVycyA+IDAgPyBiNjQubGVuZ3RoIC0gNCA6IGI2NC5sZW5ndGhcblxuXHRcdHZhciBMID0gMFxuXG5cdFx0ZnVuY3Rpb24gcHVzaCAodikge1xuXHRcdFx0YXJyW0wrK10gPSB2XG5cdFx0fVxuXG5cdFx0Zm9yIChpID0gMCwgaiA9IDA7IGkgPCBsOyBpICs9IDQsIGogKz0gMykge1xuXHRcdFx0dG1wID0gKGRlY29kZShiNjQuY2hhckF0KGkpKSA8PCAxOCkgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDEpKSA8PCAxMikgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDIpKSA8PCA2KSB8IGRlY29kZShiNjQuY2hhckF0KGkgKyAzKSlcblx0XHRcdHB1c2goKHRtcCAmIDB4RkYwMDAwKSA+PiAxNilcblx0XHRcdHB1c2goKHRtcCAmIDB4RkYwMCkgPj4gOClcblx0XHRcdHB1c2godG1wICYgMHhGRilcblx0XHR9XG5cblx0XHRpZiAocGxhY2VIb2xkZXJzID09PSAyKSB7XG5cdFx0XHR0bXAgPSAoZGVjb2RlKGI2NC5jaGFyQXQoaSkpIDw8IDIpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAxKSkgPj4gNClcblx0XHRcdHB1c2godG1wICYgMHhGRilcblx0XHR9IGVsc2UgaWYgKHBsYWNlSG9sZGVycyA9PT0gMSkge1xuXHRcdFx0dG1wID0gKGRlY29kZShiNjQuY2hhckF0KGkpKSA8PCAxMCkgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDEpKSA8PCA0KSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMikpID4+IDIpXG5cdFx0XHRwdXNoKCh0bXAgPj4gOCkgJiAweEZGKVxuXHRcdFx0cHVzaCh0bXAgJiAweEZGKVxuXHRcdH1cblxuXHRcdHJldHVybiBhcnJcblx0fVxuXG5cdGZ1bmN0aW9uIHVpbnQ4VG9CYXNlNjQgKHVpbnQ4KSB7XG5cdFx0dmFyIGksXG5cdFx0XHRleHRyYUJ5dGVzID0gdWludDgubGVuZ3RoICUgMywgLy8gaWYgd2UgaGF2ZSAxIGJ5dGUgbGVmdCwgcGFkIDIgYnl0ZXNcblx0XHRcdG91dHB1dCA9IFwiXCIsXG5cdFx0XHR0ZW1wLCBsZW5ndGhcblxuXHRcdGZ1bmN0aW9uIGVuY29kZSAobnVtKSB7XG5cdFx0XHRyZXR1cm4gbG9va3VwLmNoYXJBdChudW0pXG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gdHJpcGxldFRvQmFzZTY0IChudW0pIHtcblx0XHRcdHJldHVybiBlbmNvZGUobnVtID4+IDE4ICYgMHgzRikgKyBlbmNvZGUobnVtID4+IDEyICYgMHgzRikgKyBlbmNvZGUobnVtID4+IDYgJiAweDNGKSArIGVuY29kZShudW0gJiAweDNGKVxuXHRcdH1cblxuXHRcdC8vIGdvIHRocm91Z2ggdGhlIGFycmF5IGV2ZXJ5IHRocmVlIGJ5dGVzLCB3ZSdsbCBkZWFsIHdpdGggdHJhaWxpbmcgc3R1ZmYgbGF0ZXJcblx0XHRmb3IgKGkgPSAwLCBsZW5ndGggPSB1aW50OC5sZW5ndGggLSBleHRyYUJ5dGVzOyBpIDwgbGVuZ3RoOyBpICs9IDMpIHtcblx0XHRcdHRlbXAgPSAodWludDhbaV0gPDwgMTYpICsgKHVpbnQ4W2kgKyAxXSA8PCA4KSArICh1aW50OFtpICsgMl0pXG5cdFx0XHRvdXRwdXQgKz0gdHJpcGxldFRvQmFzZTY0KHRlbXApXG5cdFx0fVxuXG5cdFx0Ly8gcGFkIHRoZSBlbmQgd2l0aCB6ZXJvcywgYnV0IG1ha2Ugc3VyZSB0byBub3QgZm9yZ2V0IHRoZSBleHRyYSBieXRlc1xuXHRcdHN3aXRjaCAoZXh0cmFCeXRlcykge1xuXHRcdFx0Y2FzZSAxOlxuXHRcdFx0XHR0ZW1wID0gdWludDhbdWludDgubGVuZ3RoIC0gMV1cblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSh0ZW1wID4+IDIpXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUoKHRlbXAgPDwgNCkgJiAweDNGKVxuXHRcdFx0XHRvdXRwdXQgKz0gJz09J1xuXHRcdFx0XHRicmVha1xuXHRcdFx0Y2FzZSAyOlxuXHRcdFx0XHR0ZW1wID0gKHVpbnQ4W3VpbnQ4Lmxlbmd0aCAtIDJdIDw8IDgpICsgKHVpbnQ4W3VpbnQ4Lmxlbmd0aCAtIDFdKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKHRlbXAgPj4gMTApXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUoKHRlbXAgPj4gNCkgJiAweDNGKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKCh0ZW1wIDw8IDIpICYgMHgzRilcblx0XHRcdFx0b3V0cHV0ICs9ICc9J1xuXHRcdFx0XHRicmVha1xuXHRcdH1cblxuXHRcdHJldHVybiBvdXRwdXRcblx0fVxuXG5cdGV4cG9ydHMudG9CeXRlQXJyYXkgPSBiNjRUb0J5dGVBcnJheVxuXHRleHBvcnRzLmZyb21CeXRlQXJyYXkgPSB1aW50OFRvQmFzZTY0XG59KHR5cGVvZiBleHBvcnRzID09PSAndW5kZWZpbmVkJyA/ICh0aGlzLmJhc2U2NGpzID0ge30pIDogZXhwb3J0cykpXG4iLCJleHBvcnRzLnJlYWQgPSBmdW5jdGlvbiAoYnVmZmVyLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbSxcbiAgICAgIGVMZW4gPSBuQnl0ZXMgKiA4IC0gbUxlbiAtIDEsXG4gICAgICBlTWF4ID0gKDEgPDwgZUxlbikgLSAxLFxuICAgICAgZUJpYXMgPSBlTWF4ID4+IDEsXG4gICAgICBuQml0cyA9IC03LFxuICAgICAgaSA9IGlzTEUgPyAobkJ5dGVzIC0gMSkgOiAwLFxuICAgICAgZCA9IGlzTEUgPyAtMSA6IDEsXG4gICAgICBzID0gYnVmZmVyW29mZnNldCArIGldXG5cbiAgaSArPSBkXG5cbiAgZSA9IHMgJiAoKDEgPDwgKC1uQml0cykpIC0gMSlcbiAgcyA+Pj0gKC1uQml0cylcbiAgbkJpdHMgKz0gZUxlblxuICBmb3IgKDsgbkJpdHMgPiAwOyBlID0gZSAqIDI1NiArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KSB7fVxuXG4gIG0gPSBlICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpXG4gIGUgPj49ICgtbkJpdHMpXG4gIG5CaXRzICs9IG1MZW5cbiAgZm9yICg7IG5CaXRzID4gMDsgbSA9IG0gKiAyNTYgKyBidWZmZXJbb2Zmc2V0ICsgaV0sIGkgKz0gZCwgbkJpdHMgLT0gOCkge31cblxuICBpZiAoZSA9PT0gMCkge1xuICAgIGUgPSAxIC0gZUJpYXNcbiAgfSBlbHNlIGlmIChlID09PSBlTWF4KSB7XG4gICAgcmV0dXJuIG0gPyBOYU4gOiAoKHMgPyAtMSA6IDEpICogSW5maW5pdHkpXG4gIH0gZWxzZSB7XG4gICAgbSA9IG0gKyBNYXRoLnBvdygyLCBtTGVuKVxuICAgIGUgPSBlIC0gZUJpYXNcbiAgfVxuICByZXR1cm4gKHMgPyAtMSA6IDEpICogbSAqIE1hdGgucG93KDIsIGUgLSBtTGVuKVxufVxuXG5leHBvcnRzLndyaXRlID0gZnVuY3Rpb24gKGJ1ZmZlciwgdmFsdWUsIG9mZnNldCwgaXNMRSwgbUxlbiwgbkJ5dGVzKSB7XG4gIHZhciBlLCBtLCBjLFxuICAgICAgZUxlbiA9IG5CeXRlcyAqIDggLSBtTGVuIC0gMSxcbiAgICAgIGVNYXggPSAoMSA8PCBlTGVuKSAtIDEsXG4gICAgICBlQmlhcyA9IGVNYXggPj4gMSxcbiAgICAgIHJ0ID0gKG1MZW4gPT09IDIzID8gTWF0aC5wb3coMiwgLTI0KSAtIE1hdGgucG93KDIsIC03NykgOiAwKSxcbiAgICAgIGkgPSBpc0xFID8gMCA6IChuQnl0ZXMgLSAxKSxcbiAgICAgIGQgPSBpc0xFID8gMSA6IC0xLFxuICAgICAgcyA9IHZhbHVlIDwgMCB8fCAodmFsdWUgPT09IDAgJiYgMSAvIHZhbHVlIDwgMCkgPyAxIDogMFxuXG4gIHZhbHVlID0gTWF0aC5hYnModmFsdWUpXG5cbiAgaWYgKGlzTmFOKHZhbHVlKSB8fCB2YWx1ZSA9PT0gSW5maW5pdHkpIHtcbiAgICBtID0gaXNOYU4odmFsdWUpID8gMSA6IDBcbiAgICBlID0gZU1heFxuICB9IGVsc2Uge1xuICAgIGUgPSBNYXRoLmZsb29yKE1hdGgubG9nKHZhbHVlKSAvIE1hdGguTE4yKVxuICAgIGlmICh2YWx1ZSAqIChjID0gTWF0aC5wb3coMiwgLWUpKSA8IDEpIHtcbiAgICAgIGUtLVxuICAgICAgYyAqPSAyXG4gICAgfVxuICAgIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgdmFsdWUgKz0gcnQgLyBjXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbHVlICs9IHJ0ICogTWF0aC5wb3coMiwgMSAtIGVCaWFzKVxuICAgIH1cbiAgICBpZiAodmFsdWUgKiBjID49IDIpIHtcbiAgICAgIGUrK1xuICAgICAgYyAvPSAyXG4gICAgfVxuXG4gICAgaWYgKGUgKyBlQmlhcyA+PSBlTWF4KSB7XG4gICAgICBtID0gMFxuICAgICAgZSA9IGVNYXhcbiAgICB9IGVsc2UgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICBtID0gKHZhbHVlICogYyAtIDEpICogTWF0aC5wb3coMiwgbUxlbilcbiAgICAgIGUgPSBlICsgZUJpYXNcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IHZhbHVlICogTWF0aC5wb3coMiwgZUJpYXMgLSAxKSAqIE1hdGgucG93KDIsIG1MZW4pXG4gICAgICBlID0gMFxuICAgIH1cbiAgfVxuXG4gIGZvciAoOyBtTGVuID49IDg7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IG0gJiAweGZmLCBpICs9IGQsIG0gLz0gMjU2LCBtTGVuIC09IDgpIHt9XG5cbiAgZSA9IChlIDw8IG1MZW4pIHwgbVxuICBlTGVuICs9IG1MZW5cbiAgZm9yICg7IGVMZW4gPiAwOyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBlICYgMHhmZiwgaSArPSBkLCBlIC89IDI1NiwgZUxlbiAtPSA4KSB7fVxuXG4gIGJ1ZmZlcltvZmZzZXQgKyBpIC0gZF0gfD0gcyAqIDEyOFxufVxuIiwidmFyIEJ1ZmZlciA9IHJlcXVpcmUoJ2J1ZmZlcicpLkJ1ZmZlcjtcbnZhciBpbnRTaXplID0gNDtcbnZhciB6ZXJvQnVmZmVyID0gbmV3IEJ1ZmZlcihpbnRTaXplKTsgemVyb0J1ZmZlci5maWxsKDApO1xudmFyIGNocnN6ID0gODtcblxuZnVuY3Rpb24gdG9BcnJheShidWYsIGJpZ0VuZGlhbikge1xuICBpZiAoKGJ1Zi5sZW5ndGggJSBpbnRTaXplKSAhPT0gMCkge1xuICAgIHZhciBsZW4gPSBidWYubGVuZ3RoICsgKGludFNpemUgLSAoYnVmLmxlbmd0aCAlIGludFNpemUpKTtcbiAgICBidWYgPSBCdWZmZXIuY29uY2F0KFtidWYsIHplcm9CdWZmZXJdLCBsZW4pO1xuICB9XG5cbiAgdmFyIGFyciA9IFtdO1xuICB2YXIgZm4gPSBiaWdFbmRpYW4gPyBidWYucmVhZEludDMyQkUgOiBidWYucmVhZEludDMyTEU7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYnVmLmxlbmd0aDsgaSArPSBpbnRTaXplKSB7XG4gICAgYXJyLnB1c2goZm4uY2FsbChidWYsIGkpKTtcbiAgfVxuICByZXR1cm4gYXJyO1xufVxuXG5mdW5jdGlvbiB0b0J1ZmZlcihhcnIsIHNpemUsIGJpZ0VuZGlhbikge1xuICB2YXIgYnVmID0gbmV3IEJ1ZmZlcihzaXplKTtcbiAgdmFyIGZuID0gYmlnRW5kaWFuID8gYnVmLndyaXRlSW50MzJCRSA6IGJ1Zi53cml0ZUludDMyTEU7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYXJyLmxlbmd0aDsgaSsrKSB7XG4gICAgZm4uY2FsbChidWYsIGFycltpXSwgaSAqIDQsIHRydWUpO1xuICB9XG4gIHJldHVybiBidWY7XG59XG5cbmZ1bmN0aW9uIGhhc2goYnVmLCBmbiwgaGFzaFNpemUsIGJpZ0VuZGlhbikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihidWYpKSBidWYgPSBuZXcgQnVmZmVyKGJ1Zik7XG4gIHZhciBhcnIgPSBmbih0b0FycmF5KGJ1ZiwgYmlnRW5kaWFuKSwgYnVmLmxlbmd0aCAqIGNocnN6KTtcbiAgcmV0dXJuIHRvQnVmZmVyKGFyciwgaGFzaFNpemUsIGJpZ0VuZGlhbik7XG59XG5cbm1vZHVsZS5leHBvcnRzID0geyBoYXNoOiBoYXNoIH07XG4iLCJ2YXIgQnVmZmVyID0gcmVxdWlyZSgnYnVmZmVyJykuQnVmZmVyXG52YXIgc2hhID0gcmVxdWlyZSgnLi9zaGEnKVxudmFyIHNoYTI1NiA9IHJlcXVpcmUoJy4vc2hhMjU2JylcbnZhciBybmcgPSByZXF1aXJlKCcuL3JuZycpXG52YXIgbWQ1ID0gcmVxdWlyZSgnLi9tZDUnKVxuXG52YXIgYWxnb3JpdGhtcyA9IHtcbiAgc2hhMTogc2hhLFxuICBzaGEyNTY6IHNoYTI1NixcbiAgbWQ1OiBtZDVcbn1cblxudmFyIGJsb2Nrc2l6ZSA9IDY0XG52YXIgemVyb0J1ZmZlciA9IG5ldyBCdWZmZXIoYmxvY2tzaXplKTsgemVyb0J1ZmZlci5maWxsKDApXG5mdW5jdGlvbiBobWFjKGZuLCBrZXksIGRhdGEpIHtcbiAgaWYoIUJ1ZmZlci5pc0J1ZmZlcihrZXkpKSBrZXkgPSBuZXcgQnVmZmVyKGtleSlcbiAgaWYoIUJ1ZmZlci5pc0J1ZmZlcihkYXRhKSkgZGF0YSA9IG5ldyBCdWZmZXIoZGF0YSlcblxuICBpZihrZXkubGVuZ3RoID4gYmxvY2tzaXplKSB7XG4gICAga2V5ID0gZm4oa2V5KVxuICB9IGVsc2UgaWYoa2V5Lmxlbmd0aCA8IGJsb2Nrc2l6ZSkge1xuICAgIGtleSA9IEJ1ZmZlci5jb25jYXQoW2tleSwgemVyb0J1ZmZlcl0sIGJsb2Nrc2l6ZSlcbiAgfVxuXG4gIHZhciBpcGFkID0gbmV3IEJ1ZmZlcihibG9ja3NpemUpLCBvcGFkID0gbmV3IEJ1ZmZlcihibG9ja3NpemUpXG4gIGZvcih2YXIgaSA9IDA7IGkgPCBibG9ja3NpemU7IGkrKykge1xuICAgIGlwYWRbaV0gPSBrZXlbaV0gXiAweDM2XG4gICAgb3BhZFtpXSA9IGtleVtpXSBeIDB4NUNcbiAgfVxuXG4gIHZhciBoYXNoID0gZm4oQnVmZmVyLmNvbmNhdChbaXBhZCwgZGF0YV0pKVxuICByZXR1cm4gZm4oQnVmZmVyLmNvbmNhdChbb3BhZCwgaGFzaF0pKVxufVxuXG5mdW5jdGlvbiBoYXNoKGFsZywga2V5KSB7XG4gIGFsZyA9IGFsZyB8fCAnc2hhMSdcbiAgdmFyIGZuID0gYWxnb3JpdGhtc1thbGddXG4gIHZhciBidWZzID0gW11cbiAgdmFyIGxlbmd0aCA9IDBcbiAgaWYoIWZuKSBlcnJvcignYWxnb3JpdGhtOicsIGFsZywgJ2lzIG5vdCB5ZXQgc3VwcG9ydGVkJylcbiAgcmV0dXJuIHtcbiAgICB1cGRhdGU6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICBpZighQnVmZmVyLmlzQnVmZmVyKGRhdGEpKSBkYXRhID0gbmV3IEJ1ZmZlcihkYXRhKVxuICAgICAgICBcbiAgICAgIGJ1ZnMucHVzaChkYXRhKVxuICAgICAgbGVuZ3RoICs9IGRhdGEubGVuZ3RoXG4gICAgICByZXR1cm4gdGhpc1xuICAgIH0sXG4gICAgZGlnZXN0OiBmdW5jdGlvbiAoZW5jKSB7XG4gICAgICB2YXIgYnVmID0gQnVmZmVyLmNvbmNhdChidWZzKVxuICAgICAgdmFyIHIgPSBrZXkgPyBobWFjKGZuLCBrZXksIGJ1ZikgOiBmbihidWYpXG4gICAgICBidWZzID0gbnVsbFxuICAgICAgcmV0dXJuIGVuYyA/IHIudG9TdHJpbmcoZW5jKSA6IHJcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gZXJyb3IgKCkge1xuICB2YXIgbSA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzKS5qb2luKCcgJylcbiAgdGhyb3cgbmV3IEVycm9yKFtcbiAgICBtLFxuICAgICd3ZSBhY2NlcHQgcHVsbCByZXF1ZXN0cycsXG4gICAgJ2h0dHA6Ly9naXRodWIuY29tL2RvbWluaWN0YXJyL2NyeXB0by1icm93c2VyaWZ5J1xuICAgIF0uam9pbignXFxuJykpXG59XG5cbmV4cG9ydHMuY3JlYXRlSGFzaCA9IGZ1bmN0aW9uIChhbGcpIHsgcmV0dXJuIGhhc2goYWxnKSB9XG5leHBvcnRzLmNyZWF0ZUhtYWMgPSBmdW5jdGlvbiAoYWxnLCBrZXkpIHsgcmV0dXJuIGhhc2goYWxnLCBrZXkpIH1cbmV4cG9ydHMucmFuZG9tQnl0ZXMgPSBmdW5jdGlvbihzaXplLCBjYWxsYmFjaykge1xuICBpZiAoY2FsbGJhY2sgJiYgY2FsbGJhY2suY2FsbCkge1xuICAgIHRyeSB7XG4gICAgICBjYWxsYmFjay5jYWxsKHRoaXMsIHVuZGVmaW5lZCwgbmV3IEJ1ZmZlcihybmcoc2l6ZSkpKVxuICAgIH0gY2F0Y2ggKGVycikgeyBjYWxsYmFjayhlcnIpIH1cbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbmV3IEJ1ZmZlcihybmcoc2l6ZSkpXG4gIH1cbn1cblxuZnVuY3Rpb24gZWFjaChhLCBmKSB7XG4gIGZvcih2YXIgaSBpbiBhKVxuICAgIGYoYVtpXSwgaSlcbn1cblxuLy8gdGhlIGxlYXN0IEkgY2FuIGRvIGlzIG1ha2UgZXJyb3IgbWVzc2FnZXMgZm9yIHRoZSByZXN0IG9mIHRoZSBub2RlLmpzL2NyeXB0byBhcGkuXG5lYWNoKFsnY3JlYXRlQ3JlZGVudGlhbHMnXG4sICdjcmVhdGVDaXBoZXInXG4sICdjcmVhdGVDaXBoZXJpdidcbiwgJ2NyZWF0ZURlY2lwaGVyJ1xuLCAnY3JlYXRlRGVjaXBoZXJpdidcbiwgJ2NyZWF0ZVNpZ24nXG4sICdjcmVhdGVWZXJpZnknXG4sICdjcmVhdGVEaWZmaWVIZWxsbWFuJ1xuLCAncGJrZGYyJ10sIGZ1bmN0aW9uIChuYW1lKSB7XG4gIGV4cG9ydHNbbmFtZV0gPSBmdW5jdGlvbiAoKSB7XG4gICAgZXJyb3IoJ3NvcnJ5LCcsIG5hbWUsICdpcyBub3QgaW1wbGVtZW50ZWQgeWV0JylcbiAgfVxufSlcbiIsIi8qXHJcbiAqIEEgSmF2YVNjcmlwdCBpbXBsZW1lbnRhdGlvbiBvZiB0aGUgUlNBIERhdGEgU2VjdXJpdHksIEluYy4gTUQ1IE1lc3NhZ2VcclxuICogRGlnZXN0IEFsZ29yaXRobSwgYXMgZGVmaW5lZCBpbiBSRkMgMTMyMS5cclxuICogVmVyc2lvbiAyLjEgQ29weXJpZ2h0IChDKSBQYXVsIEpvaG5zdG9uIDE5OTkgLSAyMDAyLlxyXG4gKiBPdGhlciBjb250cmlidXRvcnM6IEdyZWcgSG9sdCwgQW5kcmV3IEtlcGVydCwgWWRuYXIsIExvc3RpbmV0XHJcbiAqIERpc3RyaWJ1dGVkIHVuZGVyIHRoZSBCU0QgTGljZW5zZVxyXG4gKiBTZWUgaHR0cDovL3BhamhvbWUub3JnLnVrL2NyeXB0L21kNSBmb3IgbW9yZSBpbmZvLlxyXG4gKi9cclxuXHJcbnZhciBoZWxwZXJzID0gcmVxdWlyZSgnLi9oZWxwZXJzJyk7XHJcblxyXG4vKlxyXG4gKiBQZXJmb3JtIGEgc2ltcGxlIHNlbGYtdGVzdCB0byBzZWUgaWYgdGhlIFZNIGlzIHdvcmtpbmdcclxuICovXHJcbmZ1bmN0aW9uIG1kNV92bV90ZXN0KClcclxue1xyXG4gIHJldHVybiBoZXhfbWQ1KFwiYWJjXCIpID09IFwiOTAwMTUwOTgzY2QyNGZiMGQ2OTYzZjdkMjhlMTdmNzJcIjtcclxufVxyXG5cclxuLypcclxuICogQ2FsY3VsYXRlIHRoZSBNRDUgb2YgYW4gYXJyYXkgb2YgbGl0dGxlLWVuZGlhbiB3b3JkcywgYW5kIGEgYml0IGxlbmd0aFxyXG4gKi9cclxuZnVuY3Rpb24gY29yZV9tZDUoeCwgbGVuKVxyXG57XHJcbiAgLyogYXBwZW5kIHBhZGRpbmcgKi9cclxuICB4W2xlbiA+PiA1XSB8PSAweDgwIDw8ICgobGVuKSAlIDMyKTtcclxuICB4WygoKGxlbiArIDY0KSA+Pj4gOSkgPDwgNCkgKyAxNF0gPSBsZW47XHJcblxyXG4gIHZhciBhID0gIDE3MzI1ODQxOTM7XHJcbiAgdmFyIGIgPSAtMjcxNzMzODc5O1xyXG4gIHZhciBjID0gLTE3MzI1ODQxOTQ7XHJcbiAgdmFyIGQgPSAgMjcxNzMzODc4O1xyXG5cclxuICBmb3IodmFyIGkgPSAwOyBpIDwgeC5sZW5ndGg7IGkgKz0gMTYpXHJcbiAge1xyXG4gICAgdmFyIG9sZGEgPSBhO1xyXG4gICAgdmFyIG9sZGIgPSBiO1xyXG4gICAgdmFyIG9sZGMgPSBjO1xyXG4gICAgdmFyIG9sZGQgPSBkO1xyXG5cclxuICAgIGEgPSBtZDVfZmYoYSwgYiwgYywgZCwgeFtpKyAwXSwgNyAsIC02ODA4NzY5MzYpO1xyXG4gICAgZCA9IG1kNV9mZihkLCBhLCBiLCBjLCB4W2krIDFdLCAxMiwgLTM4OTU2NDU4Nik7XHJcbiAgICBjID0gbWQ1X2ZmKGMsIGQsIGEsIGIsIHhbaSsgMl0sIDE3LCAgNjA2MTA1ODE5KTtcclxuICAgIGIgPSBtZDVfZmYoYiwgYywgZCwgYSwgeFtpKyAzXSwgMjIsIC0xMDQ0NTI1MzMwKTtcclxuICAgIGEgPSBtZDVfZmYoYSwgYiwgYywgZCwgeFtpKyA0XSwgNyAsIC0xNzY0MTg4OTcpO1xyXG4gICAgZCA9IG1kNV9mZihkLCBhLCBiLCBjLCB4W2krIDVdLCAxMiwgIDEyMDAwODA0MjYpO1xyXG4gICAgYyA9IG1kNV9mZihjLCBkLCBhLCBiLCB4W2krIDZdLCAxNywgLTE0NzMyMzEzNDEpO1xyXG4gICAgYiA9IG1kNV9mZihiLCBjLCBkLCBhLCB4W2krIDddLCAyMiwgLTQ1NzA1OTgzKTtcclxuICAgIGEgPSBtZDVfZmYoYSwgYiwgYywgZCwgeFtpKyA4XSwgNyAsICAxNzcwMDM1NDE2KTtcclxuICAgIGQgPSBtZDVfZmYoZCwgYSwgYiwgYywgeFtpKyA5XSwgMTIsIC0xOTU4NDE0NDE3KTtcclxuICAgIGMgPSBtZDVfZmYoYywgZCwgYSwgYiwgeFtpKzEwXSwgMTcsIC00MjA2Myk7XHJcbiAgICBiID0gbWQ1X2ZmKGIsIGMsIGQsIGEsIHhbaSsxMV0sIDIyLCAtMTk5MDQwNDE2Mik7XHJcbiAgICBhID0gbWQ1X2ZmKGEsIGIsIGMsIGQsIHhbaSsxMl0sIDcgLCAgMTgwNDYwMzY4Mik7XHJcbiAgICBkID0gbWQ1X2ZmKGQsIGEsIGIsIGMsIHhbaSsxM10sIDEyLCAtNDAzNDExMDEpO1xyXG4gICAgYyA9IG1kNV9mZihjLCBkLCBhLCBiLCB4W2krMTRdLCAxNywgLTE1MDIwMDIyOTApO1xyXG4gICAgYiA9IG1kNV9mZihiLCBjLCBkLCBhLCB4W2krMTVdLCAyMiwgIDEyMzY1MzUzMjkpO1xyXG5cclxuICAgIGEgPSBtZDVfZ2coYSwgYiwgYywgZCwgeFtpKyAxXSwgNSAsIC0xNjU3OTY1MTApO1xyXG4gICAgZCA9IG1kNV9nZyhkLCBhLCBiLCBjLCB4W2krIDZdLCA5ICwgLTEwNjk1MDE2MzIpO1xyXG4gICAgYyA9IG1kNV9nZyhjLCBkLCBhLCBiLCB4W2krMTFdLCAxNCwgIDY0MzcxNzcxMyk7XHJcbiAgICBiID0gbWQ1X2dnKGIsIGMsIGQsIGEsIHhbaSsgMF0sIDIwLCAtMzczODk3MzAyKTtcclxuICAgIGEgPSBtZDVfZ2coYSwgYiwgYywgZCwgeFtpKyA1XSwgNSAsIC03MDE1NTg2OTEpO1xyXG4gICAgZCA9IG1kNV9nZyhkLCBhLCBiLCBjLCB4W2krMTBdLCA5ICwgIDM4MDE2MDgzKTtcclxuICAgIGMgPSBtZDVfZ2coYywgZCwgYSwgYiwgeFtpKzE1XSwgMTQsIC02NjA0NzgzMzUpO1xyXG4gICAgYiA9IG1kNV9nZyhiLCBjLCBkLCBhLCB4W2krIDRdLCAyMCwgLTQwNTUzNzg0OCk7XHJcbiAgICBhID0gbWQ1X2dnKGEsIGIsIGMsIGQsIHhbaSsgOV0sIDUgLCAgNTY4NDQ2NDM4KTtcclxuICAgIGQgPSBtZDVfZ2coZCwgYSwgYiwgYywgeFtpKzE0XSwgOSAsIC0xMDE5ODAzNjkwKTtcclxuICAgIGMgPSBtZDVfZ2coYywgZCwgYSwgYiwgeFtpKyAzXSwgMTQsIC0xODczNjM5NjEpO1xyXG4gICAgYiA9IG1kNV9nZyhiLCBjLCBkLCBhLCB4W2krIDhdLCAyMCwgIDExNjM1MzE1MDEpO1xyXG4gICAgYSA9IG1kNV9nZyhhLCBiLCBjLCBkLCB4W2krMTNdLCA1ICwgLTE0NDQ2ODE0NjcpO1xyXG4gICAgZCA9IG1kNV9nZyhkLCBhLCBiLCBjLCB4W2krIDJdLCA5ICwgLTUxNDAzNzg0KTtcclxuICAgIGMgPSBtZDVfZ2coYywgZCwgYSwgYiwgeFtpKyA3XSwgMTQsICAxNzM1MzI4NDczKTtcclxuICAgIGIgPSBtZDVfZ2coYiwgYywgZCwgYSwgeFtpKzEyXSwgMjAsIC0xOTI2NjA3NzM0KTtcclxuXHJcbiAgICBhID0gbWQ1X2hoKGEsIGIsIGMsIGQsIHhbaSsgNV0sIDQgLCAtMzc4NTU4KTtcclxuICAgIGQgPSBtZDVfaGgoZCwgYSwgYiwgYywgeFtpKyA4XSwgMTEsIC0yMDIyNTc0NDYzKTtcclxuICAgIGMgPSBtZDVfaGgoYywgZCwgYSwgYiwgeFtpKzExXSwgMTYsICAxODM5MDMwNTYyKTtcclxuICAgIGIgPSBtZDVfaGgoYiwgYywgZCwgYSwgeFtpKzE0XSwgMjMsIC0zNTMwOTU1Nik7XHJcbiAgICBhID0gbWQ1X2hoKGEsIGIsIGMsIGQsIHhbaSsgMV0sIDQgLCAtMTUzMDk5MjA2MCk7XHJcbiAgICBkID0gbWQ1X2hoKGQsIGEsIGIsIGMsIHhbaSsgNF0sIDExLCAgMTI3Mjg5MzM1Myk7XHJcbiAgICBjID0gbWQ1X2hoKGMsIGQsIGEsIGIsIHhbaSsgN10sIDE2LCAtMTU1NDk3NjMyKTtcclxuICAgIGIgPSBtZDVfaGgoYiwgYywgZCwgYSwgeFtpKzEwXSwgMjMsIC0xMDk0NzMwNjQwKTtcclxuICAgIGEgPSBtZDVfaGgoYSwgYiwgYywgZCwgeFtpKzEzXSwgNCAsICA2ODEyNzkxNzQpO1xyXG4gICAgZCA9IG1kNV9oaChkLCBhLCBiLCBjLCB4W2krIDBdLCAxMSwgLTM1ODUzNzIyMik7XHJcbiAgICBjID0gbWQ1X2hoKGMsIGQsIGEsIGIsIHhbaSsgM10sIDE2LCAtNzIyNTIxOTc5KTtcclxuICAgIGIgPSBtZDVfaGgoYiwgYywgZCwgYSwgeFtpKyA2XSwgMjMsICA3NjAyOTE4OSk7XHJcbiAgICBhID0gbWQ1X2hoKGEsIGIsIGMsIGQsIHhbaSsgOV0sIDQgLCAtNjQwMzY0NDg3KTtcclxuICAgIGQgPSBtZDVfaGgoZCwgYSwgYiwgYywgeFtpKzEyXSwgMTEsIC00MjE4MTU4MzUpO1xyXG4gICAgYyA9IG1kNV9oaChjLCBkLCBhLCBiLCB4W2krMTVdLCAxNiwgIDUzMDc0MjUyMCk7XHJcbiAgICBiID0gbWQ1X2hoKGIsIGMsIGQsIGEsIHhbaSsgMl0sIDIzLCAtOTk1MzM4NjUxKTtcclxuXHJcbiAgICBhID0gbWQ1X2lpKGEsIGIsIGMsIGQsIHhbaSsgMF0sIDYgLCAtMTk4NjMwODQ0KTtcclxuICAgIGQgPSBtZDVfaWkoZCwgYSwgYiwgYywgeFtpKyA3XSwgMTAsICAxMTI2ODkxNDE1KTtcclxuICAgIGMgPSBtZDVfaWkoYywgZCwgYSwgYiwgeFtpKzE0XSwgMTUsIC0xNDE2MzU0OTA1KTtcclxuICAgIGIgPSBtZDVfaWkoYiwgYywgZCwgYSwgeFtpKyA1XSwgMjEsIC01NzQzNDA1NSk7XHJcbiAgICBhID0gbWQ1X2lpKGEsIGIsIGMsIGQsIHhbaSsxMl0sIDYgLCAgMTcwMDQ4NTU3MSk7XHJcbiAgICBkID0gbWQ1X2lpKGQsIGEsIGIsIGMsIHhbaSsgM10sIDEwLCAtMTg5NDk4NjYwNik7XHJcbiAgICBjID0gbWQ1X2lpKGMsIGQsIGEsIGIsIHhbaSsxMF0sIDE1LCAtMTA1MTUyMyk7XHJcbiAgICBiID0gbWQ1X2lpKGIsIGMsIGQsIGEsIHhbaSsgMV0sIDIxLCAtMjA1NDkyMjc5OSk7XHJcbiAgICBhID0gbWQ1X2lpKGEsIGIsIGMsIGQsIHhbaSsgOF0sIDYgLCAgMTg3MzMxMzM1OSk7XHJcbiAgICBkID0gbWQ1X2lpKGQsIGEsIGIsIGMsIHhbaSsxNV0sIDEwLCAtMzA2MTE3NDQpO1xyXG4gICAgYyA9IG1kNV9paShjLCBkLCBhLCBiLCB4W2krIDZdLCAxNSwgLTE1NjAxOTgzODApO1xyXG4gICAgYiA9IG1kNV9paShiLCBjLCBkLCBhLCB4W2krMTNdLCAyMSwgIDEzMDkxNTE2NDkpO1xyXG4gICAgYSA9IG1kNV9paShhLCBiLCBjLCBkLCB4W2krIDRdLCA2ICwgLTE0NTUyMzA3MCk7XHJcbiAgICBkID0gbWQ1X2lpKGQsIGEsIGIsIGMsIHhbaSsxMV0sIDEwLCAtMTEyMDIxMDM3OSk7XHJcbiAgICBjID0gbWQ1X2lpKGMsIGQsIGEsIGIsIHhbaSsgMl0sIDE1LCAgNzE4Nzg3MjU5KTtcclxuICAgIGIgPSBtZDVfaWkoYiwgYywgZCwgYSwgeFtpKyA5XSwgMjEsIC0zNDM0ODU1NTEpO1xyXG5cclxuICAgIGEgPSBzYWZlX2FkZChhLCBvbGRhKTtcclxuICAgIGIgPSBzYWZlX2FkZChiLCBvbGRiKTtcclxuICAgIGMgPSBzYWZlX2FkZChjLCBvbGRjKTtcclxuICAgIGQgPSBzYWZlX2FkZChkLCBvbGRkKTtcclxuICB9XHJcbiAgcmV0dXJuIEFycmF5KGEsIGIsIGMsIGQpO1xyXG5cclxufVxyXG5cclxuLypcclxuICogVGhlc2UgZnVuY3Rpb25zIGltcGxlbWVudCB0aGUgZm91ciBiYXNpYyBvcGVyYXRpb25zIHRoZSBhbGdvcml0aG0gdXNlcy5cclxuICovXHJcbmZ1bmN0aW9uIG1kNV9jbW4ocSwgYSwgYiwgeCwgcywgdClcclxue1xyXG4gIHJldHVybiBzYWZlX2FkZChiaXRfcm9sKHNhZmVfYWRkKHNhZmVfYWRkKGEsIHEpLCBzYWZlX2FkZCh4LCB0KSksIHMpLGIpO1xyXG59XHJcbmZ1bmN0aW9uIG1kNV9mZihhLCBiLCBjLCBkLCB4LCBzLCB0KVxyXG57XHJcbiAgcmV0dXJuIG1kNV9jbW4oKGIgJiBjKSB8ICgofmIpICYgZCksIGEsIGIsIHgsIHMsIHQpO1xyXG59XHJcbmZ1bmN0aW9uIG1kNV9nZyhhLCBiLCBjLCBkLCB4LCBzLCB0KVxyXG57XHJcbiAgcmV0dXJuIG1kNV9jbW4oKGIgJiBkKSB8IChjICYgKH5kKSksIGEsIGIsIHgsIHMsIHQpO1xyXG59XHJcbmZ1bmN0aW9uIG1kNV9oaChhLCBiLCBjLCBkLCB4LCBzLCB0KVxyXG57XHJcbiAgcmV0dXJuIG1kNV9jbW4oYiBeIGMgXiBkLCBhLCBiLCB4LCBzLCB0KTtcclxufVxyXG5mdW5jdGlvbiBtZDVfaWkoYSwgYiwgYywgZCwgeCwgcywgdClcclxue1xyXG4gIHJldHVybiBtZDVfY21uKGMgXiAoYiB8ICh+ZCkpLCBhLCBiLCB4LCBzLCB0KTtcclxufVxyXG5cclxuLypcclxuICogQWRkIGludGVnZXJzLCB3cmFwcGluZyBhdCAyXjMyLiBUaGlzIHVzZXMgMTYtYml0IG9wZXJhdGlvbnMgaW50ZXJuYWxseVxyXG4gKiB0byB3b3JrIGFyb3VuZCBidWdzIGluIHNvbWUgSlMgaW50ZXJwcmV0ZXJzLlxyXG4gKi9cclxuZnVuY3Rpb24gc2FmZV9hZGQoeCwgeSlcclxue1xyXG4gIHZhciBsc3cgPSAoeCAmIDB4RkZGRikgKyAoeSAmIDB4RkZGRik7XHJcbiAgdmFyIG1zdyA9ICh4ID4+IDE2KSArICh5ID4+IDE2KSArIChsc3cgPj4gMTYpO1xyXG4gIHJldHVybiAobXN3IDw8IDE2KSB8IChsc3cgJiAweEZGRkYpO1xyXG59XHJcblxyXG4vKlxyXG4gKiBCaXR3aXNlIHJvdGF0ZSBhIDMyLWJpdCBudW1iZXIgdG8gdGhlIGxlZnQuXHJcbiAqL1xyXG5mdW5jdGlvbiBiaXRfcm9sKG51bSwgY250KVxyXG57XHJcbiAgcmV0dXJuIChudW0gPDwgY250KSB8IChudW0gPj4+ICgzMiAtIGNudCkpO1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIG1kNShidWYpIHtcclxuICByZXR1cm4gaGVscGVycy5oYXNoKGJ1ZiwgY29yZV9tZDUsIDE2KTtcclxufTtcclxuIiwiLy8gT3JpZ2luYWwgY29kZSBhZGFwdGVkIGZyb20gUm9iZXJ0IEtpZWZmZXIuXG4vLyBkZXRhaWxzIGF0IGh0dHBzOi8vZ2l0aHViLmNvbS9icm9vZmEvbm9kZS11dWlkXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBfZ2xvYmFsID0gdGhpcztcblxuICB2YXIgbWF0aFJORywgd2hhdHdnUk5HO1xuXG4gIC8vIE5PVEU6IE1hdGgucmFuZG9tKCkgZG9lcyBub3QgZ3VhcmFudGVlIFwiY3J5cHRvZ3JhcGhpYyBxdWFsaXR5XCJcbiAgbWF0aFJORyA9IGZ1bmN0aW9uKHNpemUpIHtcbiAgICB2YXIgYnl0ZXMgPSBuZXcgQXJyYXkoc2l6ZSk7XG4gICAgdmFyIHI7XG5cbiAgICBmb3IgKHZhciBpID0gMCwgcjsgaSA8IHNpemU7IGkrKykge1xuICAgICAgaWYgKChpICYgMHgwMykgPT0gMCkgciA9IE1hdGgucmFuZG9tKCkgKiAweDEwMDAwMDAwMDtcbiAgICAgIGJ5dGVzW2ldID0gciA+Pj4gKChpICYgMHgwMykgPDwgMykgJiAweGZmO1xuICAgIH1cblxuICAgIHJldHVybiBieXRlcztcbiAgfVxuXG4gIGlmIChfZ2xvYmFsLmNyeXB0byAmJiBjcnlwdG8uZ2V0UmFuZG9tVmFsdWVzKSB7XG4gICAgd2hhdHdnUk5HID0gZnVuY3Rpb24oc2l6ZSkge1xuICAgICAgdmFyIGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkoc2l6ZSk7XG4gICAgICBjcnlwdG8uZ2V0UmFuZG9tVmFsdWVzKGJ5dGVzKTtcbiAgICAgIHJldHVybiBieXRlcztcbiAgICB9XG4gIH1cblxuICBtb2R1bGUuZXhwb3J0cyA9IHdoYXR3Z1JORyB8fCBtYXRoUk5HO1xuXG59KCkpXG4iLCIvKlxuICogQSBKYXZhU2NyaXB0IGltcGxlbWVudGF0aW9uIG9mIHRoZSBTZWN1cmUgSGFzaCBBbGdvcml0aG0sIFNIQS0xLCBhcyBkZWZpbmVkXG4gKiBpbiBGSVBTIFBVQiAxODAtMVxuICogVmVyc2lvbiAyLjFhIENvcHlyaWdodCBQYXVsIEpvaG5zdG9uIDIwMDAgLSAyMDAyLlxuICogT3RoZXIgY29udHJpYnV0b3JzOiBHcmVnIEhvbHQsIEFuZHJldyBLZXBlcnQsIFlkbmFyLCBMb3N0aW5ldFxuICogRGlzdHJpYnV0ZWQgdW5kZXIgdGhlIEJTRCBMaWNlbnNlXG4gKiBTZWUgaHR0cDovL3BhamhvbWUub3JnLnVrL2NyeXB0L21kNSBmb3IgZGV0YWlscy5cbiAqL1xuXG52YXIgaGVscGVycyA9IHJlcXVpcmUoJy4vaGVscGVycycpO1xuXG4vKlxuICogQ2FsY3VsYXRlIHRoZSBTSEEtMSBvZiBhbiBhcnJheSBvZiBiaWctZW5kaWFuIHdvcmRzLCBhbmQgYSBiaXQgbGVuZ3RoXG4gKi9cbmZ1bmN0aW9uIGNvcmVfc2hhMSh4LCBsZW4pXG57XG4gIC8qIGFwcGVuZCBwYWRkaW5nICovXG4gIHhbbGVuID4+IDVdIHw9IDB4ODAgPDwgKDI0IC0gbGVuICUgMzIpO1xuICB4WygobGVuICsgNjQgPj4gOSkgPDwgNCkgKyAxNV0gPSBsZW47XG5cbiAgdmFyIHcgPSBBcnJheSg4MCk7XG4gIHZhciBhID0gIDE3MzI1ODQxOTM7XG4gIHZhciBiID0gLTI3MTczMzg3OTtcbiAgdmFyIGMgPSAtMTczMjU4NDE5NDtcbiAgdmFyIGQgPSAgMjcxNzMzODc4O1xuICB2YXIgZSA9IC0xMDA5NTg5Nzc2O1xuXG4gIGZvcih2YXIgaSA9IDA7IGkgPCB4Lmxlbmd0aDsgaSArPSAxNilcbiAge1xuICAgIHZhciBvbGRhID0gYTtcbiAgICB2YXIgb2xkYiA9IGI7XG4gICAgdmFyIG9sZGMgPSBjO1xuICAgIHZhciBvbGRkID0gZDtcbiAgICB2YXIgb2xkZSA9IGU7XG5cbiAgICBmb3IodmFyIGogPSAwOyBqIDwgODA7IGorKylcbiAgICB7XG4gICAgICBpZihqIDwgMTYpIHdbal0gPSB4W2kgKyBqXTtcbiAgICAgIGVsc2Ugd1tqXSA9IHJvbCh3W2otM10gXiB3W2otOF0gXiB3W2otMTRdIF4gd1tqLTE2XSwgMSk7XG4gICAgICB2YXIgdCA9IHNhZmVfYWRkKHNhZmVfYWRkKHJvbChhLCA1KSwgc2hhMV9mdChqLCBiLCBjLCBkKSksXG4gICAgICAgICAgICAgICAgICAgICAgIHNhZmVfYWRkKHNhZmVfYWRkKGUsIHdbal0pLCBzaGExX2t0KGopKSk7XG4gICAgICBlID0gZDtcbiAgICAgIGQgPSBjO1xuICAgICAgYyA9IHJvbChiLCAzMCk7XG4gICAgICBiID0gYTtcbiAgICAgIGEgPSB0O1xuICAgIH1cblxuICAgIGEgPSBzYWZlX2FkZChhLCBvbGRhKTtcbiAgICBiID0gc2FmZV9hZGQoYiwgb2xkYik7XG4gICAgYyA9IHNhZmVfYWRkKGMsIG9sZGMpO1xuICAgIGQgPSBzYWZlX2FkZChkLCBvbGRkKTtcbiAgICBlID0gc2FmZV9hZGQoZSwgb2xkZSk7XG4gIH1cbiAgcmV0dXJuIEFycmF5KGEsIGIsIGMsIGQsIGUpO1xuXG59XG5cbi8qXG4gKiBQZXJmb3JtIHRoZSBhcHByb3ByaWF0ZSB0cmlwbGV0IGNvbWJpbmF0aW9uIGZ1bmN0aW9uIGZvciB0aGUgY3VycmVudFxuICogaXRlcmF0aW9uXG4gKi9cbmZ1bmN0aW9uIHNoYTFfZnQodCwgYiwgYywgZClcbntcbiAgaWYodCA8IDIwKSByZXR1cm4gKGIgJiBjKSB8ICgofmIpICYgZCk7XG4gIGlmKHQgPCA0MCkgcmV0dXJuIGIgXiBjIF4gZDtcbiAgaWYodCA8IDYwKSByZXR1cm4gKGIgJiBjKSB8IChiICYgZCkgfCAoYyAmIGQpO1xuICByZXR1cm4gYiBeIGMgXiBkO1xufVxuXG4vKlxuICogRGV0ZXJtaW5lIHRoZSBhcHByb3ByaWF0ZSBhZGRpdGl2ZSBjb25zdGFudCBmb3IgdGhlIGN1cnJlbnQgaXRlcmF0aW9uXG4gKi9cbmZ1bmN0aW9uIHNoYTFfa3QodClcbntcbiAgcmV0dXJuICh0IDwgMjApID8gIDE1MTg1MDAyNDkgOiAodCA8IDQwKSA/ICAxODU5Nzc1MzkzIDpcbiAgICAgICAgICh0IDwgNjApID8gLTE4OTQwMDc1ODggOiAtODk5NDk3NTE0O1xufVxuXG4vKlxuICogQWRkIGludGVnZXJzLCB3cmFwcGluZyBhdCAyXjMyLiBUaGlzIHVzZXMgMTYtYml0IG9wZXJhdGlvbnMgaW50ZXJuYWxseVxuICogdG8gd29yayBhcm91bmQgYnVncyBpbiBzb21lIEpTIGludGVycHJldGVycy5cbiAqL1xuZnVuY3Rpb24gc2FmZV9hZGQoeCwgeSlcbntcbiAgdmFyIGxzdyA9ICh4ICYgMHhGRkZGKSArICh5ICYgMHhGRkZGKTtcbiAgdmFyIG1zdyA9ICh4ID4+IDE2KSArICh5ID4+IDE2KSArIChsc3cgPj4gMTYpO1xuICByZXR1cm4gKG1zdyA8PCAxNikgfCAobHN3ICYgMHhGRkZGKTtcbn1cblxuLypcbiAqIEJpdHdpc2Ugcm90YXRlIGEgMzItYml0IG51bWJlciB0byB0aGUgbGVmdC5cbiAqL1xuZnVuY3Rpb24gcm9sKG51bSwgY250KVxue1xuICByZXR1cm4gKG51bSA8PCBjbnQpIHwgKG51bSA+Pj4gKDMyIC0gY250KSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gc2hhMShidWYpIHtcbiAgcmV0dXJuIGhlbHBlcnMuaGFzaChidWYsIGNvcmVfc2hhMSwgMjAsIHRydWUpO1xufTtcbiIsIlxuLyoqXG4gKiBBIEphdmFTY3JpcHQgaW1wbGVtZW50YXRpb24gb2YgdGhlIFNlY3VyZSBIYXNoIEFsZ29yaXRobSwgU0hBLTI1NiwgYXMgZGVmaW5lZFxuICogaW4gRklQUyAxODAtMlxuICogVmVyc2lvbiAyLjItYmV0YSBDb3B5cmlnaHQgQW5nZWwgTWFyaW4sIFBhdWwgSm9obnN0b24gMjAwMCAtIDIwMDkuXG4gKiBPdGhlciBjb250cmlidXRvcnM6IEdyZWcgSG9sdCwgQW5kcmV3IEtlcGVydCwgWWRuYXIsIExvc3RpbmV0XG4gKlxuICovXG5cbnZhciBoZWxwZXJzID0gcmVxdWlyZSgnLi9oZWxwZXJzJyk7XG5cbnZhciBzYWZlX2FkZCA9IGZ1bmN0aW9uKHgsIHkpIHtcbiAgdmFyIGxzdyA9ICh4ICYgMHhGRkZGKSArICh5ICYgMHhGRkZGKTtcbiAgdmFyIG1zdyA9ICh4ID4+IDE2KSArICh5ID4+IDE2KSArIChsc3cgPj4gMTYpO1xuICByZXR1cm4gKG1zdyA8PCAxNikgfCAobHN3ICYgMHhGRkZGKTtcbn07XG5cbnZhciBTID0gZnVuY3Rpb24oWCwgbikge1xuICByZXR1cm4gKFggPj4+IG4pIHwgKFggPDwgKDMyIC0gbikpO1xufTtcblxudmFyIFIgPSBmdW5jdGlvbihYLCBuKSB7XG4gIHJldHVybiAoWCA+Pj4gbik7XG59O1xuXG52YXIgQ2ggPSBmdW5jdGlvbih4LCB5LCB6KSB7XG4gIHJldHVybiAoKHggJiB5KSBeICgofngpICYgeikpO1xufTtcblxudmFyIE1haiA9IGZ1bmN0aW9uKHgsIHksIHopIHtcbiAgcmV0dXJuICgoeCAmIHkpIF4gKHggJiB6KSBeICh5ICYgeikpO1xufTtcblxudmFyIFNpZ21hMDI1NiA9IGZ1bmN0aW9uKHgpIHtcbiAgcmV0dXJuIChTKHgsIDIpIF4gUyh4LCAxMykgXiBTKHgsIDIyKSk7XG59O1xuXG52YXIgU2lnbWExMjU2ID0gZnVuY3Rpb24oeCkge1xuICByZXR1cm4gKFMoeCwgNikgXiBTKHgsIDExKSBeIFMoeCwgMjUpKTtcbn07XG5cbnZhciBHYW1tYTAyNTYgPSBmdW5jdGlvbih4KSB7XG4gIHJldHVybiAoUyh4LCA3KSBeIFMoeCwgMTgpIF4gUih4LCAzKSk7XG59O1xuXG52YXIgR2FtbWExMjU2ID0gZnVuY3Rpb24oeCkge1xuICByZXR1cm4gKFMoeCwgMTcpIF4gUyh4LCAxOSkgXiBSKHgsIDEwKSk7XG59O1xuXG52YXIgY29yZV9zaGEyNTYgPSBmdW5jdGlvbihtLCBsKSB7XG4gIHZhciBLID0gbmV3IEFycmF5KDB4NDI4QTJGOTgsMHg3MTM3NDQ5MSwweEI1QzBGQkNGLDB4RTlCNURCQTUsMHgzOTU2QzI1QiwweDU5RjExMUYxLDB4OTIzRjgyQTQsMHhBQjFDNUVENSwweEQ4MDdBQTk4LDB4MTI4MzVCMDEsMHgyNDMxODVCRSwweDU1MEM3REMzLDB4NzJCRTVENzQsMHg4MERFQjFGRSwweDlCREMwNkE3LDB4QzE5QkYxNzQsMHhFNDlCNjlDMSwweEVGQkU0Nzg2LDB4RkMxOURDNiwweDI0MENBMUNDLDB4MkRFOTJDNkYsMHg0QTc0ODRBQSwweDVDQjBBOURDLDB4NzZGOTg4REEsMHg5ODNFNTE1MiwweEE4MzFDNjZELDB4QjAwMzI3QzgsMHhCRjU5N0ZDNywweEM2RTAwQkYzLDB4RDVBNzkxNDcsMHg2Q0E2MzUxLDB4MTQyOTI5NjcsMHgyN0I3MEE4NSwweDJFMUIyMTM4LDB4NEQyQzZERkMsMHg1MzM4MEQxMywweDY1MEE3MzU0LDB4NzY2QTBBQkIsMHg4MUMyQzkyRSwweDkyNzIyQzg1LDB4QTJCRkU4QTEsMHhBODFBNjY0QiwweEMyNEI4QjcwLDB4Qzc2QzUxQTMsMHhEMTkyRTgxOSwweEQ2OTkwNjI0LDB4RjQwRTM1ODUsMHgxMDZBQTA3MCwweDE5QTRDMTE2LDB4MUUzNzZDMDgsMHgyNzQ4Nzc0QywweDM0QjBCQ0I1LDB4MzkxQzBDQjMsMHg0RUQ4QUE0QSwweDVCOUNDQTRGLDB4NjgyRTZGRjMsMHg3NDhGODJFRSwweDc4QTU2MzZGLDB4ODRDODc4MTQsMHg4Q0M3MDIwOCwweDkwQkVGRkZBLDB4QTQ1MDZDRUIsMHhCRUY5QTNGNywweEM2NzE3OEYyKTtcbiAgdmFyIEhBU0ggPSBuZXcgQXJyYXkoMHg2QTA5RTY2NywgMHhCQjY3QUU4NSwgMHgzQzZFRjM3MiwgMHhBNTRGRjUzQSwgMHg1MTBFNTI3RiwgMHg5QjA1Njg4QywgMHgxRjgzRDlBQiwgMHg1QkUwQ0QxOSk7XG4gICAgdmFyIFcgPSBuZXcgQXJyYXkoNjQpO1xuICAgIHZhciBhLCBiLCBjLCBkLCBlLCBmLCBnLCBoLCBpLCBqO1xuICAgIHZhciBUMSwgVDI7XG4gIC8qIGFwcGVuZCBwYWRkaW5nICovXG4gIG1bbCA+PiA1XSB8PSAweDgwIDw8ICgyNCAtIGwgJSAzMik7XG4gIG1bKChsICsgNjQgPj4gOSkgPDwgNCkgKyAxNV0gPSBsO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IG0ubGVuZ3RoOyBpICs9IDE2KSB7XG4gICAgYSA9IEhBU0hbMF07IGIgPSBIQVNIWzFdOyBjID0gSEFTSFsyXTsgZCA9IEhBU0hbM107IGUgPSBIQVNIWzRdOyBmID0gSEFTSFs1XTsgZyA9IEhBU0hbNl07IGggPSBIQVNIWzddO1xuICAgIGZvciAodmFyIGogPSAwOyBqIDwgNjQ7IGorKykge1xuICAgICAgaWYgKGogPCAxNikge1xuICAgICAgICBXW2pdID0gbVtqICsgaV07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBXW2pdID0gc2FmZV9hZGQoc2FmZV9hZGQoc2FmZV9hZGQoR2FtbWExMjU2KFdbaiAtIDJdKSwgV1tqIC0gN10pLCBHYW1tYTAyNTYoV1tqIC0gMTVdKSksIFdbaiAtIDE2XSk7XG4gICAgICB9XG4gICAgICBUMSA9IHNhZmVfYWRkKHNhZmVfYWRkKHNhZmVfYWRkKHNhZmVfYWRkKGgsIFNpZ21hMTI1NihlKSksIENoKGUsIGYsIGcpKSwgS1tqXSksIFdbal0pO1xuICAgICAgVDIgPSBzYWZlX2FkZChTaWdtYTAyNTYoYSksIE1haihhLCBiLCBjKSk7XG4gICAgICBoID0gZzsgZyA9IGY7IGYgPSBlOyBlID0gc2FmZV9hZGQoZCwgVDEpOyBkID0gYzsgYyA9IGI7IGIgPSBhOyBhID0gc2FmZV9hZGQoVDEsIFQyKTtcbiAgICB9XG4gICAgSEFTSFswXSA9IHNhZmVfYWRkKGEsIEhBU0hbMF0pOyBIQVNIWzFdID0gc2FmZV9hZGQoYiwgSEFTSFsxXSk7IEhBU0hbMl0gPSBzYWZlX2FkZChjLCBIQVNIWzJdKTsgSEFTSFszXSA9IHNhZmVfYWRkKGQsIEhBU0hbM10pO1xuICAgIEhBU0hbNF0gPSBzYWZlX2FkZChlLCBIQVNIWzRdKTsgSEFTSFs1XSA9IHNhZmVfYWRkKGYsIEhBU0hbNV0pOyBIQVNIWzZdID0gc2FmZV9hZGQoZywgSEFTSFs2XSk7IEhBU0hbN10gPSBzYWZlX2FkZChoLCBIQVNIWzddKTtcbiAgfVxuICByZXR1cm4gSEFTSDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gc2hhMjU2KGJ1Zikge1xuICByZXR1cm4gaGVscGVycy5oYXNoKGJ1ZiwgY29yZV9zaGEyNTYsIDMyLCB0cnVlKTtcbn07XG4iLCIvLyEgbW9tZW50LmpzXG4vLyEgdmVyc2lvbiA6IDIuMTAuMlxuLy8hIGF1dGhvcnMgOiBUaW0gV29vZCwgSXNrcmVuIENoZXJuZXYsIE1vbWVudC5qcyBjb250cmlidXRvcnNcbi8vISBsaWNlbnNlIDogTUlUXG4vLyEgbW9tZW50anMuY29tXG5cbihmdW5jdGlvbiAoZ2xvYmFsLCBmYWN0b3J5KSB7XG4gICAgdHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnICYmIHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnID8gbW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KCkgOlxuICAgIHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCA/IGRlZmluZShmYWN0b3J5KSA6XG4gICAgZ2xvYmFsLm1vbWVudCA9IGZhY3RvcnkoKVxufSh0aGlzLCBmdW5jdGlvbiAoKSB7ICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBob29rQ2FsbGJhY2s7XG5cbiAgICBmdW5jdGlvbiB1dGlsc19ob29rc19faG9va3MgKCkge1xuICAgICAgICByZXR1cm4gaG9va0NhbGxiYWNrLmFwcGx5KG51bGwsIGFyZ3VtZW50cyk7XG4gICAgfVxuXG4gICAgLy8gVGhpcyBpcyBkb25lIHRvIHJlZ2lzdGVyIHRoZSBtZXRob2QgY2FsbGVkIHdpdGggbW9tZW50KClcbiAgICAvLyB3aXRob3V0IGNyZWF0aW5nIGNpcmN1bGFyIGRlcGVuZGVuY2llcy5cbiAgICBmdW5jdGlvbiBzZXRIb29rQ2FsbGJhY2sgKGNhbGxiYWNrKSB7XG4gICAgICAgIGhvb2tDYWxsYmFjayA9IGNhbGxiYWNrO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRlZmF1bHRQYXJzaW5nRmxhZ3MoKSB7XG4gICAgICAgIC8vIFdlIG5lZWQgdG8gZGVlcCBjbG9uZSB0aGlzIG9iamVjdC5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGVtcHR5ICAgICAgICAgICA6IGZhbHNlLFxuICAgICAgICAgICAgdW51c2VkVG9rZW5zICAgIDogW10sXG4gICAgICAgICAgICB1bnVzZWRJbnB1dCAgICAgOiBbXSxcbiAgICAgICAgICAgIG92ZXJmbG93ICAgICAgICA6IC0yLFxuICAgICAgICAgICAgY2hhcnNMZWZ0T3ZlciAgIDogMCxcbiAgICAgICAgICAgIG51bGxJbnB1dCAgICAgICA6IGZhbHNlLFxuICAgICAgICAgICAgaW52YWxpZE1vbnRoICAgIDogbnVsbCxcbiAgICAgICAgICAgIGludmFsaWRGb3JtYXQgICA6IGZhbHNlLFxuICAgICAgICAgICAgdXNlckludmFsaWRhdGVkIDogZmFsc2UsXG4gICAgICAgICAgICBpc28gICAgICAgICAgICAgOiBmYWxzZVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGlzQXJyYXkoaW5wdXQpIHtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChpbnB1dCkgPT09ICdbb2JqZWN0IEFycmF5XSc7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaXNEYXRlKGlucHV0KSB7XG4gICAgICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoaW5wdXQpID09PSAnW29iamVjdCBEYXRlXScgfHwgaW5wdXQgaW5zdGFuY2VvZiBEYXRlO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG1hcChhcnIsIGZuKSB7XG4gICAgICAgIHZhciByZXMgPSBbXSwgaTtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGFyci5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgcmVzLnB1c2goZm4oYXJyW2ldLCBpKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlcztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBoYXNPd25Qcm9wKGEsIGIpIHtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChhLCBiKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBleHRlbmQoYSwgYikge1xuICAgICAgICBmb3IgKHZhciBpIGluIGIpIHtcbiAgICAgICAgICAgIGlmIChoYXNPd25Qcm9wKGIsIGkpKSB7XG4gICAgICAgICAgICAgICAgYVtpXSA9IGJbaV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaGFzT3duUHJvcChiLCAndG9TdHJpbmcnKSkge1xuICAgICAgICAgICAgYS50b1N0cmluZyA9IGIudG9TdHJpbmc7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaGFzT3duUHJvcChiLCAndmFsdWVPZicpKSB7XG4gICAgICAgICAgICBhLnZhbHVlT2YgPSBiLnZhbHVlT2Y7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjcmVhdGVfdXRjX19jcmVhdGVVVEMgKGlucHV0LCBmb3JtYXQsIGxvY2FsZSwgc3RyaWN0KSB7XG4gICAgICAgIHJldHVybiBjcmVhdGVMb2NhbE9yVVRDKGlucHV0LCBmb3JtYXQsIGxvY2FsZSwgc3RyaWN0LCB0cnVlKS51dGMoKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB2YWxpZF9faXNWYWxpZChtKSB7XG4gICAgICAgIGlmIChtLl9pc1ZhbGlkID09IG51bGwpIHtcbiAgICAgICAgICAgIG0uX2lzVmFsaWQgPSAhaXNOYU4obS5fZC5nZXRUaW1lKCkpICYmXG4gICAgICAgICAgICAgICAgbS5fcGYub3ZlcmZsb3cgPCAwICYmXG4gICAgICAgICAgICAgICAgIW0uX3BmLmVtcHR5ICYmXG4gICAgICAgICAgICAgICAgIW0uX3BmLmludmFsaWRNb250aCAmJlxuICAgICAgICAgICAgICAgICFtLl9wZi5udWxsSW5wdXQgJiZcbiAgICAgICAgICAgICAgICAhbS5fcGYuaW52YWxpZEZvcm1hdCAmJlxuICAgICAgICAgICAgICAgICFtLl9wZi51c2VySW52YWxpZGF0ZWQ7XG5cbiAgICAgICAgICAgIGlmIChtLl9zdHJpY3QpIHtcbiAgICAgICAgICAgICAgICBtLl9pc1ZhbGlkID0gbS5faXNWYWxpZCAmJlxuICAgICAgICAgICAgICAgICAgICBtLl9wZi5jaGFyc0xlZnRPdmVyID09PSAwICYmXG4gICAgICAgICAgICAgICAgICAgIG0uX3BmLnVudXNlZFRva2Vucy5sZW5ndGggPT09IDAgJiZcbiAgICAgICAgICAgICAgICAgICAgbS5fcGYuYmlnSG91ciA9PT0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtLl9pc1ZhbGlkO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHZhbGlkX19jcmVhdGVJbnZhbGlkIChmbGFncykge1xuICAgICAgICB2YXIgbSA9IGNyZWF0ZV91dGNfX2NyZWF0ZVVUQyhOYU4pO1xuICAgICAgICBpZiAoZmxhZ3MgIT0gbnVsbCkge1xuICAgICAgICAgICAgZXh0ZW5kKG0uX3BmLCBmbGFncyk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBtLl9wZi51c2VySW52YWxpZGF0ZWQgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG07XG4gICAgfVxuXG4gICAgdmFyIG1vbWVudFByb3BlcnRpZXMgPSB1dGlsc19ob29rc19faG9va3MubW9tZW50UHJvcGVydGllcyA9IFtdO1xuXG4gICAgZnVuY3Rpb24gY29weUNvbmZpZyh0bywgZnJvbSkge1xuICAgICAgICB2YXIgaSwgcHJvcCwgdmFsO1xuXG4gICAgICAgIGlmICh0eXBlb2YgZnJvbS5faXNBTW9tZW50T2JqZWN0ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgdG8uX2lzQU1vbWVudE9iamVjdCA9IGZyb20uX2lzQU1vbWVudE9iamVjdDtcbiAgICAgICAgfVxuICAgICAgICBpZiAodHlwZW9mIGZyb20uX2kgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICB0by5faSA9IGZyb20uX2k7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHR5cGVvZiBmcm9tLl9mICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgdG8uX2YgPSBmcm9tLl9mO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0eXBlb2YgZnJvbS5fbCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHRvLl9sID0gZnJvbS5fbDtcbiAgICAgICAgfVxuICAgICAgICBpZiAodHlwZW9mIGZyb20uX3N0cmljdCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHRvLl9zdHJpY3QgPSBmcm9tLl9zdHJpY3Q7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHR5cGVvZiBmcm9tLl90em0gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICB0by5fdHptID0gZnJvbS5fdHptO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0eXBlb2YgZnJvbS5faXNVVEMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICB0by5faXNVVEMgPSBmcm9tLl9pc1VUQztcbiAgICAgICAgfVxuICAgICAgICBpZiAodHlwZW9mIGZyb20uX29mZnNldCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHRvLl9vZmZzZXQgPSBmcm9tLl9vZmZzZXQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHR5cGVvZiBmcm9tLl9wZiAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHRvLl9wZiA9IGZyb20uX3BmO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0eXBlb2YgZnJvbS5fbG9jYWxlICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgdG8uX2xvY2FsZSA9IGZyb20uX2xvY2FsZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChtb21lbnRQcm9wZXJ0aWVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGZvciAoaSBpbiBtb21lbnRQcm9wZXJ0aWVzKSB7XG4gICAgICAgICAgICAgICAgcHJvcCA9IG1vbWVudFByb3BlcnRpZXNbaV07XG4gICAgICAgICAgICAgICAgdmFsID0gZnJvbVtwcm9wXTtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHZhbCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICAgICAgdG9bcHJvcF0gPSB2YWw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRvO1xuICAgIH1cblxuICAgIHZhciB1cGRhdGVJblByb2dyZXNzID0gZmFsc2U7XG5cbiAgICAvLyBNb21lbnQgcHJvdG90eXBlIG9iamVjdFxuICAgIGZ1bmN0aW9uIE1vbWVudChjb25maWcpIHtcbiAgICAgICAgY29weUNvbmZpZyh0aGlzLCBjb25maWcpO1xuICAgICAgICB0aGlzLl9kID0gbmV3IERhdGUoK2NvbmZpZy5fZCk7XG4gICAgICAgIC8vIFByZXZlbnQgaW5maW5pdGUgbG9vcCBpbiBjYXNlIHVwZGF0ZU9mZnNldCBjcmVhdGVzIG5ldyBtb21lbnRcbiAgICAgICAgLy8gb2JqZWN0cy5cbiAgICAgICAgaWYgKHVwZGF0ZUluUHJvZ3Jlc3MgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICB1cGRhdGVJblByb2dyZXNzID0gdHJ1ZTtcbiAgICAgICAgICAgIHV0aWxzX2hvb2tzX19ob29rcy51cGRhdGVPZmZzZXQodGhpcyk7XG4gICAgICAgICAgICB1cGRhdGVJblByb2dyZXNzID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpc01vbWVudCAob2JqKSB7XG4gICAgICAgIHJldHVybiBvYmogaW5zdGFuY2VvZiBNb21lbnQgfHwgKG9iaiAhPSBudWxsICYmIGhhc093blByb3Aob2JqLCAnX2lzQU1vbWVudE9iamVjdCcpKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB0b0ludChhcmd1bWVudEZvckNvZXJjaW9uKSB7XG4gICAgICAgIHZhciBjb2VyY2VkTnVtYmVyID0gK2FyZ3VtZW50Rm9yQ29lcmNpb24sXG4gICAgICAgICAgICB2YWx1ZSA9IDA7XG5cbiAgICAgICAgaWYgKGNvZXJjZWROdW1iZXIgIT09IDAgJiYgaXNGaW5pdGUoY29lcmNlZE51bWJlcikpIHtcbiAgICAgICAgICAgIGlmIChjb2VyY2VkTnVtYmVyID49IDApIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IE1hdGguZmxvb3IoY29lcmNlZE51bWJlcik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHZhbHVlID0gTWF0aC5jZWlsKGNvZXJjZWROdW1iZXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNvbXBhcmVBcnJheXMoYXJyYXkxLCBhcnJheTIsIGRvbnRDb252ZXJ0KSB7XG4gICAgICAgIHZhciBsZW4gPSBNYXRoLm1pbihhcnJheTEubGVuZ3RoLCBhcnJheTIubGVuZ3RoKSxcbiAgICAgICAgICAgIGxlbmd0aERpZmYgPSBNYXRoLmFicyhhcnJheTEubGVuZ3RoIC0gYXJyYXkyLmxlbmd0aCksXG4gICAgICAgICAgICBkaWZmcyA9IDAsXG4gICAgICAgICAgICBpO1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGlmICgoZG9udENvbnZlcnQgJiYgYXJyYXkxW2ldICE9PSBhcnJheTJbaV0pIHx8XG4gICAgICAgICAgICAgICAgKCFkb250Q29udmVydCAmJiB0b0ludChhcnJheTFbaV0pICE9PSB0b0ludChhcnJheTJbaV0pKSkge1xuICAgICAgICAgICAgICAgIGRpZmZzKys7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGRpZmZzICsgbGVuZ3RoRGlmZjtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBMb2NhbGUoKSB7XG4gICAgfVxuXG4gICAgdmFyIGxvY2FsZXMgPSB7fTtcbiAgICB2YXIgZ2xvYmFsTG9jYWxlO1xuXG4gICAgZnVuY3Rpb24gbm9ybWFsaXplTG9jYWxlKGtleSkge1xuICAgICAgICByZXR1cm4ga2V5ID8ga2V5LnRvTG93ZXJDYXNlKCkucmVwbGFjZSgnXycsICctJykgOiBrZXk7XG4gICAgfVxuXG4gICAgLy8gcGljayB0aGUgbG9jYWxlIGZyb20gdGhlIGFycmF5XG4gICAgLy8gdHJ5IFsnZW4tYXUnLCAnZW4tZ2InXSBhcyAnZW4tYXUnLCAnZW4tZ2InLCAnZW4nLCBhcyBpbiBtb3ZlIHRocm91Z2ggdGhlIGxpc3QgdHJ5aW5nIGVhY2hcbiAgICAvLyBzdWJzdHJpbmcgZnJvbSBtb3N0IHNwZWNpZmljIHRvIGxlYXN0LCBidXQgbW92ZSB0byB0aGUgbmV4dCBhcnJheSBpdGVtIGlmIGl0J3MgYSBtb3JlIHNwZWNpZmljIHZhcmlhbnQgdGhhbiB0aGUgY3VycmVudCByb290XG4gICAgZnVuY3Rpb24gY2hvb3NlTG9jYWxlKG5hbWVzKSB7XG4gICAgICAgIHZhciBpID0gMCwgaiwgbmV4dCwgbG9jYWxlLCBzcGxpdDtcblxuICAgICAgICB3aGlsZSAoaSA8IG5hbWVzLmxlbmd0aCkge1xuICAgICAgICAgICAgc3BsaXQgPSBub3JtYWxpemVMb2NhbGUobmFtZXNbaV0pLnNwbGl0KCctJyk7XG4gICAgICAgICAgICBqID0gc3BsaXQubGVuZ3RoO1xuICAgICAgICAgICAgbmV4dCA9IG5vcm1hbGl6ZUxvY2FsZShuYW1lc1tpICsgMV0pO1xuICAgICAgICAgICAgbmV4dCA9IG5leHQgPyBuZXh0LnNwbGl0KCctJykgOiBudWxsO1xuICAgICAgICAgICAgd2hpbGUgKGogPiAwKSB7XG4gICAgICAgICAgICAgICAgbG9jYWxlID0gbG9hZExvY2FsZShzcGxpdC5zbGljZSgwLCBqKS5qb2luKCctJykpO1xuICAgICAgICAgICAgICAgIGlmIChsb2NhbGUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGxvY2FsZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG5leHQgJiYgbmV4dC5sZW5ndGggPj0gaiAmJiBjb21wYXJlQXJyYXlzKHNwbGl0LCBuZXh0LCB0cnVlKSA+PSBqIC0gMSkge1xuICAgICAgICAgICAgICAgICAgICAvL3RoZSBuZXh0IGFycmF5IGl0ZW0gaXMgYmV0dGVyIHRoYW4gYSBzaGFsbG93ZXIgc3Vic3RyaW5nIG9mIHRoaXMgb25lXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBqLS07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpKys7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbG9hZExvY2FsZShuYW1lKSB7XG4gICAgICAgIHZhciBvbGRMb2NhbGUgPSBudWxsO1xuICAgICAgICAvLyBUT0RPOiBGaW5kIGEgYmV0dGVyIHdheSB0byByZWdpc3RlciBhbmQgbG9hZCBhbGwgdGhlIGxvY2FsZXMgaW4gTm9kZVxuICAgICAgICBpZiAoIWxvY2FsZXNbbmFtZV0gJiYgdHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiZcbiAgICAgICAgICAgICAgICBtb2R1bGUgJiYgbW9kdWxlLmV4cG9ydHMpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgb2xkTG9jYWxlID0gZ2xvYmFsTG9jYWxlLl9hYmJyO1xuICAgICAgICAgICAgICAgIHJlcXVpcmUoJy4vbG9jYWxlLycgKyBuYW1lKTtcbiAgICAgICAgICAgICAgICAvLyBiZWNhdXNlIGRlZmluZUxvY2FsZSBjdXJyZW50bHkgYWxzbyBzZXRzIHRoZSBnbG9iYWwgbG9jYWxlLCB3ZVxuICAgICAgICAgICAgICAgIC8vIHdhbnQgdG8gdW5kbyB0aGF0IGZvciBsYXp5IGxvYWRlZCBsb2NhbGVzXG4gICAgICAgICAgICAgICAgbG9jYWxlX2xvY2FsZXNfX2dldFNldEdsb2JhbExvY2FsZShvbGRMb2NhbGUpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZSkgeyB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGxvY2FsZXNbbmFtZV07XG4gICAgfVxuXG4gICAgLy8gVGhpcyBmdW5jdGlvbiB3aWxsIGxvYWQgbG9jYWxlIGFuZCB0aGVuIHNldCB0aGUgZ2xvYmFsIGxvY2FsZS4gIElmXG4gICAgLy8gbm8gYXJndW1lbnRzIGFyZSBwYXNzZWQgaW4sIGl0IHdpbGwgc2ltcGx5IHJldHVybiB0aGUgY3VycmVudCBnbG9iYWxcbiAgICAvLyBsb2NhbGUga2V5LlxuICAgIGZ1bmN0aW9uIGxvY2FsZV9sb2NhbGVzX19nZXRTZXRHbG9iYWxMb2NhbGUgKGtleSwgdmFsdWVzKSB7XG4gICAgICAgIHZhciBkYXRhO1xuICAgICAgICBpZiAoa2V5KSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlcyA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICBkYXRhID0gbG9jYWxlX2xvY2FsZXNfX2dldExvY2FsZShrZXkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgZGF0YSA9IGRlZmluZUxvY2FsZShrZXksIHZhbHVlcyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgLy8gbW9tZW50LmR1cmF0aW9uLl9sb2NhbGUgPSBtb21lbnQuX2xvY2FsZSA9IGRhdGE7XG4gICAgICAgICAgICAgICAgZ2xvYmFsTG9jYWxlID0gZGF0YTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBnbG9iYWxMb2NhbGUuX2FiYnI7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGVmaW5lTG9jYWxlIChuYW1lLCB2YWx1ZXMpIHtcbiAgICAgICAgaWYgKHZhbHVlcyAhPT0gbnVsbCkge1xuICAgICAgICAgICAgdmFsdWVzLmFiYnIgPSBuYW1lO1xuICAgICAgICAgICAgaWYgKCFsb2NhbGVzW25hbWVdKSB7XG4gICAgICAgICAgICAgICAgbG9jYWxlc1tuYW1lXSA9IG5ldyBMb2NhbGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxvY2FsZXNbbmFtZV0uc2V0KHZhbHVlcyk7XG5cbiAgICAgICAgICAgIC8vIGJhY2t3YXJkcyBjb21wYXQgZm9yIG5vdzogYWxzbyBzZXQgdGhlIGxvY2FsZVxuICAgICAgICAgICAgbG9jYWxlX2xvY2FsZXNfX2dldFNldEdsb2JhbExvY2FsZShuYW1lKTtcblxuICAgICAgICAgICAgcmV0dXJuIGxvY2FsZXNbbmFtZV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyB1c2VmdWwgZm9yIHRlc3RpbmdcbiAgICAgICAgICAgIGRlbGV0ZSBsb2NhbGVzW25hbWVdO1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyByZXR1cm5zIGxvY2FsZSBkYXRhXG4gICAgZnVuY3Rpb24gbG9jYWxlX2xvY2FsZXNfX2dldExvY2FsZSAoa2V5KSB7XG4gICAgICAgIHZhciBsb2NhbGU7XG5cbiAgICAgICAgaWYgKGtleSAmJiBrZXkuX2xvY2FsZSAmJiBrZXkuX2xvY2FsZS5fYWJicikge1xuICAgICAgICAgICAga2V5ID0ga2V5Ll9sb2NhbGUuX2FiYnI7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWtleSkge1xuICAgICAgICAgICAgcmV0dXJuIGdsb2JhbExvY2FsZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghaXNBcnJheShrZXkpKSB7XG4gICAgICAgICAgICAvL3Nob3J0LWNpcmN1aXQgZXZlcnl0aGluZyBlbHNlXG4gICAgICAgICAgICBsb2NhbGUgPSBsb2FkTG9jYWxlKGtleSk7XG4gICAgICAgICAgICBpZiAobG9jYWxlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGxvY2FsZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGtleSA9IFtrZXldO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNob29zZUxvY2FsZShrZXkpO1xuICAgIH1cblxuICAgIHZhciBhbGlhc2VzID0ge307XG5cbiAgICBmdW5jdGlvbiBhZGRVbml0QWxpYXMgKHVuaXQsIHNob3J0aGFuZCkge1xuICAgICAgICB2YXIgbG93ZXJDYXNlID0gdW5pdC50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBhbGlhc2VzW2xvd2VyQ2FzZV0gPSBhbGlhc2VzW2xvd2VyQ2FzZSArICdzJ10gPSBhbGlhc2VzW3Nob3J0aGFuZF0gPSB1bml0O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG5vcm1hbGl6ZVVuaXRzKHVuaXRzKSB7XG4gICAgICAgIHJldHVybiB0eXBlb2YgdW5pdHMgPT09ICdzdHJpbmcnID8gYWxpYXNlc1t1bml0c10gfHwgYWxpYXNlc1t1bml0cy50b0xvd2VyQ2FzZSgpXSA6IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBub3JtYWxpemVPYmplY3RVbml0cyhpbnB1dE9iamVjdCkge1xuICAgICAgICB2YXIgbm9ybWFsaXplZElucHV0ID0ge30sXG4gICAgICAgICAgICBub3JtYWxpemVkUHJvcCxcbiAgICAgICAgICAgIHByb3A7XG5cbiAgICAgICAgZm9yIChwcm9wIGluIGlucHV0T2JqZWN0KSB7XG4gICAgICAgICAgICBpZiAoaGFzT3duUHJvcChpbnB1dE9iamVjdCwgcHJvcCkpIHtcbiAgICAgICAgICAgICAgICBub3JtYWxpemVkUHJvcCA9IG5vcm1hbGl6ZVVuaXRzKHByb3ApO1xuICAgICAgICAgICAgICAgIGlmIChub3JtYWxpemVkUHJvcCkge1xuICAgICAgICAgICAgICAgICAgICBub3JtYWxpemVkSW5wdXRbbm9ybWFsaXplZFByb3BdID0gaW5wdXRPYmplY3RbcHJvcF07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5vcm1hbGl6ZWRJbnB1dDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBtYWtlR2V0U2V0ICh1bml0LCBrZWVwVGltZSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICBpZiAodmFsdWUgIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGdldF9zZXRfX3NldCh0aGlzLCB1bml0LCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgdXRpbHNfaG9va3NfX2hvb2tzLnVwZGF0ZU9mZnNldCh0aGlzLCBrZWVwVGltZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBnZXRfc2V0X19nZXQodGhpcywgdW5pdCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0X3NldF9fZ2V0IChtb20sIHVuaXQpIHtcbiAgICAgICAgcmV0dXJuIG1vbS5fZFsnZ2V0JyArIChtb20uX2lzVVRDID8gJ1VUQycgOiAnJykgKyB1bml0XSgpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldF9zZXRfX3NldCAobW9tLCB1bml0LCB2YWx1ZSkge1xuICAgICAgICByZXR1cm4gbW9tLl9kWydzZXQnICsgKG1vbS5faXNVVEMgPyAnVVRDJyA6ICcnKSArIHVuaXRdKHZhbHVlKTtcbiAgICB9XG5cbiAgICAvLyBNT01FTlRTXG5cbiAgICBmdW5jdGlvbiBnZXRTZXQgKHVuaXRzLCB2YWx1ZSkge1xuICAgICAgICB2YXIgdW5pdDtcbiAgICAgICAgaWYgKHR5cGVvZiB1bml0cyA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIGZvciAodW5pdCBpbiB1bml0cykge1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0KHVuaXQsIHVuaXRzW3VuaXRdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHVuaXRzID0gbm9ybWFsaXplVW5pdHModW5pdHMpO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB0aGlzW3VuaXRzXSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzW3VuaXRzXSh2YWx1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gemVyb0ZpbGwobnVtYmVyLCB0YXJnZXRMZW5ndGgsIGZvcmNlU2lnbikge1xuICAgICAgICB2YXIgb3V0cHV0ID0gJycgKyBNYXRoLmFicyhudW1iZXIpLFxuICAgICAgICAgICAgc2lnbiA9IG51bWJlciA+PSAwO1xuXG4gICAgICAgIHdoaWxlIChvdXRwdXQubGVuZ3RoIDwgdGFyZ2V0TGVuZ3RoKSB7XG4gICAgICAgICAgICBvdXRwdXQgPSAnMCcgKyBvdXRwdXQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIChzaWduID8gKGZvcmNlU2lnbiA/ICcrJyA6ICcnKSA6ICctJykgKyBvdXRwdXQ7XG4gICAgfVxuXG4gICAgdmFyIGZvcm1hdHRpbmdUb2tlbnMgPSAvKFxcW1teXFxbXSpcXF0pfChcXFxcKT8oTW98TU0/TT9NP3xEb3xERERvfEREP0Q/RD98ZGRkP2Q/fGRvP3x3W298d10/fFdbb3xXXT98UXxZWVlZWVl8WVlZWVl8WVlZWXxZWXxnZyhnZ2c/KT98R0coR0dHPyk/fGV8RXxhfEF8aGg/fEhIP3xtbT98c3M/fFN7MSw0fXx4fFh8eno/fFpaP3wuKS9nO1xuXG4gICAgdmFyIGxvY2FsRm9ybWF0dGluZ1Rva2VucyA9IC8oXFxbW15cXFtdKlxcXSl8KFxcXFwpPyhMVFN8TFR8TEw/TD9MP3xsezEsNH0pL2c7XG5cbiAgICB2YXIgZm9ybWF0RnVuY3Rpb25zID0ge307XG5cbiAgICB2YXIgZm9ybWF0VG9rZW5GdW5jdGlvbnMgPSB7fTtcblxuICAgIC8vIHRva2VuOiAgICAnTSdcbiAgICAvLyBwYWRkZWQ6ICAgWydNTScsIDJdXG4gICAgLy8gb3JkaW5hbDogICdNbydcbiAgICAvLyBjYWxsYmFjazogZnVuY3Rpb24gKCkgeyB0aGlzLm1vbnRoKCkgKyAxIH1cbiAgICBmdW5jdGlvbiBhZGRGb3JtYXRUb2tlbiAodG9rZW4sIHBhZGRlZCwgb3JkaW5hbCwgY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIGZ1bmMgPSBjYWxsYmFjaztcbiAgICAgICAgaWYgKHR5cGVvZiBjYWxsYmFjayA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIGZ1bmMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXNbY2FsbGJhY2tdKCk7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIGlmICh0b2tlbikge1xuICAgICAgICAgICAgZm9ybWF0VG9rZW5GdW5jdGlvbnNbdG9rZW5dID0gZnVuYztcbiAgICAgICAgfVxuICAgICAgICBpZiAocGFkZGVkKSB7XG4gICAgICAgICAgICBmb3JtYXRUb2tlbkZ1bmN0aW9uc1twYWRkZWRbMF1dID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB6ZXJvRmlsbChmdW5jLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyksIHBhZGRlZFsxXSwgcGFkZGVkWzJdKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9yZGluYWwpIHtcbiAgICAgICAgICAgIGZvcm1hdFRva2VuRnVuY3Rpb25zW29yZGluYWxdID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmxvY2FsZURhdGEoKS5vcmRpbmFsKGZ1bmMuYXBwbHkodGhpcywgYXJndW1lbnRzKSwgdG9rZW4pO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHJlbW92ZUZvcm1hdHRpbmdUb2tlbnMoaW5wdXQpIHtcbiAgICAgICAgaWYgKGlucHV0Lm1hdGNoKC9cXFtbXFxzXFxTXS8pKSB7XG4gICAgICAgICAgICByZXR1cm4gaW5wdXQucmVwbGFjZSgvXlxcW3xcXF0kL2csICcnKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gaW5wdXQucmVwbGFjZSgvXFxcXC9nLCAnJyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbWFrZUZvcm1hdEZ1bmN0aW9uKGZvcm1hdCkge1xuICAgICAgICB2YXIgYXJyYXkgPSBmb3JtYXQubWF0Y2goZm9ybWF0dGluZ1Rva2VucyksIGksIGxlbmd0aDtcblxuICAgICAgICBmb3IgKGkgPSAwLCBsZW5ndGggPSBhcnJheS5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKGZvcm1hdFRva2VuRnVuY3Rpb25zW2FycmF5W2ldXSkge1xuICAgICAgICAgICAgICAgIGFycmF5W2ldID0gZm9ybWF0VG9rZW5GdW5jdGlvbnNbYXJyYXlbaV1dO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBhcnJheVtpXSA9IHJlbW92ZUZvcm1hdHRpbmdUb2tlbnMoYXJyYXlbaV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChtb20pIHtcbiAgICAgICAgICAgIHZhciBvdXRwdXQgPSAnJztcbiAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIG91dHB1dCArPSBhcnJheVtpXSBpbnN0YW5jZW9mIEZ1bmN0aW9uID8gYXJyYXlbaV0uY2FsbChtb20sIGZvcm1hdCkgOiBhcnJheVtpXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gZm9ybWF0IGRhdGUgdXNpbmcgbmF0aXZlIGRhdGUgb2JqZWN0XG4gICAgZnVuY3Rpb24gZm9ybWF0TW9tZW50KG0sIGZvcm1hdCkge1xuICAgICAgICBpZiAoIW0uaXNWYWxpZCgpKSB7XG4gICAgICAgICAgICByZXR1cm4gbS5sb2NhbGVEYXRhKCkuaW52YWxpZERhdGUoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvcm1hdCA9IGV4cGFuZEZvcm1hdChmb3JtYXQsIG0ubG9jYWxlRGF0YSgpKTtcblxuICAgICAgICBpZiAoIWZvcm1hdEZ1bmN0aW9uc1tmb3JtYXRdKSB7XG4gICAgICAgICAgICBmb3JtYXRGdW5jdGlvbnNbZm9ybWF0XSA9IG1ha2VGb3JtYXRGdW5jdGlvbihmb3JtYXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZvcm1hdEZ1bmN0aW9uc1tmb3JtYXRdKG0pO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGV4cGFuZEZvcm1hdChmb3JtYXQsIGxvY2FsZSkge1xuICAgICAgICB2YXIgaSA9IDU7XG5cbiAgICAgICAgZnVuY3Rpb24gcmVwbGFjZUxvbmdEYXRlRm9ybWF0VG9rZW5zKGlucHV0KSB7XG4gICAgICAgICAgICByZXR1cm4gbG9jYWxlLmxvbmdEYXRlRm9ybWF0KGlucHV0KSB8fCBpbnB1dDtcbiAgICAgICAgfVxuXG4gICAgICAgIGxvY2FsRm9ybWF0dGluZ1Rva2Vucy5sYXN0SW5kZXggPSAwO1xuICAgICAgICB3aGlsZSAoaSA+PSAwICYmIGxvY2FsRm9ybWF0dGluZ1Rva2Vucy50ZXN0KGZvcm1hdCkpIHtcbiAgICAgICAgICAgIGZvcm1hdCA9IGZvcm1hdC5yZXBsYWNlKGxvY2FsRm9ybWF0dGluZ1Rva2VucywgcmVwbGFjZUxvbmdEYXRlRm9ybWF0VG9rZW5zKTtcbiAgICAgICAgICAgIGxvY2FsRm9ybWF0dGluZ1Rva2Vucy5sYXN0SW5kZXggPSAwO1xuICAgICAgICAgICAgaSAtPSAxO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZvcm1hdDtcbiAgICB9XG5cbiAgICB2YXIgbWF0Y2gxICAgICAgICAgPSAvXFxkLzsgICAgICAgICAgICAvLyAgICAgICAwIC0gOVxuICAgIHZhciBtYXRjaDIgICAgICAgICA9IC9cXGRcXGQvOyAgICAgICAgICAvLyAgICAgIDAwIC0gOTlcbiAgICB2YXIgbWF0Y2gzICAgICAgICAgPSAvXFxkezN9LzsgICAgICAgICAvLyAgICAgMDAwIC0gOTk5XG4gICAgdmFyIG1hdGNoNCAgICAgICAgID0gL1xcZHs0fS87ICAgICAgICAgLy8gICAgMDAwMCAtIDk5OTlcbiAgICB2YXIgbWF0Y2g2ICAgICAgICAgPSAvWystXT9cXGR7Nn0vOyAgICAvLyAtOTk5OTk5IC0gOTk5OTk5XG4gICAgdmFyIG1hdGNoMXRvMiAgICAgID0gL1xcZFxcZD8vOyAgICAgICAgIC8vICAgICAgIDAgLSA5OVxuICAgIHZhciBtYXRjaDF0bzMgICAgICA9IC9cXGR7MSwzfS87ICAgICAgIC8vICAgICAgIDAgLSA5OTlcbiAgICB2YXIgbWF0Y2gxdG80ICAgICAgPSAvXFxkezEsNH0vOyAgICAgICAvLyAgICAgICAwIC0gOTk5OVxuICAgIHZhciBtYXRjaDF0bzYgICAgICA9IC9bKy1dP1xcZHsxLDZ9LzsgIC8vIC05OTk5OTkgLSA5OTk5OTlcblxuICAgIHZhciBtYXRjaFVuc2lnbmVkICA9IC9cXGQrLzsgICAgICAgICAgIC8vICAgICAgIDAgLSBpbmZcbiAgICB2YXIgbWF0Y2hTaWduZWQgICAgPSAvWystXT9cXGQrLzsgICAgICAvLyAgICAtaW5mIC0gaW5mXG5cbiAgICB2YXIgbWF0Y2hPZmZzZXQgICAgPSAvWnxbKy1dXFxkXFxkOj9cXGRcXGQvZ2k7IC8vICswMDowMCAtMDA6MDAgKzAwMDAgLTAwMDAgb3IgWlxuXG4gICAgdmFyIG1hdGNoVGltZXN0YW1wID0gL1srLV0/XFxkKyhcXC5cXGR7MSwzfSk/LzsgLy8gMTIzNDU2Nzg5IDEyMzQ1Njc4OS4xMjNcblxuICAgIC8vIGFueSB3b3JkIChvciB0d28pIGNoYXJhY3RlcnMgb3IgbnVtYmVycyBpbmNsdWRpbmcgdHdvL3RocmVlIHdvcmQgbW9udGggaW4gYXJhYmljLlxuICAgIHZhciBtYXRjaFdvcmQgPSAvWzAtOV0qWydhLXpcXHUwMEEwLVxcdTA1RkZcXHUwNzAwLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRUZdK3xbXFx1MDYwMC1cXHUwNkZGXFwvXSsoXFxzKj9bXFx1MDYwMC1cXHUwNkZGXSspezEsMn0vaTtcblxuICAgIHZhciByZWdleGVzID0ge307XG5cbiAgICBmdW5jdGlvbiBhZGRSZWdleFRva2VuICh0b2tlbiwgcmVnZXgsIHN0cmljdFJlZ2V4KSB7XG4gICAgICAgIHJlZ2V4ZXNbdG9rZW5dID0gdHlwZW9mIHJlZ2V4ID09PSAnZnVuY3Rpb24nID8gcmVnZXggOiBmdW5jdGlvbiAoaXNTdHJpY3QpIHtcbiAgICAgICAgICAgIHJldHVybiAoaXNTdHJpY3QgJiYgc3RyaWN0UmVnZXgpID8gc3RyaWN0UmVnZXggOiByZWdleDtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRQYXJzZVJlZ2V4Rm9yVG9rZW4gKHRva2VuLCBjb25maWcpIHtcbiAgICAgICAgaWYgKCFoYXNPd25Qcm9wKHJlZ2V4ZXMsIHRva2VuKSkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBSZWdFeHAodW5lc2NhcGVGb3JtYXQodG9rZW4pKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZWdleGVzW3Rva2VuXShjb25maWcuX3N0cmljdCwgY29uZmlnLl9sb2NhbGUpO1xuICAgIH1cblxuICAgIC8vIENvZGUgZnJvbSBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzM1NjE0OTMvaXMtdGhlcmUtYS1yZWdleHAtZXNjYXBlLWZ1bmN0aW9uLWluLWphdmFzY3JpcHRcbiAgICBmdW5jdGlvbiB1bmVzY2FwZUZvcm1hdChzKSB7XG4gICAgICAgIHJldHVybiBzLnJlcGxhY2UoJ1xcXFwnLCAnJykucmVwbGFjZSgvXFxcXChcXFspfFxcXFwoXFxdKXxcXFsoW15cXF1cXFtdKilcXF18XFxcXCguKS9nLCBmdW5jdGlvbiAobWF0Y2hlZCwgcDEsIHAyLCBwMywgcDQpIHtcbiAgICAgICAgICAgIHJldHVybiBwMSB8fCBwMiB8fCBwMyB8fCBwNDtcbiAgICAgICAgfSkucmVwbGFjZSgvWy1cXC9cXFxcXiQqKz8uKCl8W1xcXXt9XS9nLCAnXFxcXCQmJyk7XG4gICAgfVxuXG4gICAgdmFyIHRva2VucyA9IHt9O1xuXG4gICAgZnVuY3Rpb24gYWRkUGFyc2VUb2tlbiAodG9rZW4sIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBpLCBmdW5jID0gY2FsbGJhY2s7XG4gICAgICAgIGlmICh0eXBlb2YgdG9rZW4gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICB0b2tlbiA9IFt0b2tlbl07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHR5cGVvZiBjYWxsYmFjayA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIGZ1bmMgPSBmdW5jdGlvbiAoaW5wdXQsIGFycmF5KSB7XG4gICAgICAgICAgICAgICAgYXJyYXlbY2FsbGJhY2tdID0gdG9JbnQoaW5wdXQpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdG9rZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRva2Vuc1t0b2tlbltpXV0gPSBmdW5jO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWRkV2Vla1BhcnNlVG9rZW4gKHRva2VuLCBjYWxsYmFjaykge1xuICAgICAgICBhZGRQYXJzZVRva2VuKHRva2VuLCBmdW5jdGlvbiAoaW5wdXQsIGFycmF5LCBjb25maWcsIHRva2VuKSB7XG4gICAgICAgICAgICBjb25maWcuX3cgPSBjb25maWcuX3cgfHwge307XG4gICAgICAgICAgICBjYWxsYmFjayhpbnB1dCwgY29uZmlnLl93LCBjb25maWcsIHRva2VuKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWRkVGltZVRvQXJyYXlGcm9tVG9rZW4odG9rZW4sIGlucHV0LCBjb25maWcpIHtcbiAgICAgICAgaWYgKGlucHV0ICE9IG51bGwgJiYgaGFzT3duUHJvcCh0b2tlbnMsIHRva2VuKSkge1xuICAgICAgICAgICAgdG9rZW5zW3Rva2VuXShpbnB1dCwgY29uZmlnLl9hLCBjb25maWcsIHRva2VuKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHZhciBZRUFSID0gMDtcbiAgICB2YXIgTU9OVEggPSAxO1xuICAgIHZhciBEQVRFID0gMjtcbiAgICB2YXIgSE9VUiA9IDM7XG4gICAgdmFyIE1JTlVURSA9IDQ7XG4gICAgdmFyIFNFQ09ORCA9IDU7XG4gICAgdmFyIE1JTExJU0VDT05EID0gNjtcblxuICAgIGZ1bmN0aW9uIGRheXNJbk1vbnRoKHllYXIsIG1vbnRoKSB7XG4gICAgICAgIHJldHVybiBuZXcgRGF0ZShEYXRlLlVUQyh5ZWFyLCBtb250aCArIDEsIDApKS5nZXRVVENEYXRlKCk7XG4gICAgfVxuXG4gICAgLy8gRk9STUFUVElOR1xuXG4gICAgYWRkRm9ybWF0VG9rZW4oJ00nLCBbJ01NJywgMl0sICdNbycsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubW9udGgoKSArIDE7XG4gICAgfSk7XG5cbiAgICBhZGRGb3JtYXRUb2tlbignTU1NJywgMCwgMCwgZnVuY3Rpb24gKGZvcm1hdCkge1xuICAgICAgICByZXR1cm4gdGhpcy5sb2NhbGVEYXRhKCkubW9udGhzU2hvcnQodGhpcywgZm9ybWF0KTtcbiAgICB9KTtcblxuICAgIGFkZEZvcm1hdFRva2VuKCdNTU1NJywgMCwgMCwgZnVuY3Rpb24gKGZvcm1hdCkge1xuICAgICAgICByZXR1cm4gdGhpcy5sb2NhbGVEYXRhKCkubW9udGhzKHRoaXMsIGZvcm1hdCk7XG4gICAgfSk7XG5cbiAgICAvLyBBTElBU0VTXG5cbiAgICBhZGRVbml0QWxpYXMoJ21vbnRoJywgJ00nKTtcblxuICAgIC8vIFBBUlNJTkdcblxuICAgIGFkZFJlZ2V4VG9rZW4oJ00nLCAgICBtYXRjaDF0bzIpO1xuICAgIGFkZFJlZ2V4VG9rZW4oJ01NJywgICBtYXRjaDF0bzIsIG1hdGNoMik7XG4gICAgYWRkUmVnZXhUb2tlbignTU1NJywgIG1hdGNoV29yZCk7XG4gICAgYWRkUmVnZXhUb2tlbignTU1NTScsIG1hdGNoV29yZCk7XG5cbiAgICBhZGRQYXJzZVRva2VuKFsnTScsICdNTSddLCBmdW5jdGlvbiAoaW5wdXQsIGFycmF5KSB7XG4gICAgICAgIGFycmF5W01PTlRIXSA9IHRvSW50KGlucHV0KSAtIDE7XG4gICAgfSk7XG5cbiAgICBhZGRQYXJzZVRva2VuKFsnTU1NJywgJ01NTU0nXSwgZnVuY3Rpb24gKGlucHV0LCBhcnJheSwgY29uZmlnLCB0b2tlbikge1xuICAgICAgICB2YXIgbW9udGggPSBjb25maWcuX2xvY2FsZS5tb250aHNQYXJzZShpbnB1dCwgdG9rZW4sIGNvbmZpZy5fc3RyaWN0KTtcbiAgICAgICAgLy8gaWYgd2UgZGlkbid0IGZpbmQgYSBtb250aCBuYW1lLCBtYXJrIHRoZSBkYXRlIGFzIGludmFsaWQuXG4gICAgICAgIGlmIChtb250aCAhPSBudWxsKSB7XG4gICAgICAgICAgICBhcnJheVtNT05USF0gPSBtb250aDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbmZpZy5fcGYuaW52YWxpZE1vbnRoID0gaW5wdXQ7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIExPQ0FMRVNcblxuICAgIHZhciBkZWZhdWx0TG9jYWxlTW9udGhzID0gJ0phbnVhcnlfRmVicnVhcnlfTWFyY2hfQXByaWxfTWF5X0p1bmVfSnVseV9BdWd1c3RfU2VwdGVtYmVyX09jdG9iZXJfTm92ZW1iZXJfRGVjZW1iZXInLnNwbGl0KCdfJyk7XG4gICAgZnVuY3Rpb24gbG9jYWxlTW9udGhzIChtKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tb250aHNbbS5tb250aCgpXTtcbiAgICB9XG5cbiAgICB2YXIgZGVmYXVsdExvY2FsZU1vbnRoc1Nob3J0ID0gJ0phbl9GZWJfTWFyX0Fwcl9NYXlfSnVuX0p1bF9BdWdfU2VwX09jdF9Ob3ZfRGVjJy5zcGxpdCgnXycpO1xuICAgIGZ1bmN0aW9uIGxvY2FsZU1vbnRoc1Nob3J0IChtKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tb250aHNTaG9ydFttLm1vbnRoKCldO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxvY2FsZU1vbnRoc1BhcnNlIChtb250aE5hbWUsIGZvcm1hdCwgc3RyaWN0KSB7XG4gICAgICAgIHZhciBpLCBtb20sIHJlZ2V4O1xuXG4gICAgICAgIGlmICghdGhpcy5fbW9udGhzUGFyc2UpIHtcbiAgICAgICAgICAgIHRoaXMuX21vbnRoc1BhcnNlID0gW107XG4gICAgICAgICAgICB0aGlzLl9sb25nTW9udGhzUGFyc2UgPSBbXTtcbiAgICAgICAgICAgIHRoaXMuX3Nob3J0TW9udGhzUGFyc2UgPSBbXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCAxMjsgaSsrKSB7XG4gICAgICAgICAgICAvLyBtYWtlIHRoZSByZWdleCBpZiB3ZSBkb24ndCBoYXZlIGl0IGFscmVhZHlcbiAgICAgICAgICAgIG1vbSA9IGNyZWF0ZV91dGNfX2NyZWF0ZVVUQyhbMjAwMCwgaV0pO1xuICAgICAgICAgICAgaWYgKHN0cmljdCAmJiAhdGhpcy5fbG9uZ01vbnRoc1BhcnNlW2ldKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbG9uZ01vbnRoc1BhcnNlW2ldID0gbmV3IFJlZ0V4cCgnXicgKyB0aGlzLm1vbnRocyhtb20sICcnKS5yZXBsYWNlKCcuJywgJycpICsgJyQnLCAnaScpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3Nob3J0TW9udGhzUGFyc2VbaV0gPSBuZXcgUmVnRXhwKCdeJyArIHRoaXMubW9udGhzU2hvcnQobW9tLCAnJykucmVwbGFjZSgnLicsICcnKSArICckJywgJ2knKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghc3RyaWN0ICYmICF0aGlzLl9tb250aHNQYXJzZVtpXSkge1xuICAgICAgICAgICAgICAgIHJlZ2V4ID0gJ14nICsgdGhpcy5tb250aHMobW9tLCAnJykgKyAnfF4nICsgdGhpcy5tb250aHNTaG9ydChtb20sICcnKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9tb250aHNQYXJzZVtpXSA9IG5ldyBSZWdFeHAocmVnZXgucmVwbGFjZSgnLicsICcnKSwgJ2knKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIHRlc3QgdGhlIHJlZ2V4XG4gICAgICAgICAgICBpZiAoc3RyaWN0ICYmIGZvcm1hdCA9PT0gJ01NTU0nICYmIHRoaXMuX2xvbmdNb250aHNQYXJzZVtpXS50ZXN0KG1vbnRoTmFtZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gaTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoc3RyaWN0ICYmIGZvcm1hdCA9PT0gJ01NTScgJiYgdGhpcy5fc2hvcnRNb250aHNQYXJzZVtpXS50ZXN0KG1vbnRoTmFtZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gaTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIXN0cmljdCAmJiB0aGlzLl9tb250aHNQYXJzZVtpXS50ZXN0KG1vbnRoTmFtZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gaTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIE1PTUVOVFNcblxuICAgIGZ1bmN0aW9uIHNldE1vbnRoIChtb20sIHZhbHVlKSB7XG4gICAgICAgIHZhciBkYXlPZk1vbnRoO1xuXG4gICAgICAgIC8vIFRPRE86IE1vdmUgdGhpcyBvdXQgb2YgaGVyZSFcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHZhbHVlID0gbW9tLmxvY2FsZURhdGEoKS5tb250aHNQYXJzZSh2YWx1ZSk7XG4gICAgICAgICAgICAvLyBUT0RPOiBBbm90aGVyIHNpbGVudCBmYWlsdXJlP1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbW9tO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZGF5T2ZNb250aCA9IE1hdGgubWluKG1vbS5kYXRlKCksIGRheXNJbk1vbnRoKG1vbS55ZWFyKCksIHZhbHVlKSk7XG4gICAgICAgIG1vbS5fZFsnc2V0JyArIChtb20uX2lzVVRDID8gJ1VUQycgOiAnJykgKyAnTW9udGgnXSh2YWx1ZSwgZGF5T2ZNb250aCk7XG4gICAgICAgIHJldHVybiBtb207XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0U2V0TW9udGggKHZhbHVlKSB7XG4gICAgICAgIGlmICh2YWx1ZSAhPSBudWxsKSB7XG4gICAgICAgICAgICBzZXRNb250aCh0aGlzLCB2YWx1ZSk7XG4gICAgICAgICAgICB1dGlsc19ob29rc19faG9va3MudXBkYXRlT2Zmc2V0KHRoaXMsIHRydWUpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gZ2V0X3NldF9fZ2V0KHRoaXMsICdNb250aCcpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0RGF5c0luTW9udGggKCkge1xuICAgICAgICByZXR1cm4gZGF5c0luTW9udGgodGhpcy55ZWFyKCksIHRoaXMubW9udGgoKSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY2hlY2tPdmVyZmxvdyAobSkge1xuICAgICAgICB2YXIgb3ZlcmZsb3c7XG4gICAgICAgIHZhciBhID0gbS5fYTtcblxuICAgICAgICBpZiAoYSAmJiBtLl9wZi5vdmVyZmxvdyA9PT0gLTIpIHtcbiAgICAgICAgICAgIG92ZXJmbG93ID1cbiAgICAgICAgICAgICAgICBhW01PTlRIXSAgICAgICA8IDAgfHwgYVtNT05USF0gICAgICAgPiAxMSAgPyBNT05USCA6XG4gICAgICAgICAgICAgICAgYVtEQVRFXSAgICAgICAgPCAxIHx8IGFbREFURV0gICAgICAgID4gZGF5c0luTW9udGgoYVtZRUFSXSwgYVtNT05USF0pID8gREFURSA6XG4gICAgICAgICAgICAgICAgYVtIT1VSXSAgICAgICAgPCAwIHx8IGFbSE9VUl0gICAgICAgID4gMjQgfHwgKGFbSE9VUl0gPT09IDI0ICYmIChhW01JTlVURV0gIT09IDAgfHwgYVtTRUNPTkRdICE9PSAwIHx8IGFbTUlMTElTRUNPTkRdICE9PSAwKSkgPyBIT1VSIDpcbiAgICAgICAgICAgICAgICBhW01JTlVURV0gICAgICA8IDAgfHwgYVtNSU5VVEVdICAgICAgPiA1OSAgPyBNSU5VVEUgOlxuICAgICAgICAgICAgICAgIGFbU0VDT05EXSAgICAgIDwgMCB8fCBhW1NFQ09ORF0gICAgICA+IDU5ICA/IFNFQ09ORCA6XG4gICAgICAgICAgICAgICAgYVtNSUxMSVNFQ09ORF0gPCAwIHx8IGFbTUlMTElTRUNPTkRdID4gOTk5ID8gTUlMTElTRUNPTkQgOlxuICAgICAgICAgICAgICAgIC0xO1xuXG4gICAgICAgICAgICBpZiAobS5fcGYuX292ZXJmbG93RGF5T2ZZZWFyICYmIChvdmVyZmxvdyA8IFlFQVIgfHwgb3ZlcmZsb3cgPiBEQVRFKSkge1xuICAgICAgICAgICAgICAgIG92ZXJmbG93ID0gREFURTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbS5fcGYub3ZlcmZsb3cgPSBvdmVyZmxvdztcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBtO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHdhcm4obXNnKSB7XG4gICAgICAgIGlmICh1dGlsc19ob29rc19faG9va3Muc3VwcHJlc3NEZXByZWNhdGlvbldhcm5pbmdzID09PSBmYWxzZSAmJiB0eXBlb2YgY29uc29sZSAhPT0gJ3VuZGVmaW5lZCcgJiYgY29uc29sZS53YXJuKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ0RlcHJlY2F0aW9uIHdhcm5pbmc6ICcgKyBtc2cpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGVwcmVjYXRlKG1zZywgZm4pIHtcbiAgICAgICAgdmFyIGZpcnN0VGltZSA9IHRydWU7XG4gICAgICAgIHJldHVybiBleHRlbmQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKGZpcnN0VGltZSkge1xuICAgICAgICAgICAgICAgIHdhcm4obXNnKTtcbiAgICAgICAgICAgICAgICBmaXJzdFRpbWUgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBmbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICB9LCBmbik7XG4gICAgfVxuXG4gICAgdmFyIGRlcHJlY2F0aW9ucyA9IHt9O1xuXG4gICAgZnVuY3Rpb24gZGVwcmVjYXRlU2ltcGxlKG5hbWUsIG1zZykge1xuICAgICAgICBpZiAoIWRlcHJlY2F0aW9uc1tuYW1lXSkge1xuICAgICAgICAgICAgd2Fybihtc2cpO1xuICAgICAgICAgICAgZGVwcmVjYXRpb25zW25hbWVdID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHV0aWxzX2hvb2tzX19ob29rcy5zdXBwcmVzc0RlcHJlY2F0aW9uV2FybmluZ3MgPSBmYWxzZTtcblxuICAgIHZhciBmcm9tX3N0cmluZ19faXNvUmVnZXggPSAvXlxccyooPzpbKy1dXFxkezZ9fFxcZHs0fSktKD86KFxcZFxcZC1cXGRcXGQpfChXXFxkXFxkJCl8KFdcXGRcXGQtXFxkKXwoXFxkXFxkXFxkKSkoKFR8ICkoXFxkXFxkKDpcXGRcXGQoOlxcZFxcZChcXC5cXGQrKT8pPyk/KT8oW1xcK1xcLV1cXGRcXGQoPzo6P1xcZFxcZCk/fFxccypaKT8pPyQvO1xuXG4gICAgdmFyIGlzb0RhdGVzID0gW1xuICAgICAgICBbJ1lZWVlZWS1NTS1ERCcsIC9bKy1dXFxkezZ9LVxcZHsyfS1cXGR7Mn0vXSxcbiAgICAgICAgWydZWVlZLU1NLUREJywgL1xcZHs0fS1cXGR7Mn0tXFxkezJ9L10sXG4gICAgICAgIFsnR0dHRy1bV11XVy1FJywgL1xcZHs0fS1XXFxkezJ9LVxcZC9dLFxuICAgICAgICBbJ0dHR0ctW1ddV1cnLCAvXFxkezR9LVdcXGR7Mn0vXSxcbiAgICAgICAgWydZWVlZLURERCcsIC9cXGR7NH0tXFxkezN9L11cbiAgICBdO1xuXG4gICAgLy8gaXNvIHRpbWUgZm9ybWF0cyBhbmQgcmVnZXhlc1xuICAgIHZhciBpc29UaW1lcyA9IFtcbiAgICAgICAgWydISDptbTpzcy5TU1NTJywgLyhUfCApXFxkXFxkOlxcZFxcZDpcXGRcXGRcXC5cXGQrL10sXG4gICAgICAgIFsnSEg6bW06c3MnLCAvKFR8IClcXGRcXGQ6XFxkXFxkOlxcZFxcZC9dLFxuICAgICAgICBbJ0hIOm1tJywgLyhUfCApXFxkXFxkOlxcZFxcZC9dLFxuICAgICAgICBbJ0hIJywgLyhUfCApXFxkXFxkL11cbiAgICBdO1xuXG4gICAgdmFyIGFzcE5ldEpzb25SZWdleCA9IC9eXFwvP0RhdGVcXCgoXFwtP1xcZCspL2k7XG5cbiAgICAvLyBkYXRlIGZyb20gaXNvIGZvcm1hdFxuICAgIGZ1bmN0aW9uIGNvbmZpZ0Zyb21JU08oY29uZmlnKSB7XG4gICAgICAgIHZhciBpLCBsLFxuICAgICAgICAgICAgc3RyaW5nID0gY29uZmlnLl9pLFxuICAgICAgICAgICAgbWF0Y2ggPSBmcm9tX3N0cmluZ19faXNvUmVnZXguZXhlYyhzdHJpbmcpO1xuXG4gICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgICAgY29uZmlnLl9wZi5pc28gPSB0cnVlO1xuICAgICAgICAgICAgZm9yIChpID0gMCwgbCA9IGlzb0RhdGVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmIChpc29EYXRlc1tpXVsxXS5leGVjKHN0cmluZykpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gbWF0Y2hbNV0gc2hvdWxkIGJlICdUJyBvciB1bmRlZmluZWRcbiAgICAgICAgICAgICAgICAgICAgY29uZmlnLl9mID0gaXNvRGF0ZXNbaV1bMF0gKyAobWF0Y2hbNl0gfHwgJyAnKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9yIChpID0gMCwgbCA9IGlzb1RpbWVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmIChpc29UaW1lc1tpXVsxXS5leGVjKHN0cmluZykpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uZmlnLl9mICs9IGlzb1RpbWVzW2ldWzBdO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc3RyaW5nLm1hdGNoKG1hdGNoT2Zmc2V0KSkge1xuICAgICAgICAgICAgICAgIGNvbmZpZy5fZiArPSAnWic7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25maWdGcm9tU3RyaW5nQW5kRm9ybWF0KGNvbmZpZyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25maWcuX2lzVmFsaWQgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGRhdGUgZnJvbSBpc28gZm9ybWF0IG9yIGZhbGxiYWNrXG4gICAgZnVuY3Rpb24gY29uZmlnRnJvbVN0cmluZyhjb25maWcpIHtcbiAgICAgICAgdmFyIG1hdGNoZWQgPSBhc3BOZXRKc29uUmVnZXguZXhlYyhjb25maWcuX2kpO1xuXG4gICAgICAgIGlmIChtYXRjaGVkICE9PSBudWxsKSB7XG4gICAgICAgICAgICBjb25maWcuX2QgPSBuZXcgRGF0ZSgrbWF0Y2hlZFsxXSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25maWdGcm9tSVNPKGNvbmZpZyk7XG4gICAgICAgIGlmIChjb25maWcuX2lzVmFsaWQgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICBkZWxldGUgY29uZmlnLl9pc1ZhbGlkO1xuICAgICAgICAgICAgdXRpbHNfaG9va3NfX2hvb2tzLmNyZWF0ZUZyb21JbnB1dEZhbGxiYWNrKGNvbmZpZyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1dGlsc19ob29rc19faG9va3MuY3JlYXRlRnJvbUlucHV0RmFsbGJhY2sgPSBkZXByZWNhdGUoXG4gICAgICAgICdtb21lbnQgY29uc3RydWN0aW9uIGZhbGxzIGJhY2sgdG8ganMgRGF0ZS4gVGhpcyBpcyAnICtcbiAgICAgICAgJ2Rpc2NvdXJhZ2VkIGFuZCB3aWxsIGJlIHJlbW92ZWQgaW4gdXBjb21pbmcgbWFqb3IgJyArXG4gICAgICAgICdyZWxlYXNlLiBQbGVhc2UgcmVmZXIgdG8gJyArXG4gICAgICAgICdodHRwczovL2dpdGh1Yi5jb20vbW9tZW50L21vbWVudC9pc3N1ZXMvMTQwNyBmb3IgbW9yZSBpbmZvLicsXG4gICAgICAgIGZ1bmN0aW9uIChjb25maWcpIHtcbiAgICAgICAgICAgIGNvbmZpZy5fZCA9IG5ldyBEYXRlKGNvbmZpZy5faSArIChjb25maWcuX3VzZVVUQyA/ICcgVVRDJyA6ICcnKSk7XG4gICAgICAgIH1cbiAgICApO1xuXG4gICAgZnVuY3Rpb24gY3JlYXRlRGF0ZSAoeSwgbSwgZCwgaCwgTSwgcywgbXMpIHtcbiAgICAgICAgLy9jYW4ndCBqdXN0IGFwcGx5KCkgdG8gY3JlYXRlIGEgZGF0ZTpcbiAgICAgICAgLy9odHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzE4MTM0OC9pbnN0YW50aWF0aW5nLWEtamF2YXNjcmlwdC1vYmplY3QtYnktY2FsbGluZy1wcm90b3R5cGUtY29uc3RydWN0b3ItYXBwbHlcbiAgICAgICAgdmFyIGRhdGUgPSBuZXcgRGF0ZSh5LCBtLCBkLCBoLCBNLCBzLCBtcyk7XG5cbiAgICAgICAgLy90aGUgZGF0ZSBjb25zdHJ1Y3RvciBkb2Vzbid0IGFjY2VwdCB5ZWFycyA8IDE5NzBcbiAgICAgICAgaWYgKHkgPCAxOTcwKSB7XG4gICAgICAgICAgICBkYXRlLnNldEZ1bGxZZWFyKHkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBkYXRlO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNyZWF0ZVVUQ0RhdGUgKHkpIHtcbiAgICAgICAgdmFyIGRhdGUgPSBuZXcgRGF0ZShEYXRlLlVUQy5hcHBseShudWxsLCBhcmd1bWVudHMpKTtcbiAgICAgICAgaWYgKHkgPCAxOTcwKSB7XG4gICAgICAgICAgICBkYXRlLnNldFVUQ0Z1bGxZZWFyKHkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBkYXRlO1xuICAgIH1cblxuICAgIGFkZEZvcm1hdFRva2VuKDAsIFsnWVknLCAyXSwgMCwgZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy55ZWFyKCkgJSAxMDA7XG4gICAgfSk7XG5cbiAgICBhZGRGb3JtYXRUb2tlbigwLCBbJ1lZWVknLCAgIDRdLCAgICAgICAwLCAneWVhcicpO1xuICAgIGFkZEZvcm1hdFRva2VuKDAsIFsnWVlZWVknLCAgNV0sICAgICAgIDAsICd5ZWFyJyk7XG4gICAgYWRkRm9ybWF0VG9rZW4oMCwgWydZWVlZWVknLCA2LCB0cnVlXSwgMCwgJ3llYXInKTtcblxuICAgIC8vIEFMSUFTRVNcblxuICAgIGFkZFVuaXRBbGlhcygneWVhcicsICd5Jyk7XG5cbiAgICAvLyBQQVJTSU5HXG5cbiAgICBhZGRSZWdleFRva2VuKCdZJywgICAgICBtYXRjaFNpZ25lZCk7XG4gICAgYWRkUmVnZXhUb2tlbignWVknLCAgICAgbWF0Y2gxdG8yLCBtYXRjaDIpO1xuICAgIGFkZFJlZ2V4VG9rZW4oJ1lZWVknLCAgIG1hdGNoMXRvNCwgbWF0Y2g0KTtcbiAgICBhZGRSZWdleFRva2VuKCdZWVlZWScsICBtYXRjaDF0bzYsIG1hdGNoNik7XG4gICAgYWRkUmVnZXhUb2tlbignWVlZWVlZJywgbWF0Y2gxdG82LCBtYXRjaDYpO1xuXG4gICAgYWRkUGFyc2VUb2tlbihbJ1lZWVknLCAnWVlZWVknLCAnWVlZWVlZJ10sIFlFQVIpO1xuICAgIGFkZFBhcnNlVG9rZW4oJ1lZJywgZnVuY3Rpb24gKGlucHV0LCBhcnJheSkge1xuICAgICAgICBhcnJheVtZRUFSXSA9IHV0aWxzX2hvb2tzX19ob29rcy5wYXJzZVR3b0RpZ2l0WWVhcihpbnB1dCk7XG4gICAgfSk7XG5cbiAgICAvLyBIRUxQRVJTXG5cbiAgICBmdW5jdGlvbiBkYXlzSW5ZZWFyKHllYXIpIHtcbiAgICAgICAgcmV0dXJuIGlzTGVhcFllYXIoeWVhcikgPyAzNjYgOiAzNjU7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaXNMZWFwWWVhcih5ZWFyKSB7XG4gICAgICAgIHJldHVybiAoeWVhciAlIDQgPT09IDAgJiYgeWVhciAlIDEwMCAhPT0gMCkgfHwgeWVhciAlIDQwMCA9PT0gMDtcbiAgICB9XG5cbiAgICAvLyBIT09LU1xuXG4gICAgdXRpbHNfaG9va3NfX2hvb2tzLnBhcnNlVHdvRGlnaXRZZWFyID0gZnVuY3Rpb24gKGlucHV0KSB7XG4gICAgICAgIHJldHVybiB0b0ludChpbnB1dCkgKyAodG9JbnQoaW5wdXQpID4gNjggPyAxOTAwIDogMjAwMCk7XG4gICAgfTtcblxuICAgIC8vIE1PTUVOVFNcblxuICAgIHZhciBnZXRTZXRZZWFyID0gbWFrZUdldFNldCgnRnVsbFllYXInLCBmYWxzZSk7XG5cbiAgICBmdW5jdGlvbiBnZXRJc0xlYXBZZWFyICgpIHtcbiAgICAgICAgcmV0dXJuIGlzTGVhcFllYXIodGhpcy55ZWFyKCkpO1xuICAgIH1cblxuICAgIGFkZEZvcm1hdFRva2VuKCd3JywgWyd3dycsIDJdLCAnd28nLCAnd2VlaycpO1xuICAgIGFkZEZvcm1hdFRva2VuKCdXJywgWydXVycsIDJdLCAnV28nLCAnaXNvV2VlaycpO1xuXG4gICAgLy8gQUxJQVNFU1xuXG4gICAgYWRkVW5pdEFsaWFzKCd3ZWVrJywgJ3cnKTtcbiAgICBhZGRVbml0QWxpYXMoJ2lzb1dlZWsnLCAnVycpO1xuXG4gICAgLy8gUEFSU0lOR1xuXG4gICAgYWRkUmVnZXhUb2tlbigndycsICBtYXRjaDF0bzIpO1xuICAgIGFkZFJlZ2V4VG9rZW4oJ3d3JywgbWF0Y2gxdG8yLCBtYXRjaDIpO1xuICAgIGFkZFJlZ2V4VG9rZW4oJ1cnLCAgbWF0Y2gxdG8yKTtcbiAgICBhZGRSZWdleFRva2VuKCdXVycsIG1hdGNoMXRvMiwgbWF0Y2gyKTtcblxuICAgIGFkZFdlZWtQYXJzZVRva2VuKFsndycsICd3dycsICdXJywgJ1dXJ10sIGZ1bmN0aW9uIChpbnB1dCwgd2VlaywgY29uZmlnLCB0b2tlbikge1xuICAgICAgICB3ZWVrW3Rva2VuLnN1YnN0cigwLCAxKV0gPSB0b0ludChpbnB1dCk7XG4gICAgfSk7XG5cbiAgICAvLyBIRUxQRVJTXG5cbiAgICAvLyBmaXJzdERheU9mV2VlayAgICAgICAwID0gc3VuLCA2ID0gc2F0XG4gICAgLy8gICAgICAgICAgICAgICAgICAgICAgdGhlIGRheSBvZiB0aGUgd2VlayB0aGF0IHN0YXJ0cyB0aGUgd2Vla1xuICAgIC8vICAgICAgICAgICAgICAgICAgICAgICh1c3VhbGx5IHN1bmRheSBvciBtb25kYXkpXG4gICAgLy8gZmlyc3REYXlPZldlZWtPZlllYXIgMCA9IHN1biwgNiA9IHNhdFxuICAgIC8vICAgICAgICAgICAgICAgICAgICAgIHRoZSBmaXJzdCB3ZWVrIGlzIHRoZSB3ZWVrIHRoYXQgY29udGFpbnMgdGhlIGZpcnN0XG4gICAgLy8gICAgICAgICAgICAgICAgICAgICAgb2YgdGhpcyBkYXkgb2YgdGhlIHdlZWtcbiAgICAvLyAgICAgICAgICAgICAgICAgICAgICAoZWcuIElTTyB3ZWVrcyB1c2UgdGh1cnNkYXkgKDQpKVxuICAgIGZ1bmN0aW9uIHdlZWtPZlllYXIobW9tLCBmaXJzdERheU9mV2VlaywgZmlyc3REYXlPZldlZWtPZlllYXIpIHtcbiAgICAgICAgdmFyIGVuZCA9IGZpcnN0RGF5T2ZXZWVrT2ZZZWFyIC0gZmlyc3REYXlPZldlZWssXG4gICAgICAgICAgICBkYXlzVG9EYXlPZldlZWsgPSBmaXJzdERheU9mV2Vla09mWWVhciAtIG1vbS5kYXkoKSxcbiAgICAgICAgICAgIGFkanVzdGVkTW9tZW50O1xuXG5cbiAgICAgICAgaWYgKGRheXNUb0RheU9mV2VlayA+IGVuZCkge1xuICAgICAgICAgICAgZGF5c1RvRGF5T2ZXZWVrIC09IDc7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZGF5c1RvRGF5T2ZXZWVrIDwgZW5kIC0gNykge1xuICAgICAgICAgICAgZGF5c1RvRGF5T2ZXZWVrICs9IDc7XG4gICAgICAgIH1cblxuICAgICAgICBhZGp1c3RlZE1vbWVudCA9IGxvY2FsX19jcmVhdGVMb2NhbChtb20pLmFkZChkYXlzVG9EYXlPZldlZWssICdkJyk7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB3ZWVrOiBNYXRoLmNlaWwoYWRqdXN0ZWRNb21lbnQuZGF5T2ZZZWFyKCkgLyA3KSxcbiAgICAgICAgICAgIHllYXI6IGFkanVzdGVkTW9tZW50LnllYXIoKVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8vIExPQ0FMRVNcblxuICAgIGZ1bmN0aW9uIGxvY2FsZVdlZWsgKG1vbSkge1xuICAgICAgICByZXR1cm4gd2Vla09mWWVhcihtb20sIHRoaXMuX3dlZWsuZG93LCB0aGlzLl93ZWVrLmRveSkud2VlaztcbiAgICB9XG5cbiAgICB2YXIgZGVmYXVsdExvY2FsZVdlZWsgPSB7XG4gICAgICAgIGRvdyA6IDAsIC8vIFN1bmRheSBpcyB0aGUgZmlyc3QgZGF5IG9mIHRoZSB3ZWVrLlxuICAgICAgICBkb3kgOiA2ICAvLyBUaGUgd2VlayB0aGF0IGNvbnRhaW5zIEphbiAxc3QgaXMgdGhlIGZpcnN0IHdlZWsgb2YgdGhlIHllYXIuXG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIGxvY2FsZUZpcnN0RGF5T2ZXZWVrICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3dlZWsuZG93O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxvY2FsZUZpcnN0RGF5T2ZZZWFyICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3dlZWsuZG95O1xuICAgIH1cblxuICAgIC8vIE1PTUVOVFNcblxuICAgIGZ1bmN0aW9uIGdldFNldFdlZWsgKGlucHV0KSB7XG4gICAgICAgIHZhciB3ZWVrID0gdGhpcy5sb2NhbGVEYXRhKCkud2Vlayh0aGlzKTtcbiAgICAgICAgcmV0dXJuIGlucHV0ID09IG51bGwgPyB3ZWVrIDogdGhpcy5hZGQoKGlucHV0IC0gd2VlaykgKiA3LCAnZCcpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldFNldElTT1dlZWsgKGlucHV0KSB7XG4gICAgICAgIHZhciB3ZWVrID0gd2Vla09mWWVhcih0aGlzLCAxLCA0KS53ZWVrO1xuICAgICAgICByZXR1cm4gaW5wdXQgPT0gbnVsbCA/IHdlZWsgOiB0aGlzLmFkZCgoaW5wdXQgLSB3ZWVrKSAqIDcsICdkJyk7XG4gICAgfVxuXG4gICAgYWRkRm9ybWF0VG9rZW4oJ0RERCcsIFsnRERERCcsIDNdLCAnREREbycsICdkYXlPZlllYXInKTtcblxuICAgIC8vIEFMSUFTRVNcblxuICAgIGFkZFVuaXRBbGlhcygnZGF5T2ZZZWFyJywgJ0RERCcpO1xuXG4gICAgLy8gUEFSU0lOR1xuXG4gICAgYWRkUmVnZXhUb2tlbignREREJywgIG1hdGNoMXRvMyk7XG4gICAgYWRkUmVnZXhUb2tlbignRERERCcsIG1hdGNoMyk7XG4gICAgYWRkUGFyc2VUb2tlbihbJ0RERCcsICdEREREJ10sIGZ1bmN0aW9uIChpbnB1dCwgYXJyYXksIGNvbmZpZykge1xuICAgICAgICBjb25maWcuX2RheU9mWWVhciA9IHRvSW50KGlucHV0KTtcbiAgICB9KTtcblxuICAgIC8vIEhFTFBFUlNcblxuICAgIC8vaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9JU09fd2Vla19kYXRlI0NhbGN1bGF0aW5nX2FfZGF0ZV9naXZlbl90aGVfeWVhci4yQ193ZWVrX251bWJlcl9hbmRfd2Vla2RheVxuICAgIGZ1bmN0aW9uIGRheU9mWWVhckZyb21XZWVrcyh5ZWFyLCB3ZWVrLCB3ZWVrZGF5LCBmaXJzdERheU9mV2Vla09mWWVhciwgZmlyc3REYXlPZldlZWspIHtcbiAgICAgICAgdmFyIGQgPSBjcmVhdGVVVENEYXRlKHllYXIsIDAsIDEpLmdldFVUQ0RheSgpO1xuICAgICAgICB2YXIgZGF5c1RvQWRkO1xuICAgICAgICB2YXIgZGF5T2ZZZWFyO1xuXG4gICAgICAgIGQgPSBkID09PSAwID8gNyA6IGQ7XG4gICAgICAgIHdlZWtkYXkgPSB3ZWVrZGF5ICE9IG51bGwgPyB3ZWVrZGF5IDogZmlyc3REYXlPZldlZWs7XG4gICAgICAgIGRheXNUb0FkZCA9IGZpcnN0RGF5T2ZXZWVrIC0gZCArIChkID4gZmlyc3REYXlPZldlZWtPZlllYXIgPyA3IDogMCkgLSAoZCA8IGZpcnN0RGF5T2ZXZWVrID8gNyA6IDApO1xuICAgICAgICBkYXlPZlllYXIgPSA3ICogKHdlZWsgLSAxKSArICh3ZWVrZGF5IC0gZmlyc3REYXlPZldlZWspICsgZGF5c1RvQWRkICsgMTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgeWVhciAgICAgIDogZGF5T2ZZZWFyID4gMCA/IHllYXIgICAgICA6IHllYXIgLSAxLFxuICAgICAgICAgICAgZGF5T2ZZZWFyIDogZGF5T2ZZZWFyID4gMCA/IGRheU9mWWVhciA6IGRheXNJblllYXIoeWVhciAtIDEpICsgZGF5T2ZZZWFyXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gTU9NRU5UU1xuXG4gICAgZnVuY3Rpb24gZ2V0U2V0RGF5T2ZZZWFyIChpbnB1dCkge1xuICAgICAgICB2YXIgZGF5T2ZZZWFyID0gTWF0aC5yb3VuZCgodGhpcy5jbG9uZSgpLnN0YXJ0T2YoJ2RheScpIC0gdGhpcy5jbG9uZSgpLnN0YXJ0T2YoJ3llYXInKSkgLyA4NjRlNSkgKyAxO1xuICAgICAgICByZXR1cm4gaW5wdXQgPT0gbnVsbCA/IGRheU9mWWVhciA6IHRoaXMuYWRkKChpbnB1dCAtIGRheU9mWWVhciksICdkJyk7XG4gICAgfVxuXG4gICAgLy8gUGljayB0aGUgZmlyc3QgZGVmaW5lZCBvZiB0d28gb3IgdGhyZWUgYXJndW1lbnRzLlxuICAgIGZ1bmN0aW9uIGRlZmF1bHRzKGEsIGIsIGMpIHtcbiAgICAgICAgaWYgKGEgIT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuIGE7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGIgIT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuIGI7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGM7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY3VycmVudERhdGVBcnJheShjb25maWcpIHtcbiAgICAgICAgdmFyIG5vdyA9IG5ldyBEYXRlKCk7XG4gICAgICAgIGlmIChjb25maWcuX3VzZVVUQykge1xuICAgICAgICAgICAgcmV0dXJuIFtub3cuZ2V0VVRDRnVsbFllYXIoKSwgbm93LmdldFVUQ01vbnRoKCksIG5vdy5nZXRVVENEYXRlKCldO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBbbm93LmdldEZ1bGxZZWFyKCksIG5vdy5nZXRNb250aCgpLCBub3cuZ2V0RGF0ZSgpXTtcbiAgICB9XG5cbiAgICAvLyBjb252ZXJ0IGFuIGFycmF5IHRvIGEgZGF0ZS5cbiAgICAvLyB0aGUgYXJyYXkgc2hvdWxkIG1pcnJvciB0aGUgcGFyYW1ldGVycyBiZWxvd1xuICAgIC8vIG5vdGU6IGFsbCB2YWx1ZXMgcGFzdCB0aGUgeWVhciBhcmUgb3B0aW9uYWwgYW5kIHdpbGwgZGVmYXVsdCB0byB0aGUgbG93ZXN0IHBvc3NpYmxlIHZhbHVlLlxuICAgIC8vIFt5ZWFyLCBtb250aCwgZGF5ICwgaG91ciwgbWludXRlLCBzZWNvbmQsIG1pbGxpc2Vjb25kXVxuICAgIGZ1bmN0aW9uIGNvbmZpZ0Zyb21BcnJheSAoY29uZmlnKSB7XG4gICAgICAgIHZhciBpLCBkYXRlLCBpbnB1dCA9IFtdLCBjdXJyZW50RGF0ZSwgeWVhclRvVXNlO1xuXG4gICAgICAgIGlmIChjb25maWcuX2QpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGN1cnJlbnREYXRlID0gY3VycmVudERhdGVBcnJheShjb25maWcpO1xuXG4gICAgICAgIC8vY29tcHV0ZSBkYXkgb2YgdGhlIHllYXIgZnJvbSB3ZWVrcyBhbmQgd2Vla2RheXNcbiAgICAgICAgaWYgKGNvbmZpZy5fdyAmJiBjb25maWcuX2FbREFURV0gPT0gbnVsbCAmJiBjb25maWcuX2FbTU9OVEhdID09IG51bGwpIHtcbiAgICAgICAgICAgIGRheU9mWWVhckZyb21XZWVrSW5mbyhjb25maWcpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy9pZiB0aGUgZGF5IG9mIHRoZSB5ZWFyIGlzIHNldCwgZmlndXJlIG91dCB3aGF0IGl0IGlzXG4gICAgICAgIGlmIChjb25maWcuX2RheU9mWWVhcikge1xuICAgICAgICAgICAgeWVhclRvVXNlID0gZGVmYXVsdHMoY29uZmlnLl9hW1lFQVJdLCBjdXJyZW50RGF0ZVtZRUFSXSk7XG5cbiAgICAgICAgICAgIGlmIChjb25maWcuX2RheU9mWWVhciA+IGRheXNJblllYXIoeWVhclRvVXNlKSkge1xuICAgICAgICAgICAgICAgIGNvbmZpZy5fcGYuX292ZXJmbG93RGF5T2ZZZWFyID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZGF0ZSA9IGNyZWF0ZVVUQ0RhdGUoeWVhclRvVXNlLCAwLCBjb25maWcuX2RheU9mWWVhcik7XG4gICAgICAgICAgICBjb25maWcuX2FbTU9OVEhdID0gZGF0ZS5nZXRVVENNb250aCgpO1xuICAgICAgICAgICAgY29uZmlnLl9hW0RBVEVdID0gZGF0ZS5nZXRVVENEYXRlKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBEZWZhdWx0IHRvIGN1cnJlbnQgZGF0ZS5cbiAgICAgICAgLy8gKiBpZiBubyB5ZWFyLCBtb250aCwgZGF5IG9mIG1vbnRoIGFyZSBnaXZlbiwgZGVmYXVsdCB0byB0b2RheVxuICAgICAgICAvLyAqIGlmIGRheSBvZiBtb250aCBpcyBnaXZlbiwgZGVmYXVsdCBtb250aCBhbmQgeWVhclxuICAgICAgICAvLyAqIGlmIG1vbnRoIGlzIGdpdmVuLCBkZWZhdWx0IG9ubHkgeWVhclxuICAgICAgICAvLyAqIGlmIHllYXIgaXMgZ2l2ZW4sIGRvbid0IGRlZmF1bHQgYW55dGhpbmdcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IDMgJiYgY29uZmlnLl9hW2ldID09IG51bGw7ICsraSkge1xuICAgICAgICAgICAgY29uZmlnLl9hW2ldID0gaW5wdXRbaV0gPSBjdXJyZW50RGF0ZVtpXTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFplcm8gb3V0IHdoYXRldmVyIHdhcyBub3QgZGVmYXVsdGVkLCBpbmNsdWRpbmcgdGltZVxuICAgICAgICBmb3IgKDsgaSA8IDc7IGkrKykge1xuICAgICAgICAgICAgY29uZmlnLl9hW2ldID0gaW5wdXRbaV0gPSAoY29uZmlnLl9hW2ldID09IG51bGwpID8gKGkgPT09IDIgPyAxIDogMCkgOiBjb25maWcuX2FbaV07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDaGVjayBmb3IgMjQ6MDA6MDAuMDAwXG4gICAgICAgIGlmIChjb25maWcuX2FbSE9VUl0gPT09IDI0ICYmXG4gICAgICAgICAgICAgICAgY29uZmlnLl9hW01JTlVURV0gPT09IDAgJiZcbiAgICAgICAgICAgICAgICBjb25maWcuX2FbU0VDT05EXSA9PT0gMCAmJlxuICAgICAgICAgICAgICAgIGNvbmZpZy5fYVtNSUxMSVNFQ09ORF0gPT09IDApIHtcbiAgICAgICAgICAgIGNvbmZpZy5fbmV4dERheSA9IHRydWU7XG4gICAgICAgICAgICBjb25maWcuX2FbSE9VUl0gPSAwO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uZmlnLl9kID0gKGNvbmZpZy5fdXNlVVRDID8gY3JlYXRlVVRDRGF0ZSA6IGNyZWF0ZURhdGUpLmFwcGx5KG51bGwsIGlucHV0KTtcbiAgICAgICAgLy8gQXBwbHkgdGltZXpvbmUgb2Zmc2V0IGZyb20gaW5wdXQuIFRoZSBhY3R1YWwgdXRjT2Zmc2V0IGNhbiBiZSBjaGFuZ2VkXG4gICAgICAgIC8vIHdpdGggcGFyc2Vab25lLlxuICAgICAgICBpZiAoY29uZmlnLl90em0gIT0gbnVsbCkge1xuICAgICAgICAgICAgY29uZmlnLl9kLnNldFVUQ01pbnV0ZXMoY29uZmlnLl9kLmdldFVUQ01pbnV0ZXMoKSAtIGNvbmZpZy5fdHptKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjb25maWcuX25leHREYXkpIHtcbiAgICAgICAgICAgIGNvbmZpZy5fYVtIT1VSXSA9IDI0O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGF5T2ZZZWFyRnJvbVdlZWtJbmZvKGNvbmZpZykge1xuICAgICAgICB2YXIgdywgd2Vla1llYXIsIHdlZWssIHdlZWtkYXksIGRvdywgZG95LCB0ZW1wO1xuXG4gICAgICAgIHcgPSBjb25maWcuX3c7XG4gICAgICAgIGlmICh3LkdHICE9IG51bGwgfHwgdy5XICE9IG51bGwgfHwgdy5FICE9IG51bGwpIHtcbiAgICAgICAgICAgIGRvdyA9IDE7XG4gICAgICAgICAgICBkb3kgPSA0O1xuXG4gICAgICAgICAgICAvLyBUT0RPOiBXZSBuZWVkIHRvIHRha2UgdGhlIGN1cnJlbnQgaXNvV2Vla1llYXIsIGJ1dCB0aGF0IGRlcGVuZHMgb25cbiAgICAgICAgICAgIC8vIGhvdyB3ZSBpbnRlcnByZXQgbm93IChsb2NhbCwgdXRjLCBmaXhlZCBvZmZzZXQpLiBTbyBjcmVhdGVcbiAgICAgICAgICAgIC8vIGEgbm93IHZlcnNpb24gb2YgY3VycmVudCBjb25maWcgKHRha2UgbG9jYWwvdXRjL29mZnNldCBmbGFncywgYW5kXG4gICAgICAgICAgICAvLyBjcmVhdGUgbm93KS5cbiAgICAgICAgICAgIHdlZWtZZWFyID0gZGVmYXVsdHMody5HRywgY29uZmlnLl9hW1lFQVJdLCB3ZWVrT2ZZZWFyKGxvY2FsX19jcmVhdGVMb2NhbCgpLCAxLCA0KS55ZWFyKTtcbiAgICAgICAgICAgIHdlZWsgPSBkZWZhdWx0cyh3LlcsIDEpO1xuICAgICAgICAgICAgd2Vla2RheSA9IGRlZmF1bHRzKHcuRSwgMSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkb3cgPSBjb25maWcuX2xvY2FsZS5fd2Vlay5kb3c7XG4gICAgICAgICAgICBkb3kgPSBjb25maWcuX2xvY2FsZS5fd2Vlay5kb3k7XG5cbiAgICAgICAgICAgIHdlZWtZZWFyID0gZGVmYXVsdHMody5nZywgY29uZmlnLl9hW1lFQVJdLCB3ZWVrT2ZZZWFyKGxvY2FsX19jcmVhdGVMb2NhbCgpLCBkb3csIGRveSkueWVhcik7XG4gICAgICAgICAgICB3ZWVrID0gZGVmYXVsdHMody53LCAxKTtcblxuICAgICAgICAgICAgaWYgKHcuZCAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgLy8gd2Vla2RheSAtLSBsb3cgZGF5IG51bWJlcnMgYXJlIGNvbnNpZGVyZWQgbmV4dCB3ZWVrXG4gICAgICAgICAgICAgICAgd2Vla2RheSA9IHcuZDtcbiAgICAgICAgICAgICAgICBpZiAod2Vla2RheSA8IGRvdykge1xuICAgICAgICAgICAgICAgICAgICArK3dlZWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmICh3LmUgIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIC8vIGxvY2FsIHdlZWtkYXkgLS0gY291bnRpbmcgc3RhcnRzIGZyb20gYmVnaW5pbmcgb2Ygd2Vla1xuICAgICAgICAgICAgICAgIHdlZWtkYXkgPSB3LmUgKyBkb3c7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIGRlZmF1bHQgdG8gYmVnaW5pbmcgb2Ygd2Vla1xuICAgICAgICAgICAgICAgIHdlZWtkYXkgPSBkb3c7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGVtcCA9IGRheU9mWWVhckZyb21XZWVrcyh3ZWVrWWVhciwgd2Vlaywgd2Vla2RheSwgZG95LCBkb3cpO1xuXG4gICAgICAgIGNvbmZpZy5fYVtZRUFSXSA9IHRlbXAueWVhcjtcbiAgICAgICAgY29uZmlnLl9kYXlPZlllYXIgPSB0ZW1wLmRheU9mWWVhcjtcbiAgICB9XG5cbiAgICB1dGlsc19ob29rc19faG9va3MuSVNPXzg2MDEgPSBmdW5jdGlvbiAoKSB7fTtcblxuICAgIC8vIGRhdGUgZnJvbSBzdHJpbmcgYW5kIGZvcm1hdCBzdHJpbmdcbiAgICBmdW5jdGlvbiBjb25maWdGcm9tU3RyaW5nQW5kRm9ybWF0KGNvbmZpZykge1xuICAgICAgICAvLyBUT0RPOiBNb3ZlIHRoaXMgdG8gYW5vdGhlciBwYXJ0IG9mIHRoZSBjcmVhdGlvbiBmbG93IHRvIHByZXZlbnQgY2lyY3VsYXIgZGVwc1xuICAgICAgICBpZiAoY29uZmlnLl9mID09PSB1dGlsc19ob29rc19faG9va3MuSVNPXzg2MDEpIHtcbiAgICAgICAgICAgIGNvbmZpZ0Zyb21JU08oY29uZmlnKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbmZpZy5fYSA9IFtdO1xuICAgICAgICBjb25maWcuX3BmLmVtcHR5ID0gdHJ1ZTtcblxuICAgICAgICAvLyBUaGlzIGFycmF5IGlzIHVzZWQgdG8gbWFrZSBhIERhdGUsIGVpdGhlciB3aXRoIGBuZXcgRGF0ZWAgb3IgYERhdGUuVVRDYFxuICAgICAgICB2YXIgc3RyaW5nID0gJycgKyBjb25maWcuX2ksXG4gICAgICAgICAgICBpLCBwYXJzZWRJbnB1dCwgdG9rZW5zLCB0b2tlbiwgc2tpcHBlZCxcbiAgICAgICAgICAgIHN0cmluZ0xlbmd0aCA9IHN0cmluZy5sZW5ndGgsXG4gICAgICAgICAgICB0b3RhbFBhcnNlZElucHV0TGVuZ3RoID0gMDtcblxuICAgICAgICB0b2tlbnMgPSBleHBhbmRGb3JtYXQoY29uZmlnLl9mLCBjb25maWcuX2xvY2FsZSkubWF0Y2goZm9ybWF0dGluZ1Rva2VucykgfHwgW107XG5cbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHRva2Vucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdG9rZW4gPSB0b2tlbnNbaV07XG4gICAgICAgICAgICBwYXJzZWRJbnB1dCA9IChzdHJpbmcubWF0Y2goZ2V0UGFyc2VSZWdleEZvclRva2VuKHRva2VuLCBjb25maWcpKSB8fCBbXSlbMF07XG4gICAgICAgICAgICBpZiAocGFyc2VkSW5wdXQpIHtcbiAgICAgICAgICAgICAgICBza2lwcGVkID0gc3RyaW5nLnN1YnN0cigwLCBzdHJpbmcuaW5kZXhPZihwYXJzZWRJbnB1dCkpO1xuICAgICAgICAgICAgICAgIGlmIChza2lwcGVkLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgY29uZmlnLl9wZi51bnVzZWRJbnB1dC5wdXNoKHNraXBwZWQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzdHJpbmcgPSBzdHJpbmcuc2xpY2Uoc3RyaW5nLmluZGV4T2YocGFyc2VkSW5wdXQpICsgcGFyc2VkSW5wdXQubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICB0b3RhbFBhcnNlZElucHV0TGVuZ3RoICs9IHBhcnNlZElucHV0Lmxlbmd0aDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIGRvbid0IHBhcnNlIGlmIGl0J3Mgbm90IGEga25vd24gdG9rZW5cbiAgICAgICAgICAgIGlmIChmb3JtYXRUb2tlbkZ1bmN0aW9uc1t0b2tlbl0pIHtcbiAgICAgICAgICAgICAgICBpZiAocGFyc2VkSW5wdXQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uZmlnLl9wZi5lbXB0eSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29uZmlnLl9wZi51bnVzZWRUb2tlbnMucHVzaCh0b2tlbik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGFkZFRpbWVUb0FycmF5RnJvbVRva2VuKHRva2VuLCBwYXJzZWRJbnB1dCwgY29uZmlnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGNvbmZpZy5fc3RyaWN0ICYmICFwYXJzZWRJbnB1dCkge1xuICAgICAgICAgICAgICAgIGNvbmZpZy5fcGYudW51c2VkVG9rZW5zLnB1c2godG9rZW4pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gYWRkIHJlbWFpbmluZyB1bnBhcnNlZCBpbnB1dCBsZW5ndGggdG8gdGhlIHN0cmluZ1xuICAgICAgICBjb25maWcuX3BmLmNoYXJzTGVmdE92ZXIgPSBzdHJpbmdMZW5ndGggLSB0b3RhbFBhcnNlZElucHV0TGVuZ3RoO1xuICAgICAgICBpZiAoc3RyaW5nLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGNvbmZpZy5fcGYudW51c2VkSW5wdXQucHVzaChzdHJpbmcpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY2xlYXIgXzEyaCBmbGFnIGlmIGhvdXIgaXMgPD0gMTJcbiAgICAgICAgaWYgKGNvbmZpZy5fcGYuYmlnSG91ciA9PT0gdHJ1ZSAmJiBjb25maWcuX2FbSE9VUl0gPD0gMTIpIHtcbiAgICAgICAgICAgIGNvbmZpZy5fcGYuYmlnSG91ciA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICAvLyBoYW5kbGUgbWVyaWRpZW1cbiAgICAgICAgY29uZmlnLl9hW0hPVVJdID0gbWVyaWRpZW1GaXhXcmFwKGNvbmZpZy5fbG9jYWxlLCBjb25maWcuX2FbSE9VUl0sIGNvbmZpZy5fbWVyaWRpZW0pO1xuXG4gICAgICAgIGNvbmZpZ0Zyb21BcnJheShjb25maWcpO1xuICAgICAgICBjaGVja092ZXJmbG93KGNvbmZpZyk7XG4gICAgfVxuXG5cbiAgICBmdW5jdGlvbiBtZXJpZGllbUZpeFdyYXAgKGxvY2FsZSwgaG91ciwgbWVyaWRpZW0pIHtcbiAgICAgICAgdmFyIGlzUG07XG5cbiAgICAgICAgaWYgKG1lcmlkaWVtID09IG51bGwpIHtcbiAgICAgICAgICAgIC8vIG5vdGhpbmcgdG8gZG9cbiAgICAgICAgICAgIHJldHVybiBob3VyO1xuICAgICAgICB9XG4gICAgICAgIGlmIChsb2NhbGUubWVyaWRpZW1Ib3VyICE9IG51bGwpIHtcbiAgICAgICAgICAgIHJldHVybiBsb2NhbGUubWVyaWRpZW1Ib3VyKGhvdXIsIG1lcmlkaWVtKTtcbiAgICAgICAgfSBlbHNlIGlmIChsb2NhbGUuaXNQTSAhPSBudWxsKSB7XG4gICAgICAgICAgICAvLyBGYWxsYmFja1xuICAgICAgICAgICAgaXNQbSA9IGxvY2FsZS5pc1BNKG1lcmlkaWVtKTtcbiAgICAgICAgICAgIGlmIChpc1BtICYmIGhvdXIgPCAxMikge1xuICAgICAgICAgICAgICAgIGhvdXIgKz0gMTI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIWlzUG0gJiYgaG91ciA9PT0gMTIpIHtcbiAgICAgICAgICAgICAgICBob3VyID0gMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBob3VyO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gdGhpcyBpcyBub3Qgc3VwcG9zZWQgdG8gaGFwcGVuXG4gICAgICAgICAgICByZXR1cm4gaG91cjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNvbmZpZ0Zyb21TdHJpbmdBbmRBcnJheShjb25maWcpIHtcbiAgICAgICAgdmFyIHRlbXBDb25maWcsXG4gICAgICAgICAgICBiZXN0TW9tZW50LFxuXG4gICAgICAgICAgICBzY29yZVRvQmVhdCxcbiAgICAgICAgICAgIGksXG4gICAgICAgICAgICBjdXJyZW50U2NvcmU7XG5cbiAgICAgICAgaWYgKGNvbmZpZy5fZi5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIGNvbmZpZy5fcGYuaW52YWxpZEZvcm1hdCA9IHRydWU7XG4gICAgICAgICAgICBjb25maWcuX2QgPSBuZXcgRGF0ZShOYU4pO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGNvbmZpZy5fZi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY3VycmVudFNjb3JlID0gMDtcbiAgICAgICAgICAgIHRlbXBDb25maWcgPSBjb3B5Q29uZmlnKHt9LCBjb25maWcpO1xuICAgICAgICAgICAgaWYgKGNvbmZpZy5fdXNlVVRDICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICB0ZW1wQ29uZmlnLl91c2VVVEMgPSBjb25maWcuX3VzZVVUQztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRlbXBDb25maWcuX3BmID0gZGVmYXVsdFBhcnNpbmdGbGFncygpO1xuICAgICAgICAgICAgdGVtcENvbmZpZy5fZiA9IGNvbmZpZy5fZltpXTtcbiAgICAgICAgICAgIGNvbmZpZ0Zyb21TdHJpbmdBbmRGb3JtYXQodGVtcENvbmZpZyk7XG5cbiAgICAgICAgICAgIGlmICghdmFsaWRfX2lzVmFsaWQodGVtcENvbmZpZykpIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gaWYgdGhlcmUgaXMgYW55IGlucHV0IHRoYXQgd2FzIG5vdCBwYXJzZWQgYWRkIGEgcGVuYWx0eSBmb3IgdGhhdCBmb3JtYXRcbiAgICAgICAgICAgIGN1cnJlbnRTY29yZSArPSB0ZW1wQ29uZmlnLl9wZi5jaGFyc0xlZnRPdmVyO1xuXG4gICAgICAgICAgICAvL29yIHRva2Vuc1xuICAgICAgICAgICAgY3VycmVudFNjb3JlICs9IHRlbXBDb25maWcuX3BmLnVudXNlZFRva2Vucy5sZW5ndGggKiAxMDtcblxuICAgICAgICAgICAgdGVtcENvbmZpZy5fcGYuc2NvcmUgPSBjdXJyZW50U2NvcmU7XG5cbiAgICAgICAgICAgIGlmIChzY29yZVRvQmVhdCA9PSBudWxsIHx8IGN1cnJlbnRTY29yZSA8IHNjb3JlVG9CZWF0KSB7XG4gICAgICAgICAgICAgICAgc2NvcmVUb0JlYXQgPSBjdXJyZW50U2NvcmU7XG4gICAgICAgICAgICAgICAgYmVzdE1vbWVudCA9IHRlbXBDb25maWc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBleHRlbmQoY29uZmlnLCBiZXN0TW9tZW50IHx8IHRlbXBDb25maWcpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNvbmZpZ0Zyb21PYmplY3QoY29uZmlnKSB7XG4gICAgICAgIGlmIChjb25maWcuX2QpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBpID0gbm9ybWFsaXplT2JqZWN0VW5pdHMoY29uZmlnLl9pKTtcbiAgICAgICAgY29uZmlnLl9hID0gW2kueWVhciwgaS5tb250aCwgaS5kYXkgfHwgaS5kYXRlLCBpLmhvdXIsIGkubWludXRlLCBpLnNlY29uZCwgaS5taWxsaXNlY29uZF07XG5cbiAgICAgICAgY29uZmlnRnJvbUFycmF5KGNvbmZpZyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY3JlYXRlRnJvbUNvbmZpZyAoY29uZmlnKSB7XG4gICAgICAgIHZhciBpbnB1dCA9IGNvbmZpZy5faSxcbiAgICAgICAgICAgIGZvcm1hdCA9IGNvbmZpZy5fZixcbiAgICAgICAgICAgIHJlcztcblxuICAgICAgICBjb25maWcuX2xvY2FsZSA9IGNvbmZpZy5fbG9jYWxlIHx8IGxvY2FsZV9sb2NhbGVzX19nZXRMb2NhbGUoY29uZmlnLl9sKTtcblxuICAgICAgICBpZiAoaW5wdXQgPT09IG51bGwgfHwgKGZvcm1hdCA9PT0gdW5kZWZpbmVkICYmIGlucHV0ID09PSAnJykpIHtcbiAgICAgICAgICAgIHJldHVybiB2YWxpZF9fY3JlYXRlSW52YWxpZCh7bnVsbElucHV0OiB0cnVlfSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodHlwZW9mIGlucHV0ID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgY29uZmlnLl9pID0gaW5wdXQgPSBjb25maWcuX2xvY2FsZS5wcmVwYXJzZShpbnB1dCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXNNb21lbnQoaW5wdXQpKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IE1vbWVudChjaGVja092ZXJmbG93KGlucHV0KSk7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNBcnJheShmb3JtYXQpKSB7XG4gICAgICAgICAgICBjb25maWdGcm9tU3RyaW5nQW5kQXJyYXkoY29uZmlnKTtcbiAgICAgICAgfSBlbHNlIGlmIChmb3JtYXQpIHtcbiAgICAgICAgICAgIGNvbmZpZ0Zyb21TdHJpbmdBbmRGb3JtYXQoY29uZmlnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbmZpZ0Zyb21JbnB1dChjb25maWcpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVzID0gbmV3IE1vbWVudChjaGVja092ZXJmbG93KGNvbmZpZykpO1xuICAgICAgICBpZiAocmVzLl9uZXh0RGF5KSB7XG4gICAgICAgICAgICAvLyBBZGRpbmcgaXMgc21hcnQgZW5vdWdoIGFyb3VuZCBEU1RcbiAgICAgICAgICAgIHJlcy5hZGQoMSwgJ2QnKTtcbiAgICAgICAgICAgIHJlcy5fbmV4dERheSA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXM7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY29uZmlnRnJvbUlucHV0KGNvbmZpZykge1xuICAgICAgICB2YXIgaW5wdXQgPSBjb25maWcuX2k7XG4gICAgICAgIGlmIChpbnB1dCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBjb25maWcuX2QgPSBuZXcgRGF0ZSgpO1xuICAgICAgICB9IGVsc2UgaWYgKGlzRGF0ZShpbnB1dCkpIHtcbiAgICAgICAgICAgIGNvbmZpZy5fZCA9IG5ldyBEYXRlKCtpbnB1dCk7XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGlucHV0ID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgY29uZmlnRnJvbVN0cmluZyhjb25maWcpO1xuICAgICAgICB9IGVsc2UgaWYgKGlzQXJyYXkoaW5wdXQpKSB7XG4gICAgICAgICAgICBjb25maWcuX2EgPSBtYXAoaW5wdXQuc2xpY2UoMCksIGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcGFyc2VJbnQob2JqLCAxMCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbmZpZ0Zyb21BcnJheShjb25maWcpO1xuICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZihpbnB1dCkgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICBjb25maWdGcm9tT2JqZWN0KGNvbmZpZyk7XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZW9mKGlucHV0KSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIC8vIGZyb20gbWlsbGlzZWNvbmRzXG4gICAgICAgICAgICBjb25maWcuX2QgPSBuZXcgRGF0ZShpbnB1dCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB1dGlsc19ob29rc19faG9va3MuY3JlYXRlRnJvbUlucHV0RmFsbGJhY2soY29uZmlnKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNyZWF0ZUxvY2FsT3JVVEMgKGlucHV0LCBmb3JtYXQsIGxvY2FsZSwgc3RyaWN0LCBpc1VUQykge1xuICAgICAgICB2YXIgYyA9IHt9O1xuXG4gICAgICAgIGlmICh0eXBlb2YobG9jYWxlKSA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgICAgICBzdHJpY3QgPSBsb2NhbGU7XG4gICAgICAgICAgICBsb2NhbGUgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgLy8gb2JqZWN0IGNvbnN0cnVjdGlvbiBtdXN0IGJlIGRvbmUgdGhpcyB3YXkuXG4gICAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9tb21lbnQvbW9tZW50L2lzc3Vlcy8xNDIzXG4gICAgICAgIGMuX2lzQU1vbWVudE9iamVjdCA9IHRydWU7XG4gICAgICAgIGMuX3VzZVVUQyA9IGMuX2lzVVRDID0gaXNVVEM7XG4gICAgICAgIGMuX2wgPSBsb2NhbGU7XG4gICAgICAgIGMuX2kgPSBpbnB1dDtcbiAgICAgICAgYy5fZiA9IGZvcm1hdDtcbiAgICAgICAgYy5fc3RyaWN0ID0gc3RyaWN0O1xuICAgICAgICBjLl9wZiA9IGRlZmF1bHRQYXJzaW5nRmxhZ3MoKTtcblxuICAgICAgICByZXR1cm4gY3JlYXRlRnJvbUNvbmZpZyhjKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsb2NhbF9fY3JlYXRlTG9jYWwgKGlucHV0LCBmb3JtYXQsIGxvY2FsZSwgc3RyaWN0KSB7XG4gICAgICAgIHJldHVybiBjcmVhdGVMb2NhbE9yVVRDKGlucHV0LCBmb3JtYXQsIGxvY2FsZSwgc3RyaWN0LCBmYWxzZSk7XG4gICAgfVxuXG4gICAgdmFyIHByb3RvdHlwZU1pbiA9IGRlcHJlY2F0ZShcbiAgICAgICAgICdtb21lbnQoKS5taW4gaXMgZGVwcmVjYXRlZCwgdXNlIG1vbWVudC5taW4gaW5zdGVhZC4gaHR0cHM6Ly9naXRodWIuY29tL21vbWVudC9tb21lbnQvaXNzdWVzLzE1NDgnLFxuICAgICAgICAgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgIHZhciBvdGhlciA9IGxvY2FsX19jcmVhdGVMb2NhbC5hcHBseShudWxsLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgIHJldHVybiBvdGhlciA8IHRoaXMgPyB0aGlzIDogb3RoZXI7XG4gICAgICAgICB9XG4gICAgICk7XG5cbiAgICB2YXIgcHJvdG90eXBlTWF4ID0gZGVwcmVjYXRlKFxuICAgICAgICAnbW9tZW50KCkubWF4IGlzIGRlcHJlY2F0ZWQsIHVzZSBtb21lbnQubWF4IGluc3RlYWQuIGh0dHBzOi8vZ2l0aHViLmNvbS9tb21lbnQvbW9tZW50L2lzc3Vlcy8xNTQ4JyxcbiAgICAgICAgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIG90aGVyID0gbG9jYWxfX2NyZWF0ZUxvY2FsLmFwcGx5KG51bGwsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICByZXR1cm4gb3RoZXIgPiB0aGlzID8gdGhpcyA6IG90aGVyO1xuICAgICAgICB9XG4gICAgKTtcblxuICAgIC8vIFBpY2sgYSBtb21lbnQgbSBmcm9tIG1vbWVudHMgc28gdGhhdCBtW2ZuXShvdGhlcikgaXMgdHJ1ZSBmb3IgYWxsXG4gICAgLy8gb3RoZXIuIFRoaXMgcmVsaWVzIG9uIHRoZSBmdW5jdGlvbiBmbiB0byBiZSB0cmFuc2l0aXZlLlxuICAgIC8vXG4gICAgLy8gbW9tZW50cyBzaG91bGQgZWl0aGVyIGJlIGFuIGFycmF5IG9mIG1vbWVudCBvYmplY3RzIG9yIGFuIGFycmF5LCB3aG9zZVxuICAgIC8vIGZpcnN0IGVsZW1lbnQgaXMgYW4gYXJyYXkgb2YgbW9tZW50IG9iamVjdHMuXG4gICAgZnVuY3Rpb24gcGlja0J5KGZuLCBtb21lbnRzKSB7XG4gICAgICAgIHZhciByZXMsIGk7XG4gICAgICAgIGlmIChtb21lbnRzLmxlbmd0aCA9PT0gMSAmJiBpc0FycmF5KG1vbWVudHNbMF0pKSB7XG4gICAgICAgICAgICBtb21lbnRzID0gbW9tZW50c1swXTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIW1vbWVudHMubGVuZ3RoKSB7XG4gICAgICAgICAgICByZXR1cm4gbG9jYWxfX2NyZWF0ZUxvY2FsKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmVzID0gbW9tZW50c1swXTtcbiAgICAgICAgZm9yIChpID0gMTsgaSA8IG1vbWVudHMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGlmIChtb21lbnRzW2ldW2ZuXShyZXMpKSB7XG4gICAgICAgICAgICAgICAgcmVzID0gbW9tZW50c1tpXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzO1xuICAgIH1cblxuICAgIC8vIFRPRE86IFVzZSBbXS5zb3J0IGluc3RlYWQ/XG4gICAgZnVuY3Rpb24gbWluICgpIHtcbiAgICAgICAgdmFyIGFyZ3MgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMCk7XG5cbiAgICAgICAgcmV0dXJuIHBpY2tCeSgnaXNCZWZvcmUnLCBhcmdzKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBtYXggKCkge1xuICAgICAgICB2YXIgYXJncyA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAwKTtcblxuICAgICAgICByZXR1cm4gcGlja0J5KCdpc0FmdGVyJywgYXJncyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gRHVyYXRpb24gKGR1cmF0aW9uKSB7XG4gICAgICAgIHZhciBub3JtYWxpemVkSW5wdXQgPSBub3JtYWxpemVPYmplY3RVbml0cyhkdXJhdGlvbiksXG4gICAgICAgICAgICB5ZWFycyA9IG5vcm1hbGl6ZWRJbnB1dC55ZWFyIHx8IDAsXG4gICAgICAgICAgICBxdWFydGVycyA9IG5vcm1hbGl6ZWRJbnB1dC5xdWFydGVyIHx8IDAsXG4gICAgICAgICAgICBtb250aHMgPSBub3JtYWxpemVkSW5wdXQubW9udGggfHwgMCxcbiAgICAgICAgICAgIHdlZWtzID0gbm9ybWFsaXplZElucHV0LndlZWsgfHwgMCxcbiAgICAgICAgICAgIGRheXMgPSBub3JtYWxpemVkSW5wdXQuZGF5IHx8IDAsXG4gICAgICAgICAgICBob3VycyA9IG5vcm1hbGl6ZWRJbnB1dC5ob3VyIHx8IDAsXG4gICAgICAgICAgICBtaW51dGVzID0gbm9ybWFsaXplZElucHV0Lm1pbnV0ZSB8fCAwLFxuICAgICAgICAgICAgc2Vjb25kcyA9IG5vcm1hbGl6ZWRJbnB1dC5zZWNvbmQgfHwgMCxcbiAgICAgICAgICAgIG1pbGxpc2Vjb25kcyA9IG5vcm1hbGl6ZWRJbnB1dC5taWxsaXNlY29uZCB8fCAwO1xuXG4gICAgICAgIC8vIHJlcHJlc2VudGF0aW9uIGZvciBkYXRlQWRkUmVtb3ZlXG4gICAgICAgIHRoaXMuX21pbGxpc2Vjb25kcyA9ICttaWxsaXNlY29uZHMgK1xuICAgICAgICAgICAgc2Vjb25kcyAqIDFlMyArIC8vIDEwMDBcbiAgICAgICAgICAgIG1pbnV0ZXMgKiA2ZTQgKyAvLyAxMDAwICogNjBcbiAgICAgICAgICAgIGhvdXJzICogMzZlNTsgLy8gMTAwMCAqIDYwICogNjBcbiAgICAgICAgLy8gQmVjYXVzZSBvZiBkYXRlQWRkUmVtb3ZlIHRyZWF0cyAyNCBob3VycyBhcyBkaWZmZXJlbnQgZnJvbSBhXG4gICAgICAgIC8vIGRheSB3aGVuIHdvcmtpbmcgYXJvdW5kIERTVCwgd2UgbmVlZCB0byBzdG9yZSB0aGVtIHNlcGFyYXRlbHlcbiAgICAgICAgdGhpcy5fZGF5cyA9ICtkYXlzICtcbiAgICAgICAgICAgIHdlZWtzICogNztcbiAgICAgICAgLy8gSXQgaXMgaW1wb3NzaWJsZSB0cmFuc2xhdGUgbW9udGhzIGludG8gZGF5cyB3aXRob3V0IGtub3dpbmdcbiAgICAgICAgLy8gd2hpY2ggbW9udGhzIHlvdSBhcmUgYXJlIHRhbGtpbmcgYWJvdXQsIHNvIHdlIGhhdmUgdG8gc3RvcmVcbiAgICAgICAgLy8gaXQgc2VwYXJhdGVseS5cbiAgICAgICAgdGhpcy5fbW9udGhzID0gK21vbnRocyArXG4gICAgICAgICAgICBxdWFydGVycyAqIDMgK1xuICAgICAgICAgICAgeWVhcnMgKiAxMjtcblxuICAgICAgICB0aGlzLl9kYXRhID0ge307XG5cbiAgICAgICAgdGhpcy5fbG9jYWxlID0gbG9jYWxlX2xvY2FsZXNfX2dldExvY2FsZSgpO1xuXG4gICAgICAgIHRoaXMuX2J1YmJsZSgpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGlzRHVyYXRpb24gKG9iaikge1xuICAgICAgICByZXR1cm4gb2JqIGluc3RhbmNlb2YgRHVyYXRpb247XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb2Zmc2V0ICh0b2tlbiwgc2VwYXJhdG9yKSB7XG4gICAgICAgIGFkZEZvcm1hdFRva2VuKHRva2VuLCAwLCAwLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgb2Zmc2V0ID0gdGhpcy51dGNPZmZzZXQoKTtcbiAgICAgICAgICAgIHZhciBzaWduID0gJysnO1xuICAgICAgICAgICAgaWYgKG9mZnNldCA8IDApIHtcbiAgICAgICAgICAgICAgICBvZmZzZXQgPSAtb2Zmc2V0O1xuICAgICAgICAgICAgICAgIHNpZ24gPSAnLSc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gc2lnbiArIHplcm9GaWxsKH5+KG9mZnNldCAvIDYwKSwgMikgKyBzZXBhcmF0b3IgKyB6ZXJvRmlsbCh+fihvZmZzZXQpICUgNjAsIDIpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBvZmZzZXQoJ1onLCAnOicpO1xuICAgIG9mZnNldCgnWlonLCAnJyk7XG5cbiAgICAvLyBQQVJTSU5HXG5cbiAgICBhZGRSZWdleFRva2VuKCdaJywgIG1hdGNoT2Zmc2V0KTtcbiAgICBhZGRSZWdleFRva2VuKCdaWicsIG1hdGNoT2Zmc2V0KTtcbiAgICBhZGRQYXJzZVRva2VuKFsnWicsICdaWiddLCBmdW5jdGlvbiAoaW5wdXQsIGFycmF5LCBjb25maWcpIHtcbiAgICAgICAgY29uZmlnLl91c2VVVEMgPSB0cnVlO1xuICAgICAgICBjb25maWcuX3R6bSA9IG9mZnNldEZyb21TdHJpbmcoaW5wdXQpO1xuICAgIH0pO1xuXG4gICAgLy8gSEVMUEVSU1xuXG4gICAgLy8gdGltZXpvbmUgY2h1bmtlclxuICAgIC8vICcrMTA6MDAnID4gWycxMCcsICAnMDAnXVxuICAgIC8vICctMTUzMCcgID4gWyctMTUnLCAnMzAnXVxuICAgIHZhciBjaHVua09mZnNldCA9IC8oW1xcK1xcLV18XFxkXFxkKS9naTtcblxuICAgIGZ1bmN0aW9uIG9mZnNldEZyb21TdHJpbmcoc3RyaW5nKSB7XG4gICAgICAgIHZhciBtYXRjaGVzID0gKChzdHJpbmcgfHwgJycpLm1hdGNoKG1hdGNoT2Zmc2V0KSB8fCBbXSk7XG4gICAgICAgIHZhciBjaHVuayAgID0gbWF0Y2hlc1ttYXRjaGVzLmxlbmd0aCAtIDFdIHx8IFtdO1xuICAgICAgICB2YXIgcGFydHMgICA9IChjaHVuayArICcnKS5tYXRjaChjaHVua09mZnNldCkgfHwgWyctJywgMCwgMF07XG4gICAgICAgIHZhciBtaW51dGVzID0gKyhwYXJ0c1sxXSAqIDYwKSArIHRvSW50KHBhcnRzWzJdKTtcblxuICAgICAgICByZXR1cm4gcGFydHNbMF0gPT09ICcrJyA/IG1pbnV0ZXMgOiAtbWludXRlcztcbiAgICB9XG5cbiAgICAvLyBSZXR1cm4gYSBtb21lbnQgZnJvbSBpbnB1dCwgdGhhdCBpcyBsb2NhbC91dGMvem9uZSBlcXVpdmFsZW50IHRvIG1vZGVsLlxuICAgIGZ1bmN0aW9uIGNsb25lV2l0aE9mZnNldChpbnB1dCwgbW9kZWwpIHtcbiAgICAgICAgdmFyIHJlcywgZGlmZjtcbiAgICAgICAgaWYgKG1vZGVsLl9pc1VUQykge1xuICAgICAgICAgICAgcmVzID0gbW9kZWwuY2xvbmUoKTtcbiAgICAgICAgICAgIGRpZmYgPSAoaXNNb21lbnQoaW5wdXQpIHx8IGlzRGF0ZShpbnB1dCkgPyAraW5wdXQgOiArbG9jYWxfX2NyZWF0ZUxvY2FsKGlucHV0KSkgLSAoK3Jlcyk7XG4gICAgICAgICAgICAvLyBVc2UgbG93LWxldmVsIGFwaSwgYmVjYXVzZSB0aGlzIGZuIGlzIGxvdy1sZXZlbCBhcGkuXG4gICAgICAgICAgICByZXMuX2Quc2V0VGltZSgrcmVzLl9kICsgZGlmZik7XG4gICAgICAgICAgICB1dGlsc19ob29rc19faG9va3MudXBkYXRlT2Zmc2V0KHJlcywgZmFsc2UpO1xuICAgICAgICAgICAgcmV0dXJuIHJlcztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBsb2NhbF9fY3JlYXRlTG9jYWwoaW5wdXQpLmxvY2FsKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1vZGVsLl9pc1VUQyA/IGxvY2FsX19jcmVhdGVMb2NhbChpbnB1dCkuem9uZShtb2RlbC5fb2Zmc2V0IHx8IDApIDogbG9jYWxfX2NyZWF0ZUxvY2FsKGlucHV0KS5sb2NhbCgpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldERhdGVPZmZzZXQgKG0pIHtcbiAgICAgICAgLy8gT24gRmlyZWZveC4yNCBEYXRlI2dldFRpbWV6b25lT2Zmc2V0IHJldHVybnMgYSBmbG9hdGluZyBwb2ludC5cbiAgICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL21vbWVudC9tb21lbnQvcHVsbC8xODcxXG4gICAgICAgIHJldHVybiAtTWF0aC5yb3VuZChtLl9kLmdldFRpbWV6b25lT2Zmc2V0KCkgLyAxNSkgKiAxNTtcbiAgICB9XG5cbiAgICAvLyBIT09LU1xuXG4gICAgLy8gVGhpcyBmdW5jdGlvbiB3aWxsIGJlIGNhbGxlZCB3aGVuZXZlciBhIG1vbWVudCBpcyBtdXRhdGVkLlxuICAgIC8vIEl0IGlzIGludGVuZGVkIHRvIGtlZXAgdGhlIG9mZnNldCBpbiBzeW5jIHdpdGggdGhlIHRpbWV6b25lLlxuICAgIHV0aWxzX2hvb2tzX19ob29rcy51cGRhdGVPZmZzZXQgPSBmdW5jdGlvbiAoKSB7fTtcblxuICAgIC8vIE1PTUVOVFNcblxuICAgIC8vIGtlZXBMb2NhbFRpbWUgPSB0cnVlIG1lYW5zIG9ubHkgY2hhbmdlIHRoZSB0aW1lem9uZSwgd2l0aG91dFxuICAgIC8vIGFmZmVjdGluZyB0aGUgbG9jYWwgaG91ci4gU28gNTozMToyNiArMDMwMCAtLVt1dGNPZmZzZXQoMiwgdHJ1ZSldLS0+XG4gICAgLy8gNTozMToyNiArMDIwMCBJdCBpcyBwb3NzaWJsZSB0aGF0IDU6MzE6MjYgZG9lc24ndCBleGlzdCB3aXRoIG9mZnNldFxuICAgIC8vICswMjAwLCBzbyB3ZSBhZGp1c3QgdGhlIHRpbWUgYXMgbmVlZGVkLCB0byBiZSB2YWxpZC5cbiAgICAvL1xuICAgIC8vIEtlZXBpbmcgdGhlIHRpbWUgYWN0dWFsbHkgYWRkcy9zdWJ0cmFjdHMgKG9uZSBob3VyKVxuICAgIC8vIGZyb20gdGhlIGFjdHVhbCByZXByZXNlbnRlZCB0aW1lLiBUaGF0IGlzIHdoeSB3ZSBjYWxsIHVwZGF0ZU9mZnNldFxuICAgIC8vIGEgc2Vjb25kIHRpbWUuIEluIGNhc2UgaXQgd2FudHMgdXMgdG8gY2hhbmdlIHRoZSBvZmZzZXQgYWdhaW5cbiAgICAvLyBfY2hhbmdlSW5Qcm9ncmVzcyA9PSB0cnVlIGNhc2UsIHRoZW4gd2UgaGF2ZSB0byBhZGp1c3QsIGJlY2F1c2VcbiAgICAvLyB0aGVyZSBpcyBubyBzdWNoIHRpbWUgaW4gdGhlIGdpdmVuIHRpbWV6b25lLlxuICAgIGZ1bmN0aW9uIGdldFNldE9mZnNldCAoaW5wdXQsIGtlZXBMb2NhbFRpbWUpIHtcbiAgICAgICAgdmFyIG9mZnNldCA9IHRoaXMuX29mZnNldCB8fCAwLFxuICAgICAgICAgICAgbG9jYWxBZGp1c3Q7XG4gICAgICAgIGlmIChpbnB1dCAhPSBudWxsKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGlucHV0ID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIGlucHV0ID0gb2Zmc2V0RnJvbVN0cmluZyhpbnB1dCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoTWF0aC5hYnMoaW5wdXQpIDwgMTYpIHtcbiAgICAgICAgICAgICAgICBpbnB1dCA9IGlucHV0ICogNjA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIXRoaXMuX2lzVVRDICYmIGtlZXBMb2NhbFRpbWUpIHtcbiAgICAgICAgICAgICAgICBsb2NhbEFkanVzdCA9IGdldERhdGVPZmZzZXQodGhpcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9vZmZzZXQgPSBpbnB1dDtcbiAgICAgICAgICAgIHRoaXMuX2lzVVRDID0gdHJ1ZTtcbiAgICAgICAgICAgIGlmIChsb2NhbEFkanVzdCAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hZGQobG9jYWxBZGp1c3QsICdtJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAob2Zmc2V0ICE9PSBpbnB1dCkge1xuICAgICAgICAgICAgICAgIGlmICgha2VlcExvY2FsVGltZSB8fCB0aGlzLl9jaGFuZ2VJblByb2dyZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgIGFkZF9zdWJ0cmFjdF9fYWRkU3VidHJhY3QodGhpcywgY3JlYXRlX19jcmVhdGVEdXJhdGlvbihpbnB1dCAtIG9mZnNldCwgJ20nKSwgMSwgZmFsc2UpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoIXRoaXMuX2NoYW5nZUluUHJvZ3Jlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fY2hhbmdlSW5Qcm9ncmVzcyA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIHV0aWxzX2hvb2tzX19ob29rcy51cGRhdGVPZmZzZXQodGhpcywgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2NoYW5nZUluUHJvZ3Jlc3MgPSBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2lzVVRDID8gb2Zmc2V0IDogZ2V0RGF0ZU9mZnNldCh0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldFNldFpvbmUgKGlucHV0LCBrZWVwTG9jYWxUaW1lKSB7XG4gICAgICAgIGlmIChpbnB1dCAhPSBudWxsKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGlucHV0ICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIGlucHV0ID0gLWlucHV0O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnV0Y09mZnNldChpbnB1dCwga2VlcExvY2FsVGltZSk7XG5cbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIC10aGlzLnV0Y09mZnNldCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc2V0T2Zmc2V0VG9VVEMgKGtlZXBMb2NhbFRpbWUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudXRjT2Zmc2V0KDAsIGtlZXBMb2NhbFRpbWUpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNldE9mZnNldFRvTG9jYWwgKGtlZXBMb2NhbFRpbWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2lzVVRDKSB7XG4gICAgICAgICAgICB0aGlzLnV0Y09mZnNldCgwLCBrZWVwTG9jYWxUaW1lKTtcbiAgICAgICAgICAgIHRoaXMuX2lzVVRDID0gZmFsc2U7XG5cbiAgICAgICAgICAgIGlmIChrZWVwTG9jYWxUaW1lKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zdWJ0cmFjdChnZXREYXRlT2Zmc2V0KHRoaXMpLCAnbScpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNldE9mZnNldFRvUGFyc2VkT2Zmc2V0ICgpIHtcbiAgICAgICAgaWYgKHRoaXMuX3R6bSkge1xuICAgICAgICAgICAgdGhpcy51dGNPZmZzZXQodGhpcy5fdHptKTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgdGhpcy5faSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHRoaXMudXRjT2Zmc2V0KG9mZnNldEZyb21TdHJpbmcodGhpcy5faSkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGhhc0FsaWduZWRIb3VyT2Zmc2V0IChpbnB1dCkge1xuICAgICAgICBpZiAoIWlucHV0KSB7XG4gICAgICAgICAgICBpbnB1dCA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBpbnB1dCA9IGxvY2FsX19jcmVhdGVMb2NhbChpbnB1dCkudXRjT2Zmc2V0KCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gKHRoaXMudXRjT2Zmc2V0KCkgLSBpbnB1dCkgJSA2MCA9PT0gMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpc0RheWxpZ2h0U2F2aW5nVGltZSAoKSB7XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICB0aGlzLnV0Y09mZnNldCgpID4gdGhpcy5jbG9uZSgpLm1vbnRoKDApLnV0Y09mZnNldCgpIHx8XG4gICAgICAgICAgICB0aGlzLnV0Y09mZnNldCgpID4gdGhpcy5jbG9uZSgpLm1vbnRoKDUpLnV0Y09mZnNldCgpXG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaXNEYXlsaWdodFNhdmluZ1RpbWVTaGlmdGVkICgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2EpIHtcbiAgICAgICAgICAgIHZhciBvdGhlciA9IHRoaXMuX2lzVVRDID8gY3JlYXRlX3V0Y19fY3JlYXRlVVRDKHRoaXMuX2EpIDogbG9jYWxfX2NyZWF0ZUxvY2FsKHRoaXMuX2EpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuaXNWYWxpZCgpICYmIGNvbXBhcmVBcnJheXModGhpcy5fYSwgb3RoZXIudG9BcnJheSgpKSA+IDA7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaXNMb2NhbCAoKSB7XG4gICAgICAgIHJldHVybiAhdGhpcy5faXNVVEM7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaXNVdGNPZmZzZXQgKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5faXNVVEM7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaXNVdGMgKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5faXNVVEMgJiYgdGhpcy5fb2Zmc2V0ID09PSAwO1xuICAgIH1cblxuICAgIHZhciBhc3BOZXRSZWdleCA9IC8oXFwtKT8oPzooXFxkKilcXC4pPyhcXGQrKVxcOihcXGQrKSg/OlxcOihcXGQrKVxcLj8oXFxkezN9KT8pPy87XG5cbiAgICAvLyBmcm9tIGh0dHA6Ly9kb2NzLmNsb3N1cmUtbGlicmFyeS5nb29nbGVjb2RlLmNvbS9naXQvY2xvc3VyZV9nb29nX2RhdGVfZGF0ZS5qcy5zb3VyY2UuaHRtbFxuICAgIC8vIHNvbWV3aGF0IG1vcmUgaW4gbGluZSB3aXRoIDQuNC4zLjIgMjAwNCBzcGVjLCBidXQgYWxsb3dzIGRlY2ltYWwgYW55d2hlcmVcbiAgICB2YXIgY3JlYXRlX19pc29SZWdleCA9IC9eKC0pP1AoPzooPzooWzAtOSwuXSopWSk/KD86KFswLTksLl0qKU0pPyg/OihbMC05LC5dKilEKT8oPzpUKD86KFswLTksLl0qKUgpPyg/OihbMC05LC5dKilNKT8oPzooWzAtOSwuXSopUyk/KT98KFswLTksLl0qKVcpJC87XG5cbiAgICBmdW5jdGlvbiBjcmVhdGVfX2NyZWF0ZUR1cmF0aW9uIChpbnB1dCwga2V5KSB7XG4gICAgICAgIHZhciBkdXJhdGlvbiA9IGlucHV0LFxuICAgICAgICAgICAgLy8gbWF0Y2hpbmcgYWdhaW5zdCByZWdleHAgaXMgZXhwZW5zaXZlLCBkbyBpdCBvbiBkZW1hbmRcbiAgICAgICAgICAgIG1hdGNoID0gbnVsbCxcbiAgICAgICAgICAgIHNpZ24sXG4gICAgICAgICAgICByZXQsXG4gICAgICAgICAgICBkaWZmUmVzO1xuXG4gICAgICAgIGlmIChpc0R1cmF0aW9uKGlucHV0KSkge1xuICAgICAgICAgICAgZHVyYXRpb24gPSB7XG4gICAgICAgICAgICAgICAgbXMgOiBpbnB1dC5fbWlsbGlzZWNvbmRzLFxuICAgICAgICAgICAgICAgIGQgIDogaW5wdXQuX2RheXMsXG4gICAgICAgICAgICAgICAgTSAgOiBpbnB1dC5fbW9udGhzXG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBpbnB1dCA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIGR1cmF0aW9uID0ge307XG4gICAgICAgICAgICBpZiAoa2V5KSB7XG4gICAgICAgICAgICAgICAgZHVyYXRpb25ba2V5XSA9IGlucHV0O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBkdXJhdGlvbi5taWxsaXNlY29uZHMgPSBpbnB1dDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmICghIShtYXRjaCA9IGFzcE5ldFJlZ2V4LmV4ZWMoaW5wdXQpKSkge1xuICAgICAgICAgICAgc2lnbiA9IChtYXRjaFsxXSA9PT0gJy0nKSA/IC0xIDogMTtcbiAgICAgICAgICAgIGR1cmF0aW9uID0ge1xuICAgICAgICAgICAgICAgIHkgIDogMCxcbiAgICAgICAgICAgICAgICBkICA6IHRvSW50KG1hdGNoW0RBVEVdKSAgICAgICAgKiBzaWduLFxuICAgICAgICAgICAgICAgIGggIDogdG9JbnQobWF0Y2hbSE9VUl0pICAgICAgICAqIHNpZ24sXG4gICAgICAgICAgICAgICAgbSAgOiB0b0ludChtYXRjaFtNSU5VVEVdKSAgICAgICogc2lnbixcbiAgICAgICAgICAgICAgICBzICA6IHRvSW50KG1hdGNoW1NFQ09ORF0pICAgICAgKiBzaWduLFxuICAgICAgICAgICAgICAgIG1zIDogdG9JbnQobWF0Y2hbTUlMTElTRUNPTkRdKSAqIHNpZ25cbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gZWxzZSBpZiAoISEobWF0Y2ggPSBjcmVhdGVfX2lzb1JlZ2V4LmV4ZWMoaW5wdXQpKSkge1xuICAgICAgICAgICAgc2lnbiA9IChtYXRjaFsxXSA9PT0gJy0nKSA/IC0xIDogMTtcbiAgICAgICAgICAgIGR1cmF0aW9uID0ge1xuICAgICAgICAgICAgICAgIHkgOiBwYXJzZUlzbyhtYXRjaFsyXSwgc2lnbiksXG4gICAgICAgICAgICAgICAgTSA6IHBhcnNlSXNvKG1hdGNoWzNdLCBzaWduKSxcbiAgICAgICAgICAgICAgICBkIDogcGFyc2VJc28obWF0Y2hbNF0sIHNpZ24pLFxuICAgICAgICAgICAgICAgIGggOiBwYXJzZUlzbyhtYXRjaFs1XSwgc2lnbiksXG4gICAgICAgICAgICAgICAgbSA6IHBhcnNlSXNvKG1hdGNoWzZdLCBzaWduKSxcbiAgICAgICAgICAgICAgICBzIDogcGFyc2VJc28obWF0Y2hbN10sIHNpZ24pLFxuICAgICAgICAgICAgICAgIHcgOiBwYXJzZUlzbyhtYXRjaFs4XSwgc2lnbilcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gZWxzZSBpZiAoZHVyYXRpb24gPT0gbnVsbCkgey8vIGNoZWNrcyBmb3IgbnVsbCBvciB1bmRlZmluZWRcbiAgICAgICAgICAgIGR1cmF0aW9uID0ge307XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGR1cmF0aW9uID09PSAnb2JqZWN0JyAmJiAoJ2Zyb20nIGluIGR1cmF0aW9uIHx8ICd0bycgaW4gZHVyYXRpb24pKSB7XG4gICAgICAgICAgICBkaWZmUmVzID0gbW9tZW50c0RpZmZlcmVuY2UobG9jYWxfX2NyZWF0ZUxvY2FsKGR1cmF0aW9uLmZyb20pLCBsb2NhbF9fY3JlYXRlTG9jYWwoZHVyYXRpb24udG8pKTtcblxuICAgICAgICAgICAgZHVyYXRpb24gPSB7fTtcbiAgICAgICAgICAgIGR1cmF0aW9uLm1zID0gZGlmZlJlcy5taWxsaXNlY29uZHM7XG4gICAgICAgICAgICBkdXJhdGlvbi5NID0gZGlmZlJlcy5tb250aHM7XG4gICAgICAgIH1cblxuICAgICAgICByZXQgPSBuZXcgRHVyYXRpb24oZHVyYXRpb24pO1xuXG4gICAgICAgIGlmIChpc0R1cmF0aW9uKGlucHV0KSAmJiBoYXNPd25Qcm9wKGlucHV0LCAnX2xvY2FsZScpKSB7XG4gICAgICAgICAgICByZXQuX2xvY2FsZSA9IGlucHV0Ll9sb2NhbGU7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmV0O1xuICAgIH1cblxuICAgIGNyZWF0ZV9fY3JlYXRlRHVyYXRpb24uZm4gPSBEdXJhdGlvbi5wcm90b3R5cGU7XG5cbiAgICBmdW5jdGlvbiBwYXJzZUlzbyAoaW5wLCBzaWduKSB7XG4gICAgICAgIC8vIFdlJ2Qgbm9ybWFsbHkgdXNlIH5+aW5wIGZvciB0aGlzLCBidXQgdW5mb3J0dW5hdGVseSBpdCBhbHNvXG4gICAgICAgIC8vIGNvbnZlcnRzIGZsb2F0cyB0byBpbnRzLlxuICAgICAgICAvLyBpbnAgbWF5IGJlIHVuZGVmaW5lZCwgc28gY2FyZWZ1bCBjYWxsaW5nIHJlcGxhY2Ugb24gaXQuXG4gICAgICAgIHZhciByZXMgPSBpbnAgJiYgcGFyc2VGbG9hdChpbnAucmVwbGFjZSgnLCcsICcuJykpO1xuICAgICAgICAvLyBhcHBseSBzaWduIHdoaWxlIHdlJ3JlIGF0IGl0XG4gICAgICAgIHJldHVybiAoaXNOYU4ocmVzKSA/IDAgOiByZXMpICogc2lnbjtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwb3NpdGl2ZU1vbWVudHNEaWZmZXJlbmNlKGJhc2UsIG90aGVyKSB7XG4gICAgICAgIHZhciByZXMgPSB7bWlsbGlzZWNvbmRzOiAwLCBtb250aHM6IDB9O1xuXG4gICAgICAgIHJlcy5tb250aHMgPSBvdGhlci5tb250aCgpIC0gYmFzZS5tb250aCgpICtcbiAgICAgICAgICAgIChvdGhlci55ZWFyKCkgLSBiYXNlLnllYXIoKSkgKiAxMjtcbiAgICAgICAgaWYgKGJhc2UuY2xvbmUoKS5hZGQocmVzLm1vbnRocywgJ00nKS5pc0FmdGVyKG90aGVyKSkge1xuICAgICAgICAgICAgLS1yZXMubW9udGhzO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVzLm1pbGxpc2Vjb25kcyA9ICtvdGhlciAtICsoYmFzZS5jbG9uZSgpLmFkZChyZXMubW9udGhzLCAnTScpKTtcblxuICAgICAgICByZXR1cm4gcmVzO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG1vbWVudHNEaWZmZXJlbmNlKGJhc2UsIG90aGVyKSB7XG4gICAgICAgIHZhciByZXM7XG4gICAgICAgIG90aGVyID0gY2xvbmVXaXRoT2Zmc2V0KG90aGVyLCBiYXNlKTtcbiAgICAgICAgaWYgKGJhc2UuaXNCZWZvcmUob3RoZXIpKSB7XG4gICAgICAgICAgICByZXMgPSBwb3NpdGl2ZU1vbWVudHNEaWZmZXJlbmNlKGJhc2UsIG90aGVyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlcyA9IHBvc2l0aXZlTW9tZW50c0RpZmZlcmVuY2Uob3RoZXIsIGJhc2UpO1xuICAgICAgICAgICAgcmVzLm1pbGxpc2Vjb25kcyA9IC1yZXMubWlsbGlzZWNvbmRzO1xuICAgICAgICAgICAgcmVzLm1vbnRocyA9IC1yZXMubW9udGhzO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlcztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjcmVhdGVBZGRlcihkaXJlY3Rpb24sIG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICh2YWwsIHBlcmlvZCkge1xuICAgICAgICAgICAgdmFyIGR1ciwgdG1wO1xuICAgICAgICAgICAgLy9pbnZlcnQgdGhlIGFyZ3VtZW50cywgYnV0IGNvbXBsYWluIGFib3V0IGl0XG4gICAgICAgICAgICBpZiAocGVyaW9kICE9PSBudWxsICYmICFpc05hTigrcGVyaW9kKSkge1xuICAgICAgICAgICAgICAgIGRlcHJlY2F0ZVNpbXBsZShuYW1lLCAnbW9tZW50KCkuJyArIG5hbWUgICsgJyhwZXJpb2QsIG51bWJlcikgaXMgZGVwcmVjYXRlZC4gUGxlYXNlIHVzZSBtb21lbnQoKS4nICsgbmFtZSArICcobnVtYmVyLCBwZXJpb2QpLicpO1xuICAgICAgICAgICAgICAgIHRtcCA9IHZhbDsgdmFsID0gcGVyaW9kOyBwZXJpb2QgPSB0bXA7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhbCA9IHR5cGVvZiB2YWwgPT09ICdzdHJpbmcnID8gK3ZhbCA6IHZhbDtcbiAgICAgICAgICAgIGR1ciA9IGNyZWF0ZV9fY3JlYXRlRHVyYXRpb24odmFsLCBwZXJpb2QpO1xuICAgICAgICAgICAgYWRkX3N1YnRyYWN0X19hZGRTdWJ0cmFjdCh0aGlzLCBkdXIsIGRpcmVjdGlvbik7XG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhZGRfc3VidHJhY3RfX2FkZFN1YnRyYWN0IChtb20sIGR1cmF0aW9uLCBpc0FkZGluZywgdXBkYXRlT2Zmc2V0KSB7XG4gICAgICAgIHZhciBtaWxsaXNlY29uZHMgPSBkdXJhdGlvbi5fbWlsbGlzZWNvbmRzLFxuICAgICAgICAgICAgZGF5cyA9IGR1cmF0aW9uLl9kYXlzLFxuICAgICAgICAgICAgbW9udGhzID0gZHVyYXRpb24uX21vbnRocztcbiAgICAgICAgdXBkYXRlT2Zmc2V0ID0gdXBkYXRlT2Zmc2V0ID09IG51bGwgPyB0cnVlIDogdXBkYXRlT2Zmc2V0O1xuXG4gICAgICAgIGlmIChtaWxsaXNlY29uZHMpIHtcbiAgICAgICAgICAgIG1vbS5fZC5zZXRUaW1lKCttb20uX2QgKyBtaWxsaXNlY29uZHMgKiBpc0FkZGluZyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRheXMpIHtcbiAgICAgICAgICAgIGdldF9zZXRfX3NldChtb20sICdEYXRlJywgZ2V0X3NldF9fZ2V0KG1vbSwgJ0RhdGUnKSArIGRheXMgKiBpc0FkZGluZyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1vbnRocykge1xuICAgICAgICAgICAgc2V0TW9udGgobW9tLCBnZXRfc2V0X19nZXQobW9tLCAnTW9udGgnKSArIG1vbnRocyAqIGlzQWRkaW5nKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodXBkYXRlT2Zmc2V0KSB7XG4gICAgICAgICAgICB1dGlsc19ob29rc19faG9va3MudXBkYXRlT2Zmc2V0KG1vbSwgZGF5cyB8fCBtb250aHMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdmFyIGFkZF9zdWJ0cmFjdF9fYWRkICAgICAgPSBjcmVhdGVBZGRlcigxLCAnYWRkJyk7XG4gICAgdmFyIGFkZF9zdWJ0cmFjdF9fc3VidHJhY3QgPSBjcmVhdGVBZGRlcigtMSwgJ3N1YnRyYWN0Jyk7XG5cbiAgICBmdW5jdGlvbiBtb21lbnRfY2FsZW5kYXJfX2NhbGVuZGFyICh0aW1lKSB7XG4gICAgICAgIC8vIFdlIHdhbnQgdG8gY29tcGFyZSB0aGUgc3RhcnQgb2YgdG9kYXksIHZzIHRoaXMuXG4gICAgICAgIC8vIEdldHRpbmcgc3RhcnQtb2YtdG9kYXkgZGVwZW5kcyBvbiB3aGV0aGVyIHdlJ3JlIGxvY2FsL3V0Yy9vZmZzZXQgb3Igbm90LlxuICAgICAgICB2YXIgbm93ID0gdGltZSB8fCBsb2NhbF9fY3JlYXRlTG9jYWwoKSxcbiAgICAgICAgICAgIHNvZCA9IGNsb25lV2l0aE9mZnNldChub3csIHRoaXMpLnN0YXJ0T2YoJ2RheScpLFxuICAgICAgICAgICAgZGlmZiA9IHRoaXMuZGlmZihzb2QsICdkYXlzJywgdHJ1ZSksXG4gICAgICAgICAgICBmb3JtYXQgPSBkaWZmIDwgLTYgPyAnc2FtZUVsc2UnIDpcbiAgICAgICAgICAgICAgICBkaWZmIDwgLTEgPyAnbGFzdFdlZWsnIDpcbiAgICAgICAgICAgICAgICBkaWZmIDwgMCA/ICdsYXN0RGF5JyA6XG4gICAgICAgICAgICAgICAgZGlmZiA8IDEgPyAnc2FtZURheScgOlxuICAgICAgICAgICAgICAgIGRpZmYgPCAyID8gJ25leHREYXknIDpcbiAgICAgICAgICAgICAgICBkaWZmIDwgNyA/ICduZXh0V2VlaycgOiAnc2FtZUVsc2UnO1xuICAgICAgICByZXR1cm4gdGhpcy5mb3JtYXQodGhpcy5sb2NhbGVEYXRhKCkuY2FsZW5kYXIoZm9ybWF0LCB0aGlzLCBsb2NhbF9fY3JlYXRlTG9jYWwobm93KSkpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNsb25lICgpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBNb21lbnQodGhpcyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaXNBZnRlciAoaW5wdXQsIHVuaXRzKSB7XG4gICAgICAgIHZhciBpbnB1dE1zO1xuICAgICAgICB1bml0cyA9IG5vcm1hbGl6ZVVuaXRzKHR5cGVvZiB1bml0cyAhPT0gJ3VuZGVmaW5lZCcgPyB1bml0cyA6ICdtaWxsaXNlY29uZCcpO1xuICAgICAgICBpZiAodW5pdHMgPT09ICdtaWxsaXNlY29uZCcpIHtcbiAgICAgICAgICAgIGlucHV0ID0gaXNNb21lbnQoaW5wdXQpID8gaW5wdXQgOiBsb2NhbF9fY3JlYXRlTG9jYWwoaW5wdXQpO1xuICAgICAgICAgICAgcmV0dXJuICt0aGlzID4gK2lucHV0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaW5wdXRNcyA9IGlzTW9tZW50KGlucHV0KSA/ICtpbnB1dCA6ICtsb2NhbF9fY3JlYXRlTG9jYWwoaW5wdXQpO1xuICAgICAgICAgICAgcmV0dXJuIGlucHV0TXMgPCArdGhpcy5jbG9uZSgpLnN0YXJ0T2YodW5pdHMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaXNCZWZvcmUgKGlucHV0LCB1bml0cykge1xuICAgICAgICB2YXIgaW5wdXRNcztcbiAgICAgICAgdW5pdHMgPSBub3JtYWxpemVVbml0cyh0eXBlb2YgdW5pdHMgIT09ICd1bmRlZmluZWQnID8gdW5pdHMgOiAnbWlsbGlzZWNvbmQnKTtcbiAgICAgICAgaWYgKHVuaXRzID09PSAnbWlsbGlzZWNvbmQnKSB7XG4gICAgICAgICAgICBpbnB1dCA9IGlzTW9tZW50KGlucHV0KSA/IGlucHV0IDogbG9jYWxfX2NyZWF0ZUxvY2FsKGlucHV0KTtcbiAgICAgICAgICAgIHJldHVybiArdGhpcyA8ICtpbnB1dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlucHV0TXMgPSBpc01vbWVudChpbnB1dCkgPyAraW5wdXQgOiArbG9jYWxfX2NyZWF0ZUxvY2FsKGlucHV0KTtcbiAgICAgICAgICAgIHJldHVybiArdGhpcy5jbG9uZSgpLmVuZE9mKHVuaXRzKSA8IGlucHV0TXM7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpc0JldHdlZW4gKGZyb20sIHRvLCB1bml0cykge1xuICAgICAgICByZXR1cm4gdGhpcy5pc0FmdGVyKGZyb20sIHVuaXRzKSAmJiB0aGlzLmlzQmVmb3JlKHRvLCB1bml0cyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaXNTYW1lIChpbnB1dCwgdW5pdHMpIHtcbiAgICAgICAgdmFyIGlucHV0TXM7XG4gICAgICAgIHVuaXRzID0gbm9ybWFsaXplVW5pdHModW5pdHMgfHwgJ21pbGxpc2Vjb25kJyk7XG4gICAgICAgIGlmICh1bml0cyA9PT0gJ21pbGxpc2Vjb25kJykge1xuICAgICAgICAgICAgaW5wdXQgPSBpc01vbWVudChpbnB1dCkgPyBpbnB1dCA6IGxvY2FsX19jcmVhdGVMb2NhbChpbnB1dCk7XG4gICAgICAgICAgICByZXR1cm4gK3RoaXMgPT09ICtpbnB1dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlucHV0TXMgPSArbG9jYWxfX2NyZWF0ZUxvY2FsKGlucHV0KTtcbiAgICAgICAgICAgIHJldHVybiArKHRoaXMuY2xvbmUoKS5zdGFydE9mKHVuaXRzKSkgPD0gaW5wdXRNcyAmJiBpbnB1dE1zIDw9ICsodGhpcy5jbG9uZSgpLmVuZE9mKHVuaXRzKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhYnNGbG9vciAobnVtYmVyKSB7XG4gICAgICAgIGlmIChudW1iZXIgPCAwKSB7XG4gICAgICAgICAgICByZXR1cm4gTWF0aC5jZWlsKG51bWJlcik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gTWF0aC5mbG9vcihudW1iZXIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGlmZiAoaW5wdXQsIHVuaXRzLCBhc0Zsb2F0KSB7XG4gICAgICAgIHZhciB0aGF0ID0gY2xvbmVXaXRoT2Zmc2V0KGlucHV0LCB0aGlzKSxcbiAgICAgICAgICAgIHpvbmVEZWx0YSA9ICh0aGF0LnV0Y09mZnNldCgpIC0gdGhpcy51dGNPZmZzZXQoKSkgKiA2ZTQsXG4gICAgICAgICAgICBkZWx0YSwgb3V0cHV0O1xuXG4gICAgICAgIHVuaXRzID0gbm9ybWFsaXplVW5pdHModW5pdHMpO1xuXG4gICAgICAgIGlmICh1bml0cyA9PT0gJ3llYXInIHx8IHVuaXRzID09PSAnbW9udGgnIHx8IHVuaXRzID09PSAncXVhcnRlcicpIHtcbiAgICAgICAgICAgIG91dHB1dCA9IG1vbnRoRGlmZih0aGlzLCB0aGF0KTtcbiAgICAgICAgICAgIGlmICh1bml0cyA9PT0gJ3F1YXJ0ZXInKSB7XG4gICAgICAgICAgICAgICAgb3V0cHV0ID0gb3V0cHV0IC8gMztcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodW5pdHMgPT09ICd5ZWFyJykge1xuICAgICAgICAgICAgICAgIG91dHB1dCA9IG91dHB1dCAvIDEyO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGVsdGEgPSB0aGlzIC0gdGhhdDtcbiAgICAgICAgICAgIG91dHB1dCA9IHVuaXRzID09PSAnc2Vjb25kJyA/IGRlbHRhIC8gMWUzIDogLy8gMTAwMFxuICAgICAgICAgICAgICAgIHVuaXRzID09PSAnbWludXRlJyA/IGRlbHRhIC8gNmU0IDogLy8gMTAwMCAqIDYwXG4gICAgICAgICAgICAgICAgdW5pdHMgPT09ICdob3VyJyA/IGRlbHRhIC8gMzZlNSA6IC8vIDEwMDAgKiA2MCAqIDYwXG4gICAgICAgICAgICAgICAgdW5pdHMgPT09ICdkYXknID8gKGRlbHRhIC0gem9uZURlbHRhKSAvIDg2NGU1IDogLy8gMTAwMCAqIDYwICogNjAgKiAyNCwgbmVnYXRlIGRzdFxuICAgICAgICAgICAgICAgIHVuaXRzID09PSAnd2VlaycgPyAoZGVsdGEgLSB6b25lRGVsdGEpIC8gNjA0OGU1IDogLy8gMTAwMCAqIDYwICogNjAgKiAyNCAqIDcsIG5lZ2F0ZSBkc3RcbiAgICAgICAgICAgICAgICBkZWx0YTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYXNGbG9hdCA/IG91dHB1dCA6IGFic0Zsb29yKG91dHB1dCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbW9udGhEaWZmIChhLCBiKSB7XG4gICAgICAgIC8vIGRpZmZlcmVuY2UgaW4gbW9udGhzXG4gICAgICAgIHZhciB3aG9sZU1vbnRoRGlmZiA9ICgoYi55ZWFyKCkgLSBhLnllYXIoKSkgKiAxMikgKyAoYi5tb250aCgpIC0gYS5tb250aCgpKSxcbiAgICAgICAgICAgIC8vIGIgaXMgaW4gKGFuY2hvciAtIDEgbW9udGgsIGFuY2hvciArIDEgbW9udGgpXG4gICAgICAgICAgICBhbmNob3IgPSBhLmNsb25lKCkuYWRkKHdob2xlTW9udGhEaWZmLCAnbW9udGhzJyksXG4gICAgICAgICAgICBhbmNob3IyLCBhZGp1c3Q7XG5cbiAgICAgICAgaWYgKGIgLSBhbmNob3IgPCAwKSB7XG4gICAgICAgICAgICBhbmNob3IyID0gYS5jbG9uZSgpLmFkZCh3aG9sZU1vbnRoRGlmZiAtIDEsICdtb250aHMnKTtcbiAgICAgICAgICAgIC8vIGxpbmVhciBhY3Jvc3MgdGhlIG1vbnRoXG4gICAgICAgICAgICBhZGp1c3QgPSAoYiAtIGFuY2hvcikgLyAoYW5jaG9yIC0gYW5jaG9yMik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhbmNob3IyID0gYS5jbG9uZSgpLmFkZCh3aG9sZU1vbnRoRGlmZiArIDEsICdtb250aHMnKTtcbiAgICAgICAgICAgIC8vIGxpbmVhciBhY3Jvc3MgdGhlIG1vbnRoXG4gICAgICAgICAgICBhZGp1c3QgPSAoYiAtIGFuY2hvcikgLyAoYW5jaG9yMiAtIGFuY2hvcik7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gLSh3aG9sZU1vbnRoRGlmZiArIGFkanVzdCk7XG4gICAgfVxuXG4gICAgdXRpbHNfaG9va3NfX2hvb2tzLmRlZmF1bHRGb3JtYXQgPSAnWVlZWS1NTS1ERFRISDptbTpzc1onO1xuXG4gICAgZnVuY3Rpb24gdG9TdHJpbmcgKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jbG9uZSgpLmxvY2FsZSgnZW4nKS5mb3JtYXQoJ2RkZCBNTU0gREQgWVlZWSBISDptbTpzcyBbR01UXVpaJyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbW9tZW50X2Zvcm1hdF9fdG9JU09TdHJpbmcgKCkge1xuICAgICAgICB2YXIgbSA9IHRoaXMuY2xvbmUoKS51dGMoKTtcbiAgICAgICAgaWYgKDAgPCBtLnllYXIoKSAmJiBtLnllYXIoKSA8PSA5OTk5KSB7XG4gICAgICAgICAgICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIERhdGUucHJvdG90eXBlLnRvSVNPU3RyaW5nKSB7XG4gICAgICAgICAgICAgICAgLy8gbmF0aXZlIGltcGxlbWVudGF0aW9uIGlzIH41MHggZmFzdGVyLCB1c2UgaXQgd2hlbiB3ZSBjYW5cbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy50b0RhdGUoKS50b0lTT1N0cmluZygpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZm9ybWF0TW9tZW50KG0sICdZWVlZLU1NLUREW1RdSEg6bW06c3MuU1NTW1pdJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gZm9ybWF0TW9tZW50KG0sICdZWVlZWVktTU0tRERbVF1ISDptbTpzcy5TU1NbWl0nKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGZvcm1hdCAoaW5wdXRTdHJpbmcpIHtcbiAgICAgICAgdmFyIG91dHB1dCA9IGZvcm1hdE1vbWVudCh0aGlzLCBpbnB1dFN0cmluZyB8fCB1dGlsc19ob29rc19faG9va3MuZGVmYXVsdEZvcm1hdCk7XG4gICAgICAgIHJldHVybiB0aGlzLmxvY2FsZURhdGEoKS5wb3N0Zm9ybWF0KG91dHB1dCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZnJvbSAodGltZSwgd2l0aG91dFN1ZmZpeCkge1xuICAgICAgICByZXR1cm4gY3JlYXRlX19jcmVhdGVEdXJhdGlvbih7dG86IHRoaXMsIGZyb206IHRpbWV9KS5sb2NhbGUodGhpcy5sb2NhbGUoKSkuaHVtYW5pemUoIXdpdGhvdXRTdWZmaXgpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGZyb21Ob3cgKHdpdGhvdXRTdWZmaXgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZnJvbShsb2NhbF9fY3JlYXRlTG9jYWwoKSwgd2l0aG91dFN1ZmZpeCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbG9jYWxlIChrZXkpIHtcbiAgICAgICAgdmFyIG5ld0xvY2FsZURhdGE7XG5cbiAgICAgICAgaWYgKGtleSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fbG9jYWxlLl9hYmJyO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbmV3TG9jYWxlRGF0YSA9IGxvY2FsZV9sb2NhbGVzX19nZXRMb2NhbGUoa2V5KTtcbiAgICAgICAgICAgIGlmIChuZXdMb2NhbGVEYXRhICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9sb2NhbGUgPSBuZXdMb2NhbGVEYXRhO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgbGFuZyA9IGRlcHJlY2F0ZShcbiAgICAgICAgJ21vbWVudCgpLmxhbmcoKSBpcyBkZXByZWNhdGVkLiBJbnN0ZWFkLCB1c2UgbW9tZW50KCkubG9jYWxlRGF0YSgpIHRvIGdldCB0aGUgbGFuZ3VhZ2UgY29uZmlndXJhdGlvbi4gVXNlIG1vbWVudCgpLmxvY2FsZSgpIHRvIGNoYW5nZSBsYW5ndWFnZXMuJyxcbiAgICAgICAgZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgaWYgKGtleSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubG9jYWxlRGF0YSgpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5sb2NhbGUoa2V5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICk7XG5cbiAgICBmdW5jdGlvbiBsb2NhbGVEYXRhICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xvY2FsZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzdGFydE9mICh1bml0cykge1xuICAgICAgICB1bml0cyA9IG5vcm1hbGl6ZVVuaXRzKHVuaXRzKTtcbiAgICAgICAgLy8gdGhlIGZvbGxvd2luZyBzd2l0Y2ggaW50ZW50aW9uYWxseSBvbWl0cyBicmVhayBrZXl3b3Jkc1xuICAgICAgICAvLyB0byB1dGlsaXplIGZhbGxpbmcgdGhyb3VnaCB0aGUgY2FzZXMuXG4gICAgICAgIHN3aXRjaCAodW5pdHMpIHtcbiAgICAgICAgY2FzZSAneWVhcic6XG4gICAgICAgICAgICB0aGlzLm1vbnRoKDApO1xuICAgICAgICAgICAgLyogZmFsbHMgdGhyb3VnaCAqL1xuICAgICAgICBjYXNlICdxdWFydGVyJzpcbiAgICAgICAgY2FzZSAnbW9udGgnOlxuICAgICAgICAgICAgdGhpcy5kYXRlKDEpO1xuICAgICAgICAgICAgLyogZmFsbHMgdGhyb3VnaCAqL1xuICAgICAgICBjYXNlICd3ZWVrJzpcbiAgICAgICAgY2FzZSAnaXNvV2Vlayc6XG4gICAgICAgIGNhc2UgJ2RheSc6XG4gICAgICAgICAgICB0aGlzLmhvdXJzKDApO1xuICAgICAgICAgICAgLyogZmFsbHMgdGhyb3VnaCAqL1xuICAgICAgICBjYXNlICdob3VyJzpcbiAgICAgICAgICAgIHRoaXMubWludXRlcygwKTtcbiAgICAgICAgICAgIC8qIGZhbGxzIHRocm91Z2ggKi9cbiAgICAgICAgY2FzZSAnbWludXRlJzpcbiAgICAgICAgICAgIHRoaXMuc2Vjb25kcygwKTtcbiAgICAgICAgICAgIC8qIGZhbGxzIHRocm91Z2ggKi9cbiAgICAgICAgY2FzZSAnc2Vjb25kJzpcbiAgICAgICAgICAgIHRoaXMubWlsbGlzZWNvbmRzKDApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gd2Vla3MgYXJlIGEgc3BlY2lhbCBjYXNlXG4gICAgICAgIGlmICh1bml0cyA9PT0gJ3dlZWsnKSB7XG4gICAgICAgICAgICB0aGlzLndlZWtkYXkoMCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHVuaXRzID09PSAnaXNvV2VlaycpIHtcbiAgICAgICAgICAgIHRoaXMuaXNvV2Vla2RheSgxKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHF1YXJ0ZXJzIGFyZSBhbHNvIHNwZWNpYWxcbiAgICAgICAgaWYgKHVuaXRzID09PSAncXVhcnRlcicpIHtcbiAgICAgICAgICAgIHRoaXMubW9udGgoTWF0aC5mbG9vcih0aGlzLm1vbnRoKCkgLyAzKSAqIDMpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZW5kT2YgKHVuaXRzKSB7XG4gICAgICAgIHVuaXRzID0gbm9ybWFsaXplVW5pdHModW5pdHMpO1xuICAgICAgICBpZiAodW5pdHMgPT09IHVuZGVmaW5lZCB8fCB1bml0cyA9PT0gJ21pbGxpc2Vjb25kJykge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuc3RhcnRPZih1bml0cykuYWRkKDEsICh1bml0cyA9PT0gJ2lzb1dlZWsnID8gJ3dlZWsnIDogdW5pdHMpKS5zdWJ0cmFjdCgxLCAnbXMnKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB0b190eXBlX192YWx1ZU9mICgpIHtcbiAgICAgICAgcmV0dXJuICt0aGlzLl9kIC0gKCh0aGlzLl9vZmZzZXQgfHwgMCkgKiA2MDAwMCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdW5peCAoKSB7XG4gICAgICAgIHJldHVybiBNYXRoLmZsb29yKCt0aGlzIC8gMTAwMCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdG9EYXRlICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX29mZnNldCA/IG5ldyBEYXRlKCt0aGlzKSA6IHRoaXMuX2Q7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdG9BcnJheSAoKSB7XG4gICAgICAgIHZhciBtID0gdGhpcztcbiAgICAgICAgcmV0dXJuIFttLnllYXIoKSwgbS5tb250aCgpLCBtLmRhdGUoKSwgbS5ob3VyKCksIG0ubWludXRlKCksIG0uc2Vjb25kKCksIG0ubWlsbGlzZWNvbmQoKV07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbW9tZW50X3ZhbGlkX19pc1ZhbGlkICgpIHtcbiAgICAgICAgcmV0dXJuIHZhbGlkX19pc1ZhbGlkKHRoaXMpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBhcnNpbmdGbGFncyAoKSB7XG4gICAgICAgIHJldHVybiBleHRlbmQoe30sIHRoaXMuX3BmKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpbnZhbGlkQXQgKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcGYub3ZlcmZsb3c7XG4gICAgfVxuXG4gICAgYWRkRm9ybWF0VG9rZW4oMCwgWydnZycsIDJdLCAwLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLndlZWtZZWFyKCkgJSAxMDA7XG4gICAgfSk7XG5cbiAgICBhZGRGb3JtYXRUb2tlbigwLCBbJ0dHJywgMl0sIDAsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNvV2Vla1llYXIoKSAlIDEwMDtcbiAgICB9KTtcblxuICAgIGZ1bmN0aW9uIGFkZFdlZWtZZWFyRm9ybWF0VG9rZW4gKHRva2VuLCBnZXR0ZXIpIHtcbiAgICAgICAgYWRkRm9ybWF0VG9rZW4oMCwgW3Rva2VuLCB0b2tlbi5sZW5ndGhdLCAwLCBnZXR0ZXIpO1xuICAgIH1cblxuICAgIGFkZFdlZWtZZWFyRm9ybWF0VG9rZW4oJ2dnZ2cnLCAgICAgJ3dlZWtZZWFyJyk7XG4gICAgYWRkV2Vla1llYXJGb3JtYXRUb2tlbignZ2dnZ2cnLCAgICAnd2Vla1llYXInKTtcbiAgICBhZGRXZWVrWWVhckZvcm1hdFRva2VuKCdHR0dHJywgICdpc29XZWVrWWVhcicpO1xuICAgIGFkZFdlZWtZZWFyRm9ybWF0VG9rZW4oJ0dHR0dHJywgJ2lzb1dlZWtZZWFyJyk7XG5cbiAgICAvLyBBTElBU0VTXG5cbiAgICBhZGRVbml0QWxpYXMoJ3dlZWtZZWFyJywgJ2dnJyk7XG4gICAgYWRkVW5pdEFsaWFzKCdpc29XZWVrWWVhcicsICdHRycpO1xuXG4gICAgLy8gUEFSU0lOR1xuXG4gICAgYWRkUmVnZXhUb2tlbignRycsICAgICAgbWF0Y2hTaWduZWQpO1xuICAgIGFkZFJlZ2V4VG9rZW4oJ2cnLCAgICAgIG1hdGNoU2lnbmVkKTtcbiAgICBhZGRSZWdleFRva2VuKCdHRycsICAgICBtYXRjaDF0bzIsIG1hdGNoMik7XG4gICAgYWRkUmVnZXhUb2tlbignZ2cnLCAgICAgbWF0Y2gxdG8yLCBtYXRjaDIpO1xuICAgIGFkZFJlZ2V4VG9rZW4oJ0dHR0cnLCAgIG1hdGNoMXRvNCwgbWF0Y2g0KTtcbiAgICBhZGRSZWdleFRva2VuKCdnZ2dnJywgICBtYXRjaDF0bzQsIG1hdGNoNCk7XG4gICAgYWRkUmVnZXhUb2tlbignR0dHR0cnLCAgbWF0Y2gxdG82LCBtYXRjaDYpO1xuICAgIGFkZFJlZ2V4VG9rZW4oJ2dnZ2dnJywgIG1hdGNoMXRvNiwgbWF0Y2g2KTtcblxuICAgIGFkZFdlZWtQYXJzZVRva2VuKFsnZ2dnZycsICdnZ2dnZycsICdHR0dHJywgJ0dHR0dHJ10sIGZ1bmN0aW9uIChpbnB1dCwgd2VlaywgY29uZmlnLCB0b2tlbikge1xuICAgICAgICB3ZWVrW3Rva2VuLnN1YnN0cigwLCAyKV0gPSB0b0ludChpbnB1dCk7XG4gICAgfSk7XG5cbiAgICBhZGRXZWVrUGFyc2VUb2tlbihbJ2dnJywgJ0dHJ10sIGZ1bmN0aW9uIChpbnB1dCwgd2VlaywgY29uZmlnLCB0b2tlbikge1xuICAgICAgICB3ZWVrW3Rva2VuXSA9IHV0aWxzX2hvb2tzX19ob29rcy5wYXJzZVR3b0RpZ2l0WWVhcihpbnB1dCk7XG4gICAgfSk7XG5cbiAgICAvLyBIRUxQRVJTXG5cbiAgICBmdW5jdGlvbiB3ZWVrc0luWWVhcih5ZWFyLCBkb3csIGRveSkge1xuICAgICAgICByZXR1cm4gd2Vla09mWWVhcihsb2NhbF9fY3JlYXRlTG9jYWwoW3llYXIsIDExLCAzMSArIGRvdyAtIGRveV0pLCBkb3csIGRveSkud2VlaztcbiAgICB9XG5cbiAgICAvLyBNT01FTlRTXG5cbiAgICBmdW5jdGlvbiBnZXRTZXRXZWVrWWVhciAoaW5wdXQpIHtcbiAgICAgICAgdmFyIHllYXIgPSB3ZWVrT2ZZZWFyKHRoaXMsIHRoaXMubG9jYWxlRGF0YSgpLl93ZWVrLmRvdywgdGhpcy5sb2NhbGVEYXRhKCkuX3dlZWsuZG95KS55ZWFyO1xuICAgICAgICByZXR1cm4gaW5wdXQgPT0gbnVsbCA/IHllYXIgOiB0aGlzLmFkZCgoaW5wdXQgLSB5ZWFyKSwgJ3knKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRTZXRJU09XZWVrWWVhciAoaW5wdXQpIHtcbiAgICAgICAgdmFyIHllYXIgPSB3ZWVrT2ZZZWFyKHRoaXMsIDEsIDQpLnllYXI7XG4gICAgICAgIHJldHVybiBpbnB1dCA9PSBudWxsID8geWVhciA6IHRoaXMuYWRkKChpbnB1dCAtIHllYXIpLCAneScpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldElTT1dlZWtzSW5ZZWFyICgpIHtcbiAgICAgICAgcmV0dXJuIHdlZWtzSW5ZZWFyKHRoaXMueWVhcigpLCAxLCA0KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRXZWVrc0luWWVhciAoKSB7XG4gICAgICAgIHZhciB3ZWVrSW5mbyA9IHRoaXMubG9jYWxlRGF0YSgpLl93ZWVrO1xuICAgICAgICByZXR1cm4gd2Vla3NJblllYXIodGhpcy55ZWFyKCksIHdlZWtJbmZvLmRvdywgd2Vla0luZm8uZG95KTtcbiAgICB9XG5cbiAgICBhZGRGb3JtYXRUb2tlbignUScsIDAsIDAsICdxdWFydGVyJyk7XG5cbiAgICAvLyBBTElBU0VTXG5cbiAgICBhZGRVbml0QWxpYXMoJ3F1YXJ0ZXInLCAnUScpO1xuXG4gICAgLy8gUEFSU0lOR1xuXG4gICAgYWRkUmVnZXhUb2tlbignUScsIG1hdGNoMSk7XG4gICAgYWRkUGFyc2VUb2tlbignUScsIGZ1bmN0aW9uIChpbnB1dCwgYXJyYXkpIHtcbiAgICAgICAgYXJyYXlbTU9OVEhdID0gKHRvSW50KGlucHV0KSAtIDEpICogMztcbiAgICB9KTtcblxuICAgIC8vIE1PTUVOVFNcblxuICAgIGZ1bmN0aW9uIGdldFNldFF1YXJ0ZXIgKGlucHV0KSB7XG4gICAgICAgIHJldHVybiBpbnB1dCA9PSBudWxsID8gTWF0aC5jZWlsKCh0aGlzLm1vbnRoKCkgKyAxKSAvIDMpIDogdGhpcy5tb250aCgoaW5wdXQgLSAxKSAqIDMgKyB0aGlzLm1vbnRoKCkgJSAzKTtcbiAgICB9XG5cbiAgICBhZGRGb3JtYXRUb2tlbignRCcsIFsnREQnLCAyXSwgJ0RvJywgJ2RhdGUnKTtcblxuICAgIC8vIEFMSUFTRVNcblxuICAgIGFkZFVuaXRBbGlhcygnZGF0ZScsICdEJyk7XG5cbiAgICAvLyBQQVJTSU5HXG5cbiAgICBhZGRSZWdleFRva2VuKCdEJywgIG1hdGNoMXRvMik7XG4gICAgYWRkUmVnZXhUb2tlbignREQnLCBtYXRjaDF0bzIsIG1hdGNoMik7XG4gICAgYWRkUmVnZXhUb2tlbignRG8nLCBmdW5jdGlvbiAoaXNTdHJpY3QsIGxvY2FsZSkge1xuICAgICAgICByZXR1cm4gaXNTdHJpY3QgPyBsb2NhbGUuX29yZGluYWxQYXJzZSA6IGxvY2FsZS5fb3JkaW5hbFBhcnNlTGVuaWVudDtcbiAgICB9KTtcblxuICAgIGFkZFBhcnNlVG9rZW4oWydEJywgJ0REJ10sIERBVEUpO1xuICAgIGFkZFBhcnNlVG9rZW4oJ0RvJywgZnVuY3Rpb24gKGlucHV0LCBhcnJheSkge1xuICAgICAgICBhcnJheVtEQVRFXSA9IHRvSW50KGlucHV0Lm1hdGNoKG1hdGNoMXRvMilbMF0sIDEwKTtcbiAgICB9KTtcblxuICAgIC8vIE1PTUVOVFNcblxuICAgIHZhciBnZXRTZXREYXlPZk1vbnRoID0gbWFrZUdldFNldCgnRGF0ZScsIHRydWUpO1xuXG4gICAgYWRkRm9ybWF0VG9rZW4oJ2QnLCAwLCAnZG8nLCAnZGF5Jyk7XG5cbiAgICBhZGRGb3JtYXRUb2tlbignZGQnLCAwLCAwLCBmdW5jdGlvbiAoZm9ybWF0KSB7XG4gICAgICAgIHJldHVybiB0aGlzLmxvY2FsZURhdGEoKS53ZWVrZGF5c01pbih0aGlzLCBmb3JtYXQpO1xuICAgIH0pO1xuXG4gICAgYWRkRm9ybWF0VG9rZW4oJ2RkZCcsIDAsIDAsIGZ1bmN0aW9uIChmb3JtYXQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubG9jYWxlRGF0YSgpLndlZWtkYXlzU2hvcnQodGhpcywgZm9ybWF0KTtcbiAgICB9KTtcblxuICAgIGFkZEZvcm1hdFRva2VuKCdkZGRkJywgMCwgMCwgZnVuY3Rpb24gKGZvcm1hdCkge1xuICAgICAgICByZXR1cm4gdGhpcy5sb2NhbGVEYXRhKCkud2Vla2RheXModGhpcywgZm9ybWF0KTtcbiAgICB9KTtcblxuICAgIGFkZEZvcm1hdFRva2VuKCdlJywgMCwgMCwgJ3dlZWtkYXknKTtcbiAgICBhZGRGb3JtYXRUb2tlbignRScsIDAsIDAsICdpc29XZWVrZGF5Jyk7XG5cbiAgICAvLyBBTElBU0VTXG5cbiAgICBhZGRVbml0QWxpYXMoJ2RheScsICdkJyk7XG4gICAgYWRkVW5pdEFsaWFzKCd3ZWVrZGF5JywgJ2UnKTtcbiAgICBhZGRVbml0QWxpYXMoJ2lzb1dlZWtkYXknLCAnRScpO1xuXG4gICAgLy8gUEFSU0lOR1xuXG4gICAgYWRkUmVnZXhUb2tlbignZCcsICAgIG1hdGNoMXRvMik7XG4gICAgYWRkUmVnZXhUb2tlbignZScsICAgIG1hdGNoMXRvMik7XG4gICAgYWRkUmVnZXhUb2tlbignRScsICAgIG1hdGNoMXRvMik7XG4gICAgYWRkUmVnZXhUb2tlbignZGQnLCAgIG1hdGNoV29yZCk7XG4gICAgYWRkUmVnZXhUb2tlbignZGRkJywgIG1hdGNoV29yZCk7XG4gICAgYWRkUmVnZXhUb2tlbignZGRkZCcsIG1hdGNoV29yZCk7XG5cbiAgICBhZGRXZWVrUGFyc2VUb2tlbihbJ2RkJywgJ2RkZCcsICdkZGRkJ10sIGZ1bmN0aW9uIChpbnB1dCwgd2VlaywgY29uZmlnKSB7XG4gICAgICAgIHZhciB3ZWVrZGF5ID0gY29uZmlnLl9sb2NhbGUud2Vla2RheXNQYXJzZShpbnB1dCk7XG4gICAgICAgIC8vIGlmIHdlIGRpZG4ndCBnZXQgYSB3ZWVrZGF5IG5hbWUsIG1hcmsgdGhlIGRhdGUgYXMgaW52YWxpZFxuICAgICAgICBpZiAod2Vla2RheSAhPSBudWxsKSB7XG4gICAgICAgICAgICB3ZWVrLmQgPSB3ZWVrZGF5O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uZmlnLl9wZi5pbnZhbGlkV2Vla2RheSA9IGlucHV0O1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBhZGRXZWVrUGFyc2VUb2tlbihbJ2QnLCAnZScsICdFJ10sIGZ1bmN0aW9uIChpbnB1dCwgd2VlaywgY29uZmlnLCB0b2tlbikge1xuICAgICAgICB3ZWVrW3Rva2VuXSA9IHRvSW50KGlucHV0KTtcbiAgICB9KTtcblxuICAgIC8vIEhFTFBFUlNcblxuICAgIGZ1bmN0aW9uIHBhcnNlV2Vla2RheShpbnB1dCwgbG9jYWxlKSB7XG4gICAgICAgIGlmICh0eXBlb2YgaW5wdXQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBpZiAoIWlzTmFOKGlucHV0KSkge1xuICAgICAgICAgICAgICAgIGlucHV0ID0gcGFyc2VJbnQoaW5wdXQsIDEwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGlucHV0ID0gbG9jYWxlLndlZWtkYXlzUGFyc2UoaW5wdXQpO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgaW5wdXQgIT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gaW5wdXQ7XG4gICAgfVxuXG4gICAgLy8gTE9DQUxFU1xuXG4gICAgdmFyIGRlZmF1bHRMb2NhbGVXZWVrZGF5cyA9ICdTdW5kYXlfTW9uZGF5X1R1ZXNkYXlfV2VkbmVzZGF5X1RodXJzZGF5X0ZyaWRheV9TYXR1cmRheScuc3BsaXQoJ18nKTtcbiAgICBmdW5jdGlvbiBsb2NhbGVXZWVrZGF5cyAobSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fd2Vla2RheXNbbS5kYXkoKV07XG4gICAgfVxuXG4gICAgdmFyIGRlZmF1bHRMb2NhbGVXZWVrZGF5c1Nob3J0ID0gJ1N1bl9Nb25fVHVlX1dlZF9UaHVfRnJpX1NhdCcuc3BsaXQoJ18nKTtcbiAgICBmdW5jdGlvbiBsb2NhbGVXZWVrZGF5c1Nob3J0IChtKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl93ZWVrZGF5c1Nob3J0W20uZGF5KCldO1xuICAgIH1cblxuICAgIHZhciBkZWZhdWx0TG9jYWxlV2Vla2RheXNNaW4gPSAnU3VfTW9fVHVfV2VfVGhfRnJfU2EnLnNwbGl0KCdfJyk7XG4gICAgZnVuY3Rpb24gbG9jYWxlV2Vla2RheXNNaW4gKG0pIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3dlZWtkYXlzTWluW20uZGF5KCldO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxvY2FsZVdlZWtkYXlzUGFyc2UgKHdlZWtkYXlOYW1lKSB7XG4gICAgICAgIHZhciBpLCBtb20sIHJlZ2V4O1xuXG4gICAgICAgIGlmICghdGhpcy5fd2Vla2RheXNQYXJzZSkge1xuICAgICAgICAgICAgdGhpcy5fd2Vla2RheXNQYXJzZSA9IFtdO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChpID0gMDsgaSA8IDc7IGkrKykge1xuICAgICAgICAgICAgLy8gbWFrZSB0aGUgcmVnZXggaWYgd2UgZG9uJ3QgaGF2ZSBpdCBhbHJlYWR5XG4gICAgICAgICAgICBpZiAoIXRoaXMuX3dlZWtkYXlzUGFyc2VbaV0pIHtcbiAgICAgICAgICAgICAgICBtb20gPSBsb2NhbF9fY3JlYXRlTG9jYWwoWzIwMDAsIDFdKS5kYXkoaSk7XG4gICAgICAgICAgICAgICAgcmVnZXggPSAnXicgKyB0aGlzLndlZWtkYXlzKG1vbSwgJycpICsgJ3xeJyArIHRoaXMud2Vla2RheXNTaG9ydChtb20sICcnKSArICd8XicgKyB0aGlzLndlZWtkYXlzTWluKG1vbSwgJycpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3dlZWtkYXlzUGFyc2VbaV0gPSBuZXcgUmVnRXhwKHJlZ2V4LnJlcGxhY2UoJy4nLCAnJyksICdpJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyB0ZXN0IHRoZSByZWdleFxuICAgICAgICAgICAgaWYgKHRoaXMuX3dlZWtkYXlzUGFyc2VbaV0udGVzdCh3ZWVrZGF5TmFtZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gaTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIE1PTUVOVFNcblxuICAgIGZ1bmN0aW9uIGdldFNldERheU9mV2VlayAoaW5wdXQpIHtcbiAgICAgICAgdmFyIGRheSA9IHRoaXMuX2lzVVRDID8gdGhpcy5fZC5nZXRVVENEYXkoKSA6IHRoaXMuX2QuZ2V0RGF5KCk7XG4gICAgICAgIGlmIChpbnB1dCAhPSBudWxsKSB7XG4gICAgICAgICAgICBpbnB1dCA9IHBhcnNlV2Vla2RheShpbnB1dCwgdGhpcy5sb2NhbGVEYXRhKCkpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuYWRkKGlucHV0IC0gZGF5LCAnZCcpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGRheTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldFNldExvY2FsZURheU9mV2VlayAoaW5wdXQpIHtcbiAgICAgICAgdmFyIHdlZWtkYXkgPSAodGhpcy5kYXkoKSArIDcgLSB0aGlzLmxvY2FsZURhdGEoKS5fd2Vlay5kb3cpICUgNztcbiAgICAgICAgcmV0dXJuIGlucHV0ID09IG51bGwgPyB3ZWVrZGF5IDogdGhpcy5hZGQoaW5wdXQgLSB3ZWVrZGF5LCAnZCcpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldFNldElTT0RheU9mV2VlayAoaW5wdXQpIHtcbiAgICAgICAgLy8gYmVoYXZlcyB0aGUgc2FtZSBhcyBtb21lbnQjZGF5IGV4Y2VwdFxuICAgICAgICAvLyBhcyBhIGdldHRlciwgcmV0dXJucyA3IGluc3RlYWQgb2YgMCAoMS03IHJhbmdlIGluc3RlYWQgb2YgMC02KVxuICAgICAgICAvLyBhcyBhIHNldHRlciwgc3VuZGF5IHNob3VsZCBiZWxvbmcgdG8gdGhlIHByZXZpb3VzIHdlZWsuXG4gICAgICAgIHJldHVybiBpbnB1dCA9PSBudWxsID8gdGhpcy5kYXkoKSB8fCA3IDogdGhpcy5kYXkodGhpcy5kYXkoKSAlIDcgPyBpbnB1dCA6IGlucHV0IC0gNyk7XG4gICAgfVxuXG4gICAgYWRkRm9ybWF0VG9rZW4oJ0gnLCBbJ0hIJywgMl0sIDAsICdob3VyJyk7XG4gICAgYWRkRm9ybWF0VG9rZW4oJ2gnLCBbJ2hoJywgMl0sIDAsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaG91cnMoKSAlIDEyIHx8IDEyO1xuICAgIH0pO1xuXG4gICAgZnVuY3Rpb24gbWVyaWRpZW0gKHRva2VuLCBsb3dlcmNhc2UpIHtcbiAgICAgICAgYWRkRm9ybWF0VG9rZW4odG9rZW4sIDAsIDAsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmxvY2FsZURhdGEoKS5tZXJpZGllbSh0aGlzLmhvdXJzKCksIHRoaXMubWludXRlcygpLCBsb3dlcmNhc2UpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBtZXJpZGllbSgnYScsIHRydWUpO1xuICAgIG1lcmlkaWVtKCdBJywgZmFsc2UpO1xuXG4gICAgLy8gQUxJQVNFU1xuXG4gICAgYWRkVW5pdEFsaWFzKCdob3VyJywgJ2gnKTtcblxuICAgIC8vIFBBUlNJTkdcblxuICAgIGZ1bmN0aW9uIG1hdGNoTWVyaWRpZW0gKGlzU3RyaWN0LCBsb2NhbGUpIHtcbiAgICAgICAgcmV0dXJuIGxvY2FsZS5fbWVyaWRpZW1QYXJzZTtcbiAgICB9XG5cbiAgICBhZGRSZWdleFRva2VuKCdhJywgIG1hdGNoTWVyaWRpZW0pO1xuICAgIGFkZFJlZ2V4VG9rZW4oJ0EnLCAgbWF0Y2hNZXJpZGllbSk7XG4gICAgYWRkUmVnZXhUb2tlbignSCcsICBtYXRjaDF0bzIpO1xuICAgIGFkZFJlZ2V4VG9rZW4oJ2gnLCAgbWF0Y2gxdG8yKTtcbiAgICBhZGRSZWdleFRva2VuKCdISCcsIG1hdGNoMXRvMiwgbWF0Y2gyKTtcbiAgICBhZGRSZWdleFRva2VuKCdoaCcsIG1hdGNoMXRvMiwgbWF0Y2gyKTtcblxuICAgIGFkZFBhcnNlVG9rZW4oWydIJywgJ0hIJ10sIEhPVVIpO1xuICAgIGFkZFBhcnNlVG9rZW4oWydhJywgJ0EnXSwgZnVuY3Rpb24gKGlucHV0LCBhcnJheSwgY29uZmlnKSB7XG4gICAgICAgIGNvbmZpZy5faXNQbSA9IGNvbmZpZy5fbG9jYWxlLmlzUE0oaW5wdXQpO1xuICAgICAgICBjb25maWcuX21lcmlkaWVtID0gaW5wdXQ7XG4gICAgfSk7XG4gICAgYWRkUGFyc2VUb2tlbihbJ2gnLCAnaGgnXSwgZnVuY3Rpb24gKGlucHV0LCBhcnJheSwgY29uZmlnKSB7XG4gICAgICAgIGFycmF5W0hPVVJdID0gdG9JbnQoaW5wdXQpO1xuICAgICAgICBjb25maWcuX3BmLmJpZ0hvdXIgPSB0cnVlO1xuICAgIH0pO1xuXG4gICAgLy8gTE9DQUxFU1xuXG4gICAgZnVuY3Rpb24gbG9jYWxlSXNQTSAoaW5wdXQpIHtcbiAgICAgICAgLy8gSUU4IFF1aXJrcyBNb2RlICYgSUU3IFN0YW5kYXJkcyBNb2RlIGRvIG5vdCBhbGxvdyBhY2Nlc3Npbmcgc3RyaW5ncyBsaWtlIGFycmF5c1xuICAgICAgICAvLyBVc2luZyBjaGFyQXQgc2hvdWxkIGJlIG1vcmUgY29tcGF0aWJsZS5cbiAgICAgICAgcmV0dXJuICgoaW5wdXQgKyAnJykudG9Mb3dlckNhc2UoKS5jaGFyQXQoMCkgPT09ICdwJyk7XG4gICAgfVxuXG4gICAgdmFyIGRlZmF1bHRMb2NhbGVNZXJpZGllbVBhcnNlID0gL1thcF1cXC4/bT9cXC4/L2k7XG4gICAgZnVuY3Rpb24gbG9jYWxlTWVyaWRpZW0gKGhvdXJzLCBtaW51dGVzLCBpc0xvd2VyKSB7XG4gICAgICAgIGlmIChob3VycyA+IDExKSB7XG4gICAgICAgICAgICByZXR1cm4gaXNMb3dlciA/ICdwbScgOiAnUE0nO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGlzTG93ZXIgPyAnYW0nIDogJ0FNJztcbiAgICAgICAgfVxuICAgIH1cblxuXG4gICAgLy8gTU9NRU5UU1xuXG4gICAgLy8gU2V0dGluZyB0aGUgaG91ciBzaG91bGQga2VlcCB0aGUgdGltZSwgYmVjYXVzZSB0aGUgdXNlciBleHBsaWNpdGx5XG4gICAgLy8gc3BlY2lmaWVkIHdoaWNoIGhvdXIgaGUgd2FudHMuIFNvIHRyeWluZyB0byBtYWludGFpbiB0aGUgc2FtZSBob3VyIChpblxuICAgIC8vIGEgbmV3IHRpbWV6b25lKSBtYWtlcyBzZW5zZS4gQWRkaW5nL3N1YnRyYWN0aW5nIGhvdXJzIGRvZXMgbm90IGZvbGxvd1xuICAgIC8vIHRoaXMgcnVsZS5cbiAgICB2YXIgZ2V0U2V0SG91ciA9IG1ha2VHZXRTZXQoJ0hvdXJzJywgdHJ1ZSk7XG5cbiAgICBhZGRGb3JtYXRUb2tlbignbScsIFsnbW0nLCAyXSwgMCwgJ21pbnV0ZScpO1xuXG4gICAgLy8gQUxJQVNFU1xuXG4gICAgYWRkVW5pdEFsaWFzKCdtaW51dGUnLCAnbScpO1xuXG4gICAgLy8gUEFSU0lOR1xuXG4gICAgYWRkUmVnZXhUb2tlbignbScsICBtYXRjaDF0bzIpO1xuICAgIGFkZFJlZ2V4VG9rZW4oJ21tJywgbWF0Y2gxdG8yLCBtYXRjaDIpO1xuICAgIGFkZFBhcnNlVG9rZW4oWydtJywgJ21tJ10sIE1JTlVURSk7XG5cbiAgICAvLyBNT01FTlRTXG5cbiAgICB2YXIgZ2V0U2V0TWludXRlID0gbWFrZUdldFNldCgnTWludXRlcycsIGZhbHNlKTtcblxuICAgIGFkZEZvcm1hdFRva2VuKCdzJywgWydzcycsIDJdLCAwLCAnc2Vjb25kJyk7XG5cbiAgICAvLyBBTElBU0VTXG5cbiAgICBhZGRVbml0QWxpYXMoJ3NlY29uZCcsICdzJyk7XG5cbiAgICAvLyBQQVJTSU5HXG5cbiAgICBhZGRSZWdleFRva2VuKCdzJywgIG1hdGNoMXRvMik7XG4gICAgYWRkUmVnZXhUb2tlbignc3MnLCBtYXRjaDF0bzIsIG1hdGNoMik7XG4gICAgYWRkUGFyc2VUb2tlbihbJ3MnLCAnc3MnXSwgU0VDT05EKTtcblxuICAgIC8vIE1PTUVOVFNcblxuICAgIHZhciBnZXRTZXRTZWNvbmQgPSBtYWtlR2V0U2V0KCdTZWNvbmRzJywgZmFsc2UpO1xuXG4gICAgYWRkRm9ybWF0VG9rZW4oJ1MnLCAwLCAwLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB+fih0aGlzLm1pbGxpc2Vjb25kKCkgLyAxMDApO1xuICAgIH0pO1xuXG4gICAgYWRkRm9ybWF0VG9rZW4oMCwgWydTUycsIDJdLCAwLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB+fih0aGlzLm1pbGxpc2Vjb25kKCkgLyAxMCk7XG4gICAgfSk7XG5cbiAgICBmdW5jdGlvbiBtaWxsaXNlY29uZF9fbWlsbGlzZWNvbmRzICh0b2tlbikge1xuICAgICAgICBhZGRGb3JtYXRUb2tlbigwLCBbdG9rZW4sIDNdLCAwLCAnbWlsbGlzZWNvbmQnKTtcbiAgICB9XG5cbiAgICBtaWxsaXNlY29uZF9fbWlsbGlzZWNvbmRzKCdTU1MnKTtcbiAgICBtaWxsaXNlY29uZF9fbWlsbGlzZWNvbmRzKCdTU1NTJyk7XG5cbiAgICAvLyBBTElBU0VTXG5cbiAgICBhZGRVbml0QWxpYXMoJ21pbGxpc2Vjb25kJywgJ21zJyk7XG5cbiAgICAvLyBQQVJTSU5HXG5cbiAgICBhZGRSZWdleFRva2VuKCdTJywgICAgbWF0Y2gxdG8zLCBtYXRjaDEpO1xuICAgIGFkZFJlZ2V4VG9rZW4oJ1NTJywgICBtYXRjaDF0bzMsIG1hdGNoMik7XG4gICAgYWRkUmVnZXhUb2tlbignU1NTJywgIG1hdGNoMXRvMywgbWF0Y2gzKTtcbiAgICBhZGRSZWdleFRva2VuKCdTU1NTJywgbWF0Y2hVbnNpZ25lZCk7XG4gICAgYWRkUGFyc2VUb2tlbihbJ1MnLCAnU1MnLCAnU1NTJywgJ1NTU1MnXSwgZnVuY3Rpb24gKGlucHV0LCBhcnJheSkge1xuICAgICAgICBhcnJheVtNSUxMSVNFQ09ORF0gPSB0b0ludCgoJzAuJyArIGlucHV0KSAqIDEwMDApO1xuICAgIH0pO1xuXG4gICAgLy8gTU9NRU5UU1xuXG4gICAgdmFyIGdldFNldE1pbGxpc2Vjb25kID0gbWFrZUdldFNldCgnTWlsbGlzZWNvbmRzJywgZmFsc2UpO1xuXG4gICAgYWRkRm9ybWF0VG9rZW4oJ3onLCAgMCwgMCwgJ3pvbmVBYmJyJyk7XG4gICAgYWRkRm9ybWF0VG9rZW4oJ3p6JywgMCwgMCwgJ3pvbmVOYW1lJyk7XG5cbiAgICAvLyBNT01FTlRTXG5cbiAgICBmdW5jdGlvbiBnZXRab25lQWJiciAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9pc1VUQyA/ICdVVEMnIDogJyc7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0Wm9uZU5hbWUgKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5faXNVVEMgPyAnQ29vcmRpbmF0ZWQgVW5pdmVyc2FsIFRpbWUnIDogJyc7XG4gICAgfVxuXG4gICAgdmFyIG1vbWVudFByb3RvdHlwZV9fcHJvdG8gPSBNb21lbnQucHJvdG90eXBlO1xuXG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by5hZGQgICAgICAgICAgPSBhZGRfc3VidHJhY3RfX2FkZDtcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLmNhbGVuZGFyICAgICA9IG1vbWVudF9jYWxlbmRhcl9fY2FsZW5kYXI7XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by5jbG9uZSAgICAgICAgPSBjbG9uZTtcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLmRpZmYgICAgICAgICA9IGRpZmY7XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by5lbmRPZiAgICAgICAgPSBlbmRPZjtcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLmZvcm1hdCAgICAgICA9IGZvcm1hdDtcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLmZyb20gICAgICAgICA9IGZyb207XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by5mcm9tTm93ICAgICAgPSBmcm9tTm93O1xuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8uZ2V0ICAgICAgICAgID0gZ2V0U2V0O1xuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8uaW52YWxpZEF0ICAgID0gaW52YWxpZEF0O1xuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8uaXNBZnRlciAgICAgID0gaXNBZnRlcjtcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLmlzQmVmb3JlICAgICA9IGlzQmVmb3JlO1xuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8uaXNCZXR3ZWVuICAgID0gaXNCZXR3ZWVuO1xuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8uaXNTYW1lICAgICAgID0gaXNTYW1lO1xuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8uaXNWYWxpZCAgICAgID0gbW9tZW50X3ZhbGlkX19pc1ZhbGlkO1xuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8ubGFuZyAgICAgICAgID0gbGFuZztcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLmxvY2FsZSAgICAgICA9IGxvY2FsZTtcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLmxvY2FsZURhdGEgICA9IGxvY2FsZURhdGE7XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by5tYXggICAgICAgICAgPSBwcm90b3R5cGVNYXg7XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by5taW4gICAgICAgICAgPSBwcm90b3R5cGVNaW47XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by5wYXJzaW5nRmxhZ3MgPSBwYXJzaW5nRmxhZ3M7XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by5zZXQgICAgICAgICAgPSBnZXRTZXQ7XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by5zdGFydE9mICAgICAgPSBzdGFydE9mO1xuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8uc3VidHJhY3QgICAgID0gYWRkX3N1YnRyYWN0X19zdWJ0cmFjdDtcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLnRvQXJyYXkgICAgICA9IHRvQXJyYXk7XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by50b0RhdGUgICAgICAgPSB0b0RhdGU7XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by50b0lTT1N0cmluZyAgPSBtb21lbnRfZm9ybWF0X190b0lTT1N0cmluZztcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLnRvSlNPTiAgICAgICA9IG1vbWVudF9mb3JtYXRfX3RvSVNPU3RyaW5nO1xuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8udG9TdHJpbmcgICAgID0gdG9TdHJpbmc7XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by51bml4ICAgICAgICAgPSB1bml4O1xuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8udmFsdWVPZiAgICAgID0gdG9fdHlwZV9fdmFsdWVPZjtcblxuICAgIC8vIFllYXJcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLnllYXIgICAgICAgPSBnZXRTZXRZZWFyO1xuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8uaXNMZWFwWWVhciA9IGdldElzTGVhcFllYXI7XG5cbiAgICAvLyBXZWVrIFllYXJcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLndlZWtZZWFyICAgID0gZ2V0U2V0V2Vla1llYXI7XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by5pc29XZWVrWWVhciA9IGdldFNldElTT1dlZWtZZWFyO1xuXG4gICAgLy8gUXVhcnRlclxuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8ucXVhcnRlciA9IG1vbWVudFByb3RvdHlwZV9fcHJvdG8ucXVhcnRlcnMgPSBnZXRTZXRRdWFydGVyO1xuXG4gICAgLy8gTW9udGhcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLm1vbnRoICAgICAgID0gZ2V0U2V0TW9udGg7XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by5kYXlzSW5Nb250aCA9IGdldERheXNJbk1vbnRoO1xuXG4gICAgLy8gV2Vla1xuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8ud2VlayAgICAgICAgICAgPSBtb21lbnRQcm90b3R5cGVfX3Byb3RvLndlZWtzICAgICAgICA9IGdldFNldFdlZWs7XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by5pc29XZWVrICAgICAgICA9IG1vbWVudFByb3RvdHlwZV9fcHJvdG8uaXNvV2Vla3MgICAgID0gZ2V0U2V0SVNPV2VlaztcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLndlZWtzSW5ZZWFyICAgID0gZ2V0V2Vla3NJblllYXI7XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by5pc29XZWVrc0luWWVhciA9IGdldElTT1dlZWtzSW5ZZWFyO1xuXG4gICAgLy8gRGF5XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by5kYXRlICAgICAgID0gZ2V0U2V0RGF5T2ZNb250aDtcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLmRheSAgICAgICAgPSBtb21lbnRQcm90b3R5cGVfX3Byb3RvLmRheXMgICAgICAgICAgICAgPSBnZXRTZXREYXlPZldlZWs7XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by53ZWVrZGF5ICAgID0gZ2V0U2V0TG9jYWxlRGF5T2ZXZWVrO1xuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8uaXNvV2Vla2RheSA9IGdldFNldElTT0RheU9mV2VlaztcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLmRheU9mWWVhciAgPSBnZXRTZXREYXlPZlllYXI7XG5cbiAgICAvLyBIb3VyXG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by5ob3VyID0gbW9tZW50UHJvdG90eXBlX19wcm90by5ob3VycyA9IGdldFNldEhvdXI7XG5cbiAgICAvLyBNaW51dGVcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLm1pbnV0ZSA9IG1vbWVudFByb3RvdHlwZV9fcHJvdG8ubWludXRlcyA9IGdldFNldE1pbnV0ZTtcblxuICAgIC8vIFNlY29uZFxuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8uc2Vjb25kID0gbW9tZW50UHJvdG90eXBlX19wcm90by5zZWNvbmRzID0gZ2V0U2V0U2Vjb25kO1xuXG4gICAgLy8gTWlsbGlzZWNvbmRcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLm1pbGxpc2Vjb25kID0gbW9tZW50UHJvdG90eXBlX19wcm90by5taWxsaXNlY29uZHMgPSBnZXRTZXRNaWxsaXNlY29uZDtcblxuICAgIC8vIE9mZnNldFxuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8udXRjT2Zmc2V0ICAgICAgICAgICAgPSBnZXRTZXRPZmZzZXQ7XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by51dGMgICAgICAgICAgICAgICAgICA9IHNldE9mZnNldFRvVVRDO1xuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8ubG9jYWwgICAgICAgICAgICAgICAgPSBzZXRPZmZzZXRUb0xvY2FsO1xuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8ucGFyc2Vab25lICAgICAgICAgICAgPSBzZXRPZmZzZXRUb1BhcnNlZE9mZnNldDtcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLmhhc0FsaWduZWRIb3VyT2Zmc2V0ID0gaGFzQWxpZ25lZEhvdXJPZmZzZXQ7XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by5pc0RTVCAgICAgICAgICAgICAgICA9IGlzRGF5bGlnaHRTYXZpbmdUaW1lO1xuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8uaXNEU1RTaGlmdGVkICAgICAgICAgPSBpc0RheWxpZ2h0U2F2aW5nVGltZVNoaWZ0ZWQ7XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by5pc0xvY2FsICAgICAgICAgICAgICA9IGlzTG9jYWw7XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by5pc1V0Y09mZnNldCAgICAgICAgICA9IGlzVXRjT2Zmc2V0O1xuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8uaXNVdGMgICAgICAgICAgICAgICAgPSBpc1V0YztcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLmlzVVRDICAgICAgICAgICAgICAgID0gaXNVdGM7XG5cbiAgICAvLyBUaW1lem9uZVxuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8uem9uZUFiYnIgPSBnZXRab25lQWJicjtcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLnpvbmVOYW1lID0gZ2V0Wm9uZU5hbWU7XG5cbiAgICAvLyBEZXByZWNhdGlvbnNcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLmRhdGVzICA9IGRlcHJlY2F0ZSgnZGF0ZXMgYWNjZXNzb3IgaXMgZGVwcmVjYXRlZC4gVXNlIGRhdGUgaW5zdGVhZC4nLCBnZXRTZXREYXlPZk1vbnRoKTtcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLm1vbnRocyA9IGRlcHJlY2F0ZSgnbW9udGhzIGFjY2Vzc29yIGlzIGRlcHJlY2F0ZWQuIFVzZSBtb250aCBpbnN0ZWFkJywgZ2V0U2V0TW9udGgpO1xuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8ueWVhcnMgID0gZGVwcmVjYXRlKCd5ZWFycyBhY2Nlc3NvciBpcyBkZXByZWNhdGVkLiBVc2UgeWVhciBpbnN0ZWFkJywgZ2V0U2V0WWVhcik7XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by56b25lICAgPSBkZXByZWNhdGUoJ21vbWVudCgpLnpvbmUgaXMgZGVwcmVjYXRlZCwgdXNlIG1vbWVudCgpLnV0Y09mZnNldCBpbnN0ZWFkLiBodHRwczovL2dpdGh1Yi5jb20vbW9tZW50L21vbWVudC9pc3N1ZXMvMTc3OScsIGdldFNldFpvbmUpO1xuXG4gICAgdmFyIG1vbWVudFByb3RvdHlwZSA9IG1vbWVudFByb3RvdHlwZV9fcHJvdG87XG5cbiAgICBmdW5jdGlvbiBtb21lbnRfX2NyZWF0ZVVuaXggKGlucHV0KSB7XG4gICAgICAgIHJldHVybiBsb2NhbF9fY3JlYXRlTG9jYWwoaW5wdXQgKiAxMDAwKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBtb21lbnRfX2NyZWF0ZUluWm9uZSAoKSB7XG4gICAgICAgIHJldHVybiBsb2NhbF9fY3JlYXRlTG9jYWwuYXBwbHkobnVsbCwgYXJndW1lbnRzKS5wYXJzZVpvbmUoKTtcbiAgICB9XG5cbiAgICB2YXIgZGVmYXVsdENhbGVuZGFyID0ge1xuICAgICAgICBzYW1lRGF5IDogJ1tUb2RheSBhdF0gTFQnLFxuICAgICAgICBuZXh0RGF5IDogJ1tUb21vcnJvdyBhdF0gTFQnLFxuICAgICAgICBuZXh0V2VlayA6ICdkZGRkIFthdF0gTFQnLFxuICAgICAgICBsYXN0RGF5IDogJ1tZZXN0ZXJkYXkgYXRdIExUJyxcbiAgICAgICAgbGFzdFdlZWsgOiAnW0xhc3RdIGRkZGQgW2F0XSBMVCcsXG4gICAgICAgIHNhbWVFbHNlIDogJ0wnXG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIGxvY2FsZV9jYWxlbmRhcl9fY2FsZW5kYXIgKGtleSwgbW9tLCBub3cpIHtcbiAgICAgICAgdmFyIG91dHB1dCA9IHRoaXMuX2NhbGVuZGFyW2tleV07XG4gICAgICAgIHJldHVybiB0eXBlb2Ygb3V0cHV0ID09PSAnZnVuY3Rpb24nID8gb3V0cHV0LmNhbGwobW9tLCBub3cpIDogb3V0cHV0O1xuICAgIH1cblxuICAgIHZhciBkZWZhdWx0TG9uZ0RhdGVGb3JtYXQgPSB7XG4gICAgICAgIExUUyAgOiAnaDptbTpzcyBBJyxcbiAgICAgICAgTFQgICA6ICdoOm1tIEEnLFxuICAgICAgICBMICAgIDogJ01NL0REL1lZWVknLFxuICAgICAgICBMTCAgIDogJ01NTU0gRCwgWVlZWScsXG4gICAgICAgIExMTCAgOiAnTU1NTSBELCBZWVlZIExUJyxcbiAgICAgICAgTExMTCA6ICdkZGRkLCBNTU1NIEQsIFlZWVkgTFQnXG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIGxvbmdEYXRlRm9ybWF0IChrZXkpIHtcbiAgICAgICAgdmFyIG91dHB1dCA9IHRoaXMuX2xvbmdEYXRlRm9ybWF0W2tleV07XG4gICAgICAgIGlmICghb3V0cHV0ICYmIHRoaXMuX2xvbmdEYXRlRm9ybWF0W2tleS50b1VwcGVyQ2FzZSgpXSkge1xuICAgICAgICAgICAgb3V0cHV0ID0gdGhpcy5fbG9uZ0RhdGVGb3JtYXRba2V5LnRvVXBwZXJDYXNlKCldLnJlcGxhY2UoL01NTU18TU18RER8ZGRkZC9nLCBmdW5jdGlvbiAodmFsKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHZhbC5zbGljZSgxKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdGhpcy5fbG9uZ0RhdGVGb3JtYXRba2V5XSA9IG91dHB1dDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb3V0cHV0O1xuICAgIH1cblxuICAgIHZhciBkZWZhdWx0SW52YWxpZERhdGUgPSAnSW52YWxpZCBkYXRlJztcblxuICAgIGZ1bmN0aW9uIGludmFsaWREYXRlICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ludmFsaWREYXRlO1xuICAgIH1cblxuICAgIHZhciBkZWZhdWx0T3JkaW5hbCA9ICclZCc7XG4gICAgdmFyIGRlZmF1bHRPcmRpbmFsUGFyc2UgPSAvXFxkezEsMn0vO1xuXG4gICAgZnVuY3Rpb24gb3JkaW5hbCAobnVtYmVyKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9vcmRpbmFsLnJlcGxhY2UoJyVkJywgbnVtYmVyKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwcmVQYXJzZVBvc3RGb3JtYXQgKHN0cmluZykge1xuICAgICAgICByZXR1cm4gc3RyaW5nO1xuICAgIH1cblxuICAgIHZhciBkZWZhdWx0UmVsYXRpdmVUaW1lID0ge1xuICAgICAgICBmdXR1cmUgOiAnaW4gJXMnLFxuICAgICAgICBwYXN0ICAgOiAnJXMgYWdvJyxcbiAgICAgICAgcyAgOiAnYSBmZXcgc2Vjb25kcycsXG4gICAgICAgIG0gIDogJ2EgbWludXRlJyxcbiAgICAgICAgbW0gOiAnJWQgbWludXRlcycsXG4gICAgICAgIGggIDogJ2FuIGhvdXInLFxuICAgICAgICBoaCA6ICclZCBob3VycycsXG4gICAgICAgIGQgIDogJ2EgZGF5JyxcbiAgICAgICAgZGQgOiAnJWQgZGF5cycsXG4gICAgICAgIE0gIDogJ2EgbW9udGgnLFxuICAgICAgICBNTSA6ICclZCBtb250aHMnLFxuICAgICAgICB5ICA6ICdhIHllYXInLFxuICAgICAgICB5eSA6ICclZCB5ZWFycydcbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gcmVsYXRpdmVfX3JlbGF0aXZlVGltZSAobnVtYmVyLCB3aXRob3V0U3VmZml4LCBzdHJpbmcsIGlzRnV0dXJlKSB7XG4gICAgICAgIHZhciBvdXRwdXQgPSB0aGlzLl9yZWxhdGl2ZVRpbWVbc3RyaW5nXTtcbiAgICAgICAgcmV0dXJuICh0eXBlb2Ygb3V0cHV0ID09PSAnZnVuY3Rpb24nKSA/XG4gICAgICAgICAgICBvdXRwdXQobnVtYmVyLCB3aXRob3V0U3VmZml4LCBzdHJpbmcsIGlzRnV0dXJlKSA6XG4gICAgICAgICAgICBvdXRwdXQucmVwbGFjZSgvJWQvaSwgbnVtYmVyKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwYXN0RnV0dXJlIChkaWZmLCBvdXRwdXQpIHtcbiAgICAgICAgdmFyIGZvcm1hdCA9IHRoaXMuX3JlbGF0aXZlVGltZVtkaWZmID4gMCA/ICdmdXR1cmUnIDogJ3Bhc3QnXTtcbiAgICAgICAgcmV0dXJuIHR5cGVvZiBmb3JtYXQgPT09ICdmdW5jdGlvbicgPyBmb3JtYXQob3V0cHV0KSA6IGZvcm1hdC5yZXBsYWNlKC8lcy9pLCBvdXRwdXQpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxvY2FsZV9zZXRfX3NldCAoY29uZmlnKSB7XG4gICAgICAgIHZhciBwcm9wLCBpO1xuICAgICAgICBmb3IgKGkgaW4gY29uZmlnKSB7XG4gICAgICAgICAgICBwcm9wID0gY29uZmlnW2ldO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBwcm9wID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgdGhpc1tpXSA9IHByb3A7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXNbJ18nICsgaV0gPSBwcm9wO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIExlbmllbnQgb3JkaW5hbCBwYXJzaW5nIGFjY2VwdHMganVzdCBhIG51bWJlciBpbiBhZGRpdGlvbiB0b1xuICAgICAgICAvLyBudW1iZXIgKyAocG9zc2libHkpIHN0dWZmIGNvbWluZyBmcm9tIF9vcmRpbmFsUGFyc2VMZW5pZW50LlxuICAgICAgICB0aGlzLl9vcmRpbmFsUGFyc2VMZW5pZW50ID0gbmV3IFJlZ0V4cCh0aGlzLl9vcmRpbmFsUGFyc2Uuc291cmNlICsgJ3wnICsgL1xcZHsxLDJ9Ly5zb3VyY2UpO1xuICAgIH1cblxuICAgIHZhciBwcm90b3R5cGVfX3Byb3RvID0gTG9jYWxlLnByb3RvdHlwZTtcblxuICAgIHByb3RvdHlwZV9fcHJvdG8uX2NhbGVuZGFyICAgICAgID0gZGVmYXVsdENhbGVuZGFyO1xuICAgIHByb3RvdHlwZV9fcHJvdG8uY2FsZW5kYXIgICAgICAgID0gbG9jYWxlX2NhbGVuZGFyX19jYWxlbmRhcjtcbiAgICBwcm90b3R5cGVfX3Byb3RvLl9sb25nRGF0ZUZvcm1hdCA9IGRlZmF1bHRMb25nRGF0ZUZvcm1hdDtcbiAgICBwcm90b3R5cGVfX3Byb3RvLmxvbmdEYXRlRm9ybWF0ICA9IGxvbmdEYXRlRm9ybWF0O1xuICAgIHByb3RvdHlwZV9fcHJvdG8uX2ludmFsaWREYXRlICAgID0gZGVmYXVsdEludmFsaWREYXRlO1xuICAgIHByb3RvdHlwZV9fcHJvdG8uaW52YWxpZERhdGUgICAgID0gaW52YWxpZERhdGU7XG4gICAgcHJvdG90eXBlX19wcm90by5fb3JkaW5hbCAgICAgICAgPSBkZWZhdWx0T3JkaW5hbDtcbiAgICBwcm90b3R5cGVfX3Byb3RvLm9yZGluYWwgICAgICAgICA9IG9yZGluYWw7XG4gICAgcHJvdG90eXBlX19wcm90by5fb3JkaW5hbFBhcnNlICAgPSBkZWZhdWx0T3JkaW5hbFBhcnNlO1xuICAgIHByb3RvdHlwZV9fcHJvdG8ucHJlcGFyc2UgICAgICAgID0gcHJlUGFyc2VQb3N0Rm9ybWF0O1xuICAgIHByb3RvdHlwZV9fcHJvdG8ucG9zdGZvcm1hdCAgICAgID0gcHJlUGFyc2VQb3N0Rm9ybWF0O1xuICAgIHByb3RvdHlwZV9fcHJvdG8uX3JlbGF0aXZlVGltZSAgID0gZGVmYXVsdFJlbGF0aXZlVGltZTtcbiAgICBwcm90b3R5cGVfX3Byb3RvLnJlbGF0aXZlVGltZSAgICA9IHJlbGF0aXZlX19yZWxhdGl2ZVRpbWU7XG4gICAgcHJvdG90eXBlX19wcm90by5wYXN0RnV0dXJlICAgICAgPSBwYXN0RnV0dXJlO1xuICAgIHByb3RvdHlwZV9fcHJvdG8uc2V0ICAgICAgICAgICAgID0gbG9jYWxlX3NldF9fc2V0O1xuXG4gICAgLy8gTW9udGhcbiAgICBwcm90b3R5cGVfX3Byb3RvLm1vbnRocyAgICAgICA9ICAgICAgICBsb2NhbGVNb250aHM7XG4gICAgcHJvdG90eXBlX19wcm90by5fbW9udGhzICAgICAgPSBkZWZhdWx0TG9jYWxlTW9udGhzO1xuICAgIHByb3RvdHlwZV9fcHJvdG8ubW9udGhzU2hvcnQgID0gICAgICAgIGxvY2FsZU1vbnRoc1Nob3J0O1xuICAgIHByb3RvdHlwZV9fcHJvdG8uX21vbnRoc1Nob3J0ID0gZGVmYXVsdExvY2FsZU1vbnRoc1Nob3J0O1xuICAgIHByb3RvdHlwZV9fcHJvdG8ubW9udGhzUGFyc2UgID0gICAgICAgIGxvY2FsZU1vbnRoc1BhcnNlO1xuXG4gICAgLy8gV2Vla1xuICAgIHByb3RvdHlwZV9fcHJvdG8ud2VlayA9IGxvY2FsZVdlZWs7XG4gICAgcHJvdG90eXBlX19wcm90by5fd2VlayA9IGRlZmF1bHRMb2NhbGVXZWVrO1xuICAgIHByb3RvdHlwZV9fcHJvdG8uZmlyc3REYXlPZlllYXIgPSBsb2NhbGVGaXJzdERheU9mWWVhcjtcbiAgICBwcm90b3R5cGVfX3Byb3RvLmZpcnN0RGF5T2ZXZWVrID0gbG9jYWxlRmlyc3REYXlPZldlZWs7XG5cbiAgICAvLyBEYXkgb2YgV2Vla1xuICAgIHByb3RvdHlwZV9fcHJvdG8ud2Vla2RheXMgICAgICAgPSAgICAgICAgbG9jYWxlV2Vla2RheXM7XG4gICAgcHJvdG90eXBlX19wcm90by5fd2Vla2RheXMgICAgICA9IGRlZmF1bHRMb2NhbGVXZWVrZGF5cztcbiAgICBwcm90b3R5cGVfX3Byb3RvLndlZWtkYXlzTWluICAgID0gICAgICAgIGxvY2FsZVdlZWtkYXlzTWluO1xuICAgIHByb3RvdHlwZV9fcHJvdG8uX3dlZWtkYXlzTWluICAgPSBkZWZhdWx0TG9jYWxlV2Vla2RheXNNaW47XG4gICAgcHJvdG90eXBlX19wcm90by53ZWVrZGF5c1Nob3J0ICA9ICAgICAgICBsb2NhbGVXZWVrZGF5c1Nob3J0O1xuICAgIHByb3RvdHlwZV9fcHJvdG8uX3dlZWtkYXlzU2hvcnQgPSBkZWZhdWx0TG9jYWxlV2Vla2RheXNTaG9ydDtcbiAgICBwcm90b3R5cGVfX3Byb3RvLndlZWtkYXlzUGFyc2UgID0gICAgICAgIGxvY2FsZVdlZWtkYXlzUGFyc2U7XG5cbiAgICAvLyBIb3Vyc1xuICAgIHByb3RvdHlwZV9fcHJvdG8uaXNQTSA9IGxvY2FsZUlzUE07XG4gICAgcHJvdG90eXBlX19wcm90by5fbWVyaWRpZW1QYXJzZSA9IGRlZmF1bHRMb2NhbGVNZXJpZGllbVBhcnNlO1xuICAgIHByb3RvdHlwZV9fcHJvdG8ubWVyaWRpZW0gPSBsb2NhbGVNZXJpZGllbTtcblxuICAgIGZ1bmN0aW9uIGxpc3RzX19nZXQgKGZvcm1hdCwgaW5kZXgsIGZpZWxkLCBzZXR0ZXIpIHtcbiAgICAgICAgdmFyIGxvY2FsZSA9IGxvY2FsZV9sb2NhbGVzX19nZXRMb2NhbGUoKTtcbiAgICAgICAgdmFyIHV0YyA9IGNyZWF0ZV91dGNfX2NyZWF0ZVVUQygpLnNldChzZXR0ZXIsIGluZGV4KTtcbiAgICAgICAgcmV0dXJuIGxvY2FsZVtmaWVsZF0odXRjLCBmb3JtYXQpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpc3QgKGZvcm1hdCwgaW5kZXgsIGZpZWxkLCBjb3VudCwgc2V0dGVyKSB7XG4gICAgICAgIGlmICh0eXBlb2YgZm9ybWF0ID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgaW5kZXggPSBmb3JtYXQ7XG4gICAgICAgICAgICBmb3JtYXQgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cblxuICAgICAgICBmb3JtYXQgPSBmb3JtYXQgfHwgJyc7XG5cbiAgICAgICAgaWYgKGluZGV4ICE9IG51bGwpIHtcbiAgICAgICAgICAgIHJldHVybiBsaXN0c19fZ2V0KGZvcm1hdCwgaW5kZXgsIGZpZWxkLCBzZXR0ZXIpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGk7XG4gICAgICAgIHZhciBvdXQgPSBbXTtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcbiAgICAgICAgICAgIG91dFtpXSA9IGxpc3RzX19nZXQoZm9ybWF0LCBpLCBmaWVsZCwgc2V0dGVyKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb3V0O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpc3RzX19saXN0TW9udGhzIChmb3JtYXQsIGluZGV4KSB7XG4gICAgICAgIHJldHVybiBsaXN0KGZvcm1hdCwgaW5kZXgsICdtb250aHMnLCAxMiwgJ21vbnRoJyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGlzdHNfX2xpc3RNb250aHNTaG9ydCAoZm9ybWF0LCBpbmRleCkge1xuICAgICAgICByZXR1cm4gbGlzdChmb3JtYXQsIGluZGV4LCAnbW9udGhzU2hvcnQnLCAxMiwgJ21vbnRoJyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGlzdHNfX2xpc3RXZWVrZGF5cyAoZm9ybWF0LCBpbmRleCkge1xuICAgICAgICByZXR1cm4gbGlzdChmb3JtYXQsIGluZGV4LCAnd2Vla2RheXMnLCA3LCAnZGF5Jyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGlzdHNfX2xpc3RXZWVrZGF5c1Nob3J0IChmb3JtYXQsIGluZGV4KSB7XG4gICAgICAgIHJldHVybiBsaXN0KGZvcm1hdCwgaW5kZXgsICd3ZWVrZGF5c1Nob3J0JywgNywgJ2RheScpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpc3RzX19saXN0V2Vla2RheXNNaW4gKGZvcm1hdCwgaW5kZXgpIHtcbiAgICAgICAgcmV0dXJuIGxpc3QoZm9ybWF0LCBpbmRleCwgJ3dlZWtkYXlzTWluJywgNywgJ2RheScpO1xuICAgIH1cblxuICAgIGxvY2FsZV9sb2NhbGVzX19nZXRTZXRHbG9iYWxMb2NhbGUoJ2VuJywge1xuICAgICAgICBvcmRpbmFsUGFyc2U6IC9cXGR7MSwyfSh0aHxzdHxuZHxyZCkvLFxuICAgICAgICBvcmRpbmFsIDogZnVuY3Rpb24gKG51bWJlcikge1xuICAgICAgICAgICAgdmFyIGIgPSBudW1iZXIgJSAxMCxcbiAgICAgICAgICAgICAgICBvdXRwdXQgPSAodG9JbnQobnVtYmVyICUgMTAwIC8gMTApID09PSAxKSA/ICd0aCcgOlxuICAgICAgICAgICAgICAgIChiID09PSAxKSA/ICdzdCcgOlxuICAgICAgICAgICAgICAgIChiID09PSAyKSA/ICduZCcgOlxuICAgICAgICAgICAgICAgIChiID09PSAzKSA/ICdyZCcgOiAndGgnO1xuICAgICAgICAgICAgcmV0dXJuIG51bWJlciArIG91dHB1dDtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gU2lkZSBlZmZlY3QgaW1wb3J0c1xuICAgIHV0aWxzX2hvb2tzX19ob29rcy5sYW5nID0gZGVwcmVjYXRlKCdtb21lbnQubGFuZyBpcyBkZXByZWNhdGVkLiBVc2UgbW9tZW50LmxvY2FsZSBpbnN0ZWFkLicsIGxvY2FsZV9sb2NhbGVzX19nZXRTZXRHbG9iYWxMb2NhbGUpO1xuICAgIHV0aWxzX2hvb2tzX19ob29rcy5sYW5nRGF0YSA9IGRlcHJlY2F0ZSgnbW9tZW50LmxhbmdEYXRhIGlzIGRlcHJlY2F0ZWQuIFVzZSBtb21lbnQubG9jYWxlRGF0YSBpbnN0ZWFkLicsIGxvY2FsZV9sb2NhbGVzX19nZXRMb2NhbGUpO1xuXG4gICAgdmFyIG1hdGhBYnMgPSBNYXRoLmFicztcblxuICAgIGZ1bmN0aW9uIGR1cmF0aW9uX2Fic19fYWJzICgpIHtcbiAgICAgICAgdmFyIGRhdGEgICAgICAgICAgID0gdGhpcy5fZGF0YTtcblxuICAgICAgICB0aGlzLl9taWxsaXNlY29uZHMgPSBtYXRoQWJzKHRoaXMuX21pbGxpc2Vjb25kcyk7XG4gICAgICAgIHRoaXMuX2RheXMgICAgICAgICA9IG1hdGhBYnModGhpcy5fZGF5cyk7XG4gICAgICAgIHRoaXMuX21vbnRocyAgICAgICA9IG1hdGhBYnModGhpcy5fbW9udGhzKTtcblxuICAgICAgICBkYXRhLm1pbGxpc2Vjb25kcyAgPSBtYXRoQWJzKGRhdGEubWlsbGlzZWNvbmRzKTtcbiAgICAgICAgZGF0YS5zZWNvbmRzICAgICAgID0gbWF0aEFicyhkYXRhLnNlY29uZHMpO1xuICAgICAgICBkYXRhLm1pbnV0ZXMgICAgICAgPSBtYXRoQWJzKGRhdGEubWludXRlcyk7XG4gICAgICAgIGRhdGEuaG91cnMgICAgICAgICA9IG1hdGhBYnMoZGF0YS5ob3Vycyk7XG4gICAgICAgIGRhdGEubW9udGhzICAgICAgICA9IG1hdGhBYnMoZGF0YS5tb250aHMpO1xuICAgICAgICBkYXRhLnllYXJzICAgICAgICAgPSBtYXRoQWJzKGRhdGEueWVhcnMpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGR1cmF0aW9uX2FkZF9zdWJ0cmFjdF9fYWRkU3VidHJhY3QgKGR1cmF0aW9uLCBpbnB1dCwgdmFsdWUsIGRpcmVjdGlvbikge1xuICAgICAgICB2YXIgb3RoZXIgPSBjcmVhdGVfX2NyZWF0ZUR1cmF0aW9uKGlucHV0LCB2YWx1ZSk7XG5cbiAgICAgICAgZHVyYXRpb24uX21pbGxpc2Vjb25kcyArPSBkaXJlY3Rpb24gKiBvdGhlci5fbWlsbGlzZWNvbmRzO1xuICAgICAgICBkdXJhdGlvbi5fZGF5cyAgICAgICAgICs9IGRpcmVjdGlvbiAqIG90aGVyLl9kYXlzO1xuICAgICAgICBkdXJhdGlvbi5fbW9udGhzICAgICAgICs9IGRpcmVjdGlvbiAqIG90aGVyLl9tb250aHM7XG5cbiAgICAgICAgcmV0dXJuIGR1cmF0aW9uLl9idWJibGUoKTtcbiAgICB9XG5cbiAgICAvLyBzdXBwb3J0cyBvbmx5IDIuMC1zdHlsZSBhZGQoMSwgJ3MnKSBvciBhZGQoZHVyYXRpb24pXG4gICAgZnVuY3Rpb24gZHVyYXRpb25fYWRkX3N1YnRyYWN0X19hZGQgKGlucHV0LCB2YWx1ZSkge1xuICAgICAgICByZXR1cm4gZHVyYXRpb25fYWRkX3N1YnRyYWN0X19hZGRTdWJ0cmFjdCh0aGlzLCBpbnB1dCwgdmFsdWUsIDEpO1xuICAgIH1cblxuICAgIC8vIHN1cHBvcnRzIG9ubHkgMi4wLXN0eWxlIHN1YnRyYWN0KDEsICdzJykgb3Igc3VidHJhY3QoZHVyYXRpb24pXG4gICAgZnVuY3Rpb24gZHVyYXRpb25fYWRkX3N1YnRyYWN0X19zdWJ0cmFjdCAoaW5wdXQsIHZhbHVlKSB7XG4gICAgICAgIHJldHVybiBkdXJhdGlvbl9hZGRfc3VidHJhY3RfX2FkZFN1YnRyYWN0KHRoaXMsIGlucHV0LCB2YWx1ZSwgLTEpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGJ1YmJsZSAoKSB7XG4gICAgICAgIHZhciBtaWxsaXNlY29uZHMgPSB0aGlzLl9taWxsaXNlY29uZHM7XG4gICAgICAgIHZhciBkYXlzICAgICAgICAgPSB0aGlzLl9kYXlzO1xuICAgICAgICB2YXIgbW9udGhzICAgICAgID0gdGhpcy5fbW9udGhzO1xuICAgICAgICB2YXIgZGF0YSAgICAgICAgID0gdGhpcy5fZGF0YTtcbiAgICAgICAgdmFyIHNlY29uZHMsIG1pbnV0ZXMsIGhvdXJzLCB5ZWFycyA9IDA7XG5cbiAgICAgICAgLy8gVGhlIGZvbGxvd2luZyBjb2RlIGJ1YmJsZXMgdXAgdmFsdWVzLCBzZWUgdGhlIHRlc3RzIGZvclxuICAgICAgICAvLyBleGFtcGxlcyBvZiB3aGF0IHRoYXQgbWVhbnMuXG4gICAgICAgIGRhdGEubWlsbGlzZWNvbmRzID0gbWlsbGlzZWNvbmRzICUgMTAwMDtcblxuICAgICAgICBzZWNvbmRzICAgICAgICAgICA9IGFic0Zsb29yKG1pbGxpc2Vjb25kcyAvIDEwMDApO1xuICAgICAgICBkYXRhLnNlY29uZHMgICAgICA9IHNlY29uZHMgJSA2MDtcblxuICAgICAgICBtaW51dGVzICAgICAgICAgICA9IGFic0Zsb29yKHNlY29uZHMgLyA2MCk7XG4gICAgICAgIGRhdGEubWludXRlcyAgICAgID0gbWludXRlcyAlIDYwO1xuXG4gICAgICAgIGhvdXJzICAgICAgICAgICAgID0gYWJzRmxvb3IobWludXRlcyAvIDYwKTtcbiAgICAgICAgZGF0YS5ob3VycyAgICAgICAgPSBob3VycyAlIDI0O1xuXG4gICAgICAgIGRheXMgKz0gYWJzRmxvb3IoaG91cnMgLyAyNCk7XG5cbiAgICAgICAgLy8gQWNjdXJhdGVseSBjb252ZXJ0IGRheXMgdG8geWVhcnMsIGFzc3VtZSBzdGFydCBmcm9tIHllYXIgMC5cbiAgICAgICAgeWVhcnMgPSBhYnNGbG9vcihkYXlzVG9ZZWFycyhkYXlzKSk7XG4gICAgICAgIGRheXMgLT0gYWJzRmxvb3IoeWVhcnNUb0RheXMoeWVhcnMpKTtcblxuICAgICAgICAvLyAzMCBkYXlzIHRvIGEgbW9udGhcbiAgICAgICAgLy8gVE9ETyAoaXNrcmVuKTogVXNlIGFuY2hvciBkYXRlIChsaWtlIDFzdCBKYW4pIHRvIGNvbXB1dGUgdGhpcy5cbiAgICAgICAgbW9udGhzICs9IGFic0Zsb29yKGRheXMgLyAzMCk7XG4gICAgICAgIGRheXMgICAlPSAzMDtcblxuICAgICAgICAvLyAxMiBtb250aHMgLT4gMSB5ZWFyXG4gICAgICAgIHllYXJzICArPSBhYnNGbG9vcihtb250aHMgLyAxMik7XG4gICAgICAgIG1vbnRocyAlPSAxMjtcblxuICAgICAgICBkYXRhLmRheXMgICA9IGRheXM7XG4gICAgICAgIGRhdGEubW9udGhzID0gbW9udGhzO1xuICAgICAgICBkYXRhLnllYXJzICA9IHllYXJzO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRheXNUb1llYXJzIChkYXlzKSB7XG4gICAgICAgIC8vIDQwMCB5ZWFycyBoYXZlIDE0NjA5NyBkYXlzICh0YWtpbmcgaW50byBhY2NvdW50IGxlYXAgeWVhciBydWxlcylcbiAgICAgICAgcmV0dXJuIGRheXMgKiA0MDAgLyAxNDYwOTc7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24geWVhcnNUb0RheXMgKHllYXJzKSB7XG4gICAgICAgIC8vIHllYXJzICogMzY1ICsgYWJzRmxvb3IoeWVhcnMgLyA0KSAtXG4gICAgICAgIC8vICAgICBhYnNGbG9vcih5ZWFycyAvIDEwMCkgKyBhYnNGbG9vcih5ZWFycyAvIDQwMCk7XG4gICAgICAgIHJldHVybiB5ZWFycyAqIDE0NjA5NyAvIDQwMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhcyAodW5pdHMpIHtcbiAgICAgICAgdmFyIGRheXM7XG4gICAgICAgIHZhciBtb250aHM7XG4gICAgICAgIHZhciBtaWxsaXNlY29uZHMgPSB0aGlzLl9taWxsaXNlY29uZHM7XG5cbiAgICAgICAgdW5pdHMgPSBub3JtYWxpemVVbml0cyh1bml0cyk7XG5cbiAgICAgICAgaWYgKHVuaXRzID09PSAnbW9udGgnIHx8IHVuaXRzID09PSAneWVhcicpIHtcbiAgICAgICAgICAgIGRheXMgICA9IHRoaXMuX2RheXMgICArIG1pbGxpc2Vjb25kcyAvIDg2NGU1O1xuICAgICAgICAgICAgbW9udGhzID0gdGhpcy5fbW9udGhzICsgZGF5c1RvWWVhcnMoZGF5cykgKiAxMjtcbiAgICAgICAgICAgIHJldHVybiB1bml0cyA9PT0gJ21vbnRoJyA/IG1vbnRocyA6IG1vbnRocyAvIDEyO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gaGFuZGxlIG1pbGxpc2Vjb25kcyBzZXBhcmF0ZWx5IGJlY2F1c2Ugb2YgZmxvYXRpbmcgcG9pbnQgbWF0aCBlcnJvcnMgKGlzc3VlICMxODY3KVxuICAgICAgICAgICAgZGF5cyA9IHRoaXMuX2RheXMgKyBNYXRoLnJvdW5kKHllYXJzVG9EYXlzKHRoaXMuX21vbnRocyAvIDEyKSk7XG4gICAgICAgICAgICBzd2l0Y2ggKHVuaXRzKSB7XG4gICAgICAgICAgICAgICAgY2FzZSAnd2VlaycgICA6IHJldHVybiBkYXlzIC8gNyAgICAgICAgICAgICsgbWlsbGlzZWNvbmRzIC8gNjA0OGU1O1xuICAgICAgICAgICAgICAgIGNhc2UgJ2RheScgICAgOiByZXR1cm4gZGF5cyAgICAgICAgICAgICAgICArIG1pbGxpc2Vjb25kcyAvIDg2NGU1O1xuICAgICAgICAgICAgICAgIGNhc2UgJ2hvdXInICAgOiByZXR1cm4gZGF5cyAqIDI0ICAgICAgICAgICArIG1pbGxpc2Vjb25kcyAvIDM2ZTU7XG4gICAgICAgICAgICAgICAgY2FzZSAnbWludXRlJyA6IHJldHVybiBkYXlzICogMjQgKiA2MCAgICAgICsgbWlsbGlzZWNvbmRzIC8gNmU0O1xuICAgICAgICAgICAgICAgIGNhc2UgJ3NlY29uZCcgOiByZXR1cm4gZGF5cyAqIDI0ICogNjAgKiA2MCArIG1pbGxpc2Vjb25kcyAvIDEwMDA7XG4gICAgICAgICAgICAgICAgLy8gTWF0aC5mbG9vciBwcmV2ZW50cyBmbG9hdGluZyBwb2ludCBtYXRoIGVycm9ycyBoZXJlXG4gICAgICAgICAgICAgICAgY2FzZSAnbWlsbGlzZWNvbmQnOiByZXR1cm4gTWF0aC5mbG9vcihkYXlzICogMjQgKiA2MCAqIDYwICogMTAwMCkgKyBtaWxsaXNlY29uZHM7XG4gICAgICAgICAgICAgICAgZGVmYXVsdDogdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIHVuaXQgJyArIHVuaXRzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIFRPRE86IFVzZSB0aGlzLmFzKCdtcycpP1xuICAgIGZ1bmN0aW9uIGR1cmF0aW9uX2FzX192YWx1ZU9mICgpIHtcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIHRoaXMuX21pbGxpc2Vjb25kcyArXG4gICAgICAgICAgICB0aGlzLl9kYXlzICogODY0ZTUgK1xuICAgICAgICAgICAgKHRoaXMuX21vbnRocyAlIDEyKSAqIDI1OTJlNiArXG4gICAgICAgICAgICB0b0ludCh0aGlzLl9tb250aHMgLyAxMikgKiAzMTUzNmU2XG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbWFrZUFzIChhbGlhcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuYXMoYWxpYXMpO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIHZhciBhc01pbGxpc2Vjb25kcyA9IG1ha2VBcygnbXMnKTtcbiAgICB2YXIgYXNTZWNvbmRzICAgICAgPSBtYWtlQXMoJ3MnKTtcbiAgICB2YXIgYXNNaW51dGVzICAgICAgPSBtYWtlQXMoJ20nKTtcbiAgICB2YXIgYXNIb3VycyAgICAgICAgPSBtYWtlQXMoJ2gnKTtcbiAgICB2YXIgYXNEYXlzICAgICAgICAgPSBtYWtlQXMoJ2QnKTtcbiAgICB2YXIgYXNXZWVrcyAgICAgICAgPSBtYWtlQXMoJ3cnKTtcbiAgICB2YXIgYXNNb250aHMgICAgICAgPSBtYWtlQXMoJ00nKTtcbiAgICB2YXIgYXNZZWFycyAgICAgICAgPSBtYWtlQXMoJ3knKTtcblxuICAgIGZ1bmN0aW9uIGR1cmF0aW9uX2dldF9fZ2V0ICh1bml0cykge1xuICAgICAgICB1bml0cyA9IG5vcm1hbGl6ZVVuaXRzKHVuaXRzKTtcbiAgICAgICAgcmV0dXJuIHRoaXNbdW5pdHMgKyAncyddKCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbWFrZUdldHRlcihuYW1lKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fZGF0YVtuYW1lXTtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICB2YXIgZHVyYXRpb25fZ2V0X19taWxsaXNlY29uZHMgPSBtYWtlR2V0dGVyKCdtaWxsaXNlY29uZHMnKTtcbiAgICB2YXIgc2Vjb25kcyAgICAgID0gbWFrZUdldHRlcignc2Vjb25kcycpO1xuICAgIHZhciBtaW51dGVzICAgICAgPSBtYWtlR2V0dGVyKCdtaW51dGVzJyk7XG4gICAgdmFyIGhvdXJzICAgICAgICA9IG1ha2VHZXR0ZXIoJ2hvdXJzJyk7XG4gICAgdmFyIGRheXMgICAgICAgICA9IG1ha2VHZXR0ZXIoJ2RheXMnKTtcbiAgICB2YXIgbW9udGhzICAgICAgID0gbWFrZUdldHRlcignbW9udGhzJyk7XG4gICAgdmFyIHllYXJzICAgICAgICA9IG1ha2VHZXR0ZXIoJ3llYXJzJyk7XG5cbiAgICBmdW5jdGlvbiB3ZWVrcyAoKSB7XG4gICAgICAgIHJldHVybiBhYnNGbG9vcih0aGlzLmRheXMoKSAvIDcpO1xuICAgIH1cblxuICAgIHZhciByb3VuZCA9IE1hdGgucm91bmQ7XG4gICAgdmFyIHRocmVzaG9sZHMgPSB7XG4gICAgICAgIHM6IDQ1LCAgLy8gc2Vjb25kcyB0byBtaW51dGVcbiAgICAgICAgbTogNDUsICAvLyBtaW51dGVzIHRvIGhvdXJcbiAgICAgICAgaDogMjIsICAvLyBob3VycyB0byBkYXlcbiAgICAgICAgZDogMjYsICAvLyBkYXlzIHRvIG1vbnRoXG4gICAgICAgIE06IDExICAgLy8gbW9udGhzIHRvIHllYXJcbiAgICB9O1xuXG4gICAgLy8gaGVscGVyIGZ1bmN0aW9uIGZvciBtb21lbnQuZm4uZnJvbSwgbW9tZW50LmZuLmZyb21Ob3csIGFuZCBtb21lbnQuZHVyYXRpb24uZm4uaHVtYW5pemVcbiAgICBmdW5jdGlvbiBzdWJzdGl0dXRlVGltZUFnbyhzdHJpbmcsIG51bWJlciwgd2l0aG91dFN1ZmZpeCwgaXNGdXR1cmUsIGxvY2FsZSkge1xuICAgICAgICByZXR1cm4gbG9jYWxlLnJlbGF0aXZlVGltZShudW1iZXIgfHwgMSwgISF3aXRob3V0U3VmZml4LCBzdHJpbmcsIGlzRnV0dXJlKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkdXJhdGlvbl9odW1hbml6ZV9fcmVsYXRpdmVUaW1lIChwb3NOZWdEdXJhdGlvbiwgd2l0aG91dFN1ZmZpeCwgbG9jYWxlKSB7XG4gICAgICAgIHZhciBkdXJhdGlvbiA9IGNyZWF0ZV9fY3JlYXRlRHVyYXRpb24ocG9zTmVnRHVyYXRpb24pLmFicygpO1xuICAgICAgICB2YXIgc2Vjb25kcyAgPSByb3VuZChkdXJhdGlvbi5hcygncycpKTtcbiAgICAgICAgdmFyIG1pbnV0ZXMgID0gcm91bmQoZHVyYXRpb24uYXMoJ20nKSk7XG4gICAgICAgIHZhciBob3VycyAgICA9IHJvdW5kKGR1cmF0aW9uLmFzKCdoJykpO1xuICAgICAgICB2YXIgZGF5cyAgICAgPSByb3VuZChkdXJhdGlvbi5hcygnZCcpKTtcbiAgICAgICAgdmFyIG1vbnRocyAgID0gcm91bmQoZHVyYXRpb24uYXMoJ00nKSk7XG4gICAgICAgIHZhciB5ZWFycyAgICA9IHJvdW5kKGR1cmF0aW9uLmFzKCd5JykpO1xuXG4gICAgICAgIHZhciBhID0gc2Vjb25kcyA8IHRocmVzaG9sZHMucyAmJiBbJ3MnLCBzZWNvbmRzXSAgfHxcbiAgICAgICAgICAgICAgICBtaW51dGVzID09PSAxICAgICAgICAgICYmIFsnbSddICAgICAgICAgICB8fFxuICAgICAgICAgICAgICAgIG1pbnV0ZXMgPCB0aHJlc2hvbGRzLm0gJiYgWydtbScsIG1pbnV0ZXNdIHx8XG4gICAgICAgICAgICAgICAgaG91cnMgICA9PT0gMSAgICAgICAgICAmJiBbJ2gnXSAgICAgICAgICAgfHxcbiAgICAgICAgICAgICAgICBob3VycyAgIDwgdGhyZXNob2xkcy5oICYmIFsnaGgnLCBob3Vyc10gICB8fFxuICAgICAgICAgICAgICAgIGRheXMgICAgPT09IDEgICAgICAgICAgJiYgWydkJ10gICAgICAgICAgIHx8XG4gICAgICAgICAgICAgICAgZGF5cyAgICA8IHRocmVzaG9sZHMuZCAmJiBbJ2RkJywgZGF5c10gICAgfHxcbiAgICAgICAgICAgICAgICBtb250aHMgID09PSAxICAgICAgICAgICYmIFsnTSddICAgICAgICAgICB8fFxuICAgICAgICAgICAgICAgIG1vbnRocyAgPCB0aHJlc2hvbGRzLk0gJiYgWydNTScsIG1vbnRoc10gIHx8XG4gICAgICAgICAgICAgICAgeWVhcnMgICA9PT0gMSAgICAgICAgICAmJiBbJ3knXSAgICAgICAgICAgfHwgWyd5eScsIHllYXJzXTtcblxuICAgICAgICBhWzJdID0gd2l0aG91dFN1ZmZpeDtcbiAgICAgICAgYVszXSA9ICtwb3NOZWdEdXJhdGlvbiA+IDA7XG4gICAgICAgIGFbNF0gPSBsb2NhbGU7XG4gICAgICAgIHJldHVybiBzdWJzdGl0dXRlVGltZUFnby5hcHBseShudWxsLCBhKTtcbiAgICB9XG5cbiAgICAvLyBUaGlzIGZ1bmN0aW9uIGFsbG93cyB5b3UgdG8gc2V0IGEgdGhyZXNob2xkIGZvciByZWxhdGl2ZSB0aW1lIHN0cmluZ3NcbiAgICBmdW5jdGlvbiBkdXJhdGlvbl9odW1hbml6ZV9fZ2V0U2V0UmVsYXRpdmVUaW1lVGhyZXNob2xkICh0aHJlc2hvbGQsIGxpbWl0KSB7XG4gICAgICAgIGlmICh0aHJlc2hvbGRzW3RocmVzaG9sZF0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChsaW1pdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhyZXNob2xkc1t0aHJlc2hvbGRdO1xuICAgICAgICB9XG4gICAgICAgIHRocmVzaG9sZHNbdGhyZXNob2xkXSA9IGxpbWl0O1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBodW1hbml6ZSAod2l0aFN1ZmZpeCkge1xuICAgICAgICB2YXIgbG9jYWxlID0gdGhpcy5sb2NhbGVEYXRhKCk7XG4gICAgICAgIHZhciBvdXRwdXQgPSBkdXJhdGlvbl9odW1hbml6ZV9fcmVsYXRpdmVUaW1lKHRoaXMsICF3aXRoU3VmZml4LCBsb2NhbGUpO1xuXG4gICAgICAgIGlmICh3aXRoU3VmZml4KSB7XG4gICAgICAgICAgICBvdXRwdXQgPSBsb2NhbGUucGFzdEZ1dHVyZSgrdGhpcywgb3V0cHV0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBsb2NhbGUucG9zdGZvcm1hdChvdXRwdXQpO1xuICAgIH1cblxuICAgIHZhciBpc29fc3RyaW5nX19hYnMgPSBNYXRoLmFicztcblxuICAgIGZ1bmN0aW9uIGlzb19zdHJpbmdfX3RvSVNPU3RyaW5nKCkge1xuICAgICAgICAvLyBpbnNwaXJlZCBieSBodHRwczovL2dpdGh1Yi5jb20vZG9yZGlsbGUvbW9tZW50LWlzb2R1cmF0aW9uL2Jsb2IvbWFzdGVyL21vbWVudC5pc29kdXJhdGlvbi5qc1xuICAgICAgICB2YXIgWSA9IGlzb19zdHJpbmdfX2Ficyh0aGlzLnllYXJzKCkpO1xuICAgICAgICB2YXIgTSA9IGlzb19zdHJpbmdfX2Ficyh0aGlzLm1vbnRocygpKTtcbiAgICAgICAgdmFyIEQgPSBpc29fc3RyaW5nX19hYnModGhpcy5kYXlzKCkpO1xuICAgICAgICB2YXIgaCA9IGlzb19zdHJpbmdfX2Ficyh0aGlzLmhvdXJzKCkpO1xuICAgICAgICB2YXIgbSA9IGlzb19zdHJpbmdfX2Ficyh0aGlzLm1pbnV0ZXMoKSk7XG4gICAgICAgIHZhciBzID0gaXNvX3N0cmluZ19fYWJzKHRoaXMuc2Vjb25kcygpICsgdGhpcy5taWxsaXNlY29uZHMoKSAvIDEwMDApO1xuICAgICAgICB2YXIgdG90YWwgPSB0aGlzLmFzU2Vjb25kcygpO1xuXG4gICAgICAgIGlmICghdG90YWwpIHtcbiAgICAgICAgICAgIC8vIHRoaXMgaXMgdGhlIHNhbWUgYXMgQyMncyAoTm9kYSkgYW5kIHB5dGhvbiAoaXNvZGF0ZSkuLi5cbiAgICAgICAgICAgIC8vIGJ1dCBub3Qgb3RoZXIgSlMgKGdvb2cuZGF0ZSlcbiAgICAgICAgICAgIHJldHVybiAnUDBEJztcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiAodG90YWwgPCAwID8gJy0nIDogJycpICtcbiAgICAgICAgICAgICdQJyArXG4gICAgICAgICAgICAoWSA/IFkgKyAnWScgOiAnJykgK1xuICAgICAgICAgICAgKE0gPyBNICsgJ00nIDogJycpICtcbiAgICAgICAgICAgIChEID8gRCArICdEJyA6ICcnKSArXG4gICAgICAgICAgICAoKGggfHwgbSB8fCBzKSA/ICdUJyA6ICcnKSArXG4gICAgICAgICAgICAoaCA/IGggKyAnSCcgOiAnJykgK1xuICAgICAgICAgICAgKG0gPyBtICsgJ00nIDogJycpICtcbiAgICAgICAgICAgIChzID8gcyArICdTJyA6ICcnKTtcbiAgICB9XG5cbiAgICB2YXIgZHVyYXRpb25fcHJvdG90eXBlX19wcm90byA9IER1cmF0aW9uLnByb3RvdHlwZTtcblxuICAgIGR1cmF0aW9uX3Byb3RvdHlwZV9fcHJvdG8uYWJzICAgICAgICAgICAgPSBkdXJhdGlvbl9hYnNfX2FicztcbiAgICBkdXJhdGlvbl9wcm90b3R5cGVfX3Byb3RvLmFkZCAgICAgICAgICAgID0gZHVyYXRpb25fYWRkX3N1YnRyYWN0X19hZGQ7XG4gICAgZHVyYXRpb25fcHJvdG90eXBlX19wcm90by5zdWJ0cmFjdCAgICAgICA9IGR1cmF0aW9uX2FkZF9zdWJ0cmFjdF9fc3VidHJhY3Q7XG4gICAgZHVyYXRpb25fcHJvdG90eXBlX19wcm90by5hcyAgICAgICAgICAgICA9IGFzO1xuICAgIGR1cmF0aW9uX3Byb3RvdHlwZV9fcHJvdG8uYXNNaWxsaXNlY29uZHMgPSBhc01pbGxpc2Vjb25kcztcbiAgICBkdXJhdGlvbl9wcm90b3R5cGVfX3Byb3RvLmFzU2Vjb25kcyAgICAgID0gYXNTZWNvbmRzO1xuICAgIGR1cmF0aW9uX3Byb3RvdHlwZV9fcHJvdG8uYXNNaW51dGVzICAgICAgPSBhc01pbnV0ZXM7XG4gICAgZHVyYXRpb25fcHJvdG90eXBlX19wcm90by5hc0hvdXJzICAgICAgICA9IGFzSG91cnM7XG4gICAgZHVyYXRpb25fcHJvdG90eXBlX19wcm90by5hc0RheXMgICAgICAgICA9IGFzRGF5cztcbiAgICBkdXJhdGlvbl9wcm90b3R5cGVfX3Byb3RvLmFzV2Vla3MgICAgICAgID0gYXNXZWVrcztcbiAgICBkdXJhdGlvbl9wcm90b3R5cGVfX3Byb3RvLmFzTW9udGhzICAgICAgID0gYXNNb250aHM7XG4gICAgZHVyYXRpb25fcHJvdG90eXBlX19wcm90by5hc1llYXJzICAgICAgICA9IGFzWWVhcnM7XG4gICAgZHVyYXRpb25fcHJvdG90eXBlX19wcm90by52YWx1ZU9mICAgICAgICA9IGR1cmF0aW9uX2FzX192YWx1ZU9mO1xuICAgIGR1cmF0aW9uX3Byb3RvdHlwZV9fcHJvdG8uX2J1YmJsZSAgICAgICAgPSBidWJibGU7XG4gICAgZHVyYXRpb25fcHJvdG90eXBlX19wcm90by5nZXQgICAgICAgICAgICA9IGR1cmF0aW9uX2dldF9fZ2V0O1xuICAgIGR1cmF0aW9uX3Byb3RvdHlwZV9fcHJvdG8ubWlsbGlzZWNvbmRzICAgPSBkdXJhdGlvbl9nZXRfX21pbGxpc2Vjb25kcztcbiAgICBkdXJhdGlvbl9wcm90b3R5cGVfX3Byb3RvLnNlY29uZHMgICAgICAgID0gc2Vjb25kcztcbiAgICBkdXJhdGlvbl9wcm90b3R5cGVfX3Byb3RvLm1pbnV0ZXMgICAgICAgID0gbWludXRlcztcbiAgICBkdXJhdGlvbl9wcm90b3R5cGVfX3Byb3RvLmhvdXJzICAgICAgICAgID0gaG91cnM7XG4gICAgZHVyYXRpb25fcHJvdG90eXBlX19wcm90by5kYXlzICAgICAgICAgICA9IGRheXM7XG4gICAgZHVyYXRpb25fcHJvdG90eXBlX19wcm90by53ZWVrcyAgICAgICAgICA9IHdlZWtzO1xuICAgIGR1cmF0aW9uX3Byb3RvdHlwZV9fcHJvdG8ubW9udGhzICAgICAgICAgPSBtb250aHM7XG4gICAgZHVyYXRpb25fcHJvdG90eXBlX19wcm90by55ZWFycyAgICAgICAgICA9IHllYXJzO1xuICAgIGR1cmF0aW9uX3Byb3RvdHlwZV9fcHJvdG8uaHVtYW5pemUgICAgICAgPSBodW1hbml6ZTtcbiAgICBkdXJhdGlvbl9wcm90b3R5cGVfX3Byb3RvLnRvSVNPU3RyaW5nICAgID0gaXNvX3N0cmluZ19fdG9JU09TdHJpbmc7XG4gICAgZHVyYXRpb25fcHJvdG90eXBlX19wcm90by50b1N0cmluZyAgICAgICA9IGlzb19zdHJpbmdfX3RvSVNPU3RyaW5nO1xuICAgIGR1cmF0aW9uX3Byb3RvdHlwZV9fcHJvdG8udG9KU09OICAgICAgICAgPSBpc29fc3RyaW5nX190b0lTT1N0cmluZztcbiAgICBkdXJhdGlvbl9wcm90b3R5cGVfX3Byb3RvLmxvY2FsZSAgICAgICAgID0gbG9jYWxlO1xuICAgIGR1cmF0aW9uX3Byb3RvdHlwZV9fcHJvdG8ubG9jYWxlRGF0YSAgICAgPSBsb2NhbGVEYXRhO1xuXG4gICAgLy8gRGVwcmVjYXRpb25zXG4gICAgZHVyYXRpb25fcHJvdG90eXBlX19wcm90by50b0lzb1N0cmluZyA9IGRlcHJlY2F0ZSgndG9Jc29TdHJpbmcoKSBpcyBkZXByZWNhdGVkLiBQbGVhc2UgdXNlIHRvSVNPU3RyaW5nKCkgaW5zdGVhZCAobm90aWNlIHRoZSBjYXBpdGFscyknLCBpc29fc3RyaW5nX190b0lTT1N0cmluZyk7XG4gICAgZHVyYXRpb25fcHJvdG90eXBlX19wcm90by5sYW5nID0gbGFuZztcblxuICAgIC8vIFNpZGUgZWZmZWN0IGltcG9ydHNcblxuICAgIGFkZEZvcm1hdFRva2VuKCdYJywgMCwgMCwgJ3VuaXgnKTtcbiAgICBhZGRGb3JtYXRUb2tlbigneCcsIDAsIDAsICd2YWx1ZU9mJyk7XG5cbiAgICAvLyBQQVJTSU5HXG5cbiAgICBhZGRSZWdleFRva2VuKCd4JywgbWF0Y2hTaWduZWQpO1xuICAgIGFkZFJlZ2V4VG9rZW4oJ1gnLCBtYXRjaFRpbWVzdGFtcCk7XG4gICAgYWRkUGFyc2VUb2tlbignWCcsIGZ1bmN0aW9uIChpbnB1dCwgYXJyYXksIGNvbmZpZykge1xuICAgICAgICBjb25maWcuX2QgPSBuZXcgRGF0ZShwYXJzZUZsb2F0KGlucHV0LCAxMCkgKiAxMDAwKTtcbiAgICB9KTtcbiAgICBhZGRQYXJzZVRva2VuKCd4JywgZnVuY3Rpb24gKGlucHV0LCBhcnJheSwgY29uZmlnKSB7XG4gICAgICAgIGNvbmZpZy5fZCA9IG5ldyBEYXRlKHRvSW50KGlucHV0KSk7XG4gICAgfSk7XG5cbiAgICAvLyBTaWRlIGVmZmVjdCBpbXBvcnRzXG5cblxuICAgIHV0aWxzX2hvb2tzX19ob29rcy52ZXJzaW9uID0gJzIuMTAuMic7XG5cbiAgICBzZXRIb29rQ2FsbGJhY2sobG9jYWxfX2NyZWF0ZUxvY2FsKTtcblxuICAgIHV0aWxzX2hvb2tzX19ob29rcy5mbiAgICAgICAgICAgICAgICAgICAgPSBtb21lbnRQcm90b3R5cGU7XG4gICAgdXRpbHNfaG9va3NfX2hvb2tzLm1pbiAgICAgICAgICAgICAgICAgICA9IG1pbjtcbiAgICB1dGlsc19ob29rc19faG9va3MubWF4ICAgICAgICAgICAgICAgICAgID0gbWF4O1xuICAgIHV0aWxzX2hvb2tzX19ob29rcy51dGMgICAgICAgICAgICAgICAgICAgPSBjcmVhdGVfdXRjX19jcmVhdGVVVEM7XG4gICAgdXRpbHNfaG9va3NfX2hvb2tzLnVuaXggICAgICAgICAgICAgICAgICA9IG1vbWVudF9fY3JlYXRlVW5peDtcbiAgICB1dGlsc19ob29rc19faG9va3MubW9udGhzICAgICAgICAgICAgICAgID0gbGlzdHNfX2xpc3RNb250aHM7XG4gICAgdXRpbHNfaG9va3NfX2hvb2tzLmlzRGF0ZSAgICAgICAgICAgICAgICA9IGlzRGF0ZTtcbiAgICB1dGlsc19ob29rc19faG9va3MubG9jYWxlICAgICAgICAgICAgICAgID0gbG9jYWxlX2xvY2FsZXNfX2dldFNldEdsb2JhbExvY2FsZTtcbiAgICB1dGlsc19ob29rc19faG9va3MuaW52YWxpZCAgICAgICAgICAgICAgID0gdmFsaWRfX2NyZWF0ZUludmFsaWQ7XG4gICAgdXRpbHNfaG9va3NfX2hvb2tzLmR1cmF0aW9uICAgICAgICAgICAgICA9IGNyZWF0ZV9fY3JlYXRlRHVyYXRpb247XG4gICAgdXRpbHNfaG9va3NfX2hvb2tzLmlzTW9tZW50ICAgICAgICAgICAgICA9IGlzTW9tZW50O1xuICAgIHV0aWxzX2hvb2tzX19ob29rcy53ZWVrZGF5cyAgICAgICAgICAgICAgPSBsaXN0c19fbGlzdFdlZWtkYXlzO1xuICAgIHV0aWxzX2hvb2tzX19ob29rcy5wYXJzZVpvbmUgICAgICAgICAgICAgPSBtb21lbnRfX2NyZWF0ZUluWm9uZTtcbiAgICB1dGlsc19ob29rc19faG9va3MubG9jYWxlRGF0YSAgICAgICAgICAgID0gbG9jYWxlX2xvY2FsZXNfX2dldExvY2FsZTtcbiAgICB1dGlsc19ob29rc19faG9va3MuaXNEdXJhdGlvbiAgICAgICAgICAgID0gaXNEdXJhdGlvbjtcbiAgICB1dGlsc19ob29rc19faG9va3MubW9udGhzU2hvcnQgICAgICAgICAgID0gbGlzdHNfX2xpc3RNb250aHNTaG9ydDtcbiAgICB1dGlsc19ob29rc19faG9va3Mud2Vla2RheXNNaW4gICAgICAgICAgID0gbGlzdHNfX2xpc3RXZWVrZGF5c01pbjtcbiAgICB1dGlsc19ob29rc19faG9va3MuZGVmaW5lTG9jYWxlICAgICAgICAgID0gZGVmaW5lTG9jYWxlO1xuICAgIHV0aWxzX2hvb2tzX19ob29rcy53ZWVrZGF5c1Nob3J0ICAgICAgICAgPSBsaXN0c19fbGlzdFdlZWtkYXlzU2hvcnQ7XG4gICAgdXRpbHNfaG9va3NfX2hvb2tzLm5vcm1hbGl6ZVVuaXRzICAgICAgICA9IG5vcm1hbGl6ZVVuaXRzO1xuICAgIHV0aWxzX2hvb2tzX19ob29rcy5yZWxhdGl2ZVRpbWVUaHJlc2hvbGQgPSBkdXJhdGlvbl9odW1hbml6ZV9fZ2V0U2V0UmVsYXRpdmVUaW1lVGhyZXNob2xkO1xuXG4gICAgdmFyIF9tb21lbnQgPSB1dGlsc19ob29rc19faG9va3M7XG5cbiAgICByZXR1cm4gX21vbWVudDtcblxufSkpOyIsIlwidXNlIHN0cmljdFwiO2Z1bmN0aW9uIHEoYSl7dGhyb3cgYTt9dmFyIHM9dm9pZCAwLHU9ITE7dmFyIHNqY2w9e2NpcGhlcjp7fSxoYXNoOnt9LGtleWV4Y2hhbmdlOnt9LG1vZGU6e30sbWlzYzp7fSxjb2RlYzp7fSxleGNlcHRpb246e2NvcnJ1cHQ6ZnVuY3Rpb24oYSl7dGhpcy50b1N0cmluZz1mdW5jdGlvbigpe3JldHVyblwiQ09SUlVQVDogXCIrdGhpcy5tZXNzYWdlfTt0aGlzLm1lc3NhZ2U9YX0saW52YWxpZDpmdW5jdGlvbihhKXt0aGlzLnRvU3RyaW5nPWZ1bmN0aW9uKCl7cmV0dXJuXCJJTlZBTElEOiBcIit0aGlzLm1lc3NhZ2V9O3RoaXMubWVzc2FnZT1hfSxidWc6ZnVuY3Rpb24oYSl7dGhpcy50b1N0cmluZz1mdW5jdGlvbigpe3JldHVyblwiQlVHOiBcIit0aGlzLm1lc3NhZ2V9O3RoaXMubWVzc2FnZT1hfSxub3RSZWFkeTpmdW5jdGlvbihhKXt0aGlzLnRvU3RyaW5nPWZ1bmN0aW9uKCl7cmV0dXJuXCJOT1QgUkVBRFk6IFwiK3RoaXMubWVzc2FnZX07dGhpcy5tZXNzYWdlPWF9fX07XG5cInVuZGVmaW5lZFwiIT09dHlwZW9mIG1vZHVsZSYmbW9kdWxlLmV4cG9ydHMmJihtb2R1bGUuZXhwb3J0cz1zamNsKTtcImZ1bmN0aW9uXCI9PT10eXBlb2YgZGVmaW5lJiZkZWZpbmUoW10sZnVuY3Rpb24oKXtyZXR1cm4gc2pjbH0pO1xuc2pjbC5jaXBoZXIuYWVzPWZ1bmN0aW9uKGEpe3RoaXMua1swXVswXVswXXx8dGhpcy5EKCk7dmFyIGIsYyxkLGUsZj10aGlzLmtbMF1bNF0sZz10aGlzLmtbMV07Yj1hLmxlbmd0aDt2YXIgaD0xOzQhPT1iJiYoNiE9PWImJjghPT1iKSYmcShuZXcgc2pjbC5leGNlcHRpb24uaW52YWxpZChcImludmFsaWQgYWVzIGtleSBzaXplXCIpKTt0aGlzLmI9W2Q9YS5zbGljZSgwKSxlPVtdXTtmb3IoYT1iO2E8NCpiKzI4O2ErKyl7Yz1kW2EtMV07aWYoMD09PWElYnx8OD09PWImJjQ9PT1hJWIpYz1mW2M+Pj4yNF08PDI0XmZbYz4+MTYmMjU1XTw8MTZeZltjPj44JjI1NV08PDheZltjJjI1NV0sMD09PWElYiYmKGM9Yzw8OF5jPj4+MjReaDw8MjQsaD1oPDwxXjI4MyooaD4+NykpO2RbYV09ZFthLWJdXmN9Zm9yKGI9MDthO2IrKyxhLS0pYz1kW2ImMz9hOmEtNF0sZVtiXT00Pj1hfHw0PmI/YzpnWzBdW2ZbYz4+PjI0XV1eZ1sxXVtmW2M+PjE2JjI1NV1dXmdbMl1bZltjPj44JjI1NV1dXmdbM11bZltjJlxuMjU1XV19O1xuc2pjbC5jaXBoZXIuYWVzLnByb3RvdHlwZT17ZW5jcnlwdDpmdW5jdGlvbihhKXtyZXR1cm4gdyh0aGlzLGEsMCl9LGRlY3J5cHQ6ZnVuY3Rpb24oYSl7cmV0dXJuIHcodGhpcyxhLDEpfSxrOltbW10sW10sW10sW10sW11dLFtbXSxbXSxbXSxbXSxbXV1dLEQ6ZnVuY3Rpb24oKXt2YXIgYT10aGlzLmtbMF0sYj10aGlzLmtbMV0sYz1hWzRdLGQ9Yls0XSxlLGYsZyxoPVtdLGw9W10sayxuLG0scDtmb3IoZT0wOzB4MTAwPmU7ZSsrKWxbKGhbZV09ZTw8MV4yODMqKGU+PjcpKV5lXT1lO2ZvcihmPWc9MDshY1tmXTtmXj1rfHwxLGc9bFtnXXx8MSl7bT1nXmc8PDFeZzw8Ml5nPDwzXmc8PDQ7bT1tPj44Xm0mMjU1Xjk5O2NbZl09bTtkW21dPWY7bj1oW2U9aFtrPWhbZl1dXTtwPTB4MTAxMDEwMSpuXjB4MTAwMDEqZV4weDEwMSprXjB4MTAxMDEwMCpmO249MHgxMDEqaFttXV4weDEwMTAxMDAqbTtmb3IoZT0wOzQ+ZTtlKyspYVtlXVtmXT1uPW48PDI0Xm4+Pj44LGJbZV1bbV09cD1wPDwyNF5wPj4+OH1mb3IoZT1cbjA7NT5lO2UrKylhW2VdPWFbZV0uc2xpY2UoMCksYltlXT1iW2VdLnNsaWNlKDApfX07XG5mdW5jdGlvbiB3KGEsYixjKXs0IT09Yi5sZW5ndGgmJnEobmV3IHNqY2wuZXhjZXB0aW9uLmludmFsaWQoXCJpbnZhbGlkIGFlcyBibG9jayBzaXplXCIpKTt2YXIgZD1hLmJbY10sZT1iWzBdXmRbMF0sZj1iW2M/MzoxXV5kWzFdLGc9YlsyXV5kWzJdO2I9YltjPzE6M11eZFszXTt2YXIgaCxsLGssbj1kLmxlbmd0aC80LTIsbSxwPTQsdD1bMCwwLDAsMF07aD1hLmtbY107YT1oWzBdO3ZhciByPWhbMV0sdj1oWzJdLHk9aFszXSx6PWhbNF07Zm9yKG09MDttPG47bSsrKWg9YVtlPj4+MjRdXnJbZj4+MTYmMjU1XV52W2c+PjgmMjU1XV55W2ImMjU1XV5kW3BdLGw9YVtmPj4+MjRdXnJbZz4+MTYmMjU1XV52W2I+PjgmMjU1XV55W2UmMjU1XV5kW3ArMV0saz1hW2c+Pj4yNF1ecltiPj4xNiYyNTVdXnZbZT4+OCYyNTVdXnlbZiYyNTVdXmRbcCsyXSxiPWFbYj4+PjI0XV5yW2U+PjE2JjI1NV1edltmPj44JjI1NV1eeVtnJjI1NV1eZFtwKzNdLHArPTQsZT1oLGY9bCxnPWs7Zm9yKG09MDs0PlxubTttKyspdFtjPzMmLW06bV09eltlPj4+MjRdPDwyNF56W2Y+PjE2JjI1NV08PDE2XnpbZz4+OCYyNTVdPDw4XnpbYiYyNTVdXmRbcCsrXSxoPWUsZT1mLGY9ZyxnPWIsYj1oO3JldHVybiB0fVxuc2pjbC5iaXRBcnJheT17Yml0U2xpY2U6ZnVuY3Rpb24oYSxiLGMpe2E9c2pjbC5iaXRBcnJheS5QKGEuc2xpY2UoYi8zMiksMzItKGImMzEpKS5zbGljZSgxKTtyZXR1cm4gYz09PXM/YTpzamNsLmJpdEFycmF5LmNsYW1wKGEsYy1iKX0sZXh0cmFjdDpmdW5jdGlvbihhLGIsYyl7dmFyIGQ9TWF0aC5mbG9vcigtYi1jJjMxKTtyZXR1cm4oKGIrYy0xXmIpJi0zMj9hW2IvMzJ8MF08PDMyLWReYVtiLzMyKzF8MF0+Pj5kOmFbYi8zMnwwXT4+PmQpJigxPDxjKS0xfSxjb25jYXQ6ZnVuY3Rpb24oYSxiKXtpZigwPT09YS5sZW5ndGh8fDA9PT1iLmxlbmd0aClyZXR1cm4gYS5jb25jYXQoYik7dmFyIGM9YVthLmxlbmd0aC0xXSxkPXNqY2wuYml0QXJyYXkuZ2V0UGFydGlhbChjKTtyZXR1cm4gMzI9PT1kP2EuY29uY2F0KGIpOnNqY2wuYml0QXJyYXkuUChiLGQsY3wwLGEuc2xpY2UoMCxhLmxlbmd0aC0xKSl9LGJpdExlbmd0aDpmdW5jdGlvbihhKXt2YXIgYj1hLmxlbmd0aDtyZXR1cm4gMD09PVxuYj8wOjMyKihiLTEpK3NqY2wuYml0QXJyYXkuZ2V0UGFydGlhbChhW2ItMV0pfSxjbGFtcDpmdW5jdGlvbihhLGIpe2lmKDMyKmEubGVuZ3RoPGIpcmV0dXJuIGE7YT1hLnNsaWNlKDAsTWF0aC5jZWlsKGIvMzIpKTt2YXIgYz1hLmxlbmd0aDtiJj0zMTswPGMmJmImJihhW2MtMV09c2pjbC5iaXRBcnJheS5wYXJ0aWFsKGIsYVtjLTFdJjIxNDc0ODM2NDg+PmItMSwxKSk7cmV0dXJuIGF9LHBhcnRpYWw6ZnVuY3Rpb24oYSxiLGMpe3JldHVybiAzMj09PWE/YjooYz9ifDA6Yjw8MzItYSkrMHgxMDAwMDAwMDAwMCphfSxnZXRQYXJ0aWFsOmZ1bmN0aW9uKGEpe3JldHVybiBNYXRoLnJvdW5kKGEvMHgxMDAwMDAwMDAwMCl8fDMyfSxlcXVhbDpmdW5jdGlvbihhLGIpe2lmKHNqY2wuYml0QXJyYXkuYml0TGVuZ3RoKGEpIT09c2pjbC5iaXRBcnJheS5iaXRMZW5ndGgoYikpcmV0dXJuIHU7dmFyIGM9MCxkO2ZvcihkPTA7ZDxhLmxlbmd0aDtkKyspY3w9YVtkXV5iW2RdO3JldHVybiAwPT09XG5jfSxQOmZ1bmN0aW9uKGEsYixjLGQpe3ZhciBlO2U9MDtmb3IoZD09PXMmJihkPVtdKTszMjw9YjtiLT0zMilkLnB1c2goYyksYz0wO2lmKDA9PT1iKXJldHVybiBkLmNvbmNhdChhKTtmb3IoZT0wO2U8YS5sZW5ndGg7ZSsrKWQucHVzaChjfGFbZV0+Pj5iKSxjPWFbZV08PDMyLWI7ZT1hLmxlbmd0aD9hW2EubGVuZ3RoLTFdOjA7YT1zamNsLmJpdEFycmF5LmdldFBhcnRpYWwoZSk7ZC5wdXNoKHNqY2wuYml0QXJyYXkucGFydGlhbChiK2EmMzEsMzI8YithP2M6ZC5wb3AoKSwxKSk7cmV0dXJuIGR9LGw6ZnVuY3Rpb24oYSxiKXtyZXR1cm5bYVswXV5iWzBdLGFbMV1eYlsxXSxhWzJdXmJbMl0sYVszXV5iWzNdXX0sYnl0ZXN3YXBNOmZ1bmN0aW9uKGEpe3ZhciBiLGM7Zm9yKGI9MDtiPGEubGVuZ3RoOysrYiljPWFbYl0sYVtiXT1jPj4+MjR8Yz4+PjgmMHhmZjAwfChjJjB4ZmYwMCk8PDh8Yzw8MjQ7cmV0dXJuIGF9fTtcbnNqY2wuY29kZWMudXRmOFN0cmluZz17ZnJvbUJpdHM6ZnVuY3Rpb24oYSl7dmFyIGI9XCJcIixjPXNqY2wuYml0QXJyYXkuYml0TGVuZ3RoKGEpLGQsZTtmb3IoZD0wO2Q8Yy84O2QrKykwPT09KGQmMykmJihlPWFbZC80XSksYis9U3RyaW5nLmZyb21DaGFyQ29kZShlPj4+MjQpLGU8PD04O3JldHVybiBkZWNvZGVVUklDb21wb25lbnQoZXNjYXBlKGIpKX0sdG9CaXRzOmZ1bmN0aW9uKGEpe2E9dW5lc2NhcGUoZW5jb2RlVVJJQ29tcG9uZW50KGEpKTt2YXIgYj1bXSxjLGQ9MDtmb3IoYz0wO2M8YS5sZW5ndGg7YysrKWQ9ZDw8OHxhLmNoYXJDb2RlQXQoYyksMz09PShjJjMpJiYoYi5wdXNoKGQpLGQ9MCk7YyYzJiZiLnB1c2goc2pjbC5iaXRBcnJheS5wYXJ0aWFsKDgqKGMmMyksZCkpO3JldHVybiBifX07XG5zamNsLmNvZGVjLmhleD17ZnJvbUJpdHM6ZnVuY3Rpb24oYSl7dmFyIGI9XCJcIixjO2ZvcihjPTA7YzxhLmxlbmd0aDtjKyspYis9KChhW2NdfDApKzB4ZjAwMDAwMDAwMDAwKS50b1N0cmluZygxNikuc3Vic3RyKDQpO3JldHVybiBiLnN1YnN0cigwLHNqY2wuYml0QXJyYXkuYml0TGVuZ3RoKGEpLzQpfSx0b0JpdHM6ZnVuY3Rpb24oYSl7dmFyIGIsYz1bXSxkO2E9YS5yZXBsYWNlKC9cXHN8MHgvZyxcIlwiKTtkPWEubGVuZ3RoO2ErPVwiMDAwMDAwMDBcIjtmb3IoYj0wO2I8YS5sZW5ndGg7Yis9OCljLnB1c2gocGFyc2VJbnQoYS5zdWJzdHIoYiw4KSwxNileMCk7cmV0dXJuIHNqY2wuYml0QXJyYXkuY2xhbXAoYyw0KmQpfX07XG5zamNsLmNvZGVjLmJhc2U2ND17SjpcIkFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5Ky9cIixmcm9tQml0czpmdW5jdGlvbihhLGIsYyl7dmFyIGQ9XCJcIixlPTAsZj1zamNsLmNvZGVjLmJhc2U2NC5KLGc9MCxoPXNqY2wuYml0QXJyYXkuYml0TGVuZ3RoKGEpO2MmJihmPWYuc3Vic3RyKDAsNjIpK1wiLV9cIik7Zm9yKGM9MDs2KmQubGVuZ3RoPGg7KWQrPWYuY2hhckF0KChnXmFbY10+Pj5lKT4+PjI2KSw2PmU/KGc9YVtjXTw8Ni1lLGUrPTI2LGMrKyk6KGc8PD02LGUtPTYpO2Zvcig7ZC5sZW5ndGgmMyYmIWI7KWQrPVwiPVwiO3JldHVybiBkfSx0b0JpdHM6ZnVuY3Rpb24oYSxiKXthPWEucmVwbGFjZSgvXFxzfD0vZyxcIlwiKTt2YXIgYz1bXSxkLGU9MCxmPXNqY2wuY29kZWMuYmFzZTY0LkosZz0wLGg7YiYmKGY9Zi5zdWJzdHIoMCw2MikrXCItX1wiKTtmb3IoZD0wO2Q8YS5sZW5ndGg7ZCsrKWg9Zi5pbmRleE9mKGEuY2hhckF0KGQpKSxcbjA+aCYmcShuZXcgc2pjbC5leGNlcHRpb24uaW52YWxpZChcInRoaXMgaXNuJ3QgYmFzZTY0IVwiKSksMjY8ZT8oZS09MjYsYy5wdXNoKGdeaD4+PmUpLGc9aDw8MzItZSk6KGUrPTYsZ149aDw8MzItZSk7ZSY1NiYmYy5wdXNoKHNqY2wuYml0QXJyYXkucGFydGlhbChlJjU2LGcsMSkpO3JldHVybiBjfX07c2pjbC5jb2RlYy5iYXNlNjR1cmw9e2Zyb21CaXRzOmZ1bmN0aW9uKGEpe3JldHVybiBzamNsLmNvZGVjLmJhc2U2NC5mcm9tQml0cyhhLDEsMSl9LHRvQml0czpmdW5jdGlvbihhKXtyZXR1cm4gc2pjbC5jb2RlYy5iYXNlNjQudG9CaXRzKGEsMSl9fTtzamNsLmhhc2guc2hhMjU2PWZ1bmN0aW9uKGEpe3RoaXMuYlswXXx8dGhpcy5EKCk7YT8odGhpcy5yPWEuci5zbGljZSgwKSx0aGlzLm89YS5vLnNsaWNlKDApLHRoaXMuaD1hLmgpOnRoaXMucmVzZXQoKX07c2pjbC5oYXNoLnNoYTI1Ni5oYXNoPWZ1bmN0aW9uKGEpe3JldHVybihuZXcgc2pjbC5oYXNoLnNoYTI1NikudXBkYXRlKGEpLmZpbmFsaXplKCl9O1xuc2pjbC5oYXNoLnNoYTI1Ni5wcm90b3R5cGU9e2Jsb2NrU2l6ZTo1MTIscmVzZXQ6ZnVuY3Rpb24oKXt0aGlzLnI9dGhpcy5OLnNsaWNlKDApO3RoaXMubz1bXTt0aGlzLmg9MDtyZXR1cm4gdGhpc30sdXBkYXRlOmZ1bmN0aW9uKGEpe1wic3RyaW5nXCI9PT10eXBlb2YgYSYmKGE9c2pjbC5jb2RlYy51dGY4U3RyaW5nLnRvQml0cyhhKSk7dmFyIGIsYz10aGlzLm89c2pjbC5iaXRBcnJheS5jb25jYXQodGhpcy5vLGEpO2I9dGhpcy5oO2E9dGhpcy5oPWIrc2pjbC5iaXRBcnJheS5iaXRMZW5ndGgoYSk7Zm9yKGI9NTEyK2ImLTUxMjtiPD1hO2IrPTUxMil4KHRoaXMsYy5zcGxpY2UoMCwxNikpO3JldHVybiB0aGlzfSxmaW5hbGl6ZTpmdW5jdGlvbigpe3ZhciBhLGI9dGhpcy5vLGM9dGhpcy5yLGI9c2pjbC5iaXRBcnJheS5jb25jYXQoYixbc2pjbC5iaXRBcnJheS5wYXJ0aWFsKDEsMSldKTtmb3IoYT1iLmxlbmd0aCsyO2EmMTU7YSsrKWIucHVzaCgwKTtiLnB1c2goTWF0aC5mbG9vcih0aGlzLmgvXG40Mjk0OTY3Mjk2KSk7Zm9yKGIucHVzaCh0aGlzLmh8MCk7Yi5sZW5ndGg7KXgodGhpcyxiLnNwbGljZSgwLDE2KSk7dGhpcy5yZXNldCgpO3JldHVybiBjfSxOOltdLGI6W10sRDpmdW5jdGlvbigpe2Z1bmN0aW9uIGEoYSl7cmV0dXJuIDB4MTAwMDAwMDAwKihhLU1hdGguZmxvb3IoYSkpfDB9dmFyIGI9MCxjPTIsZDthOmZvcig7NjQ+YjtjKyspe2ZvcihkPTI7ZCpkPD1jO2QrKylpZigwPT09YyVkKWNvbnRpbnVlIGE7OD5iJiYodGhpcy5OW2JdPWEoTWF0aC5wb3coYywwLjUpKSk7dGhpcy5iW2JdPWEoTWF0aC5wb3coYywxLzMpKTtiKyt9fX07XG5mdW5jdGlvbiB4KGEsYil7dmFyIGMsZCxlLGY9Yi5zbGljZSgwKSxnPWEucixoPWEuYixsPWdbMF0saz1nWzFdLG49Z1syXSxtPWdbM10scD1nWzRdLHQ9Z1s1XSxyPWdbNl0sdj1nWzddO2ZvcihjPTA7NjQ+YztjKyspMTY+Yz9kPWZbY106KGQ9ZltjKzEmMTVdLGU9ZltjKzE0JjE1XSxkPWZbYyYxNV09KGQ+Pj43XmQ+Pj4xOF5kPj4+M15kPDwyNV5kPDwxNCkrKGU+Pj4xN15lPj4+MTleZT4+PjEwXmU8PDE1XmU8PDEzKStmW2MmMTVdK2ZbYys5JjE1XXwwKSxkPWQrdisocD4+PjZecD4+PjExXnA+Pj4yNV5wPDwyNl5wPDwyMV5wPDw3KSsocl5wJih0XnIpKStoW2NdLHY9cixyPXQsdD1wLHA9bStkfDAsbT1uLG49ayxrPWwsbD1kKyhrJm5ebSYoa15uKSkrKGs+Pj4yXms+Pj4xM15rPj4+MjJeazw8MzBeazw8MTleazw8MTApfDA7Z1swXT1nWzBdK2x8MDtnWzFdPWdbMV0ra3wwO2dbMl09Z1syXStufDA7Z1szXT1nWzNdK218MDtnWzRdPWdbNF0rcHwwO2dbNV09Z1s1XSt0fDA7Z1s2XT1cbmdbNl0rcnwwO2dbN109Z1s3XSt2fDB9XG5zamNsLm1vZGUuY2NtPXtuYW1lOlwiY2NtXCIsZW5jcnlwdDpmdW5jdGlvbihhLGIsYyxkLGUpe3ZhciBmLGc9Yi5zbGljZSgwKSxoPXNqY2wuYml0QXJyYXksbD1oLmJpdExlbmd0aChjKS84LGs9aC5iaXRMZW5ndGgoZykvODtlPWV8fDY0O2Q9ZHx8W107Nz5sJiZxKG5ldyBzamNsLmV4Y2VwdGlvbi5pbnZhbGlkKFwiY2NtOiBpdiBtdXN0IGJlIGF0IGxlYXN0IDcgYnl0ZXNcIikpO2ZvcihmPTI7ND5mJiZrPj4+OCpmO2YrKyk7ZjwxNS1sJiYoZj0xNS1sKTtjPWguY2xhbXAoYyw4KigxNS1mKSk7Yj1zamNsLm1vZGUuY2NtLkwoYSxiLGMsZCxlLGYpO2c9c2pjbC5tb2RlLmNjbS5wKGEsZyxjLGIsZSxmKTtyZXR1cm4gaC5jb25jYXQoZy5kYXRhLGcudGFnKX0sZGVjcnlwdDpmdW5jdGlvbihhLGIsYyxkLGUpe2U9ZXx8NjQ7ZD1kfHxbXTt2YXIgZj1zamNsLmJpdEFycmF5LGc9Zi5iaXRMZW5ndGgoYykvOCxoPWYuYml0TGVuZ3RoKGIpLGw9Zi5jbGFtcChiLGgtZSksaz1mLmJpdFNsaWNlKGIsXG5oLWUpLGg9KGgtZSkvODs3PmcmJnEobmV3IHNqY2wuZXhjZXB0aW9uLmludmFsaWQoXCJjY206IGl2IG11c3QgYmUgYXQgbGVhc3QgNyBieXRlc1wiKSk7Zm9yKGI9Mjs0PmImJmg+Pj44KmI7YisrKTtiPDE1LWcmJihiPTE1LWcpO2M9Zi5jbGFtcChjLDgqKDE1LWIpKTtsPXNqY2wubW9kZS5jY20ucChhLGwsYyxrLGUsYik7YT1zamNsLm1vZGUuY2NtLkwoYSxsLmRhdGEsYyxkLGUsYik7Zi5lcXVhbChsLnRhZyxhKXx8cShuZXcgc2pjbC5leGNlcHRpb24uY29ycnVwdChcImNjbTogdGFnIGRvZXNuJ3QgbWF0Y2hcIikpO3JldHVybiBsLmRhdGF9LEw6ZnVuY3Rpb24oYSxiLGMsZCxlLGYpe3ZhciBnPVtdLGg9c2pjbC5iaXRBcnJheSxsPWgubDtlLz04OyhlJTJ8fDQ+ZXx8MTY8ZSkmJnEobmV3IHNqY2wuZXhjZXB0aW9uLmludmFsaWQoXCJjY206IGludmFsaWQgdGFnIGxlbmd0aFwiKSk7KDB4ZmZmZmZmZmY8ZC5sZW5ndGh8fDB4ZmZmZmZmZmY8Yi5sZW5ndGgpJiZxKG5ldyBzamNsLmV4Y2VwdGlvbi5idWcoXCJjY206IGNhbid0IGRlYWwgd2l0aCA0R2lCIG9yIG1vcmUgZGF0YVwiKSk7XG5mPVtoLnBhcnRpYWwoOCwoZC5sZW5ndGg/NjQ6MCl8ZS0yPDwyfGYtMSldO2Y9aC5jb25jYXQoZixjKTtmWzNdfD1oLmJpdExlbmd0aChiKS84O2Y9YS5lbmNyeXB0KGYpO2lmKGQubGVuZ3RoKXtjPWguYml0TGVuZ3RoKGQpLzg7NjUyNzk+PWM/Zz1baC5wYXJ0aWFsKDE2LGMpXToweGZmZmZmZmZmPj1jJiYoZz1oLmNvbmNhdChbaC5wYXJ0aWFsKDE2LDY1NTM0KV0sW2NdKSk7Zz1oLmNvbmNhdChnLGQpO2ZvcihkPTA7ZDxnLmxlbmd0aDtkKz00KWY9YS5lbmNyeXB0KGwoZixnLnNsaWNlKGQsZCs0KS5jb25jYXQoWzAsMCwwXSkpKX1mb3IoZD0wO2Q8Yi5sZW5ndGg7ZCs9NClmPWEuZW5jcnlwdChsKGYsYi5zbGljZShkLGQrNCkuY29uY2F0KFswLDAsMF0pKSk7cmV0dXJuIGguY2xhbXAoZiw4KmUpfSxwOmZ1bmN0aW9uKGEsYixjLGQsZSxmKXt2YXIgZyxoPXNqY2wuYml0QXJyYXk7Zz1oLmw7dmFyIGw9Yi5sZW5ndGgsaz1oLmJpdExlbmd0aChiKTtjPWguY29uY2F0KFtoLnBhcnRpYWwoOCxcbmYtMSldLGMpLmNvbmNhdChbMCwwLDBdKS5zbGljZSgwLDQpO2Q9aC5iaXRTbGljZShnKGQsYS5lbmNyeXB0KGMpKSwwLGUpO2lmKCFsKXJldHVybnt0YWc6ZCxkYXRhOltdfTtmb3IoZz0wO2c8bDtnKz00KWNbM10rKyxlPWEuZW5jcnlwdChjKSxiW2ddXj1lWzBdLGJbZysxXV49ZVsxXSxiW2crMl1ePWVbMl0sYltnKzNdXj1lWzNdO3JldHVybnt0YWc6ZCxkYXRhOmguY2xhbXAoYixrKX19fTtcbnNqY2wubW9kZS5vY2IyPXtuYW1lOlwib2NiMlwiLGVuY3J5cHQ6ZnVuY3Rpb24oYSxiLGMsZCxlLGYpezEyOCE9PXNqY2wuYml0QXJyYXkuYml0TGVuZ3RoKGMpJiZxKG5ldyBzamNsLmV4Y2VwdGlvbi5pbnZhbGlkKFwib2NiIGl2IG11c3QgYmUgMTI4IGJpdHNcIikpO3ZhciBnLGg9c2pjbC5tb2RlLm9jYjIuSCxsPXNqY2wuYml0QXJyYXksaz1sLmwsbj1bMCwwLDAsMF07Yz1oKGEuZW5jcnlwdChjKSk7dmFyIG0scD1bXTtkPWR8fFtdO2U9ZXx8NjQ7Zm9yKGc9MDtnKzQ8Yi5sZW5ndGg7Zys9NCltPWIuc2xpY2UoZyxnKzQpLG49ayhuLG0pLHA9cC5jb25jYXQoayhjLGEuZW5jcnlwdChrKGMsbSkpKSksYz1oKGMpO209Yi5zbGljZShnKTtiPWwuYml0TGVuZ3RoKG0pO2c9YS5lbmNyeXB0KGsoYyxbMCwwLDAsYl0pKTttPWwuY2xhbXAoayhtLmNvbmNhdChbMCwwLDBdKSxnKSxiKTtuPWsobixrKG0uY29uY2F0KFswLDAsMF0pLGcpKTtuPWEuZW5jcnlwdChrKG4sayhjLGgoYykpKSk7ZC5sZW5ndGgmJlxuKG49ayhuLGY/ZDpzamNsLm1vZGUub2NiMi5wbWFjKGEsZCkpKTtyZXR1cm4gcC5jb25jYXQobC5jb25jYXQobSxsLmNsYW1wKG4sZSkpKX0sZGVjcnlwdDpmdW5jdGlvbihhLGIsYyxkLGUsZil7MTI4IT09c2pjbC5iaXRBcnJheS5iaXRMZW5ndGgoYykmJnEobmV3IHNqY2wuZXhjZXB0aW9uLmludmFsaWQoXCJvY2IgaXYgbXVzdCBiZSAxMjggYml0c1wiKSk7ZT1lfHw2NDt2YXIgZz1zamNsLm1vZGUub2NiMi5ILGg9c2pjbC5iaXRBcnJheSxsPWgubCxrPVswLDAsMCwwXSxuPWcoYS5lbmNyeXB0KGMpKSxtLHAsdD1zamNsLmJpdEFycmF5LmJpdExlbmd0aChiKS1lLHI9W107ZD1kfHxbXTtmb3IoYz0wO2MrNDx0LzMyO2MrPTQpbT1sKG4sYS5kZWNyeXB0KGwobixiLnNsaWNlKGMsYys0KSkpKSxrPWwoayxtKSxyPXIuY29uY2F0KG0pLG49ZyhuKTtwPXQtMzIqYzttPWEuZW5jcnlwdChsKG4sWzAsMCwwLHBdKSk7bT1sKG0saC5jbGFtcChiLnNsaWNlKGMpLHApLmNvbmNhdChbMCwwLDBdKSk7XG5rPWwoayxtKTtrPWEuZW5jcnlwdChsKGssbChuLGcobikpKSk7ZC5sZW5ndGgmJihrPWwoayxmP2Q6c2pjbC5tb2RlLm9jYjIucG1hYyhhLGQpKSk7aC5lcXVhbChoLmNsYW1wKGssZSksaC5iaXRTbGljZShiLHQpKXx8cShuZXcgc2pjbC5leGNlcHRpb24uY29ycnVwdChcIm9jYjogdGFnIGRvZXNuJ3QgbWF0Y2hcIikpO3JldHVybiByLmNvbmNhdChoLmNsYW1wKG0scCkpfSxwbWFjOmZ1bmN0aW9uKGEsYil7dmFyIGMsZD1zamNsLm1vZGUub2NiMi5ILGU9c2pjbC5iaXRBcnJheSxmPWUubCxnPVswLDAsMCwwXSxoPWEuZW5jcnlwdChbMCwwLDAsMF0pLGg9ZihoLGQoZChoKSkpO2ZvcihjPTA7Yys0PGIubGVuZ3RoO2MrPTQpaD1kKGgpLGc9ZihnLGEuZW5jcnlwdChmKGgsYi5zbGljZShjLGMrNCkpKSk7Yz1iLnNsaWNlKGMpOzEyOD5lLmJpdExlbmd0aChjKSYmKGg9ZihoLGQoaCkpLGM9ZS5jb25jYXQoYyxbLTIxNDc0ODM2NDgsMCwwLDBdKSk7Zz1mKGcsYyk7cmV0dXJuIGEuZW5jcnlwdChmKGQoZihoLFxuZChoKSkpLGcpKX0sSDpmdW5jdGlvbihhKXtyZXR1cm5bYVswXTw8MV5hWzFdPj4+MzEsYVsxXTw8MV5hWzJdPj4+MzEsYVsyXTw8MV5hWzNdPj4+MzEsYVszXTw8MV4xMzUqKGFbMF0+Pj4zMSldfX07XG5zamNsLm1vZGUuZ2NtPXtuYW1lOlwiZ2NtXCIsZW5jcnlwdDpmdW5jdGlvbihhLGIsYyxkLGUpe3ZhciBmPWIuc2xpY2UoMCk7Yj1zamNsLmJpdEFycmF5O2Q9ZHx8W107YT1zamNsLm1vZGUuZ2NtLnAoITAsYSxmLGQsYyxlfHwxMjgpO3JldHVybiBiLmNvbmNhdChhLmRhdGEsYS50YWcpfSxkZWNyeXB0OmZ1bmN0aW9uKGEsYixjLGQsZSl7dmFyIGY9Yi5zbGljZSgwKSxnPXNqY2wuYml0QXJyYXksaD1nLmJpdExlbmd0aChmKTtlPWV8fDEyODtkPWR8fFtdO2U8PWg/KGI9Zy5iaXRTbGljZShmLGgtZSksZj1nLmJpdFNsaWNlKGYsMCxoLWUpKTooYj1mLGY9W10pO2E9c2pjbC5tb2RlLmdjbS5wKHUsYSxmLGQsYyxlKTtnLmVxdWFsKGEudGFnLGIpfHxxKG5ldyBzamNsLmV4Y2VwdGlvbi5jb3JydXB0KFwiZ2NtOiB0YWcgZG9lc24ndCBtYXRjaFwiKSk7cmV0dXJuIGEuZGF0YX0sWjpmdW5jdGlvbihhLGIpe3ZhciBjLGQsZSxmLGcsaD1zamNsLmJpdEFycmF5Lmw7ZT1bMCwwLDAsMF07Zj1iLnNsaWNlKDApO1xuZm9yKGM9MDsxMjg+YztjKyspeyhkPTAhPT0oYVtNYXRoLmZsb29yKGMvMzIpXSYxPDwzMS1jJTMyKSkmJihlPWgoZSxmKSk7Zz0wIT09KGZbM10mMSk7Zm9yKGQ9MzswPGQ7ZC0tKWZbZF09ZltkXT4+PjF8KGZbZC0xXSYxKTw8MzE7ZlswXT4+Pj0xO2cmJihmWzBdXj0tMHgxZjAwMDAwMCl9cmV0dXJuIGV9LGc6ZnVuY3Rpb24oYSxiLGMpe3ZhciBkLGU9Yy5sZW5ndGg7Yj1iLnNsaWNlKDApO2ZvcihkPTA7ZDxlO2QrPTQpYlswXV49MHhmZmZmZmZmZiZjW2RdLGJbMV1ePTB4ZmZmZmZmZmYmY1tkKzFdLGJbMl1ePTB4ZmZmZmZmZmYmY1tkKzJdLGJbM11ePTB4ZmZmZmZmZmYmY1tkKzNdLGI9c2pjbC5tb2RlLmdjbS5aKGIsYSk7cmV0dXJuIGJ9LHA6ZnVuY3Rpb24oYSxiLGMsZCxlLGYpe3ZhciBnLGgsbCxrLG4sbSxwLHQscj1zamNsLmJpdEFycmF5O209Yy5sZW5ndGg7cD1yLmJpdExlbmd0aChjKTt0PXIuYml0TGVuZ3RoKGQpO2g9ci5iaXRMZW5ndGgoZSk7Zz1iLmVuY3J5cHQoWzAsXG4wLDAsMF0pOzk2PT09aD8oZT1lLnNsaWNlKDApLGU9ci5jb25jYXQoZSxbMV0pKTooZT1zamNsLm1vZGUuZ2NtLmcoZyxbMCwwLDAsMF0sZSksZT1zamNsLm1vZGUuZ2NtLmcoZyxlLFswLDAsTWF0aC5mbG9vcihoLzB4MTAwMDAwMDAwKSxoJjB4ZmZmZmZmZmZdKSk7aD1zamNsLm1vZGUuZ2NtLmcoZyxbMCwwLDAsMF0sZCk7bj1lLnNsaWNlKDApO2Q9aC5zbGljZSgwKTthfHwoZD1zamNsLm1vZGUuZ2NtLmcoZyxoLGMpKTtmb3Ioaz0wO2s8bTtrKz00KW5bM10rKyxsPWIuZW5jcnlwdChuKSxjW2tdXj1sWzBdLGNbaysxXV49bFsxXSxjW2srMl1ePWxbMl0sY1trKzNdXj1sWzNdO2M9ci5jbGFtcChjLHApO2EmJihkPXNqY2wubW9kZS5nY20uZyhnLGgsYykpO2E9W01hdGguZmxvb3IodC8weDEwMDAwMDAwMCksdCYweGZmZmZmZmZmLE1hdGguZmxvb3IocC8weDEwMDAwMDAwMCkscCYweGZmZmZmZmZmXTtkPXNqY2wubW9kZS5nY20uZyhnLGQsYSk7bD1iLmVuY3J5cHQoZSk7ZFswXV49bFswXTtcbmRbMV1ePWxbMV07ZFsyXV49bFsyXTtkWzNdXj1sWzNdO3JldHVybnt0YWc6ci5iaXRTbGljZShkLDAsZiksZGF0YTpjfX19O3NqY2wubWlzYy5obWFjPWZ1bmN0aW9uKGEsYil7dGhpcy5NPWI9Ynx8c2pjbC5oYXNoLnNoYTI1Njt2YXIgYz1bW10sW11dLGQsZT1iLnByb3RvdHlwZS5ibG9ja1NpemUvMzI7dGhpcy5uPVtuZXcgYixuZXcgYl07YS5sZW5ndGg+ZSYmKGE9Yi5oYXNoKGEpKTtmb3IoZD0wO2Q8ZTtkKyspY1swXVtkXT1hW2RdXjkwOTUyMjQ4NixjWzFdW2RdPWFbZF1eMTU0OTU1NjgyODt0aGlzLm5bMF0udXBkYXRlKGNbMF0pO3RoaXMublsxXS51cGRhdGUoY1sxXSk7dGhpcy5HPW5ldyBiKHRoaXMublswXSl9O1xuc2pjbC5taXNjLmhtYWMucHJvdG90eXBlLmVuY3J5cHQ9c2pjbC5taXNjLmhtYWMucHJvdG90eXBlLm1hYz1mdW5jdGlvbihhKXt0aGlzLlEmJnEobmV3IHNqY2wuZXhjZXB0aW9uLmludmFsaWQoXCJlbmNyeXB0IG9uIGFscmVhZHkgdXBkYXRlZCBobWFjIGNhbGxlZCFcIikpO3RoaXMudXBkYXRlKGEpO3JldHVybiB0aGlzLmRpZ2VzdChhKX07c2pjbC5taXNjLmhtYWMucHJvdG90eXBlLnJlc2V0PWZ1bmN0aW9uKCl7dGhpcy5HPW5ldyB0aGlzLk0odGhpcy5uWzBdKTt0aGlzLlE9dX07c2pjbC5taXNjLmhtYWMucHJvdG90eXBlLnVwZGF0ZT1mdW5jdGlvbihhKXt0aGlzLlE9ITA7dGhpcy5HLnVwZGF0ZShhKX07c2pjbC5taXNjLmhtYWMucHJvdG90eXBlLmRpZ2VzdD1mdW5jdGlvbigpe3ZhciBhPXRoaXMuRy5maW5hbGl6ZSgpLGE9KG5ldyB0aGlzLk0odGhpcy5uWzFdKSkudXBkYXRlKGEpLmZpbmFsaXplKCk7dGhpcy5yZXNldCgpO3JldHVybiBhfTtcbnNqY2wubWlzYy5wYmtkZjI9ZnVuY3Rpb24oYSxiLGMsZCxlKXtjPWN8fDFFMzsoMD5kfHwwPmMpJiZxKHNqY2wuZXhjZXB0aW9uLmludmFsaWQoXCJpbnZhbGlkIHBhcmFtcyB0byBwYmtkZjJcIikpO1wic3RyaW5nXCI9PT10eXBlb2YgYSYmKGE9c2pjbC5jb2RlYy51dGY4U3RyaW5nLnRvQml0cyhhKSk7XCJzdHJpbmdcIj09PXR5cGVvZiBiJiYoYj1zamNsLmNvZGVjLnV0ZjhTdHJpbmcudG9CaXRzKGIpKTtlPWV8fHNqY2wubWlzYy5obWFjO2E9bmV3IGUoYSk7dmFyIGYsZyxoLGwsaz1bXSxuPXNqY2wuYml0QXJyYXk7Zm9yKGw9MTszMiprLmxlbmd0aDwoZHx8MSk7bCsrKXtlPWY9YS5lbmNyeXB0KG4uY29uY2F0KGIsW2xdKSk7Zm9yKGc9MTtnPGM7ZysrKXtmPWEuZW5jcnlwdChmKTtmb3IoaD0wO2g8Zi5sZW5ndGg7aCsrKWVbaF1ePWZbaF19az1rLmNvbmNhdChlKX1kJiYoaz1uLmNsYW1wKGssZCkpO3JldHVybiBrfTtcbnNqY2wucHJuZz1mdW5jdGlvbihhKXt0aGlzLmM9W25ldyBzamNsLmhhc2guc2hhMjU2XTt0aGlzLmk9WzBdO3RoaXMuRj0wO3RoaXMucz17fTt0aGlzLkM9MDt0aGlzLks9e307dGhpcy5PPXRoaXMuZD10aGlzLmo9dGhpcy5XPTA7dGhpcy5iPVswLDAsMCwwLDAsMCwwLDBdO3RoaXMuZj1bMCwwLDAsMF07dGhpcy5BPXM7dGhpcy5CPWE7dGhpcy5xPXU7dGhpcy53PXtwcm9ncmVzczp7fSxzZWVkZWQ6e319O3RoaXMubT10aGlzLlY9MDt0aGlzLnQ9MTt0aGlzLnU9Mjt0aGlzLlM9MHgxMDAwMDt0aGlzLkk9WzAsNDgsNjQsOTYsMTI4LDE5MiwweDEwMCwzODQsNTEyLDc2OCwxMDI0XTt0aGlzLlQ9M0U0O3RoaXMuUj04MH07XG5zamNsLnBybmcucHJvdG90eXBlPXtyYW5kb21Xb3JkczpmdW5jdGlvbihhLGIpe3ZhciBjPVtdLGQ7ZD10aGlzLmlzUmVhZHkoYik7dmFyIGU7ZD09PXRoaXMubSYmcShuZXcgc2pjbC5leGNlcHRpb24ubm90UmVhZHkoXCJnZW5lcmF0b3IgaXNuJ3Qgc2VlZGVkXCIpKTtpZihkJnRoaXMudSl7ZD0hKGQmdGhpcy50KTtlPVtdO3ZhciBmPTAsZzt0aGlzLk89ZVswXT0obmV3IERhdGUpLnZhbHVlT2YoKSt0aGlzLlQ7Zm9yKGc9MDsxNj5nO2crKyllLnB1c2goMHgxMDAwMDAwMDAqTWF0aC5yYW5kb20oKXwwKTtmb3IoZz0wO2c8dGhpcy5jLmxlbmd0aCYmIShlPWUuY29uY2F0KHRoaXMuY1tnXS5maW5hbGl6ZSgpKSxmKz10aGlzLmlbZ10sdGhpcy5pW2ddPTAsIWQmJnRoaXMuRiYxPDxnKTtnKyspO3RoaXMuRj49MTw8dGhpcy5jLmxlbmd0aCYmKHRoaXMuYy5wdXNoKG5ldyBzamNsLmhhc2guc2hhMjU2KSx0aGlzLmkucHVzaCgwKSk7dGhpcy5kLT1mO2Y+dGhpcy5qJiYodGhpcy5qPWYpO3RoaXMuRisrO1xudGhpcy5iPXNqY2wuaGFzaC5zaGEyNTYuaGFzaCh0aGlzLmIuY29uY2F0KGUpKTt0aGlzLkE9bmV3IHNqY2wuY2lwaGVyLmFlcyh0aGlzLmIpO2ZvcihkPTA7ND5kJiYhKHRoaXMuZltkXT10aGlzLmZbZF0rMXwwLHRoaXMuZltkXSk7ZCsrKTt9Zm9yKGQ9MDtkPGE7ZCs9NCkwPT09KGQrMSkldGhpcy5TJiZBKHRoaXMpLGU9Qih0aGlzKSxjLnB1c2goZVswXSxlWzFdLGVbMl0sZVszXSk7QSh0aGlzKTtyZXR1cm4gYy5zbGljZSgwLGEpfSxzZXREZWZhdWx0UGFyYW5vaWE6ZnVuY3Rpb24oYSxiKXswPT09YSYmXCJTZXR0aW5nIHBhcmFub2lhPTAgd2lsbCBydWluIHlvdXIgc2VjdXJpdHk7IHVzZSBpdCBvbmx5IGZvciB0ZXN0aW5nXCIhPT1iJiZxKFwiU2V0dGluZyBwYXJhbm9pYT0wIHdpbGwgcnVpbiB5b3VyIHNlY3VyaXR5OyB1c2UgaXQgb25seSBmb3IgdGVzdGluZ1wiKTt0aGlzLkI9YX0sYWRkRW50cm9weTpmdW5jdGlvbihhLGIsYyl7Yz1jfHxcInVzZXJcIjt2YXIgZCxlLGY9KG5ldyBEYXRlKS52YWx1ZU9mKCksXG5nPXRoaXMuc1tjXSxoPXRoaXMuaXNSZWFkeSgpLGw9MDtkPXRoaXMuS1tjXTtkPT09cyYmKGQ9dGhpcy5LW2NdPXRoaXMuVysrKTtnPT09cyYmKGc9dGhpcy5zW2NdPTApO3RoaXMuc1tjXT0odGhpcy5zW2NdKzEpJXRoaXMuYy5sZW5ndGg7c3dpdGNoKHR5cGVvZiBhKXtjYXNlIFwibnVtYmVyXCI6Yj09PXMmJihiPTEpO3RoaXMuY1tnXS51cGRhdGUoW2QsdGhpcy5DKyssMSxiLGYsMSxhfDBdKTticmVhaztjYXNlIFwib2JqZWN0XCI6Yz1PYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoYSk7aWYoXCJbb2JqZWN0IFVpbnQzMkFycmF5XVwiPT09Yyl7ZT1bXTtmb3IoYz0wO2M8YS5sZW5ndGg7YysrKWUucHVzaChhW2NdKTthPWV9ZWxzZXtcIltvYmplY3QgQXJyYXldXCIhPT1jJiYobD0xKTtmb3IoYz0wO2M8YS5sZW5ndGgmJiFsO2MrKylcIm51bWJlclwiIT09dHlwZW9mIGFbY10mJihsPTEpfWlmKCFsKXtpZihiPT09cylmb3IoYz1iPTA7YzxhLmxlbmd0aDtjKyspZm9yKGU9YVtjXTswPGU7KWIrKyxcbmU+Pj49MTt0aGlzLmNbZ10udXBkYXRlKFtkLHRoaXMuQysrLDIsYixmLGEubGVuZ3RoXS5jb25jYXQoYSkpfWJyZWFrO2Nhc2UgXCJzdHJpbmdcIjpiPT09cyYmKGI9YS5sZW5ndGgpO3RoaXMuY1tnXS51cGRhdGUoW2QsdGhpcy5DKyssMyxiLGYsYS5sZW5ndGhdKTt0aGlzLmNbZ10udXBkYXRlKGEpO2JyZWFrO2RlZmF1bHQ6bD0xfWwmJnEobmV3IHNqY2wuZXhjZXB0aW9uLmJ1ZyhcInJhbmRvbTogYWRkRW50cm9weSBvbmx5IHN1cHBvcnRzIG51bWJlciwgYXJyYXkgb2YgbnVtYmVycyBvciBzdHJpbmdcIikpO3RoaXMuaVtnXSs9Yjt0aGlzLmQrPWI7aD09PXRoaXMubSYmKHRoaXMuaXNSZWFkeSgpIT09dGhpcy5tJiZDKFwic2VlZGVkXCIsTWF0aC5tYXgodGhpcy5qLHRoaXMuZCkpLEMoXCJwcm9ncmVzc1wiLHRoaXMuZ2V0UHJvZ3Jlc3MoKSkpfSxpc1JlYWR5OmZ1bmN0aW9uKGEpe2E9dGhpcy5JW2EhPT1zP2E6dGhpcy5CXTtyZXR1cm4gdGhpcy5qJiZ0aGlzLmo+PWE/dGhpcy5pWzBdPnRoaXMuUiYmXG4obmV3IERhdGUpLnZhbHVlT2YoKT50aGlzLk8/dGhpcy51fHRoaXMudDp0aGlzLnQ6dGhpcy5kPj1hP3RoaXMudXx0aGlzLm06dGhpcy5tfSxnZXRQcm9ncmVzczpmdW5jdGlvbihhKXthPXRoaXMuSVthP2E6dGhpcy5CXTtyZXR1cm4gdGhpcy5qPj1hPzE6dGhpcy5kPmE/MTp0aGlzLmQvYX0sc3RhcnRDb2xsZWN0b3JzOmZ1bmN0aW9uKCl7dGhpcy5xfHwodGhpcy5hPXtsb2FkVGltZUNvbGxlY3RvcjpEKHRoaXMsdGhpcy5hYSksbW91c2VDb2xsZWN0b3I6RCh0aGlzLHRoaXMuYmEpLGtleWJvYXJkQ29sbGVjdG9yOkQodGhpcyx0aGlzLiQpLGFjY2VsZXJvbWV0ZXJDb2xsZWN0b3I6RCh0aGlzLHRoaXMuVSksdG91Y2hDb2xsZWN0b3I6RCh0aGlzLHRoaXMuZGEpfSx3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcj8od2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJsb2FkXCIsdGhpcy5hLmxvYWRUaW1lQ29sbGVjdG9yLHUpLHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vtb3ZlXCIsdGhpcy5hLm1vdXNlQ29sbGVjdG9yLFxudSksd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlwcmVzc1wiLHRoaXMuYS5rZXlib2FyZENvbGxlY3Rvcix1KSx3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcImRldmljZW1vdGlvblwiLHRoaXMuYS5hY2NlbGVyb21ldGVyQ29sbGVjdG9yLHUpLHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwidG91Y2htb3ZlXCIsdGhpcy5hLnRvdWNoQ29sbGVjdG9yLHUpKTpkb2N1bWVudC5hdHRhY2hFdmVudD8oZG9jdW1lbnQuYXR0YWNoRXZlbnQoXCJvbmxvYWRcIix0aGlzLmEubG9hZFRpbWVDb2xsZWN0b3IpLGRvY3VtZW50LmF0dGFjaEV2ZW50KFwib25tb3VzZW1vdmVcIix0aGlzLmEubW91c2VDb2xsZWN0b3IpLGRvY3VtZW50LmF0dGFjaEV2ZW50KFwia2V5cHJlc3NcIix0aGlzLmEua2V5Ym9hcmRDb2xsZWN0b3IpKTpxKG5ldyBzamNsLmV4Y2VwdGlvbi5idWcoXCJjYW4ndCBhdHRhY2ggZXZlbnRcIikpLHRoaXMucT0hMCl9LHN0b3BDb2xsZWN0b3JzOmZ1bmN0aW9uKCl7dGhpcy5xJiYod2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXI/XG4od2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJsb2FkXCIsdGhpcy5hLmxvYWRUaW1lQ29sbGVjdG9yLHUpLHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKFwibW91c2Vtb3ZlXCIsdGhpcy5hLm1vdXNlQ29sbGVjdG9yLHUpLHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKFwia2V5cHJlc3NcIix0aGlzLmEua2V5Ym9hcmRDb2xsZWN0b3IsdSksd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJkZXZpY2Vtb3Rpb25cIix0aGlzLmEuYWNjZWxlcm9tZXRlckNvbGxlY3Rvcix1KSx3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcInRvdWNobW92ZVwiLHRoaXMuYS50b3VjaENvbGxlY3Rvcix1KSk6ZG9jdW1lbnQuZGV0YWNoRXZlbnQmJihkb2N1bWVudC5kZXRhY2hFdmVudChcIm9ubG9hZFwiLHRoaXMuYS5sb2FkVGltZUNvbGxlY3RvciksZG9jdW1lbnQuZGV0YWNoRXZlbnQoXCJvbm1vdXNlbW92ZVwiLHRoaXMuYS5tb3VzZUNvbGxlY3RvciksZG9jdW1lbnQuZGV0YWNoRXZlbnQoXCJrZXlwcmVzc1wiLFxudGhpcy5hLmtleWJvYXJkQ29sbGVjdG9yKSksdGhpcy5xPXUpfSxhZGRFdmVudExpc3RlbmVyOmZ1bmN0aW9uKGEsYil7dGhpcy53W2FdW3RoaXMuVisrXT1ifSxyZW1vdmVFdmVudExpc3RlbmVyOmZ1bmN0aW9uKGEsYil7dmFyIGMsZCxlPXRoaXMud1thXSxmPVtdO2ZvcihkIGluIGUpZS5oYXNPd25Qcm9wZXJ0eShkKSYmZVtkXT09PWImJmYucHVzaChkKTtmb3IoYz0wO2M8Zi5sZW5ndGg7YysrKWQ9ZltjXSxkZWxldGUgZVtkXX0sJDpmdW5jdGlvbigpe0UoMSl9LGJhOmZ1bmN0aW9uKGEpe3ZhciBiLGM7dHJ5e2I9YS54fHxhLmNsaWVudFh8fGEub2Zmc2V0WHx8MCxjPWEueXx8YS5jbGllbnRZfHxhLm9mZnNldFl8fDB9Y2F0Y2goZCl7Yz1iPTB9MCE9YiYmMCE9YyYmc2pjbC5yYW5kb20uYWRkRW50cm9weShbYixjXSwyLFwibW91c2VcIik7RSgwKX0sZGE6ZnVuY3Rpb24oYSl7YT1hLnRvdWNoZXNbMF18fGEuY2hhbmdlZFRvdWNoZXNbMF07c2pjbC5yYW5kb20uYWRkRW50cm9weShbYS5wYWdlWHx8XG5hLmNsaWVudFgsYS5wYWdlWXx8YS5jbGllbnRZXSwxLFwidG91Y2hcIik7RSgwKX0sYWE6ZnVuY3Rpb24oKXtFKDIpfSxVOmZ1bmN0aW9uKGEpe2E9YS5hY2NlbGVyYXRpb25JbmNsdWRpbmdHcmF2aXR5Lnh8fGEuYWNjZWxlcmF0aW9uSW5jbHVkaW5nR3Jhdml0eS55fHxhLmFjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHkuejtpZih3aW5kb3cub3JpZW50YXRpb24pe3ZhciBiPXdpbmRvdy5vcmllbnRhdGlvbjtcIm51bWJlclwiPT09dHlwZW9mIGImJnNqY2wucmFuZG9tLmFkZEVudHJvcHkoYiwxLFwiYWNjZWxlcm9tZXRlclwiKX1hJiZzamNsLnJhbmRvbS5hZGRFbnRyb3B5KGEsMixcImFjY2VsZXJvbWV0ZXJcIik7RSgwKX19O2Z1bmN0aW9uIEMoYSxiKXt2YXIgYyxkPXNqY2wucmFuZG9tLndbYV0sZT1bXTtmb3IoYyBpbiBkKWQuaGFzT3duUHJvcGVydHkoYykmJmUucHVzaChkW2NdKTtmb3IoYz0wO2M8ZS5sZW5ndGg7YysrKWVbY10oYil9XG5mdW5jdGlvbiBFKGEpe1widW5kZWZpbmVkXCIhPT10eXBlb2Ygd2luZG93JiZ3aW5kb3cucGVyZm9ybWFuY2UmJlwiZnVuY3Rpb25cIj09PXR5cGVvZiB3aW5kb3cucGVyZm9ybWFuY2Uubm93P3NqY2wucmFuZG9tLmFkZEVudHJvcHkod2luZG93LnBlcmZvcm1hbmNlLm5vdygpLGEsXCJsb2FkdGltZVwiKTpzamNsLnJhbmRvbS5hZGRFbnRyb3B5KChuZXcgRGF0ZSkudmFsdWVPZigpLGEsXCJsb2FkdGltZVwiKX1mdW5jdGlvbiBBKGEpe2EuYj1CKGEpLmNvbmNhdChCKGEpKTthLkE9bmV3IHNqY2wuY2lwaGVyLmFlcyhhLmIpfWZ1bmN0aW9uIEIoYSl7Zm9yKHZhciBiPTA7ND5iJiYhKGEuZltiXT1hLmZbYl0rMXwwLGEuZltiXSk7YisrKTtyZXR1cm4gYS5BLmVuY3J5cHQoYS5mKX1mdW5jdGlvbiBEKGEsYil7cmV0dXJuIGZ1bmN0aW9uKCl7Yi5hcHBseShhLGFyZ3VtZW50cyl9fXNqY2wucmFuZG9tPW5ldyBzamNsLnBybmcoNik7XG5hOnRyeXt2YXIgRixHLEgsSTtpZihJPVwidW5kZWZpbmVkXCIhPT10eXBlb2YgbW9kdWxlKXt2YXIgSjtpZihKPW1vZHVsZS5leHBvcnRzKXt2YXIgSzt0cnl7Sz1yZXF1aXJlKFwiY3J5cHRvXCIpfWNhdGNoKEwpe0s9bnVsbH1KPShHPUspJiZHLnJhbmRvbUJ5dGVzfUk9Sn1pZihJKUY9Ry5yYW5kb21CeXRlcygxMjgpLEY9bmV3IFVpbnQzMkFycmF5KChuZXcgVWludDhBcnJheShGKSkuYnVmZmVyKSxzamNsLnJhbmRvbS5hZGRFbnRyb3B5KEYsMTAyNCxcImNyeXB0b1sncmFuZG9tQnl0ZXMnXVwiKTtlbHNlIGlmKFwidW5kZWZpbmVkXCIhPT10eXBlb2Ygd2luZG93JiZcInVuZGVmaW5lZFwiIT09dHlwZW9mIFVpbnQzMkFycmF5KXtIPW5ldyBVaW50MzJBcnJheSgzMik7aWYod2luZG93LmNyeXB0byYmd2luZG93LmNyeXB0by5nZXRSYW5kb21WYWx1ZXMpd2luZG93LmNyeXB0by5nZXRSYW5kb21WYWx1ZXMoSCk7ZWxzZSBpZih3aW5kb3cubXNDcnlwdG8mJndpbmRvdy5tc0NyeXB0by5nZXRSYW5kb21WYWx1ZXMpd2luZG93Lm1zQ3J5cHRvLmdldFJhbmRvbVZhbHVlcyhIKTtcbmVsc2UgYnJlYWsgYTtzamNsLnJhbmRvbS5hZGRFbnRyb3B5KEgsMTAyNCxcImNyeXB0b1snZ2V0UmFuZG9tVmFsdWVzJ11cIil9fWNhdGNoKE0pe1widW5kZWZpbmVkXCIhPT10eXBlb2Ygd2luZG93JiZ3aW5kb3cuY29uc29sZSYmKGNvbnNvbGUubG9nKFwiVGhlcmUgd2FzIGFuIGVycm9yIGNvbGxlY3RpbmcgZW50cm9weSBmcm9tIHRoZSBicm93c2VyOlwiKSxjb25zb2xlLmxvZyhNKSl9XG5zamNsLmpzb249e2RlZmF1bHRzOnt2OjEsaXRlcjoxRTMsa3M6MTI4LHRzOjY0LG1vZGU6XCJjY21cIixhZGF0YTpcIlwiLGNpcGhlcjpcImFlc1wifSxZOmZ1bmN0aW9uKGEsYixjLGQpe2M9Y3x8e307ZD1kfHx7fTt2YXIgZT1zamNsLmpzb24sZj1lLmUoe2l2OnNqY2wucmFuZG9tLnJhbmRvbVdvcmRzKDQsMCl9LGUuZGVmYXVsdHMpLGc7ZS5lKGYsYyk7Yz1mLmFkYXRhO1wic3RyaW5nXCI9PT10eXBlb2YgZi5zYWx0JiYoZi5zYWx0PXNqY2wuY29kZWMuYmFzZTY0LnRvQml0cyhmLnNhbHQpKTtcInN0cmluZ1wiPT09dHlwZW9mIGYuaXYmJihmLml2PXNqY2wuY29kZWMuYmFzZTY0LnRvQml0cyhmLml2KSk7KCFzamNsLm1vZGVbZi5tb2RlXXx8IXNqY2wuY2lwaGVyW2YuY2lwaGVyXXx8XCJzdHJpbmdcIj09PXR5cGVvZiBhJiYxMDA+PWYuaXRlcnx8NjQhPT1mLnRzJiY5NiE9PWYudHMmJjEyOCE9PWYudHN8fDEyOCE9PWYua3MmJjE5MiE9PWYua3MmJjB4MTAwIT09Zi5rc3x8Mj5mLml2Lmxlbmd0aHx8NDxcbmYuaXYubGVuZ3RoKSYmcShuZXcgc2pjbC5leGNlcHRpb24uaW52YWxpZChcImpzb24gZW5jcnlwdDogaW52YWxpZCBwYXJhbWV0ZXJzXCIpKTtcInN0cmluZ1wiPT09dHlwZW9mIGE/KGc9c2pjbC5taXNjLmNhY2hlZFBia2RmMihhLGYpLGE9Zy5rZXkuc2xpY2UoMCxmLmtzLzMyKSxmLnNhbHQ9Zy5zYWx0KTpzamNsLmVjYyYmYSBpbnN0YW5jZW9mIHNqY2wuZWNjLmVsR2FtYWwucHVibGljS2V5JiYoZz1hLmtlbSgpLGYua2VtdGFnPWcudGFnLGE9Zy5rZXkuc2xpY2UoMCxmLmtzLzMyKSk7XCJzdHJpbmdcIj09PXR5cGVvZiBiJiYoYj1zamNsLmNvZGVjLnV0ZjhTdHJpbmcudG9CaXRzKGIpKTtcInN0cmluZ1wiPT09dHlwZW9mIGMmJihmLmFkYXRhPWM9c2pjbC5jb2RlYy51dGY4U3RyaW5nLnRvQml0cyhjKSk7Zz1uZXcgc2pjbC5jaXBoZXJbZi5jaXBoZXJdKGEpO2UuZShkLGYpO2Qua2V5PWE7Zi5jdD1zamNsLm1vZGVbZi5tb2RlXS5lbmNyeXB0KGcsYixmLml2LGMsZi50cyk7cmV0dXJuIGZ9LFxuZW5jcnlwdDpmdW5jdGlvbihhLGIsYyxkKXt2YXIgZT1zamNsLmpzb24sZj1lLlkuYXBwbHkoZSxhcmd1bWVudHMpO3JldHVybiBlLmVuY29kZShmKX0sWDpmdW5jdGlvbihhLGIsYyxkKXtjPWN8fHt9O2Q9ZHx8e307dmFyIGU9c2pjbC5qc29uO2I9ZS5lKGUuZShlLmUoe30sZS5kZWZhdWx0cyksYiksYywhMCk7dmFyIGYsZztmPWIuYWRhdGE7XCJzdHJpbmdcIj09PXR5cGVvZiBiLnNhbHQmJihiLnNhbHQ9c2pjbC5jb2RlYy5iYXNlNjQudG9CaXRzKGIuc2FsdCkpO1wic3RyaW5nXCI9PT10eXBlb2YgYi5pdiYmKGIuaXY9c2pjbC5jb2RlYy5iYXNlNjQudG9CaXRzKGIuaXYpKTsoIXNqY2wubW9kZVtiLm1vZGVdfHwhc2pjbC5jaXBoZXJbYi5jaXBoZXJdfHxcInN0cmluZ1wiPT09dHlwZW9mIGEmJjEwMD49Yi5pdGVyfHw2NCE9PWIudHMmJjk2IT09Yi50cyYmMTI4IT09Yi50c3x8MTI4IT09Yi5rcyYmMTkyIT09Yi5rcyYmMHgxMDAhPT1iLmtzfHwhYi5pdnx8Mj5iLml2Lmxlbmd0aHx8NDxiLml2Lmxlbmd0aCkmJlxucShuZXcgc2pjbC5leGNlcHRpb24uaW52YWxpZChcImpzb24gZGVjcnlwdDogaW52YWxpZCBwYXJhbWV0ZXJzXCIpKTtcInN0cmluZ1wiPT09dHlwZW9mIGE/KGc9c2pjbC5taXNjLmNhY2hlZFBia2RmMihhLGIpLGE9Zy5rZXkuc2xpY2UoMCxiLmtzLzMyKSxiLnNhbHQ9Zy5zYWx0KTpzamNsLmVjYyYmYSBpbnN0YW5jZW9mIHNqY2wuZWNjLmVsR2FtYWwuc2VjcmV0S2V5JiYoYT1hLnVua2VtKHNqY2wuY29kZWMuYmFzZTY0LnRvQml0cyhiLmtlbXRhZykpLnNsaWNlKDAsYi5rcy8zMikpO1wic3RyaW5nXCI9PT10eXBlb2YgZiYmKGY9c2pjbC5jb2RlYy51dGY4U3RyaW5nLnRvQml0cyhmKSk7Zz1uZXcgc2pjbC5jaXBoZXJbYi5jaXBoZXJdKGEpO2Y9c2pjbC5tb2RlW2IubW9kZV0uZGVjcnlwdChnLGIuY3QsYi5pdixmLGIudHMpO2UuZShkLGIpO2Qua2V5PWE7cmV0dXJuIDE9PT1jLnJhdz9mOnNqY2wuY29kZWMudXRmOFN0cmluZy5mcm9tQml0cyhmKX0sZGVjcnlwdDpmdW5jdGlvbihhLGIsXG5jLGQpe3ZhciBlPXNqY2wuanNvbjtyZXR1cm4gZS5YKGEsZS5kZWNvZGUoYiksYyxkKX0sZW5jb2RlOmZ1bmN0aW9uKGEpe3ZhciBiLGM9XCJ7XCIsZD1cIlwiO2ZvcihiIGluIGEpaWYoYS5oYXNPd25Qcm9wZXJ0eShiKSlzd2l0Y2goYi5tYXRjaCgvXlthLXowLTldKyQvaSl8fHEobmV3IHNqY2wuZXhjZXB0aW9uLmludmFsaWQoXCJqc29uIGVuY29kZTogaW52YWxpZCBwcm9wZXJ0eSBuYW1lXCIpKSxjKz1kKydcIicrYisnXCI6JyxkPVwiLFwiLHR5cGVvZiBhW2JdKXtjYXNlIFwibnVtYmVyXCI6Y2FzZSBcImJvb2xlYW5cIjpjKz1hW2JdO2JyZWFrO2Nhc2UgXCJzdHJpbmdcIjpjKz0nXCInK2VzY2FwZShhW2JdKSsnXCInO2JyZWFrO2Nhc2UgXCJvYmplY3RcIjpjKz0nXCInK3NqY2wuY29kZWMuYmFzZTY0LmZyb21CaXRzKGFbYl0sMCkrJ1wiJzticmVhaztkZWZhdWx0OnEobmV3IHNqY2wuZXhjZXB0aW9uLmJ1ZyhcImpzb24gZW5jb2RlOiB1bnN1cHBvcnRlZCB0eXBlXCIpKX1yZXR1cm4gYytcIn1cIn0sZGVjb2RlOmZ1bmN0aW9uKGEpe2E9XG5hLnJlcGxhY2UoL1xccy9nLFwiXCIpO2EubWF0Y2goL15cXHsuKlxcfSQvKXx8cShuZXcgc2pjbC5leGNlcHRpb24uaW52YWxpZChcImpzb24gZGVjb2RlOiB0aGlzIGlzbid0IGpzb24hXCIpKTthPWEucmVwbGFjZSgvXlxce3xcXH0kL2csXCJcIikuc3BsaXQoLywvKTt2YXIgYj17fSxjLGQ7Zm9yKGM9MDtjPGEubGVuZ3RoO2MrKykoZD1hW2NdLm1hdGNoKC9eXFxzKig/OihbXCInXT8pKFthLXpdW2EtejAtOV0qKVxcMSlcXHMqOlxccyooPzooLT9cXGQrKXxcIihbYS16MC05K1xcLyUqXy5APVxcLV0qKVwifCh0cnVlfGZhbHNlKSkkL2kpKXx8cShuZXcgc2pjbC5leGNlcHRpb24uaW52YWxpZChcImpzb24gZGVjb2RlOiB0aGlzIGlzbid0IGpzb24hXCIpKSxkWzNdP2JbZFsyXV09cGFyc2VJbnQoZFszXSwxMCk6ZFs0XT9iW2RbMl1dPWRbMl0ubWF0Y2goL14oY3R8YWRhdGF8c2FsdHxpdikkLyk/c2pjbC5jb2RlYy5iYXNlNjQudG9CaXRzKGRbNF0pOnVuZXNjYXBlKGRbNF0pOmRbNV0mJihiW2RbMl1dPVwidHJ1ZVwiPT09XG5kWzVdKTtyZXR1cm4gYn0sZTpmdW5jdGlvbihhLGIsYyl7YT09PXMmJihhPXt9KTtpZihiPT09cylyZXR1cm4gYTtmb3IodmFyIGQgaW4gYiliLmhhc093blByb3BlcnR5KGQpJiYoYyYmKGFbZF0hPT1zJiZhW2RdIT09YltkXSkmJnEobmV3IHNqY2wuZXhjZXB0aW9uLmludmFsaWQoXCJyZXF1aXJlZCBwYXJhbWV0ZXIgb3ZlcnJpZGRlblwiKSksYVtkXT1iW2RdKTtyZXR1cm4gYX0sZmE6ZnVuY3Rpb24oYSxiKXt2YXIgYz17fSxkO2ZvcihkIGluIGEpYS5oYXNPd25Qcm9wZXJ0eShkKSYmYVtkXSE9PWJbZF0mJihjW2RdPWFbZF0pO3JldHVybiBjfSxlYTpmdW5jdGlvbihhLGIpe3ZhciBjPXt9LGQ7Zm9yKGQ9MDtkPGIubGVuZ3RoO2QrKylhW2JbZF1dIT09cyYmKGNbYltkXV09YVtiW2RdXSk7cmV0dXJuIGN9fTtzamNsLmVuY3J5cHQ9c2pjbC5qc29uLmVuY3J5cHQ7c2pjbC5kZWNyeXB0PXNqY2wuanNvbi5kZWNyeXB0O3NqY2wubWlzYy5jYT17fTtcbnNqY2wubWlzYy5jYWNoZWRQYmtkZjI9ZnVuY3Rpb24oYSxiKXt2YXIgYz1zamNsLm1pc2MuY2EsZDtiPWJ8fHt9O2Q9Yi5pdGVyfHwxRTM7Yz1jW2FdPWNbYV18fHt9O2Q9Y1tkXT1jW2RdfHx7Zmlyc3RTYWx0OmIuc2FsdCYmYi5zYWx0Lmxlbmd0aD9iLnNhbHQuc2xpY2UoMCk6c2pjbC5yYW5kb20ucmFuZG9tV29yZHMoMiwwKX07Yz1iLnNhbHQ9PT1zP2QuZmlyc3RTYWx0OmIuc2FsdDtkW2NdPWRbY118fHNqY2wubWlzYy5wYmtkZjIoYSxjLGIuaXRlcik7cmV0dXJue2tleTpkW2NdLnNsaWNlKDApLHNhbHQ6Yy5zbGljZSgwKX19O1xuIl19

(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var React = require('react/addons');
var Router = require('react-router');
var confirmAuthorized = require('../utilities/confirmAuthorized')

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
		confirmAuthorizedAndGetDocs(this.props.db, function(err, results) {
			if (err) {
				this.setState({backingUp: false})
				console.log(err);
				return;
			}
			var json = JSON.stringify(results);
			var pause = 2
			uploadBackupToDrive(json, function() {
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
	render: function() {
		var backupText = this.state.backingUp ? 'Backing up' : 'Backup to drive'
		var restoreText = this.state.restoring ? 'Restoring' : 'Restore from drive (experimental)'
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


	var dateString = 'backup-' + new Date().getTime() + '.json'

	var metadata = {
		'title': dateString,
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
	request.execute(function(response) {
		callback()
	});


}

function confirmAuthorizedAndGetDocs(db, callback) {
	confirmAuthorized(function() {
		// load documents
		db.allDocs({
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
	})
}


},{"../utilities/confirmAuthorized":10,"react-router":"TIQRyI","react/addons":"oWaOtE"}],2:[function(require,module,exports){
var React = require('react/addons');
var Router = require('react-router');

var Route = Router.Route;
var Link = Router.Link;
var DefaultRoute = Router.DefaultRoute;
var NotFoundRoute = Router.NotFoundRoute;

var RootRouteHandler = require('./routes/RootRouteHandler')
var NotFoundRouteHandler = require('./routes/NotFoundRouteHandler');


var SettingsRouteHandler = require('./routes/SettingsRouteHandler');
var EditorRouteHandler = require('./routes/EditorRouteHandler');
var IndexRouteHandler = require('./routes/IndexRouteHandler');
var restoreRouteHandler = require('./routes/restoreRouteHandler');
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

document.addEventListener('deviceReady', function() {
	Router.run(routes, function(Handler) {
		React.render(React.createElement(Handler, null), document.getElementById('root_journey'));
	});
}, false)




},{"./routes/EditorRouteHandler":3,"./routes/IndexRouteHandler":4,"./routes/NotFoundRouteHandler":5,"./routes/RootRouteHandler":6,"./routes/SettingsRouteHandler":7,"./routes/restoreRouteHandler":9,"react-router":"TIQRyI","react/addons":"oWaOtE"}],3:[function(require,module,exports){
var React = require('react/addons');
var Router = require('react-router');
var RouteHandler = Router.RouteHandler;
var alertify = window['alertify'] = require('alertifyjs')

var dates = require('../utilities/dates')
var decrypt = require('../utilities/decryptEntry')
var encrypt = require('../utilities/encryptEntry')
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
				tags: entry.tags ? entry.tags : []
			});

		}.bind(this)).catch(function(err) {
			if (err.status === 404) {
			}
			else {
				console.log(err);
			}
		})

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
			tags: this.state.tags
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

				React.createElement("textarea", {autoFocus: "true", onChange: this.changed, ref: "editor", className: "content journey_editor", value: this.state.content}
				), 
				React.createElement("div", {className: "journey_toolbar entry_tags", onClick: this.focusTagsInput}, 
					React.createElement("i", {className: "fa fa-tags"}), " ", 
					React.createElement("div", {className: "entry_tags_container"}, 
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


},{"../utilities/dates":11,"../utilities/decryptEntry":12,"../utilities/encryptEntry":13,"alertifyjs":"WhmgK1","react-router":"TIQRyI","react/addons":"oWaOtE"}],4:[function(require,module,exports){
var React = require('react/addons');
var Router = require('react-router');
var RouteHandler = Router.RouteHandler;
var decrypt = require('../utilities/decryptEntry')

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
				}.bind(this));
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


},{"../utilities/decryptEntry":12,"react-router":"TIQRyI","react/addons":"oWaOtE"}],5:[function(require,module,exports){
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


},{"react-router":"TIQRyI","react/addons":"oWaOtE"}],6:[function(require,module,exports){
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
					wrongAttempts: 0
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

		if (!this.state.key) {
			handler = React.createElement(Authenticate, {onAuthenticated: this.setKey, wrongAttempts: this.state.wrongAttempts, verifyKey: this.state.verifyKey, clearDatabaseAndDeauthenticate: this.clearDatabaseAndDeauthenticate})
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



},{"./authenticate":8,"alertifyjs":"WhmgK1","pouchdb":"kjoiFI","react-router":"TIQRyI","react/addons":"oWaOtE","sjcl":23}],7:[function(require,module,exports){
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


},{"../components/gapi":1,"../utilities/decryptEntry":12,"alertifyjs":"WhmgK1","react-router":"TIQRyI","react/addons":"oWaOtE"}],8:[function(require,module,exports){
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
		this.props.clearDatabaseAndDeauthenticate()
		alertify.error('Journal reset!', 1)
	},
	render: function() {
		var placeholder = (this.props.verifyKey) ? 'verify password' : 'enter a password' 

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


},{"react-router":"TIQRyI","react/addons":"oWaOtE"}],9:[function(require,module,exports){
var React = require('react/addons');
var Router = require('react-router');
var RouteHandler = Router.RouteHandler;
var confirmAuthorized = require('../utilities/confirmAuthorized')
var alertify = require('alertifyjs')

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
			request.execute(function(resp) {
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
			});
		}

		confirmAuthorized(function() {
			var initialRequest = gapi.client.drive.files.list({
				'q': '\'appfolder\' in parents'
			});
			retrievePageOfFiles(initialRequest, []);
		});
	},
	restoreFromFile: function(file) {
		getFile(file, function(data) {
			var journal = JSON.parse(data).map(function(doc){
				delete doc._rev
				return doc
			})
			this.props.clearDatabaseAndDeauthenticate(journal);
		}.bind(this))
	},
	deleteFile: function(file) {
		var message = "Are you sure?\nThis cannot be undone!"
		alertify.confirm(message).set('title', 'Delete Journal').set('labels', {ok:'Yes', cancel:'No'}).set('onok', function(){
			file.deleting = true;
			this.setState({files: this.state.files})
			confirmAuthorized(function() {
				gapi.client.drive.files.delete({fileId:file.id}).execute(function() {
					var files = this.state.files.filter(function(f) {
						return f.id !== file.id					   
					})
					this.setState({files: files})
				}.bind(this))
			}.bind(this));
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


},{"../utilities/confirmAuthorized":10,"alertifyjs":"WhmgK1","react-router":"TIQRyI","react/addons":"oWaOtE"}],10:[function(require,module,exports){
var info = {
	client_id: '256745719204-avgd75431oti4orl29t52mjqr93bu3d5.apps.googleusercontent.com',
	scope: 'https://www.googleapis.com/auth/drive.appfolder'
}
var gapiConfig = {
	auth_uri: 'https://accounts.google.com/o/oauth2/auth',
	token_uri: 'https://accounts.google.com/o/oauth2/token',
	redirect_uri: 'http://deslee.me:8000/code'
};

var loginWindow;

function openLogin(callback) {
	var login_url = gapiConfig.auth_uri
	+ '?client_id=' + info.client_id
	+ '&redirect_uri=' + gapiConfig.redirect_uri
	+ '&response_type=code'
	+ '&scope=' + info.scope;

	loginWindow = window.open(login_url, '_blank', 'location=yes');
	loginWindow.addEventListener('loadstop', function(e) {
		console.log(e);
		var url = e.url
		var code = /\?code=(.+)$/.exec(url);
		var error = /\?error=(.+)$/.exec(url);
		console.log(code, error)

		if (code) {
			loginWindow.executeScript({code: "document.body.innerHTML"}, function(values){
				var token = JSON.parse(values[0])
				localStorage.setItem('token', token)
				loginWindow.close()
				gapi.auth.setToken(token)
				callback()
			})
		}
		if (error) {
			// handle error TODO
			loginWindow.close();
		}

	}, false)
}


function confirmAuthorized(callback) {

	if (device.platform === "browser") {
		var handle_authorization_result = function(authResult) {
			if (authResult && !authResult.error) {
				gapi.client.load('drive', 'v2', function() {
					callback()
				})
			}
			else {
				info.immediate = false;
				gapi.auth.authorize(info, handle_authorization_result);
			}
		}

		gapi.load('client', function() {
			info.immediate = true
			gapi.auth.authorize(info, handle_authorization_result);
		}.bind(this));
	}
	else {
		if (!localStorage.getItem('token')) {
			gapi.load('auth', function() {
				gapi.load('client', function() {
					gapi.client.load('drive', 'v2', function() {
						openLogin(callback);
					})
				});
			});
		}
		else {
			gapi.load('client', function() {
				gapi.client.load('drive', 'v2', function() {
					callback();
				})
			});
		}
	}
}

module.exports = confirmAuthorized



},{}],11:[function(require,module,exports){
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


},{}],12:[function(require,module,exports){
var sjcl = require('sjcl')

module.exports = function(key, entry) {
	entry.content = sjcl.decrypt(key, entry.content)
	entry.title = entry.content.split('\n')[0]
	entry.tags = sjcl.decrypt(key, entry.tags).split(',').filter(function(tag) {
		return tag !== ''
	})
	return entry;
}


},{"sjcl":23}],13:[function(require,module,exports){
var sjcl = require('sjcl')

module.exports = function(key, entry) {
	entry.content = sjcl.encrypt(key, entry.content)
	entry.tags = sjcl.encrypt(key, entry.tags.join(','))
	return entry;
}


},{"sjcl":23}],14:[function(require,module,exports){
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


},{"base64-js":15,"ieee754":16}],15:[function(require,module,exports){
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


},{}],16:[function(require,module,exports){
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


},{}],17:[function(require,module,exports){
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


},{"buffer":14}],18:[function(require,module,exports){
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


},{"./md5":19,"./rng":20,"./sha":21,"./sha256":22,"buffer":14}],19:[function(require,module,exports){
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


},{"./helpers":17}],20:[function(require,module,exports){
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


},{}],21:[function(require,module,exports){
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


},{"./helpers":17}],22:[function(require,module,exports){

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


},{"./helpers":17}],23:[function(require,module,exports){
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


},{"crypto":18}]},{},[2])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkM6XFxVc2Vyc1xcZGVzbW9uZFxcUHJvamVjdHNcXEpvdXJuZXlKb3VybmFsXFxub2RlX21vZHVsZXNcXGd1bHAtYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyaWZ5XFxub2RlX21vZHVsZXNcXGJyb3dzZXItcGFja1xcX3ByZWx1ZGUuanMiLCJDOlxcVXNlcnNcXGRlc21vbmRcXFByb2plY3RzXFxKb3VybmV5Sm91cm5hbFxcYXBwXFxjb21wb25lbnRzXFxnYXBpLmpzIiwiQzpcXFVzZXJzXFxkZXNtb25kXFxQcm9qZWN0c1xcSm91cm5leUpvdXJuYWxcXGFwcFxcbWFpbi5qcyIsIkM6XFxVc2Vyc1xcZGVzbW9uZFxcUHJvamVjdHNcXEpvdXJuZXlKb3VybmFsXFxhcHBcXHJvdXRlc1xcRWRpdG9yUm91dGVIYW5kbGVyLmpzIiwiQzpcXFVzZXJzXFxkZXNtb25kXFxQcm9qZWN0c1xcSm91cm5leUpvdXJuYWxcXGFwcFxccm91dGVzXFxJbmRleFJvdXRlSGFuZGxlci5qcyIsIkM6XFxVc2Vyc1xcZGVzbW9uZFxcUHJvamVjdHNcXEpvdXJuZXlKb3VybmFsXFxhcHBcXHJvdXRlc1xcTm90Rm91bmRSb3V0ZUhhbmRsZXIuanMiLCJDOlxcVXNlcnNcXGRlc21vbmRcXFByb2plY3RzXFxKb3VybmV5Sm91cm5hbFxcYXBwXFxyb3V0ZXNcXFJvb3RSb3V0ZUhhbmRsZXIuanMiLCJDOlxcVXNlcnNcXGRlc21vbmRcXFByb2plY3RzXFxKb3VybmV5Sm91cm5hbFxcYXBwXFxyb3V0ZXNcXFNldHRpbmdzUm91dGVIYW5kbGVyLmpzIiwiQzpcXFVzZXJzXFxkZXNtb25kXFxQcm9qZWN0c1xcSm91cm5leUpvdXJuYWxcXGFwcFxccm91dGVzXFxhdXRoZW50aWNhdGUuanMiLCJDOlxcVXNlcnNcXGRlc21vbmRcXFByb2plY3RzXFxKb3VybmV5Sm91cm5hbFxcYXBwXFxyb3V0ZXNcXHJlc3RvcmVSb3V0ZUhhbmRsZXIuanMiLCJDOlxcVXNlcnNcXGRlc21vbmRcXFByb2plY3RzXFxKb3VybmV5Sm91cm5hbFxcYXBwXFx1dGlsaXRpZXNcXGNvbmZpcm1BdXRob3JpemVkLmpzIiwiQzpcXFVzZXJzXFxkZXNtb25kXFxQcm9qZWN0c1xcSm91cm5leUpvdXJuYWxcXGFwcFxcdXRpbGl0aWVzXFxkYXRlcy5qcyIsIkM6XFxVc2Vyc1xcZGVzbW9uZFxcUHJvamVjdHNcXEpvdXJuZXlKb3VybmFsXFxhcHBcXHV0aWxpdGllc1xcZGVjcnlwdEVudHJ5LmpzIiwiQzpcXFVzZXJzXFxkZXNtb25kXFxQcm9qZWN0c1xcSm91cm5leUpvdXJuYWxcXGFwcFxcdXRpbGl0aWVzXFxlbmNyeXB0RW50cnkuanMiLCJDOlxcVXNlcnNcXGRlc21vbmRcXFByb2plY3RzXFxKb3VybmV5Sm91cm5hbFxcbm9kZV9tb2R1bGVzXFxndWxwLWJyb3dzZXJpZnlcXG5vZGVfbW9kdWxlc1xcYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxidWZmZXJcXGluZGV4LmpzIiwiQzpcXFVzZXJzXFxkZXNtb25kXFxQcm9qZWN0c1xcSm91cm5leUpvdXJuYWxcXG5vZGVfbW9kdWxlc1xcZ3VscC1icm93c2VyaWZ5XFxub2RlX21vZHVsZXNcXGJyb3dzZXJpZnlcXG5vZGVfbW9kdWxlc1xcYnVmZmVyXFxub2RlX21vZHVsZXNcXGJhc2U2NC1qc1xcbGliXFxiNjQuanMiLCJDOlxcVXNlcnNcXGRlc21vbmRcXFByb2plY3RzXFxKb3VybmV5Sm91cm5hbFxcbm9kZV9tb2R1bGVzXFxndWxwLWJyb3dzZXJpZnlcXG5vZGVfbW9kdWxlc1xcYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxidWZmZXJcXG5vZGVfbW9kdWxlc1xcaWVlZTc1NFxcaW5kZXguanMiLCJDOlxcVXNlcnNcXGRlc21vbmRcXFByb2plY3RzXFxKb3VybmV5Sm91cm5hbFxcbm9kZV9tb2R1bGVzXFxndWxwLWJyb3dzZXJpZnlcXG5vZGVfbW9kdWxlc1xcYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxjcnlwdG8tYnJvd3NlcmlmeVxcaGVscGVycy5qcyIsIkM6XFxVc2Vyc1xcZGVzbW9uZFxcUHJvamVjdHNcXEpvdXJuZXlKb3VybmFsXFxub2RlX21vZHVsZXNcXGd1bHAtYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyaWZ5XFxub2RlX21vZHVsZXNcXGNyeXB0by1icm93c2VyaWZ5XFxpbmRleC5qcyIsIkM6XFxVc2Vyc1xcZGVzbW9uZFxcUHJvamVjdHNcXEpvdXJuZXlKb3VybmFsXFxub2RlX21vZHVsZXNcXGd1bHAtYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyaWZ5XFxub2RlX21vZHVsZXNcXGNyeXB0by1icm93c2VyaWZ5XFxtZDUuanMiLCJDOlxcVXNlcnNcXGRlc21vbmRcXFByb2plY3RzXFxKb3VybmV5Sm91cm5hbFxcbm9kZV9tb2R1bGVzXFxndWxwLWJyb3dzZXJpZnlcXG5vZGVfbW9kdWxlc1xcYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxjcnlwdG8tYnJvd3NlcmlmeVxccm5nLmpzIiwiQzpcXFVzZXJzXFxkZXNtb25kXFxQcm9qZWN0c1xcSm91cm5leUpvdXJuYWxcXG5vZGVfbW9kdWxlc1xcZ3VscC1icm93c2VyaWZ5XFxub2RlX21vZHVsZXNcXGJyb3dzZXJpZnlcXG5vZGVfbW9kdWxlc1xcY3J5cHRvLWJyb3dzZXJpZnlcXHNoYS5qcyIsIkM6XFxVc2Vyc1xcZGVzbW9uZFxcUHJvamVjdHNcXEpvdXJuZXlKb3VybmFsXFxub2RlX21vZHVsZXNcXGd1bHAtYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyaWZ5XFxub2RlX21vZHVsZXNcXGNyeXB0by1icm93c2VyaWZ5XFxzaGEyNTYuanMiLCJDOlxcVXNlcnNcXGRlc21vbmRcXFByb2plY3RzXFxKb3VybmV5Sm91cm5hbFxcbm9kZV9tb2R1bGVzXFxzamNsXFxzamNsLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUEsSUFBSSxLQUFLLEdBQUcsT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDO0FBQ3BDLElBQUksTUFB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TUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsTUFBTSxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUM7QUFDNUcsR0FBRztBQUNIOztFQUVFLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxNQUFNLEdBQUcsS0FBSyxDQUFDLE1BQU0sR0FBRyxVQUFVLEVBQUUsQ0FBQyxHQUFHLE1BQU0sRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFO0dBQ25FLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLEtBQUssS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0dBQzlELE1BQU0sSUFBSSxlQUFlLENBQUMsSUFBSSxDQUFDO0FBQ2xDLEdBQUc7QUFDSDs7RUFFRSxRQUFRLFVBQVU7R0FDakIsS0FBSyxDQUFDO0lBQ0wsSUFBSSxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztJQUM5QixNQUFNLElBQUksTUFBTSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUM7SUFDM0IsTUFBTSxJQUFJLE1BQU0sQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDO0lBQ3BDLE1BQU0sSUFBSSxJQUFJO0lBQ2QsS0FBSztHQUNOLEtBQUssQ0FBQztJQUNMLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztJQUNqRSxNQUFNLElBQUksTUFBTSxDQUFDLElBQUksSUFBSSxFQUFFLENBQUM7SUFDNUIsTUFBTSxJQUFJLE1BQU0sQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDO0lBQ3BDLE1BQU0sSUFBSSxNQUFNLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQztJQUNwQyxNQUFNLElBQUksR0FBRztJQUNiLEtBQUs7QUFDVCxHQUFHOztFQUVELE9BQU8sTUFBTTtBQUNmLEVBQUU7O0NBRUQsT0FBTyxDQUFDLFdBQVcsR0FBRyxjQUFjO0NBQ3BDLE9BQU8sQ0FBQyxhQUFhLEdBQUcsYUFBYTtDQUNyQyxDQUFDLE9BQU8sT0FBTyxLQUFLLFdBQVcsSUFBSSxJQUFJLENBQUMsUUFBUSxHQUFHLEVBQUUsSUFBSSxPQUFPLENBQUMsQ0FBQzs7OztBQzNIbkUsT0FBTyxDQUFDLElBQUksR0FBRyxTQUFTLE1BQU0sRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUU7RUFDMUQsSUFBSSxDQUFDLEVBQUUsQ0FBQztNQUNKLElBQUksR0FBRyxNQUFNLEdBQUcsQ0FBQyxHQUFHLElBQUksR0FBRyxDQUFDO01BQzVCLElBQUksR0FBRyxDQUFDLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQztNQUN0QixLQUFLLEdBQUcsSUFBSSxJQUFJLENBQUM7TUFDakIsS0FBSyxHQUFHLENBQUMsQ0FBQztNQUNWLENBQUMsR0FBRyxJQUFJLElBQUksTUFBTSxHQUFHLENBQUMsSUFBSSxDQUFDO01BQzNCLENBQUMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQztBQUN2QixNQUFNLENBQUMsR0FBRyxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDOztBQUU3QixFQUFFLENBQUMsSUFBSSxDQUFDLENBQUM7O0VBRVAsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0VBQzlCLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0VBQ2YsS0FBSyxJQUFJLElBQUksQ0FBQztBQUNoQixFQUFFLE9BQU8sS0FBSyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEdBQUcsR0FBRyxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDOztFQUV4RSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7RUFDOUIsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7RUFDZixLQUFLLElBQUksSUFBSSxDQUFDO0FBQ2hCLEVBQUUsT0FBTyxLQUFLLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLEdBQUcsR0FBRyxHQUFHLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUM7O0VBRXhFLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRTtJQUNYLENBQUMsR0FBRyxDQUFDLEdBQUcsS0FBSyxDQUFDO0dBQ2YsTUFBTSxJQUFJLENBQUMsS0FBSyxJQUFJLEVBQUU7SUFDckIsT0FBTyxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxRQUFRLENBQUMsQ0FBQztHQUM1QyxNQUFNO0lBQ0wsQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUMxQixDQUFDLEdBQUcsQ0FBQyxHQUFHLEtBQUssQ0FBQztHQUNmO0VBQ0QsT0FBTyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQztBQUNsRCxDQUFDLENBQUM7O0FBRUYsT0FBTyxDQUFDLEtBQUssR0FBRyxTQUFTLE1BQU0sRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFO0VBQ2xFLElBQUksQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDO01BQ1AsSUFBSSxHQUFHLE1BQU0sR0FBRyxDQUFDLEdBQUcsSUFBSSxHQUFHLENBQUM7TUFDNUIsSUFBSSxHQUFHLENBQUMsQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDO01BQ3RCLEtBQUssR0FBRyxJQUFJLElBQUksQ0FBQztNQUNqQixFQUFFLElBQUksSUFBSSxLQUFLLEVBQUUsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDO01BQzVELENBQUMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLE1BQU0sR0FBRyxDQUFDLENBQUM7TUFDM0IsQ0FBQyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3ZCLE1BQU0sQ0FBQyxHQUFHLEtBQUssR0FBRyxDQUFDLEtBQUssS0FBSyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsS0FBSyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7O0FBRTlELEVBQUUsS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7O0VBRXhCLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLEtBQUssS0FBSyxRQUFRLEVBQUU7SUFDdEMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3pCLENBQUMsR0FBRyxJQUFJLENBQUM7R0FDVixNQUFNO0lBQ0wsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDM0MsSUFBSSxLQUFLLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxD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QUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDakQsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUNoRCxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUUsR0FBRyxVQUFVLENBQUMsQ0FBQztJQUNqRCxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQ2pELENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDL0MsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksVUFBVSxDQUFDLENBQUM7SUFDakQsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUNqRCxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQzVDLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDakQsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksVUFBVSxDQUFDLENBQUM7SUFDakQsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUMvQyxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBQ3JELElBQUksQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLEdBQUcsVUFBVSxDQUFDLENBQUM7O0lBRWpELENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDaEQsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUNqRCxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsR0FBRyxTQUFTLENBQUMsQ0FBQztJQUNoRCxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ2hELENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDaEQsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksUUFBUSxDQUFDLENBQUM7SUFDL0MsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUNoRCxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ2hELENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxDQUFDO0lBQ2hELENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDakQsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUNoRCxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUUsR0FBRyxVQUFVLENBQUMsQ0FBQztJQUNqRCxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQ2pELENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDL0MsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFLEdBQUcsVUFBVSxDQUFDLENBQUM7QUFDckQsSUFBSSxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLFVBQVUsQ0FBQyxDQUFDOztJQUVqRCxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQzdDLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDakQsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLEdBQUcsVUFBVSxDQUFDLENBQUM7SUFDakQsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUMvQyxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQ2pELENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxHQUFHLFVBQVUsQ0FBQyxDQUFDO0lBQ2pELENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDaEQsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUNqRCxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsSUFBSSxTQUFTLENBQUMsQ0FBQztJQUNoRCxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ2hELENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDaEQsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFLEdBQUcsUUFBUSxDQUFDLENBQUM7SUFDL0MsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUNoRCxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ2hELENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxHQUFHLFNBQVMsQ0FBQyxDQUFDO0FBQ3BELElBQUksQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQzs7SUFFaEQsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUNoRCxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUUsR0FBRyxVQUFVLENBQUMsQ0FBQztJQUNqRCxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQ2pELENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDL0MsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksVUFBVSxDQUFDLENBQUM7SUFDakQsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUNqRCxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQzlDLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDakQsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksVUFBVSxDQUFDLENBQUM7SUFDakQsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUMvQyxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLFVBQVUsQ0FBQyxDQUFD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QUFDLEVBQUUsQ0FBQyxFQUFFLENBQUM7QUFDM0I7RUFDRSxHQUFHLENBQUMsR0FBRyxFQUFFLEVBQUUsT0FBTyxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztFQUN2QyxHQUFHLENBQUMsR0FBRyxFQUFFLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztFQUM1QixHQUFHLENBQUMsR0FBRyxFQUFFLEVBQUUsT0FBTyxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztFQUM5QyxPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ25CLENBQUM7O0FBRUQ7O0dBRUc7QUFDSCxTQUFTLE9BQU8sQ0FBQyxDQUFDO0FBQ2xCO0VBQ0UsT0FBTyxDQUFDLENBQUMsR0FBRyxFQUFFLEtBQUssVUFBVSxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsS0FBSyxVQUFVO1NBQy9DLENBQUMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLFVBQVUsR0FBRyxDQUFDLFNBQVMsQ0FBQztBQUM3QyxDQUFDOztBQUVEO0FBQ0E7O0dBRUc7QUFDSCxTQUFTLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQztBQUN0QjtFQUNFLElBQUksR0FBRyxHQUFHLENBQUMsQ0FBQyxHQUFHLE1BQU0sS0FBSyxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUM7RUFDdEMsSUFBSSxHQUFHLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxHQUFHLElBQUksRUFBRSxDQUFDLENBQUM7RUFDOUMsT0FBTyxDQUFDLEdBQUcsSUFBSSxFQUFFLEtBQUssR0FBRyxHQUFHLE1BQU0sQ0FBQyxDQUFDO0FBQ3RDLENBQUM7O0FBRUQ7O0dBRUc7QUFDSCxTQUFTLEdBQUcsQ0FBQyxHQUFHLEVBQUUsR0FBRztBQUNyQjtFQUNFLE9BQU8sQ0FBQyxHQUFHLElBQUksR0FBRyxLQUFLLEdBQUcsTUFBTSxFQUFFLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUM3QyxDQUFDOztBQUVELE1BQU0sQ0FBQyxPQUFPLEdBQUcsU0FBUyxJQUFJLENBQUMsR0FBRyxFQUFFO0VBQ2xDLE9BQU8sT0FBTyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsU0FBUyxFQUFFLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQztDQUMvQyxDQUFDOzs7O0FDcEdGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQSxHQUFHOztBQUVILElBQUksT0FBTyxHQUFHLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQzs7QUFFbkMsSUFBSSxRQUFRLEdBQUcsU0FBUyxDQUFDLEVBQUUsQ0FBQyxFQUFFO0VBQzVCLElBQUksR0FBRyxHQUFHLENBQUMsQ0FBQyxHQUFHLE1BQU0sS0FBSyxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUM7RUFDdEMsSUFBSSxHQUFHLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxHQUFHLElBQUksRUFBRSxDQUFDLENBQUM7RUFDOUMsT0FBTyxDQUFDLEdBQUcsSUFBSSxFQUFFLEtBQUssR0FBRyxHQUFHLE1BQU0sQ0FBQyxDQUFDO0FBQ3RDLENBQUMsQ0FBQzs7QUFFRixJQUFJLENBQUMsR0FBRyxTQUFTLENBQUMsRUFBRSxDQUFDLEVBQUU7RUFDckIsT0FBTyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3JDLENBQUMsQ0FBQzs7QUFFRixJQUFJLENBQUMsR0FBRyxTQUFTLENBQUMsRUFBRSxDQUFDLEVBQUU7RUFDckIsUUFBUSxDQUFDLEtBQUssQ0FBQyxFQUFFO0FBQ25CLENBQUMsQ0FBQzs7QUFFRixJQUFJLEVBQUUsR0FBRyxTQUFTLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFO0VBQ3pCLFFBQVEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUU7QUFDaEMsQ0FBQyxDQUFDOztBQUVGLElBQUksR0FBRyxHQUFHLFNBQVMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUU7RUFDMUIsUUFBUSxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRTtBQUN2QyxDQUFDLENBQUM7O0FBRUYsSUFBSSxTQUFTLEdBQUcsU0FBUyxDQUFDLEVBQUU7RUFDMUIsUUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRTtBQUN6QyxDQUFDLENBQUM7O0FBRUYsSUFBSSxTQUFTLEdBQUcsU0FBUyxDQUFDLEVBQUU7RUFDMUIsUUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRTtBQUN6QyxDQUFDLENBQUM7O0FBRUYsSUFBSSxTQUFTLEdBQUcsU0FBUyxDQUFDLEVBQUU7RUFDMUIsUUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRTtBQUN4QyxDQUFDLENBQUM7O0FBRUYsSUFBSSxTQUFTLEdBQUcsU0FBUyxDQUFDLEVBQUU7RUFDMUIsUUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRTtBQUMxQyxDQUFDLENBQUM7O0FBRUYsSUFBSSxXQUFXLEdBQUcsU0FBUyxDQUFDLEVBQUUsQ0FBQyxFQUFFO0VBQy9CLElBQUksQ0FBQyxHQUFHLElBQUksS0FBSyxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0VBQ2p0QixJQUFJLElBQUksR0FBRyxJQUFJLEtBQUssQ0FBQyxVQUFVLEVBQUUsVUFBVSxFQUFFLFVBQVUsRUFBRSxVQUFVLEVBQUUsVUFBVSxFQUFFLFVBQVUsRUFBRSxVQUFVLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFDbkgsSUFBSSxDQUFDLEdBQUcsSUFBSSxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDdEIsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDckMsSUFBSSxJQUFJLEVBQUUsRUFBRSxFQUFFLENBQUM7O0VBRWIsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxJQUFJLEtBQUssRUFBRSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQztFQUNuQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUM7RUFDakMsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRTtJQUNyQyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN2RyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFO01BQzNCLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBRTtRQUNWLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO09BQ2pCLE1BQU07UUFDTCxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQztPQUNyRztNQUNELEVBQUUsR0FBRyxRQUFRLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7TUFDdEYsRUFBRSxHQUFHLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztNQUMxQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDO0tBQ3JGO0lBQ0QsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDL0gsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7R0FDaEk7RUFDRCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUMsQ0FBQzs7QUFFRixNQUFNLENBQUMsT0FBTyxHQUFHLFNBQVMsTUFBTSxDQUFDLEdBQUcsRUFBRTtFQUNwQyxPQUFPLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLFdBQVcsRUFBRSxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUM7Q0FDakQsQ0FBQzs7OztBQzlFRixZQUFZLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxNQUFNLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxNQUFNLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxNQUFNLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxNQUFNLGFBQWEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDdGYsV0FBVyxHQUFHLE9BQU8sTUFBTSxFQUFFLE1BQU0sQ0FBQyxPQUFPLEdBQUcsTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxVQUFVLEdBQUcsT0FBTyxNQUFNLEVBQUUsTUFBTSxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQ2xJLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDemYsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ1AsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUM7QUFDbGdCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNsRCxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLHdCQUF3QixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNwZixDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUM3RyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQztBQUN0ZixDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsRUFBRSxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7QUFDbGYsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNqZCxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsWUFBWSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sa0JBQWtCLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDL1ksSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsY0FBYyxFQUFFLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDL1YsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsa0VBQWtFLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3RmLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztBQUNyZ0IsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxRQUFRLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUMzZixVQUFVLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sV0FBVyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDdFQsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3ZmLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN2QixJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxrQ0FBa0MsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQ3ZmLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLGtDQUFrQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsd0JBQXdCLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyx3Q0FBd0MsQ0FBQyxDQUFDLENBQUM7QUFDMWlCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQzFmLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQy9OLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU07Q0FDMWYsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMseUJBQXlCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN6ZixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsd0JBQXdCLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDaGdCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDbEgsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDL2YsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztBQUN2ZixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzNmLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNsVyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLHlDQUF5QyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztBQUNuZSxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsMEJBQTBCLENBQUMsQ0FBQyxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztBQUMvYyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ2pXLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsd0JBQXdCLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxFQUFFLE9BQU8sRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQztBQUM5ZixJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLHFFQUFxRSxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMscUVBQXFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxFQUFFLE9BQU8sRUFBRTtBQUNuZ0IsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxPQUFPLENBQUMsRUFBRSxLQUFLLFFBQVEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLHNCQUFzQixHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsUUFBUSxHQUFHLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFO0FBQ3pmLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEtBQUssUUFBUSxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLHFFQUFxRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxFQUFFLEdBQUcsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDemYsQ0FBQyxJQUFJLElBQUksRUFBRSxPQUFPLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsZUFBZSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLGdCQUFnQixFQUFFLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsY0FBYztBQUN2Z0IsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxXQUFXLEVBQUUsUUFBUSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLG1CQUFtQjtDQUNuZ0IsTUFBTSxDQUFDLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLG1CQUFtQixDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsbUJBQW1CLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxXQUFXLEdBQUcsUUFBUSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxVQUFVO0FBQ3JmLElBQUksQ0FBQyxDQUFDLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLG1CQUFtQixDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSztBQUM3ZixDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsNEJBQTRCLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLDRCQUE0QixDQUFDLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxXQUFXLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUMsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN6ZCxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLEdBQUcsT0FBTyxNQUFNLEVBQUUsTUFBTSxDQUFDLFdBQVcsRUFBRSxVQUFVLEdBQUcsT0FBTyxNQUFNLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksSUFBSSxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sVUFBVSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDaGQsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxXQUFXLEdBQUcsT0FBTyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLFdBQVcsQ0FBQyxDQUFDLElBQUksVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsQ0FBQyxLQUFLLEdBQUcsV0FBVyxHQUFHLE9BQU8sTUFBTSxFQUFFLFdBQVcsR0FBRyxPQUFPLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLFdBQVcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLE1BQU0sQ0FBQyxRQUFRLEVBQUUsTUFBTSxDQUFDLFFBQVEsQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDNWhCLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsMkJBQTJCLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsV0FBVyxHQUFHLE9BQU8sTUFBTSxFQUFFLE1BQU0sQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyx5REFBeUQsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN2TixJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxRQUFRLEdBQUcsT0FBTyxDQUFDLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsUUFBUSxHQUFHLE9BQU8sQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLEdBQUcsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLEdBQUcsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLEdBQUcsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLEtBQUssR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sRUFBRSxDQUFDO0FBQ3ZmLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLGtDQUFrQyxDQUFDLENBQUMsQ0FBQyxRQUFRLEdBQUcsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxZQUFZLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxRQUFRLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUNyZixPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsUUFBUSxHQUFHLE9BQU8sQ0FBQyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxRQUFRLEdBQUcsT0FBTyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLFFBQVEsR0FBRyxPQUFPLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxHQUFHLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxHQUFHLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxHQUFHLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxLQUFLLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU07QUFDL2YsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsa0NBQWtDLENBQUMsQ0FBQyxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLFlBQVksSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxRQUFRLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO0FBQ3BmLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsb0NBQW9DLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLFFBQVEsQ0FBQyxLQUFLLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sS0FBSyxRQUFRLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLE1BQU0sS0FBSyxRQUFRLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLFFBQVEsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsK0JBQStCLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDL2YsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQywrQkFBK0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyw2RkFBNkYsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLCtCQUErQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLHNCQUFzQixDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU07QUFDbGYsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQywrQkFBK0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUM7QUFDamUsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJ2YXIgUmVhY3QgPSByZXF1aXJlKCdyZWFjdC9hZGRvbnMnKTtcclxudmFyIFJvdXRlciA9IHJlcXVpcmUoJ3JlYWN0LXJvdXRlcicpO1xyXG52YXIgY29uZmlybUF1dGhvcml6ZWQgPSByZXF1aXJlKCcuLi91dGlsaXRpZXMvY29uZmlybUF1dGhvcml6ZWQnKVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XHJcblx0bWl4aW5zOiBbIFJvdXRlci5TdGF0ZSwgUm91dGVyLk5hdmlnYXRpb24gXSxcclxuXHRnZXRJbml0aWFsU3RhdGU6IGZ1bmN0aW9uKCkge1xyXG5cdFx0cmV0dXJuIHtcclxuXHRcdH1cclxuXHR9LFxyXG5cdGNvbXBvbmVudFdpbGxNb3VudDogZnVuY3Rpb24oKSB7XHJcblx0fSxcclxuXHRiYWNrdXA6IGZ1bmN0aW9uKCkge1xyXG5cdFx0aWYgKHRoaXMuc3RhdGUuYmFja2luZ1VwKSB7XHJcblx0XHRcdHJldHVyblxyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuc2V0U3RhdGUoe2JhY2tpbmdVcDogdHJ1ZX0pXHJcblx0XHRjb25maXJtQXV0aG9yaXplZEFuZEdldERvY3ModGhpcy5wcm9wcy5kYiwgZnVuY3Rpb24oZXJyLCByZXN1bHRzKSB7XHJcblx0XHRcdGlmIChlcnIpIHtcclxuXHRcdFx0XHR0aGlzLnNldFN0YXRlKHtiYWNraW5nVXA6IGZhbHNlfSlcclxuXHRcdFx0XHRjb25zb2xlLmxvZyhlcnIpO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHR2YXIganNvbiA9IEpTT04uc3RyaW5naWZ5KHJlc3VsdHMpO1xyXG5cdFx0XHR2YXIgcGF1c2UgPSAyXHJcblx0XHRcdHVwbG9hZEJhY2t1cFRvRHJpdmUoanNvbiwgZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0YWxlcnRpZnkubWVzc2FnZSgnQmFja2VkIHVwIEpvdXJuYWwnLCBwYXVzZSk7XHJcblx0XHRcdFx0c2V0VGltZW91dChmdW5jdGlvbigpIHtcclxuXHRcdFx0XHRcdHRoaXMuc2V0U3RhdGUoe2JhY2tpbmdVcDogZmFsc2V9KVxyXG5cdFx0XHRcdH0uYmluZCh0aGlzKSwgcGF1c2UpXHJcblx0XHRcdH0uYmluZCh0aGlzKSk7XHJcblx0XHR9LmJpbmQodGhpcykpXHJcblx0fSxcclxuXHJcblx0cmVzdG9yZTogZnVuY3Rpb24oKSB7XHJcblx0XHR0aGlzLnRyYW5zaXRpb25UbygncmVzdG9yZScpXHJcblx0fSxcclxuXHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xyXG5cdFx0dmFyIGJhY2t1cFRleHQgPSB0aGlzLnN0YXRlLmJhY2tpbmdVcCA/ICdCYWNraW5nIHVwJyA6ICdCYWNrdXAgdG8gZHJpdmUnXHJcblx0XHR2YXIgcmVzdG9yZVRleHQgPSB0aGlzLnN0YXRlLnJlc3RvcmluZyA/ICdSZXN0b3JpbmcnIDogJ1Jlc3RvcmUgZnJvbSBkcml2ZSAoZXhwZXJpbWVudGFsKSdcclxuXHRcdHJldHVybiAoPGRpdj5cclxuXHRcdFx0PGJ1dHRvbiBvbkNsaWNrPXt0aGlzLmJhY2t1cH0+e2JhY2t1cFRleHR9PC9idXR0b24+PGJyIC8+XHJcblx0XHRcdDxidXR0b24gb25DbGljaz17dGhpcy5yZXN0b3JlfT57cmVzdG9yZVRleHR9PC9idXR0b24+PGJyIC8+XHJcblx0XHQ8L2Rpdj4pXHJcblx0fVxyXG59KTtcclxuXHJcbmZ1bmN0aW9uIHVwbG9hZEJhY2t1cFRvRHJpdmUoanNvbiwgY2FsbGJhY2spIHtcclxuXHR2YXIgYm91bmRhcnkgPSAnLS0tLS0tLTMxNDE1OTI2NTM1ODk3OTMyMzg0NidcclxuXHR2YXIgZGVsaW1pdGVyID0gXCJcXHJcXG4tLVwiICsgYm91bmRhcnkgKyBcIlxcclxcblwiXHJcblx0dmFyIGNsb3NlX2RlbGltID0gXCJcXHJcXG4tLVwiICsgYm91bmRhcnkgKyBcIi0tXCJcclxuXHR2YXIgY29udGVudFR5cGU9XCJhcHBsaWNhdGlvbi9qc29uXCJcclxuXHJcblxyXG5cdHZhciBkYXRlU3RyaW5nID0gJ2JhY2t1cC0nICsgbmV3IERhdGUoKS5nZXRUaW1lKCkgKyAnLmpzb24nXHJcblxyXG5cdHZhciBtZXRhZGF0YSA9IHtcclxuXHRcdCd0aXRsZSc6IGRhdGVTdHJpbmcsXHJcblx0XHQnbWltZVR5cGUnOiBjb250ZW50VHlwZSxcclxuXHRcdCdwYXJlbnRzJzogW3snaWQnOiAnYXBwZm9sZGVyJ31dXHJcblx0fTtcclxuXHJcblx0dmFyIGJhc2U2NERhdGEgPSBidG9hKEpTT04uc3RyaW5naWZ5KGpzb24pKTtcclxuXHJcblx0dmFyIG11bHRpcGFydFJlcXVlc3RCb2R5ID1cclxuXHRcdGRlbGltaXRlciArXHJcblx0XHQnQ29udGVudC1UeXBlOiBhcHBsaWNhdGlvbi9qc29uXFxyXFxuXFxyXFxuJyArXHJcblx0XHRKU09OLnN0cmluZ2lmeShtZXRhZGF0YSkgK1xyXG5cdFx0ZGVsaW1pdGVyICtcclxuXHRcdCdDb250ZW50LVR5cGU6ICcgKyBjb250ZW50VHlwZSArICdcXHJcXG4nICtcclxuXHRcdCdDb250ZW50LVRyYW5zZmVyLUVuY29kaW5nOiBiYXNlNjRcXHJcXG4nICtcclxuXHRcdCdcXHJcXG4nICtcclxuXHRcdGJhc2U2NERhdGEgK1xyXG5cdFx0Y2xvc2VfZGVsaW07XHJcblxyXG5cdHZhciByZXF1ZXN0ID0gZ2FwaS5jbGllbnQucmVxdWVzdCh7XHJcblx0XHQncGF0aCc6ICcvdXBsb2FkL2RyaXZlL3YyL2ZpbGVzJyxcclxuXHRcdCdtZXRob2QnOiAnUE9TVCcsXHJcblx0XHQncGFyYW1zJzogeyd1cGxvYWRUeXBlJzogJ211bHRpcGFydCd9LFxyXG5cdFx0J2hlYWRlcnMnOiB7XHJcblx0XHRcdCdDb250ZW50LVR5cGUnOiAnbXVsdGlwYXJ0L21peGVkOyBib3VuZGFyeT1cIicgKyBib3VuZGFyeSArICdcIidcclxuXHRcdH0sXHJcblx0XHQnYm9keSc6IG11bHRpcGFydFJlcXVlc3RCb2R5XHJcblx0fSk7XHJcblx0cmVxdWVzdC5leGVjdXRlKGZ1bmN0aW9uKHJlc3BvbnNlKSB7XHJcblx0XHRjYWxsYmFjaygpXHJcblx0fSk7XHJcblxyXG5cclxufVxyXG5cclxuZnVuY3Rpb24gY29uZmlybUF1dGhvcml6ZWRBbmRHZXREb2NzKGRiLCBjYWxsYmFjaykge1xyXG5cdGNvbmZpcm1BdXRob3JpemVkKGZ1bmN0aW9uKCkge1xyXG5cdFx0Ly8gbG9hZCBkb2N1bWVudHNcclxuXHRcdGRiLmFsbERvY3Moe1xyXG5cdFx0XHRpbmNsdWRlX2RvY3M6IHRydWUsXHJcblx0XHR9KS50aGVuKGZ1bmN0aW9uKHJlc3VsdHMpIHtcclxuXHRcdFx0dmFyIHJlc3VsdHMgPSByZXN1bHRzLnJvd3MubWFwKGZ1bmN0aW9uKGRvYyl7XHJcblx0XHRcdFx0dmFyIGVudHJ5ID0gZG9jLmRvYztcclxuXHRcdFx0XHRyZXR1cm4gZW50cnlcclxuXHRcdFx0fS5iaW5kKHRoaXMpKTtcclxuXHJcblx0XHRcdGNhbGxiYWNrKG51bGwsIHJlc3VsdHMpXHJcblxyXG5cdFx0fS5iaW5kKHRoaXMpKVxyXG5cdFx0LmNhdGNoKGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0Y2FsbGJhY2soZSlcclxuXHRcdH0pO1xyXG5cdH0pXHJcbn1cclxuIiwidmFyIFJlYWN0ID0gcmVxdWlyZSgncmVhY3QvYWRkb25zJyk7XHJcbnZhciBSb3V0ZXIgPSByZXF1aXJlKCdyZWFjdC1yb3V0ZXInKTtcclxuXHJcbnZhciBSb3V0ZSA9IFJvdXRlci5Sb3V0ZTtcclxudmFyIExpbmsgPSBSb3V0ZXIuTGluaztcclxudmFyIERlZmF1bHRSb3V0ZSA9IFJvdXRlci5EZWZhdWx0Um91dGU7XHJcbnZhciBOb3RGb3VuZFJvdXRlID0gUm91dGVyLk5vdEZvdW5kUm91dGU7XHJcblxyXG52YXIgUm9vdFJvdXRlSGFuZGxlciA9IHJlcXVpcmUoJy4vcm91dGVzL1Jvb3RSb3V0ZUhhbmRsZXInKVxyXG52YXIgTm90Rm91bmRSb3V0ZUhhbmRsZXIgPSByZXF1aXJlKCcuL3JvdXRlcy9Ob3RGb3VuZFJvdXRlSGFuZGxlcicpO1xyXG5cclxuXHJcbnZhciBTZXR0aW5nc1JvdXRlSGFuZGxlciA9IHJlcXVpcmUoJy4vcm91dGVzL1NldHRpbmdzUm91dGVIYW5kbGVyJyk7XHJcbnZhciBFZGl0b3JSb3V0ZUhhbmRsZXIgPSByZXF1aXJlKCcuL3JvdXRlcy9FZGl0b3JSb3V0ZUhhbmRsZXInKTtcclxudmFyIEluZGV4Um91dGVIYW5kbGVyID0gcmVxdWlyZSgnLi9yb3V0ZXMvSW5kZXhSb3V0ZUhhbmRsZXInKTtcclxudmFyIHJlc3RvcmVSb3V0ZUhhbmRsZXIgPSByZXF1aXJlKCcuL3JvdXRlcy9yZXN0b3JlUm91dGVIYW5kbGVyJyk7XG4vKiBkZXNsaWdodCByZXF1aXJlIGhvb2sgLSBkbyBub3QgbW9kaWZ5IHRoaXMgbGluZSAqL1xyXG5cclxudmFyIHJvdXRlcyA9IChcclxuXHQ8Um91dGUgaGFuZGxlcj17Um9vdFJvdXRlSGFuZGxlcn0gcGF0aD1cIi9cIj5cclxuXHRcdDxEZWZhdWx0Um91dGUgaGFuZGxlcj17SW5kZXhSb3V0ZUhhbmRsZXJ9IG5hbWU9J2luZGV4Jy8+XHJcblx0XHQ8Um91dGUgaGFuZGxlcj17RWRpdG9yUm91dGVIYW5kbGVyfSBuYW1lPVwiZWRpdG9yXCIgcGF0aD0nZWRpdG9yLzppZCcvPlxyXG5cdFx0PE5vdEZvdW5kUm91dGUgaGFuZGxlcj17Tm90Rm91bmRSb3V0ZUhhbmRsZXJ9IC8+XHJcblx0XHQ8Um91dGUgaGFuZGxlcj17U2V0dGluZ3NSb3V0ZUhhbmRsZXJ9IG5hbWU9J3NldHRpbmdzJyBwYXRoPSdzZXR0aW5ncycvPlxyXG48Um91dGUgaGFuZGxlcj17cmVzdG9yZVJvdXRlSGFuZGxlcn0gbmFtZT0ncmVzdG9yZScgcGF0aD0ncmVzdG9yZScvPlxuLyogZGVzbGlnaHQgcm91dGUgaG9vayAtIGRvIG5vdCBtb2RpZnkgdGhpcyBsaW5lICovXHJcblx0PC9Sb3V0ZT5cclxuKTtcclxuXHJcbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2RldmljZVJlYWR5JywgZnVuY3Rpb24oKSB7XHJcblx0Um91dGVyLnJ1bihyb3V0ZXMsIGZ1bmN0aW9uKEhhbmRsZXIpIHtcclxuXHRcdFJlYWN0LnJlbmRlcig8SGFuZGxlciAvPiwgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Jvb3Rfam91cm5leScpKTtcclxuXHR9KTtcclxufSwgZmFsc2UpXHJcblxyXG5cclxuIiwidmFyIFJlYWN0ID0gcmVxdWlyZSgncmVhY3QvYWRkb25zJyk7XHJcbnZhciBSb3V0ZXIgPSByZXF1aXJlKCdyZWFjdC1yb3V0ZXInKTtcclxudmFyIFJvdXRlSGFuZGxlciA9IFJvdXRlci5Sb3V0ZUhhbmRsZXI7XHJcbnZhciBhbGVydGlmeSA9IHdpbmRvd1snYWxlcnRpZnknXSA9IHJlcXVpcmUoJ2FsZXJ0aWZ5anMnKVxyXG5cclxudmFyIGRhdGVzID0gcmVxdWlyZSgnLi4vdXRpbGl0aWVzL2RhdGVzJylcclxudmFyIGRlY3J5cHQgPSByZXF1aXJlKCcuLi91dGlsaXRpZXMvZGVjcnlwdEVudHJ5JylcclxudmFyIGVuY3J5cHQgPSByZXF1aXJlKCcuLi91dGlsaXRpZXMvZW5jcnlwdEVudHJ5JylcclxuZnVuY3Rpb24gZ2V0TmV4dFNhdmUoKSB7XHJcblx0XHR2YXIgZCA9IG5ldyBEYXRlKClcclxuXHRcdGQuc2V0U2Vjb25kcyhkLmdldFNlY29uZHMoKSArIDUpO1xyXG5cdFx0cmV0dXJuIGQ7XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xyXG5cdG1peGluczogWyBSb3V0ZXIuU3RhdGUsIFJvdXRlci5OYXZpZ2F0aW9uXSxcclxuXHRnZXRJbml0aWFsU3RhdGU6IGZ1bmN0aW9uKCkge1xyXG5cdFx0cmV0dXJuIHtcclxuXHRcdFx0ZG9jOiB1bmRlZmluZWQsXHJcblx0XHRcdHRpbWVvdXQ6IHVuZGVmaW5lZCxcclxuXHRcdFx0bmV4dF9zYXZlOiBnZXROZXh0U2F2ZSgpLFxyXG5cdFx0XHRjb250ZW50OiAnJyxcclxuXHRcdFx0dGFnczogW10sXHJcblx0XHRcdG1vZGlmaWVkOiBmYWxzZVxyXG5cdFx0fVxyXG5cdH0sXHJcblx0Y29tcG9uZW50RGlkTW91bnQ6IGZ1bmN0aW9uKCkge1xyXG5cdFx0dmFyIGlkID0gdGhpcy5wcm9wcy5wYXJhbXMuaWRcclxuXHRcdHRoaXMucHJvcHMuZGIuZ2V0KGlkKS50aGVuKGZ1bmN0aW9uKGRvYykge1xyXG5cdFx0XHR2YXIgZW50cnkgPSBkZWNyeXB0KHRoaXMucHJvcHMuYXV0aGtleSwgZG9jKVxyXG5cdFx0XHR0aGlzLnNldFN0YXRlKHtcclxuXHRcdFx0XHRkb2M6IHtcclxuXHRcdFx0XHRcdGlkOiBlbnRyeS5faWQsXHJcblx0XHRcdFx0XHRyZXY6IGVudHJ5Ll9yZXZcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRcdGNvbnRlbnQ6IGVudHJ5LmNvbnRlbnQsXHJcblx0XHRcdFx0dGFnczogZW50cnkudGFncyA/IGVudHJ5LnRhZ3MgOiBbXVxyXG5cdFx0XHR9KTtcclxuXHJcblx0XHR9LmJpbmQodGhpcykpLmNhdGNoKGZ1bmN0aW9uKGVycikge1xyXG5cdFx0XHRpZiAoZXJyLnN0YXR1cyA9PT0gNDA0KSB7XHJcblx0XHRcdH1cclxuXHRcdFx0ZWxzZSB7XHJcblx0XHRcdFx0Y29uc29sZS5sb2coZXJyKTtcclxuXHRcdFx0fVxyXG5cdFx0fSlcclxuXHJcblx0XHR3aW5kb3cub25iZWZvcmV1bmxvYWQgPSBmdW5jdGlvbiAoZSkge1xyXG5cdFx0XHRpZiAodGhpcy5zdGF0ZS5tb2RpZmllZCkge1xyXG5cdFx0XHRcdHZhciBtZXNzYWdlID0gXCJKb3VybmV5IGhhcyB1bnNhdmVkIGNoYW5nZXMuIERvIHlvdSB3YW50IHRvIGxlYXZlIHRoZSBwYWdlIGFuZCBkaXNjYXJkIHlvdXIgY2hhbmdlcz9cIixcclxuXHRcdFx0XHRcdGUgPSBlIHx8IHdpbmRvdy5ldmVudDtcclxuXHRcdFx0XHQvLyBGb3IgSUUgYW5kIEZpcmVmb3hcclxuXHRcdFx0XHRpZiAoZSkge1xyXG5cdFx0XHRcdFx0ZS5yZXR1cm5WYWx1ZSA9IG1lc3NhZ2U7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyBGb3IgU2FmYXJpXHJcblx0XHRcdFx0cmV0dXJuIG1lc3NhZ2U7XHJcblx0XHRcdH1cclxuXHRcdH0uYmluZCh0aGlzKTtcclxuXHR9LFxyXG5cdGNvbXBvbmVudFdpbGxVbm1vdW50OiBmdW5jdGlvbigpIHtcclxuXHRcdHdpbmRvdy5vbmJlZm9yZXVubG9hZCA9IG51bGw7XHJcblx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMuc3RhdGUudGltZW91dCk7XHJcblx0fSxcclxuXHRzY2hlZHVsZVNhdmU6IGZ1bmN0aW9uKCkge1xyXG5cdFx0d2luZG93LmNsZWFyVGltZW91dCh0aGlzLnN0YXRlLnRpbWVvdXQpO1xyXG5cdFx0dmFyIHRpbWVvdXQgPSB3aW5kb3cuc2V0VGltZW91dChmdW5jdGlvbigpIHtcclxuXHRcdFx0dGhpcy5zYXZlRW50cnkoKTtcclxuXHRcdH0uYmluZCh0aGlzKSwgNTAwKVxyXG5cdFx0dGhpcy5zZXRTdGF0ZSh7dGltZW91dDogdGltZW91dH0pXHJcblx0fSxcclxuXHRjaGFuZ2VkOiBmdW5jdGlvbihlKSB7XHJcblx0XHR2YXIgY29udGVudCA9IGUudGFyZ2V0LnZhbHVlO1xyXG5cdFx0dGhpcy5zY2hlZHVsZVNhdmUoKVxyXG5cdFx0dGhpcy5zZXRTdGF0ZSh7Y29udGVudDogY29udGVudCwgbW9kaWZpZWQ6IHRydWV9KVxyXG5cdH0sXHJcblx0c2F2ZUVudHJ5OiBmdW5jdGlvbigpIHtcclxuXHRcdHZhciBjb250ZW50ID0gdGhpcy5zdGF0ZS5jb250ZW50XHJcblx0XHR2YXIgaWQgPSB0aGlzLnByb3BzLnBhcmFtcy5pZFxyXG5cdFx0dmFyIGRiID0gdGhpcy5wcm9wcy5kYlxyXG5cclxuXHRcdHZhciBhZnRlclNhdmUgPSBmdW5jdGlvbihyZXNwb25zZSkge1xyXG5cdFx0XHR0aGlzLnNldFN0YXRlKHtcclxuXHRcdFx0XHRuZXh0X3NhdmU6IGdldE5leHRTYXZlKCksXHJcblx0XHRcdFx0ZG9jOiByZXNwb25zZSxcclxuXHRcdFx0XHRtb2RpZmllZDogZmFsc2VcclxuXHRcdFx0fSlcclxuXHRcdFx0YWxlcnRpZnkubm90aWZ5KCdzYXZpbmcuLi4nLCAnc2F2ZScsIDEpXHJcblx0XHR9LmJpbmQodGhpcyk7XHJcblxyXG5cdFx0dmFyIHB1dERvYyA9IGVuY3J5cHQodGhpcy5wcm9wcy5hdXRoa2V5LCB7XHJcblx0XHRcdF9pZDogaWQsXHJcblx0XHRcdGNvbnRlbnQ6IGNvbnRlbnQsXHJcblx0XHRcdHRhZ3M6IHRoaXMuc3RhdGUudGFnc1xyXG5cdFx0fSlcclxuXHJcblx0XHRpZiAodGhpcy5zdGF0ZS5kb2MpIHtcclxuXHRcdFx0cHV0RG9jLl9yZXYgPSB0aGlzLnN0YXRlLmRvYy5yZXZcclxuXHRcdH1cclxuXHRcdGRiLnB1dChcclxuXHRcdFx0cHV0RG9jXHJcblx0XHQpLnRoZW4oYWZ0ZXJTYXZlKS5jYXRjaChmdW5jdGlvbihlKSB7XHJcblx0XHRcdGNvbnNvbGUubG9nKGUpO1x0XHRcdFx0XHJcblx0XHR9KTtcclxuXHR9LFxyXG5cdHRyYW5zaXRpb25Ub0luZGV4OiBmdW5jdGlvbigpIHtcclxuXHRcdGlmICh0aGlzLnN0YXRlLm1vZGlmaWVkKSB7XHJcblx0XHRcdHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy5zdGF0ZS50aW1lb3V0KTtcclxuXHRcdFx0dmFyIG1lc3NhZ2UgPSBcIkpvdXJuZXkgaGFzIHVuc2F2ZWQgY2hhbmdlcy4gRG8geW91IHdhbnQgdG8gbGVhdmUgdGhlIHBhZ2UgYW5kIGRpc2NhcmQgeW91ciBjaGFuZ2VzP1wiXHJcblx0XHRcdGFsZXJ0aWZ5LmNvbmZpcm0obWVzc2FnZSkuc2V0KCd0aXRsZScsICdVbnNhdmVkIENoYW5nZXMnKS5zZXQoJ2xhYmVscycsIHtvazonWWVzJywgY2FuY2VsOidObyd9KS5zZXQoJ29ub2snLCBmdW5jdGlvbigpe1xyXG5cdFx0XHRcdHRoaXMudHJhbnNpdGlvblRvKCdpbmRleCcpO1xyXG5cdFx0XHR9LmJpbmQodGhpcykpLnNldCgnb25jYW5jZWwnLCBmdW5jdGlvbigpIHtcclxuXHRcdFx0XHR0aGlzLnNjaGVkdWxlU2F2ZSgpO1xyXG5cdFx0XHR9LmJpbmQodGhpcykpOyBcclxuXHRcdH1cclxuXHRcdGVsc2Uge1xyXG5cdFx0XHR0aGlzLnRyYW5zaXRpb25UbygnaW5kZXgnKTtcclxuXHRcdH1cclxuXHR9LFxyXG5cdGRlbGV0ZUVudHJ5OiBmdW5jdGlvbigpIHtcclxuXHRcdHZhciBkYiA9IHRoaXMucHJvcHMuZGJcclxuXHRcdGlmICh0aGlzLnN0YXRlLmRvYykge1xyXG5cdFx0XHRhbGVydGlmeS5jb25maXJtKCdEZWxldGUgdGhpcyBlbnRyeT8nKVxyXG5cdFx0XHQuc2V0KCd0aXRsZScsICdDb25maXJtIEFjdGlvbicpXHJcblx0XHRcdC5zZXQoJ2xhYmVscycsIHtvazonWWVzJywgY2FuY2VsOidObyd9KVxyXG5cdFx0XHQuc2V0KCdvbm9rJywgZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0ZGIucmVtb3ZlKHRoaXMuc3RhdGUuZG9jLmlkLCB0aGlzLnN0YXRlLmRvYy5yZXYpXHJcblx0XHRcdFx0LnRoZW4oZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0XHR0aGlzLnRyYW5zaXRpb25Ub0luZGV4KClcdFxyXG5cdFx0XHRcdH0uYmluZCh0aGlzKSlcclxuXHRcdFx0XHQuY2F0Y2goZnVuY3Rpb24oZXJyKXtjb25zb2xlLmxvZyhlcnIpfSlcclxuXHRcdFx0fS5iaW5kKHRoaXMpKTsgXHJcblx0XHR9XHJcblx0fSxcclxuXHRhZGRUYWdGcm9tRWxlbWVudDogZnVuY3Rpb24oZWxlbWVudCkge1xyXG5cdFx0dmFyIHZhbHVlID0gZWxlbWVudC52YWx1ZVxyXG5cdFx0ZWxlbWVudC52YWx1ZSA9ICcnXHJcblx0XHRpZiAodmFsdWUubGVuZ3RoID4gMCAmJiB0aGlzLnN0YXRlLnRhZ3MuaW5kZXhPZih2YWx1ZSkgPT09IC0xKSB7XHJcblx0XHRcdGNvbnNvbGUubG9nKCduZXcgdGFnOicsIHZhbHVlKVxyXG5cdFx0XHR0aGlzLnNldFN0YXRlKHtcclxuXHRcdFx0XHR0YWdzOiB0aGlzLnN0YXRlLnRhZ3MuY29uY2F0KHZhbHVlKSxcclxuXHRcdFx0XHRtb2RpZmllZDogdHJ1ZVxyXG5cdFx0XHR9KTtcclxuXHRcdFx0dGhpcy5zY2hlZHVsZVNhdmUoKTtcclxuXHRcdH1cclxuXHR9LFxyXG5cdHRhZ3NJbnB1dENoYW5nZWQ6IGZ1bmN0aW9uKGUpIHtcclxuXHRcdHN3aXRjaCAoZS50YXJnZXQudmFsdWUuc3Vic3RyKC0xKSkge1xyXG5cdFx0XHRjYXNlICcsJzpcclxuXHRcdFx0Y2FzZSAnICc6XHJcblx0XHRcdFx0ZS50YXJnZXQudmFsdWUgPSBlLnRhcmdldC52YWx1ZS5zdWJzdHJpbmcoMCwgZS50YXJnZXQudmFsdWUubGVuZ3RoLTEpO1xyXG5cdFx0XHRcdHRoaXMuYWRkVGFnRnJvbUVsZW1lbnQoZS50YXJnZXQpO1xyXG5cdFx0XHRcdGJyZWFrXHRcclxuXHRcdH1cclxuXHR9LFxyXG5cdHJlbW92ZVRhZzogZnVuY3Rpb24odGFnKSB7XHJcblx0XHR2YXIgaWR4ID0gdGhpcy5zdGF0ZS50YWdzLmluZGV4T2YodGFnKVxyXG5cdFx0aWYgKGlkeCAhPT0gLTEpIHtcclxuXHRcdFx0dmFyIHRhZ3MgPSB0aGlzLnN0YXRlLnRhZ3NcclxuXHRcdFx0dGFncy5zcGxpY2UoaWR4LCAxKVxyXG5cdFx0XHR0aGlzLnNldFN0YXRlKHt0YWdzOiB0YWdzLCBtb2RpZmllZDogdHJ1ZX0pO1xyXG5cdFx0XHR0aGlzLnNjaGVkdWxlU2F2ZSgpXHJcblx0XHR9XHJcblx0fSxcclxuXHR0YWdLZXlEb3duOiBmdW5jdGlvbihlKSB7XHJcblx0XHRpZiAoZS5rZXlDb2RlID09PSAxMykge1xyXG5cdFx0XHR0aGlzLmFkZFRhZ0Zyb21FbGVtZW50KHRoaXMucmVmcy50YWdzLmdldERPTU5vZGUoKSk7XHJcblx0XHR9XHJcblx0fSxcclxuXHRmb2N1c1RhZ3NJbnB1dDogZnVuY3Rpb24oKSB7XHJcblx0XHR0aGlzLnJlZnMudGFncy5nZXRET01Ob2RlKCkuZm9jdXMoKTtcclxuXHR9LFxyXG5cdHJlbmRlcjogZnVuY3Rpb24oKSB7XHJcblx0XHR2YXIgcm91dGUgPSB0aGlzLmdldFJvdXRlcygpO1xyXG5cclxuXHRcdHZhciBkZWxldGVFbGVtZW50O1xyXG5cdFx0XHJcblx0XHRpZiAodGhpcy5zdGF0ZS5kb2MpIHtcclxuXHRcdFx0ZGVsZXRlRWxlbWVudCA9IChcclxuXHRcdFx0XHQ8ZGl2IGNsYXNzTmFtZT1cImVudHJ5X2RlbGV0ZVwiIG9uQ2xpY2s9e3RoaXMuZGVsZXRlRW50cnl9PlxyXG5cdFx0XHRcdDxpIGNsYXNzTmFtZT1cImZhIGZhLXRyYXNoXCI+PC9pPlxyXG5cdFx0XHRcdDwvZGl2PlxyXG5cdFx0XHQpO1xyXG5cdFx0fVxyXG5cdFx0XHJcblx0XHRyZXR1cm4gKFxyXG5cdFx0XHQ8ZGl2IGNsYXNzTmFtZT1cImpvdXJuZXlfY29udGFpbmVyXCI+XHJcblx0XHRcdFx0PGRpdiBjbGFzc05hbWU9XCJqb3VybmV5X3Rvb2xiYXIgZW50cnlfdG9wXCI+XHJcblx0XHRcdFx0XHQ8ZGl2IGNsYXNzTmFtZT1cImVudHJ5X2JhY2tcIiBvbkNsaWNrPXt0aGlzLnRyYW5zaXRpb25Ub0luZGV4fT5cclxuXHRcdFx0XHRcdFx0JiM4NTkyOyBiYWNrXHJcblx0XHRcdFx0XHQ8L2Rpdj5cclxuXHRcdFx0XHRcdHtkZWxldGVFbGVtZW50fVxyXG5cdFx0XHRcdDwvZGl2PlxyXG5cclxuXHRcdFx0XHQ8dGV4dGFyZWEgYXV0b0ZvY3VzPVwidHJ1ZVwiIG9uQ2hhbmdlPXt0aGlzLmNoYW5nZWR9IHJlZj1cImVkaXRvclwiIGNsYXNzTmFtZT1cImNvbnRlbnQgam91cm5leV9lZGl0b3JcIiB2YWx1ZT17dGhpcy5zdGF0ZS5jb250ZW50fT5cclxuXHRcdFx0XHQ8L3RleHRhcmVhPlxyXG5cdFx0XHRcdDxkaXYgY2xhc3NOYW1lPVwiam91cm5leV90b29sYmFyIGVudHJ5X3RhZ3NcIiBvbkNsaWNrPXt0aGlzLmZvY3VzVGFnc0lucHV0fT5cclxuXHRcdFx0XHRcdDxpIGNsYXNzTmFtZT1cImZhIGZhLXRhZ3NcIj48L2k+Jm5ic3A7XHJcblx0XHRcdFx0XHQ8ZGl2IGNsYXNzTmFtZT1cImVudHJ5X3RhZ3NfY29udGFpbmVyXCI+XHJcblx0XHRcdFx0XHRcdHt0aGlzLnN0YXRlLnRhZ3MubWFwKGZ1bmN0aW9uKHRhZykge1xyXG5cdFx0XHRcdFx0XHRcdHJldHVybiA8c3BhbiBjbGFzc05hbWU9XCJlbnRyeV90YWdcIiBvbkNsaWNrPXt0aGlzLnJlbW92ZVRhZy5iaW5kKHRoaXMsIHRhZyl9IGtleT17dGFnfT57dGFnfTwvc3Bhbj5cclxuXHRcdFx0XHRcdFx0fS5iaW5kKHRoaXMpKX1cclxuXHRcdFx0XHRcdDwvZGl2PlxyXG5cdFx0XHRcdDwvZGl2PlxyXG5cdFx0XHRcdDxkaXYgY2xhc3NOYW1lPVwiam91cm5leV90b29sYmFyIGVudHJ5X3RhZ3NfaW5wdXRcIiA+XHJcblx0XHRcdFx0XHQ8aW5wdXQgY2xhc3NOYW1lPVwiXCIgb25JbnB1dD17dGhpcy50YWdzSW5wdXRDaGFuZ2VkfSBvbktleURvd249e3RoaXMudGFnS2V5RG93bn0gcmVmPVwidGFnc1wiLz5cclxuXHRcdFx0XHQ8L2Rpdj5cclxuXHRcdFx0PC9kaXY+XHJcblx0XHQpO1xyXG5cdH1cclxufSk7XHJcbiIsInZhciBSZWFjdCA9IHJlcXVpcmUoJ3JlYWN0L2FkZG9ucycpO1xyXG52YXIgUm91dGVyID0gcmVxdWlyZSgncmVhY3Qtcm91dGVyJyk7XHJcbnZhciBSb3V0ZUhhbmRsZXIgPSBSb3V0ZXIuUm91dGVIYW5kbGVyO1xyXG52YXIgZGVjcnlwdCA9IHJlcXVpcmUoJy4uL3V0aWxpdGllcy9kZWNyeXB0RW50cnknKVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XHJcblx0bWl4aW5zOiBbIFJvdXRlci5TdGF0ZSwgUm91dGVyLk5hdmlnYXRpb24gXSxcclxuXHRnZXRJbml0aWFsU3RhdGU6IGZ1bmN0aW9uKCkge1xyXG5cdFx0cmV0dXJuIHtcclxuXHRcdFx0ZW50cmllczogW11cclxuXHRcdH1cclxuXHR9LFxyXG5cdGNvbXBvbmVudERpZE1vdW50OiBmdW5jdGlvbigpIHtcclxuXHRcdHZhciBkYiA9IHRoaXMucHJvcHMuZGI7XHJcblx0XHRkYi5nZXQoJ2pvdXJuZXlfbWV0YWRhdGEnKVxyXG5cdFx0LnRoZW4oZnVuY3Rpb24oZG9jKSB7XHJcblx0XHRcdHZhciBuZXh0SWQgPSBkb2MubmV4dElkXHJcblxyXG5cdFx0XHRkYi5hbGxEb2NzKHtcclxuXHRcdFx0XHRpbmNsdWRlX2RvY3M6IHRydWUsXHJcblx0XHRcdFx0c3RhcnRrZXk6ICdlbnRyeTAnLFxyXG5cdFx0XHRcdGVuZGtleTogJ2VudHJ5eidcclxuXHRcdFx0fSkudGhlbihmdW5jdGlvbihyZXN1bHRzKSB7XHJcblx0XHRcdFx0dmFyIHJlc3VsdHMgPSByZXN1bHRzLnJvd3MubWFwKGZ1bmN0aW9uKGRvYyl7XHJcblx0XHRcdFx0XHR2YXIgZW50cnkgPSBkZWNyeXB0KHRoaXMucHJvcHMuYXV0aGtleSwgZG9jLmRvYyk7XHJcblx0XHRcdFx0XHRyZXR1cm4gZW50cnlcclxuXHRcdFx0XHR9LmJpbmQodGhpcykpO1xyXG5cdFx0XHRcdHRoaXMuc2V0U3RhdGUoeyByZXN1bHRzOnJlc3VsdHMsIGVudHJpZXM6cmVzdWx0cyB9KVxyXG5cdFx0XHR9LmJpbmQodGhpcykpXHJcblx0XHRcdC5jYXRjaChmdW5jdGlvbihlKSB7XHJcblx0XHRcdFx0Y29uc29sZS5sb2coZSk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fS5iaW5kKHRoaXMpKTtcclxuXHJcblx0fSxcclxuXHRjcmVhdGVFbnRyeTogZnVuY3Rpb24oKSB7XHJcblx0XHR2YXIgZGIgPSB0aGlzLnByb3BzLmRiO1xyXG5cdFx0ZGIuZ2V0KCdqb3VybmV5X21ldGFkYXRhJylcclxuXHRcdC50aGVuKGZ1bmN0aW9uKGRvYykge1xyXG5cdFx0XHR2YXIgbmV4dElkID0gZG9jLm5leHRJZFxyXG5cdFx0XHRkb2MubmV4dElkKys7XHJcblx0XHRcdGRiLnB1dChkb2MpLnRoZW4oZnVuY3Rpb24oZG9jKSB7XHJcblx0XHRcdH0pXHJcblx0XHRcdC5jYXRjaChmdW5jdGlvbihlKSB7XHJcblx0XHRcdFx0Y29uc29sZS5sb2coZSk7XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0dGhpcy50cmFuc2l0aW9uVG8oJ2VkaXRvcicsIHtpZDogJ2VudHJ5Jytkb2MubmV4dElkfSk7XHJcblx0XHR9LmJpbmQodGhpcykpO1xyXG5cdH0sXHJcblx0ZWRpdEVudHJ5OiBmdW5jdGlvbihlbnRyeSwgZSkge1xyXG5cdFx0dGhpcy50cmFuc2l0aW9uVG8oJ2VkaXRvcicsIHtpZDogZW50cnkuX2lkfSlcclxuXHR9LFxyXG5cdGZpbHRlcjogZnVuY3Rpb24oZSkge1xyXG5cdFx0dmFyIHZhbHVlID0gZS50YXJnZXQudmFsdWU7XHJcblx0XHRpZiAodmFsdWUubGVuZ3RoID4gMCkge1xyXG5cdFx0XHR0aGlzLnNldFN0YXRlKHtlbnRyaWVzOiB0aGlzLnN0YXRlLnJlc3VsdHMuZmlsdGVyKGZ1bmN0aW9uKGVudHJ5KSB7XHJcblx0XHRcdFx0cmV0dXJuIGVudHJ5LmNvbnRlbnQuaW5kZXhPZih2YWx1ZSkgIT09IC0xIHx8IGVudHJ5LnRhZ3Muam9pbigpLmluZGV4T2YodmFsdWUpICE9PSAtMVxyXG5cdFx0XHR9KX0pXHJcblx0XHR9XHJcblx0XHRlbHNlIHtcclxuXHRcdFx0dGhpcy5zZXRTdGF0ZSh7ZW50cmllczogdGhpcy5zdGF0ZS5yZXN1bHRzfSlcclxuXHRcdH1cclxuXHR9LFxyXG5cdGZvY3VzU2VhcmNoOiBmdW5jdGlvbigpIHtcclxuXHRcdHRoaXMucmVmcy5maWx0ZXIuZ2V0RE9NTm9kZSgpLmZvY3VzKClcclxuXHR9LFxyXG5cdHNldHRpbmdzQ2xpY2tlZDogZnVuY3Rpb24oKSB7XHJcblx0XHR0aGlzLnRyYW5zaXRpb25Ubygnc2V0dGluZ3MnKTtcclxuXHR9LFxyXG5cdHJlbmRlcjogZnVuY3Rpb24oKSB7XHJcblx0XHR2YXIgcm91dGUgPSB0aGlzLmdldFJvdXRlcygpO1xyXG5cclxuXHRcdFxyXG5cdFx0cmV0dXJuIChcclxuXHRcdFx0PGRpdiBjbGFzc05hbWU9XCJqb3VybmV5X2NvbnRhaW5lclwiPlxyXG5cdFx0XHRcdDxkaXYgY2xhc3NOYW1lPVwiam91cm5leV90b29sYmFyIHNlYXJjaFwiIG9uQ2xpY2s9e3RoaXMuZm9jdXNTZWFyY2h9PlxyXG5cdFx0XHRcdFx0PGkgY2xhc3NOYW1lPVwiZmEgZmEtc2VhcmNoIHNlYXJjaF9pbmRleFwiPjwvaT5cclxuXHRcdFx0XHRcdDxpbnB1dCBwbGFjZWhvbGRlcj1cImZpbHRlclwiIHJlZj1cImZpbHRlclwiIG9uQ2hhbmdlPXt0aGlzLmZpbHRlcn0gY2xhc3NOYW1lPVwiam91cm5leV9pbnB1dFwiIHR5cGU9XCJ0ZXh0XCIgLz5cclxuXHRcdFx0XHRcdDxpIGNsYXNzTmFtZT1cImZhIGZhLWNvZyBzZXR0aW5nc19idXR0b25cIiBvbkNsaWNrPXt0aGlzLnNldHRpbmdzQ2xpY2tlZH0+PC9pPlxyXG5cdFx0XHRcdDwvZGl2PlxyXG5cdFx0XHRcdDxkaXYgY2xhc3NOYW1lPVwiam91cm5leV9pbmRleF9saXN0IGNvbnRlbnRcIj5cclxuXHRcdFx0XHRcdHt0aGlzLnN0YXRlLmVudHJpZXMubWFwKGZ1bmN0aW9uKGVudHJ5KSB7XHJcblx0XHRcdFx0XHRcdGlmIChlbnRyeS50YWdzLmxlbmd0aCA+IDApIHtcclxuXHRcdFx0XHRcdFx0XHR2YXIgdGFncyA9IDxzcGFuPnRhZ3M6IHtlbnRyeS50YWdzLm1hcChmdW5jdGlvbih0YWcsIGlkeCwgbGlzdCkge1xyXG5cdFx0XHRcdFx0XHRcdFx0aWYgKGlkeCA9PSBsaXN0Lmxlbmd0aC0xKSB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdHJldHVybiA8c3BhbiBrZXk9e3RhZ30+e3RhZ308L3NwYW4+XHJcblx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gKFxyXG5cdFx0XHRcdFx0XHRcdFx0XHQ8c3BhbiBrZXk9e3RhZ30+e3RhZ30sIDwvc3Bhbj5cclxuXHRcdFx0XHRcdFx0XHRcdClcdFx0XHRcdFx0XHJcblx0XHRcdFx0XHRcdFx0fSl9XHJcblx0XHRcdFx0XHRcdFx0PC9zcGFuPlxyXG5cdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHRyZXR1cm4gKFxyXG5cdFx0XHRcdFx0XHRcdDxkaXYgY2xhc3NOYW1lPVwiam91cm5leV9pbmRleF9pdGVtXCIgb25DbGljaz17dGhpcy5lZGl0RW50cnkuYmluZCh0aGlzLCBlbnRyeSl9IGtleT17ZW50cnkuX2lkfT5cclxuXHRcdFx0XHRcdFx0XHRcdDxkaXYgY2xhc3NOYW1lPVwiam91cm5leV9pbmRleF9pdGVtX3RpdGxlXCI+XHJcblx0XHRcdFx0XHRcdFx0XHQge2VudHJ5LnRpdGxlLnN1YnN0cmluZygwLCAyNCkgKyAoKGVudHJ5LnRpdGxlLmxlbmd0aCA+IDI0KSA/ICcuLi4nOicnKSB9XHJcblx0XHRcdFx0XHRcdFx0XHQ8L2Rpdj5cdFxyXG5cclxuXHRcdFx0XHRcdFx0XHRcdDxkaXYgY2xhc3NOYW1lPVwiam91cm5leV9pbmRleF9pdGVtX21ldGFkYXRhXCI+XHJcblx0XHRcdFx0XHRcdFx0XHRcdHt0YWdzfSZuYnNwO1xyXG5cdFx0XHRcdFx0XHRcdFx0PC9kaXY+XHRcclxuXHRcdFx0XHRcdFx0XHQ8L2Rpdj5cclxuXHRcdFx0XHRcdFx0KVx0XHRcdFx0XHJcblx0XHRcdFx0XHR9LmJpbmQodGhpcykpfVxyXG5cdFx0XHRcdDwvZGl2PlxyXG5cclxuXHRcdFx0XHQ8ZGl2IG9uQ2xpY2s9e3RoaXMuY3JlYXRlRW50cnl9IGNsYXNzTmFtZT1cImpvdXJuZXlfdG9vbGJhciBjcmVhdGVcIj5cclxuXHRcdFx0XHRcdGNyZWF0ZSBuZXcgZW50cnlcclxuXHRcdFx0XHQ8L2Rpdj5cclxuXHRcdFx0PC9kaXY+XHJcblx0XHQpO1xyXG5cdH1cclxufSk7XHJcbiIsInZhciBSZWFjdCA9IHJlcXVpcmUoJ3JlYWN0L2FkZG9ucycpO1xyXG52YXIgUm91dGVyID0gcmVxdWlyZSgncmVhY3Qtcm91dGVyJyk7XHJcbnZhciBSb3V0ZUhhbmRsZXIgPSBSb3V0ZXIuUm91dGVIYW5kbGVyO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XHJcblx0bWl4aW5zOiBbIFJvdXRlci5TdGF0ZSBdLFxyXG5cdHJlbmRlcjogZnVuY3Rpb24oKSB7XHJcblx0XHR2YXIgcm91dGUgPSB0aGlzLmdldFJvdXRlcygpO1xyXG5cdFx0XHJcblx0XHRyZXR1cm4gKFxyXG5cdFx0XHQ8ZGl2PlxyXG5cdFx0XHRcdDxoMj5Ob3QgZm91bmQ8L2gyPlxyXG5cdFx0XHQ8L2Rpdj5cclxuXHRcdCk7XHJcblx0fVxyXG59KTtcclxuIiwidmFyIFJlYWN0ID0gcmVxdWlyZSgncmVhY3QvYWRkb25zJyk7XHJcbnZhciBSb3V0ZXIgPSByZXF1aXJlKCdyZWFjdC1yb3V0ZXInKTtcclxudmFyIFJvdXRlSGFuZGxlciA9IFJvdXRlci5Sb3V0ZUhhbmRsZXI7XHJcbnZhciBBdXRoZW50aWNhdGUgPSByZXF1aXJlKCcuL2F1dGhlbnRpY2F0ZScpO1xyXG52YXIgUG91Y2hEQiA9IHJlcXVpcmUoJ3BvdWNoZGInKTtcclxudmFyIHNqY2wgPSByZXF1aXJlKCdzamNsJylcclxudmFyIGFsZXJ0aWZ5ID0gcmVxdWlyZSgnYWxlcnRpZnlqcycpXHJcblxyXG5mdW5jdGlvbiBjcmVhdGVEQihqb3VybmFsLCBjYWxsYmFjaykge1xyXG5cdHZhciBkYiA9IG5ldyBQb3VjaERCKCdqb3VybmV5X2FwcCcsIHthdXRvX2NvbXBhY3Rpb246IHRydWV9KTtcclxuXHRpZiAoam91cm5hbCkge1xyXG5cdFx0ZGIuYnVsa0RvY3Moam91cm5hbCkudGhlbihmdW5jdGlvbihyZXN1bHQpIHtcclxuXHRcdFx0Y2FsbGJhY2soZGIpXHJcblx0XHR9KS5jYXRjaChmdW5jdGlvbigpe1xyXG5cdFx0XHRjb25zb2xlLmxvZyhlcnIpO1x0XHJcblx0XHR9KTtcclxuXHR9XHJcblx0ZWxzZSB7XHJcblx0XHRjYWxsYmFjayhkYilcclxuXHR9XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xyXG5cdG1peGluczogWyBSb3V0ZXIuU3RhdGUsIFJvdXRlci5OYXZpZ2F0aW9uIF0sXHJcblx0Y29tcG9uZW50V2lsbE1vdW50OiBmdW5jdGlvbigpIHtcclxuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJwYXVzZVwiLCBmdW5jdGlvbigpIHtcclxuXHRcdFx0dGhpcy5zZXRTdGF0ZSh7a2V5OiB1bmRlZmluZWQsIHdyb25nQXR0ZW1wdHM6IDB9KVxyXG5cdFx0fS5iaW5kKHRoaXMpLCBmYWxzZSk7XHJcblxyXG5cdFx0Y3JlYXRlREIobnVsbCwgZnVuY3Rpb24oZGIpIHtcclxuXHRcdFx0dGhpcy5zZXRTdGF0ZSh7XHJcblx0XHRcdFx0a2V5OiB1bmRlZmluZWQsXHJcblx0XHRcdFx0ZGI6IGRiLCBcclxuXHRcdFx0XHR3cm9uZ0F0dGVtcHRzOiAwLFxyXG5cdFx0XHRcdHZlcmlmeUtleTogZmFsc2VcclxuXHRcdFx0fSlcclxuXHRcdH0uYmluZCh0aGlzKSlcclxuXHR9LFxyXG5cdGNvbXBvbmVudFdpbGxVbm1vdW50OiBmdW5jdGlvbigpIHtcclxuXHJcblx0fSxcclxuXHRjcmVhdGVNZXRhZGF0YTogZnVuY3Rpb24oa2V5KSB7XHJcblx0XHR0aGlzLnN0YXRlLmRiLnB1dCh7XHJcblx0XHRcdF9pZDogJ2pvdXJuZXlfbWV0YWRhdGEnLFxyXG5cdFx0XHR2ZXJpZnk6IHNqY2wuZW5jcnlwdChrZXksICdqb3VybmV5IGpvdXJuYWwnKSxcclxuXHRcdFx0bmV4dElkOiAwXHRcdFxyXG5cdFx0fSkudGhlbihmdW5jdGlvbihyZXNwb25zZSkge1xyXG5cdFx0fSkuY2F0Y2goZnVuY3Rpb24oZSkge1xyXG5cdFx0XHRjb25zb2xlLmxvZyhlKVxyXG5cdFx0fSlcclxuXHR9LFxyXG5cdGNsZWFyRGF0YWJhc2VBbmREZWF1dGhlbnRpY2F0ZTogZnVuY3Rpb24oam91cm5hbCkge1xyXG5cdFx0dGhpcy5zdGF0ZS5kYi5kZXN0cm95KCkudGhlbihmdW5jdGlvbigpIHtcclxuXHRcdFx0Y3JlYXRlREIoam91cm5hbCwgZnVuY3Rpb24oZGIpIHtcclxuXHRcdFx0XHR0aGlzLnNldFN0YXRlKHtcclxuXHRcdFx0XHRcdGRiOiBkYixcclxuXHRcdFx0XHRcdGtleTogdW5kZWZpbmVkLFxyXG5cdFx0XHRcdFx0d3JvbmdBdHRlbXB0czogMFxyXG5cdFx0XHRcdH0pXHJcblx0XHRcdFx0dGhpcy50cmFuc2l0aW9uVG8oJ2luZGV4Jyk7XHJcblx0XHRcdH0uYmluZCh0aGlzKSk7XHJcblx0XHR9LmJpbmQodGhpcykpXHJcblx0fSxcclxuXHRzZXRLZXk6IGZ1bmN0aW9uKGtleSkge1xyXG5cdFx0dGhpcy5zdGF0ZS5kYi5nZXQoJ2pvdXJuZXlfbWV0YWRhdGEnKS50aGVuKGZ1bmN0aW9uKGRvYykge1xyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdHZhciByZXN1bHQgPSBzamNsLmRlY3J5cHQoa2V5LCBkb2MudmVyaWZ5KVxyXG5cdFx0XHRcdHRoaXMuc2V0U3RhdGUoe2tleToga2V5fSlcclxuXHRcdFx0fVxyXG5cdFx0XHRjYXRjaChlcnIpIHtcclxuXHRcdFx0XHRpZiAoZXJyLm1lc3NhZ2UgPT09IFwiY2NtOiB0YWcgZG9lc24ndCBtYXRjaFwiKSB7XHJcblx0XHRcdFx0XHR0aGlzLnNldFN0YXRlKHtcclxuXHRcdFx0XHRcdFx0d3JvbmdBdHRlbXB0czogdGhpcy5zdGF0ZS53cm9uZ0F0dGVtcHRzKzFcclxuXHRcdFx0XHRcdH0pXHJcblx0XHRcdFx0XHRhbGVydGlmeS5lcnJvcignV3JvbmchJywgMSlcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0ZWxzZSB7XHJcblx0XHRcdFx0XHRjb25zb2xlLmxvZyhlcnIuc3RhY2spO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdH0uYmluZCh0aGlzKSkuY2F0Y2goZnVuY3Rpb24oZSkge1xyXG5cdFx0XHRpZiAoZS5zdGF0dXM9PT00MDQpIHtcclxuXHRcdFx0XHRpZiAoIXRoaXMuc3RhdGUudmVyaWZ5S2V5KSB7XHJcblx0XHRcdFx0XHR0aGlzLnNldFN0YXRlKHt3cm9uZ0F0dGVtcHRzOiAwLCB2ZXJpZnlLZXk6IGtleX0pXHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGVsc2Uge1xyXG5cdFx0XHRcdFx0aWYgKGtleSA9PT0gdGhpcy5zdGF0ZS52ZXJpZnlLZXkpIHtcclxuXHRcdFx0XHRcdFx0dGhpcy5jcmVhdGVNZXRhZGF0YShrZXkpXHJcblx0XHRcdFx0XHRcdHRoaXMuc2V0U3RhdGUoe2tleToga2V5fSlcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGVsc2Uge1xyXG5cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdHRoaXMuc2V0U3RhdGUoe3ZlcmlmeUtleTogZmFsc2V9KTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdFx0ZWxzZSB7XHJcblx0XHRcdFx0Y29uc29sZS5sb2coZSlcclxuXHRcdFx0fVxyXG5cdFx0fS5iaW5kKHRoaXMpKVxyXG5cdH0sXHJcblx0cmVuZGVyOiBmdW5jdGlvbigpIHtcclxuXHRcdHZhciBoYW5kbGVyID0gPFJvdXRlSGFuZGxlciBkYj17dGhpcy5zdGF0ZS5kYn0gZm9vPVwiYmFyXCIgYXV0aGtleT17dGhpcy5zdGF0ZS5rZXl9IGNsZWFyRGF0YWJhc2VBbmREZWF1dGhlbnRpY2F0ZT17dGhpcy5jbGVhckRhdGFiYXNlQW5kRGVhdXRoZW50aWNhdGV9IC8+XHJcblxyXG5cdFx0aWYgKCF0aGlzLnN0YXRlLmtleSkge1xyXG5cdFx0XHRoYW5kbGVyID0gPEF1dGhlbnRpY2F0ZSBvbkF1dGhlbnRpY2F0ZWQ9e3RoaXMuc2V0S2V5fSB3cm9uZ0F0dGVtcHRzPXt0aGlzLnN0YXRlLndyb25nQXR0ZW1wdHN9IHZlcmlmeUtleT17dGhpcy5zdGF0ZS52ZXJpZnlLZXl9IGNsZWFyRGF0YWJhc2VBbmREZWF1dGhlbnRpY2F0ZT17dGhpcy5jbGVhckRhdGFiYXNlQW5kRGVhdXRoZW50aWNhdGV9Lz5cclxuXHRcdH1cclxuXHJcblx0XHRcclxuXHRcdHJldHVybiAoXHJcblx0XHRcdDxkaXY+XHJcblx0XHRcdFx0PG1haW4+XHJcblx0XHRcdFx0XHR7aGFuZGxlcn1cclxuXHRcdFx0XHQ8L21haW4+XHJcblx0XHRcdDwvZGl2PlxyXG5cdFx0KTtcclxuXHR9XHJcbn0pO1xyXG5cclxuIiwidmFyIFJlYWN0ID0gcmVxdWlyZSgncmVhY3QvYWRkb25zJyk7XHJcbnZhciBSb3V0ZXIgPSByZXF1aXJlKCdyZWFjdC1yb3V0ZXInKTtcclxudmFyIFJvdXRlSGFuZGxlciA9IFJvdXRlci5Sb3V0ZUhhbmRsZXI7XHJcbnZhciBkZWNyeXB0ID0gcmVxdWlyZSgnLi4vdXRpbGl0aWVzL2RlY3J5cHRFbnRyeScpXHJcbnZhciBhbGVydGlmeSA9IHJlcXVpcmUoJ2FsZXJ0aWZ5anMnKVxyXG5cclxudmFyIEdhcGkgPSByZXF1aXJlKCcuLi9jb21wb25lbnRzL2dhcGknKVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XHJcblx0bWl4aW5zOiBbIFJvdXRlci5TdGF0ZSwgUm91dGVyLk5hdmlnYXRpb25dLFxyXG5cdHRyYW5zaXRpb25Ub0luZGV4OiBmdW5jdGlvbigpIHtcclxuXHRcdHRoaXMudHJhbnNpdGlvblRvKCdpbmRleCcpO1xyXG5cdH0sXHJcblx0Z2V0SW5pdGlhbFN0YXRlOiBmdW5jdGlvbigpIHtcclxuXHRcdHJldHVybiB7XHJcblx0XHRcdGpzb246ICcnXHJcblx0XHR9XHJcblx0fSxcclxuXHRleHBvcnRGaWxlOiBmdW5jdGlvbihkZWNyeXB0ZWQpIHtcclxuXHRcdHRoaXMucHJvcHMuZGIuYWxsRG9jcyh7XHJcblx0XHRcdGluY2x1ZGVfZG9jczogdHJ1ZSxcclxuXHRcdH0pLnRoZW4oZnVuY3Rpb24ocmVzdWx0cykge1xyXG5cdFx0XHR2YXIgcmVzdWx0cyA9IHJlc3VsdHMucm93cy5maWx0ZXIoZnVuY3Rpb24ocm93KSB7XHJcblx0XHRcdFx0cmV0dXJuICFkZWNyeXB0ZWQgfHwgcm93LmlkICE9PSAnam91cm5leV9tZXRhZGF0YSdcclxuXHRcdFx0fSkubWFwKGZ1bmN0aW9uKGRvYyl7XHJcblx0XHRcdFx0dmFyIGVudHJ5ID0gZG9jLmRvYztcclxuXHRcdFx0XHRpZiAoZGVjcnlwdGVkKSB7XHJcblx0XHRcdFx0XHRkZWNyeXB0KHRoaXMucHJvcHMuYXV0aGtleSwgZG9jLmRvYyk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGVudHJ5LmlkID0gdW5kZWZpbmVkO1xyXG5cdFx0XHRcdGVudHJ5LnJldiA9IHVuZGVmaW5lZFxyXG5cdFx0XHRcdHJldHVybiBlbnRyeVxyXG5cdFx0XHR9LmJpbmQodGhpcykpO1xyXG5cclxuXHRcdFx0dmFyIGpzb24gPSBKU09OLnN0cmluZ2lmeShyZXN1bHRzKTtcclxuXHRcdFx0dGhpcy5zZXRTdGF0ZSh7anNvbjoganNvbn0pO1xyXG5cdFx0fS5iaW5kKHRoaXMpKVxyXG5cdFx0LmNhdGNoKGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0Y29uc29sZS5sb2coZSk7XHJcblx0XHR9KTtcclxuXHR9LFxyXG5cdGRlbGV0ZUpvdXJuYWw6IGZ1bmN0aW9uKCkge1xyXG5cdFx0dmFyIG1lc3NhZ2UgPSBcIkFyZSB5b3Ugc3VyZT9cXG5UaGlzIGNhbm5vdCBiZSB1bmRvbmUhXCJcclxuXHRcdGFsZXJ0aWZ5LmNvbmZpcm0obWVzc2FnZSkuc2V0KCd0aXRsZScsICdEZWxldGUgSm91cm5hbCcpLnNldCgnbGFiZWxzJywge29rOidZZXMnLCBjYW5jZWw6J05vJ30pLnNldCgnb25vaycsIGZ1bmN0aW9uKCl7XHJcblx0XHRcdHRoaXMucHJvcHMuY2xlYXJEYXRhYmFzZUFuZERlYXV0aGVudGljYXRlKCk7XHJcblx0XHR9LmJpbmQodGhpcykpXHJcblx0fSxcclxuXHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xyXG5cdFx0dmFyIHJvdXRlID0gdGhpcy5nZXRSb3V0ZXMoKTtcclxuXHRcdFxyXG5cdFx0cmV0dXJuIChcclxuXHRcdFx0PGRpdiBjbGFzc05hbWU9XCJqb3VybmV5X2NvbnRhaW5lclwiPlxyXG5cdFx0XHRcdDxkaXYgY2xhc3NOYW1lPVwiam91cm5leV90b29sYmFyIGVudHJ5X3RvcFwiPlxyXG5cdFx0XHRcdFx0PGRpdiBjbGFzc05hbWU9XCJlbnRyeV9iYWNrXCIgb25DbGljaz17dGhpcy50cmFuc2l0aW9uVG9JbmRleH0+XHJcblx0XHRcdFx0XHRcdCYjODU5MjsgYmFja1xyXG5cdFx0XHRcdFx0PC9kaXY+XHJcblx0XHRcdFx0PC9kaXY+XHJcblx0XHRcdFx0PGRpdiBjbGFzc05hbWU9XCJjb250ZW50XCI+XHJcblxyXG5cdFx0XHRcdFx0PEdhcGkgZGI9e3RoaXMucHJvcHMuZGJ9PjwvR2FwaT5cclxuXHJcblx0XHRcdFx0XHQ8YnV0dG9uIG9uQ2xpY2s9e3RoaXMuZXhwb3J0RmlsZS5iaW5kKHRoaXMsIGZhbHNlKX0+RXhwb3J0IHRvIGpzb24gKGVuY3J5cHRlZCk8L2J1dHRvbj48YnIgLz5cclxuXHRcdFx0XHRcdDxidXR0b24gb25DbGljaz17dGhpcy5leHBvcnRGaWxlLmJpbmQodGhpcywgdHJ1ZSl9PkV4cG9ydCB0byBqc29uIChkZWNyeXB0ZWQpPC9idXR0b24+PGJyIC8+XHJcblxyXG5cdFx0XHRcdFx0PGJ1dHRvbiBvbkNsaWNrPXt0aGlzLmRlbGV0ZUpvdXJuYWx9PkRlbGV0ZSBqb3VybmFsPC9idXR0b24+XHJcblxyXG5cdFx0XHRcdFx0PHRleHRhcmVhIGNsYXNzTmFtZT1cImpzb25WaWV3XCIgdmFsdWU9e3RoaXMuc3RhdGUuanNvbn0+PC90ZXh0YXJlYT5cclxuXHRcdFx0XHQ8L2Rpdj5cclxuXHRcdFx0PC9kaXY+XHJcblx0XHQpO1xyXG5cdH1cclxufSk7XHJcbiIsInZhciBSZWFjdCA9IHJlcXVpcmUoJ3JlYWN0L2FkZG9ucycpO1xyXG52YXIgUm91dGVyID0gcmVxdWlyZSgncmVhY3Qtcm91dGVyJyk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcclxuXHRzdWJtaXQ6IGZ1bmN0aW9uKGUpIHtcclxuXHRcdGlmIChlLmtleUNvZGU9PT0xMykge1xyXG5cdFx0XHR2YXIgZWxlbWVudCA9IHRoaXMucmVmcy5wYXNzd29yZC5nZXRET01Ob2RlKClcclxuXHRcdFx0dGhpcy5wcm9wcy5vbkF1dGhlbnRpY2F0ZWQoZWxlbWVudC52YWx1ZSlcclxuXHRcdFx0ZWxlbWVudC52YWx1ZSA9ICcnXHJcblx0XHR9XHJcblx0fSxcclxuXHRyZXNldERhdGFiYXNlOiBmdW5jdGlvbigpIHtcclxuXHRcdHRoaXMucHJvcHMuY2xlYXJEYXRhYmFzZUFuZERlYXV0aGVudGljYXRlKClcclxuXHRcdGFsZXJ0aWZ5LmVycm9yKCdKb3VybmFsIHJlc2V0IScsIDEpXHJcblx0fSxcclxuXHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xyXG5cdFx0dmFyIHBsYWNlaG9sZGVyID0gKHRoaXMucHJvcHMudmVyaWZ5S2V5KSA/ICd2ZXJpZnkgcGFzc3dvcmQnIDogJ2VudGVyIGEgcGFzc3dvcmQnIFxyXG5cclxuXHRcdHZhciByZXNldHB3ID0gKHRoaXMucHJvcHMud3JvbmdBdHRlbXB0cyA+PSAzKSA/IDxkaXYgb25DbGljaz17dGhpcy5yZXNldERhdGFiYXNlfSBjbGFzc05hbWU9XCJyZXNldF9wYXNzd29yZF9idXR0b25cIj48cD5mb3Jnb3QgeW91ciBwYXNzd29yZD88L3A+PHA+Y2xpY2sgaGVyZSB0byBkZWxldGUgdGhlIGpvdXJuYWwgYW5kIHN0YXJ0IG92ZXI8L3A+PC9kaXY+IDogdW5kZWZpbmVkXHJcblxyXG5cdFx0cmV0dXJuICg8ZGl2IGNsYXNzTmFtZT1cImF1dGhfd3JhcHBlclwiPlxyXG5cdFx0XHRcdDxkaXY+XHJcblx0XHRcdFx0XHQ8aSBjbGFzc05hbWU9XCJmYSBmYS1sb2NrXCI+PC9pPlxyXG5cdFx0XHRcdFx0PGlucHV0IHBsYWNlaG9sZGVyPXtwbGFjZWhvbGRlcn0gdHlwZT1cInBhc3N3b3JkXCIgYXV0b0ZvY3VzPVwidHJ1ZVwiIHJlZj1cInBhc3N3b3JkXCIgb25LZXlEb3duPXt0aGlzLnN1Ym1pdH0vPlxyXG5cdFx0XHRcdDwvZGl2PlxyXG5cdFx0XHRcdHtyZXNldHB3fVxyXG5cdFx0PC9kaXY+KVxyXG5cdH1cclxufSk7XHJcbiIsInZhciBSZWFjdCA9IHJlcXVpcmUoJ3JlYWN0L2FkZG9ucycpO1xyXG52YXIgUm91dGVyID0gcmVxdWlyZSgncmVhY3Qtcm91dGVyJyk7XHJcbnZhciBSb3V0ZUhhbmRsZXIgPSBSb3V0ZXIuUm91dGVIYW5kbGVyO1xyXG52YXIgY29uZmlybUF1dGhvcml6ZWQgPSByZXF1aXJlKCcuLi91dGlsaXRpZXMvY29uZmlybUF1dGhvcml6ZWQnKVxyXG52YXIgYWxlcnRpZnkgPSByZXF1aXJlKCdhbGVydGlmeWpzJylcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xyXG5cdG1peGluczogWyBSb3V0ZXIuU3RhdGUsIFJvdXRlci5OYXZpZ2F0aW9uIF0sXHJcblx0Z2V0SW5pdGlhbFN0YXRlOiBmdW5jdGlvbigpIHtcclxuXHRcdHJldHVybiB7XHJcblx0XHRcdGZpbGVzOiBbXSxcclxuXHRcdFx0bG9hZGluZzogdHJ1ZVxyXG5cdFx0fVxyXG5cdH0sXHJcblx0Y29tcG9uZW50V2lsbE1vdW50OiBmdW5jdGlvbigpIHtcclxuXHRcdHZhciBmaWxlTGlzdFJlY2VpdmVkID0gZnVuY3Rpb24oZmlsZXMpIHtcclxuXHRcdFx0aWYgKGZpbGVzLmxlbmd0aCA9PSAwKSB7XHJcblx0XHRcdFx0dmFyIG1lc3NhZ2UgPSBcIk5vIGZpbGVzIGluIERyaXZlXCJcclxuXHRcdFx0XHRhbGVydGlmeS5hbGVydChtZXNzYWdlKS5zZXQoJ3RpdGxlJywgJ0luZm8nKS5zZXQoJ29ub2snLCBmdW5jdGlvbigpe1xyXG5cdFx0XHRcdFx0dGhpcy50cmFuc2l0aW9uVG8oJ3NldHRpbmdzJyk7XHJcblx0XHRcdFx0fS5iaW5kKHRoaXMpKVxyXG5cclxuXHRcdFx0fVxyXG5cdFx0XHR0aGlzLnNldFN0YXRlKHtmaWxlczogZmlsZXMuc29ydChmdW5jdGlvbihhLGIpIHtcclxuXHRcdFx0XHRyZXR1cm4gYSA8IGIgPyAxIDogMFxyXG5cdFx0XHR9KSwgbG9hZGluZzogZmFsc2V9KVxyXG5cdFx0fS5iaW5kKHRoaXMpXHJcblxyXG5cdFx0dmFyIHJldHJpZXZlUGFnZU9mRmlsZXMgPSBmdW5jdGlvbihyZXF1ZXN0LCByZXN1bHQpIHtcclxuXHRcdFx0cmVxdWVzdC5leGVjdXRlKGZ1bmN0aW9uKHJlc3ApIHtcclxuXHRcdFx0XHRyZXN1bHQgPSByZXN1bHQuY29uY2F0KHJlc3AuaXRlbXMpO1xyXG5cdFx0XHRcdHZhciBuZXh0UGFnZVRva2VuID0gcmVzcC5uZXh0UGFnZVRva2VuO1xyXG5cdFx0XHRcdGlmIChuZXh0UGFnZVRva2VuKSB7XHJcblx0XHRcdFx0XHRyZXF1ZXN0ID0gZ2FwaS5jbGllbnQuZHJpdmUuZmlsZXMubGlzdCh7XHJcblx0XHRcdFx0XHRcdCdwYWdlVG9rZW4nOiBuZXh0UGFnZVRva2VuXHJcblx0XHRcdFx0XHR9KTtcclxuXHRcdFx0XHRcdHJldHJpZXZlUGFnZU9mRmlsZXMocmVxdWVzdCwgcmVzdWx0KTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0ZmlsZUxpc3RSZWNlaXZlZChyZXN1bHQpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblx0XHR9XHJcblxyXG5cdFx0Y29uZmlybUF1dGhvcml6ZWQoZnVuY3Rpb24oKSB7XHJcblx0XHRcdHZhciBpbml0aWFsUmVxdWVzdCA9IGdhcGkuY2xpZW50LmRyaXZlLmZpbGVzLmxpc3Qoe1xyXG5cdFx0XHRcdCdxJzogJ1xcJ2FwcGZvbGRlclxcJyBpbiBwYXJlbnRzJ1xyXG5cdFx0XHR9KTtcclxuXHRcdFx0cmV0cmlldmVQYWdlT2ZGaWxlcyhpbml0aWFsUmVxdWVzdCwgW10pO1xyXG5cdFx0fSk7XHJcblx0fSxcclxuXHRyZXN0b3JlRnJvbUZpbGU6IGZ1bmN0aW9uKGZpbGUpIHtcclxuXHRcdGdldEZpbGUoZmlsZSwgZnVuY3Rpb24oZGF0YSkge1xyXG5cdFx0XHR2YXIgam91cm5hbCA9IEpTT04ucGFyc2UoZGF0YSkubWFwKGZ1bmN0aW9uKGRvYyl7XHJcblx0XHRcdFx0ZGVsZXRlIGRvYy5fcmV2XHJcblx0XHRcdFx0cmV0dXJuIGRvY1xyXG5cdFx0XHR9KVxyXG5cdFx0XHR0aGlzLnByb3BzLmNsZWFyRGF0YWJhc2VBbmREZWF1dGhlbnRpY2F0ZShqb3VybmFsKTtcclxuXHRcdH0uYmluZCh0aGlzKSlcclxuXHR9LFxyXG5cdGRlbGV0ZUZpbGU6IGZ1bmN0aW9uKGZpbGUpIHtcclxuXHRcdHZhciBtZXNzYWdlID0gXCJBcmUgeW91IHN1cmU/XFxuVGhpcyBjYW5ub3QgYmUgdW5kb25lIVwiXHJcblx0XHRhbGVydGlmeS5jb25maXJtKG1lc3NhZ2UpLnNldCgndGl0bGUnLCAnRGVsZXRlIEpvdXJuYWwnKS5zZXQoJ2xhYmVscycsIHtvazonWWVzJywgY2FuY2VsOidObyd9KS5zZXQoJ29ub2snLCBmdW5jdGlvbigpe1xyXG5cdFx0XHRmaWxlLmRlbGV0aW5nID0gdHJ1ZTtcclxuXHRcdFx0dGhpcy5zZXRTdGF0ZSh7ZmlsZXM6IHRoaXMuc3RhdGUuZmlsZXN9KVxyXG5cdFx0XHRjb25maXJtQXV0aG9yaXplZChmdW5jdGlvbigpIHtcclxuXHRcdFx0XHRnYXBpLmNsaWVudC5kcml2ZS5maWxlcy5kZWxldGUoe2ZpbGVJZDpmaWxlLmlkfSkuZXhlY3V0ZShmdW5jdGlvbigpIHtcclxuXHRcdFx0XHRcdHZhciBmaWxlcyA9IHRoaXMuc3RhdGUuZmlsZXMuZmlsdGVyKGZ1bmN0aW9uKGYpIHtcclxuXHRcdFx0XHRcdFx0cmV0dXJuIGYuaWQgIT09IGZpbGUuaWRcdFx0XHRcdFx0ICAgXHJcblx0XHRcdFx0XHR9KVxyXG5cdFx0XHRcdFx0dGhpcy5zZXRTdGF0ZSh7ZmlsZXM6IGZpbGVzfSlcclxuXHRcdFx0XHR9LmJpbmQodGhpcykpXHJcblx0XHRcdH0uYmluZCh0aGlzKSk7XHJcblx0XHR9LmJpbmQodGhpcykpXHJcblx0fSxcclxuXHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xyXG5cdFx0dmFyIGZpbGVCdXR0b25zID0gdGhpcy5zdGF0ZS5sb2FkaW5nID09PSBmYWxzZSA/IChcclxuXHRcdFx0PGRpdj5cclxuXHRcdFx0e3RoaXMuc3RhdGUuZmlsZXMubWFwKGZ1bmN0aW9uKGZpbGUpIHtcclxuXHRcdFx0XHRyZXR1cm4gPGRpdiBjbGFzc05hbWU9XCJidXR0b25Hcm91cFwiIGtleT17ZmlsZS5pZH0gPlxyXG5cdFx0XHRcdFx0PGJ1dHRvbiBjbGFzc05hbWU9XCJyZXN0b3JlX2J0blwiIG9uQ2xpY2s9e3RoaXMucmVzdG9yZUZyb21GaWxlLmJpbmQodGhpcywgZmlsZSl9PntmaWxlLnRpdGxlfTwvYnV0dG9uPlxyXG5cdFx0XHRcdFx0PGJ1dHRvbiBjbGFzc05hbWU9e1wiZGVsZXRlX2J0blwiKyhmaWxlLmRlbGV0aW5nID8gJyBkZWxldGluZycgOiAnJyl9IG9uQ2xpY2s9e3RoaXMuZGVsZXRlRmlsZS5iaW5kKHRoaXMsIGZpbGUpfT5EZWxldGU8L2J1dHRvbj5cclxuXHRcdFx0XHQ8L2Rpdj5cdFx0XHRcdFx0XHRcdFx0XHQgIFxyXG5cdFx0XHR9LmJpbmQodGhpcykpfSBcclxuXHRcdFx0PC9kaXY+XHJcblx0ICAgKSA6IDxwPkxvYWRpbmc8L3A+XHJcblx0XHRcclxuXHRcdHJldHVybiAoXHJcblx0XHRcdDxkaXYgY2xhc3NOYW1lPVwiam91cm5leV9jb250YWluZXJcIj5cclxuXHRcdFx0XHQ8ZGl2IGNsYXNzTmFtZT1cInJlc3RvcmVfc2NyZWVuXCI+XHJcblx0XHRcdFx0XHR7ZmlsZUJ1dHRvbnN9XHJcblx0XHRcdFx0PC9kaXY+XHJcblx0XHRcdDwvZGl2PlxyXG5cdFx0KTtcclxuXHR9XHJcbn0pO1xyXG5cclxuXHJcbmZ1bmN0aW9uIGdldEZpbGUoZmlsZSwgY2FsbGJhY2spIHtcclxuXHRnYXBpLmNsaWVudC5kcml2ZS5maWxlcy5nZXQoe1xyXG5cdFx0ZmlsZUlkOiBmaWxlLmlkLFxyXG5cdFx0YWx0OidtZWRpYSdcclxuXHR9KS5leGVjdXRlKGZ1bmN0aW9uKHJlc3BvbnNlKSB7XHJcblx0XHRjYWxsYmFjayhyZXNwb25zZSlcclxuXHR9KVxyXG59XHJcbiIsInZhciBpbmZvID0ge1xyXG5cdGNsaWVudF9pZDogJzI1Njc0NTcxOTIwNC1hdmdkNzU0MzFvdGk0b3JsMjl0NTJtanFyOTNidTNkNS5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbScsXHJcblx0c2NvcGU6ICdodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9hdXRoL2RyaXZlLmFwcGZvbGRlcidcclxufVxyXG52YXIgZ2FwaUNvbmZpZyA9IHtcclxuXHRhdXRoX3VyaTogJ2h0dHBzOi8vYWNjb3VudHMuZ29vZ2xlLmNvbS9vL29hdXRoMi9hdXRoJyxcclxuXHR0b2tlbl91cmk6ICdodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20vby9vYXV0aDIvdG9rZW4nLFxyXG5cdHJlZGlyZWN0X3VyaTogJ2h0dHA6Ly9kZXNsZWUubWU6ODAwMC9jb2RlJ1xyXG59O1xyXG5cclxudmFyIGxvZ2luV2luZG93O1xyXG5cclxuZnVuY3Rpb24gb3BlbkxvZ2luKGNhbGxiYWNrKSB7XHJcblx0dmFyIGxvZ2luX3VybCA9IGdhcGlDb25maWcuYXV0aF91cmlcclxuXHQrICc/Y2xpZW50X2lkPScgKyBpbmZvLmNsaWVudF9pZFxyXG5cdCsgJyZyZWRpcmVjdF91cmk9JyArIGdhcGlDb25maWcucmVkaXJlY3RfdXJpXHJcblx0KyAnJnJlc3BvbnNlX3R5cGU9Y29kZSdcclxuXHQrICcmc2NvcGU9JyArIGluZm8uc2NvcGU7XHJcblxyXG5cdGxvZ2luV2luZG93ID0gd2luZG93Lm9wZW4obG9naW5fdXJsLCAnX2JsYW5rJywgJ2xvY2F0aW9uPXllcycpO1xyXG5cdGxvZ2luV2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWRzdG9wJywgZnVuY3Rpb24oZSkge1xyXG5cdFx0Y29uc29sZS5sb2coZSk7XHJcblx0XHR2YXIgdXJsID0gZS51cmxcclxuXHRcdHZhciBjb2RlID0gL1xcP2NvZGU9KC4rKSQvLmV4ZWModXJsKTtcclxuXHRcdHZhciBlcnJvciA9IC9cXD9lcnJvcj0oLispJC8uZXhlYyh1cmwpO1xyXG5cdFx0Y29uc29sZS5sb2coY29kZSwgZXJyb3IpXHJcblxyXG5cdFx0aWYgKGNvZGUpIHtcclxuXHRcdFx0bG9naW5XaW5kb3cuZXhlY3V0ZVNjcmlwdCh7Y29kZTogXCJkb2N1bWVudC5ib2R5LmlubmVySFRNTFwifSwgZnVuY3Rpb24odmFsdWVzKXtcclxuXHRcdFx0XHR2YXIgdG9rZW4gPSBKU09OLnBhcnNlKHZhbHVlc1swXSlcclxuXHRcdFx0XHRsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgndG9rZW4nLCB0b2tlbilcclxuXHRcdFx0XHRsb2dpbldpbmRvdy5jbG9zZSgpXHJcblx0XHRcdFx0Z2FwaS5hdXRoLnNldFRva2VuKHRva2VuKVxyXG5cdFx0XHRcdGNhbGxiYWNrKClcclxuXHRcdFx0fSlcclxuXHRcdH1cclxuXHRcdGlmIChlcnJvcikge1xyXG5cdFx0XHQvLyBoYW5kbGUgZXJyb3IgVE9ET1xyXG5cdFx0XHRsb2dpbldpbmRvdy5jbG9zZSgpO1xyXG5cdFx0fVxyXG5cclxuXHR9LCBmYWxzZSlcclxufVxyXG5cclxuXHJcbmZ1bmN0aW9uIGNvbmZpcm1BdXRob3JpemVkKGNhbGxiYWNrKSB7XHJcblxyXG5cdGlmIChkZXZpY2UucGxhdGZvcm0gPT09IFwiYnJvd3NlclwiKSB7XHJcblx0XHR2YXIgaGFuZGxlX2F1dGhvcml6YXRpb25fcmVzdWx0ID0gZnVuY3Rpb24oYXV0aFJlc3VsdCkge1xyXG5cdFx0XHRpZiAoYXV0aFJlc3VsdCAmJiAhYXV0aFJlc3VsdC5lcnJvcikge1xyXG5cdFx0XHRcdGdhcGkuY2xpZW50LmxvYWQoJ2RyaXZlJywgJ3YyJywgZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0XHRjYWxsYmFjaygpXHJcblx0XHRcdFx0fSlcclxuXHRcdFx0fVxyXG5cdFx0XHRlbHNlIHtcclxuXHRcdFx0XHRpbmZvLmltbWVkaWF0ZSA9IGZhbHNlO1xyXG5cdFx0XHRcdGdhcGkuYXV0aC5hdXRob3JpemUoaW5mbywgaGFuZGxlX2F1dGhvcml6YXRpb25fcmVzdWx0KTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdGdhcGkubG9hZCgnY2xpZW50JywgZnVuY3Rpb24oKSB7XHJcblx0XHRcdGluZm8uaW1tZWRpYXRlID0gdHJ1ZVxyXG5cdFx0XHRnYXBpLmF1dGguYXV0aG9yaXplKGluZm8sIGhhbmRsZV9hdXRob3JpemF0aW9uX3Jlc3VsdCk7XHJcblx0XHR9LmJpbmQodGhpcykpO1xyXG5cdH1cclxuXHRlbHNlIHtcclxuXHRcdGlmICghbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ3Rva2VuJykpIHtcclxuXHRcdFx0Z2FwaS5sb2FkKCdhdXRoJywgZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0Z2FwaS5sb2FkKCdjbGllbnQnLCBmdW5jdGlvbigpIHtcclxuXHRcdFx0XHRcdGdhcGkuY2xpZW50LmxvYWQoJ2RyaXZlJywgJ3YyJywgZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0XHRcdG9wZW5Mb2dpbihjYWxsYmFjayk7XHJcblx0XHRcdFx0XHR9KVxyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdH1cclxuXHRcdGVsc2Uge1xyXG5cdFx0XHRnYXBpLmxvYWQoJ2NsaWVudCcsIGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRcdGdhcGkuY2xpZW50LmxvYWQoJ2RyaXZlJywgJ3YyJywgZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0XHRjYWxsYmFjaygpO1xyXG5cdFx0XHRcdH0pXHJcblx0XHRcdH0pO1xyXG5cdFx0fVxyXG5cdH1cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBjb25maXJtQXV0aG9yaXplZFxyXG5cclxuIiwibW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICBjb252ZXJ0OmZ1bmN0aW9uKGQpIHtcclxuICAgICAgICAvLyBDb252ZXJ0cyB0aGUgZGF0ZSBpbiBkIHRvIGEgZGF0ZS1vYmplY3QuIFRoZSBpbnB1dCBjYW4gYmU6XHJcbiAgICAgICAgLy8gICBhIGRhdGUgb2JqZWN0OiByZXR1cm5lZCB3aXRob3V0IG1vZGlmaWNhdGlvblxyXG4gICAgICAgIC8vICBhbiBhcnJheSAgICAgIDogSW50ZXJwcmV0ZWQgYXMgW3llYXIsbW9udGgsZGF5XS4gTk9URTogbW9udGggaXMgMC0xMS5cclxuICAgICAgICAvLyAgIGEgbnVtYmVyICAgICA6IEludGVycHJldGVkIGFzIG51bWJlciBvZiBtaWxsaXNlY29uZHNcclxuICAgICAgICAvLyAgICAgICAgICAgICAgICAgIHNpbmNlIDEgSmFuIDE5NzAgKGEgdGltZXN0YW1wKSBcclxuICAgICAgICAvLyAgIGEgc3RyaW5nICAgICA6IEFueSBmb3JtYXQgc3VwcG9ydGVkIGJ5IHRoZSBqYXZhc2NyaXB0IGVuZ2luZSwgbGlrZVxyXG4gICAgICAgIC8vICAgICAgICAgICAgICAgICAgXCJZWVlZL01NL0REXCIsIFwiTU0vREQvWVlZWVwiLCBcIkphbiAzMSAyMDA5XCIgZXRjLlxyXG4gICAgICAgIC8vICBhbiBvYmplY3QgICAgIDogSW50ZXJwcmV0ZWQgYXMgYW4gb2JqZWN0IHdpdGggeWVhciwgbW9udGggYW5kIGRhdGVcclxuICAgICAgICAvLyAgICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXMuICAqKk5PVEUqKiBtb250aCBpcyAwLTExLlxyXG4gICAgICAgIHJldHVybiAoXHJcbiAgICAgICAgICAgIGQuY29uc3RydWN0b3IgPT09IERhdGUgPyBkIDpcclxuICAgICAgICAgICAgZC5jb25zdHJ1Y3RvciA9PT0gQXJyYXkgPyBuZXcgRGF0ZShkWzBdLGRbMV0sZFsyXSkgOlxyXG4gICAgICAgICAgICBkLmNvbnN0cnVjdG9yID09PSBOdW1iZXIgPyBuZXcgRGF0ZShkKSA6XHJcbiAgICAgICAgICAgIGQuY29uc3RydWN0b3IgPT09IFN0cmluZyA/IG5ldyBEYXRlKGQpIDpcclxuICAgICAgICAgICAgdHlwZW9mIGQgPT09IFwib2JqZWN0XCIgPyBuZXcgRGF0ZShkLnllYXIsZC5tb250aCxkLmRhdGUpIDpcclxuICAgICAgICAgICAgTmFOXHJcbiAgICAgICAgKTtcclxuICAgIH0sXHJcbiAgICBjb21wYXJlOmZ1bmN0aW9uKGEsYikge1xyXG4gICAgICAgIC8vIENvbXBhcmUgdHdvIGRhdGVzIChjb3VsZCBiZSBvZiBhbnkgdHlwZSBzdXBwb3J0ZWQgYnkgdGhlIGNvbnZlcnRcclxuICAgICAgICAvLyBmdW5jdGlvbiBhYm92ZSkgYW5kIHJldHVybnM6XHJcbiAgICAgICAgLy8gIC0xIDogaWYgYSA8IGJcclxuICAgICAgICAvLyAgIDAgOiBpZiBhID0gYlxyXG4gICAgICAgIC8vICAgMSA6IGlmIGEgPiBiXHJcbiAgICAgICAgLy8gTmFOIDogaWYgYSBvciBiIGlzIGFuIGlsbGVnYWwgZGF0ZVxyXG4gICAgICAgIC8vIE5PVEU6IFRoZSBjb2RlIGluc2lkZSBpc0Zpbml0ZSBkb2VzIGFuIGFzc2lnbm1lbnQgKD0pLlxyXG4gICAgICAgIHJldHVybiAoXHJcbiAgICAgICAgICAgIGlzRmluaXRlKGE9dGhpcy5jb252ZXJ0KGEpLnZhbHVlT2YoKSkgJiZcclxuICAgICAgICAgICAgaXNGaW5pdGUoYj10aGlzLmNvbnZlcnQoYikudmFsdWVPZigpKSA/XHJcbiAgICAgICAgICAgIChhPmIpLShhPGIpIDpcclxuICAgICAgICAgICAgTmFOXHJcbiAgICAgICAgKTtcclxuICAgIH0sXHJcbiAgICBpblJhbmdlOmZ1bmN0aW9uKGQsc3RhcnQsZW5kKSB7XHJcbiAgICAgICAgLy8gQ2hlY2tzIGlmIGRhdGUgaW4gZCBpcyBiZXR3ZWVuIGRhdGVzIGluIHN0YXJ0IGFuZCBlbmQuXHJcbiAgICAgICAgLy8gUmV0dXJucyBhIGJvb2xlYW4gb3IgTmFOOlxyXG4gICAgICAgIC8vICAgIHRydWUgIDogaWYgZCBpcyBiZXR3ZWVuIHN0YXJ0IGFuZCBlbmQgKGluY2x1c2l2ZSlcclxuICAgICAgICAvLyAgICBmYWxzZSA6IGlmIGQgaXMgYmVmb3JlIHN0YXJ0IG9yIGFmdGVyIGVuZFxyXG4gICAgICAgIC8vICAgIE5hTiAgIDogaWYgb25lIG9yIG1vcmUgb2YgdGhlIGRhdGVzIGlzIGlsbGVnYWwuXHJcbiAgICAgICAgLy8gTk9URTogVGhlIGNvZGUgaW5zaWRlIGlzRmluaXRlIGRvZXMgYW4gYXNzaWdubWVudCAoPSkuXHJcbiAgICAgICByZXR1cm4gKFxyXG4gICAgICAgICAgICBpc0Zpbml0ZShkPXRoaXMuY29udmVydChkKS52YWx1ZU9mKCkpICYmXHJcbiAgICAgICAgICAgIGlzRmluaXRlKHN0YXJ0PXRoaXMuY29udmVydChzdGFydCkudmFsdWVPZigpKSAmJlxyXG4gICAgICAgICAgICBpc0Zpbml0ZShlbmQ9dGhpcy5jb252ZXJ0KGVuZCkudmFsdWVPZigpKSA/XHJcbiAgICAgICAgICAgIHN0YXJ0IDw9IGQgJiYgZCA8PSBlbmQgOlxyXG4gICAgICAgICAgICBOYU5cclxuICAgICAgICApO1xyXG4gICAgfVxyXG59XHJcbiIsInZhciBzamNsID0gcmVxdWlyZSgnc2pjbCcpXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGtleSwgZW50cnkpIHtcclxuXHRlbnRyeS5jb250ZW50ID0gc2pjbC5kZWNyeXB0KGtleSwgZW50cnkuY29udGVudClcclxuXHRlbnRyeS50aXRsZSA9IGVudHJ5LmNvbnRlbnQuc3BsaXQoJ1xcbicpWzBdXHJcblx0ZW50cnkudGFncyA9IHNqY2wuZGVjcnlwdChrZXksIGVudHJ5LnRhZ3MpLnNwbGl0KCcsJykuZmlsdGVyKGZ1bmN0aW9uKHRhZykge1xyXG5cdFx0cmV0dXJuIHRhZyAhPT0gJydcclxuXHR9KVxyXG5cdHJldHVybiBlbnRyeTtcclxufVxyXG4iLCJ2YXIgc2pjbCA9IHJlcXVpcmUoJ3NqY2wnKVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihrZXksIGVudHJ5KSB7XHJcblx0ZW50cnkuY29udGVudCA9IHNqY2wuZW5jcnlwdChrZXksIGVudHJ5LmNvbnRlbnQpXHJcblx0ZW50cnkudGFncyA9IHNqY2wuZW5jcnlwdChrZXksIGVudHJ5LnRhZ3Muam9pbignLCcpKVxyXG5cdHJldHVybiBlbnRyeTtcclxufVxyXG4iLCIvKiFcbiAqIFRoZSBidWZmZXIgbW9kdWxlIGZyb20gbm9kZS5qcywgZm9yIHRoZSBicm93c2VyLlxuICpcbiAqIEBhdXRob3IgICBGZXJvc3MgQWJvdWtoYWRpamVoIDxmZXJvc3NAZmVyb3NzLm9yZz4gPGh0dHA6Ly9mZXJvc3Mub3JnPlxuICogQGxpY2Vuc2UgIE1JVFxuICovXG5cbnZhciBiYXNlNjQgPSByZXF1aXJlKCdiYXNlNjQtanMnKVxudmFyIGllZWU3NTQgPSByZXF1aXJlKCdpZWVlNzU0JylcblxuZXhwb3J0cy5CdWZmZXIgPSBCdWZmZXJcbmV4cG9ydHMuU2xvd0J1ZmZlciA9IEJ1ZmZlclxuZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFUyA9IDUwXG5CdWZmZXIucG9vbFNpemUgPSA4MTkyXG5cbi8qKlxuICogSWYgYEJ1ZmZlci5fdXNlVHlwZWRBcnJheXNgOlxuICogICA9PT0gdHJ1ZSAgICBVc2UgVWludDhBcnJheSBpbXBsZW1lbnRhdGlvbiAoZmFzdGVzdClcbiAqICAgPT09IGZhbHNlICAgVXNlIE9iamVjdCBpbXBsZW1lbnRhdGlvbiAoY29tcGF0aWJsZSBkb3duIHRvIElFNilcbiAqL1xuQnVmZmVyLl91c2VUeXBlZEFycmF5cyA9IChmdW5jdGlvbiAoKSB7XG4gIC8vIERldGVjdCBpZiBicm93c2VyIHN1cHBvcnRzIFR5cGVkIEFycmF5cy4gU3VwcG9ydGVkIGJyb3dzZXJzIGFyZSBJRSAxMCssIEZpcmVmb3ggNCssXG4gIC8vIENocm9tZSA3KywgU2FmYXJpIDUuMSssIE9wZXJhIDExLjYrLCBpT1MgNC4yKy4gSWYgdGhlIGJyb3dzZXIgZG9lcyBub3Qgc3VwcG9ydCBhZGRpbmdcbiAgLy8gcHJvcGVydGllcyB0byBgVWludDhBcnJheWAgaW5zdGFuY2VzLCB0aGVuIHRoYXQncyB0aGUgc2FtZSBhcyBubyBgVWludDhBcnJheWAgc3VwcG9ydFxuICAvLyBiZWNhdXNlIHdlIG5lZWQgdG8gYmUgYWJsZSB0byBhZGQgYWxsIHRoZSBub2RlIEJ1ZmZlciBBUEkgbWV0aG9kcy4gVGhpcyBpcyBhbiBpc3N1ZVxuICAvLyBpbiBGaXJlZm94IDQtMjkuIE5vdyBmaXhlZDogaHR0cHM6Ly9idWd6aWxsYS5tb3ppbGxhLm9yZy9zaG93X2J1Zy5jZ2k/aWQ9Njk1NDM4XG4gIHRyeSB7XG4gICAgdmFyIGJ1ZiA9IG5ldyBBcnJheUJ1ZmZlcigwKVxuICAgIHZhciBhcnIgPSBuZXcgVWludDhBcnJheShidWYpXG4gICAgYXJyLmZvbyA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIDQyIH1cbiAgICByZXR1cm4gNDIgPT09IGFyci5mb28oKSAmJlxuICAgICAgICB0eXBlb2YgYXJyLnN1YmFycmF5ID09PSAnZnVuY3Rpb24nIC8vIENocm9tZSA5LTEwIGxhY2sgYHN1YmFycmF5YFxuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cbn0pKClcblxuLyoqXG4gKiBDbGFzczogQnVmZmVyXG4gKiA9PT09PT09PT09PT09XG4gKlxuICogVGhlIEJ1ZmZlciBjb25zdHJ1Y3RvciByZXR1cm5zIGluc3RhbmNlcyBvZiBgVWludDhBcnJheWAgdGhhdCBhcmUgYXVnbWVudGVkXG4gKiB3aXRoIGZ1bmN0aW9uIHByb3BlcnRpZXMgZm9yIGFsbCB0aGUgbm9kZSBgQnVmZmVyYCBBUEkgZnVuY3Rpb25zLiBXZSB1c2VcbiAqIGBVaW50OEFycmF5YCBzbyB0aGF0IHNxdWFyZSBicmFja2V0IG5vdGF0aW9uIHdvcmtzIGFzIGV4cGVjdGVkIC0tIGl0IHJldHVybnNcbiAqIGEgc2luZ2xlIG9jdGV0LlxuICpcbiAqIEJ5IGF1Z21lbnRpbmcgdGhlIGluc3RhbmNlcywgd2UgY2FuIGF2b2lkIG1vZGlmeWluZyB0aGUgYFVpbnQ4QXJyYXlgXG4gKiBwcm90b3R5cGUuXG4gKi9cbmZ1bmN0aW9uIEJ1ZmZlciAoc3ViamVjdCwgZW5jb2RpbmcsIG5vWmVybykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgQnVmZmVyKSlcbiAgICByZXR1cm4gbmV3IEJ1ZmZlcihzdWJqZWN0LCBlbmNvZGluZywgbm9aZXJvKVxuXG4gIHZhciB0eXBlID0gdHlwZW9mIHN1YmplY3RcblxuICAvLyBXb3JrYXJvdW5kOiBub2RlJ3MgYmFzZTY0IGltcGxlbWVudGF0aW9uIGFsbG93cyBmb3Igbm9uLXBhZGRlZCBzdHJpbmdzXG4gIC8vIHdoaWxlIGJhc2U2NC1qcyBkb2VzIG5vdC5cbiAgaWYgKGVuY29kaW5nID09PSAnYmFzZTY0JyAmJiB0eXBlID09PSAnc3RyaW5nJykge1xuICAgIHN1YmplY3QgPSBzdHJpbmd0cmltKHN1YmplY3QpXG4gICAgd2hpbGUgKHN1YmplY3QubGVuZ3RoICUgNCAhPT0gMCkge1xuICAgICAgc3ViamVjdCA9IHN1YmplY3QgKyAnPSdcbiAgICB9XG4gIH1cblxuICAvLyBGaW5kIHRoZSBsZW5ndGhcbiAgdmFyIGxlbmd0aFxuICBpZiAodHlwZSA9PT0gJ251bWJlcicpXG4gICAgbGVuZ3RoID0gY29lcmNlKHN1YmplY3QpXG4gIGVsc2UgaWYgKHR5cGUgPT09ICdzdHJpbmcnKVxuICAgIGxlbmd0aCA9IEJ1ZmZlci5ieXRlTGVuZ3RoKHN1YmplY3QsIGVuY29kaW5nKVxuICBlbHNlIGlmICh0eXBlID09PSAnb2JqZWN0JylcbiAgICBsZW5ndGggPSBjb2VyY2Uoc3ViamVjdC5sZW5ndGgpIC8vIGFzc3VtZSB0aGF0IG9iamVjdCBpcyBhcnJheS1saWtlXG4gIGVsc2VcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZpcnN0IGFyZ3VtZW50IG5lZWRzIHRvIGJlIGEgbnVtYmVyLCBhcnJheSBvciBzdHJpbmcuJylcblxuICB2YXIgYnVmXG4gIGlmIChCdWZmZXIuX3VzZVR5cGVkQXJyYXlzKSB7XG4gICAgLy8gUHJlZmVycmVkOiBSZXR1cm4gYW4gYXVnbWVudGVkIGBVaW50OEFycmF5YCBpbnN0YW5jZSBmb3IgYmVzdCBwZXJmb3JtYW5jZVxuICAgIGJ1ZiA9IEJ1ZmZlci5fYXVnbWVudChuZXcgVWludDhBcnJheShsZW5ndGgpKVxuICB9IGVsc2Uge1xuICAgIC8vIEZhbGxiYWNrOiBSZXR1cm4gVEhJUyBpbnN0YW5jZSBvZiBCdWZmZXIgKGNyZWF0ZWQgYnkgYG5ld2ApXG4gICAgYnVmID0gdGhpc1xuICAgIGJ1Zi5sZW5ndGggPSBsZW5ndGhcbiAgICBidWYuX2lzQnVmZmVyID0gdHJ1ZVxuICB9XG5cbiAgdmFyIGlcbiAgaWYgKEJ1ZmZlci5fdXNlVHlwZWRBcnJheXMgJiYgdHlwZW9mIHN1YmplY3QuYnl0ZUxlbmd0aCA9PT0gJ251bWJlcicpIHtcbiAgICAvLyBTcGVlZCBvcHRpbWl6YXRpb24gLS0gdXNlIHNldCBpZiB3ZSdyZSBjb3B5aW5nIGZyb20gYSB0eXBlZCBhcnJheVxuICAgIGJ1Zi5fc2V0KHN1YmplY3QpXG4gIH0gZWxzZSBpZiAoaXNBcnJheWlzaChzdWJqZWN0KSkge1xuICAgIC8vIFRyZWF0IGFycmF5LWlzaCBvYmplY3RzIGFzIGEgYnl0ZSBhcnJheVxuICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihzdWJqZWN0KSlcbiAgICAgICAgYnVmW2ldID0gc3ViamVjdC5yZWFkVUludDgoaSlcbiAgICAgIGVsc2VcbiAgICAgICAgYnVmW2ldID0gc3ViamVjdFtpXVxuICAgIH1cbiAgfSBlbHNlIGlmICh0eXBlID09PSAnc3RyaW5nJykge1xuICAgIGJ1Zi53cml0ZShzdWJqZWN0LCAwLCBlbmNvZGluZylcbiAgfSBlbHNlIGlmICh0eXBlID09PSAnbnVtYmVyJyAmJiAhQnVmZmVyLl91c2VUeXBlZEFycmF5cyAmJiAhbm9aZXJvKSB7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBidWZbaV0gPSAwXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJ1ZlxufVxuXG4vLyBTVEFUSUMgTUVUSE9EU1xuLy8gPT09PT09PT09PT09PT1cblxuQnVmZmVyLmlzRW5jb2RpbmcgPSBmdW5jdGlvbiAoZW5jb2RpbmcpIHtcbiAgc3dpdGNoIChTdHJpbmcoZW5jb2RpbmcpLnRvTG93ZXJDYXNlKCkpIHtcbiAgICBjYXNlICdoZXgnOlxuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgY2FzZSAnYmluYXJ5JzpcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgIGNhc2UgJ3Jhdyc6XG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldHVybiB0cnVlXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBmYWxzZVxuICB9XG59XG5cbkJ1ZmZlci5pc0J1ZmZlciA9IGZ1bmN0aW9uIChiKSB7XG4gIHJldHVybiAhIShiICE9PSBudWxsICYmIGIgIT09IHVuZGVmaW5lZCAmJiBiLl9pc0J1ZmZlcilcbn1cblxuQnVmZmVyLmJ5dGVMZW5ndGggPSBmdW5jdGlvbiAoc3RyLCBlbmNvZGluZykge1xuICB2YXIgcmV0XG4gIHN0ciA9IHN0ciArICcnXG4gIHN3aXRjaCAoZW5jb2RpbmcgfHwgJ3V0ZjgnKSB7XG4gICAgY2FzZSAnaGV4JzpcbiAgICAgIHJldCA9IHN0ci5sZW5ndGggLyAyXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgIHJldCA9IHV0ZjhUb0J5dGVzKHN0cikubGVuZ3RoXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICBjYXNlICdiaW5hcnknOlxuICAgIGNhc2UgJ3Jhdyc6XG4gICAgICByZXQgPSBzdHIubGVuZ3RoXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICByZXQgPSBiYXNlNjRUb0J5dGVzKHN0cikubGVuZ3RoXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICByZXQgPSBzdHIubGVuZ3RoICogMlxuICAgICAgYnJlYWtcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIGVuY29kaW5nJylcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbkJ1ZmZlci5jb25jYXQgPSBmdW5jdGlvbiAobGlzdCwgdG90YWxMZW5ndGgpIHtcbiAgYXNzZXJ0KGlzQXJyYXkobGlzdCksICdVc2FnZTogQnVmZmVyLmNvbmNhdChsaXN0LCBbdG90YWxMZW5ndGhdKVxcbicgK1xuICAgICAgJ2xpc3Qgc2hvdWxkIGJlIGFuIEFycmF5LicpXG5cbiAgaWYgKGxpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG5ldyBCdWZmZXIoMClcbiAgfSBlbHNlIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgIHJldHVybiBsaXN0WzBdXG4gIH1cblxuICB2YXIgaVxuICBpZiAodHlwZW9mIHRvdGFsTGVuZ3RoICE9PSAnbnVtYmVyJykge1xuICAgIHRvdGFsTGVuZ3RoID0gMFxuICAgIGZvciAoaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICB0b3RhbExlbmd0aCArPSBsaXN0W2ldLmxlbmd0aFxuICAgIH1cbiAgfVxuXG4gIHZhciBidWYgPSBuZXcgQnVmZmVyKHRvdGFsTGVuZ3RoKVxuICB2YXIgcG9zID0gMFxuICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgIHZhciBpdGVtID0gbGlzdFtpXVxuICAgIGl0ZW0uY29weShidWYsIHBvcylcbiAgICBwb3MgKz0gaXRlbS5sZW5ndGhcbiAgfVxuICByZXR1cm4gYnVmXG59XG5cbi8vIEJVRkZFUiBJTlNUQU5DRSBNRVRIT0RTXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PVxuXG5mdW5jdGlvbiBfaGV4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICBvZmZzZXQgPSBOdW1iZXIob2Zmc2V0KSB8fCAwXG4gIHZhciByZW1haW5pbmcgPSBidWYubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmICghbGVuZ3RoKSB7XG4gICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gIH0gZWxzZSB7XG4gICAgbGVuZ3RoID0gTnVtYmVyKGxlbmd0aClcbiAgICBpZiAobGVuZ3RoID4gcmVtYWluaW5nKSB7XG4gICAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgICB9XG4gIH1cblxuICAvLyBtdXN0IGJlIGFuIGV2ZW4gbnVtYmVyIG9mIGRpZ2l0c1xuICB2YXIgc3RyTGVuID0gc3RyaW5nLmxlbmd0aFxuICBhc3NlcnQoc3RyTGVuICUgMiA9PT0gMCwgJ0ludmFsaWQgaGV4IHN0cmluZycpXG5cbiAgaWYgKGxlbmd0aCA+IHN0ckxlbiAvIDIpIHtcbiAgICBsZW5ndGggPSBzdHJMZW4gLyAyXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIHZhciBieXRlID0gcGFyc2VJbnQoc3RyaW5nLnN1YnN0cihpICogMiwgMiksIDE2KVxuICAgIGFzc2VydCghaXNOYU4oYnl0ZSksICdJbnZhbGlkIGhleCBzdHJpbmcnKVxuICAgIGJ1ZltvZmZzZXQgKyBpXSA9IGJ5dGVcbiAgfVxuICBCdWZmZXIuX2NoYXJzV3JpdHRlbiA9IGkgKiAyXG4gIHJldHVybiBpXG59XG5cbmZ1bmN0aW9uIF91dGY4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gQnVmZmVyLl9jaGFyc1dyaXR0ZW4gPVxuICAgIGJsaXRCdWZmZXIodXRmOFRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5mdW5jdGlvbiBfYXNjaWlXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHZhciBjaGFyc1dyaXR0ZW4gPSBCdWZmZXIuX2NoYXJzV3JpdHRlbiA9XG4gICAgYmxpdEJ1ZmZlcihhc2NpaVRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5mdW5jdGlvbiBfYmluYXJ5V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gX2FzY2lpV3JpdGUoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBfYmFzZTY0V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gQnVmZmVyLl9jaGFyc1dyaXR0ZW4gPVxuICAgIGJsaXRCdWZmZXIoYmFzZTY0VG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxuICByZXR1cm4gY2hhcnNXcml0dGVuXG59XG5cbmZ1bmN0aW9uIF91dGYxNmxlV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gQnVmZmVyLl9jaGFyc1dyaXR0ZW4gPVxuICAgIGJsaXRCdWZmZXIodXRmMTZsZVRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24gKHN0cmluZywgb2Zmc2V0LCBsZW5ndGgsIGVuY29kaW5nKSB7XG4gIC8vIFN1cHBvcnQgYm90aCAoc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCwgZW5jb2RpbmcpXG4gIC8vIGFuZCB0aGUgbGVnYWN5IChzdHJpbmcsIGVuY29kaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgaWYgKGlzRmluaXRlKG9mZnNldCkpIHtcbiAgICBpZiAoIWlzRmluaXRlKGxlbmd0aCkpIHtcbiAgICAgIGVuY29kaW5nID0gbGVuZ3RoXG4gICAgICBsZW5ndGggPSB1bmRlZmluZWRcbiAgICB9XG4gIH0gZWxzZSB7ICAvLyBsZWdhY3lcbiAgICB2YXIgc3dhcCA9IGVuY29kaW5nXG4gICAgZW5jb2RpbmcgPSBvZmZzZXRcbiAgICBvZmZzZXQgPSBsZW5ndGhcbiAgICBsZW5ndGggPSBzd2FwXG4gIH1cblxuICBvZmZzZXQgPSBOdW1iZXIob2Zmc2V0KSB8fCAwXG4gIHZhciByZW1haW5pbmcgPSB0aGlzLmxlbmd0aCAtIG9mZnNldFxuICBpZiAoIWxlbmd0aCkge1xuICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICB9IGVsc2Uge1xuICAgIGxlbmd0aCA9IE51bWJlcihsZW5ndGgpXG4gICAgaWYgKGxlbmd0aCA+IHJlbWFpbmluZykge1xuICAgICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gICAgfVxuICB9XG4gIGVuY29kaW5nID0gU3RyaW5nKGVuY29kaW5nIHx8ICd1dGY4JykudG9Mb3dlckNhc2UoKVxuXG4gIHZhciByZXRcbiAgc3dpdGNoIChlbmNvZGluZykge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgICByZXQgPSBfaGV4V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgICAgcmV0ID0gX3V0ZjhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgICByZXQgPSBfYXNjaWlXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdiaW5hcnknOlxuICAgICAgcmV0ID0gX2JpbmFyeVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICByZXQgPSBfYmFzZTY0V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldCA9IF91dGYxNmxlV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBlbmNvZGluZycpXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gKGVuY29kaW5nLCBzdGFydCwgZW5kKSB7XG4gIHZhciBzZWxmID0gdGhpc1xuXG4gIGVuY29kaW5nID0gU3RyaW5nKGVuY29kaW5nIHx8ICd1dGY4JykudG9Mb3dlckNhc2UoKVxuICBzdGFydCA9IE51bWJlcihzdGFydCkgfHwgMFxuICBlbmQgPSAoZW5kICE9PSB1bmRlZmluZWQpXG4gICAgPyBOdW1iZXIoZW5kKVxuICAgIDogZW5kID0gc2VsZi5sZW5ndGhcblxuICAvLyBGYXN0cGF0aCBlbXB0eSBzdHJpbmdzXG4gIGlmIChlbmQgPT09IHN0YXJ0KVxuICAgIHJldHVybiAnJ1xuXG4gIHZhciByZXRcbiAgc3dpdGNoIChlbmNvZGluZykge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgICByZXQgPSBfaGV4U2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgICAgcmV0ID0gX3V0ZjhTbGljZShzZWxmLCBzdGFydCwgZW5kKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgICByZXQgPSBfYXNjaWlTbGljZShzZWxmLCBzdGFydCwgZW5kKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdiaW5hcnknOlxuICAgICAgcmV0ID0gX2JpbmFyeVNsaWNlKHNlbGYsIHN0YXJ0LCBlbmQpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICByZXQgPSBfYmFzZTY0U2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldCA9IF91dGYxNmxlU2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBlbmNvZGluZycpXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvSlNPTiA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnQnVmZmVyJyxcbiAgICBkYXRhOiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCh0aGlzLl9hcnIgfHwgdGhpcywgMClcbiAgfVxufVxuXG4vLyBjb3B5KHRhcmdldEJ1ZmZlciwgdGFyZ2V0U3RhcnQ9MCwgc291cmNlU3RhcnQ9MCwgc291cmNlRW5kPWJ1ZmZlci5sZW5ndGgpXG5CdWZmZXIucHJvdG90eXBlLmNvcHkgPSBmdW5jdGlvbiAodGFyZ2V0LCB0YXJnZXRfc3RhcnQsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHNvdXJjZSA9IHRoaXNcblxuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgJiYgZW5kICE9PSAwKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAoIXRhcmdldF9zdGFydCkgdGFyZ2V0X3N0YXJ0ID0gMFxuXG4gIC8vIENvcHkgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuXG4gIGlmICh0YXJnZXQubGVuZ3RoID09PSAwIHx8IHNvdXJjZS5sZW5ndGggPT09IDApIHJldHVyblxuXG4gIC8vIEZhdGFsIGVycm9yIGNvbmRpdGlvbnNcbiAgYXNzZXJ0KGVuZCA+PSBzdGFydCwgJ3NvdXJjZUVuZCA8IHNvdXJjZVN0YXJ0JylcbiAgYXNzZXJ0KHRhcmdldF9zdGFydCA+PSAwICYmIHRhcmdldF9zdGFydCA8IHRhcmdldC5sZW5ndGgsXG4gICAgICAndGFyZ2V0U3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGFzc2VydChzdGFydCA+PSAwICYmIHN0YXJ0IDwgc291cmNlLmxlbmd0aCwgJ3NvdXJjZVN0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBhc3NlcnQoZW5kID49IDAgJiYgZW5kIDw9IHNvdXJjZS5sZW5ndGgsICdzb3VyY2VFbmQgb3V0IG9mIGJvdW5kcycpXG5cbiAgLy8gQXJlIHdlIG9vYj9cbiAgaWYgKGVuZCA+IHRoaXMubGVuZ3RoKVxuICAgIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICh0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0X3N0YXJ0IDwgZW5kIC0gc3RhcnQpXG4gICAgZW5kID0gdGFyZ2V0Lmxlbmd0aCAtIHRhcmdldF9zdGFydCArIHN0YXJ0XG5cbiAgdmFyIGxlbiA9IGVuZCAtIHN0YXJ0XG5cbiAgaWYgKGxlbiA8IDEwMCB8fCAhQnVmZmVyLl91c2VUeXBlZEFycmF5cykge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICB0YXJnZXRbaSArIHRhcmdldF9zdGFydF0gPSB0aGlzW2kgKyBzdGFydF1cbiAgfSBlbHNlIHtcbiAgICB0YXJnZXQuX3NldCh0aGlzLnN1YmFycmF5KHN0YXJ0LCBzdGFydCArIGxlbiksIHRhcmdldF9zdGFydClcbiAgfVxufVxuXG5mdW5jdGlvbiBfYmFzZTY0U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICBpZiAoc3RhcnQgPT09IDAgJiYgZW5kID09PSBidWYubGVuZ3RoKSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1ZilcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmLnNsaWNlKHN0YXJ0LCBlbmQpKVxuICB9XG59XG5cbmZ1bmN0aW9uIF91dGY4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmVzID0gJydcbiAgdmFyIHRtcCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIGlmIChidWZbaV0gPD0gMHg3Rikge1xuICAgICAgcmVzICs9IGRlY29kZVV0ZjhDaGFyKHRtcCkgKyBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSlcbiAgICAgIHRtcCA9ICcnXG4gICAgfSBlbHNlIHtcbiAgICAgIHRtcCArPSAnJScgKyBidWZbaV0udG9TdHJpbmcoMTYpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlcyArIGRlY29kZVV0ZjhDaGFyKHRtcClcbn1cblxuZnVuY3Rpb24gX2FzY2lpU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmV0ID0gJydcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKVxuICAgIHJldCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSlcbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBfYmluYXJ5U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICByZXR1cm4gX2FzY2lpU2xpY2UoYnVmLCBzdGFydCwgZW5kKVxufVxuXG5mdW5jdGlvbiBfaGV4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuXG4gIGlmICghc3RhcnQgfHwgc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgfHwgZW5kIDwgMCB8fCBlbmQgPiBsZW4pIGVuZCA9IGxlblxuXG4gIHZhciBvdXQgPSAnJ1xuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIG91dCArPSB0b0hleChidWZbaV0pXG4gIH1cbiAgcmV0dXJuIG91dFxufVxuXG5mdW5jdGlvbiBfdXRmMTZsZVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGJ5dGVzID0gYnVmLnNsaWNlKHN0YXJ0LCBlbmQpXG4gIHZhciByZXMgPSAnJ1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGJ5dGVzLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgcmVzICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnl0ZXNbaV0gKyBieXRlc1tpKzFdICogMjU2KVxuICB9XG4gIHJldHVybiByZXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5zbGljZSA9IGZ1bmN0aW9uIChzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBzdGFydCA9IGNsYW1wKHN0YXJ0LCBsZW4sIDApXG4gIGVuZCA9IGNsYW1wKGVuZCwgbGVuLCBsZW4pXG5cbiAgaWYgKEJ1ZmZlci5fdXNlVHlwZWRBcnJheXMpIHtcbiAgICByZXR1cm4gQnVmZmVyLl9hdWdtZW50KHRoaXMuc3ViYXJyYXkoc3RhcnQsIGVuZCkpXG4gIH0gZWxzZSB7XG4gICAgdmFyIHNsaWNlTGVuID0gZW5kIC0gc3RhcnRcbiAgICB2YXIgbmV3QnVmID0gbmV3IEJ1ZmZlcihzbGljZUxlbiwgdW5kZWZpbmVkLCB0cnVlKVxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2xpY2VMZW47IGkrKykge1xuICAgICAgbmV3QnVmW2ldID0gdGhpc1tpICsgc3RhcnRdXG4gICAgfVxuICAgIHJldHVybiBuZXdCdWZcbiAgfVxufVxuXG4vLyBgZ2V0YCB3aWxsIGJlIHJlbW92ZWQgaW4gTm9kZSAwLjEzK1xuQnVmZmVyLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAob2Zmc2V0KSB7XG4gIGNvbnNvbGUubG9nKCcuZ2V0KCkgaXMgZGVwcmVjYXRlZC4gQWNjZXNzIHVzaW5nIGFycmF5IGluZGV4ZXMgaW5zdGVhZC4nKVxuICByZXR1cm4gdGhpcy5yZWFkVUludDgob2Zmc2V0KVxufVxuXG4vLyBgc2V0YCB3aWxsIGJlIHJlbW92ZWQgaW4gTm9kZSAwLjEzK1xuQnVmZmVyLnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbiAodiwgb2Zmc2V0KSB7XG4gIGNvbnNvbGUubG9nKCcuc2V0KCkgaXMgZGVwcmVjYXRlZC4gQWNjZXNzIHVzaW5nIGFycmF5IGluZGV4ZXMgaW5zdGVhZC4nKVxuICByZXR1cm4gdGhpcy53cml0ZVVJbnQ4KHYsIG9mZnNldClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDggPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0IDwgdGhpcy5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICBpZiAob2Zmc2V0ID49IHRoaXMubGVuZ3RoKVxuICAgIHJldHVyblxuXG4gIHJldHVybiB0aGlzW29mZnNldF1cbn1cblxuZnVuY3Rpb24gX3JlYWRVSW50MTYgKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMSA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICB2YXIgdmFsXG4gIGlmIChsaXR0bGVFbmRpYW4pIHtcbiAgICB2YWwgPSBidWZbb2Zmc2V0XVxuICAgIGlmIChvZmZzZXQgKyAxIDwgbGVuKVxuICAgICAgdmFsIHw9IGJ1ZltvZmZzZXQgKyAxXSA8PCA4XG4gIH0gZWxzZSB7XG4gICAgdmFsID0gYnVmW29mZnNldF0gPDwgOFxuICAgIGlmIChvZmZzZXQgKyAxIDwgbGVuKVxuICAgICAgdmFsIHw9IGJ1ZltvZmZzZXQgKyAxXVxuICB9XG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2TEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRVSW50MTYodGhpcywgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2QkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRVSW50MTYodGhpcywgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIF9yZWFkVUludDMyIChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDMgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgdmFyIHZhbFxuICBpZiAobGl0dGxlRW5kaWFuKSB7XG4gICAgaWYgKG9mZnNldCArIDIgPCBsZW4pXG4gICAgICB2YWwgPSBidWZbb2Zmc2V0ICsgMl0gPDwgMTZcbiAgICBpZiAob2Zmc2V0ICsgMSA8IGxlbilcbiAgICAgIHZhbCB8PSBidWZbb2Zmc2V0ICsgMV0gPDwgOFxuICAgIHZhbCB8PSBidWZbb2Zmc2V0XVxuICAgIGlmIChvZmZzZXQgKyAzIDwgbGVuKVxuICAgICAgdmFsID0gdmFsICsgKGJ1ZltvZmZzZXQgKyAzXSA8PCAyNCA+Pj4gMClcbiAgfSBlbHNlIHtcbiAgICBpZiAob2Zmc2V0ICsgMSA8IGxlbilcbiAgICAgIHZhbCA9IGJ1ZltvZmZzZXQgKyAxXSA8PCAxNlxuICAgIGlmIChvZmZzZXQgKyAyIDwgbGVuKVxuICAgICAgdmFsIHw9IGJ1ZltvZmZzZXQgKyAyXSA8PCA4XG4gICAgaWYgKG9mZnNldCArIDMgPCBsZW4pXG4gICAgICB2YWwgfD0gYnVmW29mZnNldCArIDNdXG4gICAgdmFsID0gdmFsICsgKGJ1ZltvZmZzZXRdIDw8IDI0ID4+PiAwKVxuICB9XG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyTEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRVSW50MzIodGhpcywgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyQkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRVSW50MzIodGhpcywgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDggPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCxcbiAgICAgICAgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0IDwgdGhpcy5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICBpZiAob2Zmc2V0ID49IHRoaXMubGVuZ3RoKVxuICAgIHJldHVyblxuXG4gIHZhciBuZWcgPSB0aGlzW29mZnNldF0gJiAweDgwXG4gIGlmIChuZWcpXG4gICAgcmV0dXJuICgweGZmIC0gdGhpc1tvZmZzZXRdICsgMSkgKiAtMVxuICBlbHNlXG4gICAgcmV0dXJuIHRoaXNbb2Zmc2V0XVxufVxuXG5mdW5jdGlvbiBfcmVhZEludDE2IChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDEgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgdmFyIHZhbCA9IF9yZWFkVUludDE2KGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIHRydWUpXG4gIHZhciBuZWcgPSB2YWwgJiAweDgwMDBcbiAgaWYgKG5lZylcbiAgICByZXR1cm4gKDB4ZmZmZiAtIHZhbCArIDEpICogLTFcbiAgZWxzZVxuICAgIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZEludDE2KHRoaXMsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDE2QkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRJbnQxNih0aGlzLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3JlYWRJbnQzMiAoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAzIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byByZWFkIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIHZhciB2YWwgPSBfcmVhZFVJbnQzMihidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCB0cnVlKVxuICB2YXIgbmVnID0gdmFsICYgMHg4MDAwMDAwMFxuICBpZiAobmVnKVxuICAgIHJldHVybiAoMHhmZmZmZmZmZiAtIHZhbCArIDEpICogLTFcbiAgZWxzZVxuICAgIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MzJMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZEludDMyKHRoaXMsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyQkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRJbnQzMih0aGlzLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3JlYWRGbG9hdCAoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMyA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICByZXR1cm4gaWVlZTc1NC5yZWFkKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdExFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIF9yZWFkRmxvYXQodGhpcywgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRmxvYXRCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZEZsb2F0KHRoaXMsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfcmVhZERvdWJsZSAoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICsgNyA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICByZXR1cm4gaWVlZTc1NC5yZWFkKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDUyLCA4KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZERvdWJsZSh0aGlzLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZERvdWJsZSh0aGlzLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQ4ID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCA8IHRoaXMubGVuZ3RoLCAndHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZnVpbnQodmFsdWUsIDB4ZmYpXG4gIH1cblxuICBpZiAob2Zmc2V0ID49IHRoaXMubGVuZ3RoKSByZXR1cm5cblxuICB0aGlzW29mZnNldF0gPSB2YWx1ZVxufVxuXG5mdW5jdGlvbiBfd3JpdGVVSW50MTYgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMSA8IGJ1Zi5sZW5ndGgsICd0cnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmdWludCh2YWx1ZSwgMHhmZmZmKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgZm9yICh2YXIgaSA9IDAsIGogPSBNYXRoLm1pbihsZW4gLSBvZmZzZXQsIDIpOyBpIDwgajsgaSsrKSB7XG4gICAgYnVmW29mZnNldCArIGldID1cbiAgICAgICAgKHZhbHVlICYgKDB4ZmYgPDwgKDggKiAobGl0dGxlRW5kaWFuID8gaSA6IDEgLSBpKSkpKSA+Pj5cbiAgICAgICAgICAgIChsaXR0bGVFbmRpYW4gPyBpIDogMSAtIGkpICogOFxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfd3JpdGVVSW50MzIgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMyA8IGJ1Zi5sZW5ndGgsICd0cnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmdWludCh2YWx1ZSwgMHhmZmZmZmZmZilcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIGZvciAodmFyIGkgPSAwLCBqID0gTWF0aC5taW4obGVuIC0gb2Zmc2V0LCA0KTsgaSA8IGo7IGkrKykge1xuICAgIGJ1ZltvZmZzZXQgKyBpXSA9XG4gICAgICAgICh2YWx1ZSA+Pj4gKGxpdHRsZUVuZGlhbiA/IGkgOiAzIC0gaSkgKiA4KSAmIDB4ZmZcbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyTEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyQkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDggPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0IDwgdGhpcy5sZW5ndGgsICdUcnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmc2ludCh2YWx1ZSwgMHg3ZiwgLTB4ODApXG4gIH1cblxuICBpZiAob2Zmc2V0ID49IHRoaXMubGVuZ3RoKVxuICAgIHJldHVyblxuXG4gIGlmICh2YWx1ZSA+PSAwKVxuICAgIHRoaXMud3JpdGVVSW50OCh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydClcbiAgZWxzZVxuICAgIHRoaXMud3JpdGVVSW50OCgweGZmICsgdmFsdWUgKyAxLCBvZmZzZXQsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfd3JpdGVJbnQxNiAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAxIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byB3cml0ZSBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gICAgdmVyaWZzaW50KHZhbHVlLCAweDdmZmYsIC0weDgwMDApXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICBpZiAodmFsdWUgPj0gMClcbiAgICBfd3JpdGVVSW50MTYoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KVxuICBlbHNlXG4gICAgX3dyaXRlVUludDE2KGJ1ZiwgMHhmZmZmICsgdmFsdWUgKyAxLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MTZCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIF93cml0ZUludDMyIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDMgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZnNpbnQodmFsdWUsIDB4N2ZmZmZmZmYsIC0weDgwMDAwMDAwKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgaWYgKHZhbHVlID49IDApXG4gICAgX3dyaXRlVUludDMyKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydClcbiAgZWxzZVxuICAgIF93cml0ZVVJbnQzMihidWYsIDB4ZmZmZmZmZmYgKyB2YWx1ZSArIDEsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyTEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQzMkJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3dyaXRlRmxvYXQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMyA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmSUVFRTc1NCh2YWx1ZSwgMy40MDI4MjM0NjYzODUyODg2ZSszOCwgLTMuNDAyODIzNDY2Mzg1Mjg4NmUrMzgpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0TEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVGbG9hdEJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3dyaXRlRG91YmxlIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDcgPCBidWYubGVuZ3RoLFxuICAgICAgICAnVHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZklFRUU3NTQodmFsdWUsIDEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4LCAtMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCA1MiwgOClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbi8vIGZpbGwodmFsdWUsIHN0YXJ0PTAsIGVuZD1idWZmZXIubGVuZ3RoKVxuQnVmZmVyLnByb3RvdHlwZS5maWxsID0gZnVuY3Rpb24gKHZhbHVlLCBzdGFydCwgZW5kKSB7XG4gIGlmICghdmFsdWUpIHZhbHVlID0gMFxuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQpIGVuZCA9IHRoaXMubGVuZ3RoXG5cbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICB2YWx1ZSA9IHZhbHVlLmNoYXJDb2RlQXQoMClcbiAgfVxuXG4gIGFzc2VydCh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInICYmICFpc05hTih2YWx1ZSksICd2YWx1ZSBpcyBub3QgYSBudW1iZXInKVxuICBhc3NlcnQoZW5kID49IHN0YXJ0LCAnZW5kIDwgc3RhcnQnKVxuXG4gIC8vIEZpbGwgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuXG4gIGlmICh0aGlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuXG5cbiAgYXNzZXJ0KHN0YXJ0ID49IDAgJiYgc3RhcnQgPCB0aGlzLmxlbmd0aCwgJ3N0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBhc3NlcnQoZW5kID49IDAgJiYgZW5kIDw9IHRoaXMubGVuZ3RoLCAnZW5kIG91dCBvZiBib3VuZHMnKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgdGhpc1tpXSA9IHZhbHVlXG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbnNwZWN0ID0gZnVuY3Rpb24gKCkge1xuICB2YXIgb3V0ID0gW11cbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICBvdXRbaV0gPSB0b0hleCh0aGlzW2ldKVxuICAgIGlmIChpID09PSBleHBvcnRzLklOU1BFQ1RfTUFYX0JZVEVTKSB7XG4gICAgICBvdXRbaSArIDFdID0gJy4uLidcbiAgICAgIGJyZWFrXG4gICAgfVxuICB9XG4gIHJldHVybiAnPEJ1ZmZlciAnICsgb3V0LmpvaW4oJyAnKSArICc+J1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBuZXcgYEFycmF5QnVmZmVyYCB3aXRoIHRoZSAqY29waWVkKiBtZW1vcnkgb2YgdGhlIGJ1ZmZlciBpbnN0YW5jZS5cbiAqIEFkZGVkIGluIE5vZGUgMC4xMi4gT25seSBhdmFpbGFibGUgaW4gYnJvd3NlcnMgdGhhdCBzdXBwb3J0IEFycmF5QnVmZmVyLlxuICovXG5CdWZmZXIucHJvdG90eXBlLnRvQXJyYXlCdWZmZXIgPSBmdW5jdGlvbiAoKSB7XG4gIGlmICh0eXBlb2YgVWludDhBcnJheSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBpZiAoQnVmZmVyLl91c2VUeXBlZEFycmF5cykge1xuICAgICAgcmV0dXJuIChuZXcgQnVmZmVyKHRoaXMpKS5idWZmZXJcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGJ1ZiA9IG5ldyBVaW50OEFycmF5KHRoaXMubGVuZ3RoKVxuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGJ1Zi5sZW5ndGg7IGkgPCBsZW47IGkgKz0gMSlcbiAgICAgICAgYnVmW2ldID0gdGhpc1tpXVxuICAgICAgcmV0dXJuIGJ1Zi5idWZmZXJcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdCdWZmZXIudG9BcnJheUJ1ZmZlciBub3Qgc3VwcG9ydGVkIGluIHRoaXMgYnJvd3NlcicpXG4gIH1cbn1cblxuLy8gSEVMUEVSIEZVTkNUSU9OU1xuLy8gPT09PT09PT09PT09PT09PVxuXG5mdW5jdGlvbiBzdHJpbmd0cmltIChzdHIpIHtcbiAgaWYgKHN0ci50cmltKSByZXR1cm4gc3RyLnRyaW0oKVxuICByZXR1cm4gc3RyLnJlcGxhY2UoL15cXHMrfFxccyskL2csICcnKVxufVxuXG52YXIgQlAgPSBCdWZmZXIucHJvdG90eXBlXG5cbi8qKlxuICogQXVnbWVudCBhIFVpbnQ4QXJyYXkgKmluc3RhbmNlKiAobm90IHRoZSBVaW50OEFycmF5IGNsYXNzISkgd2l0aCBCdWZmZXIgbWV0aG9kc1xuICovXG5CdWZmZXIuX2F1Z21lbnQgPSBmdW5jdGlvbiAoYXJyKSB7XG4gIGFyci5faXNCdWZmZXIgPSB0cnVlXG5cbiAgLy8gc2F2ZSByZWZlcmVuY2UgdG8gb3JpZ2luYWwgVWludDhBcnJheSBnZXQvc2V0IG1ldGhvZHMgYmVmb3JlIG92ZXJ3cml0aW5nXG4gIGFyci5fZ2V0ID0gYXJyLmdldFxuICBhcnIuX3NldCA9IGFyci5zZXRcblxuICAvLyBkZXByZWNhdGVkLCB3aWxsIGJlIHJlbW92ZWQgaW4gbm9kZSAwLjEzK1xuICBhcnIuZ2V0ID0gQlAuZ2V0XG4gIGFyci5zZXQgPSBCUC5zZXRcblxuICBhcnIud3JpdGUgPSBCUC53cml0ZVxuICBhcnIudG9TdHJpbmcgPSBCUC50b1N0cmluZ1xuICBhcnIudG9Mb2NhbGVTdHJpbmcgPSBCUC50b1N0cmluZ1xuICBhcnIudG9KU09OID0gQlAudG9KU09OXG4gIGFyci5jb3B5ID0gQlAuY29weVxuICBhcnIuc2xpY2UgPSBCUC5zbGljZVxuICBhcnIucmVhZFVJbnQ4ID0gQlAucmVhZFVJbnQ4XG4gIGFyci5yZWFkVUludDE2TEUgPSBCUC5yZWFkVUludDE2TEVcbiAgYXJyLnJlYWRVSW50MTZCRSA9IEJQLnJlYWRVSW50MTZCRVxuICBhcnIucmVhZFVJbnQzMkxFID0gQlAucmVhZFVJbnQzMkxFXG4gIGFyci5yZWFkVUludDMyQkUgPSBCUC5yZWFkVUludDMyQkVcbiAgYXJyLnJlYWRJbnQ4ID0gQlAucmVhZEludDhcbiAgYXJyLnJlYWRJbnQxNkxFID0gQlAucmVhZEludDE2TEVcbiAgYXJyLnJlYWRJbnQxNkJFID0gQlAucmVhZEludDE2QkVcbiAgYXJyLnJlYWRJbnQzMkxFID0gQlAucmVhZEludDMyTEVcbiAgYXJyLnJlYWRJbnQzMkJFID0gQlAucmVhZEludDMyQkVcbiAgYXJyLnJlYWRGbG9hdExFID0gQlAucmVhZEZsb2F0TEVcbiAgYXJyLnJlYWRGbG9hdEJFID0gQlAucmVhZEZsb2F0QkVcbiAgYXJyLnJlYWREb3VibGVMRSA9IEJQLnJlYWREb3VibGVMRVxuICBhcnIucmVhZERvdWJsZUJFID0gQlAucmVhZERvdWJsZUJFXG4gIGFyci53cml0ZVVJbnQ4ID0gQlAud3JpdGVVSW50OFxuICBhcnIud3JpdGVVSW50MTZMRSA9IEJQLndyaXRlVUludDE2TEVcbiAgYXJyLndyaXRlVUludDE2QkUgPSBCUC53cml0ZVVJbnQxNkJFXG4gIGFyci53cml0ZVVJbnQzMkxFID0gQlAud3JpdGVVSW50MzJMRVxuICBhcnIud3JpdGVVSW50MzJCRSA9IEJQLndyaXRlVUludDMyQkVcbiAgYXJyLndyaXRlSW50OCA9IEJQLndyaXRlSW50OFxuICBhcnIud3JpdGVJbnQxNkxFID0gQlAud3JpdGVJbnQxNkxFXG4gIGFyci53cml0ZUludDE2QkUgPSBCUC53cml0ZUludDE2QkVcbiAgYXJyLndyaXRlSW50MzJMRSA9IEJQLndyaXRlSW50MzJMRVxuICBhcnIud3JpdGVJbnQzMkJFID0gQlAud3JpdGVJbnQzMkJFXG4gIGFyci53cml0ZUZsb2F0TEUgPSBCUC53cml0ZUZsb2F0TEVcbiAgYXJyLndyaXRlRmxvYXRCRSA9IEJQLndyaXRlRmxvYXRCRVxuICBhcnIud3JpdGVEb3VibGVMRSA9IEJQLndyaXRlRG91YmxlTEVcbiAgYXJyLndyaXRlRG91YmxlQkUgPSBCUC53cml0ZURvdWJsZUJFXG4gIGFyci5maWxsID0gQlAuZmlsbFxuICBhcnIuaW5zcGVjdCA9IEJQLmluc3BlY3RcbiAgYXJyLnRvQXJyYXlCdWZmZXIgPSBCUC50b0FycmF5QnVmZmVyXG5cbiAgcmV0dXJuIGFyclxufVxuXG4vLyBzbGljZShzdGFydCwgZW5kKVxuZnVuY3Rpb24gY2xhbXAgKGluZGV4LCBsZW4sIGRlZmF1bHRWYWx1ZSkge1xuICBpZiAodHlwZW9mIGluZGV4ICE9PSAnbnVtYmVyJykgcmV0dXJuIGRlZmF1bHRWYWx1ZVxuICBpbmRleCA9IH5+aW5kZXg7ICAvLyBDb2VyY2UgdG8gaW50ZWdlci5cbiAgaWYgKGluZGV4ID49IGxlbikgcmV0dXJuIGxlblxuICBpZiAoaW5kZXggPj0gMCkgcmV0dXJuIGluZGV4XG4gIGluZGV4ICs9IGxlblxuICBpZiAoaW5kZXggPj0gMCkgcmV0dXJuIGluZGV4XG4gIHJldHVybiAwXG59XG5cbmZ1bmN0aW9uIGNvZXJjZSAobGVuZ3RoKSB7XG4gIC8vIENvZXJjZSBsZW5ndGggdG8gYSBudW1iZXIgKHBvc3NpYmx5IE5hTiksIHJvdW5kIHVwXG4gIC8vIGluIGNhc2UgaXQncyBmcmFjdGlvbmFsIChlLmcuIDEyMy40NTYpIHRoZW4gZG8gYVxuICAvLyBkb3VibGUgbmVnYXRlIHRvIGNvZXJjZSBhIE5hTiB0byAwLiBFYXN5LCByaWdodD9cbiAgbGVuZ3RoID0gfn5NYXRoLmNlaWwoK2xlbmd0aClcbiAgcmV0dXJuIGxlbmd0aCA8IDAgPyAwIDogbGVuZ3RoXG59XG5cbmZ1bmN0aW9uIGlzQXJyYXkgKHN1YmplY3QpIHtcbiAgcmV0dXJuIChBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uIChzdWJqZWN0KSB7XG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChzdWJqZWN0KSA9PT0gJ1tvYmplY3QgQXJyYXldJ1xuICB9KShzdWJqZWN0KVxufVxuXG5mdW5jdGlvbiBpc0FycmF5aXNoIChzdWJqZWN0KSB7XG4gIHJldHVybiBpc0FycmF5KHN1YmplY3QpIHx8IEJ1ZmZlci5pc0J1ZmZlcihzdWJqZWN0KSB8fFxuICAgICAgc3ViamVjdCAmJiB0eXBlb2Ygc3ViamVjdCA9PT0gJ29iamVjdCcgJiZcbiAgICAgIHR5cGVvZiBzdWJqZWN0Lmxlbmd0aCA9PT0gJ251bWJlcidcbn1cblxuZnVuY3Rpb24gdG9IZXggKG4pIHtcbiAgaWYgKG4gPCAxNikgcmV0dXJuICcwJyArIG4udG9TdHJpbmcoMTYpXG4gIHJldHVybiBuLnRvU3RyaW5nKDE2KVxufVxuXG5mdW5jdGlvbiB1dGY4VG9CeXRlcyAoc3RyKSB7XG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIHZhciBiID0gc3RyLmNoYXJDb2RlQXQoaSlcbiAgICBpZiAoYiA8PSAweDdGKVxuICAgICAgYnl0ZUFycmF5LnB1c2goc3RyLmNoYXJDb2RlQXQoaSkpXG4gICAgZWxzZSB7XG4gICAgICB2YXIgc3RhcnQgPSBpXG4gICAgICBpZiAoYiA+PSAweEQ4MDAgJiYgYiA8PSAweERGRkYpIGkrK1xuICAgICAgdmFyIGggPSBlbmNvZGVVUklDb21wb25lbnQoc3RyLnNsaWNlKHN0YXJ0LCBpKzEpKS5zdWJzdHIoMSkuc3BsaXQoJyUnKVxuICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBoLmxlbmd0aDsgaisrKVxuICAgICAgICBieXRlQXJyYXkucHVzaChwYXJzZUludChoW2pdLCAxNikpXG4gICAgfVxuICB9XG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gYXNjaWlUb0J5dGVzIChzdHIpIHtcbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgLy8gTm9kZSdzIGNvZGUgc2VlbXMgdG8gYmUgZG9pbmcgdGhpcyBhbmQgbm90ICYgMHg3Ri4uXG4gICAgYnl0ZUFycmF5LnB1c2goc3RyLmNoYXJDb2RlQXQoaSkgJiAweEZGKVxuICB9XG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gdXRmMTZsZVRvQnl0ZXMgKHN0cikge1xuICB2YXIgYywgaGksIGxvXG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIGMgPSBzdHIuY2hhckNvZGVBdChpKVxuICAgIGhpID0gYyA+PiA4XG4gICAgbG8gPSBjICUgMjU2XG4gICAgYnl0ZUFycmF5LnB1c2gobG8pXG4gICAgYnl0ZUFycmF5LnB1c2goaGkpXG4gIH1cblxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIGJhc2U2NFRvQnl0ZXMgKHN0cikge1xuICByZXR1cm4gYmFzZTY0LnRvQnl0ZUFycmF5KHN0cilcbn1cblxuZnVuY3Rpb24gYmxpdEJ1ZmZlciAoc3JjLCBkc3QsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHZhciBwb3NcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIGlmICgoaSArIG9mZnNldCA+PSBkc3QubGVuZ3RoKSB8fCAoaSA+PSBzcmMubGVuZ3RoKSlcbiAgICAgIGJyZWFrXG4gICAgZHN0W2kgKyBvZmZzZXRdID0gc3JjW2ldXG4gIH1cbiAgcmV0dXJuIGlcbn1cblxuZnVuY3Rpb24gZGVjb2RlVXRmOENoYXIgKHN0cikge1xuICB0cnkge1xuICAgIHJldHVybiBkZWNvZGVVUklDb21wb25lbnQoc3RyKVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZSgweEZGRkQpIC8vIFVURiA4IGludmFsaWQgY2hhclxuICB9XG59XG5cbi8qXG4gKiBXZSBoYXZlIHRvIG1ha2Ugc3VyZSB0aGF0IHRoZSB2YWx1ZSBpcyBhIHZhbGlkIGludGVnZXIuIFRoaXMgbWVhbnMgdGhhdCBpdFxuICogaXMgbm9uLW5lZ2F0aXZlLiBJdCBoYXMgbm8gZnJhY3Rpb25hbCBjb21wb25lbnQgYW5kIHRoYXQgaXQgZG9lcyBub3RcbiAqIGV4Y2VlZCB0aGUgbWF4aW11bSBhbGxvd2VkIHZhbHVlLlxuICovXG5mdW5jdGlvbiB2ZXJpZnVpbnQgKHZhbHVlLCBtYXgpIHtcbiAgYXNzZXJ0KHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicsICdjYW5ub3Qgd3JpdGUgYSBub24tbnVtYmVyIGFzIGEgbnVtYmVyJylcbiAgYXNzZXJ0KHZhbHVlID49IDAsICdzcGVjaWZpZWQgYSBuZWdhdGl2ZSB2YWx1ZSBmb3Igd3JpdGluZyBhbiB1bnNpZ25lZCB2YWx1ZScpXG4gIGFzc2VydCh2YWx1ZSA8PSBtYXgsICd2YWx1ZSBpcyBsYXJnZXIgdGhhbiBtYXhpbXVtIHZhbHVlIGZvciB0eXBlJylcbiAgYXNzZXJ0KE1hdGguZmxvb3IodmFsdWUpID09PSB2YWx1ZSwgJ3ZhbHVlIGhhcyBhIGZyYWN0aW9uYWwgY29tcG9uZW50Jylcbn1cblxuZnVuY3Rpb24gdmVyaWZzaW50ICh2YWx1ZSwgbWF4LCBtaW4pIHtcbiAgYXNzZXJ0KHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicsICdjYW5ub3Qgd3JpdGUgYSBub24tbnVtYmVyIGFzIGEgbnVtYmVyJylcbiAgYXNzZXJ0KHZhbHVlIDw9IG1heCwgJ3ZhbHVlIGxhcmdlciB0aGFuIG1heGltdW0gYWxsb3dlZCB2YWx1ZScpXG4gIGFzc2VydCh2YWx1ZSA+PSBtaW4sICd2YWx1ZSBzbWFsbGVyIHRoYW4gbWluaW11bSBhbGxvd2VkIHZhbHVlJylcbiAgYXNzZXJ0KE1hdGguZmxvb3IodmFsdWUpID09PSB2YWx1ZSwgJ3ZhbHVlIGhhcyBhIGZyYWN0aW9uYWwgY29tcG9uZW50Jylcbn1cblxuZnVuY3Rpb24gdmVyaWZJRUVFNzU0ICh2YWx1ZSwgbWF4LCBtaW4pIHtcbiAgYXNzZXJ0KHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicsICdjYW5ub3Qgd3JpdGUgYSBub24tbnVtYmVyIGFzIGEgbnVtYmVyJylcbiAgYXNzZXJ0KHZhbHVlIDw9IG1heCwgJ3ZhbHVlIGxhcmdlciB0aGFuIG1heGltdW0gYWxsb3dlZCB2YWx1ZScpXG4gIGFzc2VydCh2YWx1ZSA+PSBtaW4sICd2YWx1ZSBzbWFsbGVyIHRoYW4gbWluaW11bSBhbGxvd2VkIHZhbHVlJylcbn1cblxuZnVuY3Rpb24gYXNzZXJ0ICh0ZXN0LCBtZXNzYWdlKSB7XG4gIGlmICghdGVzdCkgdGhyb3cgbmV3IEVycm9yKG1lc3NhZ2UgfHwgJ0ZhaWxlZCBhc3NlcnRpb24nKVxufVxuIiwidmFyIGxvb2t1cCA9ICdBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MDEyMzQ1Njc4OSsvJztcblxuOyhmdW5jdGlvbiAoZXhwb3J0cykge1xuXHQndXNlIHN0cmljdCc7XG5cbiAgdmFyIEFyciA9ICh0eXBlb2YgVWludDhBcnJheSAhPT0gJ3VuZGVmaW5lZCcpXG4gICAgPyBVaW50OEFycmF5XG4gICAgOiBBcnJheVxuXG5cdHZhciBQTFVTICAgPSAnKycuY2hhckNvZGVBdCgwKVxuXHR2YXIgU0xBU0ggID0gJy8nLmNoYXJDb2RlQXQoMClcblx0dmFyIE5VTUJFUiA9ICcwJy5jaGFyQ29kZUF0KDApXG5cdHZhciBMT1dFUiAgPSAnYScuY2hhckNvZGVBdCgwKVxuXHR2YXIgVVBQRVIgID0gJ0EnLmNoYXJDb2RlQXQoMClcblx0dmFyIFBMVVNfVVJMX1NBRkUgPSAnLScuY2hhckNvZGVBdCgwKVxuXHR2YXIgU0xBU0hfVVJMX1NBRkUgPSAnXycuY2hhckNvZGVBdCgwKVxuXG5cdGZ1bmN0aW9uIGRlY29kZSAoZWx0KSB7XG5cdFx0dmFyIGNvZGUgPSBlbHQuY2hhckNvZGVBdCgwKVxuXHRcdGlmIChjb2RlID09PSBQTFVTIHx8XG5cdFx0ICAgIGNvZGUgPT09IFBMVVNfVVJMX1NBRkUpXG5cdFx0XHRyZXR1cm4gNjIgLy8gJysnXG5cdFx0aWYgKGNvZGUgPT09IFNMQVNIIHx8XG5cdFx0ICAgIGNvZGUgPT09IFNMQVNIX1VSTF9TQUZFKVxuXHRcdFx0cmV0dXJuIDYzIC8vICcvJ1xuXHRcdGlmIChjb2RlIDwgTlVNQkVSKVxuXHRcdFx0cmV0dXJuIC0xIC8vbm8gbWF0Y2hcblx0XHRpZiAoY29kZSA8IE5VTUJFUiArIDEwKVxuXHRcdFx0cmV0dXJuIGNvZGUgLSBOVU1CRVIgKyAyNiArIDI2XG5cdFx0aWYgKGNvZGUgPCBVUFBFUiArIDI2KVxuXHRcdFx0cmV0dXJuIGNvZGUgLSBVUFBFUlxuXHRcdGlmIChjb2RlIDwgTE9XRVIgKyAyNilcblx0XHRcdHJldHVybiBjb2RlIC0gTE9XRVIgKyAyNlxuXHR9XG5cblx0ZnVuY3Rpb24gYjY0VG9CeXRlQXJyYXkgKGI2NCkge1xuXHRcdHZhciBpLCBqLCBsLCB0bXAsIHBsYWNlSG9sZGVycywgYXJyXG5cblx0XHRpZiAoYjY0Lmxlbmd0aCAlIDQgPiAwKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgc3RyaW5nLiBMZW5ndGggbXVzdCBiZSBhIG11bHRpcGxlIG9mIDQnKVxuXHRcdH1cblxuXHRcdC8vIHRoZSBudW1iZXIgb2YgZXF1YWwgc2lnbnMgKHBsYWNlIGhvbGRlcnMpXG5cdFx0Ly8gaWYgdGhlcmUgYXJlIHR3byBwbGFjZWhvbGRlcnMsIHRoYW4gdGhlIHR3byBjaGFyYWN0ZXJzIGJlZm9yZSBpdFxuXHRcdC8vIHJlcHJlc2VudCBvbmUgYnl0ZVxuXHRcdC8vIGlmIHRoZXJlIGlzIG9ubHkgb25lLCB0aGVuIHRoZSB0aHJlZSBjaGFyYWN0ZXJzIGJlZm9yZSBpdCByZXByZXNlbnQgMiBieXRlc1xuXHRcdC8vIHRoaXMgaXMganVzdCBhIGNoZWFwIGhhY2sgdG8gbm90IGRvIGluZGV4T2YgdHdpY2Vcblx0XHR2YXIgbGVuID0gYjY0Lmxlbmd0aFxuXHRcdHBsYWNlSG9sZGVycyA9ICc9JyA9PT0gYjY0LmNoYXJBdChsZW4gLSAyKSA/IDIgOiAnPScgPT09IGI2NC5jaGFyQXQobGVuIC0gMSkgPyAxIDogMFxuXG5cdFx0Ly8gYmFzZTY0IGlzIDQvMyArIHVwIHRvIHR3byBjaGFyYWN0ZXJzIG9mIHRoZSBvcmlnaW5hbCBkYXRhXG5cdFx0YXJyID0gbmV3IEFycihiNjQubGVuZ3RoICogMyAvIDQgLSBwbGFjZUhvbGRlcnMpXG5cblx0XHQvLyBpZiB0aGVyZSBhcmUgcGxhY2Vob2xkZXJzLCBvbmx5IGdldCB1cCB0byB0aGUgbGFzdCBjb21wbGV0ZSA0IGNoYXJzXG5cdFx0bCA9IHBsYWNlSG9sZGVycyA+IDAgPyBiNjQubGVuZ3RoIC0gNCA6IGI2NC5sZW5ndGhcblxuXHRcdHZhciBMID0gMFxuXG5cdFx0ZnVuY3Rpb24gcHVzaCAodikge1xuXHRcdFx0YXJyW0wrK10gPSB2XG5cdFx0fVxuXG5cdFx0Zm9yIChpID0gMCwgaiA9IDA7IGkgPCBsOyBpICs9IDQsIGogKz0gMykge1xuXHRcdFx0dG1wID0gKGRlY29kZShiNjQuY2hhckF0KGkpKSA8PCAxOCkgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDEpKSA8PCAxMikgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDIpKSA8PCA2KSB8IGRlY29kZShiNjQuY2hhckF0KGkgKyAzKSlcblx0XHRcdHB1c2goKHRtcCAmIDB4RkYwMDAwKSA+PiAxNilcblx0XHRcdHB1c2goKHRtcCAmIDB4RkYwMCkgPj4gOClcblx0XHRcdHB1c2godG1wICYgMHhGRilcblx0XHR9XG5cblx0XHRpZiAocGxhY2VIb2xkZXJzID09PSAyKSB7XG5cdFx0XHR0bXAgPSAoZGVjb2RlKGI2NC5jaGFyQXQoaSkpIDw8IDIpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAxKSkgPj4gNClcblx0XHRcdHB1c2godG1wICYgMHhGRilcblx0XHR9IGVsc2UgaWYgKHBsYWNlSG9sZGVycyA9PT0gMSkge1xuXHRcdFx0dG1wID0gKGRlY29kZShiNjQuY2hhckF0KGkpKSA8PCAxMCkgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDEpKSA8PCA0KSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMikpID4+IDIpXG5cdFx0XHRwdXNoKCh0bXAgPj4gOCkgJiAweEZGKVxuXHRcdFx0cHVzaCh0bXAgJiAweEZGKVxuXHRcdH1cblxuXHRcdHJldHVybiBhcnJcblx0fVxuXG5cdGZ1bmN0aW9uIHVpbnQ4VG9CYXNlNjQgKHVpbnQ4KSB7XG5cdFx0dmFyIGksXG5cdFx0XHRleHRyYUJ5dGVzID0gdWludDgubGVuZ3RoICUgMywgLy8gaWYgd2UgaGF2ZSAxIGJ5dGUgbGVmdCwgcGFkIDIgYnl0ZXNcblx0XHRcdG91dHB1dCA9IFwiXCIsXG5cdFx0XHR0ZW1wLCBsZW5ndGhcblxuXHRcdGZ1bmN0aW9uIGVuY29kZSAobnVtKSB7XG5cdFx0XHRyZXR1cm4gbG9va3VwLmNoYXJBdChudW0pXG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gdHJpcGxldFRvQmFzZTY0IChudW0pIHtcblx0XHRcdHJldHVybiBlbmNvZGUobnVtID4+IDE4ICYgMHgzRikgKyBlbmNvZGUobnVtID4+IDEyICYgMHgzRikgKyBlbmNvZGUobnVtID4+IDYgJiAweDNGKSArIGVuY29kZShudW0gJiAweDNGKVxuXHRcdH1cblxuXHRcdC8vIGdvIHRocm91Z2ggdGhlIGFycmF5IGV2ZXJ5IHRocmVlIGJ5dGVzLCB3ZSdsbCBkZWFsIHdpdGggdHJhaWxpbmcgc3R1ZmYgbGF0ZXJcblx0XHRmb3IgKGkgPSAwLCBsZW5ndGggPSB1aW50OC5sZW5ndGggLSBleHRyYUJ5dGVzOyBpIDwgbGVuZ3RoOyBpICs9IDMpIHtcblx0XHRcdHRlbXAgPSAodWludDhbaV0gPDwgMTYpICsgKHVpbnQ4W2kgKyAxXSA8PCA4KSArICh1aW50OFtpICsgMl0pXG5cdFx0XHRvdXRwdXQgKz0gdHJpcGxldFRvQmFzZTY0KHRlbXApXG5cdFx0fVxuXG5cdFx0Ly8gcGFkIHRoZSBlbmQgd2l0aCB6ZXJvcywgYnV0IG1ha2Ugc3VyZSB0byBub3QgZm9yZ2V0IHRoZSBleHRyYSBieXRlc1xuXHRcdHN3aXRjaCAoZXh0cmFCeXRlcykge1xuXHRcdFx0Y2FzZSAxOlxuXHRcdFx0XHR0ZW1wID0gdWludDhbdWludDgubGVuZ3RoIC0gMV1cblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSh0ZW1wID4+IDIpXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUoKHRlbXAgPDwgNCkgJiAweDNGKVxuXHRcdFx0XHRvdXRwdXQgKz0gJz09J1xuXHRcdFx0XHRicmVha1xuXHRcdFx0Y2FzZSAyOlxuXHRcdFx0XHR0ZW1wID0gKHVpbnQ4W3VpbnQ4Lmxlbmd0aCAtIDJdIDw8IDgpICsgKHVpbnQ4W3VpbnQ4Lmxlbmd0aCAtIDFdKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKHRlbXAgPj4gMTApXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUoKHRlbXAgPj4gNCkgJiAweDNGKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKCh0ZW1wIDw8IDIpICYgMHgzRilcblx0XHRcdFx0b3V0cHV0ICs9ICc9J1xuXHRcdFx0XHRicmVha1xuXHRcdH1cblxuXHRcdHJldHVybiBvdXRwdXRcblx0fVxuXG5cdGV4cG9ydHMudG9CeXRlQXJyYXkgPSBiNjRUb0J5dGVBcnJheVxuXHRleHBvcnRzLmZyb21CeXRlQXJyYXkgPSB1aW50OFRvQmFzZTY0XG59KHR5cGVvZiBleHBvcnRzID09PSAndW5kZWZpbmVkJyA/ICh0aGlzLmJhc2U2NGpzID0ge30pIDogZXhwb3J0cykpXG4iLCJleHBvcnRzLnJlYWQgPSBmdW5jdGlvbihidWZmZXIsIG9mZnNldCwgaXNMRSwgbUxlbiwgbkJ5dGVzKSB7XG4gIHZhciBlLCBtLFxuICAgICAgZUxlbiA9IG5CeXRlcyAqIDggLSBtTGVuIC0gMSxcbiAgICAgIGVNYXggPSAoMSA8PCBlTGVuKSAtIDEsXG4gICAgICBlQmlhcyA9IGVNYXggPj4gMSxcbiAgICAgIG5CaXRzID0gLTcsXG4gICAgICBpID0gaXNMRSA/IChuQnl0ZXMgLSAxKSA6IDAsXG4gICAgICBkID0gaXNMRSA/IC0xIDogMSxcbiAgICAgIHMgPSBidWZmZXJbb2Zmc2V0ICsgaV07XG5cbiAgaSArPSBkO1xuXG4gIGUgPSBzICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpO1xuICBzID4+PSAoLW5CaXRzKTtcbiAgbkJpdHMgKz0gZUxlbjtcbiAgZm9yICg7IG5CaXRzID4gMDsgZSA9IGUgKiAyNTYgKyBidWZmZXJbb2Zmc2V0ICsgaV0sIGkgKz0gZCwgbkJpdHMgLT0gOCk7XG5cbiAgbSA9IGUgJiAoKDEgPDwgKC1uQml0cykpIC0gMSk7XG4gIGUgPj49ICgtbkJpdHMpO1xuICBuQml0cyArPSBtTGVuO1xuICBmb3IgKDsgbkJpdHMgPiAwOyBtID0gbSAqIDI1NiArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KTtcblxuICBpZiAoZSA9PT0gMCkge1xuICAgIGUgPSAxIC0gZUJpYXM7XG4gIH0gZWxzZSBpZiAoZSA9PT0gZU1heCkge1xuICAgIHJldHVybiBtID8gTmFOIDogKChzID8gLTEgOiAxKSAqIEluZmluaXR5KTtcbiAgfSBlbHNlIHtcbiAgICBtID0gbSArIE1hdGgucG93KDIsIG1MZW4pO1xuICAgIGUgPSBlIC0gZUJpYXM7XG4gIH1cbiAgcmV0dXJuIChzID8gLTEgOiAxKSAqIG0gKiBNYXRoLnBvdygyLCBlIC0gbUxlbik7XG59O1xuXG5leHBvcnRzLndyaXRlID0gZnVuY3Rpb24oYnVmZmVyLCB2YWx1ZSwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG0sIGMsXG4gICAgICBlTGVuID0gbkJ5dGVzICogOCAtIG1MZW4gLSAxLFxuICAgICAgZU1heCA9ICgxIDw8IGVMZW4pIC0gMSxcbiAgICAgIGVCaWFzID0gZU1heCA+PiAxLFxuICAgICAgcnQgPSAobUxlbiA9PT0gMjMgPyBNYXRoLnBvdygyLCAtMjQpIC0gTWF0aC5wb3coMiwgLTc3KSA6IDApLFxuICAgICAgaSA9IGlzTEUgPyAwIDogKG5CeXRlcyAtIDEpLFxuICAgICAgZCA9IGlzTEUgPyAxIDogLTEsXG4gICAgICBzID0gdmFsdWUgPCAwIHx8ICh2YWx1ZSA9PT0gMCAmJiAxIC8gdmFsdWUgPCAwKSA/IDEgOiAwO1xuXG4gIHZhbHVlID0gTWF0aC5hYnModmFsdWUpO1xuXG4gIGlmIChpc05hTih2YWx1ZSkgfHwgdmFsdWUgPT09IEluZmluaXR5KSB7XG4gICAgbSA9IGlzTmFOKHZhbHVlKSA/IDEgOiAwO1xuICAgIGUgPSBlTWF4O1xuICB9IGVsc2Uge1xuICAgIGUgPSBNYXRoLmZsb29yKE1hdGgubG9nKHZhbHVlKSAvIE1hdGguTE4yKTtcbiAgICBpZiAodmFsdWUgKiAoYyA9IE1hdGgucG93KDIsIC1lKSkgPCAxKSB7XG4gICAgICBlLS07XG4gICAgICBjICo9IDI7XG4gICAgfVxuICAgIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgdmFsdWUgKz0gcnQgLyBjO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZSArPSBydCAqIE1hdGgucG93KDIsIDEgLSBlQmlhcyk7XG4gICAgfVxuICAgIGlmICh2YWx1ZSAqIGMgPj0gMikge1xuICAgICAgZSsrO1xuICAgICAgYyAvPSAyO1xuICAgIH1cblxuICAgIGlmIChlICsgZUJpYXMgPj0gZU1heCkge1xuICAgICAgbSA9IDA7XG4gICAgICBlID0gZU1heDtcbiAgICB9IGVsc2UgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICBtID0gKHZhbHVlICogYyAtIDEpICogTWF0aC5wb3coMiwgbUxlbik7XG4gICAgICBlID0gZSArIGVCaWFzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gdmFsdWUgKiBNYXRoLnBvdygyLCBlQmlhcyAtIDEpICogTWF0aC5wb3coMiwgbUxlbik7XG4gICAgICBlID0gMDtcbiAgICB9XG4gIH1cblxuICBmb3IgKDsgbUxlbiA+PSA4OyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBtICYgMHhmZiwgaSArPSBkLCBtIC89IDI1NiwgbUxlbiAtPSA4KTtcblxuICBlID0gKGUgPDwgbUxlbikgfCBtO1xuICBlTGVuICs9IG1MZW47XG4gIGZvciAoOyBlTGVuID4gMDsgYnVmZmVyW29mZnNldCArIGldID0gZSAmIDB4ZmYsIGkgKz0gZCwgZSAvPSAyNTYsIGVMZW4gLT0gOCk7XG5cbiAgYnVmZmVyW29mZnNldCArIGkgLSBkXSB8PSBzICogMTI4O1xufTtcbiIsInZhciBCdWZmZXIgPSByZXF1aXJlKCdidWZmZXInKS5CdWZmZXI7XG52YXIgaW50U2l6ZSA9IDQ7XG52YXIgemVyb0J1ZmZlciA9IG5ldyBCdWZmZXIoaW50U2l6ZSk7IHplcm9CdWZmZXIuZmlsbCgwKTtcbnZhciBjaHJzeiA9IDg7XG5cbmZ1bmN0aW9uIHRvQXJyYXkoYnVmLCBiaWdFbmRpYW4pIHtcbiAgaWYgKChidWYubGVuZ3RoICUgaW50U2l6ZSkgIT09IDApIHtcbiAgICB2YXIgbGVuID0gYnVmLmxlbmd0aCArIChpbnRTaXplIC0gKGJ1Zi5sZW5ndGggJSBpbnRTaXplKSk7XG4gICAgYnVmID0gQnVmZmVyLmNvbmNhdChbYnVmLCB6ZXJvQnVmZmVyXSwgbGVuKTtcbiAgfVxuXG4gIHZhciBhcnIgPSBbXTtcbiAgdmFyIGZuID0gYmlnRW5kaWFuID8gYnVmLnJlYWRJbnQzMkJFIDogYnVmLnJlYWRJbnQzMkxFO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGJ1Zi5sZW5ndGg7IGkgKz0gaW50U2l6ZSkge1xuICAgIGFyci5wdXNoKGZuLmNhbGwoYnVmLCBpKSk7XG4gIH1cbiAgcmV0dXJuIGFycjtcbn1cblxuZnVuY3Rpb24gdG9CdWZmZXIoYXJyLCBzaXplLCBiaWdFbmRpYW4pIHtcbiAgdmFyIGJ1ZiA9IG5ldyBCdWZmZXIoc2l6ZSk7XG4gIHZhciBmbiA9IGJpZ0VuZGlhbiA/IGJ1Zi53cml0ZUludDMyQkUgOiBidWYud3JpdGVJbnQzMkxFO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGFyci5sZW5ndGg7IGkrKykge1xuICAgIGZuLmNhbGwoYnVmLCBhcnJbaV0sIGkgKiA0LCB0cnVlKTtcbiAgfVxuICByZXR1cm4gYnVmO1xufVxuXG5mdW5jdGlvbiBoYXNoKGJ1ZiwgZm4sIGhhc2hTaXplLCBiaWdFbmRpYW4pIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYnVmKSkgYnVmID0gbmV3IEJ1ZmZlcihidWYpO1xuICB2YXIgYXJyID0gZm4odG9BcnJheShidWYsIGJpZ0VuZGlhbiksIGJ1Zi5sZW5ndGggKiBjaHJzeik7XG4gIHJldHVybiB0b0J1ZmZlcihhcnIsIGhhc2hTaXplLCBiaWdFbmRpYW4pO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHsgaGFzaDogaGFzaCB9O1xuIiwidmFyIEJ1ZmZlciA9IHJlcXVpcmUoJ2J1ZmZlcicpLkJ1ZmZlclxudmFyIHNoYSA9IHJlcXVpcmUoJy4vc2hhJylcbnZhciBzaGEyNTYgPSByZXF1aXJlKCcuL3NoYTI1NicpXG52YXIgcm5nID0gcmVxdWlyZSgnLi9ybmcnKVxudmFyIG1kNSA9IHJlcXVpcmUoJy4vbWQ1JylcblxudmFyIGFsZ29yaXRobXMgPSB7XG4gIHNoYTE6IHNoYSxcbiAgc2hhMjU2OiBzaGEyNTYsXG4gIG1kNTogbWQ1XG59XG5cbnZhciBibG9ja3NpemUgPSA2NFxudmFyIHplcm9CdWZmZXIgPSBuZXcgQnVmZmVyKGJsb2Nrc2l6ZSk7IHplcm9CdWZmZXIuZmlsbCgwKVxuZnVuY3Rpb24gaG1hYyhmbiwga2V5LCBkYXRhKSB7XG4gIGlmKCFCdWZmZXIuaXNCdWZmZXIoa2V5KSkga2V5ID0gbmV3IEJ1ZmZlcihrZXkpXG4gIGlmKCFCdWZmZXIuaXNCdWZmZXIoZGF0YSkpIGRhdGEgPSBuZXcgQnVmZmVyKGRhdGEpXG5cbiAgaWYoa2V5Lmxlbmd0aCA+IGJsb2Nrc2l6ZSkge1xuICAgIGtleSA9IGZuKGtleSlcbiAgfSBlbHNlIGlmKGtleS5sZW5ndGggPCBibG9ja3NpemUpIHtcbiAgICBrZXkgPSBCdWZmZXIuY29uY2F0KFtrZXksIHplcm9CdWZmZXJdLCBibG9ja3NpemUpXG4gIH1cblxuICB2YXIgaXBhZCA9IG5ldyBCdWZmZXIoYmxvY2tzaXplKSwgb3BhZCA9IG5ldyBCdWZmZXIoYmxvY2tzaXplKVxuICBmb3IodmFyIGkgPSAwOyBpIDwgYmxvY2tzaXplOyBpKyspIHtcbiAgICBpcGFkW2ldID0ga2V5W2ldIF4gMHgzNlxuICAgIG9wYWRbaV0gPSBrZXlbaV0gXiAweDVDXG4gIH1cblxuICB2YXIgaGFzaCA9IGZuKEJ1ZmZlci5jb25jYXQoW2lwYWQsIGRhdGFdKSlcbiAgcmV0dXJuIGZuKEJ1ZmZlci5jb25jYXQoW29wYWQsIGhhc2hdKSlcbn1cblxuZnVuY3Rpb24gaGFzaChhbGcsIGtleSkge1xuICBhbGcgPSBhbGcgfHwgJ3NoYTEnXG4gIHZhciBmbiA9IGFsZ29yaXRobXNbYWxnXVxuICB2YXIgYnVmcyA9IFtdXG4gIHZhciBsZW5ndGggPSAwXG4gIGlmKCFmbikgZXJyb3IoJ2FsZ29yaXRobTonLCBhbGcsICdpcyBub3QgeWV0IHN1cHBvcnRlZCcpXG4gIHJldHVybiB7XG4gICAgdXBkYXRlOiBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgaWYoIUJ1ZmZlci5pc0J1ZmZlcihkYXRhKSkgZGF0YSA9IG5ldyBCdWZmZXIoZGF0YSlcbiAgICAgICAgXG4gICAgICBidWZzLnB1c2goZGF0YSlcbiAgICAgIGxlbmd0aCArPSBkYXRhLmxlbmd0aFxuICAgICAgcmV0dXJuIHRoaXNcbiAgICB9LFxuICAgIGRpZ2VzdDogZnVuY3Rpb24gKGVuYykge1xuICAgICAgdmFyIGJ1ZiA9IEJ1ZmZlci5jb25jYXQoYnVmcylcbiAgICAgIHZhciByID0ga2V5ID8gaG1hYyhmbiwga2V5LCBidWYpIDogZm4oYnVmKVxuICAgICAgYnVmcyA9IG51bGxcbiAgICAgIHJldHVybiBlbmMgPyByLnRvU3RyaW5nKGVuYykgOiByXG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGVycm9yICgpIHtcbiAgdmFyIG0gPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cykuam9pbignICcpXG4gIHRocm93IG5ldyBFcnJvcihbXG4gICAgbSxcbiAgICAnd2UgYWNjZXB0IHB1bGwgcmVxdWVzdHMnLFxuICAgICdodHRwOi8vZ2l0aHViLmNvbS9kb21pbmljdGFyci9jcnlwdG8tYnJvd3NlcmlmeSdcbiAgICBdLmpvaW4oJ1xcbicpKVxufVxuXG5leHBvcnRzLmNyZWF0ZUhhc2ggPSBmdW5jdGlvbiAoYWxnKSB7IHJldHVybiBoYXNoKGFsZykgfVxuZXhwb3J0cy5jcmVhdGVIbWFjID0gZnVuY3Rpb24gKGFsZywga2V5KSB7IHJldHVybiBoYXNoKGFsZywga2V5KSB9XG5leHBvcnRzLnJhbmRvbUJ5dGVzID0gZnVuY3Rpb24oc2l6ZSwgY2FsbGJhY2spIHtcbiAgaWYgKGNhbGxiYWNrICYmIGNhbGxiYWNrLmNhbGwpIHtcbiAgICB0cnkge1xuICAgICAgY2FsbGJhY2suY2FsbCh0aGlzLCB1bmRlZmluZWQsIG5ldyBCdWZmZXIocm5nKHNpemUpKSlcbiAgICB9IGNhdGNoIChlcnIpIHsgY2FsbGJhY2soZXJyKSB9XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG5ldyBCdWZmZXIocm5nKHNpemUpKVxuICB9XG59XG5cbmZ1bmN0aW9uIGVhY2goYSwgZikge1xuICBmb3IodmFyIGkgaW4gYSlcbiAgICBmKGFbaV0sIGkpXG59XG5cbi8vIHRoZSBsZWFzdCBJIGNhbiBkbyBpcyBtYWtlIGVycm9yIG1lc3NhZ2VzIGZvciB0aGUgcmVzdCBvZiB0aGUgbm9kZS5qcy9jcnlwdG8gYXBpLlxuZWFjaChbJ2NyZWF0ZUNyZWRlbnRpYWxzJ1xuLCAnY3JlYXRlQ2lwaGVyJ1xuLCAnY3JlYXRlQ2lwaGVyaXYnXG4sICdjcmVhdGVEZWNpcGhlcidcbiwgJ2NyZWF0ZURlY2lwaGVyaXYnXG4sICdjcmVhdGVTaWduJ1xuLCAnY3JlYXRlVmVyaWZ5J1xuLCAnY3JlYXRlRGlmZmllSGVsbG1hbidcbiwgJ3Bia2RmMiddLCBmdW5jdGlvbiAobmFtZSkge1xuICBleHBvcnRzW25hbWVdID0gZnVuY3Rpb24gKCkge1xuICAgIGVycm9yKCdzb3JyeSwnLCBuYW1lLCAnaXMgbm90IGltcGxlbWVudGVkIHlldCcpXG4gIH1cbn0pXG4iLCIvKlxyXG4gKiBBIEphdmFTY3JpcHQgaW1wbGVtZW50YXRpb24gb2YgdGhlIFJTQSBEYXRhIFNlY3VyaXR5LCBJbmMuIE1ENSBNZXNzYWdlXHJcbiAqIERpZ2VzdCBBbGdvcml0aG0sIGFzIGRlZmluZWQgaW4gUkZDIDEzMjEuXHJcbiAqIFZlcnNpb24gMi4xIENvcHlyaWdodCAoQykgUGF1bCBKb2huc3RvbiAxOTk5IC0gMjAwMi5cclxuICogT3RoZXIgY29udHJpYnV0b3JzOiBHcmVnIEhvbHQsIEFuZHJldyBLZXBlcnQsIFlkbmFyLCBMb3N0aW5ldFxyXG4gKiBEaXN0cmlidXRlZCB1bmRlciB0aGUgQlNEIExpY2Vuc2VcclxuICogU2VlIGh0dHA6Ly9wYWpob21lLm9yZy51ay9jcnlwdC9tZDUgZm9yIG1vcmUgaW5mby5cclxuICovXHJcblxyXG52YXIgaGVscGVycyA9IHJlcXVpcmUoJy4vaGVscGVycycpO1xyXG5cclxuLypcclxuICogUGVyZm9ybSBhIHNpbXBsZSBzZWxmLXRlc3QgdG8gc2VlIGlmIHRoZSBWTSBpcyB3b3JraW5nXHJcbiAqL1xyXG5mdW5jdGlvbiBtZDVfdm1fdGVzdCgpXHJcbntcclxuICByZXR1cm4gaGV4X21kNShcImFiY1wiKSA9PSBcIjkwMDE1MDk4M2NkMjRmYjBkNjk2M2Y3ZDI4ZTE3ZjcyXCI7XHJcbn1cclxuXHJcbi8qXHJcbiAqIENhbGN1bGF0ZSB0aGUgTUQ1IG9mIGFuIGFycmF5IG9mIGxpdHRsZS1lbmRpYW4gd29yZHMsIGFuZCBhIGJpdCBsZW5ndGhcclxuICovXHJcbmZ1bmN0aW9uIGNvcmVfbWQ1KHgsIGxlbilcclxue1xyXG4gIC8qIGFwcGVuZCBwYWRkaW5nICovXHJcbiAgeFtsZW4gPj4gNV0gfD0gMHg4MCA8PCAoKGxlbikgJSAzMik7XHJcbiAgeFsoKChsZW4gKyA2NCkgPj4+IDkpIDw8IDQpICsgMTRdID0gbGVuO1xyXG5cclxuICB2YXIgYSA9ICAxNzMyNTg0MTkzO1xyXG4gIHZhciBiID0gLTI3MTczMzg3OTtcclxuICB2YXIgYyA9IC0xNzMyNTg0MTk0O1xyXG4gIHZhciBkID0gIDI3MTczMzg3ODtcclxuXHJcbiAgZm9yKHZhciBpID0gMDsgaSA8IHgubGVuZ3RoOyBpICs9IDE2KVxyXG4gIHtcclxuICAgIHZhciBvbGRhID0gYTtcclxuICAgIHZhciBvbGRiID0gYjtcclxuICAgIHZhciBvbGRjID0gYztcclxuICAgIHZhciBvbGRkID0gZDtcclxuXHJcbiAgICBhID0gbWQ1X2ZmKGEsIGIsIGMsIGQsIHhbaSsgMF0sIDcgLCAtNjgwODc2OTM2KTtcclxuICAgIGQgPSBtZDVfZmYoZCwgYSwgYiwgYywgeFtpKyAxXSwgMTIsIC0zODk1NjQ1ODYpO1xyXG4gICAgYyA9IG1kNV9mZihjLCBkLCBhLCBiLCB4W2krIDJdLCAxNywgIDYwNjEwNTgxOSk7XHJcbiAgICBiID0gbWQ1X2ZmKGIsIGMsIGQsIGEsIHhbaSsgM10sIDIyLCAtMTA0NDUyNTMzMCk7XHJcbiAgICBhID0gbWQ1X2ZmKGEsIGIsIGMsIGQsIHhbaSsgNF0sIDcgLCAtMTc2NDE4ODk3KTtcclxuICAgIGQgPSBtZDVfZmYoZCwgYSwgYiwgYywgeFtpKyA1XSwgMTIsICAxMjAwMDgwNDI2KTtcclxuICAgIGMgPSBtZDVfZmYoYywgZCwgYSwgYiwgeFtpKyA2XSwgMTcsIC0xNDczMjMxMzQxKTtcclxuICAgIGIgPSBtZDVfZmYoYiwgYywgZCwgYSwgeFtpKyA3XSwgMjIsIC00NTcwNTk4Myk7XHJcbiAgICBhID0gbWQ1X2ZmKGEsIGIsIGMsIGQsIHhbaSsgOF0sIDcgLCAgMTc3MDAzNTQxNik7XHJcbiAgICBkID0gbWQ1X2ZmKGQsIGEsIGIsIGMsIHhbaSsgOV0sIDEyLCAtMTk1ODQxNDQxNyk7XHJcbiAgICBjID0gbWQ1X2ZmKGMsIGQsIGEsIGIsIHhbaSsxMF0sIDE3LCAtNDIwNjMpO1xyXG4gICAgYiA9IG1kNV9mZihiLCBjLCBkLCBhLCB4W2krMTFdLCAyMiwgLTE5OTA0MDQxNjIpO1xyXG4gICAgYSA9IG1kNV9mZihhLCBiLCBjLCBkLCB4W2krMTJdLCA3ICwgIDE4MDQ2MDM2ODIpO1xyXG4gICAgZCA9IG1kNV9mZihkLCBhLCBiLCBjLCB4W2krMTNdLCAxMiwgLTQwMzQxMTAxKTtcclxuICAgIGMgPSBtZDVfZmYoYywgZCwgYSwgYiwgeFtpKzE0XSwgMTcsIC0xNTAyMDAyMjkwKTtcclxuICAgIGIgPSBtZDVfZmYoYiwgYywgZCwgYSwgeFtpKzE1XSwgMjIsICAxMjM2NTM1MzI5KTtcclxuXHJcbiAgICBhID0gbWQ1X2dnKGEsIGIsIGMsIGQsIHhbaSsgMV0sIDUgLCAtMTY1Nzk2NTEwKTtcclxuICAgIGQgPSBtZDVfZ2coZCwgYSwgYiwgYywgeFtpKyA2XSwgOSAsIC0xMDY5NTAxNjMyKTtcclxuICAgIGMgPSBtZDVfZ2coYywgZCwgYSwgYiwgeFtpKzExXSwgMTQsICA2NDM3MTc3MTMpO1xyXG4gICAgYiA9IG1kNV9nZyhiLCBjLCBkLCBhLCB4W2krIDBdLCAyMCwgLTM3Mzg5NzMwMik7XHJcbiAgICBhID0gbWQ1X2dnKGEsIGIsIGMsIGQsIHhbaSsgNV0sIDUgLCAtNzAxNTU4NjkxKTtcclxuICAgIGQgPSBtZDVfZ2coZCwgYSwgYiwgYywgeFtpKzEwXSwgOSAsICAzODAxNjA4Myk7XHJcbiAgICBjID0gbWQ1X2dnKGMsIGQsIGEsIGIsIHhbaSsxNV0sIDE0LCAtNjYwNDc4MzM1KTtcclxuICAgIGIgPSBtZDVfZ2coYiwgYywgZCwgYSwgeFtpKyA0XSwgMjAsIC00MDU1Mzc4NDgpO1xyXG4gICAgYSA9IG1kNV9nZyhhLCBiLCBjLCBkLCB4W2krIDldLCA1ICwgIDU2ODQ0NjQzOCk7XHJcbiAgICBkID0gbWQ1X2dnKGQsIGEsIGIsIGMsIHhbaSsxNF0sIDkgLCAtMTAxOTgwMzY5MCk7XHJcbiAgICBjID0gbWQ1X2dnKGMsIGQsIGEsIGIsIHhbaSsgM10sIDE0LCAtMTg3MzYzOTYxKTtcclxuICAgIGIgPSBtZDVfZ2coYiwgYywgZCwgYSwgeFtpKyA4XSwgMjAsICAxMTYzNTMxNTAxKTtcclxuICAgIGEgPSBtZDVfZ2coYSwgYiwgYywgZCwgeFtpKzEzXSwgNSAsIC0xNDQ0NjgxNDY3KTtcclxuICAgIGQgPSBtZDVfZ2coZCwgYSwgYiwgYywgeFtpKyAyXSwgOSAsIC01MTQwMzc4NCk7XHJcbiAgICBjID0gbWQ1X2dnKGMsIGQsIGEsIGIsIHhbaSsgN10sIDE0LCAgMTczNTMyODQ3Myk7XHJcbiAgICBiID0gbWQ1X2dnKGIsIGMsIGQsIGEsIHhbaSsxMl0sIDIwLCAtMTkyNjYwNzczNCk7XHJcblxyXG4gICAgYSA9IG1kNV9oaChhLCBiLCBjLCBkLCB4W2krIDVdLCA0ICwgLTM3ODU1OCk7XHJcbiAgICBkID0gbWQ1X2hoKGQsIGEsIGIsIGMsIHhbaSsgOF0sIDExLCAtMjAyMjU3NDQ2Myk7XHJcbiAgICBjID0gbWQ1X2hoKGMsIGQsIGEsIGIsIHhbaSsxMV0sIDE2LCAgMTgzOTAzMDU2Mik7XHJcbiAgICBiID0gbWQ1X2hoKGIsIGMsIGQsIGEsIHhbaSsxNF0sIDIzLCAtMzUzMDk1NTYpO1xyXG4gICAgYSA9IG1kNV9oaChhLCBiLCBjLCBkLCB4W2krIDFdLCA0ICwgLTE1MzA5OTIwNjApO1xyXG4gICAgZCA9IG1kNV9oaChkLCBhLCBiLCBjLCB4W2krIDRdLCAxMSwgIDEyNzI4OTMzNTMpO1xyXG4gICAgYyA9IG1kNV9oaChjLCBkLCBhLCBiLCB4W2krIDddLCAxNiwgLTE1NTQ5NzYzMik7XHJcbiAgICBiID0gbWQ1X2hoKGIsIGMsIGQsIGEsIHhbaSsxMF0sIDIzLCAtMTA5NDczMDY0MCk7XHJcbiAgICBhID0gbWQ1X2hoKGEsIGIsIGMsIGQsIHhbaSsxM10sIDQgLCAgNjgxMjc5MTc0KTtcclxuICAgIGQgPSBtZDVfaGgoZCwgYSwgYiwgYywgeFtpKyAwXSwgMTEsIC0zNTg1MzcyMjIpO1xyXG4gICAgYyA9IG1kNV9oaChjLCBkLCBhLCBiLCB4W2krIDNdLCAxNiwgLTcyMjUyMTk3OSk7XHJcbiAgICBiID0gbWQ1X2hoKGIsIGMsIGQsIGEsIHhbaSsgNl0sIDIzLCAgNzYwMjkxODkpO1xyXG4gICAgYSA9IG1kNV9oaChhLCBiLCBjLCBkLCB4W2krIDldLCA0ICwgLTY0MDM2NDQ4Nyk7XHJcbiAgICBkID0gbWQ1X2hoKGQsIGEsIGIsIGMsIHhbaSsxMl0sIDExLCAtNDIxODE1ODM1KTtcclxuICAgIGMgPSBtZDVfaGgoYywgZCwgYSwgYiwgeFtpKzE1XSwgMTYsICA1MzA3NDI1MjApO1xyXG4gICAgYiA9IG1kNV9oaChiLCBjLCBkLCBhLCB4W2krIDJdLCAyMywgLTk5NTMzODY1MSk7XHJcblxyXG4gICAgYSA9IG1kNV9paShhLCBiLCBjLCBkLCB4W2krIDBdLCA2ICwgLTE5ODYzMDg0NCk7XHJcbiAgICBkID0gbWQ1X2lpKGQsIGEsIGIsIGMsIHhbaSsgN10sIDEwLCAgMTEyNjg5MTQxNSk7XHJcbiAgICBjID0gbWQ1X2lpKGMsIGQsIGEsIGIsIHhbaSsxNF0sIDE1LCAtMTQxNjM1NDkwNSk7XHJcbiAgICBiID0gbWQ1X2lpKGIsIGMsIGQsIGEsIHhbaSsgNV0sIDIxLCAtNTc0MzQwNTUpO1xyXG4gICAgYSA9IG1kNV9paShhLCBiLCBjLCBkLCB4W2krMTJdLCA2ICwgIDE3MDA0ODU1NzEpO1xyXG4gICAgZCA9IG1kNV9paShkLCBhLCBiLCBjLCB4W2krIDNdLCAxMCwgLTE4OTQ5ODY2MDYpO1xyXG4gICAgYyA9IG1kNV9paShjLCBkLCBhLCBiLCB4W2krMTBdLCAxNSwgLTEwNTE1MjMpO1xyXG4gICAgYiA9IG1kNV9paShiLCBjLCBkLCBhLCB4W2krIDFdLCAyMSwgLTIwNTQ5MjI3OTkpO1xyXG4gICAgYSA9IG1kNV9paShhLCBiLCBjLCBkLCB4W2krIDhdLCA2ICwgIDE4NzMzMTMzNTkpO1xyXG4gICAgZCA9IG1kNV9paShkLCBhLCBiLCBjLCB4W2krMTVdLCAxMCwgLTMwNjExNzQ0KTtcclxuICAgIGMgPSBtZDVfaWkoYywgZCwgYSwgYiwgeFtpKyA2XSwgMTUsIC0xNTYwMTk4MzgwKTtcclxuICAgIGIgPSBtZDVfaWkoYiwgYywgZCwgYSwgeFtpKzEzXSwgMjEsICAxMzA5MTUxNjQ5KTtcclxuICAgIGEgPSBtZDVfaWkoYSwgYiwgYywgZCwgeFtpKyA0XSwgNiAsIC0xNDU1MjMwNzApO1xyXG4gICAgZCA9IG1kNV9paShkLCBhLCBiLCBjLCB4W2krMTFdLCAxMCwgLTExMjAyMTAzNzkpO1xyXG4gICAgYyA9IG1kNV9paShjLCBkLCBhLCBiLCB4W2krIDJdLCAxNSwgIDcxODc4NzI1OSk7XHJcbiAgICBiID0gbWQ1X2lpKGIsIGMsIGQsIGEsIHhbaSsgOV0sIDIxLCAtMzQzNDg1NTUxKTtcclxuXHJcbiAgICBhID0gc2FmZV9hZGQoYSwgb2xkYSk7XHJcbiAgICBiID0gc2FmZV9hZGQoYiwgb2xkYik7XHJcbiAgICBjID0gc2FmZV9hZGQoYywgb2xkYyk7XHJcbiAgICBkID0gc2FmZV9hZGQoZCwgb2xkZCk7XHJcbiAgfVxyXG4gIHJldHVybiBBcnJheShhLCBiLCBjLCBkKTtcclxuXHJcbn1cclxuXHJcbi8qXHJcbiAqIFRoZXNlIGZ1bmN0aW9ucyBpbXBsZW1lbnQgdGhlIGZvdXIgYmFzaWMgb3BlcmF0aW9ucyB0aGUgYWxnb3JpdGhtIHVzZXMuXHJcbiAqL1xyXG5mdW5jdGlvbiBtZDVfY21uKHEsIGEsIGIsIHgsIHMsIHQpXHJcbntcclxuICByZXR1cm4gc2FmZV9hZGQoYml0X3JvbChzYWZlX2FkZChzYWZlX2FkZChhLCBxKSwgc2FmZV9hZGQoeCwgdCkpLCBzKSxiKTtcclxufVxyXG5mdW5jdGlvbiBtZDVfZmYoYSwgYiwgYywgZCwgeCwgcywgdClcclxue1xyXG4gIHJldHVybiBtZDVfY21uKChiICYgYykgfCAoKH5iKSAmIGQpLCBhLCBiLCB4LCBzLCB0KTtcclxufVxyXG5mdW5jdGlvbiBtZDVfZ2coYSwgYiwgYywgZCwgeCwgcywgdClcclxue1xyXG4gIHJldHVybiBtZDVfY21uKChiICYgZCkgfCAoYyAmICh+ZCkpLCBhLCBiLCB4LCBzLCB0KTtcclxufVxyXG5mdW5jdGlvbiBtZDVfaGgoYSwgYiwgYywgZCwgeCwgcywgdClcclxue1xyXG4gIHJldHVybiBtZDVfY21uKGIgXiBjIF4gZCwgYSwgYiwgeCwgcywgdCk7XHJcbn1cclxuZnVuY3Rpb24gbWQ1X2lpKGEsIGIsIGMsIGQsIHgsIHMsIHQpXHJcbntcclxuICByZXR1cm4gbWQ1X2NtbihjIF4gKGIgfCAofmQpKSwgYSwgYiwgeCwgcywgdCk7XHJcbn1cclxuXHJcbi8qXHJcbiAqIEFkZCBpbnRlZ2Vycywgd3JhcHBpbmcgYXQgMl4zMi4gVGhpcyB1c2VzIDE2LWJpdCBvcGVyYXRpb25zIGludGVybmFsbHlcclxuICogdG8gd29yayBhcm91bmQgYnVncyBpbiBzb21lIEpTIGludGVycHJldGVycy5cclxuICovXHJcbmZ1bmN0aW9uIHNhZmVfYWRkKHgsIHkpXHJcbntcclxuICB2YXIgbHN3ID0gKHggJiAweEZGRkYpICsgKHkgJiAweEZGRkYpO1xyXG4gIHZhciBtc3cgPSAoeCA+PiAxNikgKyAoeSA+PiAxNikgKyAobHN3ID4+IDE2KTtcclxuICByZXR1cm4gKG1zdyA8PCAxNikgfCAobHN3ICYgMHhGRkZGKTtcclxufVxyXG5cclxuLypcclxuICogQml0d2lzZSByb3RhdGUgYSAzMi1iaXQgbnVtYmVyIHRvIHRoZSBsZWZ0LlxyXG4gKi9cclxuZnVuY3Rpb24gYml0X3JvbChudW0sIGNudClcclxue1xyXG4gIHJldHVybiAobnVtIDw8IGNudCkgfCAobnVtID4+PiAoMzIgLSBjbnQpKTtcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBtZDUoYnVmKSB7XHJcbiAgcmV0dXJuIGhlbHBlcnMuaGFzaChidWYsIGNvcmVfbWQ1LCAxNik7XHJcbn07XHJcbiIsIi8vIE9yaWdpbmFsIGNvZGUgYWRhcHRlZCBmcm9tIFJvYmVydCBLaWVmZmVyLlxuLy8gZGV0YWlscyBhdCBodHRwczovL2dpdGh1Yi5jb20vYnJvb2ZhL25vZGUtdXVpZFxuKGZ1bmN0aW9uKCkge1xuICB2YXIgX2dsb2JhbCA9IHRoaXM7XG5cbiAgdmFyIG1hdGhSTkcsIHdoYXR3Z1JORztcblxuICAvLyBOT1RFOiBNYXRoLnJhbmRvbSgpIGRvZXMgbm90IGd1YXJhbnRlZSBcImNyeXB0b2dyYXBoaWMgcXVhbGl0eVwiXG4gIG1hdGhSTkcgPSBmdW5jdGlvbihzaXplKSB7XG4gICAgdmFyIGJ5dGVzID0gbmV3IEFycmF5KHNpemUpO1xuICAgIHZhciByO1xuXG4gICAgZm9yICh2YXIgaSA9IDAsIHI7IGkgPCBzaXplOyBpKyspIHtcbiAgICAgIGlmICgoaSAmIDB4MDMpID09IDApIHIgPSBNYXRoLnJhbmRvbSgpICogMHgxMDAwMDAwMDA7XG4gICAgICBieXRlc1tpXSA9IHIgPj4+ICgoaSAmIDB4MDMpIDw8IDMpICYgMHhmZjtcbiAgICB9XG5cbiAgICByZXR1cm4gYnl0ZXM7XG4gIH1cblxuICBpZiAoX2dsb2JhbC5jcnlwdG8gJiYgY3J5cHRvLmdldFJhbmRvbVZhbHVlcykge1xuICAgIHdoYXR3Z1JORyA9IGZ1bmN0aW9uKHNpemUpIHtcbiAgICAgIHZhciBieXRlcyA9IG5ldyBVaW50OEFycmF5KHNpemUpO1xuICAgICAgY3J5cHRvLmdldFJhbmRvbVZhbHVlcyhieXRlcyk7XG4gICAgICByZXR1cm4gYnl0ZXM7XG4gICAgfVxuICB9XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSB3aGF0d2dSTkcgfHwgbWF0aFJORztcblxufSgpKVxuIiwiLypcbiAqIEEgSmF2YVNjcmlwdCBpbXBsZW1lbnRhdGlvbiBvZiB0aGUgU2VjdXJlIEhhc2ggQWxnb3JpdGhtLCBTSEEtMSwgYXMgZGVmaW5lZFxuICogaW4gRklQUyBQVUIgMTgwLTFcbiAqIFZlcnNpb24gMi4xYSBDb3B5cmlnaHQgUGF1bCBKb2huc3RvbiAyMDAwIC0gMjAwMi5cbiAqIE90aGVyIGNvbnRyaWJ1dG9yczogR3JlZyBIb2x0LCBBbmRyZXcgS2VwZXJ0LCBZZG5hciwgTG9zdGluZXRcbiAqIERpc3RyaWJ1dGVkIHVuZGVyIHRoZSBCU0QgTGljZW5zZVxuICogU2VlIGh0dHA6Ly9wYWpob21lLm9yZy51ay9jcnlwdC9tZDUgZm9yIGRldGFpbHMuXG4gKi9cblxudmFyIGhlbHBlcnMgPSByZXF1aXJlKCcuL2hlbHBlcnMnKTtcblxuLypcbiAqIENhbGN1bGF0ZSB0aGUgU0hBLTEgb2YgYW4gYXJyYXkgb2YgYmlnLWVuZGlhbiB3b3JkcywgYW5kIGEgYml0IGxlbmd0aFxuICovXG5mdW5jdGlvbiBjb3JlX3NoYTEoeCwgbGVuKVxue1xuICAvKiBhcHBlbmQgcGFkZGluZyAqL1xuICB4W2xlbiA+PiA1XSB8PSAweDgwIDw8ICgyNCAtIGxlbiAlIDMyKTtcbiAgeFsoKGxlbiArIDY0ID4+IDkpIDw8IDQpICsgMTVdID0gbGVuO1xuXG4gIHZhciB3ID0gQXJyYXkoODApO1xuICB2YXIgYSA9ICAxNzMyNTg0MTkzO1xuICB2YXIgYiA9IC0yNzE3MzM4Nzk7XG4gIHZhciBjID0gLTE3MzI1ODQxOTQ7XG4gIHZhciBkID0gIDI3MTczMzg3ODtcbiAgdmFyIGUgPSAtMTAwOTU4OTc3NjtcblxuICBmb3IodmFyIGkgPSAwOyBpIDwgeC5sZW5ndGg7IGkgKz0gMTYpXG4gIHtcbiAgICB2YXIgb2xkYSA9IGE7XG4gICAgdmFyIG9sZGIgPSBiO1xuICAgIHZhciBvbGRjID0gYztcbiAgICB2YXIgb2xkZCA9IGQ7XG4gICAgdmFyIG9sZGUgPSBlO1xuXG4gICAgZm9yKHZhciBqID0gMDsgaiA8IDgwOyBqKyspXG4gICAge1xuICAgICAgaWYoaiA8IDE2KSB3W2pdID0geFtpICsgal07XG4gICAgICBlbHNlIHdbal0gPSByb2wod1tqLTNdIF4gd1tqLThdIF4gd1tqLTE0XSBeIHdbai0xNl0sIDEpO1xuICAgICAgdmFyIHQgPSBzYWZlX2FkZChzYWZlX2FkZChyb2woYSwgNSksIHNoYTFfZnQoaiwgYiwgYywgZCkpLFxuICAgICAgICAgICAgICAgICAgICAgICBzYWZlX2FkZChzYWZlX2FkZChlLCB3W2pdKSwgc2hhMV9rdChqKSkpO1xuICAgICAgZSA9IGQ7XG4gICAgICBkID0gYztcbiAgICAgIGMgPSByb2woYiwgMzApO1xuICAgICAgYiA9IGE7XG4gICAgICBhID0gdDtcbiAgICB9XG5cbiAgICBhID0gc2FmZV9hZGQoYSwgb2xkYSk7XG4gICAgYiA9IHNhZmVfYWRkKGIsIG9sZGIpO1xuICAgIGMgPSBzYWZlX2FkZChjLCBvbGRjKTtcbiAgICBkID0gc2FmZV9hZGQoZCwgb2xkZCk7XG4gICAgZSA9IHNhZmVfYWRkKGUsIG9sZGUpO1xuICB9XG4gIHJldHVybiBBcnJheShhLCBiLCBjLCBkLCBlKTtcblxufVxuXG4vKlxuICogUGVyZm9ybSB0aGUgYXBwcm9wcmlhdGUgdHJpcGxldCBjb21iaW5hdGlvbiBmdW5jdGlvbiBmb3IgdGhlIGN1cnJlbnRcbiAqIGl0ZXJhdGlvblxuICovXG5mdW5jdGlvbiBzaGExX2Z0KHQsIGIsIGMsIGQpXG57XG4gIGlmKHQgPCAyMCkgcmV0dXJuIChiICYgYykgfCAoKH5iKSAmIGQpO1xuICBpZih0IDwgNDApIHJldHVybiBiIF4gYyBeIGQ7XG4gIGlmKHQgPCA2MCkgcmV0dXJuIChiICYgYykgfCAoYiAmIGQpIHwgKGMgJiBkKTtcbiAgcmV0dXJuIGIgXiBjIF4gZDtcbn1cblxuLypcbiAqIERldGVybWluZSB0aGUgYXBwcm9wcmlhdGUgYWRkaXRpdmUgY29uc3RhbnQgZm9yIHRoZSBjdXJyZW50IGl0ZXJhdGlvblxuICovXG5mdW5jdGlvbiBzaGExX2t0KHQpXG57XG4gIHJldHVybiAodCA8IDIwKSA/ICAxNTE4NTAwMjQ5IDogKHQgPCA0MCkgPyAgMTg1OTc3NTM5MyA6XG4gICAgICAgICAodCA8IDYwKSA/IC0xODk0MDA3NTg4IDogLTg5OTQ5NzUxNDtcbn1cblxuLypcbiAqIEFkZCBpbnRlZ2Vycywgd3JhcHBpbmcgYXQgMl4zMi4gVGhpcyB1c2VzIDE2LWJpdCBvcGVyYXRpb25zIGludGVybmFsbHlcbiAqIHRvIHdvcmsgYXJvdW5kIGJ1Z3MgaW4gc29tZSBKUyBpbnRlcnByZXRlcnMuXG4gKi9cbmZ1bmN0aW9uIHNhZmVfYWRkKHgsIHkpXG57XG4gIHZhciBsc3cgPSAoeCAmIDB4RkZGRikgKyAoeSAmIDB4RkZGRik7XG4gIHZhciBtc3cgPSAoeCA+PiAxNikgKyAoeSA+PiAxNikgKyAobHN3ID4+IDE2KTtcbiAgcmV0dXJuIChtc3cgPDwgMTYpIHwgKGxzdyAmIDB4RkZGRik7XG59XG5cbi8qXG4gKiBCaXR3aXNlIHJvdGF0ZSBhIDMyLWJpdCBudW1iZXIgdG8gdGhlIGxlZnQuXG4gKi9cbmZ1bmN0aW9uIHJvbChudW0sIGNudClcbntcbiAgcmV0dXJuIChudW0gPDwgY250KSB8IChudW0gPj4+ICgzMiAtIGNudCkpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIHNoYTEoYnVmKSB7XG4gIHJldHVybiBoZWxwZXJzLmhhc2goYnVmLCBjb3JlX3NoYTEsIDIwLCB0cnVlKTtcbn07XG4iLCJcbi8qKlxuICogQSBKYXZhU2NyaXB0IGltcGxlbWVudGF0aW9uIG9mIHRoZSBTZWN1cmUgSGFzaCBBbGdvcml0aG0sIFNIQS0yNTYsIGFzIGRlZmluZWRcbiAqIGluIEZJUFMgMTgwLTJcbiAqIFZlcnNpb24gMi4yLWJldGEgQ29weXJpZ2h0IEFuZ2VsIE1hcmluLCBQYXVsIEpvaG5zdG9uIDIwMDAgLSAyMDA5LlxuICogT3RoZXIgY29udHJpYnV0b3JzOiBHcmVnIEhvbHQsIEFuZHJldyBLZXBlcnQsIFlkbmFyLCBMb3N0aW5ldFxuICpcbiAqL1xuXG52YXIgaGVscGVycyA9IHJlcXVpcmUoJy4vaGVscGVycycpO1xuXG52YXIgc2FmZV9hZGQgPSBmdW5jdGlvbih4LCB5KSB7XG4gIHZhciBsc3cgPSAoeCAmIDB4RkZGRikgKyAoeSAmIDB4RkZGRik7XG4gIHZhciBtc3cgPSAoeCA+PiAxNikgKyAoeSA+PiAxNikgKyAobHN3ID4+IDE2KTtcbiAgcmV0dXJuIChtc3cgPDwgMTYpIHwgKGxzdyAmIDB4RkZGRik7XG59O1xuXG52YXIgUyA9IGZ1bmN0aW9uKFgsIG4pIHtcbiAgcmV0dXJuIChYID4+PiBuKSB8IChYIDw8ICgzMiAtIG4pKTtcbn07XG5cbnZhciBSID0gZnVuY3Rpb24oWCwgbikge1xuICByZXR1cm4gKFggPj4+IG4pO1xufTtcblxudmFyIENoID0gZnVuY3Rpb24oeCwgeSwgeikge1xuICByZXR1cm4gKCh4ICYgeSkgXiAoKH54KSAmIHopKTtcbn07XG5cbnZhciBNYWogPSBmdW5jdGlvbih4LCB5LCB6KSB7XG4gIHJldHVybiAoKHggJiB5KSBeICh4ICYgeikgXiAoeSAmIHopKTtcbn07XG5cbnZhciBTaWdtYTAyNTYgPSBmdW5jdGlvbih4KSB7XG4gIHJldHVybiAoUyh4LCAyKSBeIFMoeCwgMTMpIF4gUyh4LCAyMikpO1xufTtcblxudmFyIFNpZ21hMTI1NiA9IGZ1bmN0aW9uKHgpIHtcbiAgcmV0dXJuIChTKHgsIDYpIF4gUyh4LCAxMSkgXiBTKHgsIDI1KSk7XG59O1xuXG52YXIgR2FtbWEwMjU2ID0gZnVuY3Rpb24oeCkge1xuICByZXR1cm4gKFMoeCwgNykgXiBTKHgsIDE4KSBeIFIoeCwgMykpO1xufTtcblxudmFyIEdhbW1hMTI1NiA9IGZ1bmN0aW9uKHgpIHtcbiAgcmV0dXJuIChTKHgsIDE3KSBeIFMoeCwgMTkpIF4gUih4LCAxMCkpO1xufTtcblxudmFyIGNvcmVfc2hhMjU2ID0gZnVuY3Rpb24obSwgbCkge1xuICB2YXIgSyA9IG5ldyBBcnJheSgweDQyOEEyRjk4LDB4NzEzNzQ0OTEsMHhCNUMwRkJDRiwweEU5QjVEQkE1LDB4Mzk1NkMyNUIsMHg1OUYxMTFGMSwweDkyM0Y4MkE0LDB4QUIxQzVFRDUsMHhEODA3QUE5OCwweDEyODM1QjAxLDB4MjQzMTg1QkUsMHg1NTBDN0RDMywweDcyQkU1RDc0LDB4ODBERUIxRkUsMHg5QkRDMDZBNywweEMxOUJGMTc0LDB4RTQ5QjY5QzEsMHhFRkJFNDc4NiwweEZDMTlEQzYsMHgyNDBDQTFDQywweDJERTkyQzZGLDB4NEE3NDg0QUEsMHg1Q0IwQTlEQywweDc2Rjk4OERBLDB4OTgzRTUxNTIsMHhBODMxQzY2RCwweEIwMDMyN0M4LDB4QkY1OTdGQzcsMHhDNkUwMEJGMywweEQ1QTc5MTQ3LDB4NkNBNjM1MSwweDE0MjkyOTY3LDB4MjdCNzBBODUsMHgyRTFCMjEzOCwweDREMkM2REZDLDB4NTMzODBEMTMsMHg2NTBBNzM1NCwweDc2NkEwQUJCLDB4ODFDMkM5MkUsMHg5MjcyMkM4NSwweEEyQkZFOEExLDB4QTgxQTY2NEIsMHhDMjRCOEI3MCwweEM3NkM1MUEzLDB4RDE5MkU4MTksMHhENjk5MDYyNCwweEY0MEUzNTg1LDB4MTA2QUEwNzAsMHgxOUE0QzExNiwweDFFMzc2QzA4LDB4Mjc0ODc3NEMsMHgzNEIwQkNCNSwweDM5MUMwQ0IzLDB4NEVEOEFBNEEsMHg1QjlDQ0E0RiwweDY4MkU2RkYzLDB4NzQ4RjgyRUUsMHg3OEE1NjM2RiwweDg0Qzg3ODE0LDB4OENDNzAyMDgsMHg5MEJFRkZGQSwweEE0NTA2Q0VCLDB4QkVGOUEzRjcsMHhDNjcxNzhGMik7XG4gIHZhciBIQVNIID0gbmV3IEFycmF5KDB4NkEwOUU2NjcsIDB4QkI2N0FFODUsIDB4M0M2RUYzNzIsIDB4QTU0RkY1M0EsIDB4NTEwRTUyN0YsIDB4OUIwNTY4OEMsIDB4MUY4M0Q5QUIsIDB4NUJFMENEMTkpO1xuICAgIHZhciBXID0gbmV3IEFycmF5KDY0KTtcbiAgICB2YXIgYSwgYiwgYywgZCwgZSwgZiwgZywgaCwgaSwgajtcbiAgICB2YXIgVDEsIFQyO1xuICAvKiBhcHBlbmQgcGFkZGluZyAqL1xuICBtW2wgPj4gNV0gfD0gMHg4MCA8PCAoMjQgLSBsICUgMzIpO1xuICBtWygobCArIDY0ID4+IDkpIDw8IDQpICsgMTVdID0gbDtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBtLmxlbmd0aDsgaSArPSAxNikge1xuICAgIGEgPSBIQVNIWzBdOyBiID0gSEFTSFsxXTsgYyA9IEhBU0hbMl07IGQgPSBIQVNIWzNdOyBlID0gSEFTSFs0XTsgZiA9IEhBU0hbNV07IGcgPSBIQVNIWzZdOyBoID0gSEFTSFs3XTtcbiAgICBmb3IgKHZhciBqID0gMDsgaiA8IDY0OyBqKyspIHtcbiAgICAgIGlmIChqIDwgMTYpIHtcbiAgICAgICAgV1tqXSA9IG1baiArIGldO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgV1tqXSA9IHNhZmVfYWRkKHNhZmVfYWRkKHNhZmVfYWRkKEdhbW1hMTI1NihXW2ogLSAyXSksIFdbaiAtIDddKSwgR2FtbWEwMjU2KFdbaiAtIDE1XSkpLCBXW2ogLSAxNl0pO1xuICAgICAgfVxuICAgICAgVDEgPSBzYWZlX2FkZChzYWZlX2FkZChzYWZlX2FkZChzYWZlX2FkZChoLCBTaWdtYTEyNTYoZSkpLCBDaChlLCBmLCBnKSksIEtbal0pLCBXW2pdKTtcbiAgICAgIFQyID0gc2FmZV9hZGQoU2lnbWEwMjU2KGEpLCBNYWooYSwgYiwgYykpO1xuICAgICAgaCA9IGc7IGcgPSBmOyBmID0gZTsgZSA9IHNhZmVfYWRkKGQsIFQxKTsgZCA9IGM7IGMgPSBiOyBiID0gYTsgYSA9IHNhZmVfYWRkKFQxLCBUMik7XG4gICAgfVxuICAgIEhBU0hbMF0gPSBzYWZlX2FkZChhLCBIQVNIWzBdKTsgSEFTSFsxXSA9IHNhZmVfYWRkKGIsIEhBU0hbMV0pOyBIQVNIWzJdID0gc2FmZV9hZGQoYywgSEFTSFsyXSk7IEhBU0hbM10gPSBzYWZlX2FkZChkLCBIQVNIWzNdKTtcbiAgICBIQVNIWzRdID0gc2FmZV9hZGQoZSwgSEFTSFs0XSk7IEhBU0hbNV0gPSBzYWZlX2FkZChmLCBIQVNIWzVdKTsgSEFTSFs2XSA9IHNhZmVfYWRkKGcsIEhBU0hbNl0pOyBIQVNIWzddID0gc2FmZV9hZGQoaCwgSEFTSFs3XSk7XG4gIH1cbiAgcmV0dXJuIEhBU0g7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIHNoYTI1NihidWYpIHtcbiAgcmV0dXJuIGhlbHBlcnMuaGFzaChidWYsIGNvcmVfc2hhMjU2LCAzMiwgdHJ1ZSk7XG59O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7ZnVuY3Rpb24gcShhKXt0aHJvdyBhO312YXIgcz12b2lkIDAsdT0hMTt2YXIgc2pjbD17Y2lwaGVyOnt9LGhhc2g6e30sa2V5ZXhjaGFuZ2U6e30sbW9kZTp7fSxtaXNjOnt9LGNvZGVjOnt9LGV4Y2VwdGlvbjp7Y29ycnVwdDpmdW5jdGlvbihhKXt0aGlzLnRvU3RyaW5nPWZ1bmN0aW9uKCl7cmV0dXJuXCJDT1JSVVBUOiBcIit0aGlzLm1lc3NhZ2V9O3RoaXMubWVzc2FnZT1hfSxpbnZhbGlkOmZ1bmN0aW9uKGEpe3RoaXMudG9TdHJpbmc9ZnVuY3Rpb24oKXtyZXR1cm5cIklOVkFMSUQ6IFwiK3RoaXMubWVzc2FnZX07dGhpcy5tZXNzYWdlPWF9LGJ1ZzpmdW5jdGlvbihhKXt0aGlzLnRvU3RyaW5nPWZ1bmN0aW9uKCl7cmV0dXJuXCJCVUc6IFwiK3RoaXMubWVzc2FnZX07dGhpcy5tZXNzYWdlPWF9LG5vdFJlYWR5OmZ1bmN0aW9uKGEpe3RoaXMudG9TdHJpbmc9ZnVuY3Rpb24oKXtyZXR1cm5cIk5PVCBSRUFEWTogXCIrdGhpcy5tZXNzYWdlfTt0aGlzLm1lc3NhZ2U9YX19fTtcblwidW5kZWZpbmVkXCIhPT10eXBlb2YgbW9kdWxlJiZtb2R1bGUuZXhwb3J0cyYmKG1vZHVsZS5leHBvcnRzPXNqY2wpO1wiZnVuY3Rpb25cIj09PXR5cGVvZiBkZWZpbmUmJmRlZmluZShbXSxmdW5jdGlvbigpe3JldHVybiBzamNsfSk7XG5zamNsLmNpcGhlci5hZXM9ZnVuY3Rpb24oYSl7dGhpcy5rWzBdWzBdWzBdfHx0aGlzLkQoKTt2YXIgYixjLGQsZSxmPXRoaXMua1swXVs0XSxnPXRoaXMua1sxXTtiPWEubGVuZ3RoO3ZhciBoPTE7NCE9PWImJig2IT09YiYmOCE9PWIpJiZxKG5ldyBzamNsLmV4Y2VwdGlvbi5pbnZhbGlkKFwiaW52YWxpZCBhZXMga2V5IHNpemVcIikpO3RoaXMuYj1bZD1hLnNsaWNlKDApLGU9W11dO2ZvcihhPWI7YTw0KmIrMjg7YSsrKXtjPWRbYS0xXTtpZigwPT09YSVifHw4PT09YiYmND09PWElYiljPWZbYz4+PjI0XTw8MjReZltjPj4xNiYyNTVdPDwxNl5mW2M+PjgmMjU1XTw8OF5mW2MmMjU1XSwwPT09YSViJiYoYz1jPDw4XmM+Pj4yNF5oPDwyNCxoPWg8PDFeMjgzKihoPj43KSk7ZFthXT1kW2EtYl1eY31mb3IoYj0wO2E7YisrLGEtLSljPWRbYiYzP2E6YS00XSxlW2JdPTQ+PWF8fDQ+Yj9jOmdbMF1bZltjPj4+MjRdXV5nWzFdW2ZbYz4+MTYmMjU1XV1eZ1syXVtmW2M+PjgmMjU1XV1eZ1szXVtmW2MmXG4yNTVdXX07XG5zamNsLmNpcGhlci5hZXMucHJvdG90eXBlPXtlbmNyeXB0OmZ1bmN0aW9uKGEpe3JldHVybiB3KHRoaXMsYSwwKX0sZGVjcnlwdDpmdW5jdGlvbihhKXtyZXR1cm4gdyh0aGlzLGEsMSl9LGs6W1tbXSxbXSxbXSxbXSxbXV0sW1tdLFtdLFtdLFtdLFtdXV0sRDpmdW5jdGlvbigpe3ZhciBhPXRoaXMua1swXSxiPXRoaXMua1sxXSxjPWFbNF0sZD1iWzRdLGUsZixnLGg9W10sbD1bXSxrLG4sbSxwO2ZvcihlPTA7MHgxMDA+ZTtlKyspbFsoaFtlXT1lPDwxXjI4MyooZT4+NykpXmVdPWU7Zm9yKGY9Zz0wOyFjW2ZdO2ZePWt8fDEsZz1sW2ddfHwxKXttPWdeZzw8MV5nPDwyXmc8PDNeZzw8NDttPW0+PjhebSYyNTVeOTk7Y1tmXT1tO2RbbV09ZjtuPWhbZT1oW2s9aFtmXV1dO3A9MHgxMDEwMTAxKm5eMHgxMDAwMSplXjB4MTAxKmteMHgxMDEwMTAwKmY7bj0weDEwMSpoW21dXjB4MTAxMDEwMCptO2ZvcihlPTA7ND5lO2UrKylhW2VdW2ZdPW49bjw8MjRebj4+PjgsYltlXVttXT1wPXA8PDI0XnA+Pj44fWZvcihlPVxuMDs1PmU7ZSsrKWFbZV09YVtlXS5zbGljZSgwKSxiW2VdPWJbZV0uc2xpY2UoMCl9fTtcbmZ1bmN0aW9uIHcoYSxiLGMpezQhPT1iLmxlbmd0aCYmcShuZXcgc2pjbC5leGNlcHRpb24uaW52YWxpZChcImludmFsaWQgYWVzIGJsb2NrIHNpemVcIikpO3ZhciBkPWEuYltjXSxlPWJbMF1eZFswXSxmPWJbYz8zOjFdXmRbMV0sZz1iWzJdXmRbMl07Yj1iW2M/MTozXV5kWzNdO3ZhciBoLGwsayxuPWQubGVuZ3RoLzQtMixtLHA9NCx0PVswLDAsMCwwXTtoPWEua1tjXTthPWhbMF07dmFyIHI9aFsxXSx2PWhbMl0seT1oWzNdLHo9aFs0XTtmb3IobT0wO208bjttKyspaD1hW2U+Pj4yNF1ecltmPj4xNiYyNTVdXnZbZz4+OCYyNTVdXnlbYiYyNTVdXmRbcF0sbD1hW2Y+Pj4yNF1ecltnPj4xNiYyNTVdXnZbYj4+OCYyNTVdXnlbZSYyNTVdXmRbcCsxXSxrPWFbZz4+PjI0XV5yW2I+PjE2JjI1NV1edltlPj44JjI1NV1eeVtmJjI1NV1eZFtwKzJdLGI9YVtiPj4+MjRdXnJbZT4+MTYmMjU1XV52W2Y+PjgmMjU1XV55W2cmMjU1XV5kW3ArM10scCs9NCxlPWgsZj1sLGc9aztmb3IobT0wOzQ+XG5tO20rKyl0W2M/MyYtbTptXT16W2U+Pj4yNF08PDI0XnpbZj4+MTYmMjU1XTw8MTZeeltnPj44JjI1NV08PDheeltiJjI1NV1eZFtwKytdLGg9ZSxlPWYsZj1nLGc9YixiPWg7cmV0dXJuIHR9XG5zamNsLmJpdEFycmF5PXtiaXRTbGljZTpmdW5jdGlvbihhLGIsYyl7YT1zamNsLmJpdEFycmF5LlAoYS5zbGljZShiLzMyKSwzMi0oYiYzMSkpLnNsaWNlKDEpO3JldHVybiBjPT09cz9hOnNqY2wuYml0QXJyYXkuY2xhbXAoYSxjLWIpfSxleHRyYWN0OmZ1bmN0aW9uKGEsYixjKXt2YXIgZD1NYXRoLmZsb29yKC1iLWMmMzEpO3JldHVybigoYitjLTFeYikmLTMyP2FbYi8zMnwwXTw8MzItZF5hW2IvMzIrMXwwXT4+PmQ6YVtiLzMyfDBdPj4+ZCkmKDE8PGMpLTF9LGNvbmNhdDpmdW5jdGlvbihhLGIpe2lmKDA9PT1hLmxlbmd0aHx8MD09PWIubGVuZ3RoKXJldHVybiBhLmNvbmNhdChiKTt2YXIgYz1hW2EubGVuZ3RoLTFdLGQ9c2pjbC5iaXRBcnJheS5nZXRQYXJ0aWFsKGMpO3JldHVybiAzMj09PWQ/YS5jb25jYXQoYik6c2pjbC5iaXRBcnJheS5QKGIsZCxjfDAsYS5zbGljZSgwLGEubGVuZ3RoLTEpKX0sYml0TGVuZ3RoOmZ1bmN0aW9uKGEpe3ZhciBiPWEubGVuZ3RoO3JldHVybiAwPT09XG5iPzA6MzIqKGItMSkrc2pjbC5iaXRBcnJheS5nZXRQYXJ0aWFsKGFbYi0xXSl9LGNsYW1wOmZ1bmN0aW9uKGEsYil7aWYoMzIqYS5sZW5ndGg8YilyZXR1cm4gYTthPWEuc2xpY2UoMCxNYXRoLmNlaWwoYi8zMikpO3ZhciBjPWEubGVuZ3RoO2ImPTMxOzA8YyYmYiYmKGFbYy0xXT1zamNsLmJpdEFycmF5LnBhcnRpYWwoYixhW2MtMV0mMjE0NzQ4MzY0OD4+Yi0xLDEpKTtyZXR1cm4gYX0scGFydGlhbDpmdW5jdGlvbihhLGIsYyl7cmV0dXJuIDMyPT09YT9iOihjP2J8MDpiPDwzMi1hKSsweDEwMDAwMDAwMDAwKmF9LGdldFBhcnRpYWw6ZnVuY3Rpb24oYSl7cmV0dXJuIE1hdGgucm91bmQoYS8weDEwMDAwMDAwMDAwKXx8MzJ9LGVxdWFsOmZ1bmN0aW9uKGEsYil7aWYoc2pjbC5iaXRBcnJheS5iaXRMZW5ndGgoYSkhPT1zamNsLmJpdEFycmF5LmJpdExlbmd0aChiKSlyZXR1cm4gdTt2YXIgYz0wLGQ7Zm9yKGQ9MDtkPGEubGVuZ3RoO2QrKyljfD1hW2RdXmJbZF07cmV0dXJuIDA9PT1cbmN9LFA6ZnVuY3Rpb24oYSxiLGMsZCl7dmFyIGU7ZT0wO2ZvcihkPT09cyYmKGQ9W10pOzMyPD1iO2ItPTMyKWQucHVzaChjKSxjPTA7aWYoMD09PWIpcmV0dXJuIGQuY29uY2F0KGEpO2ZvcihlPTA7ZTxhLmxlbmd0aDtlKyspZC5wdXNoKGN8YVtlXT4+PmIpLGM9YVtlXTw8MzItYjtlPWEubGVuZ3RoP2FbYS5sZW5ndGgtMV06MDthPXNqY2wuYml0QXJyYXkuZ2V0UGFydGlhbChlKTtkLnB1c2goc2pjbC5iaXRBcnJheS5wYXJ0aWFsKGIrYSYzMSwzMjxiK2E/YzpkLnBvcCgpLDEpKTtyZXR1cm4gZH0sbDpmdW5jdGlvbihhLGIpe3JldHVyblthWzBdXmJbMF0sYVsxXV5iWzFdLGFbMl1eYlsyXSxhWzNdXmJbM11dfSxieXRlc3dhcE06ZnVuY3Rpb24oYSl7dmFyIGIsYztmb3IoYj0wO2I8YS5sZW5ndGg7KytiKWM9YVtiXSxhW2JdPWM+Pj4yNHxjPj4+OCYweGZmMDB8KGMmMHhmZjAwKTw8OHxjPDwyNDtyZXR1cm4gYX19O1xuc2pjbC5jb2RlYy51dGY4U3RyaW5nPXtmcm9tQml0czpmdW5jdGlvbihhKXt2YXIgYj1cIlwiLGM9c2pjbC5iaXRBcnJheS5iaXRMZW5ndGgoYSksZCxlO2ZvcihkPTA7ZDxjLzg7ZCsrKTA9PT0oZCYzKSYmKGU9YVtkLzRdKSxiKz1TdHJpbmcuZnJvbUNoYXJDb2RlKGU+Pj4yNCksZTw8PTg7cmV0dXJuIGRlY29kZVVSSUNvbXBvbmVudChlc2NhcGUoYikpfSx0b0JpdHM6ZnVuY3Rpb24oYSl7YT11bmVzY2FwZShlbmNvZGVVUklDb21wb25lbnQoYSkpO3ZhciBiPVtdLGMsZD0wO2ZvcihjPTA7YzxhLmxlbmd0aDtjKyspZD1kPDw4fGEuY2hhckNvZGVBdChjKSwzPT09KGMmMykmJihiLnB1c2goZCksZD0wKTtjJjMmJmIucHVzaChzamNsLmJpdEFycmF5LnBhcnRpYWwoOCooYyYzKSxkKSk7cmV0dXJuIGJ9fTtcbnNqY2wuY29kZWMuaGV4PXtmcm9tQml0czpmdW5jdGlvbihhKXt2YXIgYj1cIlwiLGM7Zm9yKGM9MDtjPGEubGVuZ3RoO2MrKyliKz0oKGFbY118MCkrMHhmMDAwMDAwMDAwMDApLnRvU3RyaW5nKDE2KS5zdWJzdHIoNCk7cmV0dXJuIGIuc3Vic3RyKDAsc2pjbC5iaXRBcnJheS5iaXRMZW5ndGgoYSkvNCl9LHRvQml0czpmdW5jdGlvbihhKXt2YXIgYixjPVtdLGQ7YT1hLnJlcGxhY2UoL1xcc3wweC9nLFwiXCIpO2Q9YS5sZW5ndGg7YSs9XCIwMDAwMDAwMFwiO2ZvcihiPTA7YjxhLmxlbmd0aDtiKz04KWMucHVzaChwYXJzZUludChhLnN1YnN0cihiLDgpLDE2KV4wKTtyZXR1cm4gc2pjbC5iaXRBcnJheS5jbGFtcChjLDQqZCl9fTtcbnNqY2wuY29kZWMuYmFzZTY0PXtKOlwiQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrL1wiLGZyb21CaXRzOmZ1bmN0aW9uKGEsYixjKXt2YXIgZD1cIlwiLGU9MCxmPXNqY2wuY29kZWMuYmFzZTY0LkosZz0wLGg9c2pjbC5iaXRBcnJheS5iaXRMZW5ndGgoYSk7YyYmKGY9Zi5zdWJzdHIoMCw2MikrXCItX1wiKTtmb3IoYz0wOzYqZC5sZW5ndGg8aDspZCs9Zi5jaGFyQXQoKGdeYVtjXT4+PmUpPj4+MjYpLDY+ZT8oZz1hW2NdPDw2LWUsZSs9MjYsYysrKTooZzw8PTYsZS09Nik7Zm9yKDtkLmxlbmd0aCYzJiYhYjspZCs9XCI9XCI7cmV0dXJuIGR9LHRvQml0czpmdW5jdGlvbihhLGIpe2E9YS5yZXBsYWNlKC9cXHN8PS9nLFwiXCIpO3ZhciBjPVtdLGQsZT0wLGY9c2pjbC5jb2RlYy5iYXNlNjQuSixnPTAsaDtiJiYoZj1mLnN1YnN0cigwLDYyKStcIi1fXCIpO2ZvcihkPTA7ZDxhLmxlbmd0aDtkKyspaD1mLmluZGV4T2YoYS5jaGFyQXQoZCkpLFxuMD5oJiZxKG5ldyBzamNsLmV4Y2VwdGlvbi5pbnZhbGlkKFwidGhpcyBpc24ndCBiYXNlNjQhXCIpKSwyNjxlPyhlLT0yNixjLnB1c2goZ15oPj4+ZSksZz1oPDwzMi1lKTooZSs9NixnXj1oPDwzMi1lKTtlJjU2JiZjLnB1c2goc2pjbC5iaXRBcnJheS5wYXJ0aWFsKGUmNTYsZywxKSk7cmV0dXJuIGN9fTtzamNsLmNvZGVjLmJhc2U2NHVybD17ZnJvbUJpdHM6ZnVuY3Rpb24oYSl7cmV0dXJuIHNqY2wuY29kZWMuYmFzZTY0LmZyb21CaXRzKGEsMSwxKX0sdG9CaXRzOmZ1bmN0aW9uKGEpe3JldHVybiBzamNsLmNvZGVjLmJhc2U2NC50b0JpdHMoYSwxKX19O3NqY2wuaGFzaC5zaGEyNTY9ZnVuY3Rpb24oYSl7dGhpcy5iWzBdfHx0aGlzLkQoKTthPyh0aGlzLnI9YS5yLnNsaWNlKDApLHRoaXMubz1hLm8uc2xpY2UoMCksdGhpcy5oPWEuaCk6dGhpcy5yZXNldCgpfTtzamNsLmhhc2guc2hhMjU2Lmhhc2g9ZnVuY3Rpb24oYSl7cmV0dXJuKG5ldyBzamNsLmhhc2guc2hhMjU2KS51cGRhdGUoYSkuZmluYWxpemUoKX07XG5zamNsLmhhc2guc2hhMjU2LnByb3RvdHlwZT17YmxvY2tTaXplOjUxMixyZXNldDpmdW5jdGlvbigpe3RoaXMucj10aGlzLk4uc2xpY2UoMCk7dGhpcy5vPVtdO3RoaXMuaD0wO3JldHVybiB0aGlzfSx1cGRhdGU6ZnVuY3Rpb24oYSl7XCJzdHJpbmdcIj09PXR5cGVvZiBhJiYoYT1zamNsLmNvZGVjLnV0ZjhTdHJpbmcudG9CaXRzKGEpKTt2YXIgYixjPXRoaXMubz1zamNsLmJpdEFycmF5LmNvbmNhdCh0aGlzLm8sYSk7Yj10aGlzLmg7YT10aGlzLmg9YitzamNsLmJpdEFycmF5LmJpdExlbmd0aChhKTtmb3IoYj01MTIrYiYtNTEyO2I8PWE7Yis9NTEyKXgodGhpcyxjLnNwbGljZSgwLDE2KSk7cmV0dXJuIHRoaXN9LGZpbmFsaXplOmZ1bmN0aW9uKCl7dmFyIGEsYj10aGlzLm8sYz10aGlzLnIsYj1zamNsLmJpdEFycmF5LmNvbmNhdChiLFtzamNsLmJpdEFycmF5LnBhcnRpYWwoMSwxKV0pO2ZvcihhPWIubGVuZ3RoKzI7YSYxNTthKyspYi5wdXNoKDApO2IucHVzaChNYXRoLmZsb29yKHRoaXMuaC9cbjQyOTQ5NjcyOTYpKTtmb3IoYi5wdXNoKHRoaXMuaHwwKTtiLmxlbmd0aDspeCh0aGlzLGIuc3BsaWNlKDAsMTYpKTt0aGlzLnJlc2V0KCk7cmV0dXJuIGN9LE46W10sYjpbXSxEOmZ1bmN0aW9uKCl7ZnVuY3Rpb24gYShhKXtyZXR1cm4gMHgxMDAwMDAwMDAqKGEtTWF0aC5mbG9vcihhKSl8MH12YXIgYj0wLGM9MixkO2E6Zm9yKDs2ND5iO2MrKyl7Zm9yKGQ9MjtkKmQ8PWM7ZCsrKWlmKDA9PT1jJWQpY29udGludWUgYTs4PmImJih0aGlzLk5bYl09YShNYXRoLnBvdyhjLDAuNSkpKTt0aGlzLmJbYl09YShNYXRoLnBvdyhjLDEvMykpO2IrK319fTtcbmZ1bmN0aW9uIHgoYSxiKXt2YXIgYyxkLGUsZj1iLnNsaWNlKDApLGc9YS5yLGg9YS5iLGw9Z1swXSxrPWdbMV0sbj1nWzJdLG09Z1szXSxwPWdbNF0sdD1nWzVdLHI9Z1s2XSx2PWdbN107Zm9yKGM9MDs2ND5jO2MrKykxNj5jP2Q9ZltjXTooZD1mW2MrMSYxNV0sZT1mW2MrMTQmMTVdLGQ9ZltjJjE1XT0oZD4+PjdeZD4+PjE4XmQ+Pj4zXmQ8PDI1XmQ8PDE0KSsoZT4+PjE3XmU+Pj4xOV5lPj4+MTBeZTw8MTVeZTw8MTMpK2ZbYyYxNV0rZltjKzkmMTVdfDApLGQ9ZCt2KyhwPj4+Nl5wPj4+MTFecD4+PjI1XnA8PDI2XnA8PDIxXnA8PDcpKyhyXnAmKHRecikpK2hbY10sdj1yLHI9dCx0PXAscD1tK2R8MCxtPW4sbj1rLGs9bCxsPWQrKGsmbl5tJihrXm4pKSsoaz4+PjJeaz4+PjEzXms+Pj4yMl5rPDwzMF5rPDwxOV5rPDwxMCl8MDtnWzBdPWdbMF0rbHwwO2dbMV09Z1sxXStrfDA7Z1syXT1nWzJdK258MDtnWzNdPWdbM10rbXwwO2dbNF09Z1s0XStwfDA7Z1s1XT1nWzVdK3R8MDtnWzZdPVxuZ1s2XStyfDA7Z1s3XT1nWzddK3Z8MH1cbnNqY2wubW9kZS5jY209e25hbWU6XCJjY21cIixlbmNyeXB0OmZ1bmN0aW9uKGEsYixjLGQsZSl7dmFyIGYsZz1iLnNsaWNlKDApLGg9c2pjbC5iaXRBcnJheSxsPWguYml0TGVuZ3RoKGMpLzgsaz1oLmJpdExlbmd0aChnKS84O2U9ZXx8NjQ7ZD1kfHxbXTs3PmwmJnEobmV3IHNqY2wuZXhjZXB0aW9uLmludmFsaWQoXCJjY206IGl2IG11c3QgYmUgYXQgbGVhc3QgNyBieXRlc1wiKSk7Zm9yKGY9Mjs0PmYmJms+Pj44KmY7ZisrKTtmPDE1LWwmJihmPTE1LWwpO2M9aC5jbGFtcChjLDgqKDE1LWYpKTtiPXNqY2wubW9kZS5jY20uTChhLGIsYyxkLGUsZik7Zz1zamNsLm1vZGUuY2NtLnAoYSxnLGMsYixlLGYpO3JldHVybiBoLmNvbmNhdChnLmRhdGEsZy50YWcpfSxkZWNyeXB0OmZ1bmN0aW9uKGEsYixjLGQsZSl7ZT1lfHw2NDtkPWR8fFtdO3ZhciBmPXNqY2wuYml0QXJyYXksZz1mLmJpdExlbmd0aChjKS84LGg9Zi5iaXRMZW5ndGgoYiksbD1mLmNsYW1wKGIsaC1lKSxrPWYuYml0U2xpY2UoYixcbmgtZSksaD0oaC1lKS84Ozc+ZyYmcShuZXcgc2pjbC5leGNlcHRpb24uaW52YWxpZChcImNjbTogaXYgbXVzdCBiZSBhdCBsZWFzdCA3IGJ5dGVzXCIpKTtmb3IoYj0yOzQ+YiYmaD4+PjgqYjtiKyspO2I8MTUtZyYmKGI9MTUtZyk7Yz1mLmNsYW1wKGMsOCooMTUtYikpO2w9c2pjbC5tb2RlLmNjbS5wKGEsbCxjLGssZSxiKTthPXNqY2wubW9kZS5jY20uTChhLGwuZGF0YSxjLGQsZSxiKTtmLmVxdWFsKGwudGFnLGEpfHxxKG5ldyBzamNsLmV4Y2VwdGlvbi5jb3JydXB0KFwiY2NtOiB0YWcgZG9lc24ndCBtYXRjaFwiKSk7cmV0dXJuIGwuZGF0YX0sTDpmdW5jdGlvbihhLGIsYyxkLGUsZil7dmFyIGc9W10saD1zamNsLmJpdEFycmF5LGw9aC5sO2UvPTg7KGUlMnx8ND5lfHwxNjxlKSYmcShuZXcgc2pjbC5leGNlcHRpb24uaW52YWxpZChcImNjbTogaW52YWxpZCB0YWcgbGVuZ3RoXCIpKTsoMHhmZmZmZmZmZjxkLmxlbmd0aHx8MHhmZmZmZmZmZjxiLmxlbmd0aCkmJnEobmV3IHNqY2wuZXhjZXB0aW9uLmJ1ZyhcImNjbTogY2FuJ3QgZGVhbCB3aXRoIDRHaUIgb3IgbW9yZSBkYXRhXCIpKTtcbmY9W2gucGFydGlhbCg4LChkLmxlbmd0aD82NDowKXxlLTI8PDJ8Zi0xKV07Zj1oLmNvbmNhdChmLGMpO2ZbM118PWguYml0TGVuZ3RoKGIpLzg7Zj1hLmVuY3J5cHQoZik7aWYoZC5sZW5ndGgpe2M9aC5iaXRMZW5ndGgoZCkvODs2NTI3OT49Yz9nPVtoLnBhcnRpYWwoMTYsYyldOjB4ZmZmZmZmZmY+PWMmJihnPWguY29uY2F0KFtoLnBhcnRpYWwoMTYsNjU1MzQpXSxbY10pKTtnPWguY29uY2F0KGcsZCk7Zm9yKGQ9MDtkPGcubGVuZ3RoO2QrPTQpZj1hLmVuY3J5cHQobChmLGcuc2xpY2UoZCxkKzQpLmNvbmNhdChbMCwwLDBdKSkpfWZvcihkPTA7ZDxiLmxlbmd0aDtkKz00KWY9YS5lbmNyeXB0KGwoZixiLnNsaWNlKGQsZCs0KS5jb25jYXQoWzAsMCwwXSkpKTtyZXR1cm4gaC5jbGFtcChmLDgqZSl9LHA6ZnVuY3Rpb24oYSxiLGMsZCxlLGYpe3ZhciBnLGg9c2pjbC5iaXRBcnJheTtnPWgubDt2YXIgbD1iLmxlbmd0aCxrPWguYml0TGVuZ3RoKGIpO2M9aC5jb25jYXQoW2gucGFydGlhbCg4LFxuZi0xKV0sYykuY29uY2F0KFswLDAsMF0pLnNsaWNlKDAsNCk7ZD1oLmJpdFNsaWNlKGcoZCxhLmVuY3J5cHQoYykpLDAsZSk7aWYoIWwpcmV0dXJue3RhZzpkLGRhdGE6W119O2ZvcihnPTA7ZzxsO2crPTQpY1szXSsrLGU9YS5lbmNyeXB0KGMpLGJbZ11ePWVbMF0sYltnKzFdXj1lWzFdLGJbZysyXV49ZVsyXSxiW2crM11ePWVbM107cmV0dXJue3RhZzpkLGRhdGE6aC5jbGFtcChiLGspfX19O1xuc2pjbC5tb2RlLm9jYjI9e25hbWU6XCJvY2IyXCIsZW5jcnlwdDpmdW5jdGlvbihhLGIsYyxkLGUsZil7MTI4IT09c2pjbC5iaXRBcnJheS5iaXRMZW5ndGgoYykmJnEobmV3IHNqY2wuZXhjZXB0aW9uLmludmFsaWQoXCJvY2IgaXYgbXVzdCBiZSAxMjggYml0c1wiKSk7dmFyIGcsaD1zamNsLm1vZGUub2NiMi5ILGw9c2pjbC5iaXRBcnJheSxrPWwubCxuPVswLDAsMCwwXTtjPWgoYS5lbmNyeXB0KGMpKTt2YXIgbSxwPVtdO2Q9ZHx8W107ZT1lfHw2NDtmb3IoZz0wO2crNDxiLmxlbmd0aDtnKz00KW09Yi5zbGljZShnLGcrNCksbj1rKG4sbSkscD1wLmNvbmNhdChrKGMsYS5lbmNyeXB0KGsoYyxtKSkpKSxjPWgoYyk7bT1iLnNsaWNlKGcpO2I9bC5iaXRMZW5ndGgobSk7Zz1hLmVuY3J5cHQoayhjLFswLDAsMCxiXSkpO209bC5jbGFtcChrKG0uY29uY2F0KFswLDAsMF0pLGcpLGIpO249ayhuLGsobS5jb25jYXQoWzAsMCwwXSksZykpO249YS5lbmNyeXB0KGsobixrKGMsaChjKSkpKTtkLmxlbmd0aCYmXG4obj1rKG4sZj9kOnNqY2wubW9kZS5vY2IyLnBtYWMoYSxkKSkpO3JldHVybiBwLmNvbmNhdChsLmNvbmNhdChtLGwuY2xhbXAobixlKSkpfSxkZWNyeXB0OmZ1bmN0aW9uKGEsYixjLGQsZSxmKXsxMjghPT1zamNsLmJpdEFycmF5LmJpdExlbmd0aChjKSYmcShuZXcgc2pjbC5leGNlcHRpb24uaW52YWxpZChcIm9jYiBpdiBtdXN0IGJlIDEyOCBiaXRzXCIpKTtlPWV8fDY0O3ZhciBnPXNqY2wubW9kZS5vY2IyLkgsaD1zamNsLmJpdEFycmF5LGw9aC5sLGs9WzAsMCwwLDBdLG49ZyhhLmVuY3J5cHQoYykpLG0scCx0PXNqY2wuYml0QXJyYXkuYml0TGVuZ3RoKGIpLWUscj1bXTtkPWR8fFtdO2ZvcihjPTA7Yys0PHQvMzI7Yys9NCltPWwobixhLmRlY3J5cHQobChuLGIuc2xpY2UoYyxjKzQpKSkpLGs9bChrLG0pLHI9ci5jb25jYXQobSksbj1nKG4pO3A9dC0zMipjO209YS5lbmNyeXB0KGwobixbMCwwLDAscF0pKTttPWwobSxoLmNsYW1wKGIuc2xpY2UoYykscCkuY29uY2F0KFswLDAsMF0pKTtcbms9bChrLG0pO2s9YS5lbmNyeXB0KGwoayxsKG4sZyhuKSkpKTtkLmxlbmd0aCYmKGs9bChrLGY/ZDpzamNsLm1vZGUub2NiMi5wbWFjKGEsZCkpKTtoLmVxdWFsKGguY2xhbXAoayxlKSxoLmJpdFNsaWNlKGIsdCkpfHxxKG5ldyBzamNsLmV4Y2VwdGlvbi5jb3JydXB0KFwib2NiOiB0YWcgZG9lc24ndCBtYXRjaFwiKSk7cmV0dXJuIHIuY29uY2F0KGguY2xhbXAobSxwKSl9LHBtYWM6ZnVuY3Rpb24oYSxiKXt2YXIgYyxkPXNqY2wubW9kZS5vY2IyLkgsZT1zamNsLmJpdEFycmF5LGY9ZS5sLGc9WzAsMCwwLDBdLGg9YS5lbmNyeXB0KFswLDAsMCwwXSksaD1mKGgsZChkKGgpKSk7Zm9yKGM9MDtjKzQ8Yi5sZW5ndGg7Yys9NCloPWQoaCksZz1mKGcsYS5lbmNyeXB0KGYoaCxiLnNsaWNlKGMsYys0KSkpKTtjPWIuc2xpY2UoYyk7MTI4PmUuYml0TGVuZ3RoKGMpJiYoaD1mKGgsZChoKSksYz1lLmNvbmNhdChjLFstMjE0NzQ4MzY0OCwwLDAsMF0pKTtnPWYoZyxjKTtyZXR1cm4gYS5lbmNyeXB0KGYoZChmKGgsXG5kKGgpKSksZykpfSxIOmZ1bmN0aW9uKGEpe3JldHVyblthWzBdPDwxXmFbMV0+Pj4zMSxhWzFdPDwxXmFbMl0+Pj4zMSxhWzJdPDwxXmFbM10+Pj4zMSxhWzNdPDwxXjEzNSooYVswXT4+PjMxKV19fTtcbnNqY2wubW9kZS5nY209e25hbWU6XCJnY21cIixlbmNyeXB0OmZ1bmN0aW9uKGEsYixjLGQsZSl7dmFyIGY9Yi5zbGljZSgwKTtiPXNqY2wuYml0QXJyYXk7ZD1kfHxbXTthPXNqY2wubW9kZS5nY20ucCghMCxhLGYsZCxjLGV8fDEyOCk7cmV0dXJuIGIuY29uY2F0KGEuZGF0YSxhLnRhZyl9LGRlY3J5cHQ6ZnVuY3Rpb24oYSxiLGMsZCxlKXt2YXIgZj1iLnNsaWNlKDApLGc9c2pjbC5iaXRBcnJheSxoPWcuYml0TGVuZ3RoKGYpO2U9ZXx8MTI4O2Q9ZHx8W107ZTw9aD8oYj1nLmJpdFNsaWNlKGYsaC1lKSxmPWcuYml0U2xpY2UoZiwwLGgtZSkpOihiPWYsZj1bXSk7YT1zamNsLm1vZGUuZ2NtLnAodSxhLGYsZCxjLGUpO2cuZXF1YWwoYS50YWcsYil8fHEobmV3IHNqY2wuZXhjZXB0aW9uLmNvcnJ1cHQoXCJnY206IHRhZyBkb2Vzbid0IG1hdGNoXCIpKTtyZXR1cm4gYS5kYXRhfSxaOmZ1bmN0aW9uKGEsYil7dmFyIGMsZCxlLGYsZyxoPXNqY2wuYml0QXJyYXkubDtlPVswLDAsMCwwXTtmPWIuc2xpY2UoMCk7XG5mb3IoYz0wOzEyOD5jO2MrKyl7KGQ9MCE9PShhW01hdGguZmxvb3IoYy8zMildJjE8PDMxLWMlMzIpKSYmKGU9aChlLGYpKTtnPTAhPT0oZlszXSYxKTtmb3IoZD0zOzA8ZDtkLS0pZltkXT1mW2RdPj4+MXwoZltkLTFdJjEpPDwzMTtmWzBdPj4+PTE7ZyYmKGZbMF1ePS0weDFmMDAwMDAwKX1yZXR1cm4gZX0sZzpmdW5jdGlvbihhLGIsYyl7dmFyIGQsZT1jLmxlbmd0aDtiPWIuc2xpY2UoMCk7Zm9yKGQ9MDtkPGU7ZCs9NCliWzBdXj0weGZmZmZmZmZmJmNbZF0sYlsxXV49MHhmZmZmZmZmZiZjW2QrMV0sYlsyXV49MHhmZmZmZmZmZiZjW2QrMl0sYlszXV49MHhmZmZmZmZmZiZjW2QrM10sYj1zamNsLm1vZGUuZ2NtLlooYixhKTtyZXR1cm4gYn0scDpmdW5jdGlvbihhLGIsYyxkLGUsZil7dmFyIGcsaCxsLGssbixtLHAsdCxyPXNqY2wuYml0QXJyYXk7bT1jLmxlbmd0aDtwPXIuYml0TGVuZ3RoKGMpO3Q9ci5iaXRMZW5ndGgoZCk7aD1yLmJpdExlbmd0aChlKTtnPWIuZW5jcnlwdChbMCxcbjAsMCwwXSk7OTY9PT1oPyhlPWUuc2xpY2UoMCksZT1yLmNvbmNhdChlLFsxXSkpOihlPXNqY2wubW9kZS5nY20uZyhnLFswLDAsMCwwXSxlKSxlPXNqY2wubW9kZS5nY20uZyhnLGUsWzAsMCxNYXRoLmZsb29yKGgvMHgxMDAwMDAwMDApLGgmMHhmZmZmZmZmZl0pKTtoPXNqY2wubW9kZS5nY20uZyhnLFswLDAsMCwwXSxkKTtuPWUuc2xpY2UoMCk7ZD1oLnNsaWNlKDApO2F8fChkPXNqY2wubW9kZS5nY20uZyhnLGgsYykpO2ZvcihrPTA7azxtO2srPTQpblszXSsrLGw9Yi5lbmNyeXB0KG4pLGNba11ePWxbMF0sY1trKzFdXj1sWzFdLGNbaysyXV49bFsyXSxjW2srM11ePWxbM107Yz1yLmNsYW1wKGMscCk7YSYmKGQ9c2pjbC5tb2RlLmdjbS5nKGcsaCxjKSk7YT1bTWF0aC5mbG9vcih0LzB4MTAwMDAwMDAwKSx0JjB4ZmZmZmZmZmYsTWF0aC5mbG9vcihwLzB4MTAwMDAwMDAwKSxwJjB4ZmZmZmZmZmZdO2Q9c2pjbC5tb2RlLmdjbS5nKGcsZCxhKTtsPWIuZW5jcnlwdChlKTtkWzBdXj1sWzBdO1xuZFsxXV49bFsxXTtkWzJdXj1sWzJdO2RbM11ePWxbM107cmV0dXJue3RhZzpyLmJpdFNsaWNlKGQsMCxmKSxkYXRhOmN9fX07c2pjbC5taXNjLmhtYWM9ZnVuY3Rpb24oYSxiKXt0aGlzLk09Yj1ifHxzamNsLmhhc2guc2hhMjU2O3ZhciBjPVtbXSxbXV0sZCxlPWIucHJvdG90eXBlLmJsb2NrU2l6ZS8zMjt0aGlzLm49W25ldyBiLG5ldyBiXTthLmxlbmd0aD5lJiYoYT1iLmhhc2goYSkpO2ZvcihkPTA7ZDxlO2QrKyljWzBdW2RdPWFbZF1eOTA5NTIyNDg2LGNbMV1bZF09YVtkXV4xNTQ5NTU2ODI4O3RoaXMublswXS51cGRhdGUoY1swXSk7dGhpcy5uWzFdLnVwZGF0ZShjWzFdKTt0aGlzLkc9bmV3IGIodGhpcy5uWzBdKX07XG5zamNsLm1pc2MuaG1hYy5wcm90b3R5cGUuZW5jcnlwdD1zamNsLm1pc2MuaG1hYy5wcm90b3R5cGUubWFjPWZ1bmN0aW9uKGEpe3RoaXMuUSYmcShuZXcgc2pjbC5leGNlcHRpb24uaW52YWxpZChcImVuY3J5cHQgb24gYWxyZWFkeSB1cGRhdGVkIGhtYWMgY2FsbGVkIVwiKSk7dGhpcy51cGRhdGUoYSk7cmV0dXJuIHRoaXMuZGlnZXN0KGEpfTtzamNsLm1pc2MuaG1hYy5wcm90b3R5cGUucmVzZXQ9ZnVuY3Rpb24oKXt0aGlzLkc9bmV3IHRoaXMuTSh0aGlzLm5bMF0pO3RoaXMuUT11fTtzamNsLm1pc2MuaG1hYy5wcm90b3R5cGUudXBkYXRlPWZ1bmN0aW9uKGEpe3RoaXMuUT0hMDt0aGlzLkcudXBkYXRlKGEpfTtzamNsLm1pc2MuaG1hYy5wcm90b3R5cGUuZGlnZXN0PWZ1bmN0aW9uKCl7dmFyIGE9dGhpcy5HLmZpbmFsaXplKCksYT0obmV3IHRoaXMuTSh0aGlzLm5bMV0pKS51cGRhdGUoYSkuZmluYWxpemUoKTt0aGlzLnJlc2V0KCk7cmV0dXJuIGF9O1xuc2pjbC5taXNjLnBia2RmMj1mdW5jdGlvbihhLGIsYyxkLGUpe2M9Y3x8MUUzOygwPmR8fDA+YykmJnEoc2pjbC5leGNlcHRpb24uaW52YWxpZChcImludmFsaWQgcGFyYW1zIHRvIHBia2RmMlwiKSk7XCJzdHJpbmdcIj09PXR5cGVvZiBhJiYoYT1zamNsLmNvZGVjLnV0ZjhTdHJpbmcudG9CaXRzKGEpKTtcInN0cmluZ1wiPT09dHlwZW9mIGImJihiPXNqY2wuY29kZWMudXRmOFN0cmluZy50b0JpdHMoYikpO2U9ZXx8c2pjbC5taXNjLmhtYWM7YT1uZXcgZShhKTt2YXIgZixnLGgsbCxrPVtdLG49c2pjbC5iaXRBcnJheTtmb3IobD0xOzMyKmsubGVuZ3RoPChkfHwxKTtsKyspe2U9Zj1hLmVuY3J5cHQobi5jb25jYXQoYixbbF0pKTtmb3IoZz0xO2c8YztnKyspe2Y9YS5lbmNyeXB0KGYpO2ZvcihoPTA7aDxmLmxlbmd0aDtoKyspZVtoXV49ZltoXX1rPWsuY29uY2F0KGUpfWQmJihrPW4uY2xhbXAoayxkKSk7cmV0dXJuIGt9O1xuc2pjbC5wcm5nPWZ1bmN0aW9uKGEpe3RoaXMuYz1bbmV3IHNqY2wuaGFzaC5zaGEyNTZdO3RoaXMuaT1bMF07dGhpcy5GPTA7dGhpcy5zPXt9O3RoaXMuQz0wO3RoaXMuSz17fTt0aGlzLk89dGhpcy5kPXRoaXMuaj10aGlzLlc9MDt0aGlzLmI9WzAsMCwwLDAsMCwwLDAsMF07dGhpcy5mPVswLDAsMCwwXTt0aGlzLkE9czt0aGlzLkI9YTt0aGlzLnE9dTt0aGlzLnc9e3Byb2dyZXNzOnt9LHNlZWRlZDp7fX07dGhpcy5tPXRoaXMuVj0wO3RoaXMudD0xO3RoaXMudT0yO3RoaXMuUz0weDEwMDAwO3RoaXMuST1bMCw0OCw2NCw5NiwxMjgsMTkyLDB4MTAwLDM4NCw1MTIsNzY4LDEwMjRdO3RoaXMuVD0zRTQ7dGhpcy5SPTgwfTtcbnNqY2wucHJuZy5wcm90b3R5cGU9e3JhbmRvbVdvcmRzOmZ1bmN0aW9uKGEsYil7dmFyIGM9W10sZDtkPXRoaXMuaXNSZWFkeShiKTt2YXIgZTtkPT09dGhpcy5tJiZxKG5ldyBzamNsLmV4Y2VwdGlvbi5ub3RSZWFkeShcImdlbmVyYXRvciBpc24ndCBzZWVkZWRcIikpO2lmKGQmdGhpcy51KXtkPSEoZCZ0aGlzLnQpO2U9W107dmFyIGY9MCxnO3RoaXMuTz1lWzBdPShuZXcgRGF0ZSkudmFsdWVPZigpK3RoaXMuVDtmb3IoZz0wOzE2Pmc7ZysrKWUucHVzaCgweDEwMDAwMDAwMCpNYXRoLnJhbmRvbSgpfDApO2ZvcihnPTA7Zzx0aGlzLmMubGVuZ3RoJiYhKGU9ZS5jb25jYXQodGhpcy5jW2ddLmZpbmFsaXplKCkpLGYrPXRoaXMuaVtnXSx0aGlzLmlbZ109MCwhZCYmdGhpcy5GJjE8PGcpO2crKyk7dGhpcy5GPj0xPDx0aGlzLmMubGVuZ3RoJiYodGhpcy5jLnB1c2gobmV3IHNqY2wuaGFzaC5zaGEyNTYpLHRoaXMuaS5wdXNoKDApKTt0aGlzLmQtPWY7Zj50aGlzLmomJih0aGlzLmo9Zik7dGhpcy5GKys7XG50aGlzLmI9c2pjbC5oYXNoLnNoYTI1Ni5oYXNoKHRoaXMuYi5jb25jYXQoZSkpO3RoaXMuQT1uZXcgc2pjbC5jaXBoZXIuYWVzKHRoaXMuYik7Zm9yKGQ9MDs0PmQmJiEodGhpcy5mW2RdPXRoaXMuZltkXSsxfDAsdGhpcy5mW2RdKTtkKyspO31mb3IoZD0wO2Q8YTtkKz00KTA9PT0oZCsxKSV0aGlzLlMmJkEodGhpcyksZT1CKHRoaXMpLGMucHVzaChlWzBdLGVbMV0sZVsyXSxlWzNdKTtBKHRoaXMpO3JldHVybiBjLnNsaWNlKDAsYSl9LHNldERlZmF1bHRQYXJhbm9pYTpmdW5jdGlvbihhLGIpezA9PT1hJiZcIlNldHRpbmcgcGFyYW5vaWE9MCB3aWxsIHJ1aW4geW91ciBzZWN1cml0eTsgdXNlIGl0IG9ubHkgZm9yIHRlc3RpbmdcIiE9PWImJnEoXCJTZXR0aW5nIHBhcmFub2lhPTAgd2lsbCBydWluIHlvdXIgc2VjdXJpdHk7IHVzZSBpdCBvbmx5IGZvciB0ZXN0aW5nXCIpO3RoaXMuQj1hfSxhZGRFbnRyb3B5OmZ1bmN0aW9uKGEsYixjKXtjPWN8fFwidXNlclwiO3ZhciBkLGUsZj0obmV3IERhdGUpLnZhbHVlT2YoKSxcbmc9dGhpcy5zW2NdLGg9dGhpcy5pc1JlYWR5KCksbD0wO2Q9dGhpcy5LW2NdO2Q9PT1zJiYoZD10aGlzLktbY109dGhpcy5XKyspO2c9PT1zJiYoZz10aGlzLnNbY109MCk7dGhpcy5zW2NdPSh0aGlzLnNbY10rMSkldGhpcy5jLmxlbmd0aDtzd2l0Y2godHlwZW9mIGEpe2Nhc2UgXCJudW1iZXJcIjpiPT09cyYmKGI9MSk7dGhpcy5jW2ddLnVwZGF0ZShbZCx0aGlzLkMrKywxLGIsZiwxLGF8MF0pO2JyZWFrO2Nhc2UgXCJvYmplY3RcIjpjPU9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChhKTtpZihcIltvYmplY3QgVWludDMyQXJyYXldXCI9PT1jKXtlPVtdO2ZvcihjPTA7YzxhLmxlbmd0aDtjKyspZS5wdXNoKGFbY10pO2E9ZX1lbHNle1wiW29iamVjdCBBcnJheV1cIiE9PWMmJihsPTEpO2ZvcihjPTA7YzxhLmxlbmd0aCYmIWw7YysrKVwibnVtYmVyXCIhPT10eXBlb2YgYVtjXSYmKGw9MSl9aWYoIWwpe2lmKGI9PT1zKWZvcihjPWI9MDtjPGEubGVuZ3RoO2MrKylmb3IoZT1hW2NdOzA8ZTspYisrLFxuZT4+Pj0xO3RoaXMuY1tnXS51cGRhdGUoW2QsdGhpcy5DKyssMixiLGYsYS5sZW5ndGhdLmNvbmNhdChhKSl9YnJlYWs7Y2FzZSBcInN0cmluZ1wiOmI9PT1zJiYoYj1hLmxlbmd0aCk7dGhpcy5jW2ddLnVwZGF0ZShbZCx0aGlzLkMrKywzLGIsZixhLmxlbmd0aF0pO3RoaXMuY1tnXS51cGRhdGUoYSk7YnJlYWs7ZGVmYXVsdDpsPTF9bCYmcShuZXcgc2pjbC5leGNlcHRpb24uYnVnKFwicmFuZG9tOiBhZGRFbnRyb3B5IG9ubHkgc3VwcG9ydHMgbnVtYmVyLCBhcnJheSBvZiBudW1iZXJzIG9yIHN0cmluZ1wiKSk7dGhpcy5pW2ddKz1iO3RoaXMuZCs9YjtoPT09dGhpcy5tJiYodGhpcy5pc1JlYWR5KCkhPT10aGlzLm0mJkMoXCJzZWVkZWRcIixNYXRoLm1heCh0aGlzLmosdGhpcy5kKSksQyhcInByb2dyZXNzXCIsdGhpcy5nZXRQcm9ncmVzcygpKSl9LGlzUmVhZHk6ZnVuY3Rpb24oYSl7YT10aGlzLklbYSE9PXM/YTp0aGlzLkJdO3JldHVybiB0aGlzLmomJnRoaXMuaj49YT90aGlzLmlbMF0+dGhpcy5SJiZcbihuZXcgRGF0ZSkudmFsdWVPZigpPnRoaXMuTz90aGlzLnV8dGhpcy50OnRoaXMudDp0aGlzLmQ+PWE/dGhpcy51fHRoaXMubTp0aGlzLm19LGdldFByb2dyZXNzOmZ1bmN0aW9uKGEpe2E9dGhpcy5JW2E/YTp0aGlzLkJdO3JldHVybiB0aGlzLmo+PWE/MTp0aGlzLmQ+YT8xOnRoaXMuZC9hfSxzdGFydENvbGxlY3RvcnM6ZnVuY3Rpb24oKXt0aGlzLnF8fCh0aGlzLmE9e2xvYWRUaW1lQ29sbGVjdG9yOkQodGhpcyx0aGlzLmFhKSxtb3VzZUNvbGxlY3RvcjpEKHRoaXMsdGhpcy5iYSksa2V5Ym9hcmRDb2xsZWN0b3I6RCh0aGlzLHRoaXMuJCksYWNjZWxlcm9tZXRlckNvbGxlY3RvcjpEKHRoaXMsdGhpcy5VKSx0b3VjaENvbGxlY3RvcjpEKHRoaXMsdGhpcy5kYSl9LHdpbmRvdy5hZGRFdmVudExpc3RlbmVyPyh3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcImxvYWRcIix0aGlzLmEubG9hZFRpbWVDb2xsZWN0b3IsdSksd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZW1vdmVcIix0aGlzLmEubW91c2VDb2xsZWN0b3IsXG51KSx3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcImtleXByZXNzXCIsdGhpcy5hLmtleWJvYXJkQ29sbGVjdG9yLHUpLHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwiZGV2aWNlbW90aW9uXCIsdGhpcy5hLmFjY2VsZXJvbWV0ZXJDb2xsZWN0b3IsdSksd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJ0b3VjaG1vdmVcIix0aGlzLmEudG91Y2hDb2xsZWN0b3IsdSkpOmRvY3VtZW50LmF0dGFjaEV2ZW50Pyhkb2N1bWVudC5hdHRhY2hFdmVudChcIm9ubG9hZFwiLHRoaXMuYS5sb2FkVGltZUNvbGxlY3RvciksZG9jdW1lbnQuYXR0YWNoRXZlbnQoXCJvbm1vdXNlbW92ZVwiLHRoaXMuYS5tb3VzZUNvbGxlY3RvciksZG9jdW1lbnQuYXR0YWNoRXZlbnQoXCJrZXlwcmVzc1wiLHRoaXMuYS5rZXlib2FyZENvbGxlY3RvcikpOnEobmV3IHNqY2wuZXhjZXB0aW9uLmJ1ZyhcImNhbid0IGF0dGFjaCBldmVudFwiKSksdGhpcy5xPSEwKX0sc3RvcENvbGxlY3RvcnM6ZnVuY3Rpb24oKXt0aGlzLnEmJih3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcj9cbih3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImxvYWRcIix0aGlzLmEubG9hZFRpbWVDb2xsZWN0b3IsdSksd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJtb3VzZW1vdmVcIix0aGlzLmEubW91c2VDb2xsZWN0b3IsdSksd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJrZXlwcmVzc1wiLHRoaXMuYS5rZXlib2FyZENvbGxlY3Rvcix1KSx3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImRldmljZW1vdGlvblwiLHRoaXMuYS5hY2NlbGVyb21ldGVyQ29sbGVjdG9yLHUpLHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKFwidG91Y2htb3ZlXCIsdGhpcy5hLnRvdWNoQ29sbGVjdG9yLHUpKTpkb2N1bWVudC5kZXRhY2hFdmVudCYmKGRvY3VtZW50LmRldGFjaEV2ZW50KFwib25sb2FkXCIsdGhpcy5hLmxvYWRUaW1lQ29sbGVjdG9yKSxkb2N1bWVudC5kZXRhY2hFdmVudChcIm9ubW91c2Vtb3ZlXCIsdGhpcy5hLm1vdXNlQ29sbGVjdG9yKSxkb2N1bWVudC5kZXRhY2hFdmVudChcImtleXByZXNzXCIsXG50aGlzLmEua2V5Ym9hcmRDb2xsZWN0b3IpKSx0aGlzLnE9dSl9LGFkZEV2ZW50TGlzdGVuZXI6ZnVuY3Rpb24oYSxiKXt0aGlzLndbYV1bdGhpcy5WKytdPWJ9LHJlbW92ZUV2ZW50TGlzdGVuZXI6ZnVuY3Rpb24oYSxiKXt2YXIgYyxkLGU9dGhpcy53W2FdLGY9W107Zm9yKGQgaW4gZSllLmhhc093blByb3BlcnR5KGQpJiZlW2RdPT09YiYmZi5wdXNoKGQpO2ZvcihjPTA7YzxmLmxlbmd0aDtjKyspZD1mW2NdLGRlbGV0ZSBlW2RdfSwkOmZ1bmN0aW9uKCl7RSgxKX0sYmE6ZnVuY3Rpb24oYSl7dmFyIGIsYzt0cnl7Yj1hLnh8fGEuY2xpZW50WHx8YS5vZmZzZXRYfHwwLGM9YS55fHxhLmNsaWVudFl8fGEub2Zmc2V0WXx8MH1jYXRjaChkKXtjPWI9MH0wIT1iJiYwIT1jJiZzamNsLnJhbmRvbS5hZGRFbnRyb3B5KFtiLGNdLDIsXCJtb3VzZVwiKTtFKDApfSxkYTpmdW5jdGlvbihhKXthPWEudG91Y2hlc1swXXx8YS5jaGFuZ2VkVG91Y2hlc1swXTtzamNsLnJhbmRvbS5hZGRFbnRyb3B5KFthLnBhZ2VYfHxcbmEuY2xpZW50WCxhLnBhZ2VZfHxhLmNsaWVudFldLDEsXCJ0b3VjaFwiKTtFKDApfSxhYTpmdW5jdGlvbigpe0UoMil9LFU6ZnVuY3Rpb24oYSl7YT1hLmFjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHkueHx8YS5hY2NlbGVyYXRpb25JbmNsdWRpbmdHcmF2aXR5Lnl8fGEuYWNjZWxlcmF0aW9uSW5jbHVkaW5nR3Jhdml0eS56O2lmKHdpbmRvdy5vcmllbnRhdGlvbil7dmFyIGI9d2luZG93Lm9yaWVudGF0aW9uO1wibnVtYmVyXCI9PT10eXBlb2YgYiYmc2pjbC5yYW5kb20uYWRkRW50cm9weShiLDEsXCJhY2NlbGVyb21ldGVyXCIpfWEmJnNqY2wucmFuZG9tLmFkZEVudHJvcHkoYSwyLFwiYWNjZWxlcm9tZXRlclwiKTtFKDApfX07ZnVuY3Rpb24gQyhhLGIpe3ZhciBjLGQ9c2pjbC5yYW5kb20ud1thXSxlPVtdO2ZvcihjIGluIGQpZC5oYXNPd25Qcm9wZXJ0eShjKSYmZS5wdXNoKGRbY10pO2ZvcihjPTA7YzxlLmxlbmd0aDtjKyspZVtjXShiKX1cbmZ1bmN0aW9uIEUoYSl7XCJ1bmRlZmluZWRcIiE9PXR5cGVvZiB3aW5kb3cmJndpbmRvdy5wZXJmb3JtYW5jZSYmXCJmdW5jdGlvblwiPT09dHlwZW9mIHdpbmRvdy5wZXJmb3JtYW5jZS5ub3c/c2pjbC5yYW5kb20uYWRkRW50cm9weSh3aW5kb3cucGVyZm9ybWFuY2Uubm93KCksYSxcImxvYWR0aW1lXCIpOnNqY2wucmFuZG9tLmFkZEVudHJvcHkoKG5ldyBEYXRlKS52YWx1ZU9mKCksYSxcImxvYWR0aW1lXCIpfWZ1bmN0aW9uIEEoYSl7YS5iPUIoYSkuY29uY2F0KEIoYSkpO2EuQT1uZXcgc2pjbC5jaXBoZXIuYWVzKGEuYil9ZnVuY3Rpb24gQihhKXtmb3IodmFyIGI9MDs0PmImJiEoYS5mW2JdPWEuZltiXSsxfDAsYS5mW2JdKTtiKyspO3JldHVybiBhLkEuZW5jcnlwdChhLmYpfWZ1bmN0aW9uIEQoYSxiKXtyZXR1cm4gZnVuY3Rpb24oKXtiLmFwcGx5KGEsYXJndW1lbnRzKX19c2pjbC5yYW5kb209bmV3IHNqY2wucHJuZyg2KTtcbmE6dHJ5e3ZhciBGLEcsSCxJO2lmKEk9XCJ1bmRlZmluZWRcIiE9PXR5cGVvZiBtb2R1bGUpe3ZhciBKO2lmKEo9bW9kdWxlLmV4cG9ydHMpe3ZhciBLO3RyeXtLPXJlcXVpcmUoXCJjcnlwdG9cIil9Y2F0Y2goTCl7Sz1udWxsfUo9KEc9SykmJkcucmFuZG9tQnl0ZXN9ST1KfWlmKEkpRj1HLnJhbmRvbUJ5dGVzKDEyOCksRj1uZXcgVWludDMyQXJyYXkoKG5ldyBVaW50OEFycmF5KEYpKS5idWZmZXIpLHNqY2wucmFuZG9tLmFkZEVudHJvcHkoRiwxMDI0LFwiY3J5cHRvWydyYW5kb21CeXRlcyddXCIpO2Vsc2UgaWYoXCJ1bmRlZmluZWRcIiE9PXR5cGVvZiB3aW5kb3cmJlwidW5kZWZpbmVkXCIhPT10eXBlb2YgVWludDMyQXJyYXkpe0g9bmV3IFVpbnQzMkFycmF5KDMyKTtpZih3aW5kb3cuY3J5cHRvJiZ3aW5kb3cuY3J5cHRvLmdldFJhbmRvbVZhbHVlcyl3aW5kb3cuY3J5cHRvLmdldFJhbmRvbVZhbHVlcyhIKTtlbHNlIGlmKHdpbmRvdy5tc0NyeXB0byYmd2luZG93Lm1zQ3J5cHRvLmdldFJhbmRvbVZhbHVlcyl3aW5kb3cubXNDcnlwdG8uZ2V0UmFuZG9tVmFsdWVzKEgpO1xuZWxzZSBicmVhayBhO3NqY2wucmFuZG9tLmFkZEVudHJvcHkoSCwxMDI0LFwiY3J5cHRvWydnZXRSYW5kb21WYWx1ZXMnXVwiKX19Y2F0Y2goTSl7XCJ1bmRlZmluZWRcIiE9PXR5cGVvZiB3aW5kb3cmJndpbmRvdy5jb25zb2xlJiYoY29uc29sZS5sb2coXCJUaGVyZSB3YXMgYW4gZXJyb3IgY29sbGVjdGluZyBlbnRyb3B5IGZyb20gdGhlIGJyb3dzZXI6XCIpLGNvbnNvbGUubG9nKE0pKX1cbnNqY2wuanNvbj17ZGVmYXVsdHM6e3Y6MSxpdGVyOjFFMyxrczoxMjgsdHM6NjQsbW9kZTpcImNjbVwiLGFkYXRhOlwiXCIsY2lwaGVyOlwiYWVzXCJ9LFk6ZnVuY3Rpb24oYSxiLGMsZCl7Yz1jfHx7fTtkPWR8fHt9O3ZhciBlPXNqY2wuanNvbixmPWUuZSh7aXY6c2pjbC5yYW5kb20ucmFuZG9tV29yZHMoNCwwKX0sZS5kZWZhdWx0cyksZztlLmUoZixjKTtjPWYuYWRhdGE7XCJzdHJpbmdcIj09PXR5cGVvZiBmLnNhbHQmJihmLnNhbHQ9c2pjbC5jb2RlYy5iYXNlNjQudG9CaXRzKGYuc2FsdCkpO1wic3RyaW5nXCI9PT10eXBlb2YgZi5pdiYmKGYuaXY9c2pjbC5jb2RlYy5iYXNlNjQudG9CaXRzKGYuaXYpKTsoIXNqY2wubW9kZVtmLm1vZGVdfHwhc2pjbC5jaXBoZXJbZi5jaXBoZXJdfHxcInN0cmluZ1wiPT09dHlwZW9mIGEmJjEwMD49Zi5pdGVyfHw2NCE9PWYudHMmJjk2IT09Zi50cyYmMTI4IT09Zi50c3x8MTI4IT09Zi5rcyYmMTkyIT09Zi5rcyYmMHgxMDAhPT1mLmtzfHwyPmYuaXYubGVuZ3RofHw0PFxuZi5pdi5sZW5ndGgpJiZxKG5ldyBzamNsLmV4Y2VwdGlvbi5pbnZhbGlkKFwianNvbiBlbmNyeXB0OiBpbnZhbGlkIHBhcmFtZXRlcnNcIikpO1wic3RyaW5nXCI9PT10eXBlb2YgYT8oZz1zamNsLm1pc2MuY2FjaGVkUGJrZGYyKGEsZiksYT1nLmtleS5zbGljZSgwLGYua3MvMzIpLGYuc2FsdD1nLnNhbHQpOnNqY2wuZWNjJiZhIGluc3RhbmNlb2Ygc2pjbC5lY2MuZWxHYW1hbC5wdWJsaWNLZXkmJihnPWEua2VtKCksZi5rZW10YWc9Zy50YWcsYT1nLmtleS5zbGljZSgwLGYua3MvMzIpKTtcInN0cmluZ1wiPT09dHlwZW9mIGImJihiPXNqY2wuY29kZWMudXRmOFN0cmluZy50b0JpdHMoYikpO1wic3RyaW5nXCI9PT10eXBlb2YgYyYmKGYuYWRhdGE9Yz1zamNsLmNvZGVjLnV0ZjhTdHJpbmcudG9CaXRzKGMpKTtnPW5ldyBzamNsLmNpcGhlcltmLmNpcGhlcl0oYSk7ZS5lKGQsZik7ZC5rZXk9YTtmLmN0PXNqY2wubW9kZVtmLm1vZGVdLmVuY3J5cHQoZyxiLGYuaXYsYyxmLnRzKTtyZXR1cm4gZn0sXG5lbmNyeXB0OmZ1bmN0aW9uKGEsYixjLGQpe3ZhciBlPXNqY2wuanNvbixmPWUuWS5hcHBseShlLGFyZ3VtZW50cyk7cmV0dXJuIGUuZW5jb2RlKGYpfSxYOmZ1bmN0aW9uKGEsYixjLGQpe2M9Y3x8e307ZD1kfHx7fTt2YXIgZT1zamNsLmpzb247Yj1lLmUoZS5lKGUuZSh7fSxlLmRlZmF1bHRzKSxiKSxjLCEwKTt2YXIgZixnO2Y9Yi5hZGF0YTtcInN0cmluZ1wiPT09dHlwZW9mIGIuc2FsdCYmKGIuc2FsdD1zamNsLmNvZGVjLmJhc2U2NC50b0JpdHMoYi5zYWx0KSk7XCJzdHJpbmdcIj09PXR5cGVvZiBiLml2JiYoYi5pdj1zamNsLmNvZGVjLmJhc2U2NC50b0JpdHMoYi5pdikpOyghc2pjbC5tb2RlW2IubW9kZV18fCFzamNsLmNpcGhlcltiLmNpcGhlcl18fFwic3RyaW5nXCI9PT10eXBlb2YgYSYmMTAwPj1iLml0ZXJ8fDY0IT09Yi50cyYmOTYhPT1iLnRzJiYxMjghPT1iLnRzfHwxMjghPT1iLmtzJiYxOTIhPT1iLmtzJiYweDEwMCE9PWIua3N8fCFiLml2fHwyPmIuaXYubGVuZ3RofHw0PGIuaXYubGVuZ3RoKSYmXG5xKG5ldyBzamNsLmV4Y2VwdGlvbi5pbnZhbGlkKFwianNvbiBkZWNyeXB0OiBpbnZhbGlkIHBhcmFtZXRlcnNcIikpO1wic3RyaW5nXCI9PT10eXBlb2YgYT8oZz1zamNsLm1pc2MuY2FjaGVkUGJrZGYyKGEsYiksYT1nLmtleS5zbGljZSgwLGIua3MvMzIpLGIuc2FsdD1nLnNhbHQpOnNqY2wuZWNjJiZhIGluc3RhbmNlb2Ygc2pjbC5lY2MuZWxHYW1hbC5zZWNyZXRLZXkmJihhPWEudW5rZW0oc2pjbC5jb2RlYy5iYXNlNjQudG9CaXRzKGIua2VtdGFnKSkuc2xpY2UoMCxiLmtzLzMyKSk7XCJzdHJpbmdcIj09PXR5cGVvZiBmJiYoZj1zamNsLmNvZGVjLnV0ZjhTdHJpbmcudG9CaXRzKGYpKTtnPW5ldyBzamNsLmNpcGhlcltiLmNpcGhlcl0oYSk7Zj1zamNsLm1vZGVbYi5tb2RlXS5kZWNyeXB0KGcsYi5jdCxiLml2LGYsYi50cyk7ZS5lKGQsYik7ZC5rZXk9YTtyZXR1cm4gMT09PWMucmF3P2Y6c2pjbC5jb2RlYy51dGY4U3RyaW5nLmZyb21CaXRzKGYpfSxkZWNyeXB0OmZ1bmN0aW9uKGEsYixcbmMsZCl7dmFyIGU9c2pjbC5qc29uO3JldHVybiBlLlgoYSxlLmRlY29kZShiKSxjLGQpfSxlbmNvZGU6ZnVuY3Rpb24oYSl7dmFyIGIsYz1cIntcIixkPVwiXCI7Zm9yKGIgaW4gYSlpZihhLmhhc093blByb3BlcnR5KGIpKXN3aXRjaChiLm1hdGNoKC9eW2EtejAtOV0rJC9pKXx8cShuZXcgc2pjbC5leGNlcHRpb24uaW52YWxpZChcImpzb24gZW5jb2RlOiBpbnZhbGlkIHByb3BlcnR5IG5hbWVcIikpLGMrPWQrJ1wiJytiKydcIjonLGQ9XCIsXCIsdHlwZW9mIGFbYl0pe2Nhc2UgXCJudW1iZXJcIjpjYXNlIFwiYm9vbGVhblwiOmMrPWFbYl07YnJlYWs7Y2FzZSBcInN0cmluZ1wiOmMrPSdcIicrZXNjYXBlKGFbYl0pKydcIic7YnJlYWs7Y2FzZSBcIm9iamVjdFwiOmMrPSdcIicrc2pjbC5jb2RlYy5iYXNlNjQuZnJvbUJpdHMoYVtiXSwwKSsnXCInO2JyZWFrO2RlZmF1bHQ6cShuZXcgc2pjbC5leGNlcHRpb24uYnVnKFwianNvbiBlbmNvZGU6IHVuc3VwcG9ydGVkIHR5cGVcIikpfXJldHVybiBjK1wifVwifSxkZWNvZGU6ZnVuY3Rpb24oYSl7YT1cbmEucmVwbGFjZSgvXFxzL2csXCJcIik7YS5tYXRjaCgvXlxcey4qXFx9JC8pfHxxKG5ldyBzamNsLmV4Y2VwdGlvbi5pbnZhbGlkKFwianNvbiBkZWNvZGU6IHRoaXMgaXNuJ3QganNvbiFcIikpO2E9YS5yZXBsYWNlKC9eXFx7fFxcfSQvZyxcIlwiKS5zcGxpdCgvLC8pO3ZhciBiPXt9LGMsZDtmb3IoYz0wO2M8YS5sZW5ndGg7YysrKShkPWFbY10ubWF0Y2goL15cXHMqKD86KFtcIiddPykoW2Etel1bYS16MC05XSopXFwxKVxccyo6XFxzKig/OigtP1xcZCspfFwiKFthLXowLTkrXFwvJSpfLkA9XFwtXSopXCJ8KHRydWV8ZmFsc2UpKSQvaSkpfHxxKG5ldyBzamNsLmV4Y2VwdGlvbi5pbnZhbGlkKFwianNvbiBkZWNvZGU6IHRoaXMgaXNuJ3QganNvbiFcIikpLGRbM10/YltkWzJdXT1wYXJzZUludChkWzNdLDEwKTpkWzRdP2JbZFsyXV09ZFsyXS5tYXRjaCgvXihjdHxhZGF0YXxzYWx0fGl2KSQvKT9zamNsLmNvZGVjLmJhc2U2NC50b0JpdHMoZFs0XSk6dW5lc2NhcGUoZFs0XSk6ZFs1XSYmKGJbZFsyXV09XCJ0cnVlXCI9PT1cbmRbNV0pO3JldHVybiBifSxlOmZ1bmN0aW9uKGEsYixjKXthPT09cyYmKGE9e30pO2lmKGI9PT1zKXJldHVybiBhO2Zvcih2YXIgZCBpbiBiKWIuaGFzT3duUHJvcGVydHkoZCkmJihjJiYoYVtkXSE9PXMmJmFbZF0hPT1iW2RdKSYmcShuZXcgc2pjbC5leGNlcHRpb24uaW52YWxpZChcInJlcXVpcmVkIHBhcmFtZXRlciBvdmVycmlkZGVuXCIpKSxhW2RdPWJbZF0pO3JldHVybiBhfSxmYTpmdW5jdGlvbihhLGIpe3ZhciBjPXt9LGQ7Zm9yKGQgaW4gYSlhLmhhc093blByb3BlcnR5KGQpJiZhW2RdIT09YltkXSYmKGNbZF09YVtkXSk7cmV0dXJuIGN9LGVhOmZ1bmN0aW9uKGEsYil7dmFyIGM9e30sZDtmb3IoZD0wO2Q8Yi5sZW5ndGg7ZCsrKWFbYltkXV0hPT1zJiYoY1tiW2RdXT1hW2JbZF1dKTtyZXR1cm4gY319O3NqY2wuZW5jcnlwdD1zamNsLmpzb24uZW5jcnlwdDtzamNsLmRlY3J5cHQ9c2pjbC5qc29uLmRlY3J5cHQ7c2pjbC5taXNjLmNhPXt9O1xuc2pjbC5taXNjLmNhY2hlZFBia2RmMj1mdW5jdGlvbihhLGIpe3ZhciBjPXNqY2wubWlzYy5jYSxkO2I9Ynx8e307ZD1iLml0ZXJ8fDFFMztjPWNbYV09Y1thXXx8e307ZD1jW2RdPWNbZF18fHtmaXJzdFNhbHQ6Yi5zYWx0JiZiLnNhbHQubGVuZ3RoP2Iuc2FsdC5zbGljZSgwKTpzamNsLnJhbmRvbS5yYW5kb21Xb3JkcygyLDApfTtjPWIuc2FsdD09PXM/ZC5maXJzdFNhbHQ6Yi5zYWx0O2RbY109ZFtjXXx8c2pjbC5taXNjLnBia2RmMihhLGMsYi5pdGVyKTtyZXR1cm57a2V5OmRbY10uc2xpY2UoMCksc2FsdDpjLnNsaWNlKDApfX07XG4iXX0=

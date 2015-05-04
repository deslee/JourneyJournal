(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var React = require('react/addons');

console.log('is this a component??')

module.exports = React.createClass({displayName: "exports",
	getInitialState: function() {
		console.log("MOUNT???");
		return {

		}
	},
	render: function() {
		return (
			React.createElement("div", null, 
				"hihi"
			)
		);
	}
});


},{"react/addons":"oWaOtE"}],2:[function(require,module,exports){
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
/* deslight require hook - do not modify this line */

var routes = (
	React.createElement(Route, {handler: RootRouteHandler, path: "/"}, 
		React.createElement(DefaultRoute, {handler: IndexRouteHandler, name: "index"}), 
		React.createElement(Route, {handler: EditorRouteHandler, name: "editor", path: "editor/:id"}), 
		React.createElement(NotFoundRoute, {handler: NotFoundRouteHandler}), 
		React.createElement(Route, {handler: SettingsRouteHandler, name: "settings", path: "settings"}), 
"/* deslight route hook - do not modify this line */"
	)
);

document.addEventListener('deviceReady', function() {
	Router.run(routes, function(Handler) {
		React.render(React.createElement(Handler, null), document.getElementById('root_journey'));
	});
}, false)




},{"./routes/EditorRouteHandler":3,"./routes/IndexRouteHandler":4,"./routes/NotFoundRouteHandler":5,"./routes/RootRouteHandler":6,"./routes/SettingsRouteHandler":7,"react-router":"TIQRyI","react/addons":"oWaOtE"}],3:[function(require,module,exports){
var React = require('react/addons');
var Router = require('react-router');
var RouteHandler = Router.RouteHandler;
var alertify = window['alertify'] = require('alertifyjs')
var sjcl = require('sjcl');

var dates = require('../utilities/dates')
var decrypt = require('../utilities/decryptEntry')
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

		var putDoc = {
			_id: id,
			content: sjcl.encrypt(this.props.authkey, content),
			tags: sjcl.encrypt(this.props.authkey, this.state.tags.join(',')),
		}

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


},{"../utilities/dates":9,"../utilities/decryptEntry":10,"alertifyjs":"WhmgK1","react-router":"TIQRyI","react/addons":"oWaOtE","sjcl":20}],4:[function(require,module,exports){
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


},{"../utilities/decryptEntry":10,"react-router":"TIQRyI","react/addons":"oWaOtE"}],5:[function(require,module,exports){
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

function createDB() {
	var db = new PouchDB('journey_app', {auto_compaction: true});
	return db;
}

module.exports = React.createClass({displayName: "exports",
	mixins: [ Router.State, Router.Navigation ],
	componentWillMount: function() {
		document.addEventListener("pause", function() {
			this.setState({key: undefined, wrongAttempts: 0})
		}.bind(this), false);
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
	getInitialState: function() {
		return {
			key: undefined,
			db: createDB(), 
			wrongAttempts: 0,
			verifyKey: false
		}
	},
	clearDatabaseAndDeauthenticate: function() {
		this.state.db.destroy().then(function() {
			this.transitionTo('index');
			this.setState({
				db: createDB(),
				key: undefined,
				wrongAttempts: 0
			})
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



},{"./authenticate":8,"alertifyjs":"WhmgK1","pouchdb":"kjoiFI","react-router":"TIQRyI","react/addons":"oWaOtE","sjcl":20}],7:[function(require,module,exports){
var React = require('react/addons');
var Router = require('react-router');
var RouteHandler = Router.RouteHandler;
var decrypt = require('../utilities/decryptEntry')
var alertify = require('alertifyjs')

var gapi = require('../components/gapi')

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
			db.allDocs({
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

				React.createElement("gapi", null), 

					React.createElement("button", {onClick: this.exportFile.bind(this, false)}, "Export to json (encrypted)"), React.createElement("br", null), 
					React.createElement("button", {onClick: this.exportFile.bind(this, true)}, "Export to json (decrypted)"), React.createElement("br", null), 

					React.createElement("button", {onClick: this.deleteJournal}, "Delete journal")

				), 
				React.createElement("textarea", {className: "content", value: this.state.json})
			)
		);
	}
});


},{"../components/gapi":1,"../utilities/decryptEntry":10,"alertifyjs":"WhmgK1","react-router":"TIQRyI","react/addons":"oWaOtE"}],8:[function(require,module,exports){
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


},{}],10:[function(require,module,exports){
var sjcl = require('sjcl')

module.exports = function(key, entry) {
	entry.content = sjcl.decrypt(key, entry.content)
	entry.title = entry.content.split('\n')[0]
	entry.tags = sjcl.decrypt(key, entry.tags).split(',').filter(function(tag) {
		return tag !== ''
	})
	return entry;
}


},{"sjcl":20}],11:[function(require,module,exports){
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


},{"base64-js":12,"ieee754":13}],12:[function(require,module,exports){
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


},{}],13:[function(require,module,exports){
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


},{}],14:[function(require,module,exports){
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


},{"buffer":11}],15:[function(require,module,exports){
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


},{"./md5":16,"./rng":17,"./sha":18,"./sha256":19,"buffer":11}],16:[function(require,module,exports){
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


},{"./helpers":14}],17:[function(require,module,exports){
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


},{}],18:[function(require,module,exports){
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


},{"./helpers":14}],19:[function(require,module,exports){

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


},{"./helpers":14}],20:[function(require,module,exports){
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


},{"crypto":15}]},{},[2])
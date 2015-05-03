var React = require('react/addons');
var Router = require('react-router');
var RouteHandler = Router.RouteHandler;
var Authenticate = require('./authenticate');
var PouchDB = require('pouchdb');
var sjcl = require('sjcl')
var alertify = require('alertifyjs')

var db = new PouchDB('journey_app', {auto_compaction: true});
window['db'] = db; //debugging


module.exports = React.createClass({
	mixins: [ Router.State ],
	componentWillMount: function() {
		document.addEventListener("pause", function() {
			this.setState({key: undefined})
		}.bind(this), false);
	},
	componentWillUnmount: function() {

	},
	getInitialState: function() {
		return {
			key: undefined
		}
	},
	setKey: function(key) {
		db.get('journey_metadata').then(function(doc) {
			try {
				var result = sjcl.decrypt(key, doc.verify)
				this.setState({key: key})
			}
			catch(err) {
				if (err.message === "ccm: tag doesn't match") {
					alertify.error('Wrong!', 1)
				}
				else {
					console.log(err.stack);
				}
			}

		}.bind(this)).catch(function(e) {
			if (e.status===404) {
				createMetadata(key)
				this.setState({key: key})
			}		
		}.bind(this))
	},
	render: function() {
		var handler = <RouteHandler db={db} foo="bar" authkey={this.state.key} />

		if (!this.state.key) {
			handler = <Authenticate onAuthenticated={this.setKey} />
		}

		
		return (
			<div>
				<main>
					{handler}
				</main>
			</div>
		);
	}
});

function createMetadata(key) {
	db.put({
		_id: 'journey_metadata',
		verify: sjcl.encrypt(key, 'journey journal'),
		nextId: 0		
	}).then(function(response) {
	}).catch(function(e) {
		console.log(e)
	})
}

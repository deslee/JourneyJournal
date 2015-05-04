var React = require('react/addons');
var Router = require('react-router');
var RouteHandler = Router.RouteHandler;
var decrypt = require('../utilities/decryptEntry')
var alertify = require('alertifyjs')

var Gapi = require('../components/gapi')

module.exports = React.createClass({
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
			<div className="journey_container">
				<div className="journey_toolbar entry_top">
					<div className="entry_back" onClick={this.transitionToIndex}>
						&#8592; back
					</div>
				</div>
				<div className="content">

					<Gapi db={this.props.db}></Gapi>

					<button onClick={this.exportFile.bind(this, false)}>Export to json (encrypted)</button><br />
					<button onClick={this.exportFile.bind(this, true)}>Export to json (decrypted)</button><br />

					<button onClick={this.deleteJournal}>Delete journal</button>

					<textarea className="jsonView" value={this.state.json}></textarea>
				</div>
			</div>
		);
	}
});

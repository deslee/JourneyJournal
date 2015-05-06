var React = require('react/addons');
var Router = require('react-router');
var RouteHandler = Router.RouteHandler;
var alertify = require('alertifyjs')
var handleGapiRequest = require('../utilities/gapiHandler')

module.exports = React.createClass({
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
			<div>
			{this.state.files.map(function(file) {
				return <div className="buttonGroup" key={file.id} >
					<button className="restore_btn" onClick={this.restoreFromFile.bind(this, file)}>{file.title}</button>
					<button className={"delete_btn"+(file.deleting ? ' deleting' : '')} onClick={this.deleteFile.bind(this, file)}>Delete</button>
				</div>									  
			}.bind(this))} 
			</div>
	   ) : <p>Loading</p>
		
		return (
			<div className="journey_container">
				<div className="journey_toolbar entry_top">
					<div className="entry_back" onClick={this.transitionTo.bind(this, 'settings')}>
						&#8592; back
					</div>
				</div>
				<div className="restore_screen">
					{fileButtons}
				</div>
			</div>
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

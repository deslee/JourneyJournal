var React = require('react/addons');
var Router = require('react-router');
var RouteHandler = Router.RouteHandler;
var confirmAuthorized = require('../utilities/confirmAuthorized')
var alertify = require('alertifyjs')

module.exports = React.createClass({
	mixins: [ Router.State, Router.Navigation ],
	getInitialState: function() {
		return {
			files: [],
			loading: true
		}
	},
	componentWillMount: function() {
		var getFile = function(file) {
			gapi.client.drive.files.get({
				fileId: file.id,
				alt:'media'
			}).execute(function(response) {
				console.log(response);
			})
		}.bind(this)

		var fileListReceived = function(files) {
			console.log(files);
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
		this.transitionTo('index')
	},
	render: function() {
		console.log(this.state.loading);
		var fileButtons = this.state.loading === false ? (
			<div>
			{this.state.files.map(function(file) {
				return <button key={file.id} onClick={this.restoreFromFile.bind(this, file)}>{file.title}</button>									  
			}.bind(this))} 
			</div>
	   ) : <p>Loading</p>
		
		return (
			<div className="journey_container">
				<div className="restore_screen">
					{fileButtons}
				</div>
			</div>
		);
	}
});

var React = require('react/addons');
var Router = require('react-router');
var handleGapiRequest = require('../utilities/gapiHandler')
var moment = require('moment')

module.exports = React.createClass({
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
		return (<div>
			<button onClick={this.backup}>{backupText}</button><br />
			<button onClick={this.restore}>{restoreText}</button><br />
		</div>)
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

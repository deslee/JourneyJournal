function confirmAuthorized(callback) {
	var info = {
		client_id: '256745719204-avgd75431oti4orl29t52mjqr93bu3d5.apps.googleusercontent.com',
		scope: 'https://www.googleapis.com/auth/drive.appfolder',
	}

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

module.exports = confirmAuthorized

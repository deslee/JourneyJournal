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


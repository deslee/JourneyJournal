var express=require('express'),
	bodyParser = require('body-parser'),
	unirest = require('unirest')


var info = {
	client_id: '671665185348-plgvceofju2co1aoc94cig2kcf6r0mh6.apps.googleusercontent.com',
	scope: 'https://www.googleapis.com/auth/drive.appfolder',
	client_secret: require('./secret')
}
var app = express();
app.set('port', 8001);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get('/authorize/journey', function(req, res) {
	var code = req.query.code;
	var error = req.query.error;

	if (code) {
		unirest.post('https://accounts.google.com/o/oauth2/token')
		.send('code='+code)
		.send('client_id='+info.client_id)
		.send('client_secret='+info.client_secret)
		.send('redirect_uri=https://deslee.me/authorize/journey')
		.send('grant_type=authorization_code')
		.end(function(response){
			if (response.statusCode===200) {
				res.send(
					JSON.stringify(response.body)
				)
			} else {
				console.log(response)
				res.send('error')
			}
		})
	}
	else if (error){
		console.log(error);
		res.send('error')
	}
	else {
		console.log(req)
		console.log("neither code nor error");
		res.status(401).send('invalid');
	}


});

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));		  
});

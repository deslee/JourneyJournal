var React = require('react/addons');
var Router = require('react-router');
var ensureLoaded = require('./utilities/ensureGapiLoaded')

var Route = Router.Route;
var Link = Router.Link;
var DefaultRoute = Router.DefaultRoute;
var NotFoundRoute = Router.NotFoundRoute;

var RootRouteHandler = require('./routes/RootRouteHandler')
var NotFoundRouteHandler = require('./routes/NotFoundRouteHandler');


var SettingsRouteHandler = require('./routes/SettingsRouteHandler');
var EditorRouteHandler = require('./routes/EditorRouteHandler');
var IndexRouteHandler = require('./routes/IndexRouteHandler');
var restoreRouteHandler = require('./routes/RestoreRouteHandler');
/* deslight require hook - do not modify this line */

var routes = (
	<Route handler={RootRouteHandler} path="/">
		<DefaultRoute handler={IndexRouteHandler} name='index'/>
		<Route handler={EditorRouteHandler} name="editor" path='editor/:id'/>
		<NotFoundRoute handler={NotFoundRouteHandler} />
		<Route handler={SettingsRouteHandler} name='settings' path='settings'/>
<Route handler={restoreRouteHandler} name='restore' path='restore'/>
/* deslight route hook - do not modify this line */
	</Route>
);


function init() {
	ensureLoaded(function() {
		Router.run(routes, function(Handler) {
				   React.render(<Handler />, document.getElementById('root_journey'));
		});
	})
}

if (typeof(device) != 'undefined' && device.platform !== 'browser') {
		document.addEventListener('deviceReady', function() {
			init()
		}, false)
}
else {
	init()
}

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
	<Route handler={RootRouteHandler} path="/">
		<DefaultRoute handler={IndexRouteHandler} name='index'/>
		<Route handler={EditorRouteHandler} name="editor" path='editor/:id'/>
		<NotFoundRoute handler={NotFoundRouteHandler} />
		<Route handler={SettingsRouteHandler} name='settings' path='settings'/>
/* deslight route hook - do not modify this line */
	</Route>
);

document.addEventListener('deviceReady', function() {
	Router.run(routes, function(Handler) {
		React.render(<Handler />, document.getElementById('root_journey'));
	});
}, false)



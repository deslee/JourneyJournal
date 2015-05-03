var React = require('react/addons');
var Router = require('react-router');

module.exports = React.createClass({
	submit: function(e) {
		if (e.keyCode===13) {
			this.props.onAuthenticated(this.refs.password.getDOMNode().value)
		}
	},
	render: function() {
		return (<div className="auth_wrapper">
				<div>
					<i className="fa fa-lock"></i>
					<input placeholder="enter a password" type="password" autoFocus="true" ref="password" onKeyDown={this.submit}/>
				</div>
		</div>)
	}
});

var React = require('react/addons');
var Router = require('react-router');

module.exports = React.createClass({
	submit: function(e) {
		if (e.keyCode===13) {
			var element = this.refs.password.getDOMNode()
			this.props.onAuthenticated(element.value)
			element.value = ''
		}
	},
	resetDatabase: function() {
		var message = "Are you sure?\nThis cannot be undone!"
		alertify.confirm(message).set('title', 'Delete Journal').set('labels', {ok:'Yes', cancel:'No'}).set('onok', function(){
			this.props.clearDatabaseAndDeauthenticate()
		}.bind(this));
		alertify.error('Journal reset!', 1)
	},
	render: function() {
		var placeholder = 'choose a password'
		if (this.props.verifyKey) {
			placeholder = 'verify password'
		}
		if (this.props.exists) {
			placeholder = 'enter a password'
		}

		var resetpw = (this.props.wrongAttempts >= 3) ? <div onClick={this.resetDatabase} className="reset_password_button"><p>forgot your password?</p><p>click here to delete the journal and start over</p></div> : undefined

		return (<div className="auth_wrapper">
				<div>
					<i className="fa fa-lock"></i>
					<input placeholder={placeholder} type="password" autoFocus="true" ref="password" onKeyDown={this.submit}/>
				</div>
				{resetpw}
		</div>)
	}
});

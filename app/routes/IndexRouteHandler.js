var React = require('react/addons');
var Router = require('react-router');
var RouteHandler = Router.RouteHandler;
var decrypt = require('../utilities/decryptEntry')

module.exports = React.createClass({
	mixins: [ Router.State, Router.Navigation ],
	getInitialState: function() {
		return {
			entries: []
		}
	},
	componentDidMount: function() {
		var db = this.props.db;
		db.get('journey_metadata')
		.then(function(doc) {
			var nextId = doc.nextId

			db.allDocs({
				include_docs: true,
				startkey: 'entry0',
				endkey: 'entryz'
			}).then(function(results) {
				var results = results.rows.map(function(doc){
					var entry = decrypt(this.props.authkey, doc.doc);
					return entry
				}.bind(this));
				this.setState({ results:results, entries:results })
			}.bind(this))
			.catch(function(e) {
				console.log(e);
			});
		}.bind(this));

	},
	createEntry: function() {
		var db = this.props.db;
		db.get('journey_metadata')
		.then(function(doc) {
			var nextId = doc.nextId
			doc.nextId++;
			db.put(doc).then(function(doc) {
			})
			.catch(function(e) {
				console.log(e);
			});

			this.transitionTo('editor', {id: 'entry'+doc.nextId});
		}.bind(this));
	},
	editEntry: function(entry, e) {
		this.transitionTo('editor', {id: entry._id})
	},
	filter: function(e) {
		var value = e.target.value;
		if (value.length > 0) {
			this.setState({entries: this.state.results.filter(function(entry) {
				return entry.content.indexOf(value) !== -1 || entry.tags.join().indexOf(value) !== -1
			})})
		}
		else {
			this.setState({entries: this.state.results})
		}
	},
	focusSearch: function() {
		this.refs.filter.getDOMNode().focus()
	},
	settingsClicked: function() {
		this.transitionTo('settings');
	},
	render: function() {
		var route = this.getRoutes();

		
		return (
			<div className="journey_container">
				<div className="journey_toolbar search" onClick={this.focusSearch}>
					<i className="fa fa-search search_index"></i>
					<input placeholder="filter" ref="filter" onChange={this.filter} className="journey_input" type="text" />
					<i className="fa fa-cog settings_button" onClick={this.settingsClicked}></i>
				</div>
				<div className="journey_index_list content">
					{this.state.entries.map(function(entry) {
						if (entry.tags.length > 0) {
							var tags = <span>tags: {entry.tags.map(function(tag, idx, list) {
								if (idx == list.length-1) {
									return <span key={tag}>{tag}</span>
								}
								return (
									<span key={tag}>{tag}, </span>
								)					
							})}
							</span>
						}

						return (
							<div className="journey_index_item" onClick={this.editEntry.bind(this, entry)} key={entry._id}>
								<div className="journey_index_item_title">
								 {entry.title.substring(0, 24) + ((entry.title.length > 24) ? '...':'') }
								</div>	

								<div className="journey_index_item_metadata">
									{tags}&nbsp;
								</div>	
							</div>
						)				
					}.bind(this))}
				</div>

				<div onClick={this.createEntry} className="journey_toolbar create">
					create new entry
				</div>
			</div>
		);
	}
});

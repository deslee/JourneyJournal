jest.dontMock('../gapi.js');

describe('gapi', function() {
	it('is a generic component', function() {
		var React = require('react/addons');
		var gapi = require('../gapi.js');
		var TestUtils = React.addons.TestUtils;

		var Component = TestUtils.renderIntoDocument(
			<gapi />
		);

		expect(true).toBe(true);
	});
});

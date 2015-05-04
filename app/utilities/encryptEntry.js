var sjcl = require('sjcl')

module.exports = function(key, entry) {
	entry.content = sjcl.encrypt(key, entry.content)
	entry.tags = sjcl.encrypt(key, entry.tags.join(','))
	return entry;
}

const args = process.argv.slice(2).reduce((map, arg) => {
	const match = /^--([a-z-]+)(?:=(.*))?/.exec(arg);
	map[match[1]] = { value: match[2] };
	return map;
}, {});

module.exports = {
	watch: Boolean(args['watch']),
	mix: args['mix']?.value || 'febuild.mix.js',
};

const process = require('process');
const path = require('path');

const febuild = require('../main.js');
const config = require('../config.js');
const fs = require('fs');

async function setup() {
	const mix = path.isAbsolute(config.mix)
		? config.mix
		: path.join(process.cwd(), config.mix);

	try {
		// Load users's mix config file.
		require(mix);
	} catch (e) {
		if (e.code === 'MODULE_NOT_FOUND') {
			console.error('Unable to find mix config file:', mix);
			return;
		}

		throw e;
	}

	// Run all tasks once:
	febuild.tasks.forEach(task => task());
}

setup();

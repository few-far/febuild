const chokidar = require('chokidar');
const feconfig = require('./config.js');
const tasks = [];

function isInstalled(package) {
	try {
		require(package);
		return true;
	} catch (ex) {
		return false;
	}
}

function onReject(...args) {
	console.error('❌ Error', ...args);
}

function makeWatch(watch, task) {
	const watcher = chokidar.watch(watch, {
		ignored: /(^|[\/\\])\../, // ignore dotfiles
		persistent: true,
	});

	let currentPromise = null;
	let shouldRerun = false;

	function build() {
		if (currentPromise) {
			shouldRerun = true;
			return;
		}

		currentPromise = task().then(() => {
			if (shouldRerun) {
				process.nextTick(build);
				shouldRerun = false;
			}

			currentPromise = null;
		}, (error) => {
			console.error(error);
		});
	}

	watcher.on('change', (path) => {
		console.log('⚡️ Changed: ', path);

		build();
	});

	return { watcher, task, build };
}

function makeTask(name, input, output, options, task) {
	function worker() {
		const promise = task();

		promise.then((result) => {
			console.log(`✅ Compiled ${ input } => ${ output }`);
		}, (error) => onReject(error));

		return promise;
	}

	tasks.push(worker);

	if (feconfig.watch) {
		return makeWatch(options.watch, worker);
	} else {
		return { task: worker };
	}
}

/**
 * @typedef TaskResult
 * @type {object}
 * @property {string?} chokidar - watcher if script is watching.
 * @property {function?} build - build function if script is watching.
 * @property {function} task - task function.
 */

module.exports = {
	// Internals
	makeWatch,
	makeTask,
	tasks,

	// General API

	/**
	 *
	 * @param {string} input
	 * @param {string} output
	 * @param {Object} [options] - optional config options.
	 * @param {(string|string[])=} options.watch - Paths to watch given to Chokidar
	 * @returns {TaskResult}
	 */
	js(input, output, options = {}) {
		if (!['esbuild', 'vue-template-compiler', 'esbuild-vue-plugin'].every(isInstalled)) {
			console.log('Install vue dependencies: npm i --save-dev "esbuild@^0.8" "vue-template-compiler@^2.6" "esbuild-vue-plugin@^0.1"');
			process.nextTick(process.exit);
			return;
		}

		const vuePlugin = require('esbuild-vue-plugin');
		const opts = {
			...options,
			watch: [].concat(options.watch, input).filter(el => el)
		};

		return makeTask('esbuild', input, output, opts, () => require('esbuild').build({
			entryPoints: [input],
			bundle: true,
			outfile: output,
			minify: true,
			plugins: [vuePlugin()],
			define: {
				'process.env.NODE_ENV': `"${ process.env.NODE_ENV }"`,
			},
		}));
	},

	/**
	 * Runs the CSS file through PostCSS.
	 *
	 * @param {string} input
	 * @param {string} output
	 * @param {Object} [options] - optional config options.
	 * @param {(string|string[])=} options.watch - Paths to watch given to Chokidar
	 * @param {string=} options.tailwind - Path to tailwind.config.js ()
	 * @return {TaskResult}
	 */
	css(input, output, options = {}) {
		if (!['postcss', 'autoprefixer', 'tailwindcss'].every(isInstalled)) {
			console.log('Install vue dependencies: npm i --save-dev "postcss@^8.1" "autoprefixer@^10.1" "tailwindcss@^2.0"');
			process.nextTick(process.exit);
			return;
		}

		const tailwindConfigPath = options.tailwind || './tailwind.config.js';
		const opts = {
			...options,
			watch: [].concat(options.watch, input, tailwindConfigPath).filter(el => el)
		};

		return makeTask('css', input, output, opts, async () => {
			const fs = require('fs');

			// PostCSS
			const postcss = require('postcss');
			const plugins = [
				require('autoprefixer'),
				require('tailwindcss')({ config: tailwindConfigPath }),
			];

			const css = await fs.promises.readFile(input);

			const result = await postcss(plugins).process(css, { from: input, to: output });
			await fs.promises.writeFile(output, result.css);
			return result;
		});
	}
}

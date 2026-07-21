const esbuild = require('esbuild');
const glob = require('glob');
const path = require('path');
const copyStaticFiles = require('esbuild-copy-static-files');
const { sentryEsbuildPlugin } = require("@sentry/esbuild-plugin");

// This is a web extension: `main`/`browser` both point at one bundle that runs
// in VS Code's browser worker. `yaml`'s Node build does `require('process')`,
// which throws there, so pull in its `process`-free browser build instead.
const yamlBrowserBuild = path.resolve(__dirname, 'node_modules/yaml/browser/index.js');


const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

async function main() {
  const sharedOptions = {
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: production ? 'external' : false,
    sourcesContent: false,
    platform: 'node',
    alias: { yaml: yamlBrowserBuild },
    outdir: 'dist/',
    logLevel: 'warning',
  };

  const extensionCtx = await esbuild.context({
    ...sharedOptions,
    entryPoints: ['src/extension.ts'],
    external: ['vscode'],
    plugins: [
      copyStaticFiles({
				src: './static',
      	dest: './dist/static',
				dereference: true,
				force: true,
				recursive: true,
			}),
      sentryEsbuildPlugin({
        disable: !process.env.CI,
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        environment: production ? 'production' : 'development',
        release: {
          finalize: false,
          name: process.env.RELEASE,
        },
        sourcemaps: {
          filesToDeleteAfterUpload: [
            "./dist/**/*.map",
          ],
        },
      }),
      esbuildProblemMatcherPlugin,
    ]
  });

  const testCtx = await esbuild.context({
    ...sharedOptions,
    entryPoints: ['src/web/test/suite/extensionTests.ts'],
    outbase: 'src',
    external: ['vscode'],
    plugins: [
      testBundlePlugin,
      esbuildProblemMatcherPlugin,
    ]
  });

  if (watch) {
    await Promise.all([extensionCtx.watch(), testCtx.watch()]);
  } else {
    await Promise.all([extensionCtx.rebuild(), testCtx.rebuild()]);
    await Promise.all([extensionCtx.dispose(), testCtx.dispose()]);
  }
}

/**
 * For web extension, all tests, including the test runner, need to be bundled into
 * a single module that has a exported `run` function .
 * This plugin bundles implements a virtual file extensionTests.ts that bundles all these together.
 * @type {import('esbuild').Plugin}
 */
const testBundlePlugin = {
  name: 'testBundlePlugin',
  setup(build) {
    build.onResolve({ filter: /[\/\\]extensionTests\.ts$/ }, args => {
      if (args.kind === 'entry-point') {
        return { path: path.resolve(args.path) };
      }
    });
    build.onLoad({ filter: /[\/\\]extensionTests\.ts$/ }, async args => {
      const srcRoot = path.join(__dirname, 'src');
      const files = await glob.glob('**/*.test.{ts,tsx}', { cwd: srcRoot, posix: true, ignore: ['node_modules/**'] });
      return {
        contents:
          `export { run } from './mochaTestRunner.ts';` +
          files.map(f => `import '../../../${f}';`).join(''),
        watchDirs: files.map(f => path.dirname(path.resolve(srcRoot, f))),
        watchFiles: files.map(f => path.resolve(srcRoot, f))
      };
    });
  }
};

/**
 * This plugin hooks into the build process to print errors in a format that the problem matcher in
 * Visual Studio Code can understand.
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: 'esbuild-problem-matcher',

  setup(build) {
    build.onStart(() => {
      console.log('[watch] build started');
    });
    build.onEnd(result => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        if (location === null) {
          return;
        };
        console.error(`    ${location.file}:${location.line}:${location.column}:`);
      });
      console.log('[watch] build finished');
    });
  }
};

main().catch(e => {
  console.error(e);
  process.exit(1);
});

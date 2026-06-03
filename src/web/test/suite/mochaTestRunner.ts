// @ts-ignore
require('mocha/mocha');

mocha.setup({
  ui: 'tdd',
  reporter: undefined,
});

export function run(): Promise<void> {
  return new Promise((resolve, reject) => {
    // The esbuild testBundlePlugin generates dynamic imports (Promise.resolve().then(...))
    // for each test file. These resolve as microtasks after the current execution context.
    // Use setTimeout to defer mocha.run() until all test suites have registered.
    setTimeout(() => {
      try {
        mocha.run(failures => {
          if (failures > 0) {
            reject(new Error(`${failures} tests failed.`));
          } else {
            resolve();
          }
        });
      } catch (err) {
        console.error(err);
        reject(err);
      }
    }, 0);
  });
}

import { exec } from "child_process";
import gulp from "gulp";

// Function to execute npm run script
function runScript(scriptName, callback) {
  exec(`npm run ${scriptName}`, (error, stdout, stderr) => {
    console.log(stdout);
    console.error(stderr);
    callback(error);
  });
}

// Task to build TypeScript files
gulp.task("build", function (callback) {
  runScript("build", callback);
});

// Task to lint TypeScript files
gulp.task("lint", function (callback) {
  runScript("lint", callback);
});

// Task to run tests
gulp.task("test", function (callback) {
  runScript("test", callback);
});

// Task to generate coverage report
gulp.task("coverage", function (callback) {
  runScript("coverage", callback);
});

// Combination task
gulp.task("all", gulp.series("lint", "build", "coverage"));

// Default task
gulp.task("default", gulp.series("all"));

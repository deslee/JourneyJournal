var gulp = require('gulp');
var browserify = require('gulp-browserify');
var rename = require('gulp-rename');
var preprocess = require('gulp-preprocess');
var process = require('process');
var livereload = require('gulp-livereload');
var webserver = require('gulp-webserver');
var autoprefixer = require('gulp-autoprefixer');

var sass = require('gulp-sass');



var runSequence = require('run-sequence');
var sourcemaps = require('gulp-sourcemaps');

var build_options = {
	'isDev': process.env.NODE_ENV != 'production'
};


var external_libraries = [
	"react/addons","react-router","object-assign","flux","keymirror",
	'alertifyjs', 'pouchdb', 'moment'
]

/**
 * Browserify the external vendors and move them to ./www
 **/
gulp.task('build:vendor', function() {
	return gulp.src('./app/noop.js', {read: false})
	.pipe(browserify({
		debug: process.env.NODE_ENV != 'production'
	}))
	.on('prebundle', function(bundle) {
		external_libraries.forEach(function(lib) {
			bundle.require(lib);
		});
	})
	.pipe(rename('vendor.js'))
	.pipe(gulp.dest('./www'));
});

/**
 * Browserify the main file and move it to ./www
 **/
gulp.task('build:app', function() {
	return gulp.src('./app/main.js', {read: false})
	.pipe(browserify({
		transform: ["reactify"],
			debug: process.env.NODE_ENV != 'production'
	}))
	.on('prebundle', function(bundle) {
		external_libraries.forEach(function(lib) {
			bundle.external(lib);
		});
	})
	.on('error', function(err) {console.error(err.message)})
	.pipe(rename('app.js'))
	.pipe(gulp.dest('./www'));
});

/**
 * Precompile the style and move it to ./www
 **/
gulp.task('move:css', function() {
	
	
		
  return gulp.src('./app/app.scss')
		.pipe(sourcemaps.init())
		.pipe(sass({errLogToConsole: true}))
		
		
		.pipe(autoprefixer())
		.pipe(sourcemaps.write())
	
    .pipe(gulp.dest('./www'));
});

/**
 * Preprocess index.html and move it to ./www
 **/
gulp.task('move:html', function() {
	return gulp.src('./app/index.html')
	.pipe(preprocess({
		context: build_options
	}))
	.pipe(gulp.dest('./www'));
});

/**
 * Move the static assets to ./www
 **/
gulp.task('move:assets', function() {
	return gulp.src('./app/assets/**/*')
	.pipe(gulp.dest('./www/assets'));
});

gulp.task('move:bower', function() {
	return gulp.src('./bower_components/**/*')
	.pipe(gulp.dest('./www/bower_components'));
});

gulp.task('build', function(cb) {
	runSequence(['build:vendor', 'build:app'], cb)
});

gulp.task('move', function(cb) {
	runSequence(['move:html', 'move:css', 'move:assets', 'move:bower'], cb);
});

gulp.task('main', function(cb) {
	runSequence('build', 'move', cb);
});

gulp.task('serve', function() {
	return gulp.src('./www')
	.pipe(webserver({
		host: '0.0.0.0',
		port: process.env.PORT || 8000
	}));
});

gulp.task('watch', function() {
	var watch = function(path, task) {
		gulp.watch(path, function(events) {
			console.log(events.path + ' changed. running task ' + task + '.');
			runSequence(task, function() {
				livereload.changed(events.path);
			})
		}).on('change', function(file) {
		});
	};

	livereload.listen();

	watch('./app/index.html', 'move:html');
	watch('./app/**/*.js', 'build:app');


	
	
	watch('./app/**/*.scss', 'move:css');
	
	

	watch('./app/assets/**/*', 'move:assets');
});
gulp.task('production', function(cb) {
		build_options.isDev = false;
		runSequence('main', cb);
})

gulp.task('default', function(cb) {
	console.log("running in " + (build_options.isDev ? 'development mode' : 'production mode'));
	if (build_options.isDev) {
		build_options.isDev = true;
		runSequence('main', 'watch', 'serve', cb);
	}
	else {
		build_options.isDev = false;
		runSequence('main', cb);
	}
});


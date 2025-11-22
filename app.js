var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var authRouter = require('./routes/auth');
var protectedRouter = require('./routes/protected');
var streamsRouter = require('./routes/streams');
var adminDebugRouter = require('./routes/admin_debug');
var messagesRouter = require('./routes/messages');
var giftsRouter = require('./routes/gifts');
var levelsRouter = require('./routes/levels');
// background workers
try { var streamPointsWorker = require('./workers/streamPointsWorker'); } catch (e) { console.warn('streamPointsWorker not available', e && e.message); }

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');



app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Enable CORS for API requests from frontend
app.use(cors());



app.use('/api', authRouter);
app.use('/api', protectedRouter);
app.use('/api', streamsRouter);
app.use('/api', adminDebugRouter);
app.use('/api', messagesRouter);
app.use('/api', giftsRouter);
app.use('/api', levelsRouter);
// start background workers after routes are mounted
try { if (streamPointsWorker && typeof streamPointsWorker.start === 'function') streamPointsWorker.start(); } catch (e) { console.warn('failed to start streamPointsWorker', e && e.message); }
app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;

var createError = require('http-errors');
var express = require('express');
var path = require('path');
var logger = require('morgan');
var config = require('config');
var multer  = require('multer')
var { Pool } = require('pg')


var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var authRouter = require('./routes/auth');
var dataRouter = require('./routes/data');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

var sub = express.Router();
sub.use('/', indexRouter);
sub.use(authRouter);
sub.use('/data', dataRouter);
sub.use('/users', usersRouter);
app.use('/api', sub);

var connectionString = config.get('postgres.connectionString');
app.locals.db = new Pool({connectionString});

app.use(function(req, res, next) {
  next(createError(404));
});

app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500).json({error: res.locals.error});
});

module.exports = app;

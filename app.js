require('babel-register')

var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var ejs = require('ejs');

var ex =  require('./public/javascripts/init');
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var blogRouter = require('./routes/blog');
var userRouter = require('./routes/user');
//添加对post请求的支持
const bodyParser = require('body-parser');
ex.initSysInfo();


//自定义router
var downloadRouter = require('./routes/downloadfile');
var uploadRouter = require('./routes/upload_file');
var testRouter = require('./routes/test');
var app = express();

//设置跨域请求,解决：
//Access to XMLHttpRequest at 'http://localhost:3000/product' from origin 'http://127.0.0.1:8080' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
app.all('*', function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header('Access-Control-Allow-Headers', 'Content-Type, Content-Length, Authorization, Accept, X-Requested-With , yourHeaderFeild');
  res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
  res.header("X-Powered-By", ' 3.2.1')
  res.header("Content-Type", "application/json;charset=utf-8");
  next();
});
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.engine('html', require('ejs').__express);  
app.set('view engine', 'html');
//app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/api/blog', blogRouter);
app.use('/api/user', userRouter);
//发布自定义的router
/*app.get('/test',function(req,res){
    res.sendFile(__dirname+'/views/test.html');
});*/

app.use('/downloadfile',downloadRouter);
app.use('/upload_file',uploadRouter);
app.use('/test2',testRouter);
//extended:false 不使用第三方模块处理参数，使用Nodejs内置模块querystring处理
app.use(bodyParser.urlencoded({extended:false}));


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

app.listen(3000, console.log("application is start at port 3000"))

module.exports = app;


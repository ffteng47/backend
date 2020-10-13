var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
    console.log(req.ur);
    res.type('html');
    res.render('test');
  });
  
  module.exports = router;
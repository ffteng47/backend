var express = require('express');
var router = express.Router();

router.post('/login', function(req, res, next){
    const {username, password} = req.body
    return res.json({
        errno : 0,
        data : {
            username :username,
            password: password
        }
    })

})

module.exports = router
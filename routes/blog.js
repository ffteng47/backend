var express = require('express');
var router = express.Router();

router.get('/list', function(req, res, next){
    res.json({
        errno: 0,
        data : [1,2,3]
    })
})


router.post('/update', function(req, res, next){

    const {id, title} = req.body
    res.json({
        errno: 0,
        data : {
            id : id,
            title : title
        }
    })
})


module.exports = router


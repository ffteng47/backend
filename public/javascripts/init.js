import { stringify } from "querystring";
import { createPow } from "@textile/powergate-client"
import fs from "fs"
var MongoClient = require('mongodb').MongoClient;
var systemInfo = {};
var asyncnum = 0;
var pow;
//连接字符串
var DB_CONN_STR = 'mongodb://192.168.31.14:20101/'; 
// get general info about your ffs instance
function initSysInfo(){
    
    //使用客户端连接数据，并指定完成时的回调方法
    MongoClient.connect(DB_CONN_STR, function(err, db) {
        if(!err){
            console.log("初始化连接成功！");
        }else{
            throw err;
        }
        var dbo = db.db("filecoin");
        //var qry = queryFile;
        dbo.collection("systeminfo").find().toArray(function(err, result) {
            if (err){
                rst.rst = false;
                throw err
            };
            console.log(result);
            console.log("查询文档成功" + stringify(result) + ",记录数" + result.length);
            db.close();
            systemInfo["FFSHost"] = result[0]["FFSHost"];
            systemInfo["authToken"] = result[0]["authToken"];
            
            console.log(systemInfo);
            //check ffs 
            var host = systemInfo.FFSHost; // or whatever powergate instance you want
            pow = createPow({ host });
            systemInfo["powergate"] = pow;
            pow.health.check().then((status)=>{console.log("powergate status is " );
                console.log(status);});
            pow.setToken(systemInfo.authToken);
            pow.ffs.info().then(info=>{console.log(info)});
            asyncnum = setInterval(() => {
                console.log("check health");
                pow.health.check().then((status)=>{console.log("powergate status is " + stringify(status));
                //pow.ffs.info().then(info=>{console.log(info)}); 
                //var cache = fs.readFileSync("uploads/159c91d673d635e3a91dbc30d7c2af3d");
                //pow.ffs.stage(cache).then(fff=>{console.log(fff)}).catch(err=>{console.log(err)})
                //console.log(status);
                //console.log(pow);
            });
            }, 20000);
        });
    });
}

exports.initSysInfo = initSysInfo
exports.systemInfo = systemInfo
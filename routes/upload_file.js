var express = require('express');
//引入mongodb模块，获得客户端对象
var MongoClient = require('mongodb').MongoClient;
var init = require('../public/javascripts/init');
import { createPow } from "@textile/powergate-client"
import { stringify } from "querystring";
import { JobStatus } from "@textile/grpc-powergate-client/dist/ffs/rpc/rpc_pb"
import fs from "fs"
import { query } from "express";

//连接字符串
var DB_CONN_STR = 'mongodb://192.168.31.14:20101/'; 
//const host = init.systemInfo.FFSHost; // or whatever powergate instance you want
//const authToken  = init.systemInfo.authToken;
var pow ;
//pow.setToken(authToken );
//var pinged = false;
//var fileStatusMap={};
var tmpFile = {};

//定义函数表达式，用于操作数据库并返回结果
var insertData = function(db,fileStatus,callback) {  
    //获得指定的集合 
    var collection = db.collection('fileStatusMap');
    //插入数据
    var data = fileStatus;//[{"name":'rose',"age":21},{_id:8,"name":'mark',"age":22}];
    collection.insert(data, function(err, result) { 
        //如果存在错误
        if(err)
        {
            console.log('Error:'+ err);
            return;
        } 
        //调用传入的回调方法，将操作结果返回
        callback(result);
    });
}
//插入新的数据记录
function insertFileStatus(fileStatus){
    //使用客户端连接数据，并指定完成时的回调方法
    MongoClient.connect(DB_CONN_STR, function(err, db) {
        if(!err){
            console.log("插入连接成功！" + stringify(fileStatus));
        }else{
            throw err;
        }
        var dbo = db.db("filecoin");
        var myobj = fileStatus;
        dbo.collection("powergate").insertOne(myobj, function(err, res) {
            if (err) throw err;
            console.log("文档插入成功");
            db.close();
        });
});
}
//更新数据状态
function updateFileStatus(query,fileStatus){
    //0:ok,1:not find,2:more record,3:db error
    var rst = {code:0,data:{}};
    //使用客户端连接数据，并指定完成时的回调方法
    MongoClient.connect(DB_CONN_STR, function(err, db) {
        if(!err){
            console.log("更新连接成功！" + stringify(fileStatus));
        }else{
            throw err;
        }
        var dbo = db.db("filecoin");
        var qry = query;
        dbo.collection("powergate").updateOne(query,fileStatus,function(err, result) {
            if (err){
                rst.rst = false;
                throw err
            };
            console.log("更新文档成功" + stringify(result) + ",记录数" + result.length);
            db.close();
            //afterQuery(result);
        });
    });
    return rst;
}
//查询数据的状态
function queryFileStatus(queryFile){
    console.log("host:"+pow);
    //0:ok,1:not find,2:more record,3:db error
    var rst = {code:0,data:{}};
    //使用客户端连接数据，并指定完成时的回调方法
    MongoClient.connect(DB_CONN_STR, function(err, db) {
        if(!err){
            console.log("查询连接成功！" + stringify(queryFile));
            console.log(queryFile);
        }else{
            throw err;
        }
        var dbo = db.db("filecoin");
        //var qry = queryFile;
        dbo.collection("powergate").find(queryFile).toArray(function(err, result) {
            if (err){
                rst.rst = false;
                throw err
            };
            console.log("查询文档成功" + stringify(result) + ",记录数" + result.length);
            db.close();
            afterQuery(result);
        });
    });
    return rst;
}
//查询成功之后的调用
function afterQuery(result){
    var oriMap ;
    var overwrite = false;
    if(result.length === 1){
        oriMap = result[0];
    //if(fileStatusMap.hasOwnProperty(oriName)){
        //oriMap = fileStatusMap[oriName];
        console.log("there exists file " + oriMap.originalname + ":" + stringify(oriMap));
        console.log(oriMap);
        if(oriMap.jobStatus ===  JobStatus.JOB_STATUS_FAILED||oriMap.jobStatus ===  JobStatus.JOB_STATUS_CANCELED){
            console.log("job not executed successfully,reloading......");
            overwrite = true;
        }else{
            console.log("job is active,not process again.");
            //data.msg = "job is active,not process again.";
            //res.json(data);//响应作为数据进行渲染，不以页面展示形式显示。
            return "";
        }
    }else if(result.length === 0){
        oriMap = {originalname:tmpFile.originalname,dest:tmpFile.destination,filename:tmpFile.filename,path:tmpFile.path,size:tmpFile.size,jobStatus:JobStatus.JOB_STATUS_UNSPECIFIED,
        cid:'',jobId:''};
        console.log("there not exists file " + oriMap.originalname + ":" + stringify(oriMap));
        insertFileStatus(oriMap);
    }else if(result.length > 1){
        console.log("ERROR:there are more files: " + stringify(result));
        //data.code = 1;
        //data.msg = "ERROR:there are more files: " + stringify(result.data);
        //res.json(data);
        return "";
    }
    //
    var storageInIPFSFile = oriMap.path;
    console.log("This file :" + storageInIPFSFile + " will be dealed with miners.");
    var cache = fs.readFileSync(storageInIPFSFile);
    //update condition
    var updateQry = {originalname:oriMap.originalname};
    pow.ffs.stage(cache).then(CID=>{
        console.log(CID.cid);
        oriMap.cid = CID.cid
        //update file status
        var updateData = {$set:{cid:CID.cid}};
        // watch all FFS events for a cid
        const logsCancel = pow.ffs.watchLogs((logEvent) => {
            console.log("received event for cid " + logEvent.cid + ",jid " + logEvent.jid + ",time " + logEvent.time + ",msg " + logEvent.msg);
            //console.log(logEvent);
        }, CID.cid);
        updateFileStatus(updateQry,updateData);
        
        if(overwrite){
            return pow.ffs.pushStorageConfig(CID.cid,{override:true});
        }else{
            return pow.ffs.pushStorageConfig(CID.cid);
        }
    }).then(jobID=>{
        console.log(jobID);
        oriMap.jobId = jobID.jobId;
        //update file status
        var updateData = {$set:{jobId:jobID.jobId}};
        updateFileStatus(updateQry,updateData);
        pow.ffs.watchJobs((job) => {
            console.log(job);
            if (job.status === JobStatus.JOB_STATUS_CANCELED) {
                oriMap.JobStatus = JobStatus.JOB_STATUS_CANCELED;
                console.log("job canceled")
            } else if (job.status === JobStatus.JOB_STATUS_FAILED) {
                oriMap.JobStatus = JobStatus.JOB_STATUS_FAILED;
                console.log("job failed")
            } else if (job.status === JobStatus.JOB_STATUS_SUCCESS) {
                oriMap.JobStatus = JobStatus.JOB_STATUS_SUCCESS;
                console.log("job success!")
            }
            //update file status
            var updateData = {$set:{jobStatus:job.status,jobMessage:stringify(job)}};
            updateFileStatus(updateQry,updateData);
        }, jobID.jobId);
    }).catch((error)=>{
        console.log("error when uploading file(s) to ffs ");
        console.log(error);
    });
}
async function exampleCode (filepath) {
    //const { status, messagesList } = await  pow.health.check()
    //const { peersList } =  await pow.net.peers();
    //console.log("peersList:"+stringify(peersList));
    // get wallet addresses associated with your FFS instance
    //const { addrsList } = await pow.ffs.addrs()
    //console.log("addrsList:"+stringify(addrsList));
    // create a new address associated with your ffs instance
    //const { addr } = await pow.ffs.newAddr("my new addr")
    //var cid='QmYTMhRvRnBLxbXPGJCVixHSBwVgtWjVJ86YHC2aATxdzp';
    // get general info about your ffs instance
    //const { info } = await pow.ffs.info()
    //console.log("info:"+info);
    // cache data in IPFS in preparation to store it using FFS
    console.log("store file " + filepath + " in IPFS.");
    const buffer = fs.readFileSync(filepath)
    const { cid } = await pow.ffs.stage(buffer)
    //console.log("cid of " + filepath + "  in IPFS is " + stringify(cid));
    // store the data in FFS using the default storage configuration
    const { jobId } = await pow.ffs.pushStorageConfig(cid)
    //console.log("jobId:"+stringify(jobId));
    // watch the FFS job status to see the storage process progressing
    //var jobId='d77ea619-b0dc-472b-8a3a-05b79bc8cd0e';

    // watch all FFS events for a cid
    const logsCancel = pow.ffs.watchLogs((logEvent) => {
       // console.log('received event for cid ${logEvent.cid}');
        console.log('received event for cid ' + stringify(logEvent.cid) +' msg = '+stringify(logEvent.msg));
    }, cid)

    // get the current desired storage configuration for a cid (this configuration may not be realized yet)
    const { config } = await pow.ffs.getStorageConfig(cid)
    //console.log("config:"+stringify(config));
    // get the current actual storage configuration for a cid
    //const { cidInfo } = await pow.ffs.show(cid)
    //console.log("cidInfo:"+stringify(cidInfo));
    // retrieve data from FFS by cid
    //const bytes = await pow.ffs.get(cid)
    //console.log("bytes:"+stringify(bytes));
    // send FIL from an address managed by your FFS instance to any other address
    //await pow.ffs.sendFil(addrsList[0].addr, "<some other address>", 1000)
    //return "";
}
//var bodyParser = require('body-parser');
var router = express.Router();
//添加对文件的支持
var multer = require('multer');
var path = require("path");
var upload = multer({ dest: 'uploads' });
//var cpUpload = upload.fields([{ name: 'user', maxCount: 1 }, { name: 'gallery', maxCount: 8 }])
//创建application/x-www-form-urlencoded
//var urlencodedParser = bodyParser.urlencoded({extended: false});

//
/*{
    fieldname: 'user',
    originalname: 'package.json',
    encoding: '7bit',
    mimetype: 'application/json',
    destination: 'uploads',
    filename: '5036fa951e1c3305804a9b41a1ffb24f',
    path: 'uploads\\5036fa951e1c3305804a9b41a1ffb24f',
    size: 409
  }*/
//POST /uploadFile 中获取URL编码的请求体
router.post('/*',upload.single('user'),function(req,res,next){
    if(pow === undefined){
        console.log("init powergate!!!");
        pow = init.systemInfo.powergate;
    }
    console.log("tmpFile:" + stringify(tmpFile));
    var data = {code:0,isSuccess:true,msg:"请求成功"};
    try{
        
        console.log(req.body,req.file);
        console.log("uploadfile is calling.");
        //保存临时数据
        tmpFile = req.file;
        var oriName = req.file.originalname;
        //query data from mongodb with originalname
        var queryPara = {originalname:oriName};
        var result = queryFileStatus(queryPara);
        //console.log(cache.toString());
        console.log("加载数据成功," + stringify(tmpFile));
        res.json(data);//响应作为数据进行渲染，不以页面展示形式显示。
    }catch(error){
        console.log("加载数据失败:"+stringify(error));
        data.code=1;
        res.json(data);//响应作为数据进行渲染，不以页面展示形式显示。
    }
});
module.exports = router;
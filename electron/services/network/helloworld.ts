import express from "express";
import {R} from "../../common/util/r.ts";
import {configData, getConfigData} from "../../common/file";
import md5 from "md5"
// import path from "node:path";
function hello(appExpress:express.Express) {
    appExpress.get('/', (_, res) => {
        res.send('Hello World!');
    });
    appExpress.get('/link',async (req, res) => {
        let key= req.query.key
        if (key) {
            key=md5(key as string)
        }
        await getConfigData()
        if (configData?.isRole) {
            configData.password==key?res.send(R.success("连接成功",true)):res.status(400).send(R.error("密码错误",false));
            return;
        }else {
            res.send(R.success("连接成功",true));
        }
    });
}
export { hello }

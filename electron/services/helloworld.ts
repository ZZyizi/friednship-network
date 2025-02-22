import express from "express";
import {R} from "../common/util/r.ts";
// import path from "node:path";
function hello(appExpress:express.Express) {
    appExpress.get('/', (_, res) => {
        res.send('Hello World!');
    });
    appExpress.get('/link', (_, res) => {
        res.send(R.success("连接成功",true));
    });
    // // 处理前端路由（返回 index.html）
    // appExpress.get('*', (_, res) => {
    //     res.sendFile(path.join(__dirname, '../dist/', 'index.html'));
    // });
}
export { hello }

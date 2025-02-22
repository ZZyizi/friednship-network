import express from "express";

function cors(app: express.Application, Url: string){
    // //解决各种跨域问题
    app.all('*',async function(req, res, next) {
        const origin = req.headers.origin;
        if ([Url,'http://127.0.0.1:8080','*'].includes(origin as string)) {
            // 如果是允许的域名，则设置响应头允许跨域访问
            res.setHeader('Access-Control-Allow-Origin', origin as string);
        }
        res.header("Access-Control-Allow-Credentials",'true')
        res.header("Access-Control-Allow-Headers", "X-Requested-With");
        res.header("Access-Control-Allow-Methods","PUT,POST,GET,DELETE,OPTIONS");
        res.header("X-Powered-By",' 3.2.1');
        res.header("Content-Type", "application/json;charset=utf-8");
        res.header("Access-Control-Allow-Headers", "Content-Type,Content-Length, Authorization, Accept,X-Requested-With")
        next();
    })
}
export { cors }

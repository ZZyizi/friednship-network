import express from "express";
import { hello } from "./services/helloworld.ts";
import {file} from "./services/file";
import{ cors }  from './cors'
import os from 'node:os'
import * as path from 'path';
import {fileURLToPath} from "node:url";
import { extname } from 'path'
const app = express();
// 获取网络接口信息
const networkInterfaces = os.networkInterfaces();
let Url:string=`http://127.0.0.1:8080`;
let ip:string=`127.0.0.1`;
const __dirname = path.dirname(fileURLToPath(import.meta.url))
// 遍历网络接口信息，找到 IPv4 地址
Object.keys(networkInterfaces).forEach(interfaceName => {
    networkInterfaces[interfaceName]?.forEach(interfaceInfo => {
        if (interfaceInfo.family === 'IPv4' && !interfaceInfo.internal) {
            Url=`http://${interfaceInfo.address}:${8080}`
            ip=interfaceInfo.address
        }
    });
});
cors(app,Url)//解决跨域

// const CACHE_FILE_PATH = path.join(__dirname, 'cache/fileCache.json');//缓存文件路径

export function startServer(port:number,cache_path:string) {
    hello(app)
    file(app,cache_path,ip)
    // 设置静态文件目录
    app.use(express.static(path.join(__dirname,'..', 'dist'), {
        setHeaders: (res, path) => {
            let name = extname(path);
            switch(name) {
                case '.ico':
                    res.setHeader('Content-Type', 'image/x-icon');
                    break;
                case '.svg':
                    res.setHeader('Content-Type', 'image/svg+xml');
                    break;
                case '.js':
                    res.setHeader('Content-Type', 'application/javascript');
                    break;
                case '.css':
                    res.setHeader('Content-Type', 'text/css');
                    break;
                case '.json':
                    res.setHeader('Content-Type', 'application/json');
                    break;
                case '.png':
                    res.setHeader('Content-Type', 'image/png');
                    break;
                case '.jpg':
                case '.jpeg':
                    res.setHeader('Content-Type', 'image/jpeg');
                    break;
                default:
                    res.setHeader('Content-Type', 'text/html');
            }
        }
    }));
    app.get('*', (_, res) => {
        //打开该网页，使其浏览器可以使用
        res.status(404).send("Not Founded")
    });

    //启动服务
    return new Promise((resolve, reject) => {
        const server = app.listen(port)
            .once('listening', () => {
                console.log(`Server running on port ${port}`)
                resolve(server)
            })
            .once('error', (err:Error) => {
                if (err.message === 'EADDRINUSE') {
                   console.log(`Port ${port} is already in use, trying another port...`)
                } else {
                    console.error(err)
                    reject(err)
                }
            })
    })
}

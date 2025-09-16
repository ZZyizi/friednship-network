import express from "express";
import { hello } from "./services/network/helloworld.ts";
import {file} from "./services/file";
import{ cors }  from './cors'
import os from 'node:os'
import * as path from 'path';
import {fileURLToPath} from "node:url";
import { extname } from 'path'
const app = express();
// import Ssdp from "node-ssdp"
// import xmlbuilder from "xmlbuilder";


// const ssdpServer = new Ssdp.Server({
//     location: {
//         port: 3000,
//         path: '/description.xml'
//     },
//     udn: 'uuid:f8a1b2c3-d4e5-f6g7-h8i9-j0k1l2m3n4o5', // 唯一标识符
//     allowWildcards: true
// });
// ssdpServer.addUSN('urn:schemas-upnp-org:device:MediaRenderer:1');
//
// ssdpServer.start(() => {
//     console.log('SSDP 服务器已启动');
// });
// ssdpServer.on("advertise-alive",(headers)=>{
//     console.log('设备已上线',headers);
// })
// 获取网络接口信息
const networkInterfaces = os.networkInterfaces();
let Url:string=`http://127.0.0.1:8080`;
const __dirname = path.dirname(fileURLToPath(import.meta.url))
// 遍历网络接口信息，找到 IPv4 地址
Object.keys(networkInterfaces).forEach(interfaceName => {
    networkInterfaces[interfaceName]?.forEach(interfaceInfo => {
        if (interfaceInfo.family === 'IPv4' && !interfaceInfo.internal) {
            Url=`http://${interfaceInfo.address}:${8080}`
        }
    });
});
cors(app,Url)//编译环境测试 (解决跨域)

export function startServer(port:number,cache_path:string) {
    hello(app)
    file(app,cache_path)
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
    // 设备描述文件（让 UPnP 客户端获取设备信息）
    // app.get('/description.xml', (_, res) => {
    //     const xml = xmlbuilder.create({
    //         root: {
    //             '@xmlns': 'urn:schemas-upnp-org:device-1-0',
    //             device: {
    //                 deviceType: 'urn:schemas-upnp-org:device:MediaRenderer:1',
    //                 friendlyName: 'Fake DLNA Renderer',
    //                 manufacturer: 'Node.js',
    //                 modelName: 'NodeDLNA',
    //                 UDN: 'uuid:12345678-1234-5678-90ab-cdef12345678',
    //                 serviceList: {
    //                     service: {
    //                         serviceType: 'urn:schemas-upnp-org:service:AVTransport:1',
    //                         serviceId: 'urn:upnp-org:serviceId:AVTransport',
    //                         controlURL: '/upnp/control/AVTransport',
    //                     },
    //                 },
    //             },
    //         },
    //     }).end({ pretty: true });
    //     res.set('Content-Type', 'text/xml');
    //     res.send(xml);
    // })
    // // 处理投屏命令（模拟接收投屏请求）
    // app.post('/upnp/control/AVTransport', (req, res) => {
    //     console.log('收到投屏请求:', req.body);
    //
    //     // 解析 SOAP 请求（这里只是简单打印，真实实现可解析 XML）
    //     const mediaUrlMatch = req.body.match(/<CurrentURI>(.*?)<\/CurrentURI>/);
    //     if (mediaUrlMatch) {
    //         const mediaUrl = mediaUrlMatch[1];
    //         console.log('播放媒体:', mediaUrl);
    //     }
    //
    //     // 返回 SOAP 响应，表示成功
    //     const responseXML = `<?xml version="1.0"?>
    // <s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
    //     <s:Body>
    //         <u:SetAVTransportURIResponse xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"/>
    //     </s:Body>
    // </s:Envelope>`;
    //
    //     res.set('Content-Type', 'text/xml');
    //     res.send(responseXML);
    // });

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

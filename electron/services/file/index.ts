import express from "express";
import {configData, loadCacheFromFile,getConfigData} from "../../common/file/searchFile.ts";
import {FileInter} from "../../../src/api/medium/type.ts";
import fs from "fs";
import { basename,join } from "path";

// const musicList:FileInter[]=[]//二级缓存
export function file(appExpress:express.Express,path:string){
    appExpress.get('/file', async (req, res) => {
        // 执行脚本
        const clientIp = req.hostname;//获取前端请求的ip
        const key=req.query.key?.toString();
        if (!key) {res.send(null);return;}
        await getConfigData()
        const port = configData?configData.port as number:3000;
        const data:FileInter[]|null= await loadCacheFromFile(path,key)
        data?.forEach((item)=>{
            const to= item.info?.picture
            const encodedValue = encodeURIComponent(item.Url);
            item.Url=`http://${clientIp}:${port}/file/get/${item.Name}?path=${encodedValue}`
            if (to&&item.info){
                item.info.picture=item.info&&item.info.picture?`http://${clientIp}:${port}/img/${basename(to)}`:null;
            }
        })
        res.send({ data })
    });
    appExpress.get('/img/:name', async (req, res) => {
        const name= req.params.name;
        const to= join(path,'..','data',name)
        fs.readFile(to, (err, data) => {
            if (err) {
                res.status(500).send('Internal Server Error');
                return;
            }
            res.writeHead(200, {'Content-Type': 'image/png'});
            res.end(data);
        });
    })
    appExpress.get('/file/get/:name', async (req, res) => {
        const path:string|any = req.query.path?.toString();
        // const name:string|any = req.params.name;
        const Suffix= path.split('.').pop()
        // 设置音频文件的响应头，告诉浏览器这是音频流
        res.setHeader('Content-Type',`audio/${Suffix}`);
        // console.log(path.split("\""))
        // 创建文件流并返回音频文件
        try{
            const stat = fs.statSync(path);
            // 获取 Range 请求头
            const range = req.headers.range;
            if (!range) {
                // 如果没有 Range 请求，返回整个文件
                res.status(200).sendFile(path);
                return;
            }

            const CHUNK_SIZE = 10 ** 6; // 1MB
            const start = Number(range.replace(/\D/g, '')); // 获取请求的开始字节
            const end = Math.min(start + CHUNK_SIZE, stat.size - 1); // 计算结束字节，确保不超出文件大小

            const contentLength = end - start + 1; // 计算返回的字节长度
            const readStream = fs.createReadStream(path, { start, end });
            readStream.on('error',(err)=>{
                console.log(err)
            })

            // 返回 206 (Partial Content) 状态码，支持部分内容加载
            res.status(206);
            res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
            res.setHeader('Accept-Ranges', 'bytes');
            res.setHeader('Content-Length', contentLength);
            res.setHeader('Content-Type', 'audio/mpeg');

            // 将音频流传送给客户端
            readStream.pipe(res);
        }catch (e){
            console.log("播放失败")
        }
    });

}

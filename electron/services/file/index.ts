import express from "express";
import {configData, loadCacheFromFile,getConfigData} from "../../common/file";
import {FileInter} from "../../../src/api/medium/type.ts";
import fs from "fs";
import { basename,join } from "path";
import { imageManager } from "../../common/image";

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
        
        try {
            let imagePath: string;
            
            // 尝试通过 ImageManager 获取图片
            const imageInfo = imageManager.getImageInfo(name);
            if (imageInfo && imageInfo.cachedPath && fs.existsSync(imageInfo.cachedPath)) {
                imagePath = imageInfo.cachedPath;
            } else {
                // 尝试通过文件名查找
                const hash = name.split('.')[0]; // 移除扩展名获取哈希
                const foundImageInfo = imageManager.getImageInfo(hash);
                if (foundImageInfo && foundImageInfo.cachedPath && fs.existsSync(foundImageInfo.cachedPath)) {
                    imagePath = foundImageInfo.cachedPath;
                } else {
                    // 回退到传统路径查找
                    imagePath = join(path,'..','data',name);
                    if (!fs.existsSync(imagePath)) {
                        res.status(404).json({ error: 'Image file not found' });
                        return;
                    }
                }
            }
            
            // 读取图片文件
            fs.readFile(imagePath, (err, data) => {
                if (err) {
                    console.error('读取图片文件失败:', err);
                    res.status(500).json({ error: 'Failed to read image file' });
                    return;
                }
                
                // 根据文件扩展名设置正确的 Content-Type
                const ext = imagePath.split('.').pop()?.toLowerCase();
                let contentType = 'image/jpeg'; // 默认
                
                switch (ext) {
                    case 'png':
                        contentType = 'image/png';
                        break;
                    case 'jpg':
                    case 'jpeg':
                        contentType = 'image/jpeg';
                        break;
                    case 'gif':
                        contentType = 'image/gif';
                        break;
                    case 'webp':
                        contentType = 'image/webp';
                        break;
                    case 'bmp':
                        contentType = 'image/bmp';
                        break;
                }
                
                res.writeHead(200, { 
                    'Content-Type': contentType,
                    'Cache-Control': 'public, max-age=31536000', // 缓存一年
                    'Content-Length': data.length
                });
                res.end(data);
            });
        } catch (error) {
            console.error('图片服务错误:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    })
    
    // 新增：图片元信息接口
    appExpress.get('/img/:name/info', async (req, res) => {
        const name = req.params.name;
        
        try {
            // 尝试从 ImageManager 获取图片信息
            const imageInfo = imageManager.getImageInfo(name);
            if (imageInfo) {
                res.json({
                    success: true,
                    data: {
                        hash: imageInfo.hash,
                        relativePath: imageInfo.relativePath,
                        size: imageInfo.size,
                        format: imageInfo.format,
                        createdAt: imageInfo.createdAt,
                        lastUsed: imageInfo.lastUsed,
                        originalPath: imageInfo.originalPath
                    }
                });
            } else {
                // 回退模式：从文件系统获取基本信息
                const imagePath = join(path,'..','data',name);
                if (fs.existsSync(imagePath)) {
                    const stats = fs.statSync(imagePath);
                    res.json({
                        success: true,
                        data: {
                            name,
                            size: stats.size,
                            createdAt: stats.birthtime,
                            lastUsed: stats.atime,
                            mode: 'legacy'
                        }
                    });
                } else {
                    res.status(404).json({ 
                        success: false, 
                        error: 'Image file not found' 
                    });
                }
            }
        } catch (error) {
            console.error('获取图片信息失败:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Failed to get image info' 
            });
        }
    })
    
    // 新增：图片缓存统计接口
    appExpress.get('/img/stats', async (req, res) => {
        try {
            // 尝试从 ImageManager 获取统计信息
            const stats = imageManager.getCacheStats();
            if (stats && stats.totalImages > 0) {
                res.json({
                    success: true,
                    data: {
                        ...stats,
                        mode: 'imagemanager'
                    }
                });
            } else {
                // 回退模式：扫描文件系统
                const dataPath = join(path,'..','data');
                if (fs.existsSync(dataPath)) {
                    const files = fs.readdirSync(dataPath);
                    let totalSize = 0;
                    const formatCounts: Record<string, number> = {};
                    
                    for (const file of files) {
                        const filePath = join(dataPath, file);
                        const stats = fs.statSync(filePath);
                        if (stats.isFile()) {
                            totalSize += stats.size;
                            const ext = file.split('.').pop()?.toLowerCase() || 'unknown';
                            formatCounts[ext] = (formatCounts[ext] || 0) + 1;
                        }
                    }
                    
                    res.json({
                        success: true,
                        data: {
                            totalImages: files.length,
                            totalSize,
                            formatCounts,
                            averageSize: files.length > 0 ? totalSize / files.length : 0,
                            mode: 'legacy'
                        }
                    });
                } else {
                    res.json({
                        success: true,
                        data: {
                            totalImages: 0,
                            totalSize: 0,
                            formatCounts: {},
                            averageSize: 0,
                            mode: 'legacy'
                        }
                    });
                }
            }
        } catch (error) {
            console.error('获取图片统计失败:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Failed to get image stats' 
            });
        }
    })
    
    appExpress.get('/file/get/:name', async (req, res) => {
        const forwardedIps:string|undefined = req.headers['x-forwarded-for'] as string;
        const ip = forwardedIps ? forwardedIps.split(',')[0] : req.ip;

        const path:string|any = req.query.path?.toString();
        const name:string|any = req.params.name;
        const Suffix= path.split('.').pop()
        // 设置音频文件的响应头，告诉浏览器这是音频流
        res.setHeader('Content-Type',`audio/${Suffix}`);
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
            console.log(ip,`播放成功:${name}`)
        }catch (e){
            console.log("播放失败")
        }
    });

}

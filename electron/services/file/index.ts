import express from "express";
import {configData, loadCacheFromFile,getConfigData} from "../../common/file";
import {FileInter} from "../../../src/api/medium/type.ts";
import fs from "fs";
import { basename } from "path";
import { imageManager } from "../../common/image";

export function file(appExpress:express.Express){
    appExpress.get('/file', async (req, res) => {
        // 执行脚本
        const clientIp = req.hostname;//获取前端请求的ip
        const key=req.query.key?.toString();
        if (!key) {
            res.json({ success: false, error: 'Missing key parameter' });
            return;
        }
        await getConfigData()
        const port = configData?configData.port as number:3000;
        const data:FileInter[]|null= await loadCacheFromFile(key)
        data?.forEach((item)=>{
            const to= item.info?.picture
            const encodedValue = encodeURIComponent(item.Url);
            item.Url=`http://${clientIp}:${port}/file/get/${item.Name}?path=${encodedValue}`
            if (to&&item.info){
                item.info.picture=item.info&&item.info.picture?`http://${clientIp}:${port}/img/${basename(to)}`:null;
            }
        })
        res.json({ success: true, data })
    });
    appExpress.get('/img/:name', async (req, res) => {
        const name = req.params.name;

        try {
            let imagePath: string | null = null;

            // 方法1: 通过相对路径查找 (images/xxx.png)
            const imageInfo = imageManager.getImageInfo(name);
            if (imageInfo && imageInfo.cachedPath && fs.existsSync(imageInfo.cachedPath)) {
                imagePath = imageInfo.cachedPath;
                console.log(`[IMG] 通过相对路径找到图片: ${name} -> ${imagePath}`);
            }

            // 方法2: 通过文件名查找 (xxx.png)
            if (!imagePath) {
                const hash = name.split('.')[0]; // 移除扩展名获取哈希
                const foundImageInfo = imageManager.getImageInfo(hash);
                if (foundImageInfo && foundImageInfo.cachedPath && fs.existsSync(foundImageInfo.cachedPath)) {
                    imagePath = foundImageInfo.cachedPath;
                    console.log(`[IMG] 通过哈希找到图片: ${hash} -> ${imagePath}`);
                }
            }

            // 如果都找不到，返回 404
            if (!imagePath) {
                console.warn(`[IMG] 图片未找到: ${name}`);
                res.status(404).json({
                    error: 'Image not found',
                    name: name,
                    message: `图片 ${name} 不存在`
                });
                return;
            }

            // 读取图片文件
            fs.readFile(imagePath, (err, data) => {
                if (err) {
                    console.error('[IMG] 读取图片文件失败:', err);
                    res.status(500).json({ error: 'Failed to read image file', path: imagePath });
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
                console.log(`[IMG] 成功发送图片: ${name} (${contentType}, ${data.length} bytes)`);
            });
        } catch (error) {
            console.error('[IMG] 图片服务错误:', error);
            res.status(500).json({ error: 'Internal server error', details: error });
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
                        cachedPath: imageInfo.cachedPath,
                        size: imageInfo.size,
                        format: imageInfo.format,
                        createdAt: imageInfo.createdAt,
                        lastUsed: imageInfo.lastUsed,
                        originalPath: imageInfo.originalPath
                    }
                });
            } else {
                // 通过哈希再尝试一次
                const hash = name.split('.')[0];
                const foundImageInfo = imageManager.getImageInfo(hash);
                if (foundImageInfo) {
                    res.json({
                        success: true,
                        data: {
                            hash: foundImageInfo.hash,
                            relativePath: foundImageInfo.relativePath,
                            cachedPath: foundImageInfo.cachedPath,
                            size: foundImageInfo.size,
                            format: foundImageInfo.format,
                            createdAt: foundImageInfo.createdAt,
                            lastUsed: foundImageInfo.lastUsed
                        }
                    });
                } else {
                    res.status(404).json({
                        success: false,
                        error: 'Image file not found',
                        name: name
                    });
                }
            }
        } catch (error) {
            console.error('获取图片信息失败:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get image info',
                details: error
            });
        }
    })

    // 新增：图片缓存统计接口
    appExpress.get('/img/stats', async (req, res) => {
        try {
            // 从 ImageManager 获取统计信息
            const stats = imageManager.getCacheStats();
            res.json({
                success: true,
                data: {
                    ...stats,
                    mode: 'imagemanager'
                }
            });
        } catch (error) {
            console.error('获取图片统计失败:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get image stats',
                details: error
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

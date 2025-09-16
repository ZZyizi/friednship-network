import * as fs from 'fs';
import * as path from 'path';
import {FileInter, MusicInfo} from "../../../src/api/medium/type.ts";
import {parseFile} from 'music-metadata';
import {configType} from "../../type/config.ts";
import {SETTINGS_FILE_PATH, CACHE_FILE, CACHE_FILE_PATH, CACHE_DATA, ffmpeg_path} from "../../main.ts";
import fsOld from "fs/promises";
import ffmpeg from 'fluent-ffmpeg';
import crypto from 'crypto';

// 定义音乐文件的扩展名
export const musicType = ['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.wma', '.ape', '.aiff', '.aif', '.aifc', '.mka', '.wv', '.opus', '.mka', '.m4b', '.m4p', '.m4r', '.m4v', '.mpc', '.mp+', '.mpp', '.mp+'];
export const videoType=['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.rmvb', '.rm', '.mpg', '.mpeg', '.mpe', '.mpv', '.m2v', '.mts', '.m2ts', '.ts', '.vob', '.ogv', '.3gp', '.3g2', '.webm', '.ogm', '.divx', '.xvid'];
const mediaType=[...musicType,...videoType]
/**
 * 判断文件是否为音乐文件
 * @param filePath 文件路径
 */
const isMusicFile = (filePath: string): boolean => {
    return mediaType.includes(path.extname(filePath).toLowerCase());
};
let configData:configType|null=null//配置信息
let count=0//计数器
/**
 * 递归查找目录下的音乐文件
 * @param dir 目录路径
 * @param musicFiles 存储找到的音乐文件路径
 */
const findMusicFiles = async (dir: string, musicFiles: FileInter[] = []): Promise<FileInter[]> => {
    try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });// 获取目录内容

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                // 忽略某些目录
                if (['node_modules', '.git', 'System Volume Information', '$RECYCLE.BIN'].includes(entry.name)) {
                    continue;
                }
                await findMusicFiles(fullPath, musicFiles);
            } else if (entry.isFile() && isMusicFile(fullPath)) {
                count++
                const fileName = path.basename(fullPath);
                const fileExtension = path.extname(fullPath);
                const MusicInfo =await getMusicMetadata(fullPath)
                const size= await fs.promises.stat(fullPath).then(stat => stat.size);
                musicFiles.push({
                    Url: fullPath,
                    Name: fileName,
                    Suffix: fileExtension,
                    Size: size,
                    Duration:MusicInfo.duration,
                    info:{
                        quality:MusicInfo.quality,
                        album:MusicInfo.album,
                        artist:MusicInfo.artist,
                        lyrics:MusicInfo.lyrics,
                        picture:MusicInfo.picture,
                        resolution:MusicInfo.resolution
            }
                });
            }
        }
    } catch (err:any) {
        // 忽略无权限或无法访问的目录
        console.warn(`无法访问目录：${dir}, 错误：${err.message}`);
    }
    return musicFiles;
};

/**
 * 查找整机的音乐文件
 */
const findAllMusicFiles = async (drives: string[] | undefined): Promise<FileInter[]> => {
    console.time('file')
    if (!drives || drives.length === 0) {
        console.error('未找到可用的驱动器。');
        return [];
    }
    let allMusicFiles: FileInter[] = [];

    await ensureFileExistsData(CACHE_DATA)//创建
    count=0
    for (const drive of drives) {
        console.log(`正在扫描: ${drive}`);
        const musicFiles:FileInter[] = await findMusicFiles(drive);
        musicFiles.forEach((file) => {
            allMusicFiles.push(file);
        })
    }
    console.timeEnd('file')
    // 使用 Set 去重，基于文件的 URL 和名称
    const uniqueFiles = new Set();
    return allMusicFiles.filter(item => {
        const key = `${item.Url}`;
        if (!uniqueFiles.has(key)) {
            uniqueFiles.add(key);
            return true;
        }
        return false;
    });
};

// 保存缓存到 JSON 文件
function saveCacheToFile(path:string,musicList:any) {
    try {
        fs.writeFileSync(path, JSON.stringify(musicList, null, 2), 'utf-8');
        console.log('缓存已保存到文件。');
    } catch (error) {
        console.error('保存缓存失败:', error);
    }
}
//创建目录
async function createDir(path:string) {
    if (!fs.existsSync(path)) {
        fs.mkdirSync(path);
    }
    const configPath = path + '/config.json';
    //创建config.json文件
    if(!fs.existsSync(configPath)){
        fs.writeFileSync(configPath, JSON.stringify({
            theme: "light",
            scanOnStartup: false,
            scanInterval: 10,
            port: 3000,
            autoPlay: false,
            defaultVolume: 80,
            rememberLastPlayed: false,
            scanPaths: [],
            showTray:true,
            minimization:true,
            isRole:false
        }), 'utf8');
    }
    // 创建fileCache.json文件
    const fileCachePath = path + '/fileCache.json';
    if(!fs.existsSync(fileCachePath)){
        fs.writeFileSync(fileCachePath, JSON.stringify(null), 'utf8');
    }
}

// 从 JSON 文件加载缓存
async function loadCacheFromFile(path:string,key:string) {
    if (!key) return null;
    try {
        if (fs.existsSync(path)) {
            const data = fs.readFileSync(path, 'utf-8');
            const results:FileInter[]=JSON.parse(data);
            if (!results||results.length<=0) return null;
            switch (key) {
                case 'all':
                    return results;
                case 'music':
                    return results.filter((item) => musicType.includes(item.Suffix));
                case 'video':
                    return results.filter((item) => videoType.includes(item.Suffix));
                default :
                    return null;
            }
        } else {
            console.log('缓存文件不存在，启动时将进行首次扫描。');
            return null;
        }
    } catch (error) {
        console.error('加载缓存失败:', error);
        return null;
    }
}
//获取音频元数据
async function getMusicMetadata(filePath: string) {
    const fileName=await getFileKey(filePath) as string
    let musicInfo:MusicInfo={
        quality:"未知",
        duration:0,
        artist:"未知",
        album:"未知",
        lyrics:[],
        picture:null,
        resolution:null
    };//音频信息
    try {
        let picture=null;//音频封面
        const metadata = await parseFile(filePath);
        const bitrateKbps = metadata.format.bitrate; // 转换为 kbps
        const sampleRate = metadata.format.sampleRate; // Hz
        let resolution:string|null=null;//视频分辨率
        if (metadata.common.picture && metadata.common.picture.length > 0) {
            const cover = metadata.common.picture[0]; // 取第一张封面
            if(cover.data){
                //@ts-ignore
                picture= await saveBase64Image(Buffer.from(cover.data, 'binary').toString('base64'),fileName)
            }
        }else {
            if (videoType.includes(path.extname(filePath))) {
                const data:any = await getVideoFrame(filePath,fileName)
                picture=data.url;
                if(data.quality.length>0){
                    resolution=data.quality
                }
            }
        }
        musicInfo={
            artist: metadata.common.artist,//歌手
            album: metadata.common.album,//专辑
            lyrics: metadata.common.lyrics, // 可能为 undefined
            quality: getAudioQuality(bitrateKbps?bitrateKbps/ 1000:0,sampleRate?sampleRate:0),
            duration: metadata.format.duration?metadata.format.duration:0, // 转换为 秒
            picture: picture,//封面图片
            resolution: resolution
        }
        return musicInfo;
    } catch (error) {
        console.error('获取元数据失败:', error);
        return musicInfo;
    }
}
//音质分析
function getAudioQuality(bitrateKbps: number,sampleRate:number) {
    let quality: string;
    try {
        switch (true) {
            case bitrateKbps >= 900 && sampleRate >= 44100:
                quality = '无损';
                break;
            case bitrateKbps >= 320 && sampleRate >= 44100:
                quality = '极高';
                break;
            case bitrateKbps >= 192 && sampleRate >= 44100:
                quality = '高';
                break;
            case bitrateKbps >= 128 && sampleRate >= 44100:
                quality = '标准';
                break;
            default:
                quality = '低';
                break;
        }
        return quality;
    } catch (error) {
        console.error('获取音频质量失败:', error);
        return '未知';
    }
}
//分辨率分析
function classifyResolution(width:number, height:number) {
    if (width >= 7680 && height >= 4320) {
        return '8K';
    } else if (width >= 3840 && height >= 2160) {
        return '4K';
    } else if (width >= 2560 && height >= 1440) {
        return '2K';
    } else if (width >= 1920 && height >= 1080) {
        return '1080P';
    } else if (width >= 1280 && height >= 720) {
        return '720P';
    } else {
        return '标清';
    }
}
//创建cache
async function ensureFileExists(filePath: string) {
    try {
        await fsOld.access(filePath);
    } catch (err:any) {
        if (err.code === 'ENOENT') {
            const dirPath = path.dirname(filePath);
            await fsOld.mkdir(dirPath, { recursive: true });
            await fsOld.writeFile(filePath, JSON.stringify({
                theme: "light",
                scanOnStartup: false,
                scanInterval: 10,
                port: 3000,
                autoPlay: false,
                defaultVolume: 80,
                rememberLastPlayed: false,
                scanPaths: [],
                showTray:true,
                minimization:true,
                isRole:false
            }), 'utf8');
        } else {
            throw err;
        }
    }
}
//创建cache/data文件夹
export async function ensureFileExistsData(filePath: string) {
    try {
        // 检查文件夹是否存在
        if (!fs.existsSync(filePath)) {
            // 如果文件夹不存在，则创建它
            fs.mkdirSync(filePath);
        } else {
            console.log('文件夹已存在！');
        }
    }catch (err:any) {
        throw err;
    }
}
//转存本地
async function saveBase64Image(base64Data:string|null,fileName:string,extension = 'jpg') {
    if (!base64Data) return null;
    if (fs.existsSync(`${CACHE_DATA}\\${fileName}.jpg`)) return `${CACHE_DATA}\\${fileName}.jpg`;
    try {
        // 去掉 Base64 前缀（如果有）
        const base64Content = base64Data.includes('base64,')
            ? base64Data.split(',')[1]
            : base64Data;

        // 解码 Base64 数据
        const buffer = Buffer.from(base64Content, 'base64');
        // 生成唯一文件名
        // const uniqueId = crypto.randomBytes(16).toString('hex'); // 生成 32 位的十六进制字符串
        const file = `${fileName}.${extension}`;
        const outputPath = path.join(CACHE_DATA,file);
        // 将二进制数据写入文件
        fs.writeFileSync(outputPath, buffer);
        return outputPath
    } catch (error) {
        console.error('保存图片失败:', error);
        return null
    }
}


// 获取配置文件的路径
async function getConfigData() {
    try {
        await createDir(CACHE_FILE)
        await ensureFileExists(SETTINGS_FILE_PATH);
        const data = await fsOld.readFile(SETTINGS_FILE_PATH, 'utf-8')
        const result=JSON.parse(data)
        configData= result?result:null
    } catch (error) {
        console.log(error)
        configData= null
    }

}
//保存设置给内存缓存
async function saveConfigData(data: any) {
    configData = data //更新缓存
    await fsOld.writeFile(SETTINGS_FILE_PATH, JSON.stringify(data, null, 2))
}
async function getVideoFrame(videoPath: string, fileName: string) {
    ffmpeg.setFfmpegPath(ffmpeg_path as string);
    let result = {
        url: path.join(CACHE_DATA, `${fileName}.jpg`), // 改用 JPEG 格式
        quality: ''
    };
    const data=await getCacheData(result.url)
    result.quality=data?.info?.resolution||'未知'
    if (fs.existsSync(result.url)) return result;

    return new Promise((resolve, reject) => {
        ffmpeg(videoPath)
            .inputOptions([
                '-hwaccel auto',    // 硬件加速解码
                '-ss 00:00:00.000'  // 快速定位到起始位置
            ])
            .outputOptions([
                '-frames:v 1',      // 只捕获1帧
                '-q:v 2',           // JPEG质量参数（2-31，值越小质量越高）
                '-threads 4',       // 启用多线程
                '-vf', 'format=yuvj420p' // 加快JPEG编码速度
            ])
            .output(result.url)
            .on('stderr', (line) => {
                const match = line.match(/(\d{2,5})x(\d{2,5})/);
                if (match) {
                    result.quality = classifyResolution(
                        parseInt(match[1], 10),
                        parseInt(match[2], 10)
                    );
                }
            })
            .on('end', () => resolve(result))
            .on('error', reject)
            .run();
    });
}
//获取文件唯一key
async function getFileKey(filePath:string) {
    //全面解析数据生成唯一key
    // return new Promise((resolve, reject) => {
    //     const hash = crypto.createHash('sha256');
    //     const stream = fs.createReadStream(filePath);
    //
    //     stream.on('data', (chunk) => hash.update(chunk));
    //     stream.on('end', () => resolve(hash.digest('hex')));
    //     stream.on('error', (err) => reject(err));
    // });
    // 取文件头、1/2处、3/4处、尾部的 4KB 数据
    const hash = crypto.createHash('sha256');
    const fd = await fs.promises.open(filePath, 'r');
    const { size } = await fd.stat();

    // 取文件头、1/2处、3/4处、尾部的 4KB 数据
    const chunks = [0, Math.floor(size/2), Math.floor(size*0.75), size - 4096]
        .map(pos => ({ position: pos < 0 ? 0 : pos, length: 4096 }));

    for (const { position, length } of chunks) {
        const buffer = Buffer.alloc(length);
        await fd.read(buffer, 0, length, position);
        hash.update(buffer);
    }
    await fd.close();
    return hash.digest('hex');
}

//清理缓存
async function cleanCache() {
    console.time("清理缓存")
    try{
        const dataPath= path.join(CACHE_FILE,'data')
        const fileData= await loadCacheFromFile(CACHE_FILE_PATH,'all')
        const pngName:string[]=[]
        let data:string[]=[];
        let size:number=0;
        let promises:any=[]
        //扫描所有的png
        const files = fs.readdirSync(dataPath);
        for (const file of files) {
            if (file.endsWith('.jpg')) {
                const filePath = path.join(dataPath, file);
                data.push(filePath)
            }
        }
        fileData?.forEach( (item)=>{
            if(item.info?.picture) {
                pngName.push(item.info.picture)
            }
        })
        data.forEach((item)=>{
            if (!pngName) return;
            if(!pngName.includes(item)){
                let promise = fs.promises.stat(item).then(stat => {
                    size += stat.size / 1024;
                });
                promises.push(promise);
                fs.unlinkSync(item)
            }
        })
        Promise.all(promises).then(() => {
            console.log(`清理缓存成功,清理${parseInt(String(size))}kb`)
            console.timeEnd("清理缓存")
        });
    }catch (err:any){
        throw err;
    }
}
async function getCacheData(url: string) {
    const fileData = await loadCacheFromFile(CACHE_FILE_PATH, 'video')
    return fileData?.find((item) => item.info?.picture === url)
}
export { findAllMusicFiles, saveCacheToFile,loadCacheFromFile, createDir,getConfigData,configData,cleanCache,saveConfigData }

import * as fs from 'fs';
import * as path from 'path';
import { ClassifyType, FileInter, MusicInfo } from "../../../src/api/medium/type.ts";
import { parseFile } from 'music-metadata';
import { configType } from "../../type/config.ts";
import { ffmpeg_path, CACHE_FILE } from "../../main.ts";
import ffmpeg from 'fluent-ffmpeg';
import crypto from 'crypto';
import md5 from "md5";
import { imageManager } from '../image';
import { databaseService } from '../database';

// 定义音乐文件的扩展名
export const musicType = ['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.wma', '.ape', '.aiff', '.aif', '.aifc', '.mka', '.wv', '.opus', '.mka', '.m4b', '.m4p', '.m4r', '.m4v', '.mpc', '.mp+', '.mpp', '.mp+'];
export const videoType = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.rmvb', '.rm', '.mpg', '.mpeg', '.mpe', '.mpv', '.m2v', '.mts', '.m2ts', '.ts', '.vob', '.ogv', '.3gp', '.3g2', '.webm', '.ogm', '.divx', '.xvid'];
const mediaType = [...musicType, ...videoType];

const defineSettings = {
    theme: "light",
    scanOnStartup: false,
    scanInterval: 10,
    port: 3000,
    autoPlay: false,
    defaultVolume: 80,
    rememberLastPlayed: false,
    scanPaths: [],
    showTray: true,
    minimization: true,
    isRole: false
};

const defineMusicInfo = {
    quality: "未知",
    duration: 0,
    artist: "未知",
    album: "未知",
    lyrics: [],
    picture: null,
    resolution: null
};

const ignoreDirs = ['node_modules', '.git', 'System Volume Information', '$RECYCLE.BIN', 'dist'];

/**
 * 判断文件是否为媒体文件
 */
const isMediaFile = (filePath: string): boolean => {
    return mediaType.includes(path.extname(filePath).toLowerCase());
};

let configData: configType | null = null;
let count = 0;

/**
 * 递归查找目录下的媒体文件
 */
const findMediaFiles = async (dir: string, mediaFiles: FileInter[] = []): Promise<FileInter[]> => {
    try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (ignoreDirs.includes(entry.name)) {
                    continue;
                }
                await findMediaFiles(fullPath, mediaFiles);
            } else if (entry.isFile() && isMediaFile(fullPath)) {
                count++;
                const fileName = path.basename(fullPath);
                const fileExtension = path.extname(fullPath);
                const mediaInfo = await getMediaMetadata(fullPath);
                const size = await fs.promises.stat(fullPath).then(stat => stat.size);
                const classify: ClassifyType = await getMediaClassify(fullPath, mediaInfo.picture as string);
                mediaFiles.push({
                    Url: fullPath,
                    Name: fileName,
                    Suffix: fileExtension,
                    Size: size,
                    info: mediaInfo,
                    classify: classify
                });
            }
        }
    } catch (err: any) {
        console.warn(`无法访问目录：${dir}, 错误：${err.message}`);
    }
    return mediaFiles;
};

/**
 * 查找所有媒体文件
 */
const findAllMediaFiles = async (drives: string[] | undefined): Promise<FileInter[]> => {
    console.time('file');
    if (!drives || drives.length === 0) {
        console.error('未找到可用的驱动器。');
        return [];
    }

    // imageManager 会自动管理图片缓存目录
    count = 0;
    let allMediaFiles: FileInter[] = [];

    for (const drive of drives) {
        console.log(`正在扫描: ${drive}`);
        const mediaFiles: FileInter[] = await findMediaFiles(drive);
        mediaFiles.forEach((file) => {
            allMediaFiles.push(file);
        });
    }

    console.timeEnd('file');

    // 使用 Set 去重，基于文件的 URL
    const uniqueFiles = new Set();
    return allMediaFiles.filter(item => {
        const key = `${item.Url}`;
        if (!uniqueFiles.has(key)) {
            uniqueFiles.add(key);
            return true;
        }
        return false;
    });
};

/**
 * 保存媒体文件到数据库（批量）
 */
async function saveMediaFilesToDatabase(files: FileInter[]): Promise<{ success: number; failed: number }> {
    try {
        const result = await databaseService.addMediaFiles(files);
        console.log(`保存到数据库: 成功 ${result.success} 条, 失败 ${result.failed} 条`);
        return { success: result.success, failed: result.failed };
    } catch (error) {
        console.error('保存到数据库失败:', error);
        return { success: 0, failed: files.length };
    }
}

/**
 * 从数据库加载媒体文件
 */
async function loadMediaFilesFromDatabase(key: string): Promise<FileInter[] | null> {
    try {
        let files: FileInter[] = [];

        switch (key) {
            case 'all':
                files = await databaseService.getMediaFiles();
                break;
            case 'music':
                files = await databaseService.getMediaFilesByType('music');
                break;
            case 'video':
                files = await databaseService.getMediaFilesByType('video');
                break;
            default:
                return null;
        }

        // 转换图片路径为可访问的 URL
        files = files.map(file => {
            if (file.info?.picture) {
                const pictureUrl = convertPictureUrl(file.info.picture);
                if (pictureUrl) {
                    file.info.picture = pictureUrl;
                }
            }
            return file;
        });

        return files;
    } catch (error) {
        console.error('从数据库加载失败:', error);
        return null;
    }
}

/**
 * 转换图片路径为可访问的 URL
 * @param picturePath 数据库中存储的图片路径 (images/xxx.jpg)
 * @returns 可访问的 URL
 */
function convertPictureUrl(picturePath: string): string | null {
    if (!picturePath) return null;

    try {
        // 从 ImageManager 获取图片信息
        const imageInfo = imageManager.getImageInfo(picturePath);

        if (imageInfo && imageInfo.cachedPath) {
            // 转换为 file:// 协议 URL
            // Windows: D:\path\to\file.jpg -> file:///D:/path/to/file.jpg
            // Unix: /path/to/file.jpg -> file:///path/to/file.jpg
            const fileUrl = picturePath.startsWith('/')
                ? `file://${picturePath}`
                : `file:///${imageInfo.cachedPath.replace(/\\/g, '/')}`;

            return fileUrl;
        }

        // 如果 ImageManager 中找不到，尝试使用 HTTP URL
        // 这需要服务器已启动
        if (configData && configData.port) {
            const filename = picturePath.split('/').pop();
            return `http://127.0.0.1:${configData.port}/img/${filename}`;
        }

        return null;
    } catch (error) {
        console.error('转换图片路径失败:', error);
        return null;
    }
}

/**
 * 保存媒体分类到数据库
 */
async function saveMediaClassifyToDatabase(classify: ClassifyType, picture: string | null): Promise<void> {
    try {
        if (picture && picture.length > 0) {
            classify.picture = picture;
        }
        await databaseService.addMediaCategory(classify);
    } catch (error) {
        console.error('保存分类到数据库失败:', error);
    }
}

/**
 * 清理未使用的媒体分类
 */
async function cleanClassify(): Promise<void> {
    try {
        const count = await databaseService.cleanupUnusedCategories();
        console.log(`清理媒体分类完成，删除了 ${count} 条未使用的分类`);
    } catch (error) {
        console.error('清理媒体分类失败:', error);
    }
}

/**
 * 获取媒体分类
 */
async function getMediaClassify(filePath: string, picture: string): Promise<ClassifyType> {
    // 使用 path.dirname 获取父目录，然后提取目录名
    const parentDir = path.dirname(filePath);
    const prepose = path.basename(parentDir);

    const creationTime = await fs.promises.stat(filePath).then(stat => stat.birthtimeMs);
    const creationTimeData = new Date(creationTime);

    const classify: ClassifyType = {
        year: String(creationTimeData.getFullYear()),
        month: String(creationTimeData.getMonth() + 1).padStart(2, '0'),
        day: String(creationTimeData.getDate()).padStart(2, '0'),
        prepose: prepose || 'unknown' // 确保有默认值
    };

    // 保存到数据库
    await saveMediaClassifyToDatabase(classify, picture);

    return classify;
}

/**
 * 获取音频元数据
 */
async function getMediaMetadata(filePath: string): Promise<MusicInfo> {
    const fileName = await getFileKey(filePath) as string;
    let mediaInfo: MusicInfo = { ...defineMusicInfo };

    try {
        let picture = null;
        const metadata = await parseFile(filePath);
        const bitrateKbps = metadata.format.bitrate;
        const sampleRate = metadata.format.sampleRate;
        let resolution: string | null = null;

        if (metadata.common.picture && metadata.common.picture.length > 0) {
            const cover = metadata.common.picture[0];
            if (cover.data) {
                picture = await saveBase64Image(Buffer.from(cover.data, 'binary').toString('base64'), fileName);
            }
        } else {
            if (videoType.includes(path.extname(filePath))) {
                const data: any = await getVideoFrame(filePath, fileName);
                picture = data.url;
                if (data.quality && data.quality.length > 0) {
                    resolution = data.quality;
                }
            }
        }

        mediaInfo = {
            artist: metadata.common.artist || '未知',
            album: metadata.common.album || '未知',
            lyrics: metadata.common.lyrics,
            quality: getAudioQuality(bitrateKbps ? bitrateKbps / 1000 : 0, sampleRate ? sampleRate : 0),
            duration: metadata.format.duration ? metadata.format.duration : 0,
            picture: picture,
            resolution: resolution
        };

        return mediaInfo;
    } catch (error) {
        console.error('获取元数据失败:', error);
        return mediaInfo;
    }
}

/**
 * 音质分析
 */
function getAudioQuality(bitrateKbps: number, sampleRate: number): string {
    try {
        switch (true) {
            case bitrateKbps >= 900 && sampleRate >= 44100:
                return '无损';
            case bitrateKbps >= 320 && sampleRate >= 44100:
                return '极高';
            case bitrateKbps >= 192 && sampleRate >= 44100:
                return '高';
            case bitrateKbps >= 128 && sampleRate >= 44100:
                return '标准';
            default:
                return '低';
        }
    } catch (error) {
        return '未知';
    }
}

/**
 * 分辨率分析
 */
function classifyResolution(width: number, height: number): string {
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

/**
 * 创建 cache/data 文件夹
 */
export async function ensureFileExistsData(filePath: string): Promise<void> {
    try {
        if (!fs.existsSync(filePath)) {
            fs.mkdirSync(filePath, { recursive: true });
            console.log(`创建文件夹: ${filePath}`);
        }
    } catch (err: any) {
        console.error('创建文件夹失败:', err);
        throw err;
    }
}

/**
 * 创建文件夹（别名函数）
 */
export async function createDir(filePath: string): Promise<void> {
    return ensureFileExistsData(filePath);
}

/**
 * 转存本地图片
 * 图片现在由 imageManager 管理，存储在 CACHE_FILE/images 目录
 */
async function saveBase64Image(base64Data: string | null, fileName: string, extension = 'jpg'): Promise<string | null> {
    if (!base64Data) return null;

    try {
        // 使用 ImageManager 保存图片（返回相对路径）
        const relativePath = await imageManager.saveBase64Image(base64Data, fileName);
        return relativePath;
    } catch (error) {
        console.error('保存图片失败:', error);
        return null;
    }
}

/**
 * 获取配置数据（从数据库）
 */
async function getConfigData(): Promise<void> {
    try {
        const port = await databaseService.getSetting('port');
        const scanPaths = await databaseService.getSetting('scanPaths');
        const theme = await databaseService.getSetting('theme');
        const showTray = await databaseService.getSetting('showTray');
        const autoPlay = await databaseService.getSetting('autoPlay');
        const defaultVolume = await databaseService.getSetting('defaultVolume');
        const scanOnStartup = await databaseService.getSetting('scanOnStartup');
        const scanInterval = await databaseService.getSetting('scanInterval');
        const minimization = await databaseService.getSetting('minimization');
        const isRole = await databaseService.getSetting('isRole');
        const rememberLastPlayed = await databaseService.getSetting('rememberLastPlayed');

        // 兼容处理：如果 scanPaths 是字符串（历史数据），尝试解析
        let processedScanPaths = scanPaths;
        if (typeof scanPaths === 'string') {
            try {
                processedScanPaths = JSON.parse(scanPaths);
                // 如果解析成功，自动修复数据库中的数据
                await databaseService.setSetting('scanPaths', processedScanPaths);
                console.log('[Config] 已修复 scanPaths 数据格式');
            } catch {
                processedScanPaths = [];
            }
        }

        configData = {
            port: port ?? 3000,
            scanPaths: processedScanPaths ?? [],
            theme: theme ?? 'light',
            showTray: showTray ?? true,
            autoPlay: autoPlay ?? false,
            defaultVolume: defaultVolume ?? 80,
            scanOnStartup: scanOnStartup ?? false,
            scanInterval: scanInterval ?? 10,
            minimization: minimization ?? true,
            isRole: isRole ?? false,
            rememberLastPlayed: rememberLastPlayed ?? false
        } as configType;

        console.log('[Config] 从数据库加载配置成功:');
    } catch (error) {
        console.log('读取配置失败，使用默认配置');
        configData = defineSettings as configType;
    }
}

/**
 * 保存设置到数据库
 */
async function saveConfigData(data: configType): Promise<{ success: boolean }> {
    configData = data;

    try {
        const settingsToSave: Record<string, any> = {
            port: data.port,
            scanPaths: data.scanPaths,  // 直接传数组，不要 JSON.stringify
            theme: data.theme,
            showTray: data.showTray,
            autoPlay: data.autoPlay,
            defaultVolume: data.defaultVolume,
            scanOnStartup: data.scanOnStartup,
            scanInterval: data.scanInterval,
            minimization: data.minimization,
            isRole: data.isRole,
            rememberLastPlayed: data.rememberLastPlayed
        };

        // 只有当 password 字段存在且不为空时才保存
        if (data.password !== undefined && data.password !== "") {
            settingsToSave.password = data.password;
            console.log('[Config] 密码已更新');
        }

        await databaseService.setMultipleSettings(settingsToSave);
        console.log('[Config] 配置已保存到数据库');
        return { success: true };
    } catch (error) {
        console.error('保存配置失败:', error);
        return { success: false };
    }
}

/**
 * 获取视频帧（缩略图）
 * 视频缩略图现在由 imageManager 管理
 */
async function getVideoFrame(videoPath: string, fileName: string): Promise<{ url: string; quality: string }> {
    ffmpeg.setFfmpegPath(ffmpeg_path as string);

    // 检查 imageManager 中是否已有缓存的图片
    const existingImage = imageManager.getImageInfo(fileName);
    if (existingImage && fs.existsSync(existingImage.cachedPath)) {
        const fileData = await loadMediaFilesFromDatabase('video');
        return {
            url: existingImage.relativePath,
            quality: fileData?.find(item => item.info?.picture === existingImage.relativePath)?.info?.resolution || '未知'
        };
    }

    // 创建临时文件路径用于提取视频帧
    const tempDir = path.join(CACHE_FILE, 'temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    const tempPath = path.join(tempDir, `${fileName}.jpg`);

    const result = {
        url: '',
        quality: ''
    };

    return new Promise((resolve, reject) => {
        ffmpeg(videoPath)
            .inputOptions([
                '-hwaccel auto',
                '-ss 00:00:00.000'
            ])
            .outputOptions([
                '-frames:v 1',
                '-q:v 2',
                '-threads 4',
                '-vf', 'format=yuvj420p'
            ])
            .output(tempPath)
            .on('stderr', (line) => {
                const match = line.match(/(\\d{2,5})x(\\d{2,5})/);
                if (match) {
                    result.quality = classifyResolution(
                        parseInt(match[1], 10),
                        parseInt(match[2], 10)
                    );
                }
            })
            .on('end', async () => {
                // 将提取的帧保存到 imageManager
                try {
                    const imageBuffer = fs.readFileSync(tempPath);
                    const base64Data = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
                    const relativePath = await imageManager.saveBase64Image(base64Data, fileName);
                    if (relativePath) {
                        result.url = relativePath;
                    } else {
                        result.url = tempPath; // 回退到临时路径
                    }
                } catch (err) {
                    console.error('保存视频帧失败:', err);
                    result.url = tempPath; // 回退到临时路径
                }
                // 清理临时文件
                try {
                    fs.unlinkSync(tempPath);
                } catch (e) {
                    // 忽略清理错误
                }
                resolve(result);
            })
            .on('error', reject)
            .run();
    });
}

/**
 * 获取文件唯一key
 */
async function getFileKey(filePath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    const fd = await fs.promises.open(filePath, 'r');
    const { size } = await fd.stat();

    const chunks = [0, Math.floor(size / 2), Math.floor(size * 0.75), size - 4096]
        .map(pos => ({ position: pos < 0 ? 0 : pos, length: 4096 }));

    for (const { position, length } of chunks) {
        const buffer = Buffer.alloc(length);
        await fd.read(buffer, 0, length, position);
        hash.update(buffer);
    }
    await fd.close();
    return hash.digest('hex');
}

/**
 * 清理缓存（清理未使用的图片）
 */
async function cleanCache(): Promise<void> {
    console.time("清理缓存");
    try {
        // 使用 imageManager 清理缓存
        await imageManager.checkAndCleanCache();

        // 清理未使用的数据库记录
        await databaseService.cleanupInvalidFiles();
        await cleanClassify();

        console.log('清理缓存成功');
        console.timeEnd("清理缓存");
    } catch (err: any) {
        console.error('清理缓存失败:', err);
        throw err;
    }
}

/**
 * 获取配置数据并更新
 */
async function getConfigDataWithUpdate(): Promise<configType | null> {
    await getConfigData();
    return configData;
}

// 导出函数
export {
    findAllMediaFiles,
    saveMediaFilesToDatabase as saveCacheToFile,
    loadMediaFilesFromDatabase as loadCacheFromFile,
    getConfigData,
    configData,
    cleanCache,
    saveConfigData,
    cleanClassify,
    getConfigDataWithUpdate
};

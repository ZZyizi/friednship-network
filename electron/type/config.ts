export interface configType{
    scanPaths?:string[],// 扫描路径
    port?:number,// 端口
    defaultVolume?:number,// 默认音量
    rememberLastPlayed?:boolean,// 记住上次播放
    autoPlay?:boolean,// 自动播放
    scanOnStartup?:boolean,// 开机自启
    scanInterval?:number,// 扫描间隔
    theme?:string,// 主题
    minimization?: boolean,//最小化
    showTray?: boolean// 显示托盘
    isRole?:boolean//是否需要验证密码
    password?:string//密码
}

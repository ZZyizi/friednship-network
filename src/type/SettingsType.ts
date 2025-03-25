// 1. 定义 Settings 接口，确保 TypeScript 类型检查
export interface Settings {
    port: number;
    theme: "light" | "dark" | "auto"; // 主题只能是 'light' 或 'dark' 或 ‘auto’
    scanOnStartup: boolean;
    scanInterval: number;
    autoPlay: boolean;
    defaultVolume: number;
    rememberLastPlayed: boolean;
    scanPaths: string[]; // 扫描路径列表
    showTray:boolean;
    minimization:boolean;
}
export interface MenuItem {
    title: string;
    icon: any;
    index: string;
    isElectron: boolean;
    child?: FormItem[]|[];
}
// 3. 定义表单配置项，确保类型安全
export interface FormItem {
    key: keyof Settings;
    label: string;
    component: any;
    props?: Record<string, any>;
    options?: any[];
}

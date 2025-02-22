import {onMounted, ref,watch} from "vue";

export function useTheme() {
    const isElectron:boolean= navigator.userAgent.includes("Electron")
    const {ipcRenderer,config} = window
    let isDarkModeAuto = ref(false);
    if (isElectron){
        ipcRenderer.on('theme-changed', (_event, isDarkMode) => {
            isDarkModeAuto.value = isDarkMode
        })
    }
    const settings = {
        theme: 'light'
    }
    const data = localStorage.getItem("settings") && JSON.parse(localStorage.getItem("settings") as string) || settings
    // 合并默认设置和保存的设置
    Object.assign(settings, {
        ...data
    })

    watch(isDarkModeAuto, () => {
        if (settings.theme === 'auto') {
            setTheme('auto')
        }
    })
    const setTheme = (newTheme: 'light' | 'dark' | 'auto') => {
        settings.theme = newTheme
        if (newTheme === 'auto') {
            newTheme = isDarkModeAuto.value ? 'dark' : 'light';
        }
        document.documentElement.classList.toggle('dark', newTheme === 'dark');
        localStorage.setItem('settings', JSON.stringify(settings));
    };

    onMounted(async () => {
        if (settings.theme === 'auto') {
            isDarkModeAuto.value = await config.theme()
            setTheme(settings.theme)
        }
        setTheme(settings.theme as 'light' | 'dark' | 'auto');
    });

    return {setTheme};
}

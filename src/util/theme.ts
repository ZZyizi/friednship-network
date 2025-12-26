import {onMounted, ref,watch} from "vue";

export function useTheme() {
    const isElectron:boolean= navigator.userAgent.includes("Electron")
    let isDarkModeAuto = ref(false);

    if (isElectron && window.ipcRenderer) {
        window.ipcRenderer.on('theme-changed', (_event, isDarkMode) => {
            isDarkModeAuto.value = isDarkMode
        })
    }

    const settings = {
        theme: 'light'
    }

    // 安全地解析 localStorage
    const storedSettings = localStorage.getItem("settings")
    if (storedSettings) {
        try {
            const data = JSON.parse(storedSettings)
            Object.assign(settings, data)
        } catch (error) {
            console.warn('[Theme] localStorage 设置数据无效，使用默认值')
        }
    }

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

        // 更新 localStorage
        const currentSettings = localStorage.getItem("settings")
        const settingsToSave = currentSettings ? JSON.parse(currentSettings) : {}
        settingsToSave.theme = settings.theme
        localStorage.setItem('settings', JSON.stringify(settingsToSave))
    };

    onMounted(async () => {
        if (settings.theme === 'auto' && isElectron && window.config) {
            isDarkModeAuto.value = await window.config.theme()
            setTheme(settings.theme)
        } else {
            setTheme(settings.theme as 'light' | 'dark' | 'auto')
        }
    });

    return {setTheme};
}


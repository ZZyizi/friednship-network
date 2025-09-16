import { createPinia } from 'pinia'
import { useSettings } from './modules/settings'
import { useNetwork } from  './modules/network'
import { useMedia } from "./modules/media";
import { useSwitch } from "./modules/switch";

export default createPinia()
export { useSettings, useNetwork,useMedia,useSwitch }

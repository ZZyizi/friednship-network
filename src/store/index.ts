import { createPinia } from 'pinia'
import { useSettings } from './modules/settings'
import { useNetwork } from  './modules/network'
import { useMedia } from "./modules/media";

export default createPinia()
export { useSettings, useNetwork,useMedia }

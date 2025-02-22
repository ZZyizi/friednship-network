import { createPinia } from 'pinia'
import { useSettings } from './modules/settings'
import { useNetwork } from  './modules/network'
export default createPinia()
export { useSettings, useNetwork }

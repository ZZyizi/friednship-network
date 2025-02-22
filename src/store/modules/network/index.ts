import { defineStore } from 'pinia';
import {reactive} from "vue";
import {shareDataType, shareMenuType} from "../../../type/ShereType.ts";

export const useNetwork = defineStore("useNetwork", {
    state: () => {
        let shareMenu=reactive<shareMenuType[]>([
            {
                label:"全部媒体",
                key:"all",
                router:"/home?key=all",
                local:true,
                mac:'local'
            },
            {
                label:"音乐",
                key:"music",
                router:"/home?key=music",
                local:true,
                mac:'local'
            },
            {
                label:"视频",
                key:"video",
                router:"/home?key=video",
                local:true,
                mac:'local'
            }
        ])
        return({
            shareMenu
        })
    },
    actions: {
        addShareMenu(item:shareDataType){
            if (!item) return;
            //检查相同
            // 查找是否有相同 mac 的项
            const index = this.shareMenu.findIndex(menuItem => menuItem.mac === item.mac);

            // 如果找到了相同的 mac，则更新该项，否则添加新项
            if (index !== -1) {
                this.shareMenu[index] = {
                    label: item.name&&item.name!=''?item.name+"(外部设备)":item.label+"(外部设备)",
                    key: 'all',
                    router: `/home?key=all`,
                    ip: item.ip,
                    port: item.port,
                    local:false,
                    mac:item.mac
                }; // 更新项
            } else {
                this.shareMenu.push({
                    label: item.name&&item.name!=''?item.name+"(外部设备)":item.label+"(外部设备)",
                    key: 'all',
                    router: `/home?key=all`,
                    ip: item.ip,
                    port: item.port,
                    local:false,
                    mac:item.mac
                });
            }
            console.log(this.shareMenu)
        }
    },
});

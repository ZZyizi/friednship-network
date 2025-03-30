import { defineStore } from 'pinia';
import { reactive,ref } from "vue";
import {FileInter} from "../../../api/medium/type.ts";

export const useMedia = defineStore("useMedia", {
    state: () => {
        let MediaData=reactive<FileInter[]>([])
        let index=ref(0)
        return({
            MediaData,index
        })
    },
    actions: {
        setMediaData(data:FileInter[]){
            this.MediaData=data
        }
    },
});

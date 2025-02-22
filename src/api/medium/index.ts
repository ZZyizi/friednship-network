import server from "../index.ts";

enum API{
    FILE_DATA_URL = "/file",
    GET_FILE='/file/get',
    LINK='/link',
    IMG='/img'
}
export const reqFileData= (key:string)=>server.get<any>(API.FILE_DATA_URL+`?key=${key}`)
// export const reqGetFile= (path:string)=>server.get<any>(API.GET_FILE.replace(':path',path))
export const reqGetFile= (path:string)=>server.get<any>(API.GET_FILE+`?path=${path}`)
export function FileUrl(ip:string,name:string,path:string){
    return `http://${ip}:${localStorage.getItem('port')}${API.GET_FILE}/${name}?path=${path} `
}
export function getImg(ip:string,name:string){
    return `http://${ip}:${localStorage.getItem('port')}${API.IMG}/${name}`
}
export const reqLink= ()=>server.get<any>(API.LINK)
export const reqShare= (Ip:string,port:string,path:string)=>server.get<any>(`http://${Ip}:${port}`+API.FILE_DATA_URL+`?key=${path}`)


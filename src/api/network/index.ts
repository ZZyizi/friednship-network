import server from "../index.ts";

enum API{
    linkTest = "/link",
}
export const linkTest= (Ip:string,port:number)=>server.get<any>(`http://${Ip}:${port}`+API.linkTest)

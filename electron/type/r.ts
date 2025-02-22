export interface RType {
    state:number,
    data?:any,
    err?:any,
    msg:string
}
export interface ResType {
    success:RType,
    error:RType,
    waring:RType
}

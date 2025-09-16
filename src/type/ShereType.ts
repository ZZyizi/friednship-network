export interface shareMenuType{
    label: string;
    key: string;
    router: string;
    ip?:string;
    port?:number;
    local:boolean;
    mac?:string;
    pass?:string;
}
export interface shareDataType{
    label: string;
    ip: string;
    name:string;
    port:number;
    status:boolean;
    mac?:string;
    pass?:string;
}

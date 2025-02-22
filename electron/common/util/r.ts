//返回值
export const R={
    success:function (message:string,data?:any) {
        return {state: 1, msg: message,data:data||null}
    },
    error:function (message:string,data?:any) {
        return {state: 0, msg: message,err:data||null}
    },
    warning:function (message:string,data?:any) {
        return {state: -1, msg: message,err:data||null}
    }
}

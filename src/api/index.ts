import axios from 'axios';
//创建axios对象
export const service=axios.create({
    baseURL:`http://${window.location.hostname}:${window.location.port}`,
    // timeout:import.meta.env.VITE_APP_API_TIMEOUT,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json; charset=utf-8'
    }
})
//请求拦截器
service.interceptors.request.use(config=>{
    // let token:string|null =localStorage.getItem("token");
    // if (token){
    //     config.headers['token']=token;
    //     // service.defaults.headers.get['Authorization'] ='Bearer '+token;
    //     // service.defaults.headers.post['Authorization'] ='Bearer '+token;
    //     // service.defaults.headers.put['Authorization'] ='Bearer '+token;
    //     // service.defaults.headers.delete['Authorization'] ='Bearer '+token;
    // }
    return config;
},error => {
    Promise.reject(error).then(r => {console.log(r)})
})
//配置响应式拦截器
service.interceptors.response.use((response)=>{
        const code:number= response.status;
        switch (code) {
            case 200:
                return response.data;
            case 206:
                return response.data;
            default:break;
        }
    },(err)=>{
        const code:number = err.request.status;
        let message:string=""
        switch (code) {
            case 401:
                message="未授权，请重新登录"
                break;
            case 500:
                message="服务器错误"
                break;
            case 404:
                message="请求资源不存在"
                break;
            default:
                message="请求失败"
                break;
        }
        console.log(message)
        return Promise.reject(err)
    }
)
service.defaults.withCredentials = true;
export default service

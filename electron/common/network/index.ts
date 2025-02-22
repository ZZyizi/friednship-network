import localDevices from "local-devices"

// 自动扫描局域网设备
async function getLocalDevices() {
    return await localDevices()
}




export { getLocalDevices }

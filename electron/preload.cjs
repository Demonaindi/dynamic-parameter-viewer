const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('logueador', {
  platform: process.platform,
})

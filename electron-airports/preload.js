const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('airportApi', {
  searchOptions: (query) => ipcRenderer.invoke('airports:searchOptions', query),
  getDetails: (code) => ipcRenderer.invoke('airports:getDetails', code),
  getDistance: (fromCode, toCode) => ipcRenderer.invoke('airports:getDistance', fromCode, toCode),
  getRetrievedAirports: () => ipcRenderer.invoke('airports:getRetrievedAirports'),
  crawlAllAirports: () => ipcRenderer.invoke('airports:crawlAll'),
  cacheStatus: () => ipcRenderer.invoke('airports:cacheStatus'),
});

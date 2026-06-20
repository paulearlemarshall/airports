function registerAirportIpcHandlers({ ipcMain, store, client }) {
  ipcMain.handle('airports:searchOptions', async (_event, query) => {
    return store.searchAirportOptions(query);
  });

  ipcMain.handle('airports:getDetails', async (_event, code) => {
    return client.getAirportDetails(code);
  });

  ipcMain.handle('airports:getRetrievedAirports', async () => {
    return store.getRetrievedAirports();
  });

  ipcMain.handle('airports:crawlAll', async () => {
    return store.crawlAllAirports();
  });

  ipcMain.handle('airports:cacheStatus', async () => {
    return store.cacheMeta();
  });

  ipcMain.handle('airports:getDistance', async (_event, fromCode, toCode) => {
    return client.getDistance(fromCode, toCode);
  });
}

module.exports = {
  registerAirportIpcHandlers,
};

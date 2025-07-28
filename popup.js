document.addEventListener('DOMContentLoaded', () => {
  const whitelistTextarea = document.getElementById('whitelist');
  const saveButton = document.getElementById('save');
  const statusDiv = document.getElementById('status');

  // 1. 載入時，從 storage 讀取已儲存的設定並顯示
  chrome.storage.sync.get(['whitelist'], (result) => {
    if (result.whitelist) {
      whitelistTextarea.value = result.whitelist.join('\n');
    }
  });

  // 2. 點擊儲存按鈕時的動作
  saveButton.addEventListener('click', () => {
    // 從 textarea 取得文字，並整理成陣列 (去除空行)
    const whitelistArray = whitelistTextarea.value.split('\n').filter(item => item.trim() !== '');
    
    // 存入 chrome.storage.sync
    chrome.storage.sync.set({ whitelist: whitelistArray }, () => {
      statusDiv.textContent = '設定已儲存！';
      // 1.5 秒後清除提示訊息
      setTimeout(() => {
        statusDiv.textContent = '';
      }, 1500);
    });
  });
});
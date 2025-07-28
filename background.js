// 監聽快捷鍵
chrome.commands.onCommand.addListener((command) => {
    if (command === "toggle-hide-tabs") {
      toggleTabsWithNewWindow();
    }
  });
  
  // 主要的功能函數
  async function toggleTabsWithNewWindow() {
    // 1. 檢查 Session Storage，看是否已經有一個「儲存視窗」存在了
    const { storageWindowId } = await chrome.storage.session.get('storageWindowId');
  
    if (storageWindowId) {
      // --- 恢復模式 ---
      // 如果存在 storageWindowId，表示現在是隱藏模式，我們要恢復分頁
      try {
        // 獲取當前使用者正在看的視窗
        const currentWindow = await chrome.windows.getCurrent();
        // 獲取「儲存視窗」中的所有分頁
        const tabsToMove = await chrome.tabs.query({ windowId: storageWindowId });
        const tabIdsToMove = tabsToMove.map(tab => tab.id);
  
        if (tabIdsToMove.length > 0) {
          // 將這些分頁移回到當前視窗
          await chrome.tabs.move(tabIdsToMove, { windowId: currentWindow.id, index: -1 });
        }
  
        // 關閉已經變空的「儲存視窗」
        await chrome.windows.remove(storageWindowId);
        console.log("分頁已恢復。");
  
      } catch (error) {
        // 如果「儲存視窗」被使用者手動關閉了，這裡會報錯。
        // 我們捕獲錯誤，以防擴充功能出問題。
        console.log("儲存視窗找不到了，可能已被手動關閉。", error);
      } finally {
        // 無論成功或失敗，都要清除 session 中的紀錄
        await chrome.storage.session.remove('storageWindowId');
      }
  
    } else {
      // --- 隱藏模式 ---
      // 如果不存在 storageWindowId，表示我們要開始隱藏分頁
      const { whitelist = [] } = await chrome.storage.sync.get('whitelist');
      const allTabsInCurrentWindow = await chrome.tabs.query({ currentWindow: true });
  
      const tabsToHide = [];
      for (const tab of allTabsInCurrentWindow) {
        // 條件：不是固定的、不是白名單的、有有效網址的
        const isWhitelisted = whitelist.some(item => tab.url && tab.url.includes(item));
        if (!tab.pinned && !isWhitelisted && tab.url) {
          tabsToHide.push(tab.id);
        }
      }
  
      if (tabsToHide.length > 0) {
        // 建立一個新的、最小化的視窗來存放分頁
        const newWindow = await chrome.windows.create({
          tabId: tabsToHide[0], // 把第一個要隱藏的分頁直接放進新視窗
          state: "minimized",  // 關鍵！讓視窗一建立就最小化
          type: "normal"
        });
  
        // 如果還有其他分頁要隱藏，把它們也移過去
        if (tabsToHide.length > 1) {
          await chrome.tabs.move(tabsToHide.slice(1), { windowId: newWindow.id, index: -1 });
        }
  
        // 將這個新視窗的 ID 存起來，以便之後恢復
        await chrome.storage.session.set({ storageWindowId: newWindow.id });
        console.log(`已將 ${tabsToHide.length} 個分頁移動到新的最小化視窗中。`);
      } else {
        console.log("沒有需要隱藏的分頁。");
      }
    }
  }
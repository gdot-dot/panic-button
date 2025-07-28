// 監聽快捷鍵
chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-hide-tabs") {
      toggleTabsWithNewWindow();
  }
});

// 當擴充功能第一次安裝或更新時，確保圖示是預設狀態
chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setIcon({ path: "/icon.png" });
});

// 主要的功能函數
async function toggleTabsWithNewWindow() {
  const { storageWindowId, mainWindoId } = await chrome.storage.session.get(['storageWindowId', 'mainWindoId']);

  if (storageWindowId) {
      // --- 恢復模式 ---
      try {
          // 嘗試找到我們之前保存的主視窗，如果找不到，就用當前視窗
          let targetWindow;
          try {
              targetWindow = await chrome.windows.get(mainWindoId);
          } catch (e) {
              targetWindow = await chrome.windows.getLastFocused({ windowTypes: ['normal'] });
          }

          const tabsToMove = await chrome.tabs.query({ windowId: storageWindowId });
          const tabIdsToMove = tabsToMove.map(tab => tab.id);

          if (tabIdsToMove.length > 0) {
              await chrome.tabs.move(tabIdsToMove, { windowId: targetWindow.id, index: -1 });
              // 激活第一個移回來的分頁，提升體驗
              chrome.tabs.update(tabIdsToMove[0], { active: true });
          }

          // 在移回分頁後，再關閉儲存視窗
          await chrome.windows.remove(storageWindowId);
          
          await chrome.action.setIcon({ path: "/icon.png" });
          console.log("分頁已恢復。");

      } catch (error) {
          console.log("恢復過程出錯，可能視窗已被手動關閉。", error);
          await chrome.action.setIcon({ path: "/icon.png" });
      } finally {
          await chrome.storage.session.remove(['storageWindowId', 'mainWindoId']);
      }

  } else {
      // --- 隱藏模式 ---
      const currentWindow = await chrome.windows.getCurrent({ populate: true });
      const { whitelist = [] } = await chrome.storage.sync.get('whitelist');
      
      const tabsToHide = [];
      for (const tab of currentWindow.tabs) {
          const isWhitelisted = whitelist.some(item => tab.url && tab.url.includes(item));
          if (!tab.pinned && !isWhitelisted && tab.url) {
              tabsToHide.push(tab.id);
          }
      }
      
      // 【關鍵修正】如果所有分頁都要被隱藏，就先建立一個新分頁，防止當前視窗被關閉
      if (tabsToHide.length === currentWindow.tabs.length) {
          await chrome.tabs.create({ windowId: currentWindow.id, active: true });
      }

      if (tabsToHide.length > 0) {
          const newWindow = await chrome.windows.create({
              tabId: tabsToHide[0],
              state: "minimized",
              type: "normal"
          });

          if (tabsToHide.length > 1) {
              await chrome.tabs.move(tabsToHide.slice(1), { windowId: newWindow.id, index: -1 });
          }
          
          // 儲存「儲存視窗」和「主視窗」的ID
          await chrome.storage.session.set({ storageWindowId: newWindow.id, mainWindoId: currentWindow.id });
          await chrome.action.setIcon({ path: "/active.png" });
          console.log(`已將 ${tabsToHide.length} 個分頁移動到新的最小化視窗中。`);
      } else {
          console.log("沒有需要隱藏的分頁。");
      }
  }
}
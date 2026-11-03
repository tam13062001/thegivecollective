/**
 * Google Apps Script — dán vào Google Sheet DATA_FACEBOOK_TGC_2026
 * (Extensions > Apps Script), rồi chạy hàm setup() 1 lần.
 *
 * Mục đích: mỗi khi sheet thay đổi (sửa tay, connector ghi data mới) -> gọi backend
 * để đồng bộ Google Sheet -> MongoDB ngay, không phải chờ cron.
 *
 * Project Settings > Script properties: thêm
 *   API_URL     = https://thegivecollective-backend.vercel.app/api/v1/ads-boosting/sync
 *   CRON_SECRET = <giống biến CRON_SECRET trên Vercel>
 */

function syncNow() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('API_URL');
  var secret = props.getProperty('CRON_SECRET') || '';
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: { Authorization: 'Bearer ' + secret },
    muteHttpExceptions: true,
  });
  console.log(res.getResponseCode() + ' ' + res.getContentText().slice(0, 300));
}

// Gom nhiều thay đổi liên tiếp (connector ghi từng khối) thành 1 lần gọi: chờ 1 phút rồi mới sync.
function onSheetChange() {
  var props = PropertiesService.getScriptProperties();
  props.setProperty('PENDING_SINCE', String(Date.now()));
  var hasTimer = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'flushPending'; });
  if (!hasTimer) ScriptApp.newTrigger('flushPending').timeBased().after(60 * 1000).create();
}

function flushPending() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'flushPending') ScriptApp.deleteTrigger(t);
  });
  PropertiesService.getScriptProperties().deleteProperty('PENDING_SINCE');
  syncNow();
}

// Chạy 1 lần để cài trigger.
function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  var ss = SpreadsheetApp.getActive();
  ScriptApp.newTrigger('onSheetChange').forSpreadsheet(ss).onChange().create(); // thay đổi cấu trúc / connector
  ScriptApp.newTrigger('onSheetChange').forSpreadsheet(ss).onEdit().create();   // sửa tay
  ScriptApp.newTrigger('syncNow').timeBased().everyHours(1).create();           // dự phòng: mỗi giờ (không đổi thì backend không ghi gì)
  syncNow();
}

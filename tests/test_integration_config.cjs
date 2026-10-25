const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const target = '-1004413665683';
function extract(html, name) {
  const start = html.indexOf('    function ' + name + '(');
  assert.ok(start >= 0, name);
  const end = html.indexOf('\n    }', start);
  return html.slice(start, end + 6);
}
for (const file of ['index.html', 'admin.html', 'admin/index.html']) {
  const html = fs.readFileSync(file, 'utf8');
  const store = new Map([
    ['crm_tele_config', JSON.stringify({botToken:'test-token', chatId:'-11111', chatIds:['-11111','-22222'], enabled:true})],
    ['crm_payment_api_config', JSON.stringify({apiKey:'stale-access', accessKey:'stale-access', secretKey:'stale-secret', accountNo:'OLD-ACCOUNT', bankBin:'OLD-BANK', bankPublicId:'OLD-ID', packagePrice:129000})]
  ]);
  const ctx = {localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)}, CONFIG:{accountNo:'517041996', bankBin:'970422', accountName:'NGUYEN TRAN HAN'}, console};
  vm.createContext(ctx);
  vm.runInContext(extract(html,'getTelegramConfig'),ctx);
  const tele = ctx.getTelegramConfig();
  assert.ok(tele.botToken.startsWith('8941091346:'),file+': stale bot must be migrated');
  assert.equal(tele.telegramBotVersion,'8941091346');
  assert.equal(JSON.parse(store.get('crm_tele_config')).botToken,tele.botToken);
  assert.equal(tele.chatId,target,file);
  assert.deepEqual(Array.from(tele.chatIds),[target],file);
  assert.equal(JSON.parse(store.get('crm_tele_config')).chatId,target);
  if (file !== 'index.html') {
    ctx.adminApiFetch = async () => ({ok:true});
    ctx.syncTelegramUI = () => {};
    vm.runInContext(extract(html,'saveTelegramConfig'),ctx);
    ctx.saveTelegramConfig({chatId:'-OLD-CHAT',chatIds:['-OLD-CHAT','-EXTRA-CHAT']});
    const saved = JSON.parse(store.get('crm_tele_config'));
    assert.equal(saved.chatId,target,file+': save must keep the web2 recipient');
    assert.deepEqual(saved.chatIds,[target],file+': save must remove extra recipients');
  }
  const paymentFunction = file === 'index.html' ? 'getPaymentApiConfig' : 'getPaymentConfig';
  vm.runInContext(extract(html,paymentFunction),ctx);
  const payment = ctx[paymentFunction]();
  assert.equal(payment.bankBin,'970422',file);
  assert.equal(payment.accountNo,'517041996',file);
  for (const key of ['apiKey','accessKey','secretKey']) {
    assert.equal(payment[key],undefined,file+': '+key);
    assert.equal(JSON.parse(store.get('crm_payment_api_config'))[key],undefined,file+': cached '+key);
  }
  assert.equal(payment.paymentIntegrationVersion,'2026-10-24-apipay-mbbank');
  assert.ok(!html.includes('5a03a2c11ed56ea65b7e7e11107f638ec8acfb95165a6a50225c91a477a157c2'),'payment credentials stay outside public HTML');
}
const cfg = JSON.parse(fs.readFileSync('payment_config.json','utf8'));
const telegram = JSON.parse(fs.readFileSync('telegram_config.json','utf8'));
assert.equal(cfg.bankCode,'MBBank');
assert.equal(cfg.vaNumber,'VQRQAMRMQ5816');
assert.equal(cfg.bankBin,'970422');
assert.equal(cfg.telegramChatId,target);
assert.deepEqual(cfg.telegramChatIds,[target]);
assert.equal(telegram.chatId,target);
assert.deepEqual(telegram.chatIds,[target]);
console.log('PASS integration config: MBBank, one Telegram chat, stale browser migration, no payment credentials in public HTML');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const target = '-5585627393';
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
  const ctx = {localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)}, CONFIG:{accountNo:'V1T61023152838', bankBin:'970418', accountName:'NGO ANH KHOI'}, console};
  vm.createContext(ctx);
  vm.runInContext(extract(html,'getTelegramConfig'),ctx);
  const tele = ctx.getTelegramConfig();
  assert.ok(tele.botToken.startsWith('8941091346:'),file+': stale bot must be migrated');
  assert.equal(tele.telegramBotVersion,'8941091346');
  assert.equal(JSON.parse(store.get('crm_tele_config')).botToken,tele.botToken);
  assert.equal(tele.chatId,target,file);
  assert.deepEqual(Array.from(tele.chatIds),[target],file);
  assert.equal(JSON.parse(store.get('crm_tele_config')).chatId,target);
  const paymentFunction = file === 'index.html' ? 'getPaymentApiConfig' : 'getPaymentConfig';
  vm.runInContext(extract(html,paymentFunction),ctx);
  const payment = ctx[paymentFunction]();
  assert.equal(payment.bankBin,'970418',file);
  assert.equal(payment.accountNo,'V1T61023152838',file);
  for (const key of ['apiKey','accessKey','secretKey']) {
    assert.equal(payment[key],undefined,file+': '+key);
    assert.equal(JSON.parse(store.get('crm_payment_api_config'))[key],undefined,file+': cached '+key);
  }
  assert.equal(payment.paymentIntegrationVersion,'2026-10-24-apipay-bidv');
  assert.ok(!html.includes('f316555d35e27b97'),'payment credentials stay outside public HTML');
}
const cfg = JSON.parse(fs.readFileSync('payment_config.json','utf8'));
const telegram = JSON.parse(fs.readFileSync('telegram_config.json','utf8'));
assert.equal(cfg.bankCode,'BIDV');
assert.equal(cfg.vaNumber,'V1T61023152838');
assert.equal(cfg.bankBin,'970418');
assert.equal(cfg.telegramChatId,target);
assert.deepEqual(cfg.telegramChatIds,[target]);
assert.equal(telegram.chatId,target);
assert.deepEqual(telegram.chatIds,[target]);
console.log('PASS integration config: BIDV, one Telegram chat, stale browser migration, no payment credentials in public HTML');

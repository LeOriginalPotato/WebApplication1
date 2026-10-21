const test = require('node:test');
const assert = require('node:assert/strict');
const { safeReturnPath, sniffImage, isPin, cleanHttpUrl, idList } = require('../src/security');

test('safeReturnPath allows same-site paths only', () => {
  assert.equal(safeReturnPath('/complaints'), '/complaints');
  assert.equal(safeReturnPath('/my-reports/12'), '/my-reports/12');
  assert.equal(safeReturnPath('https://example.com'), '');
  assert.equal(safeReturnPath('//example.com'), '');
  assert.equal(safeReturnPath('///example.com'), '');
  assert.equal(safeReturnPath('/\\example.com'), '');
  assert.equal(safeReturnPath('/%2f%2fexample.com'), '');
  assert.equal(safeReturnPath('/foo bar'), '');
  assert.equal(safeReturnPath('/foo"><script>'), '');
  assert.equal(safeReturnPath('javascript:alert(1)'), '');
});

test('sniffImage accepts photos and rejects other files', () => {
  assert.equal(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0x00, 0, 0, 0, 0, 0, 0, 0, 0])), 'image/jpeg');
  assert.equal(sniffImage(Buffer.from('<svg></svg>')), null);
  const png = Buffer.alloc(12);
  png[0] = 0x89; png[1] = 0x50; png[2] = 0x4e; png[3] = 0x47;
  assert.equal(sniffImage(png), 'image/png');
});

test('pin, url, and id helpers reject unsafe values', () => {
  assert.equal(isPin('1234'), true);
  assert.equal(isPin('12ab'), false);
  assert.equal(cleanHttpUrl('javascript:alert(1)'), null);
  assert.equal(cleanHttpUrl('https://wa.me/27123456789').startsWith('https://'), true);
  assert.deepEqual(idList(['2', '2', '0', 'no', '4']), [2, 4]);
});

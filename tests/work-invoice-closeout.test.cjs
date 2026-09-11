/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require('./testkit.cjs');
const { readWorkInvoiceCloseout, formatCloseoutReference } = require('@/modules/work/invoice-closeout');

const metadata = (overrides = {}) => ({ invoice_closeout: {
  version: 1, status: 'source_not_cached', confirmed_by_user: true, source: 'user_instruction',
  confirmed_at: '2026-09-11T20:00:00Z', invoice_reference: {
    number: '6587', date: '2026-07-15', currency: 'USD', total: '3726.86', customer_name: 'ADP',
  }, ...overrides,
} });

test('human invoice reference preserves cents, currency and calendar date without implying collection', () => {
  const result = readWorkInvoiceCloseout(metadata());
  assert.equal(formatCloseoutReference(result), 'Factura 6587 · 15/07/2026 · USD 3.726,86');
  assert.equal(result.total, '3726.86');
  assert.equal(result.currency, 'USD');
  assert.equal(result.paid, undefined);
  assert.equal(result.documentId, undefined);
});

test('legacy, unconfirmed or automated metadata cannot become a human work closeout', () => {
  for (const input of [null, {}, { invoice_closeout: 'completed' }, metadata({ version: 2 }), metadata({ confirmed_by_user: false }), metadata({ source: 'ai' }), metadata({ status: 'reconciled' })]) {
    assert.equal(readWorkInvoiceCloseout(input), null);
  }
});

test('missing original details remain missing rather than defaulting to zero, pesos or a date', () => {
  const result = readWorkInvoiceCloseout(metadata({ invoice_reference: { customer_name: 'Alfrut S.A.' } }));
  assert.equal(result.number, null);
  assert.equal(result.total, null);
  assert.equal(result.currency, null);
  assert.equal(result.date, null);
  assert.equal(formatCloseoutReference(result), 'Número de factura pendiente');
});

test('invalid date, malformed amount and ambiguous currency cannot be presented as invoice facts', () => {
  const result = readWorkInvoiceCloseout(metadata({ invoice_reference: { number: '6551', date: '2026-02-31', total: '1.439,96', currency: '$' } }));
  assert.equal(result.date, null);
  assert.equal(result.total, null);
  assert.equal(result.currency, null);
  assert.equal(formatCloseoutReference(result), 'Factura 6551');
});

test('work closeout retains relevant review notes without making them financial inputs', () => {
  const result = readWorkInvoiceCloseout(metadata({ review_notes: [' Revisar cliente contra original. ', null, { amount: 900 }, ''] }));
  assert.deepEqual(result.reviewNotes, ['Revisar cliente contra original.']);
  assert.equal(result.total, '3726.86');
});

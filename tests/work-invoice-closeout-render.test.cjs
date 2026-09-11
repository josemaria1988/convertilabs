/* eslint-disable @typescript-eslint/no-require-imports */
const Module = require('node:module');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { test, assert } = require('./testkit.cjs');
const { readWorkInvoiceCloseout } = require('@/modules/work/invoice-closeout');

function render(closeout, dates = {}) {
  const target = require.resolve('@/components/work/work-detail-page');
  const saved = require.cache[target], originalLoad = Module._load, originalFetch = global.fetch;
  delete require.cache[target];
  Module._load = function(request, parent, isMain) {
    if (request === '@/components/ui/loading-link') return { LoadingLink: ({ href, children }) => React.createElement('a', { href }, children) };
    if (request === '@/components/ui/submit-button') return { SubmitButton: ({ disabled, children }) => React.createElement('button', { disabled }, children) };
    return originalLoad.call(this, request, parent, isMain);
  };
  global.fetch = () => assert.fail('Rendering work closeout must not access a network');
  try {
    const { WorkDetailPage } = require(target);
    return renderToStaticMarkup(React.createElement(WorkDetailPage, {
      slug: 'fixture', canManage: false, documentOptions: [], workIntakeItems: [], assignDocumentAction: () => assert.fail('Rendering must not assign documents'),
      workUnit: { id: 'work-1', name: 'Trabajo fixture', status: 'completed', code: null, startDate: null, endDate: null, ...dates,
        invoiceCloseout: closeout, customer: { displayName: 'Cliente fixture' }, estimatedRevenue: null, estimatedCost: null, description: null,
        actualRevenue: 999999, actualCost: 0, actualMargin: 999999, documentMargin: 888888, currencyCode: 'USD', documentCount: 1,
        saleDocumentCount: 1, purchaseDocumentCount: 0, pendingDocumentCount: 1, blockedDocumentCount: 0, postedDocumentCount: 0,
        journalEntryCount: 0, openItemCount: 0, openReceivableAmount: 0, openPayableAmount: 0, vatInputAmount: 0, vatOutputAmount: 0,
        documents: [{ id: 'existing-doc', originalFilename: 'original-pendiente.pdf', direction: 'sale', documentDate: null, currencyCode: 'USD', totalAmount: null, status: 'needs_review', postingStatus: 'draft' }],
      },
    }));
  } finally {
    Module._load = originalLoad; global.fetch = originalFetch;
    if (saved) require.cache[target] = saved; else delete require.cache[target];
  }
}
function metadata(reference) {
  return { invoice_closeout: { version: 1, status: 'source_not_cached', confirmed_by_user: true, source: 'user_instruction',
    confirmed_at: '2026-09-11T20:45:11.342Z', invoice_reference: reference, review_notes: ['Revisar razón social contra el original.'] } };
}

test('work detail renders human invoice reference with cents and retains original links without implying margin or collection', () => {
  const html = render(readWorkInvoiceCloseout(metadata({ number: '6587', date: '2026-07-15', total: '3726.86', currency: 'USD', customer_name: 'Cliente fixture' })));
  assert.match(html, /Facturado y terminado/); assert.match(html, /comprobante pendiente de incorporar/);
  assert.match(html, /Factura 6587 · 15\/07\/2026 · USD 3\.726,86/); assert.match(html, /El cobro no se da por confirmado/);
  assert.match(html, /Revisar razón social contra el original/); assert.match(html, /href="\/app\/o\/fixture\/documents\/existing-doc"/);
  assert.doesNotMatch(html, /Venta actual|Margen actual|Margen documentos|999\.999|888\.888|>A cobrar<|>A pagar</);
});

test('work detail keeps missing original number and amount unknown and changes no legacy view', () => {
  const missing = render(readWorkInvoiceCloseout(metadata({ customer_name: 'Cliente fixture' })));
  assert.match(missing, /Número de factura pendiente/); assert.doesNotMatch(missing, /Factura 0|Factura null|USD 0,00/);
  const legacy = render(null); assert.match(legacy, /Venta actual/); assert.match(legacy, /Margen documentos/); assert.doesNotMatch(legacy, /Cierre confirmado por vos/);
});

test('work calendar dates retain their day in Uruguay and do not break rendering on invalid dates', () => {
  const html = render(null, {startDate:'2026-06-30',endDate:'2026-07-14'});
  assert.match(html,/30 jun\. 2026/);assert.match(html,/14 jul\. 2026/);
  assert.doesNotMatch(html,/29 jun\. 2026|13 jul\. 2026/);
  assert.match(render(null,{startDate:'invalid'}),/Sin fecha/);
});

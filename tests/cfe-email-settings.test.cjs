/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  buildCfeInboundForwardingAddress,
  formatCfeEmailConnectionStatusLabel,
  isValidCfeMailboxEmail,
  normalizeCfeMailboxEmail,
} = require("@/modules/integrations/cfe-email-settings");

test("CFE mailbox normalization keeps a stable lowercase address", () => {
  assert.equal(
    normalizeCfeMailboxEmail("  Facturas.Rontil@Example.COM  "),
    "facturas.rontil@example.com",
  );
  assert.equal(isValidCfeMailboxEmail("facturas@rontil.com.uy"), true);
  assert.equal(isValidCfeMailboxEmail("facturas-rontil"), false);
});

test("CFE forwarding alias is deterministic per organization, user and mailbox", () => {
  const first = buildCfeInboundForwardingAddress({
    organizationId: "org-1",
    userId: "user-1",
    mailboxEmail: "Facturas@Rontil.com.uy",
    domain: "mail.convertilabs.test",
  });
  const second = buildCfeInboundForwardingAddress({
    organizationId: "org-1",
    userId: "user-1",
    mailboxEmail: "facturas@rontil.com.uy",
    domain: "mail.convertilabs.test",
  });

  assert.equal(first, second);
  assert.match(first, /^cfe\+[a-f0-9]{20}@mail\.convertilabs\.test$/);
});

test("CFE email status labels stay explicit in spanish", () => {
  assert.equal(formatCfeEmailConnectionStatusLabel("pending_forwarding"), "Pendiente de reenvio");
  assert.equal(formatCfeEmailConnectionStatusLabel("active"), "Activa");
  assert.equal(formatCfeEmailConnectionStatusLabel("paused"), "Pausada");
});

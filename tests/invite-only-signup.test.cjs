/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const { POST } = require("@/app/api/v1/auth/signup/route");
const { signupUser } = require("@/modules/auth/signup-service");

test("signup service returns invite_only when public signup is closed", async () => {
  const result = await signupUser({
    fullName: "Maria Perez",
    email: "maria@example.com",
    password: "UnaClaveSegura123",
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 403);
  assert.equal(result.error.code, "invite_only");
});

test("signup route returns invite_only response", async () => {
  const response = await POST(
    new Request("http://localhost:3000/api/v1/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        fullName: "Maria Perez",
        email: "maria@example.com",
        password: "UnaClaveSegura123",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    }),
  );

  assert.equal(response.status, 403);

  const body = await response.json();

  assert.equal(body.error.code, "invite_only");
});

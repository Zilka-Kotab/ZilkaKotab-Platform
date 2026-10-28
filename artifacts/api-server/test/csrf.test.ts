import assert from "node:assert/strict";
import { test } from "node:test";
import type { NextFunction, Request, Response } from "express";
import { csrfProtection } from "../src/middlewares/csrf";

function runCsrf(options: {
  path: string;
  authenticated?: boolean;
  cookieToken?: string;
  headerToken?: string;
}) {
  let nextCalled = false;
  let statusCode = 200;
  let body: unknown;
  const request = {
    method: "POST",
    path: options.path,
    cookies: options.cookieToken ? { zk_csrf: options.cookieToken } : {},
    isAuthenticated: () => options.authenticated ?? true,
    get: (name: string) => name.toLowerCase() === "x-csrf-token" ? options.headerToken : undefined,
  } as unknown as Request;
  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(value: unknown) {
      body = value;
      return this;
    },
  } as unknown as Response;
  const next = (() => { nextCalled = true; }) as NextFunction;
  csrfProtection(request, response, next);
  return { nextCalled, statusCode, body };
}

test("public email forms are not blocked by a stale portal CSRF token", () => {
  for (const path of ["/api/contact", "/api/public-tools/inquiry"]) {
    const result = runCsrf({ path, authenticated: true, cookieToken: "old", headerToken: "different" });
    assert.equal(result.nextCalled, true);
    assert.equal(result.statusCode, 200);
  }
});

test("authenticated portal writes still require a matching CSRF token", () => {
  const rejected = runCsrf({ path: "/api/portal/employees", authenticated: true });
  assert.equal(rejected.nextCalled, false);
  assert.equal(rejected.statusCode, 403);
  assert.deepEqual(rejected.body, { error: "Invalid CSRF token." });

  const accepted = runCsrf({
    path: "/api/portal/employees",
    authenticated: true,
    cookieToken: "matching-token",
    headerToken: "matching-token",
  });
  assert.equal(accepted.nextCalled, true);
});

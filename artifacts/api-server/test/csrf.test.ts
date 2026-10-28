import assert from "node:assert/strict";
import { test } from "node:test";
import type { NextFunction, Request, Response } from "express";
import { csrfProtection } from "../src/middlewares/csrf";

function runCsrf(options: {
  path: string;
  authenticated?: boolean;
  cookieToken?: string;
  headerToken?: string;
  method?: string;
}) {
  let nextCalled = false;
  let statusCode = 200;
  let body: unknown;
  const request = {
    method: options.method ?? "POST",
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

test("public patent searches work with or without a portal login despite missing or stale tokens", () => {
  for (const path of [
    "/api/public-tools/portfolio/analyze",
    "/api/public-tools/portfolio/advanced",
    "/api/public-tools/examiner/analyze",
  ]) {
    for (const authenticated of [false, true]) {
      for (const tokens of [
        {},
        { cookieToken: "existing-portal-token" },
        { cookieToken: "old-token", headerToken: "different" },
      ]) {
        const result = runCsrf({ path, authenticated, ...tokens });
        assert.equal(result.nextCalled, true, path);
        assert.equal(result.statusCode, 200);
      }
    }
  }
});

test("public-search exceptions do not exempt other public-tools routes", () => {
  const result = runCsrf({ path: "/api/public-tools/portfolio/delete", authenticated: true });
  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 403);
});

test("public-search exceptions apply only to POST", () => {
  for (const method of ["PUT", "PATCH", "DELETE"]) {
    const result = runCsrf({ path: "/api/public-tools/portfolio/analyze", authenticated: true, method });
    assert.equal(result.nextCalled, false);
    assert.equal(result.statusCode, 403);
  }
});

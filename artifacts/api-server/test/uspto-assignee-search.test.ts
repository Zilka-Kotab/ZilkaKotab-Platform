import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getEligibleAssigneePatentNumbers,
  getSelectedEligibleAssigneePatentNumbers,
  isAssigneePatentAlreadyAdded,
} from "../../zilka-kotab/src/lib/assignee-search.ts";
import { normalizePatentNumbers, searchPatentsByAssignee } from "../src/lib/uspto.ts";

type SearchRecord = {
  patentNumber: string;
  applicationNumberText?: string;
  applicationMetaData: {
    assigneeBag: { assigneeNameText: string }[];
    inventionTitle?: string;
    grantDate?: string;
  };
};

function record(patentNumber: string, assignees: string[] = ["Example Corp"]): SearchRecord {
  return {
    patentNumber,
    applicationNumberText: "12345678",
    applicationMetaData: {
      assigneeBag: assignees.map((assigneeNameText) => ({ assigneeNameText })),
      inventionTitle: `Patent ${patentNumber}`,
      grantDate: "20240115",
    },
  };
}

async function withSearchPages(
  pages: SearchRecord[][],
  run: (requests: URL[]) => Promise<void>,
) {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.USPTO_API_KEY;
  const requests: URL[] = [];
  process.env.USPTO_API_KEY = "test-key";
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requests.push(new URL(typeof input === "string" ? input : input.toString()));
    const offset = Number(requests.at(-1)?.searchParams.get("offset") ?? 0);
    const pageIndex = Math.floor(offset / 100);
    return new Response(JSON.stringify({ patentFileWrapperDataBag: pages[pageIndex] ?? [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    await run(requests);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.USPTO_API_KEY;
    else process.env.USPTO_API_KEY = originalApiKey;
  }
}

test("USPTO assignee search and selection behavior", async (suite) => {
  await suite.test("paginates and returns distinct patent numbers", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => record(String(1000000 + index)));
    const pages = [firstPage, [record("1000000"), record("1000100")]];

    await withSearchPages(pages, async (requests) => {
      const response = await searchPatentsByAssignee("Example Corp");

      assert.deepEqual(requests.map((url) => url.searchParams.get("offset")), ["0", "100"]);
      assert.equal(requests[0].searchParams.get("limit"), "100");
      assert.equal(response.results.length, 101);
      assert.equal(response.results.filter((item) => item.normalizedPatentNumber === "US1000000").length, 1);
      assert.equal(response.truncated, false);
    });
  });

  await suite.test("accepts a matching name among multiple assignees", async () => {
    await withSearchPages([[record("7654321", ["Other Holdings", "Example Corp International"])]], async () => {
      const response = await searchPatentsByAssignee("Example Corp");
      assert.equal(response.results.length, 1);
      assert.equal(response.results[0].normalizedPatentNumber, "US7654321");
      assert.equal(response.results[0].assignee, "Example Corp International");
    });
  });

  await suite.test("searches alternate names and labels assignment-record matches", async () => {
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.USPTO_API_KEY;
    const requests: URL[] = [];
    process.env.USPTO_API_KEY = "test-key";
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(typeof input === "string" ? input : input.toString());
      requests.push(url);
      if (url.pathname.endsWith("/assignment")) {
        return new Response(JSON.stringify({
          assignmentBag: [{
            assignorBag: [{ assignorName: "Former Example Corp" }],
            assigneeBag: [{ assigneeNameText: "Example Corp" }],
            assignmentRecordedDate: "2024-02-03",
            conveyanceText: "ASSIGNMENT OF ASSIGNORS INTEREST",
          }],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      const query = url.searchParams.get("q") ?? "";
      const results = query.includes("Former Example Corp")
        ? []
        : [record("7654321", ["Example Corp"])];
      return new Response(JSON.stringify({ patentFileWrapperDataBag: results }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      const response = await searchPatentsByAssignee("Example Corp", {
        alternateAssignees: ["Former Example Corp"],
        includeAssignments: true,
      });

      assert.equal(response.results.length, 1);
      assert.deepEqual(response.results[0].matchSources, [
        { type: "application", matchedName: "Example Corp" },
        {
          type: "assignment",
          matchedName: "Example Corp",
          partyRole: "ASSIGNEE",
          recordedDate: "2024-02-03",
          conveyance: "ASSIGNMENT OF ASSIGNORS INTEREST",
        },
        {
          type: "assignment",
          matchedName: "Former Example Corp",
          partyRole: "ASSIGNOR",
          recordedDate: "2024-02-03",
          conveyance: "ASSIGNMENT OF ASSIGNORS INTEREST",
        },
      ]);
      assert.equal(response.assignmentSearchTruncated, false);
      assert.equal(requests.filter((url) => url.pathname.endsWith("/assignment")).length, 1);
      assert.equal(requests.filter((url) => url.pathname === "/api/v1/patent/applications/search").length, 2);
    } finally {
      globalThis.fetch = originalFetch;
      if (originalApiKey === undefined) delete process.env.USPTO_API_KEY;
      else process.env.USPTO_API_KEY = originalApiKey;
    }
  });

  await suite.test("returns an empty non-truncated result when there are no matches", async () => {
    await withSearchPages([[record("7654321", ["Unrelated Company"])]], async (requests) => {
      const response = await searchPatentsByAssignee("Example Corp");
      assert.deepEqual(response, { results: [], truncated: false });
      assert.equal(requests.length, 1);
    });
  });

  await suite.test("caps results and reports that the cap was reached", async () => {
    const pages = Array.from({ length: 50 }, (_, page) =>
      Array.from({ length: 100 }, (_, index) => record(String(1000000 + page * 100 + index))),
    );

    await withSearchPages(pages, async (requests) => {
      const response = await searchPatentsByAssignee("Example Corp");
      assert.equal(response.results.length, 5000);
      assert.equal(response.truncated, true);
      assert.equal(requests.length, 50);
      assert.equal(requests.at(-1)?.searchParams.get("offset"), "4900");
    });
  });

  await suite.test("existing portfolio matches are excluded and eligible selections remain stageable", () => {
    const matches = [
      { normalizedPatentNumber: "US1234567" },
      { normalizedPatentNumber: "US7654321" },
    ];
    const portfolio = [{ patentNumber: "US 1,234,567 B2" }];

    assert.equal(isAssigneePatentAlreadyAdded(matches[0], portfolio), true);
    assert.equal(isAssigneePatentAlreadyAdded(matches[1], portfolio), false);
    assert.deepEqual(getEligibleAssigneePatentNumbers(matches, portfolio), ["US7654321"]);

    // The workspace passes these selected numbers to its existing preview/review retrieval flow.
    const selectedForReview = getSelectedEligibleAssigneePatentNumbers(
      matches,
      ["US1234567", "US7654321"],
      portfolio,
    );
    assert.deepEqual(selectedForReview, ["US7654321"]);
    assert.deepEqual(normalizePatentNumbers(selectedForReview.join("\n")), selectedForReview);
  });
});

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { validateSnapshotDirectory } from "../src/snapshot/cli";

const workflow = readFileSync(
  resolve(import.meta.dirname, "../.github/workflows/publish.yml"),
  "utf8",
);

type ScheduledJob = {
  name: string;
  conclusion: string | null;
  started_at: string | null;
};

async function evaluateSchedule({
  now,
  eventName = "schedule",
  runs = [],
  jobs = {},
  apiError,
}: {
  now: string;
  eventName?: string;
  runs?: { id: number }[];
  jobs?: Record<number, ScheduledJob[]>;
  apiError?: Error;
}) {
  const match = workflow.match(
    /- name: Decide scheduled publication[\s\S]*?script: \|\n((?: {12}[^\n]*\n|\n)+)/,
  );
  if (!match) throw new Error("Scheduled publication decision is missing");
  const script = match[1].replace(/^ {12}/gm, "");
  const listWorkflowRuns = () => {};
  const listJobsForWorkflowRun = () => {};
  const paginate = vi.fn(async (method: () => void, options: { run_id?: number }) => {
    if (apiError) throw apiError;
    if (method === listWorkflowRuns) return runs;
    if (method === listJobsForWorkflowRun && options.run_id !== undefined) {
      return jobs[options.run_id] ?? [];
    }
    throw new Error("Unexpected GitHub API request");
  });
  const github = {
    paginate,
    rest: { actions: { listWorkflowRuns, listJobsForWorkflowRun } },
  };
  const context = {
    eventName,
    repo: { owner: "owner", repo: "repo" },
    runId: 999,
  };
  const outputs: Record<string, string> = {};
  const failures: string[] = [];
  const core = {
    info: vi.fn(),
    setOutput: (name: string, value: string) => {
      outputs[name] = value;
    },
    setFailed: (message: string) => {
      failures.push(message);
    },
  };
  class FixedDate extends Date {
    constructor(value?: number | string) {
      super(value === undefined ? now : value);
    }
  }
  const execute = runInNewContext(
    `(async (context, core, github, Date) => {\n${script}\n})`,
  ) as (
    inputContext: typeof context,
    inputCore: typeof core,
    inputGithub: typeof github,
    clock: typeof FixedDate,
  ) => Promise<void>;

  await execute(context, core, github, FixedDate);
  return { outputs, failures, paginate, listWorkflowRuns, listJobsForWorkflowRun };
}

describe("static publication workflow", () => {
  it("runs daily at 05:17 UTC and supports manual refreshes", () => {
    expect(workflow).toMatch(/schedule:\s*\n\s+- cron:\s*["']?17 5 \* \* \*["']?/);
    expect(workflow).toMatch(/workflow_dispatch:/);
  });

  it("does not depend on stored source credentials", () => {
    expect(workflow).not.toMatch(/secrets\./);
  });

  it("only reuses persisted Snapshots when a manual app-only deployment is selected", () => {
    expect(workflow).toMatch(/refresh_snapshots:[\s\S]*?type: boolean\s+default: true/);
    expect(workflow).toContain(
      "if: github.event_name != 'workflow_dispatch' || inputs.refresh_snapshots",
    );
    expect(workflow).toContain(
      "if: github.event_name == 'workflow_dispatch' && !inputs.refresh_snapshots",
    );
    const reuse = workflow.indexOf("cp public/snapshots/*.json generated/snapshots/");
    const validate = workflow.indexOf("npm run snapshot:validate -- generated/snapshots");
    const build = workflow.indexOf("npm run build");
    expect(reuse).toBeGreaterThan(0);
    expect(reuse).toBeLessThan(validate);
    expect(validate).toBeLessThan(build);
  });

  it("validates a clean generated Snapshot set before copying or deploying", () => {
    const clean = workflow.indexOf("rm -rf generated/snapshots");
    const refresh = workflow.indexOf(
      "npm run snapshot -- generated/snapshots",
    );
    const validate = workflow.indexOf(
      "npm run snapshot:validate -- generated/snapshots",
    );
    const copy = workflow.indexOf(
      "cp generated/snapshots/*.json public/snapshots/",
    );
    const build = workflow.indexOf("npm run build");
    const deploy = workflow.indexOf("actions/deploy-pages@");

    expect(workflow).toContain(
      "SNAPSHOT_PREVIOUS_DIRECTORY: public/snapshots",
    );
    expect(
      [clean, refresh, validate, copy, build, deploy].every(
        (index) => index >= 0,
      ),
    ).toBe(true);
    expect(clean).toBeLessThan(refresh);
    expect(refresh).toBeLessThan(validate);
    expect(validate).toBeLessThan(copy);
    expect(copy).toBeLessThan(build);
    expect(build).toBeLessThan(deploy);
  });

  it("accepts valid Snapshots and rejects missing configured Locations", async () => {
    await expect(
      validateSnapshotDirectory(resolve(import.meta.dirname, "fixtures/snapshots")),
    ).resolves.toBeUndefined();
    await expect(
      validateSnapshotDirectory(
        resolve(import.meta.dirname, "fixtures/snapshots/absent"),
      ),
    ).rejects.toThrow("Genererad Snapshot saknas för Location linkoping");
  });

  it("rejects fixture sources when validating Snapshots for publication", async () => {
    await expect(
      validateSnapshotDirectory(
        resolve(import.meta.dirname, "fixtures/snapshots"),
        { rejectFixtures: true },
      ),
    ).rejects.toThrow("Snapshot innehåller testfixturer");
  });

  it("deploys persisted Snapshot artifacts before reporting refresh failures", () => {
    const refresh = workflow.indexOf("id: refresh");
    const persist = workflow.indexOf("git push");
    const build = workflow.indexOf("npm run build");
    const upload = workflow.indexOf("actions/upload-pages-artifact@");
    const deploy = workflow.indexOf("actions/deploy-pages@");
    const reportFailure = workflow.indexOf(
      "steps.refresh.outcome == 'failure'",
    );

    expect(workflow).toMatch(
      /id:\s*refresh[\s\S]{0,100}continue-on-error:\s*true/,
    );
    expect(
      [refresh, persist, build, upload, deploy, reportFailure].every(
        (index) => index >= 0,
      ),
    ).toBe(true);
    expect(workflow).toContain("run: npm run snapshot");
    expect(workflow).toContain("git add public/snapshots/");
    expect(workflow).toContain(
      "VITE_BASE_PATH: ${{ steps.pages.outputs.base_path }}",
    );
    expect(workflow).toContain("path: dist");
    expect(refresh).toBeLessThan(persist);
    expect(persist).toBeLessThan(build);
    expect(build).toBeLessThan(upload);
    expect(upload).toBeLessThan(deploy);
    expect(deploy).toBeLessThan(reportFailure);
  });

  it("regenerates the product image database before building without blocking Offers", () => {
    const images = workflow.indexOf("run: npm run images:sync");
    expect(images).toBeGreaterThan(workflow.indexOf("path: public/images/products"));
    expect(images).toBeLessThan(workflow.indexOf("run: npm run build"));
    expect(workflow).toMatch(/continue-on-error:\s*true\s*\n\s*run: npm run images:sync/);
  });
});

describe("scheduled publication retries", () => {
  it("offers a morning trigger for every constant delay up to 14 hours", () => {
    const hours = [...workflow.matchAll(/^\s+- cron: ["']([^"']+)["']/gm)].flatMap(
      ([, expression]) => {
        const [minute, hour, day, month, weekday] = expression.split(" ");
        if (minute !== "17" || day !== "*" || month !== "*" || weekday !== "*") {
          return [];
        }
        return hour.split(",").map(Number).filter(Number.isInteger);
      },
    );
    const missedDelays = Array.from({ length: 14 * 60 + 1 }, (_, delay) => delay).filter(
      (delay) =>
        ![-1, 0].some((day) =>
          hours.some((hour) => {
            const arrival = (day * 24 + hour) * 60 + 17 + delay;
            return arrival >= 5 * 60 && arrival < 8 * 60;
          }),
        ),
    );

    expect(missedDelays[0], "first uncovered delay in minutes").toBeUndefined();
  });

  it.each([
    ["2026-11-27T04:59:59Z", "false"],
    ["2026-11-27T05:00:00Z", "true"],
    ["2026-11-27T05:01:53Z", "true"],
    ["2026-11-27T07:59:59Z", "true"],
    ["2026-11-27T08:00:00Z", "false"],
    ["2026-11-26T15:20:12Z", "false"],
  ])("gates the scheduled run at %s", async (now, expected) => {
    const { outputs } = await evaluateSchedule({ now });
    expect(outputs.publish).toBe(expected);
    if (expected === "true") expect(outputs.day).toBe(now.slice(0, 10));
  });

  it("separates schedule and manual queues while serializing publication", () => {
    const publish = workflow.indexOf("\n  publish:\n");
    expect(workflow.slice(0, publish)).toContain(
      "group: publish-offers-${{ github.event_name }}",
    );
    expect(workflow.slice(publish)).toMatch(
      /concurrency:\s*\n\s+group: publish-offers\s*\n\s+cancel-in-progress: false/,
    );
    expect(workflow.slice(publish)).toMatch(
      /needs: schedule_gate\s*\n\s+if: needs\.schedule_gate\.outputs\.publish == 'true'/,
    );
  });

  it("leaves manual dispatch available outside the scheduled window", async () => {
    const { outputs, paginate } = await evaluateSchedule({
      now: "2026-11-26T15:20:12Z",
      eventName: "workflow_dispatch",
      apiError: new Error("GitHub API unavailable"),
    });
    expect(outputs.publish).toBe("true");
    expect(paginate).not.toHaveBeenCalled();
  });

  it("skips a second scheduled attempt even when the first one failed", async () => {
    const result = await evaluateSchedule({
      now: "2026-11-27T07:17:00Z",
      runs: [{ id: 999 }, { id: 123 }],
      jobs: {
        999: [{ name: "publish", conclusion: null, started_at: "2026-11-27T07:17:00Z" }],
        123: [{ name: "publish", conclusion: "failure", started_at: "2026-11-27T05:35:00Z" }],
      },
    });
    expect(result.outputs.publish).toBe("false");
    expect(result.paginate).toHaveBeenCalledWith(
      result.listWorkflowRuns,
      expect.objectContaining({ event: "schedule", created: "2026-11-26..2026-11-27" }),
    );
    expect(result.paginate).toHaveBeenCalledWith(
      result.listJobsForWorkflowRun,
      expect.objectContaining({ run_id: 123, filter: "all" }),
    );
    expect(result.paginate).not.toHaveBeenCalledWith(
      result.listJobsForWorkflowRun,
      expect.objectContaining({ run_id: 999 }),
    );
  });

  it("does not count skipped or out-of-window jobs", async () => {
    const { outputs } = await evaluateSchedule({
      now: "2026-11-27T05:17:00Z",
      runs: [{ id: 123 }, { id: 124 }, { id: 125 }],
      jobs: {
        123: [{ name: "publish", conclusion: "skipped", started_at: "2026-11-27T05:05:00Z" }],
        124: [{ name: "publish", conclusion: "success", started_at: "2026-11-26T05:05:00Z" }],
        125: [{ name: "publish", conclusion: "success", started_at: "2026-11-27T04:30:00Z" }],
      },
    });
    expect(outputs.publish).toBe("true");
  });

  it("reports a missed morning instead of silently skipping an afternoon trigger", async () => {
    const { outputs, failures } = await evaluateSchedule({
      now: "2026-11-26T15:20:12Z",
      runs: [{ id: 45647389804 }, { id: 999 }],
      jobs: {
        45647389804: [
          { name: "publish", conclusion: "failure", started_at: "2026-11-25T15:38:15Z" },
        ],
      },
    });
    expect(outputs.publish).toBe("false");
    expect(failures).toEqual([
      "No scheduled publication started between 05:00 and 08:00 UTC today.",
    ]);
  });

  it("does not report a missed morning after an earlier scheduled attempt", async () => {
    const { outputs, failures } = await evaluateSchedule({
      now: "2026-11-26T17:17:00Z",
      runs: [{ id: 123 }],
      jobs: {
        123: [{ name: "publish", conclusion: "success", started_at: "2026-11-26T05:35:00Z" }],
      },
    });
    expect(outputs.publish).toBe("false");
    expect(failures).toEqual([]);
  });

  it("skips an evening backup without reporting a missed morning", async () => {
    const { outputs, failures, paginate } = await evaluateSchedule({
      now: "2026-11-26T19:17:00Z",
      apiError: new Error("GitHub API unavailable"),
    });
    expect(outputs.publish).toBe("false");
    expect(failures).toEqual([]);
    expect(paginate).not.toHaveBeenCalled();
  });

  it("fails explicitly if the scheduled-run history cannot be checked", async () => {
    await expect(
      evaluateSchedule({
        now: "2026-11-27T05:17:00Z",
        apiError: new Error("GitHub API unavailable"),
      }),
    ).rejects.toThrow("GitHub API unavailable");
  });

  it("rechecks the time when the publish job actually starts", () => {
    const match = workflow.match(
      /- name: Enforce scheduled publication window\n\s+if: github\.event_name == 'schedule'\n\s+env:\n\s+APPROVED_DAY: [^\n]+\n\s+run: \|\n((?: {10}[^\n]*\n|\n)+)/,
    );
    if (!match) throw new Error("Scheduled publication start check is missing");
    const script = match[1].replace(/^ {10}/gm, "");
    const run = (day: string, hour: string) =>
      spawnSync(
        "bash",
        [
          "-c",
          `date() {
            case "$2" in
              +%F) printf '%s\\n' "$TEST_DAY" ;;
              +%H) printf '%s\\n' "$TEST_HOUR" ;;
            esac
          }
          ${script}`,
        ],
        {
          encoding: "utf8",
          env: { ...process.env, APPROVED_DAY: "2026-11-27", TEST_DAY: day, TEST_HOUR: hour },
        },
      );

    expect(run("2026-11-27", "07").status).toBe(0);
    expect(run("2026-11-27", "08").status).toBe(1);
    expect(run("2026-11-28", "07").status).toBe(1);
  });
});

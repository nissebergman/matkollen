import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  resolve(import.meta.dirname, "../.github/workflows/publish.yml"),
  "utf8",
);

describe("static publication workflow", () => {
  it("runs daily at 05:00 UTC and supports manual refreshes", () => {
    expect(workflow).toMatch(/schedule:\s*\n\s+- cron:\s*["']?0 5 \* \* \*["']?/);
    expect(workflow).toMatch(/workflow_dispatch:/);
  });

  it("does not depend on stored source credentials", () => {
    expect(workflow).not.toMatch(/secrets\./);
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
});

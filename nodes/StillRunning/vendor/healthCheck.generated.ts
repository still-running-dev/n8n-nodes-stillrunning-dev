/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Bundled from @still-running/health-check@2.1.0 (pinned
 * exact in package.json's devDependencies — never a range, never a
 * workspace link) by scripts/vendor-health-check.mjs. Regenerate with
 * `node scripts/vendor-health-check.mjs` after bumping that pin.
 *
 * package.json's own dependencies stays empty — n8n verified nodes may not
 * declare a runtime dependency — while the code that actually runs is still
 * built from one specific, reproducible, published npm version.
 */
/* eslint-disable */
// @ts-nocheck

var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};

// node_modules/@still-running/health-check/dist/core/model.js
var require_model = __commonJS({
  "node_modules/@still-running/health-check/dist/core/model.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SEVERITY_ORDER = void 0;
    exports.SEVERITY_ORDER = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
      info: 4
    };
  }
});

// node_modules/@still-running/health-check/dist/core/checks/zero-write.js
var require_zero_write = __commonJS({
  "node_modules/@still-running/health-check/dist/core/checks/zero-write.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.computeDominators = computeDominators;
    exports.isGuarded = isGuarded;
    exports.findAlertNodes = findAlertNodes;
    exports.checkZeroWrite = checkZeroWrite;
    var model_js_1 = require_model();
    function computeDominators(wf) {
      const ENTRY = "\0entry";
      const ids = wf.nodes.filter((n) => !n.disabled).map((n) => n.id);
      const idSet = new Set(ids);
      const preds = /* @__PURE__ */ new Map();
      for (const id of ids)
        preds.set(id, []);
      preds.set(ENTRY, []);
      for (const e of wf.edges) {
        if (e.channel === "error")
          continue;
        if (!idSet.has(e.from) || !idSet.has(e.to))
          continue;
        preds.get(e.to).push(e.from);
      }
      for (const t of wf.triggerIds) {
        if (idSet.has(t))
          preds.get(t).push(ENTRY);
      }
      for (const id of ids) {
        if (preds.get(id).length === 0)
          preds.get(id).push(ENTRY);
      }
      const all = /* @__PURE__ */ new Set([ENTRY, ...ids]);
      const dom = /* @__PURE__ */ new Map();
      dom.set(ENTRY, /* @__PURE__ */ new Set([ENTRY]));
      for (const id of ids)
        dom.set(id, new Set(all));
      let changed = true;
      let guard = 0;
      while (changed && guard++ < 200) {
        changed = false;
        for (const id of ids) {
          const ps = preds.get(id);
          let next = null;
          for (const p of ps) {
            const dp = dom.get(p);
            if (!dp)
              continue;
            if (next === null) {
              next = new Set(dp);
            } else {
              for (const x of [...next])
                if (!dp.has(x))
                  next.delete(x);
            }
          }
          if (next === null)
            next = /* @__PURE__ */ new Set();
          next.add(id);
          const cur = dom.get(id);
          if (next.size !== cur.size || [...next].some((x) => !cur.has(x))) {
            dom.set(id, next);
            changed = true;
          }
        }
      }
      return dom;
    }
    function isGuarded(wf, gateId) {
      const out = wf.edges.filter((e) => e.from === gateId);
      const channels = new Set(out.map((e) => e.channel));
      if (channels.size > 1)
        return true;
      if (channels.has("error"))
        return true;
      return out.some((e) => {
        const n = wf.nodes.find((x) => x.id === e.to);
        return (n == null ? void 0 : n.role) === "alert" || (n == null ? void 0 : n.role) === "error-handler";
      });
    }
    var ALERT_CHANNELS = /* @__PURE__ */ new Set(["false", "else", "error"]);
    var ALERT_TARGETS = /slack|telegram|discord|gmail|email|twilio|whatsapp|pushover/i;
    function findAlertNodes(wf) {
      var _a;
      const alerts = /* @__PURE__ */ new Set();
      for (const e of wf.edges) {
        if (!ALERT_CHANNELS.has(e.channel))
          continue;
        const n = wf.nodes.find((x) => x.id === e.to);
        if (!n)
          continue;
        if (n.writeKind === "send" && ALERT_TARGETS.test(n.platformType + " " + ((_a = n.writeTarget) != null ? _a : ""))) {
          alerts.add(n.id);
        }
      }
      for (const n of wf.nodes) {
        if (n.role === "error-handler")
          alerts.add(n.id);
      }
      return alerts;
    }
    function checkZeroWrite(wf) {
      var _a, _b, _c;
      const findings = [];
      const byId = new Map(wf.nodes.map((n) => [n.id, n]));
      const alertIds = findAlertNodes(wf);
      const writes = wf.nodes.filter((n) => n.role === "write" && !n.disabled && !alertIds.has(n.id));
      if (writes.length === 0)
        return findings;
      const hasSafetyNet = alertIds.size > 0 || wf.cadence.expectedIntervalKnown || wf.errorPolicy.workflowLevelHandler;
      const dom = computeDominators(wf);
      const soleWrite = writes.length === 1;
      for (const w of writes) {
        const dominators = (_a = dom.get(w.id)) != null ? _a : /* @__PURE__ */ new Set();
        const starvers = [];
        for (const dId of dominators) {
          if (dId === w.id)
            continue;
          const d = byId.get(dId);
          if (!d || !d.zeroEmit)
            continue;
          starvers.push({ node: d, guarded: isGuarded(wf, dId) });
        }
        const gateEdges = wf.edges.filter((e) => e.gate && dominators.has(e.from) && dominators.has(e.to));
        if (starvers.length === 0 && gateEdges.length === 0) {
          if (w.errorHandling.continueOnFail) {
            findings.push({
              checkId: "zero-write",
              severity: "medium",
              nodeId: w.id,
              nodeLabel: w.label,
              title: `"${w.label}" is set to carry on when it fails`,
              ifItGoesQuiet: `The write fails, the run continues to the end, and the execution is recorded as a success. Nothing writes and nothing is flagged.`,
              detail: "Continue-on-fail is the right setting when a later step handles the failure. Nothing downstream of this node looks like it does."
            });
          }
          continue;
        }
        const unguarded = starvers.filter((s) => !s.guarded);
        const structural = unguarded.filter((s) => s.node.zeroEmit.certainty === "structural");
        const worst = (_c = (_b = structural[0]) != null ? _b : unguarded[0]) != null ? _c : starvers[0];
        if (!worst)
          continue;
        let severity;
        if (structural.length > 0 && !hasSafetyNet) {
          severity = soleWrite ? "critical" : "high";
        } else if (structural.length > 0) {
          severity = soleWrite ? "medium" : "low";
        } else if (unguarded.length > 0) {
          severity = hasSafetyNet ? "low" : "medium";
        } else {
          severity = "low";
        }
        const chainNames = [...new Set([...structural, ...unguarded, ...starvers].slice(0, 3).map((s) => `"${s.node.label}"`))].join(" -> ");
        const target = w.writeTarget ? ` to ${w.writeTarget}` : "";
        findings.push({
          checkId: "zero-write",
          severity,
          nodeId: w.id,
          nodeLabel: w.label,
          title: `"${w.label}" can be skipped entirely and the run still finishes green`,
          ifItGoesQuiet: `${worst.node.zeroEmit.cause} Every path to "${w.label}" goes through it, so nothing is written${target}, every step shows as successful, and the execution list looks exactly like a normal day.` + (soleWrite ? " This is the only write in the workflow, so the run does nothing at all." : ""),
          detail: `Chain: ${chainNames} -> "${w.label}". ` + (worst.guarded ? "There is another branch off that step, so the empty case does reach something." : "Nothing else leaves that step, so the empty case reaches nobody.") + (worst.node.errorHandling.alwaysOutputData ? ' Note: that step has "always output data" switched on, so it pushes an empty item through rather than stopping \u2014 the write may run and write a blank row instead of nothing at all.' : ""),
          howToCheck: (hasSafetyNet ? "Something in this workflow would surface an empty run, so this is worth knowing rather than worth panicking about. " : "Nothing in this workflow would surface an empty run: no alert branch, no expected rhythm, no error handler. ") + "Static analysis can only tell you this is possible. Whether it is happening needs run history: compare items written per run against the same run a week ago."
        });
      }
      findings.sort((a, b) => model_js_1.SEVERITY_ORDER[a.severity] - model_js_1.SEVERITY_ORDER[b.severity]);
      if (findings.length > 3) {
        const rest = findings.length - 3;
        const top = findings.slice(0, 3);
        top.push({
          checkId: "zero-write",
          severity: "info",
          nodeId: null,
          nodeLabel: null,
          title: `${rest} more write step${rest === 1 ? "" : "s"} with the same pattern`,
          ifItGoesQuiet: "Same story as above, further down the workflow.",
          detail: "Showing the three that matter most. The rest follow the same shape."
        });
        return top;
      }
      return findings;
    }
  }
});

// node_modules/@still-running/health-check/dist/core/providers.js
var require_providers = __commonJS({
  "node_modules/@still-running/health-check/dist/core/providers.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.STATIC_KEY_HINTS = exports.PROVIDERS = void 0;
    exports.resolveProvider = resolveProvider;
    exports.guessAuthKind = guessAuthKind;
    exports.PROVIDERS = [
      {
        id: "google",
        displayName: "Google",
        match: {
          n8n: [
            "googlesheetsoauth2",
            "googledriveoauth2",
            "gmailoauth2",
            "googlecalendaroauth2",
            "googledocsoauth2",
            "googleoauth2",
            "gsuiteadminoauth2",
            "googlebigqueryoauth2",
            "googleanalyticsoauth2"
          ],
          make: ["account:google", "google"]
        },
        defaultAuthKind: "oauth2",
        autoRefreshable: true,
        rules: [
          {
            condition: 'The Google Cloud project behind this connection has its OAuth consent screen set to "Testing" with an External user type',
            certainty: "conditional",
            window: "7 days",
            detail: "Google issues a refresh token that expires 7 days after consent. When it dies the platform gets invalid_grant, the trigger stops firing, and nothing throws a run-level error because there is no run.",
            howToCheck: 'Google Cloud Console -> APIs & Services -> OAuth consent screen. If Publishing status says "Testing", this connection dies every 7 days. If it says "In production", it does not.'
          },
          {
            condition: "The consent screen is published to production and verified",
            certainty: "conditional",
            window: "indefinite, with five exceptions",
            detail: "Effectively permanent unless: the token goes unused for six months, the user revokes access, the user changes their password while Gmail scopes are granted, the per-user token cap is exceeded, or the app loses verification for sensitive scopes.",
            howToCheck: "The six-month rule matters here: a workflow that stops running also stops refreshing, so a quiet workflow eventually becomes a dead credential."
          }
        ],
        sources: [
          "https://developers.google.com/identity/protocols/oauth2",
          "https://support.google.com/cloud/answer/15549945"
        ],
        complaintLogRows: [9, 11, 12, 40, 41]
      },
      {
        id: "microsoft",
        displayName: "Microsoft",
        match: {
          n8n: [
            "microsoftoauth2",
            "microsoftoutlookoauth2",
            "microsoftexceloauth2",
            "microsoftonedriveoauth2",
            "microsoftsharepointoauth2",
            "microsoftteamsoauth2",
            "microsoftgraphsecurityoauth2",
            "azure"
          ],
          make: ["account:microsoft", "microsoft", "office365"]
        },
        defaultAuthKind: "oauth2",
        autoRefreshable: true,
        rules: [
          {
            condition: "Normal case \u2014 the workflow runs at least every 90 days",
            certainty: "certain",
            window: "effectively indefinite",
            detail: "Microsoft refresh tokens default to a 90-day inactivity limit and replace themselves every time they are used. A workflow that runs daily keeps resetting the clock, so this is lower risk than Google."
          },
          {
            condition: "The workflow stops running for 90 days",
            certainty: "certain",
            window: "90 days of inactivity",
            detail: "The refresh token expires from disuse. Note the trap: a workflow that already went quiet for another reason quietly becomes unrecoverable too, so a short outage turns into a manual re-auth."
          },
          {
            condition: "The tenant applies a Conditional Access sign-in frequency policy",
            certainty: "conditional",
            window: "whatever the policy says",
            detail: "Since January 2021 refresh lifetimes are no longer configurable through token lifetime policies, but Conditional Access sign-in frequency still forces re-authentication on a schedule the client cannot see.",
            howToCheck: "Ask the tenant admin whether a sign-in frequency policy applies to this app. It is not visible from the automation side."
          }
        ],
        sources: [
          "https://learn.microsoft.com/en-us/entra/identity-platform/refresh-tokens",
          "https://learn.microsoft.com/en-us/entra/identity-platform/configurable-token-lifetimes"
        ],
        complaintLogRows: [14]
      },
      {
        id: "meta-whatsapp",
        displayName: "WhatsApp / Meta",
        match: {
          n8n: ["whatsapp", "facebookgraph", "facebookapp"],
          make: ["account:whatsapp", "account:facebook", "whatsapp", "facebook"]
        },
        defaultAuthKind: "api-key",
        // The decisive fact: this is a bearer token pasted by hand. Nothing refreshes it.
        autoRefreshable: false,
        rules: [
          {
            condition: "The token was copied from the Meta app dashboard for testing",
            certainty: "conditional",
            window: "under 24 hours",
            detail: "Temporary access tokens expire in less than a day. Anyone who set this up while testing and never went back has a workflow that died the next morning.",
            howToCheck: 'If the token came from the "Temporary access token" box on the app dashboard, it is already gone. Only a System User token survives.'
          },
          {
            condition: "A System User token was generated with a 60-day expiry",
            certainty: "conditional",
            window: "60 days",
            detail: "Meta lets you pick the expiry when generating a System User token. 60 days is the common choice and there is no warning before it lapses.",
            howToCheck: "Meta Business Settings -> Users -> System Users -> your user -> the token list shows the expiry you chose."
          },
          {
            condition: "A System User token was generated with no expiry",
            certainty: "conditional",
            window: "never",
            detail: "Permanent until someone revokes it manually."
          }
        ],
        sources: [
          "https://developers.facebook.com/blog/post/2022/12/05/auth-tokens/",
          "https://community.n8n.io/t/whatsapp-token-expires/182022"
        ],
        complaintLogRows: [13]
      }
    ];
    exports.STATIC_KEY_HINTS = [
      "apikey",
      "api",
      "token",
      "httpheaderauth",
      "httpbasicauth",
      "httpqueryauth",
      "smtp",
      "postgres",
      "mysql",
      "redis",
      "mongodb"
    ];
    function resolveProvider(rawType, platform) {
      const needle = rawType.toLowerCase();
      for (const p of exports.PROVIDERS) {
        for (const m of p.match[platform]) {
          if (needle.includes(m))
            return p;
        }
      }
      return null;
    }
    function guessAuthKind(rawType) {
      const t = rawType.toLowerCase();
      if (t.includes("oauth2") || t.includes("oauth"))
        return "oauth2";
      if (t.includes("basicauth"))
        return "basic";
      if (t.includes("serviceaccount") || t === "googleapi")
        return "service-account";
      if (exports.STATIC_KEY_HINTS.some((h) => t.includes(h)))
        return "api-key";
      return "unknown";
    }
  }
});

// node_modules/@still-running/health-check/dist/core/checks/others.js
var require_others = __commonJS({
  "node_modules/@still-running/health-check/dist/core/checks/others.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.checkCredentialExpiry = checkCredentialExpiry;
    exports.checkCadence = checkCadence;
    exports.checkErrorHandling = checkErrorHandling;
    var providers_js_1 = require_providers();
    function checkCredentialExpiry(wf) {
      var _a, _b;
      const findings = [];
      const seen = /* @__PURE__ */ new Set();
      for (const node of wf.nodes) {
        if (node.disabled)
          continue;
        for (const cred of node.credentials) {
          const provider = cred.providerId ? providers_js_1.PROVIDERS.find((p) => p.id === cred.providerId) : (0, providers_js_1.resolveProvider)(cred.rawType, wf.platform);
          const key = provider ? provider.id : cred.rawType;
          if (seen.has(key))
            continue;
          if (provider) {
            seen.add(key);
            const conditional = provider.rules.filter((r) => r.certainty === "conditional");
            const shortest = provider.rules[0];
            const severity = !provider.autoRefreshable ? "high" : conditional.length > 0 ? "medium" : "low";
            findings.push({
              checkId: "credential-expiry",
              severity,
              nodeId: node.id,
              nodeLabel: node.label,
              title: `${provider.displayName} connection on "${node.label}" \u2014 expiry depends on how it was set up`,
              ifItGoesQuiet: provider.autoRefreshable ? `The token stops refreshing, the trigger stops firing, and there is no failed run to see \u2014 because there is no run at all.` : `Nothing on ${provider.displayName} refreshes this automatically. When it lapses, someone has to paste in a new token by hand, and until they do the workflow is silent.`,
              detail: [
                `We cannot read the expiry from a pasted workflow \u2014 the export names the connection, not the settings behind it. Here is what it depends on:`,
                ...provider.rules.map((r) => `- ${r.condition}: ${r.window}. ${r.detail}`)
              ].join("\n"),
              howToCheck: ((_b = shortest == null ? void 0 : shortest.howToCheck) != null ? _b : (_a = conditional[0]) == null ? void 0 : _a.howToCheck) || void 0,
              sources: provider.sources
            });
          } else if (cred.authKind === "oauth2") {
            seen.add(key);
            findings.push({
              checkId: "credential-expiry",
              severity: "low",
              nodeId: node.id,
              nodeLabel: node.label,
              title: `"${node.label}" uses an OAuth connection we do not have expiry data for yet`,
              ifItGoesQuiet: "If this provider expires refresh tokens on a schedule, the trigger stops and no error is raised.",
              detail: `Connection type: ${cred.rawType}. Not in our provider table yet.`
            });
          }
        }
      }
      return findings;
    }
    function checkCadence(wf) {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
      if (wf.cadence.expectedIntervalKnown)
        return [];
      const triggers = wf.nodes.filter((n) => wf.triggerIds.includes(n.id) && !n.disabled);
      if (triggers.length === 0 || wf.cadence.kind === "unknown") {
        return [
          {
            checkId: "no-cadence",
            severity: "info",
            nodeId: null,
            nodeLabel: null,
            title: "No trigger in this file",
            ifItGoesQuiet: "Nothing to say yet \u2014 without a trigger there is no expected rhythm to measure against.",
            detail: "This is either a fragment, or a sub-workflow called by another one. Paste the workflow that calls it to see how often this is meant to run."
          }
        ];
      }
      const label = (_b = (_a = triggers[0]) == null ? void 0 : _a.label) != null ? _b : "the trigger";
      if (wf.cadence.kind === "manual") {
        return [
          {
            checkId: "no-cadence",
            severity: "low",
            nodeId: (_d = (_c = triggers[0]) == null ? void 0 : _c.id) != null ? _d : null,
            nodeLabel: (_f = (_e = triggers[0]) == null ? void 0 : _e.label) != null ? _f : null,
            title: "This workflow only runs when somebody presses the button",
            ifItGoesQuiet: "Nothing to detect \u2014 a manual workflow that never runs is not broken.",
            detail: "Nothing to monitor here until it gets a schedule or a webhook."
          }
        ];
      }
      return [
        {
          checkId: "no-cadence",
          severity: wf.cadence.kind === "event" ? "high" : "medium",
          nodeId: (_h = (_g = triggers[0]) == null ? void 0 : _g.id) != null ? _h : null,
          nodeLabel: (_j = (_i = triggers[0]) == null ? void 0 : _i.label) != null ? _j : null,
          title: `Nothing here says how often "${label}" should fire`,
          ifItGoesQuiet: 'There is no expected rhythm to compare against, so an idle workflow and a dead workflow look identical. Nobody can tell you it stopped, because nobody knows what "running normally" looks like.',
          detail: wf.cadence.kind === "event" ? `This fires on an outside event (${wf.cadence.description}). If the source stops sending \u2014 a renamed field, a revoked webhook, a client who turned something off \u2014 the workflow simply never runs. There is no failed execution, because there is no execution.` : `Trigger type: ${wf.cadence.description}. Without an expected interval there is no baseline.`,
          howToCheck: "Write down the number you would expect on a normal day: runs per day, or rows per run. That single number is what turns silence into an alert."
        }
      ];
    }
    function checkErrorHandling(wf) {
      const findings = [];
      const live = wf.nodes.filter((n) => !n.disabled && n.role !== "note");
      const unhandled = live.filter((n) => (n.role === "write" || n.role === "read" || n.platformType.includes("httpRequest")) && !n.errorHandling.hasErrorBranch && !n.errorHandling.retries);
      if (!wf.errorPolicy.workflowLevelHandler) {
        findings.push({
          checkId: "error-handling",
          severity: "medium",
          nodeId: null,
          nodeLabel: null,
          title: "No workflow-level error handler is set",
          ifItGoesQuiet: "A step that throws stops the run. Somebody has to be watching the execution list to find out.",
          detail: wf.platform === "n8n" ? 'This is a different miss from "a node has no error branch", and easier to overlook, because the canvas looks fine. It lives in workflow Settings -> Error Workflow.' : "No error route on the scenario. Make will retry per its own settings and then stop."
        });
      }
      if (wf.errorPolicy.storesFailedRuns === false) {
        findings.push({
          checkId: "error-handling",
          severity: "high",
          nodeId: null,
          nodeLabel: null,
          title: "Incomplete executions are switched off",
          ifItGoesQuiet: "A run that fails part-way is not stored, so there is nothing to resume and nothing to inspect afterwards. The data that run was carrying is gone.",
          detail: "Make stores failed runs only when this is on, and it is off by default. Scenario settings -> Allow storing of Incomplete Executions."
        });
      }
      if (unhandled.length > 0) {
        const names = unhandled.slice(0, 4).map((n) => `"${n.label}"`).join(", ");
        findings.push({
          checkId: "error-handling",
          severity: "low",
          nodeId: unhandled[0].id,
          nodeLabel: unhandled[0].label,
          title: `${unhandled.length} step${unhandled.length === 1 ? "" : "s"} with no retry and no error branch`,
          ifItGoesQuiet: "These throw on a bad day and the run stops where it stands, part-done.",
          detail: `${names}${unhandled.length > 4 ? `, and ${unhandled.length - 4} more` : ""}. This is the check every free auditor already does \u2014 it is here for completeness, not because it is the interesting part.`
        });
      }
      return findings;
    }
  }
});

// node_modules/@still-running/health-check/dist/core/checks/protections.js
var require_protections = __commonJS({
  "node_modules/@still-running/health-check/dist/core/checks/protections.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.checkProtections = checkProtections;
    var zero_write_js_1 = require_zero_write();
    function checkProtections(wf) {
      var _a;
      const out = [];
      const byId = new Map(wf.nodes.map((n) => [n.id, n]));
      if (wf.cadence.expectedIntervalKnown) {
        out.push({
          kind: "known-cadence",
          nodeId: null,
          nodeLabel: null,
          title: `Runs ${wf.cadence.description}`,
          detail: "There is a stated rhythm here, so a missed run is measurable. Most of the workflows we see have no declared cadence at all, which is why nobody can tell idle from dead."
        });
      }
      if (wf.errorPolicy.workflowLevelHandler) {
        out.push({
          kind: "error-handler",
          nodeId: null,
          nodeLabel: null,
          title: "A workflow-level error handler is set",
          detail: wf.platform === "n8n" ? "Anything that throws reaches your error workflow rather than sitting in the execution list waiting to be noticed." : "The scenario has an error route, so a failure goes somewhere instead of just stopping."
        });
      }
      if (wf.errorPolicy.storesFailedRuns === true) {
        out.push({
          kind: "stores-failed-runs",
          nodeId: null,
          nodeLabel: null,
          title: "Incomplete executions are switched on",
          detail: "Make keeps failed runs so you can look at them and resume them. This is off by default, so somebody turned it on deliberately."
        });
      }
      const alertIds = (0, zero_write_js_1.findAlertNodes)(wf);
      const dom = (0, zero_write_js_1.computeDominators)(wf);
      const writes = wf.nodes.filter((n) => n.role === "write" && !n.disabled && !alertIds.has(n.id));
      for (const w of writes) {
        const dominators = (_a = dom.get(w.id)) != null ? _a : /* @__PURE__ */ new Set();
        const gates = [...dominators].filter((d) => d !== w.id).map((d) => byId.get(d)).filter((n) => !!n && !!n.zeroEmit);
        if (gates.length === 0)
          continue;
        if (!gates.every((g) => (0, zero_write_js_1.isGuarded)(wf, g.id)))
          continue;
        out.push({
          kind: "guarded-write",
          nodeId: w.id,
          nodeLabel: w.label,
          title: `"${w.label}" is covered if it gets nothing`,
          detail: `Every step that could starve it \u2014 ${gates.slice(0, 2).map((g) => `"${g.label}"`).join(", ")} \u2014 has somewhere else to send the empty case. The quiet run does not vanish.`
        });
      }
      if (alertIds.size > 0) {
        const names = [...alertIds].map((id) => {
          var _a2;
          return (_a2 = byId.get(id)) == null ? void 0 : _a2.label;
        }).filter(Boolean).slice(0, 2);
        if (names.length) {
          out.push({
            kind: "alert-branch",
            nodeId: null,
            nodeLabel: null,
            title: `Somebody gets told: ${names.map((n) => `"${n}"`).join(", ")}`,
            detail: "There is a message on a branch that only runs when something goes the wrong way. That is the difference between a quiet failure and a known one."
          });
        }
      }
      const retried = wf.nodes.filter((n) => n.errorHandling.retries && !n.disabled);
      if (retried.length > 0) {
        out.push({
          kind: "retries",
          nodeId: retried[0].id,
          nodeLabel: retried[0].label,
          title: `${retried.length} step${retried.length === 1 ? "" : "s"} retry before giving up`,
          detail: "A blip on someone else's API does not end the run."
        });
      }
      return out;
    }
  }
});

// node_modules/@still-running/health-check/dist/adapters/n8n.js
var require_n8n = __commonJS({
  "node_modules/@still-running/health-check/dist/adapters/n8n.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isN8nWorkflow = isN8nWorkflow;
    exports.parseN8n = parseN8n;
    var providers_js_1 = require_providers();
    var TRIGGER_HINTS = [
      "trigger",
      "webhook",
      "cron",
      "interval",
      "formtrigger",
      "chattrigger",
      "localfiletrigger"
    ];
    var WRITE_OPS = {
      googleSheets: { append: "append", update: "update", appendOrUpdate: "upsert", delete: "delete" },
      airtable: { create: "create", update: "update", upsert: "upsert", append: "append", deleteRecord: "delete" },
      notion: { create: "create", update: "update", append: "append" },
      supabase: { create: "create", update: "update", upsert: "upsert" },
      mongoDb: { insert: "create", update: "update", upsert: "upsert" },
      redis: { set: "update" },
      telegram: "send",
      slack: "send",
      gmail: { send: "send", reply: "send", sendAndWait: "send" },
      emailSend: "send",
      whatsApp: "send",
      discord: "send",
      twilio: "send",
      hubspot: { create: "create", upsert: "upsert", update: "update" },
      pipedrive: { create: "create", update: "update" },
      salesforce: { create: "create", upsert: "upsert", update: "update" },
      wordpress: { create: "create", update: "update" },
      googleDrive: { upload: "create", createFromText: "create", copy: "create" },
      readWriteFile: { write: "create" },
      googleCalendar: { create: "create", update: "update" },
      clickUp: { create: "create", update: "update" },
      trello: { create: "create", update: "update" },
      monday: { create: "create", update: "update" },
      jira: { create: "create", update: "update" },
      baserow: { create: "create", update: "update" },
      nocoDb: { create: "create", update: "update" }
    };
    var WRITE_TARGETS = {
      googleSheets: "Google Sheets",
      airtable: "Airtable",
      notion: "Notion",
      supabase: "Supabase",
      mongoDb: "MongoDB",
      postgres: "Postgres",
      mySql: "MySQL",
      hubspot: "HubSpot",
      salesforce: "Salesforce",
      slack: "Slack",
      telegram: "Telegram",
      gmail: "Gmail",
      whatsApp: "WhatsApp"
    };
    var STRUCTURAL_GATES = {
      filter: "The filter can match nothing.",
      if: "The condition can be false for every item.",
      switch: "Every item can fall through without matching a branch.",
      removeDuplicates: "Everything can be a duplicate of a previous run, leaving nothing new.",
      limit: "The limit can resolve to zero items.",
      splitOut: "The field being split can be an empty list.",
      splitInBatches: "The list being looped over can be empty, so the loop body never runs.",
      compareDatasets: "The comparison can find nothing on either side."
    };
    var EMPTY_READS = {
      googleSheets: ["read", "getAll", "lookup"],
      airtable: ["search", "list", "getAll"],
      notion: ["getAll", "search"],
      gmail: ["getAll", "get"],
      postgres: ["executeQuery", "select"],
      mySql: ["executeQuery", "select"],
      mongoDb: ["find"],
      hubspot: ["getAll", "search"],
      googleCalendar: ["getAll"],
      googleDrive: ["list", "search"],
      rssFeedRead: ["*"],
      supabase: ["getAll", "get"]
    };
    function shortType(type) {
      var _a;
      return (_a = type.split(".").pop()) != null ? _a : type;
    }
    function classify(node) {
      var _a, _b, _c, _d, _e, _f;
      const type = (_a = node.type) != null ? _a : "";
      const st = shortType(type);
      const lower = type.toLowerCase();
      const params = (_b = node.parameters) != null ? _b : {};
      const op = typeof params.operation === "string" ? params.operation : void 0;
      if (st === "stickyNote")
        return { role: "note", zeroEmit: null };
      if (TRIGGER_HINTS.some((h) => lower.includes(h)))
        return { role: "trigger", zeroEmit: null };
      if (st === "stopAndError")
        return { role: "error-handler", zeroEmit: null };
      if (STRUCTURAL_GATES[st]) {
        return { role: "gate", zeroEmit: { cause: STRUCTURAL_GATES[st], certainty: "structural" } };
      }
      const writeSpec = WRITE_OPS[st];
      if (writeSpec) {
        if (typeof writeSpec === "string") {
          return { role: "write", writeKind: writeSpec, writeTarget: (_c = WRITE_TARGETS[st]) != null ? _c : st, zeroEmit: null };
        }
        if (op && writeSpec[op]) {
          return { role: "write", writeKind: writeSpec[op], writeTarget: (_d = WRITE_TARGETS[st]) != null ? _d : st, zeroEmit: null };
        }
      }
      if (st === "postgres" || st === "mySql") {
        const q = String((_e = params.query) != null ? _e : "").trim().toLowerCase();
        if (/^(insert|update|upsert|merge|delete)/.test(q)) {
          return { role: "write", writeKind: "create", writeTarget: WRITE_TARGETS[st], zeroEmit: null };
        }
        if (/^(select|with)/.test(q) || !q) {
          return { role: "read", zeroEmit: { cause: "The query can return no rows.", certainty: "structural" } };
        }
      }
      if (st === "httpRequest") {
        const method = String((_f = params.method) != null ? _f : "GET").toUpperCase();
        if (["POST", "PUT", "PATCH"].includes(method)) {
          return { role: "write", writeKind: "send", writeTarget: "an API", zeroEmit: null };
        }
        return {
          role: "read",
          zeroEmit: { cause: "The request can come back with an empty list.", certainty: "possible" }
        };
      }
      const empties = EMPTY_READS[st];
      if (empties && (empties.includes("*") || op && empties.includes(op))) {
        return {
          role: "read",
          zeroEmit: { cause: `"${node.name}" can find no matching records.`, certainty: "structural" }
        };
      }
      if (st === "code" || st === "function" || st === "functionItem") {
        return {
          role: "transform",
          zeroEmit: { cause: "The code step can return an empty list.", certainty: "possible" }
        };
      }
      return { role: "other", zeroEmit: null };
    }
    function readCadence(nodes) {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
      for (const n of nodes) {
        const st = shortType((_a = n.type) != null ? _a : "");
        const p = (_b = n.parameters) != null ? _b : {};
        if (st === "scheduleTrigger") {
          const rule = (_d = (_c = p.rule) == null ? void 0 : _c.interval) == null ? void 0 : _d[0];
          if (rule) {
            const field = (_e = rule.field) != null ? _e : "unknown";
            const every = (_h = (_g = (_f = rule.minutesInterval) != null ? _f : rule.hoursInterval) != null ? _g : rule.daysInterval) != null ? _h : 1;
            const secs = { minutes: 60, hours: 3600, days: 86400, weeks: 604800 };
            const unit = String(field).replace(/s$/, "");
            const phrase = Number(every) === 1 ? `every ${unit}` : `every ${every} ${unit}s`;
            return {
              kind: "schedule",
              description: phrase,
              intervalSeconds: ((_i = secs[field]) != null ? _i : 0) * Number(every) || null,
              expectedIntervalKnown: true
            };
          }
          return { kind: "schedule", description: "a schedule with no interval set", intervalSeconds: null, expectedIntervalKnown: false };
        }
        if (st === "cron") {
          return { kind: "schedule", description: "a cron expression", intervalSeconds: null, expectedIntervalKnown: true };
        }
        if (st === "intervalTrigger") {
          return { kind: "schedule", description: "a fixed interval", intervalSeconds: null, expectedIntervalKnown: true };
        }
      }
      for (const n of nodes) {
        const lower = String((_j = n.type) != null ? _j : "").toLowerCase();
        if (lower.includes("manualtrigger")) {
          return { kind: "manual", description: "the Execute Workflow button", intervalSeconds: null, expectedIntervalKnown: false };
        }
        if (lower.includes("webhook") || lower.includes("formtrigger") || lower.includes("chattrigger")) {
          return { kind: "event", description: "an incoming call from outside", intervalSeconds: null, expectedIntervalKnown: false };
        }
        if (lower.includes("trigger")) {
          return { kind: "event", description: `the ${shortType(n.type)} event`, intervalSeconds: null, expectedIntervalKnown: false };
        }
      }
      return { kind: "unknown", description: "no trigger found", intervalSeconds: null, expectedIntervalKnown: false };
    }
    function isN8nWorkflow(raw) {
      return !!raw && typeof raw === "object" && Array.isArray(raw.nodes) && typeof raw.connections === "object";
    }
    function parseN8n(raw) {
      var _a, _b, _c, _d;
      const rawNodes = (_a = raw.nodes) != null ? _a : [];
      const parseNotes = [];
      const nodes = rawNodes.map((n) => {
        var _a2, _b2, _c2, _d2, _e;
        const c = classify(n);
        const credentials = Object.entries((_a2 = n.credentials) != null ? _a2 : {}).map(([rawType, val]) => {
          var _a3, _b3;
          return {
            rawType,
            providerId: (_b3 = (_a3 = (0, providers_js_1.resolveProvider)(rawType, "n8n")) == null ? void 0 : _a3.id) != null ? _b3 : null,
            authKind: (0, providers_js_1.guessAuthKind)(rawType),
            label: typeof (val == null ? void 0 : val.name) === "string" ? val.name : void 0
          };
        });
        return {
          id: String((_b2 = n.id) != null ? _b2 : n.name),
          label: String((_d2 = (_c2 = n.name) != null ? _c2 : n.id) != null ? _d2 : "unnamed step"),
          platformType: String((_e = n.type) != null ? _e : ""),
          role: c.role,
          writeKind: c.writeKind,
          writeTarget: c.writeTarget,
          zeroEmit: c.zeroEmit,
          credentials,
          errorHandling: {
            hasErrorBranch: n.onError === "continueErrorOutput",
            retries: n.retryOnFail === true,
            continueOnFail: n.continueOnFail === true || n.onError === "continueRegularOutput",
            alwaysOutputData: n.alwaysOutputData === true
          },
          disabled: n.disabled === true
        };
      });
      const idByName = new Map(rawNodes.map((n) => {
        var _a2;
        return [String(n.name), String((_a2 = n.id) != null ? _a2 : n.name)];
      }));
      const edges = [];
      for (const [sourceName, outputs] of Object.entries((_b = raw.connections) != null ? _b : {})) {
        const from = idByName.get(sourceName);
        if (!from)
          continue;
        for (const [channel, groups] of Object.entries(outputs != null ? outputs : {})) {
          (groups != null ? groups : []).forEach((group, outputIndex) => {
            (group != null ? group : []).forEach((conn) => {
              var _a2;
              const to = idByName.get(String(conn == null ? void 0 : conn.node));
              if (!to)
                return;
              const sourceNode = rawNodes.find((n) => String(n.name) === sourceName);
              const isIf = shortType((_a2 = sourceNode == null ? void 0 : sourceNode.type) != null ? _a2 : "") === "if";
              edges.push({
                from,
                to,
                channel: channel === "main" && isIf ? outputIndex === 0 ? "true" : "false" : channel,
                gate: null
              });
            });
          });
        }
      }
      const triggerIds = nodes.filter((n) => n.role === "trigger").map((n) => n.id);
      const hasErrorTrigger = rawNodes.some((n) => {
        var _a2;
        return shortType((_a2 = n.type) != null ? _a2 : "") === "errorTrigger";
      });
      const settings = (_c = raw.settings) != null ? _c : {};
      if (!raw.id && !raw.versionId) {
        parseNotes.push("This looks like a template export rather than a live workflow export.");
      }
      return {
        platform: "n8n",
        name: String((_d = raw.name) != null ? _d : "Untitled workflow"),
        nodes,
        edges,
        triggerIds,
        cadence: readCadence(rawNodes),
        errorPolicy: {
          workflowLevelHandler: Boolean(settings.errorWorkflow) || hasErrorTrigger,
          storesFailedRuns: null,
          maxErrors: null,
          notes: []
        },
        parseNotes
      };
    }
  }
});

// node_modules/@still-running/health-check/dist/adapters/make.js
var require_make = __commonJS({
  "node_modules/@still-running/health-check/dist/adapters/make.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isMakeBlueprint = isMakeBlueprint;
    exports.parseMake = parseMake;
    var providers_js_1 = require_providers();
    var WRITE_VERBS = [
      [/:add(row|record|item)?/i, "append"],
      [/:create/i, "create"],
      [/:update/i, "update"],
      [/:upsert|:addupdate/i, "upsert"],
      [/:delete|:remove/i, "delete"],
      [/:send|:createmessage|:createatweet|:createpost|:post/i, "send"],
      [/:uploadfile|:upload/i, "create"]
    ];
    var EMPTY_READ = /:(search|list|get[a-z]*|retrieve|watch[a-z]*|iterate)/i;
    function moduleApp(module2) {
      var _a;
      return ((_a = module2.split(":")[0]) != null ? _a : module2).replace(/-/g, " ");
    }
    function prettyLabel(module2) {
      const [app, action] = module2.split(":");
      if (!action)
        return module2;
      const words = action.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
      return `${words} (${(app != null ? app : "").replace(/-/g, " ")})`;
    }
    function classify(m) {
      var _a;
      const module2 = String((_a = m.module) != null ? _a : "");
      const lower = module2.toLowerCase();
      if (/^builtin:basicrouter/i.test(module2)) {
        return {
          role: "gate",
          zeroEmit: { cause: "Every route out of this router can filter everything out.", certainty: "possible" }
        };
      }
      if (/^builtin:basicifelse/i.test(module2)) {
        return { role: "gate", zeroEmit: { cause: "The condition can be false for every bundle.", certainty: "structural" } };
      }
      if (/^builtin:basicfeeder|:iterate/i.test(module2)) {
        return { role: "loop", zeroEmit: { cause: "The array being iterated can be empty, so nothing downstream runs.", certainty: "structural" } };
      }
      if (/^builtin:basicaggregator|:aggregate/i.test(module2))
        return { role: "transform", zeroEmit: null };
      if (/^[a-z0-9-]+:watch/i.test(module2) || /gateway:customwebhook/i.test(module2)) {
        return { role: "trigger", zeroEmit: null };
      }
      for (const [re, kind] of WRITE_VERBS) {
        if (re.test(lower)) {
          return { role: "write", writeKind: kind, writeTarget: moduleApp(module2), zeroEmit: null };
        }
      }
      if (EMPTY_READ.test(lower)) {
        return {
          role: "read",
          zeroEmit: { cause: `The ${moduleApp(module2)} search can return no bundles.`, certainty: "structural" }
        };
      }
      return { role: "other", zeroEmit: null };
    }
    function readConnections(m) {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
      const out = [];
      const restore = (_c = (_b = (_a = m == null ? void 0 : m.metadata) == null ? void 0 : _a.restore) == null ? void 0 : _b.parameters) == null ? void 0 : _c.__IMTCONN__;
      if (restore) {
        const slug = (_d = restore == null ? void 0 : restore.data) == null ? void 0 : _d.connection;
        const rawType = slug ? `account:${slug}` : "account:unknown";
        out.push({
          rawType,
          providerId: (_f = (_e = (0, providers_js_1.resolveProvider)(rawType, "make")) == null ? void 0 : _e.id) != null ? _f : null,
          authKind: (0, providers_js_1.guessAuthKind)(rawType),
          label: typeof restore.label === "string" ? restore.label : void 0
        });
      }
      for (const p of (_h = (_g = m == null ? void 0 : m.metadata) == null ? void 0 : _g.parameters) != null ? _h : []) {
        if ((p == null ? void 0 : p.name) === "__IMTCONN__" && typeof p.type === "string") {
          if (out.some((c) => c.rawType === p.type))
            continue;
          out.push({
            rawType: p.type,
            providerId: (_j = (_i = (0, providers_js_1.resolveProvider)(p.type, "make")) == null ? void 0 : _i.id) != null ? _j : null,
            authKind: (0, providers_js_1.guessAuthKind)(p.type)
          });
        }
      }
      return out;
    }
    function flatten(flow, prevId, acc, channel = "main") {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n;
      let last = prevId;
      for (const m of flow != null ? flow : []) {
        const id = String((_a = m.id) != null ? _a : `${acc.nodes.length}`);
        const c = classify(m);
        const label = ((_c = (_b = m == null ? void 0 : m.metadata) == null ? void 0 : _b.designer) == null ? void 0 : _c.name) || prettyLabel(String((_d = m.module) != null ? _d : id));
        acc.nodes.push({
          id,
          label,
          platformType: String((_e = m.module) != null ? _e : ""),
          role: c.role,
          writeKind: c.writeKind,
          writeTarget: c.writeTarget,
          zeroEmit: c.zeroEmit,
          credentials: readConnections(m),
          errorHandling: {
            hasErrorBranch: Array.isArray(m.onerror) && m.onerror.length > 0,
            retries: false,
            continueOnFail: false,
            alwaysOutputData: false
          },
          disabled: m.disabled === true
        });
        if (last) {
          acc.edges.push({
            from: last,
            to: id,
            channel,
            gate: m.filter ? {
              label: String((_f = m.filter.name) != null ? _f : "filter"),
              cause: `The filter "${(_g = m.filter.name) != null ? _g : "unnamed"}" can match nothing.`
            } : null
          });
          channel = "main";
        }
        for (const route of (_h = m.routes) != null ? _h : []) {
          flatten((_i = route.flow) != null ? _i : [], id, acc, "route");
        }
        for (const branch of (_j = m.branches) != null ? _j : []) {
          flatten((_k = branch.flow) != null ? _k : [], id, acc, branch.type === "else" ? "else" : "branch");
        }
        for (const handler of (_l = m.onerror) != null ? _l : []) {
          const hFlow = Array.isArray(handler == null ? void 0 : handler.flow) ? handler.flow : [handler];
          flatten(hFlow, id, acc, "error");
        }
        if (((_m = m.routes) != null ? _m : []).length || ((_n = m.branches) != null ? _n : []).length)
          last = null;
        else
          last = id;
      }
      return last;
    }
    function isMakeBlueprint(raw) {
      if (!raw || typeof raw !== "object")
        return false;
      if (Array.isArray(raw.flow))
        return true;
      if (raw.blueprint && Array.isArray(raw.blueprint.flow))
        return true;
      return false;
    }
    function parseMake(raw) {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i;
      const bp = (_a = raw.blueprint) != null ? _a : raw;
      const parseNotes = [];
      const acc = { nodes: [], edges: [] };
      flatten((_b = bp.flow) != null ? _b : [], null, acc);
      const scenarioMeta = (_d = (_c = bp == null ? void 0 : bp.metadata) == null ? void 0 : _c.scenario) != null ? _d : {};
      const scheduling = (_f = (_e = raw.scheduling) != null ? _e : bp.scheduling) != null ? _f : null;
      let cadence;
      if (scheduling && typeof scheduling.interval === "number") {
        cadence = {
          kind: "schedule",
          description: scheduling.interval >= 3600 ? `every ${Math.round(scheduling.interval / 3600)} hour${scheduling.interval >= 7200 ? "s" : ""}` : `every ${Math.round(scheduling.interval / 60)} minute${scheduling.interval >= 120 ? "s" : ""}`,
          intervalSeconds: scheduling.interval,
          expectedIntervalKnown: true
        };
      } else if (((_g = bp == null ? void 0 : bp.metadata) == null ? void 0 : _g.instant) === true) {
        cadence = { kind: "event", description: "an instant trigger (webhook)", intervalSeconds: null, expectedIntervalKnown: false };
      } else {
        cadence = { kind: "unknown", description: "no scheduling in this export", intervalSeconds: null, expectedIntervalKnown: false };
        parseNotes.push("This blueprint carries no scheduling block. Blueprints fetched from the Make API contain the flow only \u2014 the schedule lives on the scenario. Export from the scenario menu to include it.");
      }
      const withConnections = acc.nodes.filter((n) => n.credentials.length > 0).length;
      if (acc.nodes.length > 0 && withConnections === 0) {
        parseNotes.push("No connection data in this blueprint, so the credential check found nothing to look at. Published templates have connections stripped out; your own scenario export will have them.");
      }
      const triggerIds = acc.nodes.filter((n) => n.role === "trigger").map((n) => n.id);
      if (triggerIds.length === 0 && acc.nodes.length > 0)
        triggerIds.push(acc.nodes[0].id);
      return {
        platform: "make",
        name: String((_i = (_h = raw.name) != null ? _h : bp.name) != null ? _i : "Untitled scenario"),
        nodes: acc.nodes,
        edges: acc.edges,
        triggerIds,
        cadence,
        errorPolicy: {
          workflowLevelHandler: acc.nodes.some((n) => n.errorHandling.hasErrorBranch),
          storesFailedRuns: typeof scenarioMeta.dlq === "boolean" ? scenarioMeta.dlq : null,
          maxErrors: typeof scenarioMeta.maxErrors === "number" ? scenarioMeta.maxErrors : null,
          notes: []
        },
        parseNotes
      };
    }
  }
});

// node_modules/@still-running/health-check/dist/index.js
var require_index = __commonJS({
  "node_modules/@still-running/health-check/dist/index.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SCHEMA_VERSION = void 0;
    exports.analyze = analyze;
    var model_js_1 = require_model();
    var zero_write_js_1 = require_zero_write();
    var others_js_1 = require_others();
    var protections_js_1 = require_protections();
    var n8n_js_1 = require_n8n();
    var make_js_1 = require_make();
    exports.SCHEMA_VERSION = 1;
    var UnknownFormatError = class extends Error {
      constructor() {
        super('That does not look like an n8n workflow or a Make blueprint. Export from n8n with "Download" or from Make with "Export Blueprint", then paste the whole file.');
        this.name = "UnknownFormatError";
      }
    };
    function parseWorkflow(input) {
      const raw = typeof input === "string" ? JSON.parse(input) : input;
      if ((0, n8n_js_1.isN8nWorkflow)(raw))
        return (0, n8n_js_1.parseN8n)(raw);
      if ((0, make_js_1.isMakeBlueprint)(raw))
        return (0, make_js_1.parseMake)(raw);
      throw new UnknownFormatError();
    }
    var CHECKS = [
      zero_write_js_1.checkZeroWrite,
      others_js_1.checkCredentialExpiry,
      others_js_1.checkCadence,
      others_js_1.checkErrorHandling
    ];
    function analyze(input) {
      const wf = parseWorkflow(input);
      const findings = CHECKS.flatMap((c) => c(wf)).sort((a, b) => model_js_1.SEVERITY_ORDER[a.severity] - model_js_1.SEVERITY_ORDER[b.severity]);
      return {
        platform: wf.platform,
        workflowName: wf.name,
        nodeCount: wf.nodes.filter((n) => n.role !== "note" && !n.disabled).length,
        findings,
        protections: (0, protections_js_1.checkProtections)(wf),
        parseNotes: wf.parseNotes,
        schemaVersion: exports.SCHEMA_VERSION,
        stats: {
          writeNodes: wf.nodes.filter((n) => n.role === "write" && !n.disabled).length,
          oauthCredentials: wf.nodes.flatMap((n) => n.credentials).filter((c) => c.authKind === "oauth2").length,
          triggers: wf.triggerIds.length,
          staticKeyCredentials: wf.nodes.flatMap((n) => n.credentials).filter((c) => c.authKind === "api-key" || c.authKind === "basic").length
        }
      };
    }
  }
});
export default require_index();

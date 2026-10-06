# n8n-nodes-stillrunning-dev

This is an n8n community node. It lets you use [stillrunning.dev](https://stillrunning.dev) in your n8n workflows.

stillrunning.dev is a third-party service that checks an n8n or Make workflow export for silent-failure risks — steps that can finish "successful" while quietly doing nothing — and can receive run outcomes and answer status checks for workflows you monitor there.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

[Installation](#installation)
[Operations](#operations)
[Credentials](#credentials)
[Compatibility](#compatibility)
[Usage](#usage)
[Resources](#resources)
[Version history](#version-history)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Operations

### Analyse Workflow

Checks a workflow export for silent-failure risks and returns the findings.

- **Workflow JSON** — paste or pass in a workflow (or Make blueprint) export. To analyse a workflow on this n8n instance, see [Usage](#usage).
- Runs **locally**, with nothing sent over the network, when no Still Running API credential is attached to the node — this is the only operation that works with zero setup.
- Runs **via stillrunning.dev** when a credential is attached, using the same analysis engine.

The response always includes a `mode` field (`local` or `remote`) so you can tell which path ran. Both return the same `findings` and `schemaVersion`. Local mode also returns the rest of the engine's result (`protections`, `stats`, `parseNotes` and so on); remote mode returns only those two, plus `skippedReason`, which is set when stillrunning.dev couldn't run the analysis and `findings` is `null`.

### Report Heartbeat

Posts one run's outcome to stillrunning.dev — status, timestamps, and an optional error message. Defaults to reporting on the workflow and execution it's running in, but every field can be overridden to report on behalf of another workflow. Requires a Still Running API credential.

Under **Additional Fields**, **Items Processed** reports how many items the run wrote. That count is what the zero-write alert learns from: a successful run that writes 0 when it usually writes more is flagged. Point it at your write step, for example `{{ $('Append Row').isExecuted ? $('Append Row').all().length : 0 }}`. Two things to know:

- n8n doesn't run a node that receives no items. To report a 0, put the heartbeat where it still runs when the write step gets nothing, such as its own branch off the trigger, placed below the main branch (n8n runs branches top to bottom, so the write step has finished by then).
- Leave it out if stillrunning.dev also has an n8n API connection to this instance. It then counts each run's written items from the execution itself, and a count you send replaces that one.

### Get Workflow Health

Fetches a monitored workflow's current status from stillrunning.dev by its (n8n or Make) workflow id. Requires a Still Running API credential.

## Credentials

### Still Running API

The node's one credential: Report Heartbeat and Get Workflow Health need it, and Analyse Workflow uses it to run via stillrunning.dev. [Sign up at stillrunning.dev](https://stillrunning.dev), then generate a workspace API key from your account settings and paste it in. Not needed for "Analyse Workflow" run without one (local mode).

Fields:
- **API Key** — a workspace API key from stillrunning.dev.
- **Base URL** — defaults to `https://api.stillrunning.dev/api/v1`; only change it for a self-hosted or staging instance.

#### Getting an API key

In the stillrunning.dev dashboard, go to **Settings → API keys** to generate a workspace API key. "Analyse Workflow" needs no key at all — it runs locally unless a credential is attached.

## Compatibility

Tested against n8n <VERSION> on <DATE>, with `n8nNodesApiVersion: 1`. No known version-specific incompatibilities.

## Usage

"Analyse Workflow" is the operation to try first — it needs no stillrunning.dev account at all. Paste in an exported workflow (n8n: **Download** from the workflow menu; Make: **Export Blueprint**) and run it.

To analyse a workflow on this n8n instance without exporting it, fetch it first with n8n's own **n8n** node: **Workflow → Get**, with n8n's built-in "n8n API" credential and the workflow's id. Then set "Analyse Workflow"'s **Workflow JSON** to `{{ $json }}`. Feed it the n8n node's **Workflow → Get Many** instead to check every workflow on the instance, one item each.

"Report Heartbeat" is typically the last node in a workflow (or in an error-handling branch), reporting how that run went. "Get Workflow Health" is typically used to build your own status checks or alerting on top of what stillrunning.dev already tracks.

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
* [stillrunning.dev](https://stillrunning.dev)

## Version history

### 0.1.0

Initial release: Analyse Workflow, Report Heartbeat, Get Workflow Health.

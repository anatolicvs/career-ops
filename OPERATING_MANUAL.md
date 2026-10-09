# Operating Manual - career-ops Job Search System

This manual explains how to use the `career-ops` system.
The sentences follow the rules of ASD-STE100 (Simplified Technical English).
Read this manual before you modify or operate the system.

## 1. System Overview

`career-ops` is a job search engine for AI and engineering roles.
It discovers, evaluates, and tracks job postings.
The system is in `/Users/ozkan/src/cv/third-party/career-ops/`.
It operates with `tools/jobhunt/` to automate daily job discovery.

### 1.1 The Two-Layer Architecture

The system divides files into two layers:

1. **User Layer (Never overwrite during updates)**:
   - `portals.yml`: Board targets and title/location filters.
   - `cv.md`: Candidate CV source of truth (mirrors `cv.tex`).
   - `config/profile.yml`: Candidate contact data, comp target, and geography.
   - `modes/_profile.md`: Narrative, proof points, and negotiation scripts.
   - `modes/_brief.md`: Compact triage rules and hard disqualifiers.
   - `modes/_custom.md`: Candidate-specific procedural rules.
   - `data/applications.md`: Application status tracker table.
   - `data/pipeline.md`: Inbox of pending URLs.
   - `data/scan-history.tsv`: History of all discovered postings.
   - `reports/`: Completed evaluation reports.

2. **System Layer (Auto-updatable core)**:
   - Core scripts (`scan.mjs`, `set-status.mjs`, `merge-tracker.mjs`, etc.).
   - Modes (`modes/oferta.md`, `modes/triage.md`, `modes/scan.md`).
   - Providers (`providers/*.mjs`).
   - Templates (`templates/*`).

CAUTION: Never put personal candidate facts in system layer files. Put personal facts only in `config/profile.yml` or `modes/_profile.md`.

## 2. Guaranteed Tracking of Real Jobs

The system uses six protection layers to track only real jobs:

1. **Direct Employer APIs**:
   The scanner uses direct applicant tracking system (ATS) APIs.
   It reads Greenhouse, Lever, Ashby, Workday, SuccessFactors, and Phenom.
   It does not read meta-search aggregators or third-party scraper farms.

2. **Liveness Gate**:
   The engine confirms that the job posting URL is accessible and active.
   If a page returns HTTP 404 or says "position filled", the engine stops.
   It does not write phantom evaluation reports for dead links.

3. **Title Matching Precision**:
   The engine uses role-phrase matching instead of bare acronyms.
   `Machine Learning Engineer`, `Research Scientist`, and `Kernel Engineer` pass.
   Non-IC roles (`Scrum Master`, `Consultant`, `Account Executive`) fail.
   Student and thesis postings (`Werkstudent`, `Praktikant`, `PhD Position`) fail.

4. **Geographic Gate**:
   Primary locations for Germany are Hamburg, Munich, and Berlin.
   All cities in Switzerland pass.
   Remote roles in Germany, Switzerland, and the European Union pass.
   US, Canada, and UK postings fail unless they state visa sponsorship.

5. **Blacklist Gate**:
   If a company is listed in `data/blacklist.md`, the pipeline stops immediately.

6. **Source of Truth Boundary**:
   Every claim in an evaluation or letter must trace to `cv.md` and `cv.tex`.
   The system never fabricates metrics, years of experience, or credentials.
   German language level is never overstated.

## 3. Human Workflow

### 3.1 Reviewing Discovered Postings

1. Open Obsidian.
2. Open `letters/Inbox.md`.
3. Open the daily note `letters/inbox/YYYY-MM-DD.md`.
4. Review the table **Evaluate / apply next — triage PASS**.
5. Check the `Score` and the `Report` link.
6. Read the report file under `letters/reports/`.

### 3.2 Authoring Application Letters

1. Choose a posting with a score of 4.0 or higher.
2. In Hermes Agent, type: `write a letter for <URL>`.
3. The agent reads `cv.tex` and the job requirements.
4. The agent compiles a one-page PDF in `letters/sources/`.
5. The agent creates the application note in `letters/applications/`.
6. Inspect the compiled PDF.

### 3.3 Submitting Applications

CAUTION: The software does not submit applications automatically. The candidate must submit every application.

1. Open the job URL in your browser.
2. Fill in the required fields.
3. Attach `cv_aytacoezkan.pdf` (ATS-compliant CV).
4. Attach the generated cover letter PDF.
5. Submit the application.
6. Open the application note in `letters/applications/`.
7. Change `status: drafted` to `status: submitted`.
8. Enter `applied_date: YYYY-MM-DD`.

### 3.4 Updating Application Status

Do not hand-edit the table `data/applications.md`.
Use one of these two methods:

Method A (Obsidian):
1. Change the `status:` field in the note `letters/applications/<Company> - <Role>.md`.
2. Run `pixi run python jobhunt.py sync` from `tools/jobhunt/`.

Method B (Command Line):
1. In `third-party/career-ops/`, run:
   ```bash
   node set-status.mjs --row <ROW_NUMBER> <NEW_STATE> --note "<NOTE>"
   ```
Valid states: `Evaluated`, `Applied`, `Responded`, `Interview`, `Offer`, `Hired`, `Rejected`, `Discarded`, `SKIP`.

## 4. Maintenance Procedures

### 4.1 Verify System Health
Run this command weekly:
```bash
cd /Users/ozkan/src/cv/third-party/career-ops
node doctor.mjs
node verify-pipeline.mjs
node validate-portals.mjs
```
The output must show `0 errors` and `Pipeline is clean`.

### 4.2 Adding a New Employer Board
1. Open `portals.yml`.
2. Find `tracked_companies:`.
3. Add the employer entry:
   ```yaml
   - name: "<Company Name>"
     careers_url: <Direct ATS URL>
     provider: <greenhouse|lever|ashby|workday|personio|successfactors|phenom>
     notes: "<Location, focus, verified date>"
     enabled: true
   ```
4. Test the new entry:
   ```bash
   node scan.mjs --company "<Company Name>" --dry-run
   ```
5. Confirm that the command reports a positive job count.

### 4.3 Testing Filter Changes
Do not run a live scan to test filter edits.
Use the replay tool:
```bash
cd /Users/ozkan/src/cv
node tools/jobhunt/replay-filters.mjs --show pass
```
The tool tests the filters against historical jobs in less than one second.

### 4.4 Backing Up Personal Settings
The personal files are excluded from git.
To back up personal files, type:
```bash
cd /Users/ozkan/.hermes/profiles/jobhunter
CO=/Users/ozkan/src/cv/third-party/career-ops
cp "$CO/portals.yml" "$CO/cv.md" "$CO/voice-dna.md" career-ops-config/
cp "$CO/config/profile.yml" career-ops-config/config/
cp "$CO/modes/_profile.md" career-ops-config/_profile.md
cp "$CO/modes/_brief.md" career-ops-config/_brief.md
cp "$CO/modes/_custom.md" career-ops-config/_custom.md
scripts/profile-git-sync.sh "chore: refresh career-ops config backup"
```

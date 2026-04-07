/**
 * MethodologyPage — /methodology
 *
 * Public page. Documents TaxLift's SR&ED eligibility methodology and CRA alignment.
 * Designed to be cited by CPAs in audit defence.
 * Also contains the liability statement and PIPEDA/data processing disclosure.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ShieldCheck, BookOpen, ChevronDown, ChevronUp,
  CheckCircle2, AlertCircle, FileText, Download,
  ArrowRight, Scale, Lock, Database,
} from 'lucide-react'

// ── Five SR&ED questions (IC86-4R3) ───────────────────────────────────────────
const FIVE_QUESTIONS = [
  {
    q: 'Was there a scientific or technological uncertainty?',
    how: 'TaxLift scans commit messages, PR descriptions, and ticket titles for uncertainty signals: words and phrases like "unknown", "hypothesis", "attempted X but", "trying to determine", "not yet supported", "undefined behaviour". Each signal is scored on a 0–1 confidence scale. A cluster must reach a threshold confidence ≥ 0.4 on this dimension to be eligible.',
  },
  {
    q: 'Did the work constitute a systematic investigation or search?',
    how: 'TaxLift identifies iterative commit patterns — repeated attempts on the same file or function within a defined time window — as evidence of systematic investigation. A cluster with ≥ 3 commit iterations on a defined problem set, spanning ≥ 2 days, satisfies this criterion.',
  },
  {
    q: 'Was the investigation conducted for the purpose of achieving a technological advancement?',
    how: 'TaxLift looks for "advancement" language in PR merge messages, milestone closures, and release notes ("resolved", "now supports", "enabled", "implemented", "achieved"). Advancements must relate to a technology field (software architecture, algorithms, data structures, ML models, hardware interfaces) to qualify.',
  },
  {
    q: 'Was the work conducted in Canada by qualified personnel?',
    how: 'TaxLift reads committer identity from git metadata and cross-references against the developer rate card (role, location, employment type). Canadian-based developers are tagged using timezone heuristics and explicit location fields populated during onboarding. Hours are attributed only to Canadian contributors.',
  },
  {
    q: 'Were the results of the SR&ED work retained?',
    how: 'TaxLift generates a tamper-evident evidence chain: every qualifying commit is hashed (SHA-256 + FNV-1a), timestamped against the git log, and stored in an immutable audit vault. The hash is included in the T661 package and can be independently verified.',
  },
]

// ── Heuristic signal categories ───────────────────────────────────────────────
const SIGNAL_CATEGORIES = [
  {
    name: 'Technological Uncertainty',
    signals: ['unknown', 'unclear', 'hypothesis', 'experimental', 'prototype', 'attempt', 'investigating', 'not documented', 'undefined behaviour', 'edge case', 'root cause unknown', 'TBD'],
    weight: 30,
  },
  {
    name: 'Systematic Investigation',
    signals: ['iteration', 'retry', 'test case', 'benchmark', 'profiling', 'regression', 'ablation', 'A/B', 'variant', 'experiment', 'reproduce', 'isolate'],
    weight: 25,
  },
  {
    name: 'Technological Advancement',
    signals: ['resolved', 'achieved', 'novel', 'first-time', 'new algorithm', 'improved by', 'reduced latency', 'new architecture', 'enabled', 'breakthrough'],
    weight: 25,
  },
  {
    name: 'Exclusions (negative signals)',
    signals: ['UI change', 'copy update', 'text fix', 'documentation only', 'style fix', 'lint', 'formatting', 'rename', 'dependency bump'],
    weight: -20,
    negative: true,
  },
]

function Accordion({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left bg-white hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-semibold text-gray-900">{title}</span>
        {open ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" />
               : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />}
      </button>
      {open && <div className="px-5 pb-5 bg-white">{children}</div>}
    </div>
  )
}

export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-white">

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
              <ShieldCheck size={14} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm">TaxLift</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/partners" className="text-xs text-gray-500 hover:text-gray-800">Partner program</Link>
            <Link to="/cpa/login" className="text-xs text-indigo-600 font-semibold hover:text-indigo-700">Partner login</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12">

        {/* ── Header ── */}
        <div className="mb-10">
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 mb-3">
            <BookOpen size={13} />
            SR&ED METHODOLOGY DOCUMENTATION
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-3">
            TaxLift SR&amp;ED Eligibility Methodology
          </h1>
          <p className="text-gray-500 text-sm leading-relaxed max-w-2xl mb-4">
            This document describes how TaxLift identifies, classifies, and quantifies SR&ED-eligible
            activities from software development artefacts. It is intended for use by CPA partners
            when explaining the preparatory process to CRA and in audit defence submissions.
          </p>
          <div className="flex items-center gap-4 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-100 rounded-full px-3 py-1">
              <FileText size={11} /> Aligned with CRA IC86-4R3
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-100 rounded-full px-3 py-1">
              <CheckCircle2 size={11} /> Last reviewed: April 2026
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-100 rounded-full px-3 py-1">
              Version 2.1
            </span>
          </div>
        </div>

        {/* ── Liability banner ── */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-10 flex items-start gap-4">
          <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-900 mb-1">Professional Liability Statement</p>
            <p className="text-sm text-amber-800 leading-relaxed">
              TaxLift is a <strong>preparatory software tool</strong>. It does not provide tax advice
              and is not a licensed tax adviser. The CPA who reviews, approves, and signs the T661
              filing retains full professional responsibility for the claim under the{' '}
              <em>Income Tax Act</em> and their provincial CPA body's rules of professional conduct.
              TaxLift's output is documentation and narrative assistance — not a professional
              tax opinion. CPA partners should apply their independent professional judgment
              before filing any claim prepared using TaxLift.
            </p>
          </div>
        </div>

        {/* ── Section 1: CRA alignment ── */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
            CRA Policy Alignment
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            TaxLift's eligibility engine is calibrated against the following CRA guidance documents:
          </p>
          <div className="space-y-2 mb-5">
            {[
              { ref: 'IC86-4R3',    title: 'Scientific Research and Experimental Development — Interpretation Bulletin',       note: 'Primary reference — defines SR&ED, technological uncertainty, systematic investigation'                },
              { ref: 'IC97-1',      title: 'Scientific Research and Experimental Development Administrative Guidelines',       note: 'Administrative interpretation of what constitutes SR&ED work'                                       },
              { ref: 'T4088',       title: 'Guide to Form T661',                                                               note: 'Filing instructions — T661 project description structure'                                          },
              { ref: 'SR&ED 2102',  title: 'Eligibility of Work for SR&ED Investment Tax Credits',                             note: 'CRA policy statement on work eligibility boundaries'                                               },
            ].map(({ ref, title, note }) => (
              <div key={ref} className="flex items-start gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 rounded px-2 py-1 flex-shrink-0 font-mono">{ref}</span>
                <div>
                  <p className="text-xs font-semibold text-gray-800">{title}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{note}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 2: Five questions ── */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
            <span className="w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
            How TaxLift Applies the Five SR&amp;ED Questions
          </h2>
          <p className="text-sm text-gray-500 mb-5 ml-8">
            CRA evaluates SR&ED eligibility against five questions derived from IC86-4R3.
            Below is how TaxLift operationalises each question from git and project management artefacts.
          </p>
          <div className="space-y-3">
            {FIVE_QUESTIONS.map((item, i) => (
              <Accordion key={i} title={`Q${i + 1}: ${item.q}`} defaultOpen={i === 0}>
                <p className="text-sm text-gray-600 leading-relaxed pt-2">{item.how}</p>
              </Accordion>
            ))}
          </div>
        </section>

        {/* ── Section 3: Signal catalogue ── */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
            <span className="w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
            Heuristic Signal Catalogue
          </h2>
          <p className="text-sm text-gray-500 mb-5 ml-8">
            TaxLift scans commit messages, PR titles, ticket descriptions, and CI/CD logs against
            the signal categories below. Scores are additive; exclusion signals subtract from the score.
            Clusters with a final score &lt; 40 / 100 are marked ineligible.
          </p>
          <div className="space-y-4">
            {SIGNAL_CATEGORIES.map(cat => (
              <div
                key={cat.name}
                className={`rounded-xl border p-5 ${cat.negative ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className={`text-sm font-semibold ${cat.negative ? 'text-red-700' : 'text-gray-900'}`}>{cat.name}</h3>
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg ${cat.negative ? 'bg-red-100 text-red-700' : 'bg-indigo-50 text-indigo-700'}`}>
                    {cat.negative ? `${cat.weight} pts` : `+${cat.weight} pts`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {cat.signals.map(s => (
                    <span
                      key={s}
                      className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                        cat.negative
                          ? 'bg-red-50 border-red-200 text-red-700'
                          : 'bg-gray-50 border-gray-200 text-gray-700'
                      }`}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 4: Cluster formation ── */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
            <span className="w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
            Cluster Formation &amp; T661 Mapping
          </h2>
          <div className="space-y-3 ml-8 text-sm text-gray-600 leading-relaxed">
            <p>
              TaxLift groups qualifying commits and tickets into <strong>SR&ED clusters</strong> — each of which maps
              to one T661 project description. A cluster is formed when two or more qualifying activities
              share a common technical objective, as determined by:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Shared Jira epic or GitHub milestone</li>
              <li>Overlapping file paths (same module or subsystem)</li>
              <li>Semantic similarity of commit messages above a cosine threshold (≥ 0.65)</li>
              <li>Temporal proximity: qualifying activities within a 90-day rolling window</li>
            </ul>
            <p>
              Each cluster generates a T661 project description with five required fields:
              project name, project start/end date, technological uncertainty statement,
              work performed description, and technological advancement achieved.
              TaxLift pre-populates each field from artefact data, but the CPA partner
              must review and approve the narratives before they are included in the filing package.
            </p>
          </div>
        </section>

        {/* ── Section 5: Evidence chain ── */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
            <span className="w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">5</span>
            Evidence Chain of Custody
          </h2>
          <div className="ml-8 text-sm text-gray-600 leading-relaxed space-y-3">
            <p>
              Every qualifying commit included in a T661 cluster is recorded in TaxLift's
              immutable audit vault with:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: 'SHA-256 hash',       desc: 'Of the commit message + diff metadata'                   },
                { label: 'FNV-1a checksum',    desc: 'Of the cluster\'s full evidence set for tamper detection' },
                { label: 'Git timestamp',       desc: 'Author and committer timestamps from git log'            },
                { label: 'Author identity',     desc: 'GitHub user ID cross-referenced with rate card'          },
                { label: 'CRA activity code',   desc: 'Mapped to SR&ED activity type (SR, basic, applied)'      },
                { label: 'Eligibility score',   desc: 'Final 0–100 score with dimension breakdown'             },
              ].map(({ label, desc }) => (
                <div key={label} className="flex items-start gap-2 bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <CheckCircle2 size={13} className="text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-gray-800">{label}</p>
                    <p className="text-[11px] text-gray-500">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <p>
              The evidence hash is embedded in the T661 package PDF. CRA reviewers or auditors
              may request the raw audit vault export, which CPAs can provide directly from
              their TaxLift portal.
            </p>
          </div>
        </section>

        {/* ── Section 6: Data & privacy ── */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
            <span className="w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">6</span>
            Data Storage &amp; Privacy
          </h2>
          <div className="ml-8 space-y-4">
            <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
              <Lock size={15} className="text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-green-800 leading-relaxed">
                <strong>Source code is never stored.</strong> TaxLift reads commit metadata
                (SHA, message, author, timestamp, file paths) via the GitHub/GitLab OAuth scope.
                File content and diffs are processed in-memory and discarded after analysis.
              </div>
            </div>
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
              <Database size={15} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800 leading-relaxed">
                <strong>What is stored:</strong> Commit metadata, ticket titles and descriptions,
                developer identifiers, computed eligibility scores, and generated T661 narratives.
                All data is encrypted at rest (AES-256) and in transit (TLS 1.3).
                Data is stored in Canadian-region cloud infrastructure.
              </div>
            </div>
            <p className="text-sm text-gray-600">
              A <strong>Data Processing Agreement (DPA)</strong> is available to all CPA partners on request.
              Contact <a href="mailto:privacy@taxlift.ai" className="text-indigo-600 underline">privacy@taxlift.ai</a>.
              TaxLift is compliant with PIPEDA and the Ontario privacy legislation.
            </p>
          </div>
        </section>

        {/* ── Section 7: Limitations ── */}
        <section className="mb-12">
          <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
            <span className="w-6 h-6 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">7</span>
            Known Limitations &amp; CPA Responsibilities
          </h2>
          <div className="ml-8 space-y-3 text-sm text-gray-600 leading-relaxed">
            <p>
              TaxLift's heuristic engine has the following known limitations that CPAs should
              account for in their professional review:
            </p>
            {[
              'Activities that lack written documentation (e.g. verbal design discussions, whiteboard sessions) cannot be captured from git/Jira and must be added manually.',
              'The engine may undercount eligible hours for teams that use sparse commit messages or monorepo architectures with mixed eligible and ineligible work.',
              'Hardware R&D activities (physical prototyping, lab work) are out of scope for the current version and must be added by the CPA independently.',
              'The engine does not assess whether work relates to "basic research" vs "applied research" vs "experimental development" — that categorisation requires CPA judgment.',
              'Salary data must be provided by the client; TaxLift does not verify payroll records.',
            ].map((l, i) => (
              <div key={i} className="flex items-start gap-2">
                <AlertCircle size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
                <p>{l}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <div className="border border-indigo-200 bg-indigo-50 rounded-2xl p-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-bold text-indigo-900 mb-1">Questions about this methodology?</p>
            <p className="text-xs text-indigo-700">
              Contact our SR&D methodology team or book a 30-min CPA orientation call.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="mailto:methodology@taxlift.ai"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 border border-indigo-300 rounded-lg px-4 py-2 hover:bg-indigo-100 transition-colors"
            >
              Email methodology team
            </a>
            <Link
              to="/partners"
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg px-4 py-2 transition-colors"
            >
              Partner program <ArrowRight size={12} />
            </Link>
          </div>
        </div>

      </div>

      {/* ── Footer ── */}
      <footer className="bg-gray-50 border-t border-gray-100 text-gray-400 text-xs text-center py-6 px-4 mt-8">
        <p>© {new Date().getFullYear()} TaxLift Technologies Inc. · This document is for informational purposes and does not constitute legal or tax advice.</p>
        <p className="mt-1">
          <Link to="/partners" className="hover:text-gray-600 underline">Partner program</Link>
          {' · '}
          <a href="mailto:methodology@taxlift.ai" className="hover:text-gray-600 underline">methodology@taxlift.ai</a>
        </p>
      </footer>
    </div>
  )
}

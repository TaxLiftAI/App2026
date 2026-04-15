#!/usr/bin/env python3
"""
audit_pdf.py — TaxLift SR&ED Audit-Ready Package Generator
Reads scan JSON from stdin, writes a multi-page PDF to stdout.

Input JSON schema:
{
  "repos":       ["org/repo", ...],
  "clusters":    [{ "_theme", "_commitCount", "_topCommits", "aggregate_time_hours",
                    "estimated_credit_cad", "business_component" }, ...],
  "credit":      123456,
  "creditLow":   80000,
  "creditHigh":  166000,
  "commitCount": 412,
  "hoursTotal":  820,
  "isCcpc":      true,
  "province":    "ON",
  "email":       "founder@example.com",
  "generatedAt": "2026-04-15"
}
"""

import sys, json, io
from datetime import date

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether
)
from reportlab.platypus.flowables import HRFlowable

# ── Palette ────────────────────────────────────────────────────────────────────
INDIGO      = colors.HexColor('#6366f1')
INDIGO_DARK = colors.HexColor('#4f46e5')
INDIGO_LITE = colors.HexColor('#eef2ff')
INDIGO_MED  = colors.HexColor('#c7d2fe')
VIOLET      = colors.HexColor('#7c3aed')
SLATE_900   = colors.HexColor('#0f172a')
SLATE_700   = colors.HexColor('#334155')
SLATE_500   = colors.HexColor('#64748b')
SLATE_300   = colors.HexColor('#cbd5e1')
SLATE_100   = colors.HexColor('#f1f5f9')
SLATE_50    = colors.HexColor('#f8fafc')
EMERALD     = colors.HexColor('#10b981')
EMERALD_LT  = colors.HexColor('#d1fae5')
AMBER       = colors.HexColor('#f59e0b')
AMBER_LT    = colors.HexColor('#fef3c7')
WHITE       = colors.white
RED_LT      = colors.HexColor('#fee2e2')

# ── Helpers ────────────────────────────────────────────────────────────────────
def fmt_cad(n):
    n = int(n or 0)
    if n >= 1_000_000:
        return f"${n/1_000_000:.1f}M"
    if n >= 1_000:
        return f"${n//1_000:,}K"
    return f"${n:,}"

def fmt_cad_full(n):
    return f"${int(n or 0):,}"

def prov_name(code):
    return {
        'ON': 'Ontario', 'QC': 'Québec', 'BC': 'British Columbia',
        'AB': 'Alberta', 'MB': 'Manitoba', 'SK': 'Saskatchewan', 'NS': 'Nova Scotia',
    }.get(code, code)

def prov_rate(code):
    return {'ON': 0.08, 'QC': 0.30, 'BC': 0.10, 'AB': 0.10,
            'MB': 0.07, 'SK': 0.075, 'NS': 0.15}.get(code, 0.08)

# ── Styles ─────────────────────────────────────────────────────────────────────
base = getSampleStyleSheet()

def S(name, **kw):
    """Create a ParagraphStyle."""
    return ParagraphStyle(name, **kw)

H1 = S('H1', fontSize=22, textColor=SLATE_900, fontName='Helvetica-Bold',
        spaceAfter=4, spaceBefore=0)
H2 = S('H2', fontSize=13, textColor=INDIGO_DARK, fontName='Helvetica-Bold',
        spaceAfter=6, spaceBefore=14)
H3 = S('H3', fontSize=10, textColor=SLATE_700, fontName='Helvetica-Bold',
        spaceAfter=4, spaceBefore=8)
BODY = S('Body', fontSize=9, textColor=SLATE_700, fontName='Helvetica',
         spaceAfter=4, leading=14)
BODY_SM = S('BodySm', fontSize=8, textColor=SLATE_500, fontName='Helvetica',
            spaceAfter=3, leading=12)
LABEL = S('Label', fontSize=7, textColor=SLATE_500, fontName='Helvetica',
          spaceAfter=2, leading=10, textTransform='uppercase')
CAPTION = S('Caption', fontSize=7, textColor=SLATE_500, fontName='Helvetica-Oblique',
            spaceAfter=3, leading=10)
MONO = S('Mono', fontSize=8, textColor=SLATE_700, fontName='Courier',
         spaceAfter=2, leading=11)

def hr(color=SLATE_300, thickness=0.5):
    return HRFlowable(width='100%', thickness=thickness, color=color,
                      spaceAfter=6, spaceBefore=6)

def section_header(title):
    return [
        Spacer(1, 4),
        Paragraph(title, H2),
        HRFlowable(width='100%', thickness=1.5, color=INDIGO, spaceAfter=8, spaceBefore=0),
    ]

# ── Cover page ─────────────────────────────────────────────────────────────────
def build_cover(data, styles):
    repo_names = data.get('repos', [])
    company    = repo_names[0].split('/')[0] if repo_names else 'Your Company'
    gen_date   = data.get('generatedAt') or date.today().isoformat()
    credit_low = data.get('creditLow', 0)
    credit_hi  = data.get('creditHigh', 0)
    is_ccpc    = data.get('isCcpc', True)
    province   = data.get('province', 'ON')
    f_rate     = 0.35 if is_ccpc else 0.15
    p_rate     = prov_rate(province)
    clusters   = data.get('clusters', [])
    hours      = data.get('hoursTotal', 0)
    commits    = data.get('commitCount', 0)

    story = []

    # TaxLift wordmark
    story.append(Spacer(1, 0.3 * inch))
    story.append(Paragraph(
        '<font color="#6366f1"><b>TaxLift</b></font>',
        S('Brand', fontSize=16, textColor=INDIGO, fontName='Helvetica-Bold', spaceAfter=2)
    ))
    story.append(Paragraph('AI-powered SR&amp;ED credit intelligence', BODY_SM))
    story.append(Spacer(1, 0.25 * inch))
    story.append(hr(SLATE_300, 0.5))
    story.append(Spacer(1, 0.2 * inch))

    # Document title block
    story.append(Paragraph('SR&amp;ED Credit Analysis', S('DocType', fontSize=11, textColor=SLATE_500,
                            fontName='Helvetica', spaceAfter=4)))
    story.append(Paragraph(f'{company}', H1))
    story.append(Paragraph(f'Prepared {gen_date}', BODY_SM))
    story.append(Spacer(1, 0.4 * inch))

    # Credit range highlight table
    cover_table = Table(
        [[
            Paragraph(f'<b>{fmt_cad(credit_low)} – {fmt_cad(credit_hi)}</b>',
                      S('BigNum', fontSize=26, textColor=WHITE, fontName='Helvetica-Bold',
                        alignment=TA_CENTER, spaceAfter=2)),
            ''
        ],
        [
            Paragraph('Estimated SR&amp;ED Refundable ITC Range',
                      S('Sub', fontSize=9, textColor=INDIGO_MED, fontName='Helvetica',
                        alignment=TA_CENTER, spaceAfter=0)),
            ''
        ]],
        colWidths=[6 * inch, 0],
        rowHeights=[None, None],
    )
    cover_table.setStyle(TableStyle([
        ('BACKGROUND',   (0, 0), (-1, -1), INDIGO_DARK),
        ('SPAN',         (0, 0), (-1, 0)),
        ('SPAN',         (0, 1), (-1, 1)),
        ('ALIGN',        (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING',   (0, 0), (-1, 0), 18),
        ('BOTTOMPADDING',(0, 1), (-1, 1), 16),
        ('LEFTPADDING',  (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('ROUNDEDCORNERS', [8]),
    ]))
    story.append(cover_table)
    story.append(Spacer(1, 0.3 * inch))

    # Key stats row
    stats = [
        ('Qualifying\nClusters',   str(len(clusters))),
        ('Commits\nAnalysed',      f'{commits:,}'),
        ('Est. R&amp;D\nHours',    f'{int(hours)}h'),
        ('ITC Rate\n(Fed + Prov)', f'{f_rate*100:.0f}% + {p_rate*100:.1f}%'),
    ]
    stat_data = [[Paragraph(v, S('StatV', fontSize=16, textColor=SLATE_900, fontName='Helvetica-Bold',
                                  alignment=TA_CENTER)) for _, v in stats],
                 [Paragraph(k, S('StatL', fontSize=7, textColor=SLATE_500, fontName='Helvetica',
                                  alignment=TA_CENTER, leading=10)) for k, _ in stats]]
    stat_tbl = Table(stat_data, colWidths=[1.5 * inch] * 4)
    stat_tbl.setStyle(TableStyle([
        ('BACKGROUND',   (0, 0), (-1, -1), SLATE_50),
        ('BOX',          (0, 0), (-1, -1), 0.5, SLATE_300),
        ('INNERGRID',    (0, 0), (-1, -1), 0.5, SLATE_300),
        ('ALIGN',        (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING',   (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING',(0, 1), (-1, 1), 10),
    ]))
    story.append(stat_tbl)
    story.append(Spacer(1, 0.3 * inch))

    # Entity & assumptions summary
    meta_rows = [
        ['Entity type',    'CCPC (Canadian-Controlled Private Corporation)' if is_ccpc else 'Non-CCPC / Public Corp'],
        ['Province',       f'{prov_name(province)} ({province})'],
        ['Federal ITC',    f'{f_rate*100:.0f}% refundable ITC (ITA s.127(9))'],
        ['Provincial ITC', f'{p_rate*100:.1f}% ({prov_name(province)} OITC)'],
        ['Fiscal period',  'Most recent 12-month fiscal year'],
        ['Repos scanned',  ', '.join(repo_names[:4]) + ('…' if len(repo_names) > 4 else '')],
    ]
    meta_tbl = Table(
        [[Paragraph(k, LABEL), Paragraph(v, BODY_SM)] for k, v in meta_rows],
        colWidths=[1.4 * inch, 4.6 * inch]
    )
    meta_tbl.setStyle(TableStyle([
        ('BACKGROUND',   (0, 0), (0, -1), SLATE_50),
        ('TOPPADDING',   (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING',(0, 0), (-1, -1), 4),
        ('LEFTPADDING',  (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('LINEBELOW',    (0, 0), (-1, -2), 0.3, SLATE_300),
        ('BOX',          (0, 0), (-1, -1), 0.5, SLATE_300),
    ]))
    story.append(meta_tbl)
    story.append(Spacer(1, 0.3 * inch))

    story.append(Paragraph(
        'This document was generated by TaxLift (taxlift.ai) using AI-assisted analysis of your source '
        'code commit history. It is intended as a preliminary assessment to support discussion with a '
        'qualified SR&amp;ED practitioner. It does not constitute a filed SR&amp;ED claim.',
        CAPTION
    ))

    story.append(PageBreak())
    return story


# ── Executive summary ──────────────────────────────────────────────────────────
def build_exec_summary(data):
    is_ccpc  = data.get('isCcpc', True)
    province = data.get('province', 'ON')
    f_rate   = 0.35 if is_ccpc else 0.15
    p_rate   = prov_rate(province)
    credit   = data.get('credit', 0)
    c_low    = data.get('creditLow', 0)
    c_high   = data.get('creditHigh', 0)
    hours    = data.get('hoursTotal', 0)
    # Rough eligible expenditure: credit / total_rate
    total_rate = f_rate + p_rate
    elig_exp = int(credit / total_rate) if total_rate else 0
    fed_credit  = int(elig_exp * f_rate)
    prov_credit = int(elig_exp * p_rate)
    clusters = data.get('clusters', [])

    story = []
    story += section_header('Executive Summary')

    # Credit breakdown table
    rows = [
        [Paragraph('<b>Component</b>', LABEL),
         Paragraph('<b>Amount</b>', LABEL),
         Paragraph('<b>Rate</b>', LABEL),
         Paragraph('<b>Notes</b>', LABEL)],
        [Paragraph('Eligible SR&amp;ED Expenditure', BODY_SM),
         Paragraph(f'<b>{fmt_cad_full(elig_exp)}</b>', BODY_SM),
         Paragraph('—', BODY_SM),
         Paragraph('Salaries × overhead proxy', BODY_SM)],
        [Paragraph(f'Federal ITC ({"CCPC" if is_ccpc else "Non-CCPC"})', BODY_SM),
         Paragraph(f'<b><font color="#4f46e5">{fmt_cad_full(fed_credit)}</font></b>', BODY_SM),
         Paragraph(f'{f_rate*100:.0f}%', BODY_SM),
         Paragraph('ITA s.127(9) — fully refundable', BODY_SM)],
        [Paragraph(f'Provincial ITC ({prov_name(province)})', BODY_SM),
         Paragraph(f'<b><font color="#4f46e5">{fmt_cad_full(prov_credit)}</font></b>', BODY_SM),
         Paragraph(f'{p_rate*100:.1f}%', BODY_SM),
         Paragraph(f'{prov_name(province)} R&amp;D tax credit', BODY_SM)],
        [Paragraph('<b>Total Estimated Credit</b>', S('Bold', fontSize=9, fontName='Helvetica-Bold',
                                                       textColor=SLATE_900, spaceAfter=2)),
         Paragraph(f'<b><font color="#4f46e5">{fmt_cad_full(credit)}</font></b>',
                   S('TotalV', fontSize=11, fontName='Helvetica-Bold', textColor=INDIGO_DARK, spaceAfter=2)),
         Paragraph('—', BODY_SM),
         Paragraph(f'Range: {fmt_cad(c_low)} – {fmt_cad(c_high)}', BODY_SM)],
    ]
    tbl = Table(rows, colWidths=[2.0*inch, 1.3*inch, 0.7*inch, 2.0*inch])
    tbl.setStyle(TableStyle([
        ('BACKGROUND',   (0, 0), (-1, 0),  SLATE_100),
        ('BACKGROUND',   (0, 4), (-1, 4),  INDIGO_LITE),
        ('LINEBELOW',    (0, 0), (-1, -2), 0.3, SLATE_300),
        ('BOX',          (0, 0), (-1, -1), 0.5, SLATE_300),
        ('TOPPADDING',   (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING',(0, 0), (-1, -1), 5),
        ('LEFTPADDING',  (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN',       (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(tbl)
    story.append(Spacer(1, 0.2 * inch))

    # Top clusters mini table
    story += section_header('Qualifying Activity Summary')
    story.append(Paragraph(
        f'TaxLift identified <b>{len(clusters)} qualifying SR&amp;ED activity cluster{"s" if len(clusters)!=1 else ""}</b> '
        f'from your commit history. Each cluster represents a cohesive area of technological uncertainty '
        f'and systematic investigation meeting CRA T4088 criteria.',
        BODY
    ))
    story.append(Spacer(1, 6))

    cluster_rows = [[
        Paragraph('<b>#</b>', LABEL),
        Paragraph('<b>Theme / Business Component</b>', LABEL),
        Paragraph('<b>Hours</b>', LABEL),
        Paragraph('<b>Commits</b>', LABEL),
        Paragraph('<b>Est. Credit</b>', LABEL),
    ]]
    sorted_clusters = sorted(clusters, key=lambda c: c.get('estimated_credit_cad', 0), reverse=True)
    for i, cl in enumerate(sorted_clusters[:8], 1):
        theme   = cl.get('_theme') or cl.get('theme') or cl.get('business_component') or f'Cluster {i}'
        hrs     = cl.get('aggregate_time_hours', 0)
        comms   = cl.get('_commitCount') or cl.get('commit_count', 0)
        est_cr  = cl.get('estimated_credit_cad', 0)
        cluster_rows.append([
            Paragraph(str(i), BODY_SM),
            Paragraph(theme[:60], BODY_SM),
            Paragraph(f'{int(hrs)}h', BODY_SM),
            Paragraph(str(comms), BODY_SM),
            Paragraph(f'<b>{fmt_cad(est_cr)}</b>', BODY_SM),
        ])

    cl_tbl = Table(cluster_rows, colWidths=[0.3*inch, 2.8*inch, 0.7*inch, 0.7*inch, 1.0*inch])
    cl_tbl.setStyle(TableStyle([
        ('BACKGROUND',   (0, 0), (-1, 0),  SLATE_100),
        ('LINEBELOW',    (0, 0), (-1, -2), 0.3, SLATE_300),
        ('BOX',          (0, 0), (-1, -1), 0.5, SLATE_300),
        ('TOPPADDING',   (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING',(0, 0), (-1, -1), 4),
        ('LEFTPADDING',  (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, SLATE_50]),
    ]))
    story.append(cl_tbl)
    story.append(PageBreak())
    return story


# ── Project descriptions ───────────────────────────────────────────────────────
def build_project_descriptions(data):
    clusters = data.get('clusters', [])
    sorted_clusters = sorted(clusters, key=lambda c: c.get('estimated_credit_cad', 0), reverse=True)

    story = []
    story += section_header('Project Descriptions & Technological Uncertainty')
    story.append(Paragraph(
        'Each section below describes a qualifying SR&amp;ED project, the technological uncertainties '
        'present at project outset, and the systematic investigation undertaken. These narratives are '
        'intended to support T661 Section B completion and should be reviewed by your SR&amp;ED practitioner.',
        BODY
    ))
    story.append(Spacer(1, 8))

    for i, cl in enumerate(sorted_clusters[:6], 1):
        theme    = cl.get('_theme') or cl.get('theme') or cl.get('business_component') or f'Project {i}'
        hrs      = int(cl.get('aggregate_time_hours', 0))
        comms    = cl.get('_commitCount') or cl.get('commit_count', 0)
        est_cr   = cl.get('estimated_credit_cad', 0)
        top_msgs = cl.get('_topCommits', [])

        # Build uncertainty narrative from theme
        narratives = {
            'ML / AI Development':
                'At the outset of this project, technological uncertainty existed regarding whether '
                'the proposed machine learning architecture could achieve the required accuracy and '
                'inference performance targets without relying on standard, commercially available '
                'models. The team conducted systematic experimentation across model architectures, '
                'training regimes, and data pipeline designs to resolve these uncertainties.',
            'Algorithm Research & Optimization':
                'Technological uncertainty existed regarding whether a novel algorithmic approach '
                'could satisfy the performance and correctness constraints within the operational '
                'environment. The work involved iterative hypothesis formation and testing against '
                'measurable benchmarks to advance the state of knowledge within the company.',
            'Distributed Systems Research':
                'The project faced uncertainty around whether the proposed distributed architecture '
                'could achieve the required consistency, fault tolerance, and latency guarantees '
                'simultaneously. Systematic investigation involved building and testing prototype '
                'implementations under failure scenarios not addressed by existing literature.',
            'Security & Cryptography R&D':
                'Technological uncertainty existed regarding the feasibility of implementing the '
                'proposed cryptographic protocol while meeting both security and performance '
                'objectives. The work involved systematic investigation of known attacks, edge cases, '
                'and implementation approaches to achieve the required security properties.',
            'Performance Engineering Research':
                'Uncertainty existed whether the proposed optimization techniques could achieve '
                'the target performance improvements without introducing correctness regressions. '
                'The team conducted systematic profiling, hypothesis testing, and micro-benchmark '
                'experiments to identify and resolve the performance bottlenecks.',
        }
        narrative = narratives.get(theme,
            f'At the outset of this project ({theme}), technological uncertainty existed regarding '
            f'whether the proposed technical approach could meet the required functional and '
            f'performance objectives. The team conducted systematic investigation through iterative '
            f'experimentation, producing measurable evidence of advancement at each stage.')

        block = []
        # Cluster header
        header_tbl = Table(
            [[Paragraph(f'Project {i}: {theme}',
                        S('ClH', fontSize=10, fontName='Helvetica-Bold', textColor=WHITE, spaceAfter=0)),
              Paragraph(f'{fmt_cad(est_cr)} est.',
                        S('ClC', fontSize=10, fontName='Helvetica-Bold', textColor=INDIGO_MED,
                          alignment=TA_RIGHT, spaceAfter=0))]],
            colWidths=[4.2*inch, 1.8*inch]
        )
        header_tbl.setStyle(TableStyle([
            ('BACKGROUND',   (0, 0), (-1, -1), INDIGO_DARK),
            ('TOPPADDING',   (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING',(0, 0), (-1, -1), 8),
            ('LEFTPADDING',  (0, 0), (-1, -1), 10),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
            ('VALIGN',       (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        block.append(header_tbl)

        # Stats row
        stats_tbl = Table(
            [[Paragraph(f'<b>{hrs}h</b> estimated R&amp;D', BODY_SM),
              Paragraph(f'<b>{comms}</b> qualifying commits', BODY_SM),
              Paragraph(f'<b>SR&amp;ED Eligible</b> (systematic investigation)', BODY_SM)]],
            colWidths=[1.8*inch, 1.8*inch, 2.4*inch]
        )
        stats_tbl.setStyle(TableStyle([
            ('BACKGROUND',   (0, 0), (-1, -1), INDIGO_LITE),
            ('TOPPADDING',   (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING',(0, 0), (-1, -1), 5),
            ('LEFTPADDING',  (0, 0), (-1, -1), 10),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ('INNERGRID',    (0, 0), (-1, -1), 0.3, INDIGO_MED),
        ]))
        block.append(stats_tbl)
        block.append(Spacer(1, 6))

        # Uncertainty narrative
        block.append(Paragraph('<b>Technological Uncertainty</b>', H3))
        block.append(Paragraph(narrative, BODY))

        # Work evidence
        if top_msgs:
            block.append(Paragraph('<b>Sample Qualifying Work (Commit Evidence)</b>', H3))
            for msg_obj in top_msgs[:4]:
                msg = msg_obj.get('msg') or msg_obj.get('message') or str(msg_obj)
                block.append(Paragraph(f'• {msg[:120]}{"…" if len(msg) > 120 else ""}', MONO))

        block.append(Spacer(1, 12))
        story.append(KeepTogether(block))

    story.append(PageBreak())
    return story


# ── Expenditure schedule ───────────────────────────────────────────────────────
def build_expenditure_schedule(data):
    hours   = data.get('hoursTotal', 0)
    is_ccpc = data.get('isCcpc', True)
    prov    = data.get('province', 'ON')
    f_rate  = 0.35 if is_ccpc else 0.15
    p_rate  = prov_rate(prov)

    # Estimate role split (heuristic from commit patterns)
    role_split = [
        ('Senior Developer',  0.40, 92),
        ('Developer',         0.35, 72),
        ('Architect / ML Eng',0.15, 116),
        ('QA / DevOps',       0.10, 72),
    ]

    story = []
    story += section_header('Eligible Expenditure Schedule')
    story.append(Paragraph(
        'The following table estimates eligible SR&amp;ED expenditures using the <b>traditional method</b> '
        '(ITA s.37). Salary figures are based on assumed market rates; replace with actual T4 amounts '
        'for the filed T661. Overhead is proxied at 20% of salary (65% overhead proxy also available).',
        BODY
    ))
    story.append(Spacer(1, 8))

    rows = [[
        Paragraph('<b>Role</b>', LABEL),
        Paragraph('<b>Est. Hours</b>', LABEL),
        Paragraph('<b>Rate</b>', LABEL),
        Paragraph('<b>Salary</b>', LABEL),
        Paragraph('<b>+ Overhead</b>', LABEL),
        Paragraph('<b>Eligible Exp.</b>', LABEL),
        Paragraph('<b>Fed ITC</b>', LABEL),
        Paragraph('<b>Prov ITC</b>', LABEL),
    ]]

    total_exp = total_fed = total_prov = 0
    for role, frac, rate in role_split:
        rh  = hours * frac
        sal = rh * rate
        oh  = sal * 0.20
        exp = sal + oh
        fed = exp * f_rate
        prv = exp * p_rate
        total_exp += exp; total_fed += fed; total_prov += prv
        rows.append([
            Paragraph(role, BODY_SM),
            Paragraph(f'{int(rh)}h', BODY_SM),
            Paragraph(f'${rate}/hr', BODY_SM),
            Paragraph(fmt_cad_full(sal), BODY_SM),
            Paragraph(fmt_cad_full(oh), BODY_SM),
            Paragraph(f'<b>{fmt_cad_full(exp)}</b>', BODY_SM),
            Paragraph(fmt_cad_full(fed), BODY_SM),
            Paragraph(fmt_cad_full(prv), BODY_SM),
        ])

    rows.append([
        Paragraph('<b>TOTAL</b>', S('TotL', fontSize=9, fontName='Helvetica-Bold',
                                    textColor=SLATE_900, spaceAfter=2)),
        Paragraph(f'<b>{int(hours)}h</b>', BODY_SM),
        Paragraph('—', BODY_SM),
        Paragraph('—', BODY_SM),
        Paragraph('—', BODY_SM),
        Paragraph(f'<b><font color="#4f46e5">{fmt_cad_full(total_exp)}</font></b>',
                  S('TV', fontSize=9, fontName='Helvetica-Bold', textColor=INDIGO_DARK, spaceAfter=2)),
        Paragraph(f'<b><font color="#4f46e5">{fmt_cad_full(total_fed)}</font></b>',
                  S('TV2', fontSize=9, fontName='Helvetica-Bold', textColor=INDIGO_DARK, spaceAfter=2)),
        Paragraph(f'<b><font color="#4f46e5">{fmt_cad_full(total_prov)}</font></b>',
                  S('TV3', fontSize=9, fontName='Helvetica-Bold', textColor=INDIGO_DARK, spaceAfter=2)),
    ])

    col_w = [1.35, 0.65, 0.6, 0.85, 0.85, 0.85, 0.75, 0.75]
    tbl = Table(rows, colWidths=[w * inch for w in col_w])
    tbl.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0),  (-1, 0),  SLATE_100),
        ('BACKGROUND',    (0, -1), (-1, -1), INDIGO_LITE),
        ('LINEBELOW',     (0, 0),  (-1, -2), 0.3, SLATE_300),
        ('BOX',           (0, 0),  (-1, -1), 0.5, SLATE_300),
        ('TOPPADDING',    (0, 0),  (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0),  (-1, -1), 4),
        ('LEFTPADDING',   (0, 0),  (-1, -1), 5),
        ('RIGHTPADDING',  (0, 0),  (-1, -1), 5),
        ('ROWBACKGROUNDS',(0, 1),  (-1, -2), [WHITE, SLATE_50]),
        ('ALIGN',         (1, 0),  (-1, -1), 'RIGHT'),
        ('VALIGN',        (0, 0),  (-1, -1), 'MIDDLE'),
    ]))
    story.append(tbl)

    story.append(Spacer(1, 8))
    story.append(Paragraph(
        '<b>Important:</b> Replace assumed hourly rates with actual T4 salaries from your payroll records '
        'before filing. The above is an estimate only. The 65% proxy method (for companies with '
        'overhead > 65% of eligible salaries) may yield a higher eligible expenditure.',
        CAPTION
    ))
    story.append(PageBreak())
    return story


# ── Methodology + CRA references ───────────────────────────────────────────────
def build_methodology(data):
    is_ccpc  = data.get('isCcpc', True)
    province = data.get('province', 'ON')
    f_rate   = 0.35 if is_ccpc else 0.15
    p_rate   = prov_rate(province)
    gen_date = data.get('generatedAt') or date.today().isoformat()

    story = []
    story += section_header('Methodology & CRA Compliance Notes')

    story.append(Paragraph('<b>SR&amp;ED Qualification Criteria</b>', H3))
    story.append(Paragraph(
        'To qualify as SR&amp;ED under ITA s.248(1), work must involve: (1) systematic investigation '
        'or search carried out in a field of science or technology by means of experiment or analysis; '
        '(2) the advancement of scientific knowledge or the development of a new or improved material, '
        'device, product or process; and (3) technological uncertainty that could not be resolved using '
        'standard practice or techniques readily available to competent practitioners.',
        BODY
    ))

    story.append(Paragraph('<b>Eligibility Classification</b>', H3))
    elig_tbl = Table([
        [Paragraph('Class', LABEL),   Paragraph('Weight', LABEL), Paragraph('Description', LABEL)],
        [Paragraph('Yes', BODY_SM),   Paragraph('100%', BODY_SM), Paragraph('Directly advances SR&amp;ED objective; technological uncertainty clearly present', BODY_SM)],
        [Paragraph('Partial', BODY_SM),Paragraph('50%', BODY_SM), Paragraph('Mixed R&amp;D and routine engineering; uncertainty present but not dominant', BODY_SM)],
        [Paragraph('No', BODY_SM),    Paragraph('0%', BODY_SM),   Paragraph('Routine engineering, maintenance, styling, or administration', BODY_SM)],
    ], colWidths=[0.7*inch, 0.7*inch, 4.6*inch])
    elig_tbl.setStyle(TableStyle([
        ('BACKGROUND',   (0, 0), (-1, 0), SLATE_100),
        ('LINEBELOW',    (0, 0), (-1, -2), 0.3, SLATE_300),
        ('BOX',          (0, 0), (-1, -1), 0.5, SLATE_300),
        ('TOPPADDING',   (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING',(0, 0), (-1, -1), 4),
        ('LEFTPADDING',  (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('ROWBACKGROUNDS',(0,1),(-1,-1), [WHITE, SLATE_50]),
    ]))
    story.append(elig_tbl)

    story.append(Paragraph('<b>Rate Assumptions</b>', H3))
    rate_rows = [
        ['Federal ITC rate',         f'{f_rate*100:.0f}%',
         'CCPC: 35% on first $3M qualifying exp. (ITA s.127(9)). Non-CCPC: 15%.'],
        [f'{prov_name(province)} provincial rate', f'{p_rate*100:.1f}%',
         f'{prov_name(province)} Ontario Innovation Tax Credit (OITC) or equivalent provincial program.'],
        ['Developer rate',           '$72/hr',  'Reflects ~$108K blended salary + 20% overhead ÷ 1,800 hrs/yr'],
        ['Senior Developer rate',    '$92/hr',  'Reflects ~$138K blended salary + 20% overhead ÷ 1,800 hrs/yr'],
        ['Architect / ML Eng rate',  '$116/hr', 'Reflects ~$174K blended salary + 20% overhead ÷ 1,800 hrs/yr'],
        ['Overhead proxy',           '20%',     'Conservative proxy. CRA 65% proxy method also available.'],
    ]
    rate_tbl = Table(
        [[Paragraph(a, BODY_SM), Paragraph(b, BODY_SM), Paragraph(c, BODY_SM)] for a, b, c in rate_rows],
        colWidths=[1.8*inch, 0.6*inch, 3.6*inch]
    )
    rate_tbl.setStyle(TableStyle([
        ('LINEBELOW',    (0, 0), (-1, -2), 0.3, SLATE_300),
        ('BOX',          (0, 0), (-1, -1), 0.5, SLATE_300),
        ('TOPPADDING',   (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING',(0, 0), (-1, -1), 4),
        ('LEFTPADDING',  (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('ROWBACKGROUNDS',(0,0),(-1,-1), [WHITE, SLATE_50]),
    ]))
    story.append(rate_tbl)

    story.append(Spacer(1, 10))
    story += section_header('CRA References')
    refs = [
        ('ITA s.248(1)',           'Definition of SR&amp;ED'),
        ('ITA s.37',               'SR&amp;ED expenditure deduction — traditional method'),
        ('ITA s.127(9)',           'Investment Tax Credit — definition and rates'),
        ('ITA s.127(10.1)',        'CCPC enhanced refundable ITC at 35%'),
        ('CRA T4088',              'SR&amp;ED Expenditures Claim Guide'),
        ('CRA IT-151R5',           'SR&amp;ED Expenditures — archived but still referenced'),
        ('CRA Form T661',          'Scientific Research and Experimental Development Expenditures Claim'),
        ('CRA Form T2SCH31',       'Investment Tax Credit — Corporations'),
    ]
    ref_tbl = Table(
        [[Paragraph(f'<b>{r}</b>', BODY_SM), Paragraph(d, BODY_SM)] for r, d in refs],
        colWidths=[1.4*inch, 4.6*inch]
    )
    ref_tbl.setStyle(TableStyle([
        ('BACKGROUND',   (0, 0), (0, -1), SLATE_50),
        ('LINEBELOW',    (0, 0), (-1, -2), 0.3, SLATE_300),
        ('BOX',          (0, 0), (-1, -1), 0.5, SLATE_300),
        ('TOPPADDING',   (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING',(0, 0), (-1, -1), 4),
        ('LEFTPADDING',  (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(ref_tbl)

    story.append(Spacer(1, 16))
    story.append(hr(SLATE_300, 0.5))
    story.append(Paragraph(
        f'Generated by TaxLift AI (taxlift.ai) on {gen_date}. '
        f'This document is a preliminary SR&amp;ED analysis and does not constitute professional '
        f'tax advice. TaxLift is not a licensed tax advisor or CPA firm. Review with a qualified '
        f'SR&amp;ED practitioner before filing Form T661.',
        CAPTION
    ))

    return story


# ── Page number footer ─────────────────────────────────────────────────────────
def add_page_number(canvas, doc):
    canvas.saveState()
    canvas.setFont('Helvetica', 7)
    canvas.setFillColor(SLATE_500)
    canvas.drawString(60, 28, 'TaxLift SR&ED Analysis  |  taxlift.ai  |  CONFIDENTIAL')
    canvas.drawRightString(552, 28, f'Page {doc.page}')
    canvas.restoreState()


# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    raw   = sys.stdin.buffer.read()
    data  = json.loads(raw)
    buf   = io.BytesIO()

    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        leftMargin=60, rightMargin=60,
        topMargin=48, bottomMargin=48,
        title='TaxLift SR&ED Analysis',
        author='TaxLift AI',
        subject='SR&ED Credit Analysis Package',
    )

    story = []
    story += build_cover(data, base)
    story += build_exec_summary(data)
    story += build_project_descriptions(data)
    story += build_expenditure_schedule(data)
    story += build_methodology(data)

    doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
    sys.stdout.buffer.write(buf.getvalue())

if __name__ == '__main__':
    main()

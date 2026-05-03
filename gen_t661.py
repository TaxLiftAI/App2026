"""
gen_t661.py — TaxLift Sample T661 CPA Package
Matches the style from TaxLift_Sample_T661_Package.pdf (uploaded reference).
Adds TaxLift icon logo + Proudly Canadian badge to header.
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether,
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.lib.utils import ImageReader
from PIL import Image, ImageDraw
import io
import math

OUT = '/sessions/jolly-sharp-fermi/mnt/CREDIBLE/TaxLift_Sample_T661_Package.pdf'

# ── Palette ────────────────────────────────────────────────────────────────────
NAVY    = colors.HexColor('#0F1B2A')
INDIGO  = colors.HexColor('#5B6EF5')
GREEN   = colors.HexColor('#22c55e')
SLATE   = colors.HexColor('#475569')
SLATE_L = colors.HexColor('#64748B')
LIGHT   = colors.HexColor('#F8FAFC')
BORDER  = colors.HexColor('#E2E8F0')
RED_CA  = colors.HexColor('#DC2626')
AMBER   = colors.HexColor('#F59E0B')
WHITE   = colors.white

W, H = letter  # 612 × 792

# ── Styles ─────────────────────────────────────────────────────────────────────
styles = getSampleStyleSheet()

def S(name, **kw):
    return ParagraphStyle(name, **kw)

h_page  = S('HP',  fontSize=22, fontName='Helvetica-Bold', textColor=NAVY, spaceAfter=4,  leading=26)
h_sub   = S('HS',  fontSize=10, fontName='Helvetica',      textColor=SLATE, spaceAfter=14, leading=14)
h2      = S('H2',  fontSize=14, fontName='Helvetica-Bold', textColor=INDIGO, spaceAfter=6, spaceBefore=14, leading=18)
h3      = S('H3',  fontSize=11, fontName='Helvetica-Bold', textColor=INDIGO, spaceAfter=4, spaceBefore=10, leading=14)
body    = S('BD',  fontSize=9.5, fontName='Helvetica', textColor=colors.HexColor('#1E293B'),
            spaceAfter=8, leading=15, alignment=TA_JUSTIFY)
label   = S('LB',  fontSize=8,  fontName='Helvetica-Bold', textColor=SLATE_L, spaceAfter=1, leading=11)
value   = S('VL',  fontSize=9.5,fontName='Helvetica', textColor=NAVY, spaceAfter=4, leading=13)
small   = S('SM',  fontSize=8,  fontName='Helvetica', textColor=SLATE_L, spaceAfter=2, leading=11)
note    = S('NT',  fontSize=8.5,fontName='Helvetica', textColor=SLATE, spaceAfter=4, leading=12, alignment=TA_JUSTIFY)
center  = S('CT',  fontSize=9,  fontName='Helvetica', textColor=SLATE, alignment=TA_CENTER, leading=12)

# ── PIL-rendered assets (RGB, no alpha — avoids mask complexity) ───────────────
_NAVY_BG = (15, 27, 42)     # matches NAVY header for TaxLift icon
_RED     = (220, 38, 38)
_WHT     = (255, 255, 255)
_INDIGO  = (91, 110, 245)
_OFFWHT  = (240, 240, 240)  # slightly grey so flag centre shows on white pill


def _buf(img):
    b = io.BytesIO(); img.save(b, 'PNG'); b.seek(0); return ImageReader(b)


def _make_taxlift_icon(S=480):
    """NAVY bg + INDIGO rounded rect + 3 white bars + white arrow. RGB, no alpha."""
    img = Image.new('RGB', (S, S), _NAVY_BG)
    d = ImageDraw.Draw(img)
    pad = S // 12
    d.rounded_rectangle([pad, pad, S-1-pad, S-1-pad], radius=S//8, fill=_INDIGO)
    base = int(S * 0.82); bw = int(S * 0.14)
    for bx, bh in [(0.22, 0.28), (0.45, 0.44), (0.68, 0.60)]:
        cx = int(S * bx); h = int(S * bh)
        d.rectangle([cx - bw//2, base - h, cx + bw//2, base], fill=_WHT)
    # Solid up-arrow on the right bar
    tx = int(S * 0.68)
    d.polygon([(tx, int(S*0.11)), (tx-int(S*0.11), int(S*0.25)), (tx+int(S*0.11), int(S*0.25))], fill=_WHT)
    return _buf(img)


def _make_flag_image(px_w=576, px_h=288):
    """Canadian flag at 6× LANCZOS-downsampled. Off-white centre so it reads on white bg."""
    SC = 6; W, H = px_w*SC, px_h*SC
    img = Image.new('RGB', (W, H), _OFFWHT)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W//4-1, H], fill=_RED)
    d.rectangle([3*W//4, 0, W, H],  fill=_RED)
    # Maple leaf — fan triangulation from centre
    cx, cy, r = W//2, H//2, int(H*0.38)
    def px(p): return (int(cx+p[0]*r), int(cy-p[1]*r))
    C = (cx, cy)
    pts = []
    for lo, no in [((0.00, 1.00),(0.18, 0.55)), ((0.43, 0.70),(0.38, 0.36)),
                   ((0.75, 0.23),(0.42, 0.00)), ((0.55,-0.30),(0.14,-0.44)),
                   ((-0.55,-0.30),(-0.14,-0.44)), ((-0.75, 0.23),(-0.42, 0.00)),
                   ((-0.43, 0.70),(-0.38, 0.36))]:
        pts.extend([lo, no])
    pts.append((0.00, -0.85))
    for i in range(len(pts)):
        d.polygon([C, px(pts[i]), px(pts[(i+1)%len(pts)])], fill=_RED)
    sw = max(4, int(r*0.09))
    d.rectangle([cx-sw, int(cy+r*0.44), cx+sw, int(cy+r*0.85)], fill=_RED)
    # Thin border so flag is legible on white pill bg
    d.rectangle([0, 0, W-1, H-1], outline=(180, 20, 20), width=SC*2)
    img = img.resize((px_w, px_h), Image.LANCZOS)
    return _buf(img)


_TL_ICON  = _make_taxlift_icon()
_FLAG_IMG = _make_flag_image()


def draw_taxlift_logo(canvas, x, y, scale=1.0):
    size = 20 * scale
    canvas.drawImage(_TL_ICON, x, y - size * 0.05, width=size, height=size)


def draw_proudly_canadian(canvas, x, y):
    badge_w, badge_h = 116, 16
    canvas.setFillColor(WHITE); canvas.setStrokeColor(RED_CA); canvas.setLineWidth(0.8)
    canvas.roundRect(x, y, badge_w, badge_h, badge_h/2, fill=1, stroke=1)
    flag_w, flag_h = 20, 10
    canvas.drawImage(_FLAG_IMG, x+5, y+(badge_h-flag_h)/2, width=flag_w, height=flag_h)
    canvas.setFillColor(RED_CA); canvas.setFont('Helvetica-Bold', 6.5)
    canvas.drawString(x+29, y+5.0, 'Proudly Canadian')

# ── Header / footer ────────────────────────────────────────────────────────────
def on_page(canvas, doc):
    canvas.saveState()

    # ── Top header bar ──────────────────────────────────────────────────────────
    canvas.setFillColor(NAVY)
    canvas.rect(0, H - 34, W, 34, fill=1, stroke=0)

    # TaxLift icon logo
    draw_taxlift_logo(canvas, 0.45*inch, H - 28, scale=1.1)

    # "TaxLift" wordmark
    canvas.setFont('Helvetica-Bold', 13)
    canvas.setFillColor(WHITE)
    canvas.drawString(0.45*inch + 24, H - 21, 'TaxLift')

    # Tagline
    canvas.setFont('Helvetica', 9)
    canvas.setFillColor(colors.HexColor('#94A3B8'))
    canvas.drawString(0.45*inch + 72, H - 21, '—  SR&ED Automation for Canadian Tech Companies')

    # Right: contact
    canvas.setFont('Helvetica', 8.5)
    canvas.setFillColor(colors.HexColor('#94A3B8'))
    canvas.drawRightString(W - 0.45*inch, H - 20, 'taxlift.ai  |  hello@taxlift.ai')


    # ── Footer ──────────────────────────────────────────────────────────────────
    canvas.setFillColor(colors.HexColor('#F1F5F9'))
    canvas.rect(0, 0, W, 22, fill=1, stroke=0)
    canvas.setFont('Helvetica', 7.5)
    canvas.setFillColor(SLATE_L)
    canvas.drawString(0.45*inch, 7, 'CONFIDENTIAL — Sample output for evaluation purposes only. Company details are fictitious.')
    canvas.drawRightString(W - 0.45*inch, 7, f'Page {doc.page}')

    canvas.restoreState()

# ── Helpers ────────────────────────────────────────────────────────────────────
def HR(color=BORDER, thickness=0.5, sb=8, sa=8):
    return HRFlowable(width='100%', thickness=thickness, color=color,
                      spaceAfter=sa, spaceBefore=sb)

def info_table(rows):
    """Two-column label/value table for company info."""
    data = [[Paragraph(r[0], label), Paragraph(str(r[1]), value)] for r in rows]
    t = Table(data, colWidths=[1.6*inch, 5.9*inch])
    t.setStyle(TableStyle([
        ('ROWBACKGROUNDS', (0,0), (-1,-1), [LIGHT, WHITE]),
        ('BOX',           (0,0), (-1,-1), 0.5, BORDER),
        ('INNERGRID',     (0,0), (-1,-1), 0.5, BORDER),
        ('TOPPADDING',    (0,0), (-1,-1), 7),
        ('BOTTOMPADDING', (0,0), (-1,-1), 7),
        ('LEFTPADDING',   (0,0), (-1,-1), 10),
        ('RIGHTPADDING',  (0,0), (-1,-1), 10),
        ('VALIGN',        (0,0), (-1,-1), 'TOP'),
    ]))
    return t

def section_label(txt):
    """Indigo small-caps section label like 'Project 1 of 2'."""
    return Paragraph(f'<font color="#5B6EF5"><b>{txt}</b></font>', S('SL', fontSize=9,
        fontName='Helvetica-Bold', textColor=INDIGO, spaceAfter=4, leading=12))

def line_header(line_num, title):
    return Paragraph(f'<font color="#5B6EF5">Line {line_num} — {title}</font>',
                     S('LH', fontSize=10, fontName='Helvetica-Bold', textColor=INDIGO,
                       spaceAfter=4, spaceBefore=10, leading=14))

def proj_title(title):
    return Paragraph(title, S('PT', fontSize=14, fontName='Helvetica-Bold', textColor=NAVY,
                              spaceAfter=6, spaceBefore=4, leading=18))

# ── Document ───────────────────────────────────────────────────────────────────
doc = SimpleDocTemplate(
    OUT,
    pagesize=letter,
    leftMargin=0.55*inch, rightMargin=0.55*inch,
    topMargin=0.72*inch, bottomMargin=0.48*inch,
    title='TaxLift SR&ED Filing Package — Sample Document',
    author='TaxLift AI',
    subject='SR&ED T661 Claim Package (Sample)',
)

story = []

# ══════════════════════════════════════════════════════════════════════════════
# PAGE 1 — COVER
# ══════════════════════════════════════════════════════════════════════════════
story.append(Spacer(1, 0.15*inch))
story.append(Paragraph('SR&amp;ED Filing Package', h_page))
story.append(Paragraph('Prepared by TaxLift — for CPA review and filing', h_sub))
story.append(HR(INDIGO, 1.5, sb=2, sa=10))

story.append(info_table([
    ('Client',           '[ Redacted — Sample Document ]'),
    ('CRA BN',           '789 012 345 RC 0001'),
    ('T661 Tax Year',    '2024 (fiscal year ending December 31, 2024)'),
    ('Claim Type',       'SR&ED performed for own use — ITA s.37(1)'),
    ('Province',         'Ontario'),
    ('Entity Type',      'Canadian-Controlled Private Corporation (CCPC)'),
    ('ITC Rate',         '35% refundable (first $3M qualified expenditures) — ITA s.127.1'),
    ('Expenditure Limit','$3,000,000 — no associated/related companies noted'),
    ('Prepared by',      'TaxLift Inc. — taxlift.ai'),
    ('Date Generated',   'April 29, 2025'),
    ('Status',           'DRAFT — Pending CPA review, adjustment, and signing'),
]))

story.append(Spacer(1, 16))
story.append(Paragraph('About this package', h2))
story.append(Paragraph(
    'This package was generated by TaxLift by analyzing GitHub commit history and Jira tickets for the fiscal '
    'year ending December 31, 2024. It contains CRA-compliant SR&amp;ED project narratives (T661 Part 2, '
    'Lines 242/244/246), a financial expenditure schedule, and a cryptographic evidence chain linking each '
    'qualifying commit to its SR&amp;ED activity. Narratives were generated following CRA\'s '
    '<i>Guidelines for Scientific Research and Experimental Development</i> (IC86-4R3) and structured '
    'per the T4088 guide. The signing CPA is responsible for reviewing all content, exercising professional '
    'judgment, and filing with the Canada Revenue Agency.',
    body))

story.append(Spacer(1, 4))
story.append(Paragraph('Package contents', h2))

contents_data = [
    [Paragraph('Section', S('TH', fontSize=9, fontName='Helvetica-Bold', textColor=WHITE, leading=12)),
     Paragraph('Description', S('TH', fontSize=9, fontName='Helvetica-Bold', textColor=WHITE, leading=12)),
     Paragraph('Pages', S('TH', fontSize=9, fontName='Helvetica-Bold', textColor=WHITE, alignment=TA_CENTER, leading=12))],
    [Paragraph('1. Project Narratives', value), Paragraph('T661 Part 2 — Lines 242, 244, 246 for 2 SR&amp;ED projects', small), Paragraph('2–4', center)],
    [Paragraph('2. Financial Schedule', value), Paragraph('SR&amp;ED expenditures by category (wages, materials, contracts)', small), Paragraph('5', center)],
    [Paragraph('3. Credit Estimate', value), Paragraph('ITC calculation — CCPC refundable rate', small), Paragraph('5', center)],
    [Paragraph('4. Evidence Chain', value), Paragraph('SHA-256 commit hashes linked to SR&amp;ED activities', small), Paragraph('6', center)],
]

ct = Table(contents_data, colWidths=[2.0*inch, 4.7*inch, 0.8*inch])
ct.setStyle(TableStyle([
    ('BACKGROUND',    (0,0), (-1,0), NAVY),
    ('ROWBACKGROUNDS',(0,1), (-1,-1), [LIGHT, WHITE]),
    ('BOX',           (0,0), (-1,-1), 0.5, BORDER),
    ('INNERGRID',     (0,0), (-1,-1), 0.5, BORDER),
    ('TOPPADDING',    (0,0), (-1,-1), 7),
    ('BOTTOMPADDING', (0,0), (-1,-1), 7),
    ('LEFTPADDING',   (0,0), (-1,-1), 10),
    ('ALIGN',         (2,0), (2,-1), 'CENTER'),
    ('VALIGN',        (0,0), (-1,-1), 'MIDDLE'),
]))
story.append(ct)

story.append(PageBreak())

# ══════════════════════════════════════════════════════════════════════════════
# PAGE 2-3 — PROJECT NARRATIVES
# ══════════════════════════════════════════════════════════════════════════════
story.append(Paragraph('Section 1 — SR&amp;ED Project Narratives', h_page))
story.append(Paragraph('T661 Part 2 — Lines 242, 244, 246', h_sub))
story.append(HR(INDIGO, 1.5, sb=2, sa=10))

# ── PROJECT 1 ──────────────────────────────────────────────────────────────────
story.append(section_label('Project 1 of 2'))
story.append(proj_title('PRJ-2024-001 — Adaptive Real-Time Anomaly Detection Engine'))

story.append(info_table([
    ('Project ID',        'PRJ-2024-001'),
    ('Title',             'Adaptive Real-Time Anomaly Detection Engine'),
    ('Period',            'January 2024 – September 2024'),
    ('Status (Line 200)', 'Completed within the fiscal year'),
    ('SR&ED Type',        'Experimental development — ITA s.248(1)'),
    ('Tech Lead',         'Aisha Patel, Senior ML Engineer'),
    ('GitHub Commits',    '1,240 commits linked to this project'),
    ('SR&ED Hours',       '1,240 hours claimed'),
]))

story.append(Spacer(1, 8))

story.append(line_header('242', 'Scientific or Technological Uncertainty'))
story.append(Paragraph(
    'The Company set out to develop a real-time anomaly detection engine capable of sub-50ms '
    'inference on commodity cloud hardware for production financial streaming workloads. It was '
    'technologically uncertain at the outset whether transformer-based architectures could be adapted '
    'to process non-stationary streaming data with sufficient temporal context at latencies compatible '
    'with real-time fraud prevention SLAs. Existing published models required batch lookahead and '
    'GPU infrastructure, making them inapplicable to the streaming, on-premise deployment context. '
    'It was further uncertain whether concept-drift detection could be embedded directly into the '
    'attention mechanism without disrupting gradient flow during online fine-tuning, and whether '
    'a Bayesian adaptive-window approach could reduce false positives by more than 35% while '
    'maintaining Type I error below 2% under adversarial injection.',
    body))

story.append(line_header('244', 'Work Performed'))
story.append(Paragraph(
    'The engineering team conducted systematic experimentation across three phases. In Phase 1 '
    '(Q1 2024), the team performed a literature review of 23 transformer variants, developed a '
    'reproducible benchmarking harness on synthetic streaming data, and established baselines across '
    '4 candidate architectures. In Phase 2 (Q2–Q3 2024), 6 experimental model configurations '
    'were implemented combining sliding-window attention with embedded drift detection; 128 controlled '
    'experiments were run on a 12-node cluster with 90-day historical transaction replay; ablation '
    'studies isolated the contribution of each component. In Phase 3 (Q4 2024), a synthetic adversarial '
    'dataset was developed using gradient-based perturbation, and validation of Type I error was '
    'conducted under 3 attack modes. Results, failures, and design decisions were tracked in 1,240 '
    'GitHub commits and 87 Jira tickets across the project timeline.',
    body))

story.append(line_header('246', 'Scientific or Technological Advancement'))
story.append(Paragraph(
    'The project achieved sub-48ms inference on non-GPU c6i hardware (uncertainty resolved), '
    'a 41% reduction in false positives vs. the fixed-threshold baseline via embedded drift detection '
    '(uncertainty resolved), and adversarial robustness at 1.8% Type I error rate under all three '
    'attack modes (uncertainty resolved). The embedded drift detection approach represents a novel '
    'contribution not found in prior published literature for streaming financial workloads. '
    'The engine is integrated into the Company\'s core product and processes approximately '
    '4M transactions per day.',
    body))

story.append(HR(sb=10, sa=6))

# ── PROJECT 2 ──────────────────────────────────────────────────────────────────
story.append(section_label('Project 2 of 2'))
story.append(proj_title('PRJ-2024-002 — Low-Latency Vector Embedding Pipeline'))

story.append(info_table([
    ('Project ID',        'PRJ-2024-002'),
    ('Title',             'Low-Latency Vector Embedding Pipeline'),
    ('Period',            'March 2024 – December 2024'),
    ('Status (Line 200)', 'Ongoing — work continued past fiscal year end'),
    ('SR&ED Type',        'Experimental development — ITA s.248(1)'),
    ('Tech Lead',         'Marcus Chen, Infrastructure Engineer'),
    ('GitHub Commits',    '708 commits linked to this project'),
    ('SR&ED Hours',       '720 hours claimed'),
]))

story.append(Spacer(1, 8))

story.append(line_header('242', 'Scientific or Technological Uncertainty'))
story.append(Paragraph(
    'The team undertook development of an internal semantic similarity pipeline required to process '
    'financial transaction descriptions at throughputs exceeding 50,000 documents per second on '
    'AWS c6i instances. No existing open-source embedding library met this specification during '
    'scoping. Three specific uncertainties existed: (1) whether adaptive input batching by '
    'token-count similarity would yield meaningful throughput gains or be negated by NUMA memory '
    'allocation overhead on c6i architecture; (2) whether FP16 quantization of BERT-family models '
    'would preserve cosine similarity fidelity above 0.98 on financial-domain vocabulary, which '
    'is not covered in existing quantization research; (3) whether a content-addressable cache '
    'keyed on raw input hash would achieve acceptable hit rates on high-cardinality financial '
    'transaction data.',
    body))

story.append(line_header('244', 'Work Performed'))
story.append(Paragraph(
    'Phase 1 (Q1 2024): Benchmarked 5 existing embedding libraries across latency, throughput, '
    'and quality dimensions on c6i.4xlarge. All failed to meet the 50K docs/sec threshold. '
    'Root-cause analysis identified tokenization as 62% of latency budget. Phase 2 (Q2 2024): '
    'Designed and tested adaptive batching algorithm; 47 experiments varying batch size '
    'distribution and queue depth; achieved 54,200 docs/sec — uncertainty (1) resolved. '
    'Phase 3 (Q3 2024): FP16 quantization experiments on 2.1M anonymized transactions; cosine '
    'similarity fidelity measured at 0.991 at p99 — uncertainty (2) resolved. '
    'Phase 4 (Q4 2024): Content-addressable cache A/B testing on production replay; cache hit '
    'rate of 34% (vs. predicted 12%) — uncertainty (3) resolved. Combined pipeline '
    'delivered 58,400 docs/sec at p99 latency of 18ms.',
    body))

story.append(line_header('246', 'Scientific or Technological Advancement'))
story.append(Paragraph(
    'The adaptive batching algorithm and content-addressable embedding cache represent novel '
    'contributions to high-throughput NLP infrastructure for financial workloads. The combination '
    'of FP16 quantization with financial-domain validation at production scale has not been '
    'documented in prior published benchmarks. The pipeline processes approximately 2.8M documents '
    'daily in the Company\'s production environment and has been adopted as the internal '
    'standard for all similarity-matching features.',
    body))

story.append(PageBreak())

# ══════════════════════════════════════════════════════════════════════════════
# PAGE 4 — FINANCIAL SCHEDULE & CREDIT ESTIMATE
# ══════════════════════════════════════════════════════════════════════════════
story.append(Paragraph('Section 2 — Financial Schedule &amp; Credit Estimate', h_page))
story.append(Paragraph('SR&amp;ED qualified expenditures by category — Proxy Method (ITA s.37(8)(a)(ii)(B))', h_sub))
story.append(HR(INDIGO, 1.5, sb=2, sa=10))

exp_headers = ['Expenditure Category', 'PRJ-2024-001', 'PRJ-2024-002', 'Total']
exp_rows = [
    ('SR&ED Salaries (T4)',             '$195,000', '$120,000', '$315,000'),
    ('SR&ED Contractors (T4A)',          '$48,000',  '$18,000',  '$66,000'),
    ('SR&ED Materials & Cloud Compute',  '$28,500',  '$18,000',  '$46,500'),
    ('Total Qualified Expenditures',     '$271,500', '$156,000', '$427,500'),
]

def exp_cell(txt, bold=False, right=False):
    return Paragraph(f'<b>{txt}</b>' if bold else txt,
                     S('EC', fontSize=9, fontName='Helvetica-Bold' if bold else 'Helvetica',
                       textColor=NAVY, leading=13,
                       alignment=TA_RIGHT if right else TA_LEFT))

exp_data = [[exp_cell(h, bold=True) for h in exp_headers]]
for i, row in enumerate(exp_rows):
    bold = i == len(exp_rows) - 1
    exp_data.append([exp_cell(row[0], bold), exp_cell(row[1], bold, right=True),
                     exp_cell(row[2], bold, right=True), exp_cell(row[3], bold, right=True)])

exp_t = Table(exp_data, colWidths=[3.2*inch, 1.4*inch, 1.4*inch, 1.5*inch], repeatRows=1)
exp_t.setStyle(TableStyle([
    ('BACKGROUND',    (0,0), (-1,0), NAVY),
    ('TEXTCOLOR',     (0,0), (-1,0), WHITE),
    ('ROWBACKGROUNDS',(0,1), (-1,-2), [LIGHT, WHITE]),
    ('BACKGROUND',    (0,-1),(-1,-1), colors.HexColor('#F0FDF4')),
    ('BOX',           (0,0), (-1,-1), 0.5, BORDER),
    ('INNERGRID',     (0,0), (-1,-1), 0.5, BORDER),
    ('TOPPADDING',    (0,0), (-1,-1), 7),
    ('BOTTOMPADDING', (0,0), (-1,-1), 7),
    ('LEFTPADDING',   (0,0), (-1,-1), 10),
    ('RIGHTPADDING',  (0,0), (-1,-1), 10),
    ('ALIGN',         (1,0), (-1,-1), 'RIGHT'),
    ('VALIGN',        (0,0), (-1,-1), 'MIDDLE'),
]))
story.append(exp_t)

story.append(Spacer(1, 8))

# Salary allocation detail table
sal_data = [
    [Paragraph(h, S('TH', fontSize=8.5, fontName='Helvetica-Bold', textColor=WHITE, leading=11)) for h in
     ['Employee', 'Role', 'T4 Salary', 'SR&ED %', 'Qualified Amount', 'Project']],
    [Paragraph('Aisha Patel', value), Paragraph('Sr. ML Engineer', small), Paragraph('$180,000', small),
     Paragraph('90%', small), Paragraph('$162,000', small), Paragraph('PRJ-2024-001', small)],
    [Paragraph('Marcus Chen', value), Paragraph('Infrastructure Eng.', small), Paragraph('$155,000', small),
     Paragraph('75%', small), Paragraph('$116,250', small), Paragraph('PRJ-2024-002', small)],
    [Paragraph('R. Okafor', value), Paragraph('Data Scientist (PT)', small), Paragraph('$90,000', small),
     Paragraph('60%', small), Paragraph('$36,750', small), Paragraph('Both', small)],
    [Paragraph('<b>Total SR&amp;ED Salaries</b>', S('TB', fontSize=8.5, fontName='Helvetica-Bold', textColor=NAVY, leading=11)),
     Paragraph('', small), Paragraph('<b>$425,000</b>', S('TB', fontSize=8.5, fontName='Helvetica-Bold', textColor=NAVY, alignment=TA_RIGHT, leading=11)),
     Paragraph('', small), Paragraph('<b>$315,000</b>', S('TB', fontSize=8.5, fontName='Helvetica-Bold', textColor=NAVY, alignment=TA_RIGHT, leading=11)),
     Paragraph('', small)],
]
sal_t = Table(sal_data, colWidths=[1.25*inch, 1.35*inch, 0.85*inch, 0.6*inch, 1.15*inch, 1.25*inch])
sal_t.setStyle(TableStyle([
    ('BACKGROUND',    (0,0), (-1,0), NAVY),
    ('ROWBACKGROUNDS',(0,1), (-1,-2), [LIGHT, WHITE]),
    ('BACKGROUND',    (0,-1),(-1,-1), colors.HexColor('#F0FDF4')),
    ('BOX',           (0,0), (-1,-1), 0.5, BORDER),
    ('INNERGRID',     (0,0), (-1,-1), 0.5, BORDER),
    ('TOPPADDING',    (0,0), (-1,-1), 5), ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ('LEFTPADDING',   (0,0), (-1,-1), 8), ('RIGHTPADDING',  (0,0), (-1,-1), 8),
    ('ALIGN',         (2,0), (-1,-1), 'RIGHT'), ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
]))
story.append(sal_t)

story.append(Spacer(1, 6))
story.append(Paragraph(
    '<b>Proxy method calculation (ITA s.37(8)(a)(ii)(B)):</b> SR&amp;ED salaries $315,000 × 65% proxy '
    '= $204,750 deemed overhead. Total qualified expenditures = salaries $315,000 + contractors $66,000 '
    '+ materials $46,500 = $427,500. SR&amp;ED allocation percentages are based on TaxLift commit-frequency '
    'analysis and Jira sprint records. <b>CPA must cross-reference T4/T4A slips and confirm percentages '
    'with time logs before signing.</b>',
    note))

story.append(Spacer(1, 8))
story.append(Paragraph('ITC Calculation — CCPC Refundable Rate', h2))

itc_data = [
    [Paragraph('Credit Component', S('TH', fontSize=9, fontName='Helvetica-Bold', textColor=WHITE, leading=12)),
     Paragraph('Rate', S('TH', fontSize=9, fontName='Helvetica-Bold', textColor=WHITE, alignment=TA_CENTER, leading=12)),
     Paragraph('Base', S('TH', fontSize=9, fontName='Helvetica-Bold', textColor=WHITE, alignment=TA_RIGHT, leading=12)),
     Paragraph('Credit', S('TH', fontSize=9, fontName='Helvetica-Bold', textColor=WHITE, alignment=TA_RIGHT, leading=12))],
    [Paragraph('Federal ITC — CCPC Enhanced Rate (Refundable)', value), Paragraph('35%', center), Paragraph('$427,500', S('R', fontSize=9.5, fontName='Helvetica', textColor=NAVY, alignment=TA_RIGHT, leading=13)), Paragraph('<b>$149,625</b>', S('R', fontSize=9.5, fontName='Helvetica-Bold', textColor=GREEN, alignment=TA_RIGHT, leading=13))],
    [Paragraph('Ontario Innovation Tax Credit (OITC) — Refundable', value), Paragraph('8%', center), Paragraph('$427,500', S('R', fontSize=9.5, fontName='Helvetica', textColor=NAVY, alignment=TA_RIGHT, leading=13)), Paragraph('<b>$34,200</b>', S('R', fontSize=9.5, fontName='Helvetica-Bold', textColor=colors.HexColor('#3B82F6'), alignment=TA_RIGHT, leading=13))],
    [Paragraph('<b>Total Estimated Refundable Credits</b>', S('TB', fontSize=9.5, fontName='Helvetica-Bold', textColor=NAVY, leading=13)), Paragraph('', center), Paragraph('', center), Paragraph('<b>$183,825</b>', S('R', fontSize=11, fontName='Helvetica-Bold', textColor=INDIGO, alignment=TA_RIGHT, leading=14))],
]

itc_t = Table(itc_data, colWidths=[3.6*inch, 0.7*inch, 1.2*inch, 1.95*inch])
itc_t.setStyle(TableStyle([
    ('BACKGROUND',    (0,0), (-1,0), NAVY),
    ('ROWBACKGROUNDS',(0,1), (-1,-2), [LIGHT, WHITE]),
    ('BACKGROUND',    (0,-1),(-1,-1), colors.HexColor('#EEF2FF')),
    ('BOX',           (0,0), (-1,-1), 0.5, BORDER),
    ('INNERGRID',     (0,0), (-1,-1), 0.5, BORDER),
    ('TOPPADDING',    (0,0), (-1,-1), 8),
    ('BOTTOMPADDING', (0,0), (-1,-1), 8),
    ('LEFTPADDING',   (0,0), (-1,-1), 10),
    ('RIGHTPADDING',  (0,0), (-1,-1), 10),
    ('ALIGN',         (1,0), (-1,-1), 'RIGHT'),
    ('VALIGN',        (0,0), (-1,-1), 'MIDDLE'),
]))
story.append(itc_t)

story.append(PageBreak())

# ══════════════════════════════════════════════════════════════════════════════
# PAGE 5 — EVIDENCE CHAIN
# ══════════════════════════════════════════════════════════════════════════════
story.append(Paragraph('Section 4 — Evidence Chain', h_page))
story.append(Paragraph('SHA-256 commit hashes linked to SR&amp;ED activities', h_sub))
story.append(HR(INDIGO, 1.5, sb=2, sa=10))

story.append(Paragraph(
    'TaxLift generates a tamper-evident evidence chain by computing a SHA-256 hash of each '
    'qualifying commit and anchoring the aggregate fingerprint at the time of package generation. '
    'Any modification to the commit history after this point will invalidate the chain. '
    'CRA auditors may request the full evidence appendix, which includes raw commit logs, '
    'Jira ticket links, and developer attestation forms.',
    body))

ev_headers = ['Commit Hash (truncated)', 'Date', 'Author', 'Repository', 'SR&ED Project', 'Score']
ev_rows = [
    ('a3f92c1d…', 'Jan 08 2024', 'A. Patel',  'synapse-core',   'PRJ-2024-001', '94'),
    ('b7e01fa2…', 'Jan 22 2024', 'M. Chen',   'synapse-core',   'PRJ-2024-001', '91'),
    ('c4d88e3b…', 'Feb 14 2024', 'A. Patel',  'synapse-core',   'PRJ-2024-001', '88'),
    ('d91c77a4…', 'Mar 03 2024', 'M. Chen',   'embed-pipeline', 'PRJ-2024-002', '86'),
    ('e05b22f5…', 'Apr 17 2024', 'R. Okafor', 'synapse-core',   'PRJ-2024-001', '90'),
    ('f3a14d96…', 'May 29 2024', 'M. Chen',   'embed-pipeline', 'PRJ-2024-002', '87'),
    ('g8812ca7…', 'Jun 11 2024', 'A. Patel',  'synapse-core',   'PRJ-2024-001', '93'),
    ('h24f91b8…', 'Jul 30 2024', 'R. Okafor', 'embed-pipeline', 'PRJ-2024-002', '85'),
    ('i7709de9…', 'Sep 05 2024', 'A. Patel',  'synapse-core',   'PRJ-2024-001', '96'),
    ('j3311fa0…', 'Oct 22 2024', 'M. Chen',   'embed-pipeline', 'PRJ-2024-002', '89'),
    ('k5504ab1…', 'Nov 14 2024', 'A. Patel',  'synapse-core',   'PRJ-2024-001', '92'),
    ('l8823cd2…', 'Dec 10 2024', 'R. Okafor', 'embed-pipeline', 'PRJ-2024-002', '84'),
]

def ec(txt, bold=False, c=NAVY):
    return Paragraph(txt, S('EV', fontSize=8.5, fontName='Helvetica-Bold' if bold else 'Helvetica',
                             textColor=c, leading=12))

ev_data = [[ec(h, bold=True, c=WHITE) for h in ev_headers]]
for row in ev_rows:
    ev_data.append([ec(row[0], c=INDIGO), ec(row[1]), ec(row[2]), ec(row[3]),
                    ec(row[4]), ec(row[5], c=GREEN)])
ev_data.append([Paragraph(
    '… 1,956 additional qualifying commits not shown — available in full evidence export',
    S('MORE', fontSize=8, fontName='Helvetica', textColor=SLATE_L, leading=11)
)] + [Paragraph('', small)] * 5)

ev_t = Table(ev_data, colWidths=[1.15*inch, 0.85*inch, 0.85*inch, 1.25*inch, 1.1*inch, 0.55*inch], repeatRows=1)
ev_t.setStyle(TableStyle([
    ('BACKGROUND',    (0,0), (-1,0), NAVY),
    ('ROWBACKGROUNDS',(0,1), (-1,-2), [WHITE, LIGHT]),
    ('BACKGROUND',    (0,-1),(-1,-1), colors.HexColor('#FFFBEB')),
    ('SPAN',          (0,-1),(-1,-1)),
    ('BOX',           (0,0), (-1,-1), 0.5, BORDER),
    ('INNERGRID',     (0,0), (-1,-1), 0.3, BORDER),
    ('TOPPADDING',    (0,0), (-1,-1), 5),
    ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ('LEFTPADDING',   (0,0), (-1,-1), 7),
    ('RIGHTPADDING',  (0,0), (-1,-1), 7),
    ('ALIGN',         (-1,0),(-1,-1), 'CENTER'),
    ('VALIGN',        (0,0), (-1,-1), 'MIDDLE'),
]))
story.append(ev_t)

story.append(Spacer(1, 10))
story.append(Table([[
    Paragraph('<b>Package Fingerprint (SHA-256)</b>', label),
    Paragraph('a7d3f91b2c44e8059d1a6bfc3e72891d04a5c7b3e21f6d98b0c4f55a2e8901dc3',
              S('FP', fontSize=8.5, fontName='Helvetica', textColor=INDIGO, leading=13)),
]], colWidths=[2.1*inch, 5.4*inch],
style=TableStyle([
    ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#EEF2FF')),
    ('BOX',        (0,0), (-1,-1), 0.5, INDIGO),
    ('TOPPADDING', (0,0), (-1,-1), 8),
    ('BOTTOMPADDING', (0,0), (-1,-1), 8),
    ('LEFTPADDING',   (0,0), (-1,-1), 10),
    ('VALIGN',        (0,0), (-1,-1), 'MIDDLE'),
])))

story.append(PageBreak())

# ── CPA CERTIFICATION BLOCK ────────────────────────────────────────────────────
story.append(Paragraph('Section 5 — CPA Review &amp; Certification', h_page))
story.append(Paragraph('To be completed and signed by the filing CPA before submission to CRA', h_sub))
story.append(HR(INDIGO, 1.5, sb=2, sa=10))

story.append(Paragraph(
    'I have reviewed the SR&amp;ED project narratives, financial schedules, and evidence chain contained '
    'in this package. I am satisfied that, to the best of my knowledge, the work described meets the '
    'definition of SR&amp;ED under ITA s.248(1), the expenditures are properly calculated under the '
    'Proxy Method (ITA s.37(8)(a)(ii)(B)), and the ITC claim is consistent with ITA s.127 and s.127.1. '
    'I have exercised independent professional judgment and made all adjustments I consider necessary.',
    body))

sign_data = [
    [Paragraph('CPA Name', label), Paragraph('', value),
     Paragraph('CPA Registration #', label), Paragraph('', value)],
    [Paragraph('Firm Name', label), Paragraph('', value),
     Paragraph('Province of Practice', label), Paragraph('', value)],
    [Paragraph('Date of Review', label), Paragraph('', value),
     Paragraph('Date of Filing', label), Paragraph('', value)],
    [Paragraph('Signature', label), Paragraph('', value),
     Paragraph('Client Approval', label), Paragraph('', value)],
]
sign_t = Table(sign_data, colWidths=[1.2*inch, 2.7*inch, 1.5*inch, 2.05*inch])
sign_t.setStyle(TableStyle([
    ('BOX',           (0,0), (-1,-1), 0.5, BORDER),
    ('INNERGRID',     (0,0), (-1,-1), 0.5, BORDER),
    ('TOPPADDING',    (0,0), (-1,-1), 16),
    ('BOTTOMPADDING', (0,0), (-1,-1), 16),
    ('LEFTPADDING',   (0,0), (-1,-1), 10),
    ('ROWBACKGROUNDS',(0,0), (-1,-1), [LIGHT, WHITE]),
    ('VALIGN',        (0,0), (-1,-1), 'BOTTOM'),
]))
story.append(sign_t)

story.append(Spacer(1, 12))
story.append(Paragraph('CPA Pre-Filing Checklist', h2))

checklist_items = [
    ('T4/T4A slips verified against salary allocation table', '☐'),
    ('SR&ED time allocation percentages confirmed with employee time logs', '☐'),
    ('Project uncertainties are technological (not commercial) in nature', '☐'),
    ('Work performed is systematic investigation or experimental development', '☐'),
    ('No expenditures claimed are on the excluded activities list (ITA s.248(1))', '☐'),
    ('Contractor payments confirmed as arm\'s length (or 80% rule applied)', '☐'),
    ('Materials are consumed or transformed (not capital)', '☐'),
    ('$3M expenditure limit confirmed — no associated corporations', '☐'),
    ('OITC eligibility confirmed (taxable capital < $25M; Ontario payroll ≥ threshold)', '☐'),
    ('T661 filed within 12 months of corporation\'s filing deadline (ITA s.37(11))', '☐'),
    ('T2SCH31 Investment Tax Credit schedule completed and cross-referenced', '☐'),
    ('Client has reviewed and approved all narratives and figures', '☐'),
]

ck_data = [[Paragraph(item, S('CK', fontSize=9, fontName='Helvetica', textColor=NAVY, leading=13)),
            Paragraph(box, S('CB', fontSize=11, fontName='Helvetica', textColor=INDIGO, leading=13, alignment=TA_CENTER))]
           for item, box in checklist_items]
ck_t = Table(ck_data, colWidths=[7.0*inch, 0.5*inch])
ck_t.setStyle(TableStyle([
    ('ROWBACKGROUNDS', (0,0), (-1,-1), [LIGHT, WHITE]),
    ('BOX',           (0,0), (-1,-1), 0.5, BORDER),
    ('INNERGRID',     (0,0), (-1,-1), 0.5, BORDER),
    ('TOPPADDING',    (0,0), (-1,-1), 6), ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ('LEFTPADDING',   (0,0), (-1,-1), 10),
    ('ALIGN',         (1,0), (1,-1), 'CENTER'),
    ('VALIGN',        (0,0), (-1,-1), 'MIDDLE'),
]))
story.append(ck_t)

story.append(Spacer(1, 14))
story.append(HR(BORDER, 0.5, sb=4, sa=6))
story.append(Paragraph(
    '<b>Disclaimer:</b> This package was prepared by TaxLift AI and is provided for CPA review '
    'purposes only. It does not constitute tax advice and must be reviewed, adjusted, and filed '
    'by a licensed CPA or SR&amp;ED practitioner. TaxLift AI makes no representation as to the '
    'final CRA-approved amounts. All figures are estimates and are subject to CPA professional '
    'judgment and adjustment. <b>THIS IS A SAMPLE DOCUMENT — all company names, figures, '
    'and commit data are fictional and for illustration purposes only.</b>',
    S('DS', fontSize=7.5, fontName='Helvetica', textColor=SLATE_L, leading=11, alignment=TA_JUSTIFY)))

doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
print(f'✅  Saved → {OUT}')

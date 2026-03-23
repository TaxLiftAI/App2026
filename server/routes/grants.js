/**
 * Grants module routes
 *
 *   GET    /api/grants/eligibility               — Run/return eligibility matching (cached 30 days)
 *   POST   /api/grants/gap-answers               — Save gap fill interview answers
 *   GET    /api/grants/gap-answers               — Get current gap fill answers
 *   POST   /api/grants/applications              — Create new grant application
 *   GET    /api/grants/applications              — List all applications for user
 *   GET    /api/grants/applications/:id          — Get application + sections
 *   POST   /api/grants/applications/:id/generate — Queue section generation
 *   GET    /api/grants/applications/:id/status   — Poll generation progress
 *   PATCH  /api/grants/sections/:id/approve      — Approve a section
 *   POST   /api/grants/sections/:id/regenerate   — Regenerate a section with feedback
 *   POST   /api/grants/applications/:id/export   — Get PDF export data
 *   PATCH  /api/grants/applications/:id          — Update application (status, notes, amounts)
 */
const router = require('express').Router()
const { v4: uuid } = require('../utils/uuid')
const db = require('../db')
const { requireAuth } = require('../middleware/auth')
const axios = require('axios')

// All grants routes require auth
router.use(requireAuth)

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a SREDContext object for a given user */
function buildSREDContext(userId) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
  const profile = db.prepare('SELECT * FROM company_profiles WHERE user_id = ?').get(userId)

  const projects = db.prepare(`
    SELECT p.*,
      json_group_array(
        DISTINCT json_object(
          'id', e.id, 'category', e.category, 'amount', e.amount,
          'description', e.description, 'period', e.period
        )
      ) AS expenditures_json,
      json_group_array(
        DISTINCT json_object(
          'id', t.id, 'name', t.name, 'role', t.role,
          'time_percentage', t.time_percentage, 'qualifications', t.qualifications
        )
      ) AS team_members_json
    FROM sred_projects p
    LEFT JOIN sred_expenditures e ON e.project_id = p.id
    LEFT JOIN sred_team_members t ON t.project_id = p.id
    WHERE p.user_id = ? AND p.status = 'filed'
    GROUP BY p.id
  `).all(userId)

  const parsedProjects = projects.map(p => {
    let expenditures = []
    let team_members = []
    try { expenditures = JSON.parse(p.expenditures_json || '[]').filter(e => e.id) } catch {}
    try { team_members = JSON.parse(p.team_members_json || '[]').filter(t => t.id) } catch {}
    const { expenditures_json, team_members_json, ...rest } = p
    return { ...rest, expenditures, team_members }
  })

  const totalSpend = parsedProjects.reduce((sum, proj) =>
    sum + proj.expenditures.reduce((s, e) => s + (e.amount || 0), 0), 0)

  return {
    company: {
      id: userId,
      business_number: profile?.business_number || '',
      company_name: profile?.company_name || user?.full_name || user?.firm_name || 'Unknown Company',
      province: profile?.province || 'ON',
      employee_count: profile?.employee_count || 10,
      fiscal_year_end: profile?.fiscal_year_end || 'December',
      industry_domain: profile?.industry_domain || '',
      subscription_tier: user?.subscription_tier || 'free',
    },
    projects: parsedProjects,
    total_sred_spend: totalSpend,
  }
}

/** Grants directory — Canadian grant programs */
const GRANTS_DIRECTORY = [
  {
    grant_id: 'irap',
    grant_name: 'NRC-IRAP',
    max_funding: 500000,
    deadline: 'Rolling / advisor-dependent',
    complexity: 'med',
    eligibility_rules: {
      requires_province: null, // all provinces
      max_employees: 500,
      min_sred_spend: 0,
      industry_keywords: ['software', 'ai', 'ml', 'tech', 'saas', 'fintech', 'health', 'clean'],
      description: 'Active R&D project + <500 employees + Canadian HQ'
    },
    sections: ['project_desc', 'innovation', 'methodology', 'market', 'commercial', 'cdn_benefit', 'budget', 'team']
  },
  {
    grant_id: 'oitc',
    grant_name: 'Ontario Innovation Tax Credit',
    max_funding: 200000,
    deadline: 'Annual — Apr 30',
    complexity: 'low',
    eligibility_rules: {
      requires_province: 'ON',
      max_employees: null,
      min_sred_spend: 50000,
      industry_keywords: null,
      description: 'Province = Ontario + qualified R&D expenditures > $50K'
    },
    sections: ['project_desc', 'innovation', 'budget', 'cdn_benefit']
  },
  {
    grant_id: 'sdtc',
    grant_name: 'ISED SDTC',
    max_funding: 3000000,
    deadline: 'Quarterly intake',
    complexity: 'high',
    eligibility_rules: {
      requires_province: null,
      max_employees: null,
      min_sred_spend: 100000,
      industry_keywords: ['clean', 'sustain', 'energy', 'environ', 'climate', 'green'],
      description: 'Industry domain tagged as cleantech/sustainability'
    },
    sections: ['project_desc', 'innovation', 'methodology', 'market', 'commercial', 'cdn_benefit', 'budget', 'team']
  },
  {
    grant_id: 'ngen',
    grant_name: 'NGen Supercluster',
    max_funding: 250000,
    deadline: 'Project-based',
    complexity: 'high',
    eligibility_rules: {
      requires_province: null,
      max_employees: null,
      min_sred_spend: 50000,
      industry_keywords: ['manufactur', 'physical', 'hardware', 'iot', 'robotics', 'industrial'],
      description: 'Manufacturing or digital-physical intersection in SR&ED work'
    },
    sections: ['project_desc', 'innovation', 'methodology', 'market', 'commercial', 'cdn_benefit', 'budget', 'team']
  },
  {
    grant_id: 'bc_ignite',
    grant_name: 'BC Ignite (Provincial)',
    max_funding: 75000,
    deadline: 'Quarterly',
    complexity: 'low',
    eligibility_rules: {
      requires_province: 'BC',
      max_employees: 200,
      min_sred_spend: 0,
      industry_keywords: null,
      description: 'Province = British Columbia + active R&D project'
    },
    sections: ['project_desc', 'innovation', 'cdn_benefit', 'budget']
  },
  {
    grant_id: 'ab_innovates',
    grant_name: 'Alberta Innovates (Provincial)',
    max_funding: 150000,
    deadline: 'Rolling',
    complexity: 'med',
    eligibility_rules: {
      requires_province: 'AB',
      max_employees: null,
      min_sred_spend: 0,
      industry_keywords: null,
      description: 'Province = Alberta + active R&D project'
    },
    sections: ['project_desc', 'innovation', 'methodology', 'cdn_benefit', 'budget', 'team']
  },
  {
    grant_id: 'qc_crsng',
    grant_name: 'Québec CRSNG (Provincial)',
    max_funding: 200000,
    deadline: 'Annual',
    complexity: 'med',
    eligibility_rules: {
      requires_province: 'QC',
      max_employees: null,
      min_sred_spend: 25000,
      industry_keywords: null,
      description: 'Province = Québec + qualified R&D expenditure'
    },
    sections: ['project_desc', 'innovation', 'methodology', 'cdn_benefit', 'budget', 'team']
  }
]

/** Section metadata */
const SECTION_META = {
  project_desc: { name: 'Project Description',      target_words: 400, data_source: 'sred_only' },
  innovation:   { name: 'Innovation & Novelty',      target_words: 350, data_source: 'sred_only' },
  methodology:  { name: 'Methodology & Approach',   target_words: 450, data_source: 'sred_only' },
  market:       { name: 'Market Opportunity',        target_words: 350, data_source: 'gap_fill'  },
  commercial:   { name: 'Commercialisation Plan',    target_words: 300, data_source: 'gap_fill'  },
  cdn_benefit:  { name: 'Canadian Economic Benefit', target_words: 250, data_source: 'mixed'     },
  budget:       { name: 'Budget Justification',      target_words: 300, data_source: 'sred_only' },
  team:         { name: 'Team Qualifications',       target_words: 250, data_source: 'sred_only' },
}

/** Rule-based eligibility scoring (fallback when no Claude API key) */
function scoreEligibilityRules(ctx, grant) {
  const { company, total_sred_spend } = ctx
  const rules = grant.eligibility_rules
  const matched = []
  const missing = []
  let score = 0

  // Province check
  if (rules.requires_province) {
    if (company.province === rules.requires_province) {
      score += 30
      matched.push(`Province is ${company.province} ✓`)
    } else {
      missing.push(`Province must be ${rules.requires_province} (yours: ${company.province})`)
      return { score: 0, matched, missing, recommended: false }
    }
  } else {
    score += 20
    matched.push('All provinces eligible ✓')
  }

  // Employee count
  if (rules.max_employees) {
    if (company.employee_count <= rules.max_employees) {
      score += 25
      matched.push(`Employee count (${company.employee_count}) within limit ✓`)
    } else {
      missing.push(`Employee count (${company.employee_count}) exceeds max (${rules.max_employees})`)
      score -= 30
    }
  } else {
    score += 15
    matched.push('No employee count restriction ✓')
  }

  // SR&ED spend
  if (rules.min_sred_spend > 0) {
    if (total_sred_spend >= rules.min_sred_spend) {
      score += 25
      matched.push(`SR&ED spend ($${total_sred_spend.toLocaleString()}) meets minimum ✓`)
    } else {
      missing.push(`SR&ED spend ($${total_sred_spend.toLocaleString()}) below minimum ($${rules.min_sred_spend.toLocaleString()})`)
      score += 5
    }
  } else {
    score += 20
    matched.push('SR&ED filing confirmed ✓')
  }

  // Industry/keyword match
  if (rules.industry_keywords) {
    const domain = (company.industry_domain || '').toLowerCase()
    const projectText = ctx.projects.map(p =>
      `${p.title} ${p.technical_uncertainty} ${p.work_performed}`).join(' ').toLowerCase()
    const hasMatch = rules.industry_keywords.some(kw =>
      domain.includes(kw) || projectText.includes(kw))
    if (hasMatch) {
      score += 20
      matched.push('Industry domain aligns with program focus ✓')
    } else {
      missing.push(`Program targets ${rules.industry_keywords.slice(0, 3).join(', ')} — verify domain alignment`)
      score += 5
    }
  } else {
    score += 15
    matched.push('No industry restriction ✓')
  }

  // Has filed SR&ED projects
  if (ctx.projects.length > 0) {
    score += 5
    matched.push('Active SR&ED filing confirmed ✓')
  } else {
    missing.push('No filed SR&ED projects found')
  }

  score = Math.min(100, Math.max(0, score))
  return { score, matched, missing, recommended: score >= 60 }
}

/** Call Claude API for eligibility matching (if ANTHROPIC_API_KEY set) */
async function runClaudeEligibility(ctx) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  try {
    const prompt = `You are a Canadian grant eligibility expert. Score each grant program strictly against the company profile below. Return ONLY valid JSON, no prose, no markdown fences.

Company Profile:
${JSON.stringify(ctx.company, null, 2)}

SR&ED Projects: ${ctx.projects.length} filed projects
Total SR&ED Spend: $${ctx.total_sred_spend.toLocaleString()}
Key Technical Areas: ${ctx.projects.map(p => p.title).join(', ')}

Grant Programs to evaluate:
${JSON.stringify(GRANTS_DIRECTORY.map(g => ({
  grant_id: g.grant_id,
  grant_name: g.grant_name,
  max_funding: g.max_funding,
  deadline: g.deadline,
  complexity: g.complexity,
  eligibility_rules: g.eligibility_rules,
})), null, 2)}

Return a JSON array where each element has:
{
  "grant_id": string,
  "match_score": number (0-100),
  "matched_criteria": string[],
  "missing_fields": string[],
  "recommended": boolean
}`

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        timeout: 30000,
      }
    )

    const text = response.data.content[0].text.trim()
    // Extract JSON array from response
    const match = text.match(/\[[\s\S]*\]/)
    if (match) return JSON.parse(match[0])
    return null
  } catch (err) {
    console.error('[grants] Claude eligibility error:', err.message)
    return null
  }
}

/** Generate a single grant section using Claude or template fallback */
async function generateSection(sectionKey, grant, ctx, gapAnswers) {
  const meta = SECTION_META[sectionKey]
  const targetWords = meta?.target_words || 300

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (apiKey) {
    try {
      const sectionPrompts = buildSectionPrompt(sectionKey, grant, ctx, gapAnswers, targetWords)
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 1200,
          system: `You are an expert Canadian grant writer with 15 years of experience writing successful IRAP, SDTC, and NRC grant applications. Write clear, evidence-based content that accurately represents the SR&ED work. Do not embellish or add unsupported claims. Target exactly ${targetWords} words.`,
          messages: [{ role: 'user', content: sectionPrompts }],
        },
        {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          timeout: 45000,
        }
      )
      return response.data.content[0].text.trim()
    } catch (err) {
      console.error(`[grants] Claude section generation error (${sectionKey}):`, err.message)
      // Fall through to template
    }
  }

  // Template-based fallback
  return generateSectionTemplate(sectionKey, grant, ctx, gapAnswers)
}

/** Build Claude prompt for a specific section */
function buildSectionPrompt(sectionKey, grant, ctx, gapAnswers, targetWords) {
  const company = ctx.company
  const project = ctx.projects[0] || {}
  const expenditures = project.expenditures || []
  const teamMembers = project.team_members || []

  const baseContext = `
Grant Program: ${grant.grant_name} (max $${grant.max_funding.toLocaleString()})
Company: ${company.company_name} | Province: ${company.province} | Employees: ${company.employee_count}
Industry: ${company.industry_domain}

SR&ED Project Title: ${project.title || 'N/A'}
Technical Uncertainty: ${project.technical_uncertainty || 'N/A'}
Technical Advancement: ${project.technical_advancement || 'N/A'}
Work Performed: ${project.work_performed || 'N/A'}
Project Period: ${project.start_date || 'N/A'} to ${project.end_date || 'N/A'}
Total SR&ED Expenditures: $${ctx.total_sred_spend.toLocaleString()}
`

  const prompts = {
    project_desc: `${baseContext}
Write a ${targetWords}-word project description for the ${grant.grant_name} application. Reframe the SR&ED technical narrative for a non-CRA grant reviewer audience. Focus on the innovation, the problem being solved, and the technical achievement. Do not mention CRA or SR&ED directly.`,

    innovation: `${baseContext}
Write a ${targetWords}-word "Innovation & Novelty" section for the ${grant.grant_name} application. Emphasize what is genuinely novel about the technical approach, why existing solutions were inadequate, and what new knowledge was created. Use the technical uncertainty and advancement fields as your primary source.`,

    methodology: `${baseContext}
Write a ${targetWords}-word "Methodology & Approach" section for the ${grant.grant_name} application. Structure the work described into clear phases, milestones, and iterative experimental cycles. Demonstrate systematic investigation and scientific rigor.`,

    market: `${baseContext}
Gap Fill Answers:
Target Market: ${gapAnswers?.market_desc || 'Not provided'}
Differentiation: ${gapAnswers?.differentiation || 'Not provided'}

Write a ${targetWords}-word "Market Opportunity" section for the ${grant.grant_name} application. Describe the target market, customer pain point, market size, and why this solution is uniquely positioned to capture it.`,

    commercial: `${baseContext}
Gap Fill Answers:
Revenue Model: ${gapAnswers?.revenue_model || 'Not provided'}

Write a ${targetWords}-word "Commercialisation Plan" section for the ${grant.grant_name} application. Describe the business model, revenue strategy, and path to market. Include any traction metrics provided.`,

    cdn_benefit: `${baseContext}
Gap Fill Answers:
Canadian Economic Benefit: ${gapAnswers?.canadian_benefit || 'Not provided'}

Write a ${targetWords}-word "Canadian Economic Benefit" section for the ${grant.grant_name} application. Describe how this project creates economic value in Canada — jobs, IP ownership, exports, partnerships with Canadian institutions. Province: ${company.province}.`,

    budget: `${baseContext}
Expenditure Breakdown:
${expenditures.map(e => `- ${e.category}: $${e.amount?.toLocaleString()} — ${e.description}`).join('\n')}

Write a ${targetWords}-word "Budget Justification" section for the ${grant.grant_name} application. Map each expenditure category to the grant budget template. Justify how each cost directly supports the R&D activities.`,

    team: `${baseContext}
Team Members:
${teamMembers.map(t => `- ${t.name}, ${t.role} (${t.time_percentage}% time): ${t.qualifications}`).join('\n')}

Write a ${targetWords}-word "Team Qualifications" section for the ${grant.grant_name} application. Present each team member's relevant expertise and their specific contribution to the R&D project.`,
  }

  return prompts[sectionKey] || `Write a ${targetWords}-word ${sectionKey} section for the ${grant.grant_name} grant application based on the SR&ED data provided.`
}

/** Template-based section generation (no Claude API) */
function generateSectionTemplate(sectionKey, grant, ctx, gapAnswers) {
  const company = ctx.company
  const project = ctx.projects[0] || {}
  const expenditures = project.expenditures || []
  const teamMembers = project.team_members || []

  const templates = {
    project_desc: `${company.company_name} undertook a systematic program of R&D to advance the state of ${company.industry_domain || 'technology'}. The project, "${project.title || 'Advanced R&D Initiative'}", addressed a fundamental technical challenge: ${project.technical_uncertainty || 'developing novel technical capabilities that were not achievable using standard practice'}.

Through rigorous experimentation and systematic investigation, the team ${project.technical_advancement ? `achieved the following advancement: ${project.technical_advancement}` : 'made significant advances in the state of knowledge within the field'}.

${project.work_performed ? `The experimental work involved: ${project.work_performed}` : 'The work was conducted through iterative experimentation, hypothesis testing, and systematic validation against measurable technical benchmarks.'}

This project is directly aligned with ${grant.grant_name}'s mandate to support innovative Canadian companies advancing technology boundaries. The outcomes represent a concrete advancement of technical capabilities in the ${company.industry_domain || 'technology'} sector.`,

    innovation: `The innovation in "${project.title || 'this R&D project'}" lies in addressing a previously unsolved technical challenge. ${project.technical_uncertainty || 'The core uncertainty involved whether the proposed technical approach could achieve the desired outcomes given the constraints of the problem domain.'}

Prior art review confirmed that existing solutions, methods, and published literature did not provide a solution path. The technical gap was not addressable by routine engineering practice or straightforward application of existing knowledge.

The technical advancement achieved — ${project.technical_advancement || 'developing novel capabilities that advance the state of practice in the field'} — represents original work that did not previously exist. This creates new intellectual property and new knowledge that can be built upon by future R&D efforts.

The novelty is further evidenced by the systematic investigation approach: the team formulated hypotheses, designed controlled experiments, and iterated based on empirical results — the hallmark of genuine R&D rather than routine development.`,

    methodology: `The R&D methodology followed a structured, iterative process aligned with scientific best practices:

Phase 1 — Problem Definition and Baseline (${project.start_date?.split('-')[0] || '2024'}): The team established the technical baseline, reviewed relevant literature, and defined measurable success criteria. Existing solutions were benchmarked to quantify the performance gap.

Phase 2 — Hypothesis Development and Experiment Design: Based on the baseline analysis, the team formulated technical hypotheses and designed controlled experiments to test each approach. Experimental parameters were defined with clear success/failure criteria.

Phase 3 — Systematic Experimentation and Iteration: ${project.work_performed || 'The team executed a series of controlled experiments, analysing results and refining approaches based on empirical evidence. Each iteration built on prior findings in a structured learning loop.'}

Phase 4 — Validation and Knowledge Capture: Results were validated against pre-defined benchmarks. The technical knowledge gained was documented, creating the foundation for future product development and further R&D.`,

    market: `${gapAnswers?.market_desc ? `Target Market: ${gapAnswers.market_desc}

` : ''}${company.company_name} operates in the ${company.industry_domain || 'technology'} sector, addressing a significant market need. The solution developed through this R&D project is designed for ${gapAnswers?.market_desc || 'organisations facing the technical challenges addressed by this research'}.

The market opportunity is substantial and growing, driven by increasing demand for innovative solutions that the company's technology uniquely addresses. ${gapAnswers?.differentiation ? `What differentiates this solution: ${gapAnswers.differentiation}` : 'The technical advances achieved through this R&D program create a defensible competitive position in the market.'}

With ${company.employee_count} employees and operations headquartered in ${company.province}, Canada, the company is well-positioned to capture market share and scale the commercialisation of these R&D outcomes.`,

    commercial: `${gapAnswers?.revenue_model ? `Revenue Model: ${gapAnswers.revenue_model}

` : ''}${company.company_name} has developed a clear commercialisation strategy to convert the R&D outcomes into sustainable revenue. ${gapAnswers?.revenue_model || 'The company generates revenue through direct product sales and service contracts with enterprise customers.'}

The commercialisation roadmap follows a structured path from R&D completion to market deployment:

1. Product development and integration of R&D outcomes into commercial offering
2. Beta deployment with early-adopter customers for market validation
3. Commercial launch and scaling of go-to-market activities
4. Expansion across Canadian market and international markets, with particular focus on export opportunities

The ${grant.grant_name} funding will accelerate this timeline by providing resources to complete development and reach commercial milestones sooner than self-funded timelines would allow.`,

    cdn_benefit: `This R&D project generates significant and measurable Canadian economic benefit:

${gapAnswers?.canadian_benefit ? `${gapAnswers.canadian_benefit}

` : ''}**Jobs and Employment**: The project directly employs ${Math.min(company.employee_count, 15)} highly skilled Canadians in ${company.province}, with plans to add additional positions as commercialisation proceeds.

**Canadian IP Ownership**: All intellectual property developed through this project is owned and will remain owned by ${company.company_name}, a Canadian company. This IP will be developed and commercialised from Canada.

**Provincial Economic Impact**: Based in ${company.province}, the company contributes to the local innovation ecosystem through employment, procurement from local suppliers, and collaboration with regional institutions.

**Long-term Canadian Benefit**: Successful commercialisation will generate export revenue into the Canadian economy, with ${company.company_name} positioned as a Canadian-headquartered global competitor in the ${company.industry_domain || 'technology'} sector.`,

    budget: `The total R&D expenditure of $${ctx.total_sred_spend.toLocaleString()} is allocated as follows:

${expenditures.length > 0
  ? expenditures.map(e =>
    `**${e.category} — $${e.amount?.toLocaleString()}**\n${e.description}. These costs are directly attributable to the R&D activities described and represent ${Math.round((e.amount / ctx.total_sred_spend) * 100)}% of total project expenditure.`
  ).join('\n\n')
  : `**Salaries and Wages**: The majority of expenditure represents highly qualified personnel directly engaged in R&D activities. All staff time claimed has been tracked against specific experimental activities.

**Materials and Supplies**: Costs of materials consumed in the experimental process, including compute resources, testing infrastructure, and direct materials.

**Sub-contractor Costs**: Specialist expertise engaged for specific components of the R&D work where external knowledge was required.`}

All expenditures were incurred in Canada and are directly traceable to the R&D activities described in this application. Budget allocation reflects the systematic, resource-intensive nature of the experimental work conducted.`,

    team: `${company.company_name} assembled a team with the precise combination of expertise required to address the technical challenges of this R&D project:

${teamMembers.length > 0
  ? teamMembers.map(t =>
    `**${t.name} — ${t.role}** (${t.time_percentage}% allocated to this project)\n${t.qualifications}`
  ).join('\n\n')
  : `The R&D team comprises highly qualified researchers and engineers with deep expertise in ${company.industry_domain || 'the relevant technical domain'}. Each team member brings specific skills directly applicable to the technical challenges addressed by this project. The team's combined experience spans both theoretical knowledge and practical R&D execution, ensuring the project is conducted with scientific rigour and technical depth appropriate for genuine advancement of the state of knowledge.`}

The team's qualifications, combined with their focused allocation to this project, ensure that the R&D work is conducted at the highest standard and that the technical outcomes are credible, reproducible, and build meaningfully on prior knowledge in the field.`,
  }

  return templates[sectionKey] || `This section will be completed based on the SR&ED data and company profile for the ${grant.grant_name} application.`
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/grants/eligibility
router.get('/eligibility', async (req, res) => {
  const userId = req.user.id
  const forceRefresh = req.query.refresh === 'true'

  // Check 30-day cache
  if (!forceRefresh) {
    const cached = db.prepare(`
      SELECT result, cached_at FROM eligibility_cache WHERE user_id = ?
    `).get(userId)

    if (cached) {
      const cachedAt = new Date(cached.cached_at)
      const age = (Date.now() - cachedAt.getTime()) / (1000 * 60 * 60 * 24)
      if (age < 30) {
        const result = JSON.parse(cached.result)
        return res.json({ ...result, cached: true, cached_at: cached.cached_at })
      }
    }
  }

  try {
    const ctx = buildSREDContext(userId)

    // Try Claude first, fall back to rule-based
    let claudeResults = await runClaudeEligibility(ctx)

    let eligibilityResults
    if (claudeResults && Array.isArray(claudeResults)) {
      // Merge Claude scores with our grant directory
      eligibilityResults = GRANTS_DIRECTORY.map(grant => {
        const claudeResult = claudeResults.find(r => r.grant_id === grant.grant_id)
        return {
          grant_id: grant.grant_id,
          grant_name: grant.grant_name,
          max_funding: grant.max_funding,
          deadline: grant.deadline,
          complexity: grant.complexity,
          match_score: claudeResult?.match_score ?? 0,
          matched_criteria: claudeResult?.matched_criteria ?? [],
          missing_fields: claudeResult?.missing_fields ?? [],
          recommended: claudeResult?.recommended ?? false,
        }
      })
    } else {
      // Rule-based fallback
      eligibilityResults = GRANTS_DIRECTORY.map(grant => {
        const scoring = scoreEligibilityRules(ctx, grant)
        return {
          grant_id: grant.grant_id,
          grant_name: grant.grant_name,
          max_funding: grant.max_funding,
          deadline: grant.deadline,
          complexity: grant.complexity,
          match_score: scoring.score,
          matched_criteria: scoring.matched,
          missing_fields: scoring.missing,
          recommended: scoring.recommended,
        }
      })
    }

    // Sort by match_score descending
    eligibilityResults.sort((a, b) => b.match_score - a.match_score)

    const totalPotential = eligibilityResults
      .filter(g => g.recommended)
      .reduce((sum, g) => sum + g.max_funding, 0)

    const result = {
      grants: eligibilityResults,
      company: ctx.company,
      total_potential_funding: totalPotential,
      sred_projects_count: ctx.projects.length,
      total_sred_spend: ctx.total_sred_spend,
      ai_powered: !!process.env.ANTHROPIC_API_KEY,
    }

    // Upsert cache
    const existingCache = db.prepare('SELECT id FROM eligibility_cache WHERE user_id = ?').get(userId)
    const now = new Date().toISOString()
    if (existingCache) {
      db.prepare('UPDATE eligibility_cache SET result = ?, cached_at = ? WHERE user_id = ?')
        .run(JSON.stringify(result), now, userId)
    } else {
      db.prepare('INSERT INTO eligibility_cache (id, user_id, result, cached_at) VALUES (?, ?, ?, ?)')
        .run(uuid(), userId, JSON.stringify(result), now)
    }

    res.json({ ...result, cached: false, cached_at: now })
  } catch (err) {
    console.error('[grants] eligibility error:', err)
    res.status(500).json({ message: 'Failed to run eligibility matching', detail: err.message })
  }
})

// GET /api/grants/gap-answers
router.get('/gap-answers', (req, res) => {
  const answers = db.prepare('SELECT * FROM gap_answers WHERE user_id = ?').get(req.user.id)
  res.json(answers || { user_id: req.user.id, market_desc: null, revenue_model: null, canadian_benefit: null, differentiation: null })
})

// POST /api/grants/gap-answers
router.post('/gap-answers', (req, res) => {
  const { market_desc, revenue_model, canadian_benefit, differentiation } = req.body ?? {}
  const userId = req.user.id
  const now = new Date().toISOString()

  const existing = db.prepare('SELECT id FROM gap_answers WHERE user_id = ?').get(userId)

  if (existing) {
    db.prepare(`
      UPDATE gap_answers
      SET market_desc = ?, revenue_model = ?, canadian_benefit = ?, differentiation = ?, updated_at = ?
      WHERE user_id = ?
    `).run(market_desc || null, revenue_model || null, canadian_benefit || null, differentiation || null, now, userId)
  } else {
    const id = uuid()
    db.prepare(`
      INSERT INTO gap_answers (id, user_id, market_desc, revenue_model, canadian_benefit, differentiation, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, market_desc || null, revenue_model || null, canadian_benefit || null, differentiation || null, now)
  }

  const answers = db.prepare('SELECT * FROM gap_answers WHERE user_id = ?').get(userId)
  res.json(answers)
})

// GET /api/grants/applications
router.get('/applications', (req, res) => {
  const applications = db.prepare(`
    SELECT ga.*,
      (SELECT COUNT(*) FROM grant_sections gs WHERE gs.application_id = ga.id) as section_count,
      (SELECT COUNT(*) FROM grant_sections gs WHERE gs.application_id = ga.id AND gs.status = 'approved') as approved_count
    FROM grant_applications ga
    WHERE ga.user_id = ?
    ORDER BY ga.created_at DESC
  `).all(req.user.id)

  res.json({ applications })
})

// POST /api/grants/applications
router.post('/applications', (req, res) => {
  const { grant_id, sred_project_ids = [] } = req.body ?? {}

  if (!grant_id) return res.status(400).json({ message: 'grant_id is required' })

  const grant = GRANTS_DIRECTORY.find(g => g.grant_id === grant_id)
  if (!grant) return res.status(400).json({ message: `Unknown grant_id: ${grant_id}` })

  const id = uuid()
  db.prepare(`
    INSERT INTO grant_applications (id, user_id, grant_id, grant_name, sred_project_ids, status)
    VALUES (?, ?, ?, ?, ?, 'draft')
  `).run(id, req.user.id, grant_id, grant.grant_name, JSON.stringify(sred_project_ids))

  // Create section stubs
  const insertSection = db.prepare(`
    INSERT INTO grant_sections (id, application_id, section_key, section_name, status, data_source)
    VALUES (?, ?, ?, ?, 'pending', ?)
  `)
  grant.sections.forEach(sectionKey => {
    const meta = SECTION_META[sectionKey]
    insertSection.run(uuid(), id, sectionKey, meta?.name || sectionKey, meta?.data_source || 'sred_only')
  })

  const application = db.prepare('SELECT * FROM grant_applications WHERE id = ?').get(id)
  const sections = db.prepare('SELECT * FROM grant_sections WHERE application_id = ? ORDER BY rowid').all(id)
  res.status(201).json({ ...application, sections })
})

// GET /api/grants/applications/:id
router.get('/applications/:id', (req, res) => {
  const app = db.prepare('SELECT * FROM grant_applications WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id)
  if (!app) return res.status(404).json({ message: 'Application not found' })

  const sections = db.prepare('SELECT * FROM grant_sections WHERE application_id = ? ORDER BY rowid').all(req.params.id)
  res.json({ ...app, sections, sred_project_ids: JSON.parse(app.sred_project_ids || '[]') })
})

// POST /api/grants/applications/:id/generate
router.post('/applications/:id/generate', async (req, res) => {
  const app = db.prepare('SELECT * FROM grant_applications WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id)
  if (!app) return res.status(404).json({ message: 'Application not found' })

  const grant = GRANTS_DIRECTORY.find(g => g.grant_id === app.grant_id)
  if (!grant) return res.status(400).json({ message: 'Grant program not found in directory' })

  // Update application status to 'generating'
  db.prepare("UPDATE grant_applications SET status = 'generating' WHERE id = ?").run(app.id)

  // Mark all sections as 'generating'
  db.prepare("UPDATE grant_sections SET status = 'generating' WHERE application_id = ?").run(app.id)

  // Return immediately — generation happens async
  res.json({ job_id: app.id, message: 'Generation started', status: 'generating' })

  // Generate sections asynchronously (fire and forget)
  setImmediate(async () => {
    try {
      const ctx = buildSREDContext(req.user.id)
      const gapAnswers = db.prepare('SELECT * FROM gap_answers WHERE user_id = ?').get(req.user.id)
      const sections = db.prepare('SELECT * FROM grant_sections WHERE application_id = ? ORDER BY rowid').all(app.id)

      for (const section of sections) {
        try {
          db.prepare("UPDATE grant_sections SET status = 'generating' WHERE id = ?").run(section.id)

          const content = await generateSection(section.section_key, grant, ctx, gapAnswers)
          const wordCount = content.split(/\s+/).filter(Boolean).length

          db.prepare(`
            UPDATE grant_sections
            SET content = ?, status = 'ready', word_count = ?
            WHERE id = ?
          `).run(content, wordCount, section.id)
        } catch (err) {
          console.error(`[grants] Section generation failed for ${section.section_key}:`, err.message)
          db.prepare("UPDATE grant_sections SET status = 'error' WHERE id = ?").run(section.id)
        }
      }

      // Check if all sections completed
      const errorSections = db.prepare("SELECT COUNT(*) as n FROM grant_sections WHERE application_id = ? AND status = 'error'").get(app.id)
      const newStatus = errorSections.n > 0 ? 'needs_review' : 'ready'
      db.prepare("UPDATE grant_applications SET status = ? WHERE id = ?").run(newStatus, app.id)

    } catch (err) {
      console.error('[grants] Generation pipeline error:', err.message)
      db.prepare("UPDATE grant_applications SET status = 'error' WHERE id = ?").run(app.id)
    }
  })
})

// GET /api/grants/applications/:id/status
router.get('/applications/:id/status', (req, res) => {
  const app = db.prepare('SELECT * FROM grant_applications WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id)
  if (!app) return res.status(404).json({ message: 'Application not found' })

  const sections = db.prepare('SELECT id, section_key, section_name, status FROM grant_sections WHERE application_id = ? ORDER BY rowid').all(req.params.id)

  const counts = {
    total: sections.length,
    pending: sections.filter(s => s.status === 'pending').length,
    generating: sections.filter(s => s.status === 'generating').length,
    ready: sections.filter(s => s.status === 'ready').length,
    approved: sections.filter(s => s.status === 'approved').length,
    error: sections.filter(s => s.status === 'error').length,
  }

  res.json({ application_id: app.id, status: app.status, sections, counts })
})

// PATCH /api/grants/sections/:id/approve
router.patch('/sections/:id/approve', (req, res) => {
  const section = db.prepare(`
    SELECT gs.* FROM grant_sections gs
    JOIN grant_applications ga ON ga.id = gs.application_id
    WHERE gs.id = ? AND ga.user_id = ?
  `).get(req.params.id, req.user.id)

  if (!section) return res.status(404).json({ message: 'Section not found' })

  const now = new Date().toISOString()
  db.prepare("UPDATE grant_sections SET status = 'approved', approved_at = ? WHERE id = ?")
    .run(now, section.id)

  // Check if all sections approved → advance application to 'ready_to_export'
  const notApproved = db.prepare(`
    SELECT COUNT(*) as n FROM grant_sections
    WHERE application_id = ? AND status != 'approved'
  `).get(section.application_id)

  if (notApproved.n === 0) {
    db.prepare("UPDATE grant_applications SET status = 'ready_to_export' WHERE id = ?")
      .run(section.application_id)
  }

  const updated = db.prepare('SELECT * FROM grant_sections WHERE id = ?').get(section.id)
  res.json(updated)
})

// POST /api/grants/sections/:id/regenerate
router.post('/sections/:id/regenerate', async (req, res) => {
  const { feedback_note = '' } = req.body ?? {}

  const section = db.prepare(`
    SELECT gs.*, ga.grant_id FROM grant_sections gs
    JOIN grant_applications ga ON ga.id = gs.application_id
    WHERE gs.id = ? AND ga.user_id = ?
  `).get(req.params.id, req.user.id)

  if (!section) return res.status(404).json({ message: 'Section not found' })

  const grant = GRANTS_DIRECTORY.find(g => g.grant_id === section.grant_id)

  // Save current version to history
  if (section.content) {
    db.prepare(`
      INSERT INTO section_versions (id, section_id, content, feedback_note)
      VALUES (?, ?, ?, ?)
    `).run(uuid(), section.id, section.content, feedback_note)
  }

  // Mark as generating
  db.prepare("UPDATE grant_sections SET status = 'generating', feedback_note = ? WHERE id = ?")
    .run(feedback_note || null, section.id)

  res.json({ message: 'Regeneration started', section_id: section.id })

  // Async regeneration
  setImmediate(async () => {
    try {
      const ctx = buildSREDContext(req.user.id)
      const gapAnswers = db.prepare('SELECT * FROM gap_answers WHERE user_id = ?').get(req.user.id)

      let content
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (apiKey && section.content && feedback_note) {
        // Regeneration with feedback via Claude
        try {
          const originalPrompt = buildSectionPrompt(section.section_key, grant, ctx, gapAnswers, SECTION_META[section.section_key]?.target_words || 300)
          const response = await axios.post(
            'https://api.anthropic.com/v1/messages',
            {
              model: 'claude-3-5-haiku-20241022',
              max_tokens: 1200,
              system: 'You are an expert Canadian grant writer. Rewrite the section addressing the feedback provided. Keep all accurate SR&ED facts. Return only the rewritten section — no commentary.',
              messages: [
                { role: 'user', content: originalPrompt },
                { role: 'assistant', content: section.content },
                { role: 'user', content: `Founder feedback: "${feedback_note}"\n\nRewrite the section addressing this feedback. Keep all accurate SR&ED facts. Same word limit. Return only the rewritten section.` }
              ],
            },
            {
              headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
              },
              timeout: 45000,
            }
          )
          content = response.data.content[0].text.trim()
        } catch (err) {
          console.error('[grants] Regen with feedback error:', err.message)
          content = await generateSection(section.section_key, grant, ctx, gapAnswers)
        }
      } else {
        content = await generateSection(section.section_key, grant, ctx, gapAnswers)
      }

      const wordCount = content.split(/\s+/).filter(Boolean).length
      db.prepare("UPDATE grant_sections SET content = ?, status = 'ready', word_count = ? WHERE id = ?")
        .run(content, wordCount, section.id)
    } catch (err) {
      console.error('[grants] Regen error:', err.message)
      db.prepare("UPDATE grant_sections SET status = 'error' WHERE id = ?").run(section.id)
    }
  })
})

// POST /api/grants/applications/:id/export
router.post('/applications/:id/export', (req, res) => {
  const app = db.prepare('SELECT * FROM grant_applications WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id)
  if (!app) return res.status(404).json({ message: 'Application not found' })

  const sections = db.prepare('SELECT * FROM grant_sections WHERE application_id = ? ORDER BY rowid').all(req.params.id)
  const ctx = buildSREDContext(req.user.id)
  const grant = GRANTS_DIRECTORY.find(g => g.grant_id === app.grant_id)

  // Build export data (PDF generation on frontend or text export)
  const exportData = {
    application_id: app.id,
    grant_name: app.grant_name,
    grant_id: app.grant_id,
    company_name: ctx.company.company_name,
    business_number: ctx.company.business_number,
    province: ctx.company.province,
    fiscal_year_end: ctx.company.fiscal_year_end,
    exported_at: new Date().toISOString(),
    sections: sections.map(s => ({
      section_key: s.section_key,
      section_name: s.section_name,
      content: s.content || '',
      data_source: s.data_source,
      word_count: s.word_count,
    })),
    max_funding: grant?.max_funding,
    deadline: grant?.deadline,
  }

  res.json(exportData)
})

// PATCH /api/grants/applications/:id
router.patch('/applications/:id', (req, res) => {
  const app = db.prepare('SELECT * FROM grant_applications WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id)
  if (!app) return res.status(404).json({ message: 'Application not found' })

  const allowed = ['status', 'submitted_at', 'amount_requested', 'amount_awarded', 'notes']
  const updates = []
  const values = []

  allowed.forEach(field => {
    if (req.body?.[field] !== undefined) {
      updates.push(`${field} = ?`)
      values.push(req.body[field])
    }
  })

  if (updates.length === 0) return res.status(400).json({ message: 'No valid fields to update' })

  values.push(req.params.id)
  db.prepare(`UPDATE grant_applications SET ${updates.join(', ')} WHERE id = ?`).run(...values)

  const updated = db.prepare('SELECT * FROM grant_applications WHERE id = ?').get(req.params.id)
  res.json(updated)
})

// GET /api/grants/directory
router.get('/directory', (req, res) => {
  res.json({ grants: GRANTS_DIRECTORY.map(g => ({
    grant_id: g.grant_id,
    grant_name: g.grant_name,
    max_funding: g.max_funding,
    deadline: g.deadline,
    complexity: g.complexity,
    description: g.eligibility_rules.description,
  })) })
})

// GET /api/grants/sred-context
router.get('/sred-context', (req, res) => {
  try {
    const ctx = buildSREDContext(req.user.id)
    res.json(ctx)
  } catch (err) {
    res.status(500).json({ message: 'Failed to build SR&ED context', detail: err.message })
  }
})

module.exports = router

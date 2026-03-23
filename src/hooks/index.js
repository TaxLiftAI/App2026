/**
 * Domain hooks — each wraps the API client with mock-data fallback.
 *
 * Import example:
 *   import { useClusters, useCluster, useReportSummary } from '../hooks'
 */
import { useMemo } from 'react'
import { useApiData, useMutation } from './useApi'
import * as api from '../lib/api'
import {
  CLUSTERS, EVIDENCE_SNAPSHOTS, NARRATIVES, DOCUMENTS,
  USERS, getVaultStats,
} from '../data/mockData'

// ─── Helper: normalise a backend cluster to the same shape as mock data ────────
function normCluster(c) {
  return {
    ...c,
    // backend uses snake_case — mock uses camelCase aliases
    id: c.id,
    business_component: c.business_component,
    status: c.status,
    risk_score: c.risk_score,
    aggregate_time_hours: c.aggregate_time_hours,
    estimated_credit_cad: c.estimated_credit_cad,
    estimated_credit_usd: c.estimated_credit_usd,
    eligibility_percentage: c.eligibility_percentage,
    created_at: c.created_at,
    stale_context: c.stale_context ?? false,
    proxy_used: c.proxy_used ?? false,
    proxy_confidence: c.proxy_confidence ?? null,
    manual_override_pct: c.manual_override_pct ?? null,
    manual_override_reason: c.manual_override_reason ?? null,
    trigger_rules: c.trigger_rules ?? [],
    narrative_id: c.narrative_id ?? null,
    evidence_snapshot_id: c.evidence_snapshot_id ?? null,
  }
}

// ─── Clusters ─────────────────────────────────────────────────────────────────
export function useClusters(filters = {}) {
  const params = useMemo(() => ({
    status:   filters.status   !== 'All' ? filters.status   : undefined,
    risk_min: filters.riskMin  ?? undefined,
    limit:    200,
  }), [filters.status, filters.riskMin])

  return useApiData(
    () => api.clusters.list(params).then(list => list.map(normCluster)),
    CLUSTERS,
    [JSON.stringify(params)],
  )
}

export function useCluster(id) {
  return useApiData(
    () => api.clusters.get(id).then(normCluster),
    CLUSTERS.find(c => c.id === id) ?? null,
    [id],
  )
}

// Cluster mutations
export function useApproveCluster(onSuccess) {
  return useMutation(api.clusters.approve, {
    onSuccess,
    mockFn: (id) => Promise.resolve({ ...CLUSTERS.find(c => c.id === id), status: 'Approved' }),
  })
}
export function useRejectCluster(onSuccess) {
  return useMutation(
    (id, reason) => api.clusters.reject(id, reason),
    {
      onSuccess,
      mockFn: (id) => Promise.resolve({ ...CLUSTERS.find(c => c.id === id), status: 'Rejected' }),
    }
  )
}
export function useMergeCluster(onSuccess) {
  return useMutation(
    (id, targetId) => api.clusters.merge(id, targetId),
    {
      onSuccess,
      mockFn: (id) => Promise.resolve({ ...CLUSTERS.find(c => c.id === id), status: 'Merged' }),
    }
  )
}
export function useBulkClusters(onSuccess) {
  return useMutation(
    (ids, action, reason) => api.clusters.bulk(ids, action, reason),
    { onSuccess }
  )
}

// ─── Narratives ───────────────────────────────────────────────────────────────
export function useNarrative(clusterId) {
  return useApiData(
    async () => {
      const list = await api.narratives.list({ cluster_id: clusterId })
      return list[0] ?? null
    },
    clusterId
      ? (NARRATIVES[
          CLUSTERS.find(c => c.id === clusterId)?.narrative_id
        ] ?? null)
      : null,
    [clusterId],
  )
}

export function useNarrativeVersions(narrativeId) {
  return useApiData(
    () => narrativeId ? api.narratives.versions(narrativeId) : Promise.resolve([]),
    [],
    [narrativeId],
  )
}

export function useApproveNarrative(onSuccess) {
  return useMutation(api.narratives.approve, { onSuccess })
}
export function useUpdateNarrative(onSuccess) {
  return useMutation(
    (id, payload) => api.narratives.update(id, payload),
    { onSuccess }
  )
}
export function useCreateNarrative(onSuccess) {
  return useMutation(api.narratives.create, { onSuccess })
}

// ─── Documents ────────────────────────────────────────────────────────────────
export function useDocuments(filters = {}) {
  const params = useMemo(() => ({
    cluster_id: filters.clusterId ?? undefined,
    tag:        filters.tag       ?? undefined,
    file_type:  filters.fileType  ?? undefined,
    limit:      200,
  }), [filters.clusterId, filters.tag, filters.fileType])

  return useApiData(
    () => api.documents.list(params),
    DOCUMENTS,
    [JSON.stringify(params)],
  )
}

export function useDocument(id) {
  return useApiData(
    () => id ? api.documents.get(id) : Promise.resolve(null),
    DOCUMENTS.find(d => d.id === id) ?? null,
    [id],
  )
}

export function useVerifyDocument(id) {
  return useApiData(
    () => id ? api.documents.verify(id) : Promise.resolve(null),
    null,
    [id],
  )
}

// ─── Reports ──────────────────────────────────────────────────────────────────
export function useReportSummary(start, end) {
  return useApiData(
    () => api.reports.summary({ start, end }),
    // mock fallback: compute from CLUSTERS
    () => {
      const s = new Date(start), e = new Date(end)
      const inRange = CLUSTERS.filter(c => {
        const d = new Date(c.created_at); return d >= s && d <= e
      })
      const approved = inRange.filter(c => c.status === 'Approved')
      return {
        total_clusters: inRange.length,
        approved_clusters: approved.length,
        rejected_clusters: inRange.filter(c => c.status === 'Rejected').length,
        pending_clusters: inRange.filter(c => !['Approved','Rejected'].includes(c.status)).length,
        total_eligible_hours: approved.reduce((s,c) => s + (c.aggregate_time_hours ?? 0), 0),
        total_credit_cad: approved.reduce((s,c) => s + (c.estimated_credit_cad ?? 0), 0),
        total_credit_usd: approved.reduce((s,c) => s + (c.estimated_credit_usd ?? 0), 0),
      }
    },
    [start, end],
  )
}

export function useReportT661(start, end, entityType = 'CCPC') {
  return useApiData(
    () => api.reports.t661({ start, end, entity_type: entityType }),
    null,
    [start, end, entityType],
  )
}

export function useReportDevelopers(start, end) {
  return useApiData(
    () => api.reports.developers({ start, end }),
    null,
    [start, end],
  )
}

export function useReportClusters(start, end) {
  return useApiData(
    () => api.reports.clusters({ start, end }),
    () => {
      const s = new Date(start), e = new Date(end)
      return CLUSTERS.filter(c => {
        const d = new Date(c.created_at); return d >= s && d <= e
      })
    },
    [start, end],
  )
}

// ─── Users ────────────────────────────────────────────────────────────────────
export function useUsers(tenantId) {
  return useApiData(
    () => api.users.list({ tenant_id: tenantId }),
    USERS,
    [tenantId],
  )
}

// ─── Agent — narrative writer ─────────────────────────────────────────────────
export function useGenerateNarrative(onSuccess) {
  return useMutation(
    (clusterId) => api.agents.generateNarrative(clusterId),
    { onSuccess }
  )
}

// ─── Vault stats (derived) ────────────────────────────────────────────────────
export function useVaultStats() {
  const { data: docs, loading, usingMock } = useDocuments()
  const stats = useMemo(() => {
    if (!docs) return getVaultStats()
    return {
      total: docs.length,
      evidence: docs.filter(d => d.tag === 'evidence').length,
      sizeKb: docs.reduce((s, d) => s + (d.size_kb ?? 0), 0),
    }
  }, [docs])
  return { data: stats, loading, usingMock }
}

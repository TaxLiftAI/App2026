/**
 * Core data-fetching hook factory.
 *
 * Every hook returns: { data, loading, error, usingMock, refetch }
 *
 * Strategy:
 *  1. Try the real API.
 *  2. If it fails (network error OR no token), fall back to mockData silently.
 *  3. A small "Using demo data" banner appears on pages when usingMock===true.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { ApiError } from '../lib/api'

export function useApiData(apiFn, mockFallback, deps = []) {
  const [data, setData]         = useState(undefined)  // undefined (not null) so { data: x = [] } defaults work
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [usingMock, setUsingMock] = useState(false)
  const runId = useRef(0)

  const fetch_ = useCallback(async () => {
    const id = ++runId.current
    setLoading(true)
    setError(null)
    try {
      const result = await apiFn()
      if (id === runId.current) {
        setData(result)
        setUsingMock(false)
        setLoading(false)
      }
    } catch (err) {
      if (id !== runId.current) return
      // Fall back to mock when API is unreachable or returns auth errors
      if (err instanceof ApiError && err.status !== 0 && err.status !== 401 && err.status < 500) {
        // Real client error (404, 400, 403) — surface it
        setError(err.message)
        setData(mockFallback ?? null)
        setUsingMock(true)
      } else {
        // Network error or server error — use mock silently
        setData(typeof mockFallback === 'function' ? mockFallback() : mockFallback ?? null)
        setUsingMock(true)
      }
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => { fetch_() }, [fetch_])

  return { data, loading, error, usingMock, refetch: fetch_ }
}

/**
 * Async mutation hook — for create/update/delete/approve/etc.
 * Returns { mutate, loading, error, data }
 */
export function useMutation(apiFn, { onSuccess, onError, mockFn } = {}) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [data, setData]       = useState(null)

  const mutate = useCallback(async (...args) => {
    setLoading(true)
    setError(null)
    try {
      const result = await apiFn(...args)
      setData(result)
      setLoading(false)
      onSuccess?.(result)
      return result
    } catch (err) {
      setLoading(false)
      if (err instanceof ApiError && err.status === 0 && mockFn) {
        // Network error — run mock locally so demo still works
        const mockResult = await mockFn(...args)
        setData(mockResult)
        onSuccess?.(mockResult)
        return mockResult
      }
      setError(err.message)
      onError?.(err)
      throw err
    }
  }, [apiFn, onSuccess, onError, mockFn])

  return { mutate, loading, error, data }
}
